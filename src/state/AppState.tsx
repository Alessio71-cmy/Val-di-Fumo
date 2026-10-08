import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TRIP_CONFIG } from '../config/trip.config';
import { loadGeo, loadMapPack, type GeoBundle, type Loaded, type MapPack } from '../data/loader';
import { buildTrip } from '../data/trip';
import type { GPSPosition, Trip } from '../domain/types';
import { guidancePolicy } from '../domain/validation';
import { computeNav, routeWaypoints, type NavResult } from '../geo/nav';
import { INITIAL_OFF_ROUTE, stepOffRoute, type OffRouteState } from '../geo/offroute';
import { Polyline } from '../geo/polyline';
import { directSunWindows, minutesSinceLocalMidnight, sunTimes, type Interval } from '../geo/sun';
import { GpsController, INITIAL_GPS_STATE, type GpsState } from '../gps/controller';
import { classifyAccuracy, classifyAge, isUsableFix } from '../gps/quality';
import { downloadAndVerify, requestPersistence, verifyAll, type PackProgress, type VerifyReport } from '../offline/pack';
import { fetchManifest } from '../offline/manifest';
import { promptInstall, readInstallState, startInstallCapture, subscribeInstall, type InstallState } from '../offline/install';
import { evaluateReadiness, type ReadinessInfo } from '../offline/status';
import { registerServiceWorker, subscribeSw, type SwState } from '../offline/swClient';
import { buildSchedule, type ScheduleResult } from '../schedule/engine';
import { buildScheduleInput } from '../schedule/input';
import { DEFAULT_PREFS, loadPrefs, resetPrefs, savePrefs, type Prefs } from '../storage/prefs';
import { fetchWeather, isWeatherStale, loadCachedWeather, saveWeather, summarizeWeather, type WeatherSnapshot, type WeatherSummary } from '../weather/openmeteo';
import { defaultRouteForPhase, PHASE_BY_ID, phaseFromEvents, type Phase } from './phase';
import type { ScheduleEventId } from '../domain/types';

export interface SunInfo {
  sunriseMin: number;
  sunsetMin: number;
  civilDuskMin: number;
  /** Finestre di sole diretto (minuti dalla mezzanotte locale) per i punti chiave, STIMATE dal rilievo. */
  direct: Record<string, Array<{ fromMin: number; toMin: number }>>;
}

export interface WeatherState {
  status: 'idle' | 'loading' | 'ok' | 'error';
  snapshot: WeatherSnapshot | null;
  summary: WeatherSummary | null;
  stale: boolean;
  error: string | null;
}

export interface PrepareState {
  running: boolean;
  progress: PackProgress | null;
  report: VerifyReport | null;
  error: string | null;
  persisted: boolean | null;
}

interface AppContextValue {
  loading: boolean;
  geo: GeoBundle | null;
  trip: Trip | null;
  loadWarnings: string[];
  prefs: Prefs;
  updatePrefs: (patch: Partial<Prefs>) => void;
  clearPersonalData: () => Promise<void>;
  nowMs: number;
  online: boolean;
  isTripDay: boolean;
  daysUntilTrip: number | null;
  phase: Phase;
  recordEvent: (id: ScheduleEventId, minutes?: number) => void;
  undoLastEvent: () => void;
  schedule: ScheduleResult | null;
  sun: SunInfo | null;
  gps: GpsState;
  startGps: () => void;
  stopGps: () => void;
  activeRouteId: string;
  setRouteOverride: (id: string | null) => void;
  activeRoute: Trip['routes'][string] | null;
  polyline: Polyline | null;
  nav: NavResult | null;
  navReliable: boolean;
  offRoute: OffRouteState;
  fixQuality: { accuracy: ReturnType<typeof classifyAccuracy>; age: ReturnType<typeof classifyAge>; ageMs: number; usable: boolean } | null;
  weather: WeatherState;
  refreshWeather: () => void;
  offline: ReadinessInfo | null;
  refreshOffline: () => Promise<void>;
  prepare: PrepareState;
  prepareTrip: () => Promise<void>;
  verifyNow: () => Promise<VerifyReport | null>;
  sw: SwState;
  install: InstallState;
  installApp: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  mapPack: Loaded<MapPack> | null;
  loadMap: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
}

const Ctx = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fuori da AppProvider');
  return v;
}

/** Data locale (YYYY-MM-DD) di un istante nel fuso dell'escursione. */
export function localDateISO(ms: number, tz = TRIP_CONFIG.timezone): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
  return p;
}

