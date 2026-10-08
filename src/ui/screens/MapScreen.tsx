import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { guidancePolicy } from '../../domain/validation';
import { fmtAgo, fmtDistance, fmtDuration } from '../../geo/format';
import { formatDegMin, formatLatLon, compassIT } from '../../geo/geodesy';
import { routeWaypoints } from '../../geo/nav';
import { ACCURACY_LABEL } from '../../gps/quality';
import { useApp } from '../../state/AppState';
import { Icon } from '../components/Icon';
import { copyText, Sheet, Stat, ValidationBadge } from '../components/ui';
import type { MapHandle } from '../map/MapView';
import { StaticMap } from '../map/StaticMap';
import { webglSupported } from '../map/mapStyle';
import type { GotoFn } from '../tabs';

const MapView = lazy(() => import('../map/MapView').then((m) => ({ default: m.MapView })));

const GPS_PROBLEM: Record<string, string> = {
  denied: 'Permesso di posizione negato. Per riattivarlo: impostazioni del browser/telefono → siti web o app → Posizione → Consenti, poi riprova.',
  unavailable: 'Posizione non disponibile: sposta il telefono all’aperto, controlla che il GPS/Posizione sia attivo e riprova.',
  unsupported: 'Questo browser non offre la geolocalizzazione.',
  insecure: 'La geolocalizzazione richiede una connessione sicura (HTTPS): apri l’app dall’indirizzo https.',
};