/** Messaggio in italiano per un errore di rete del servizio meteo (il browser restituisce testi in inglese). */
function weatherErrorText(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (!m || /failed to fetch|networkerror|load failed|network request failed|aborted|abort/i.test(m)) return 'servizio non raggiungibile o rete assente';
  return m;
}


export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [geo, setGeo] = useState<GeoBundle | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const prefsLoaded = useRef(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [toast, setToast] = useState<string | null>(null);

  // ---- persistenza delle preferenze ----
  // Le modifiche si accumulano in un riferimento sincrono (due aggiornamenti nello stesso istante non si sovrascrivono), si salvano
  // dopo 250 ms e, soprattutto, subito quando la pagina viene nascosta o chiusa: un orario appena registrato non deve andare perso.
  const prefsRef = useRef<Prefs>(DEFAULT_PREFS);
  const pendingSave = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const flushPrefs = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingSave.current) {
      pendingSave.current = false;
      void savePrefs(prefsRef.current);
    }
  }, []);
  const updatePrefs = useCallback(
    (patch: Partial<Prefs>) => {
      const next = { ...prefsRef.current, ...patch };
      prefsRef.current = next;
      setPrefs(next);
      if (!prefsLoaded.current) return;
      pendingSave.current = true;
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(flushPrefs, 250);
    },
    [flushPrefs],
  );
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushPrefs();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushPrefs);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushPrefs);
    };
  }, [flushPrefs]);

  const clearPersonalData = useCallback(async () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    pendingSave.current = false;
    prefsRef.current = DEFAULT_PREFS;
    await resetPrefs();
    setPrefs(DEFAULT_PREFS);
  }, []);

  // ---- caricamento iniziale ----
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [p, g] = await Promise.all([loadPrefs(), loadGeo()]);
      if (!alive) return;
      prefsRef.current = p;
      setPrefs(p);
      prefsLoaded.current = true;
      setGeo(g);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const built = useMemo(() => (geo ? buildTrip(geo) : null), [geo]);
  const trip = built?.trip ?? null;

  // ---- aspetto ----
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.style.setProperty('--text-scale', String(prefs.textScale));
  }, [prefs.theme, prefs.textScale]);

  // ---- orologio e rete ----
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 10_000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  const tripDate = trip?.date ?? TRIP_CONFIG.date;
  const tz = TRIP_CONFIG.timezone;
  const today = localDateISO(nowMs, tz);
  const isTripDay = today === tripDate;
  const daysUntilTrip = useMemo(() => {
    const a = Date.parse(`${tripDate}T00:00:00Z`);
    const b = Date.parse(`${today}T00:00:00Z`);
    return Math.round((a - b) / 86_400_000);
  }, [tripDate, today]);

  // ---- fasi ed eventi ----
  const phase: Phase = prefs.phase;
  const recordEvent = useCallback(
    (id: ScheduleEventId, minutes?: number) => {
      // ora del giorno (minuti dalla mezzanotte locale di OGGI), non dal giorno dell'escursione: anche usando l'app in un altro giorno il valore resta valido
      const m = minutes ?? Math.round(minutesSinceLocalMidnight(Date.now(), localDateISO(Date.now(), tz), tz));
      const actuals = { ...prefs.actuals, [id]: m };
      updatePrefs({ actuals, phase: phaseFromEvents(Object.keys(actuals) as ScheduleEventId[]) });
    },
    [prefs.actuals, tz, updatePrefs],
  );
  const undoLastEvent = useCallback(() => {
    const order = Object.keys(PHASE_BY_ID).flatMap((p) => (PHASE_BY_ID[p as Phase].advanceEvent ? [PHASE_BY_ID[p as Phase].advanceEvent as ScheduleEventId] : []));
    const present = order.filter((e) => prefs.actuals[e] !== undefined);
    const last = present[present.length - 1];
    if (!last) return;
    const actuals = { ...prefs.actuals };
    delete actuals[last];
    updatePrefs({ actuals, phase: phaseFromEvents(Object.keys(actuals) as ScheduleEventId[]) });
  }, [prefs.actuals, updatePrefs]);

  // ---- sole ----
  const sun = useMemo<SunInfo | null>(() => {
    const ref = trip?.points[TRIP_CONFIG.sunReferencePoint];
    const [lon, lat] = ref?.coordinates ?? [10.5134, 46.052];
    try {
      const t = sunTimes(tripDate, lat, lon);
      const toMin = (ms: number) => minutesSinceLocalMidnight(ms, tripDate, tz);
      const direct: SunInfo['direct'] = {};
      if (geo?.horizon.ok) {
        for (const [k, h] of Object.entries(geo.horizon.data.points)) {
          const ws: Interval[] = directSunWindows(tripDate, h.lat, h.lon, h, 2);
          direct[k] = ws.map((w) => ({ fromMin: toMin(w.from), toMin: toMin(w.to) }));
        }
      }
      return { sunriseMin: toMin(t.sunrise), sunsetMin: toMin(t.sunset), civilDuskMin: toMin(t.civilDusk), direct };
    } catch {
      return null;
    }
  }, [trip, geo, tripDate, tz]);

  // ---- programma ----
  const schedule = useMemo<ScheduleResult | null>(() => {
    if (!sun) return null;
    return buildSchedule(
      buildScheduleInput({
        prefs,
        geo,
        trip,
        sunsetMin: sun.sunsetMin,
        civilDuskMin: sun.civilDuskMin,
        nowMin: isTripDay ? Math.round(minutesSinceLocalMidnight(nowMs, tripDate, tz)) : undefined,
      }),
    );
  }, [sun, geo, trip, prefs.departureMin, prefs.pace, prefs.driveOverrides, prefs.actuals, prefs.skipLeno, isTripDay, nowMs, tripDate, tz]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- GPS ----
  const gpsRef = useRef<GpsController | null>(null);
  if (!gpsRef.current) {
    gpsRef.current = new GpsController(typeof navigator !== 'undefined' ? navigator.geolocation : undefined, {
      maximumAgeMs: TRIP_CONFIG.gps.maximumAgeMs,
      timeoutMs: TRIP_CONFIG.gps.timeoutMs,
      secureContext: typeof window !== 'undefined' ? window.isSecureContext : true,
    });
  }
  const [gps, setGps] = useState<GpsState>(INITIAL_GPS_STATE);
  useEffect(() => {
    const c = gpsRef.current as GpsController;
    const un = c.subscribe(setGps);
    const onVis = () => {
      if (document.visibilityState === 'visible') c.restart();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      un();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  const startGps = useCallback(() => gpsRef.current?.start(), []);
  const stopGps = useCallback(() => gpsRef.current?.stop(), []);

  // ultima posizione nota: salvata SOLO dopo che l'utente ha attivato il GPS, al massimo ogni 15 s, solo sul dispositivo
  const lastSave = useRef(0);
  useEffect(() => {
    const p = gps.position;
    if (!p || gps.status !== 'tracking') return;
    if (p.timestamp - lastSave.current < 15_000) return;
    lastSave.current = p.timestamp;
    updatePrefs({ lastPosition: { lat: p.lat, lng: p.lng, accuracyM: p.accuracyM, timestamp: p.timestamp } });
  }, [gps.position, gps.status, updatePrefs]);

  // Wake Lock (facoltativo)
  useEffect(() => {
    if (!prefs.wakeLock || gps.status !== 'tracking') return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
        if (cancelled) await lock?.release();
      } catch {
        /* non supportato o negato */
      }
    };
    void acquire();
    const onVis = () => void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => undefined);
    };
  }, [prefs.wakeLock, gps.status]);

  // ---- percorso attivo e navigazione ----
  const [routeOverride, setRouteOverride] = useState<string | null>(null);
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current !== phase) {
      prevPhase.current = phase;
      setRouteOverride(null);
    }
  }, [phase]);
  const choice = useMemo(() => ({ out: prefs.bank.out ? 'route-out-bank' : 'route-out', back: prefs.bank.back ? 'route-back-bank' : 'route-back' }), [prefs.bank]);
  const requested = routeOverride ?? defaultRouteForPhase(phase, choice);
  const activeRoute = trip?.routes[requested] ?? trip?.routes['route-out'] ?? null;
  const activeRouteId = activeRoute?.id ?? requested;
  const polyline = useMemo(() => (activeRoute ? new Polyline(activeRoute.geometry) : null), [activeRoute]);

  const prevAlong = useRef<number | undefined>(undefined);
  useEffect(() => {
    prevAlong.current = undefined;
  }, [activeRouteId]);

  const policy = guidancePolicy(activeRoute?.provenance.validation ?? 'unverified');
  const fixQuality = useMemo(() => {
    const p: GPSPosition | null = gps.position;
    if (!p) return null;
    const ageMs = Math.max(0, nowMs - p.timestamp);
    return { accuracy: classifyAccuracy(p.accuracyM), age: classifyAge(ageMs), ageMs, usable: isUsableFix(p, nowMs) };
  }, [gps.position, nowMs]);

  const nav = useMemo<NavResult | null>(() => {
    if (!polyline || !trip || !gps.position || !fixQuality?.usable || !policy.progress) return null;
    const wps = routeWaypoints(trip, activeRouteId);
    const n = computeNav(polyline, wps, [gps.position.lng, gps.position.lat], {
      prevAlong: prevAlong.current,
      timeAt: activeRoute?.timeAt,
      paceFactor: TRIP_CONFIG.paceFactors[prefs.pace],
    });
    return n;
    // nowMs: la validità del fix cambia con il tempo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyline, trip, gps.position, fixQuality?.usable, policy.progress, activeRouteId, activeRoute, prefs.pace]);
  useEffect(() => {
    if (nav?.reliable) prevAlong.current = nav.alongM;
  }, [nav]);

  const [offRoute, setOffRoute] = useState<OffRouteState>(INITIAL_OFF_ROUTE);
  const lastFixT = useRef(0);
  useEffect(() => {
    setOffRoute(INITIAL_OFF_ROUTE);
    lastFixT.current = 0;
  }, [activeRouteId]);
  useEffect(() => {
    const p = gps.position;
    if (!p || !policy.softOffRouteAlert || !prefs.offRouteAlerts || !polyline) return;
    if (p.timestamp === lastFixT.current) return;
    lastFixT.current = p.timestamp;
    const d = polyline.project([p.lng, p.lat], prevAlong.current !== undefined ? { minAlong: prevAlong.current - 120, maxAlong: prevAlong.current + 500 } : {}).dist;
    setOffRoute((s) => stepOffRoute(s, { t: p.timestamp, accuracyM: p.accuracyM, distM: d, stale: Date.now() - p.timestamp > 120_000 }));
  }, [gps.position, policy.softOffRouteAlert, prefs.offRouteAlerts, polyline]);

  // ---- meteo ----
  const [weather, setWeather] = useState<WeatherState>({ status: 'idle', snapshot: null, summary: null, stale: false, error: null });
  const weatherPoint = trip?.points[TRIP_CONFIG.weather.pointKey];
  const doWeather = useCallback(
    async (force: boolean) => {
      if (!weatherPoint) return;
      const cached = await loadCachedWeather();
      const sameDay = cached && cached.dateISO === tripDate;
      if (sameDay) {
        setWeather({ status: 'ok', snapshot: cached, summary: summarizeWeather(cached), stale: isWeatherStale(cached, Date.now(), TRIP_CONFIG.weather.staleAfterMin), error: null });
      }
      const fresh = sameDay && !isWeatherStale(cached, Date.now(), 30);
      if (!navigator.onLine || (fresh && !force)) return;
      setWeather((w) => ({ ...w, status: 'loading' }));
      try {
        const snap = await fetchWeather({ lat: weatherPoint.coordinates[1], lon: weatherPoint.coordinates[0], dateISO: tripDate, elevationM: TRIP_CONFIG.weather.elevationM }, { timeoutMs: TRIP_CONFIG.weather.timeoutMs });
        await saveWeather(snap);
        setWeather({ status: 'ok', snapshot: snap, summary: summarizeWeather(snap), stale: false, error: null });
      } catch (e) {
        setWeather((w) => ({ ...w, status: w.snapshot ? 'ok' : 'error', stale: w.snapshot ? isWeatherStale(w.snapshot, Date.now(), TRIP_CONFIG.weather.staleAfterMin) : false, error: weatherErrorText(e) }));
      }
    },
    [weatherPoint, tripDate],
  );
  useEffect(() => {
    if (weatherPoint) void doWeather(false);
  }, [weatherPoint, online, doWeather]);
  const refreshWeather = useCallback(() => void doWeather(true), [doWeather]);

  // ---- offline ----
  const [offlineRaw, setOffline] = useState<ReadinessInfo | null>(null);
  /** Esito dell'ultima verifica PROFONDA (hash) fatta in questa sessione: se fallisce, "pronto" non può essere mostrato. */
  const [deepReport, setDeepReport] = useState<VerifyReport | null>(null);
  const offline = useMemo<ReadinessInfo | null>(() => {
    if (!offlineRaw) return null;
    const d = deepReport;
    if (d && !d.ok && offlineRaw.installed && d.buildId === offlineRaw.installed.buildId && d.packVersion === offlineRaw.installed.packVersion) {
      return {
        ...offlineRaw,
        state: 'partial',
        missing: [...d.missing, ...d.corrupted],
        reason: `La verifica ha trovato ${d.missing.length} risorse mancanti e ${d.corrupted.length} danneggiate: premi “Prepara il viaggio” per ripararle.`,
      };
    }
    return offlineRaw;
  }, [offlineRaw, deepReport]);
  const [sw, setSw] = useState<SwState>({ supported: false, registered: false, controlled: false, updateAvailable: false });
  const [install, setInstall] = useState<InstallState>(readInstallState);
  useEffect(() => {
    startInstallCapture();
    return subscribeInstall(setInstall);
  }, []);
  const installApp = useCallback(() => promptInstall(), []);
  const [prepare, setPrepare] = useState<PrepareState>({ running: false, progress: null, report: null, error: null, persisted: null });
  const refreshOffline = useCallback(async () => {
    setOffline(await evaluateReadiness());
  }, []);
  useEffect(() => {
    if (import.meta.env.PROD) void registerServiceWorker();
    const un = subscribeSw(setSw);
    void refreshOffline();
    return un;
  }, [refreshOffline]);
  useEffect(() => {
    void refreshOffline();
  }, [online, sw.controlled, sw.updateAvailable, refreshOffline]);

  const autoDeep = useRef(false);
  useEffect(() => {
    if (autoDeep.current || offlineRaw?.state !== 'ready' || !offlineRaw.installed) return;
    const installed = offlineRaw.installed;
    const t = window.setTimeout(() => {
      autoDeep.current = true;
      void verifyAll(installed, { deep: true }).then(setDeepReport).catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [offlineRaw]);

  const prepareTrip = useCallback(async () => {
    setPrepare({ running: true, progress: null, report: null, error: null, persisted: null });
    try {
      const manifest = await fetchManifest();
      if (!manifest) throw new Error('Impossibile leggere l’elenco delle risorse: serve la rete (o questa è una build di sviluppo).');
      const persisted = await requestPersistence();
      const report = await downloadAndVerify(manifest, { onProgress: (progress) => setPrepare((s) => ({ ...s, progress })) });
      setDeepReport(report);
      setPrepare({ running: false, progress: null, report, error: report.ok ? null : `Verifica non superata: ${report.missing.length} mancanti, ${report.corrupted.length} danneggiate.`, persisted });
    } catch (e) {
      setPrepare({ running: false, progress: null, report: null, error: e instanceof Error ? e.message : 'Preparazione non riuscita', persisted: null });
    }
    await refreshOffline();
  }, [refreshOffline]);

  const verifyNow = useCallback(async () => {
    const info = await evaluateReadiness();
    if (!info.installed) return null;
    const report = await verifyAll(info.installed, { deep: true });
    setDeepReport(report);
    setPrepare((s) => ({ ...s, report, error: report.ok ? null : `Verifica non superata: ${report.missing.length} mancanti, ${report.corrupted.length} danneggiate.` }));
    await refreshOffline();
    return report;
  }, [refreshOffline]);

  // ---- pacchetto mappa ----
  const [mapPack, setMapPack] = useState<Loaded<MapPack> | null>(null);
  const mapLoading = useRef(false);
  const loadMap = useCallback(() => {
    if (mapLoading.current || (mapPack && mapPack.ok)) return;
    mapLoading.current = true;
    void loadMapPack().then((r) => {
      setMapPack(r);
      mapLoading.current = false;
    });
  }, [mapPack]);
  // dopo un download riuscito, riprova a caricare la mappa
  useEffect(() => {
    if (prepare.report?.ok && mapPack && !mapPack.ok) {
      setMapPack(null);
    }
  }, [prepare.report, mapPack]);

  const value: AppContextValue = {
    loading,
    geo,
    trip,
    loadWarnings: built?.warnings ?? [],
    prefs,
    updatePrefs,
    clearPersonalData,
    nowMs,
    online,
    isTripDay,
    daysUntilTrip,
    phase,
    recordEvent,
    undoLastEvent,
    schedule,
    sun,
    gps,
    startGps,
    stopGps,
    activeRouteId,
    setRouteOverride,
    activeRoute,
    polyline,
    nav,
    navReliable: !!nav?.reliable,
    offRoute,
    fixQuality,
    weather,
    refreshWeather,
    offline,
    refreshOffline,
    prepare,
    prepareTrip,
    verifyNow,
    sw,
    install,
    installApp,
    mapPack,
    loadMap,
    toast,
    showToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