export function MapScreen({ goto, routeId }: { goto: GotoFn; routeId?: string }) {
  const a = useApp();
  const { trip, mapPack, gps, nav, activeRouteId, prefs, loading } = a;
  const ref = useRef<MapHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [forceSvg, setForceSvg] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const gl = useMemo(() => webglSupported(), []);
  const hudRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [insets, setInsets] = useState({ top: 110, bottom: 180 });

  useEffect(() => {
    a.loadMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.mapPack]);

  // "Vedi sulla mappa" da una tappa o dalla variante: mostra il percorso richiesto
  useEffect(() => {
    if (routeId && trip?.routes[routeId]) a.setRouteOverride(routeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, trip]);

  // ingombro dei controlli sovrapposti: la traccia viene inquadrata nella parte libera della mappa
  useEffect(() => {
    const hud = hudRef.current;
    const bottom = bottomRef.current;
    if (!hud || !bottom || typeof ResizeObserver === 'undefined') return;
    const measure = () => setInsets((cur) => {
      const top = Math.round(hud.getBoundingClientRect().height + 6);
      const b = Math.round(bottom.getBoundingClientRect().height);
      return Math.abs(cur.top - top) < 4 && Math.abs(cur.bottom - b) < 4 ? cur : { top, bottom: b };
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(hud);
    ro.observe(bottom);
    return () => ro.disconnect();
  }, [loading, trip]);

  if (loading || !trip) return <p role="status" style={{ padding: 16 }}>Caricamento…</p>;
  const route = trip.routes[activeRouteId];
  if (!route) {
    return (
      <div style={{ padding: 16 }}>
        <div className="card alert-danger" role="alert">
          <h2>Traccia non disponibile</h2>
          <p>I dati del percorso non sono stati caricati: la mappa non può mostrare la traccia. Controlla “Dati incompleti” in Oggi e, se sei online, ricarica l’app.</p>
          <button className="btn" onClick={() => goto('percorso')}>Apri l’elenco testuale delle tappe</button>
        </div>
      </div>
    );
  }
  const pack = mapPack && mapPack.ok ? mapPack.data : null;
  const packLoading = !mapPack; // ancora in lettura: niente avvisi né mappa schematica finché non si sa com'è andata
  const useGl = !!pack && gl && !forceSvg;
  const policy = guidancePolicy(route.provenance.validation);
  const wps = routeWaypoints(trip, activeRouteId);
  const sel = selected ? (trip.points[selected] ?? trip.criticalPoints.find((c) => c.id === selected)) : null;
  const selWp = selected ? wps.find((w) => w.id === selected) : undefined;
  const selCrit = selected ? trip.criticalPoints.find((c) => c.id === selected) : undefined;
  const bankOther = activeRouteId === 'route-out' ? 'route-out-bank' : activeRouteId === 'route-back' ? 'route-back-bank' : activeRouteId === 'route-out-bank' ? 'route-out' : activeRouteId === 'route-back-bank' ? 'route-back' : null;
  const imported = prefs.importedTrack?.points ?? null;
  const pos = gps.position;
  const q = a.fixQuality;

  // tre domande: Dove sono? Dove devo andare? Quanto manca?
  let whereTitle = 'GPS spento';
  let whereSub: string = 'attiva il GPS';
  if (gps.status === 'requesting') {
    whereTitle = 'In attesa…';
    whereSub = 'cerco il segnale GPS';
  } else if (pos && q) {
    whereTitle = q.usable ? (nav?.reliable ? (nav.distToRouteM <= 25 ? 'Sulla traccia' : `${fmtDistance(nav.distToRouteM)} dalla traccia`) : 'Fuori traccia') : q.age === 'obsoleta' ? 'Posizione obsoleta' : 'Posizione imprecisa';
    whereSub = `±${Math.round(pos.accuracyM)} m · ${fmtAgo(q.ageMs)}`;
  } else if (gps.status !== 'idle') {
    whereTitle = 'GPS non attivo';
    whereSub = GPS_PROBLEM[gps.status] ? 'vedi avviso' : '';
  }
  const first = wps[0];
  const nextName = nav?.next?.name ?? (nav ? 'Arrivo' : (wps[1]?.name ?? first?.name ?? '—'));
  const nextDist = nav?.next ? fmtDistance(nav.next.distAlongM) : nav ? fmtDistance(nav.remainingM) : wps[1] ? fmtDistance(wps[1].chainM) : '—';
  const remainingVal = nav ? fmtDistance(nav.remainingM) : fmtDistance(route.lengthM);
  const remainingSub = nav?.next?.etaMin !== undefined ? `prossimo punto ≈${fmtDuration(nav.next.etaMin)}` : nav ? 'lungo la traccia' : 'lunghezza totale';
  const sched = a.schedule?.summary;

  const chips: Array<{ id: string; label: string }> = [
    { id: prefs.bank.out ? 'route-out-bank' : 'route-out', label: 'Andata' },
    { id: prefs.bank.back ? 'route-back-bank' : 'route-back', label: 'Ritorno' },
    { id: 'walk-leno', label: 'Leno' },
  ];
  if (trip.routes['route-out-bank']) chips.splice(2, 0, { id: activeRouteId.includes('back') ? 'route-back-bank' : 'route-out-bank', label: 'Sponda opposta' });

  return (
    <div className="mapwrap" data-testid="map-screen" data-mode={useGl ? 'gl' : 'svg'}>
      {useGl && pack ? (
        <Suspense fallback={<p role="status" style={{ padding: 16 }}>Carico la mappa…</p>}>
          <MapView
            ref={ref}
            trip={trip}
            pack={pack}
            routeId={activeRouteId}
            otherRouteId={bankOther}
            position={q?.usable ? pos : null}
            imported={imported}
            selectedId={selected}
            onSelect={setSelected}
            onFail={(why) => setForceSvg(why)}
            insets={insets}
          />
        </Suspense>
      ) : packLoading ? (
        <p role="status" className="map-loading">
          Carico la mappa…
        </p>
      ) : (
        <StaticMap ref={ref} trip={trip} pack={pack} routeId={activeRouteId} otherRouteId={bankOther} position={q?.usable ? pos : null} imported={imported} selectedId={selected} onSelect={setSelected} />
      )}

      <h1 className="sr-only">Mappa e posizione</h1>
      <div className="map-hud" aria-live="off" ref={hudRef}>
        <Stat label="Dove sono" value={whereTitle} sub={whereSub} id="hud-where" />
        <Stat label="Dove devo andare" value={<span style={{ fontSize: '0.92em' }}>{nextName}</span>} sub={`tra ${nextDist}`} id="hud-next" />
        <Stat label="Quanto manca" value={remainingVal} sub={remainingSub} id="hud-left" />
      </div>

      <div className="map-bottom" ref={bottomRef}>
        <div className="map-controls">
          <div className="map-tools">
            <button className="btn secondary" onClick={() => ref.current?.center()} disabled={!pos} aria-label="Centra su di me" title="Centra su di me">
              <Icon name="target" />
            </button>
            <button className="btn secondary" onClick={() => ref.current?.fit()} aria-label="Mostra tutto il percorso" title="Mostra tutto il percorso">
              <Icon name="fit" />
            </button>
            <button
              className={`btn ${gps.status === 'tracking' || gps.status === 'requesting' ? '' : 'secondary'}`}
              onClick={() => (gps.status === 'tracking' || gps.status === 'requesting' ? a.stopGps() : a.startGps())}
              aria-pressed={gps.status === 'tracking' || gps.status === 'requesting'}
              aria-label={gps.status === 'tracking' || gps.status === 'requesting' ? 'Disattiva il GPS' : 'Attiva il GPS'}
              data-testid="gps-toggle"
            >
              <Icon name="gps" />
            </button>
          </div>
          <div className="map-chips" role="group" aria-label="Percorso mostrato">
            {chips.map((c) => (
              <button key={c.id} aria-pressed={activeRouteId === c.id} onClick={() => a.setRouteOverride(c.id)}>
                {c.label}
              </button>
            ))}
            <button onClick={() => setListOpen(true)} aria-haspopup="dialog">
              <Icon name="list" size={16} /> Elenco punti
            </button>
          </div>
        </div>

        <div className="map-banner stack">
          {GPS_PROBLEM[gps.status] ? (
            <div className="card alert-danger" role="alert" style={{ margin: 0 }}>
              <strong>
                <Icon name="alert" size={18} /> GPS:{' '}
              </strong>
              {GPS_PROBLEM[gps.status]}
            </div>
          ) : null}
          {!GPS_PROBLEM[gps.status] && gps.warning ? (
            <div className="card alert-warning" role="status" style={{ margin: 0 }} data-testid="gps-warning">
              {pos
                ? 'Segnale GPS interrotto: la posizione mostrata può essere vecchia. Aspetta qualche secondo o cerca un punto con cielo libero.'
                : 'Ancora nessun segnale GPS. Vai all’aperto, con cielo libero: il primo rilevamento può richiedere un minuto.'}
            </div>
          ) : null}
          {gps.status === 'idle' && !pos ? (
            <div className="card alert-info row between" style={{ margin: 0, padding: 10 }}>
              <span className="small">
                <strong>GPS spento.</strong> Parte solo se lo attivi tu.
              </span>
              <button className="btn small" onClick={a.startGps} data-testid="gps-enable">
                <Icon name="gps" size={18} /> Attiva
              </button>
            </div>
          ) : null}
          {pos && q && !q.usable ? (
            <div className="card alert-warning" role="status" style={{ margin: 0 }} data-testid="gps-poor">
              {q.age === 'obsoleta'
                ? `Posizione non aggiornata da ${fmtAgo(q.ageMs).replace(' fa', '')}: progresso e avvisi sospesi. Su iPhone il GPS si ferma se l’app va in secondo piano.`
                : `${ACCURACY_LABEL[q.accuracy]} (±${Math.round(pos.accuracyM)} m): distanza e avvisi sospesi finché il segnale non migliora.`}
            </div>
          ) : null}
          {pos && q?.usable && a.offRoute.status === 'possibly-off' && prefs.offRouteAlerts ? (
            <div className="card alert-warning" role="status" style={{ margin: 0 }} data-testid="off-route">
              <strong>Possibile allontanamento dalla traccia mappata</strong> (≈{nav ? fmtDistance(nav.distToRouteM) : '—'}). La traccia è derivata da OpenStreetMap e può differire dal sentiero reale: controlla segnavia e mappa. Nessun allarme: è solo un’indicazione.
            </div>
          ) : null}
          {!pack && !packLoading ? (
            <div className="card alert-warning" role="status" style={{ margin: 0 }} data-testid="no-pack">
              <strong>Pacchetto mappa non disponibile</strong> (non è stato scaricato o non è leggibile): uso la mappa schematica con traccia e punti.{' '}
              <button className="btn small ghost" onClick={() => goto('oggi')}>
                Prepara il viaggio
              </button>
            </div>
          ) : null}
          {forceSvg ? (
            <div className="card alert-warning" role="status" style={{ margin: 0 }} data-testid="gl-failed">
              Mappa dettagliata non disponibile su questo dispositivo ({forceSvg.slice(0, 80)}): uso la mappa schematica.
            </div>
          ) : null}
          {sel ? (
            <div className="card" style={{ margin: 0 }} data-testid="selected-panel">
              <div className="row between">
                <strong>{'name' in sel ? sel.name : (sel as { label: string }).label}</strong>
                <button className="btn ghost small" onClick={() => setSelected(null)} aria-label="Chiudi la scheda del punto">
                  <Icon name="close" size={16} />
                </button>
              </div>
              {selWp ? (
                <p className="small" style={{ margin: '4px 0' }}>
                  {fmtDistance(selWp.chainM)} dall’inizio del percorso
                  {nav ? ` · ${nav.alongM >= selWp.chainM - 15 ? 'già passato' : `a ${fmtDistance(selWp.chainM - nav.alongM)} da te (lungo la traccia)`}` : ''}
                </p>
              ) : null}
              {selCrit ? <p className="small" style={{ margin: '4px 0' }}>{selCrit.detail}</p> : null}
              {'description' in sel && sel.description ? <p className="small" style={{ margin: '4px 0' }}>{sel.description}</p> : null}
              <div className="row wrap small">{'provenance' in sel ? <ValidationBadge status={sel.provenance.validation} long /> : null}</div>
            </div>
          ) : null}
        </div>

        <div className="map-attrib" aria-label="Attribuzioni">
          © OpenStreetMap contributors (ODbL) · EU-DEM/Copernicus · traccia non verificata sul campo
        </div>
      </div>

      {listOpen ? (
        <Sheet title="Punti del percorso" onClose={() => setListOpen(false)}>
          <p className="muted small">
            Elenco testuale (utile anche senza mappa). Distanze lungo la traccia dall’inizio del percorso “{route.name}”. {policy.labelAsToVerify ? 'Dati da OpenStreetMap: da verificare sul campo.' : ''}
          </p>
          <ol style={{ paddingLeft: 20 }} data-testid="wp-list">
            {wps.map((w) => {
              const p = trip.points[w.id];
              return (
                <li key={w.id} style={{ marginBottom: 10 }}>
                  <strong>{w.name}</strong> — {fmtDistance(w.chainM)}
                  {nav ? <span className="muted small"> ({nav.alongM >= w.chainM - 15 ? 'passato' : `tra ${fmtDistance(w.chainM - nav.alongM)}`})</span> : null}
                  {p ? (
                    <div className="small mono">
                      {formatLatLon(p.coordinates[1], p.coordinates[0])}{' '}
                      <button className="btn ghost small" onClick={async () => a.showToast((await copyText(formatLatLon(p.coordinates[1], p.coordinates[0]))) ? 'Coordinate copiate' : 'Copia non riuscita')}>
                        <Icon name="copy" size={14} /> Copia
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
          {nav ? (
            <p className="small">
              Direzione di marcia della traccia: <strong>{compassIT(nav.routeBearingDeg)}</strong>
              {pos ? ` · posizione ${formatDegMin(pos.lat, pos.lng)}` : ''}
            </p>
          ) : null}
          {sched ? <p className="small">Ultimo orario prudenziale per iniziare il ritorno: vedi Programma in “Oggi”.</p> : null}
        </Sheet>
      ) : null}
    </div>
  );
}
