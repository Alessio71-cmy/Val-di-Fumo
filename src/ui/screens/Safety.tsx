import { useEffect, useRef, useState, type ReactNode } from 'react';
import { APP_LIMITS, CHECKLIST, CHECKLIST_GROUP_LABEL, CONTACTS_TO_VERIFY, EMERGENCY_NUMBERS, EMERGENCY_STEPS, SAFETY_NOTICES } from '../../content/safety';
import { SOURCES } from '../../data/trip';
import { compareToReference, decimate, parseGpx, toGpx, type TrackComparison } from '../../geo/gpx';
import { fmtAgo, fmtBytes, fmtDateTimeIT, fmtDistance } from '../../geo/format';
import { formatDegMin, formatLatLon } from '../../geo/geodesy';
import { Polyline } from '../../geo/polyline';
import { ACCURACY_LABEL, AGE_LABEL } from '../../gps/quality';
import { applyUpdate } from '../../offline/swClient';
import { useApp } from '../../state/AppState';
import type { ThemePref } from '../../storage/prefs';
import { Icon } from '../components/Icon';
import { copyText, ValidationBadge } from '../components/ui';
import type { GotoOpts } from '../tabs';

function Fold({ id, title, icon, open, children }: { id: string; title: string; icon: Parameters<typeof Icon>[0]['name']; open?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (open && ref.current) {
      ref.current.open = true;
      ref.current.scrollIntoView?.({ block: 'start' });
    }
  }, [open]);
  return (
    <details className="fold" id={id} ref={ref} open={open}>
      <summary>
        <Icon name={icon} /> {title}
      </summary>
      <div className="body">{children}</div>
    </details>
  );
}

const GPS_STATUS_TEXT: Record<string, string> = {
  idle: 'Spento (nessuna posizione letta)',
  requesting: 'In attesa del primo segnale…',
  tracking: 'Attivo',
  denied: 'Permesso negato',
  unavailable: 'Posizione non disponibile',
  unsupported: 'Non supportato da questo browser',
  insecure: 'Richiede HTTPS',
};

const STATE_TEXT: Record<string, string> = {
  ready: 'Pronto per l’uso offline',
  'needs-reload': 'Tutto in cache: riapri l’app una volta',
  partial: 'Parziale: mancano risorse',
  none: 'Non pronto',
  stale: 'Da ripetere (versione diversa)',
  unsupported: 'Non supportato in questo contesto',
  dev: 'Build di sviluppo',
};

export function SafetyScreen({ focus }: { focus?: GotoOpts['section'] }) {
  const a = useApp();
  const { gps, fixQuality, prefs, trip, offline, prepare, sw, nowMs, geo } = a;
  const pos = gps.position;
  const last = prefs.lastPosition;
  const [cmp, setCmp] = useState<{ name: string; result: TrackComparison; pts: Array<[number, number]> } | null>(null);
  const [gpxErr, setGpxErr] = useState<string | null>(null);
  const route = trip?.routes['route-out'];

  const coordText = pos ? `${formatLatLon(pos.lat, pos.lng)} (±${Math.round(pos.accuracyM)} m)` : null;
  const emergencyText = () => {
    const p = pos ?? (last ? { lat: last.lat, lng: last.lng, accuracyM: last.accuracyM, timestamp: last.timestamp } : null);
    const when = p ? new Date(p.timestamp).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' }) : '';
    return [
      'EMERGENZA — Trentino, comune di Valdaone (Daone), Val di Fumo.',
      'Zona: sentiero dalla diga di Malga Bissina al Rifugio Val di Fumo.',
      p ? `Coordinate: ${formatLatLon(p.lat, p.lng)} (gradi decimali), ${formatDegMin(p.lat, p.lng)}; precisione ±${Math.round(p.accuracyM)} m; rilevate il ${when}.` : 'Coordinate: non disponibili (GPS spento).',
      'Persone: … Condizioni: … Cosa è successo: …',
    ].join('\n');
  };

  const share = async (title: string, text: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch {
      return; // annullato dall'utente
    }
    a.showToast((await copyText(text)) ? 'Testo copiato' : 'Condivisione non disponibile');
  };

  const downloadGpx = (routeId: string, file: string) => {
    const r = trip?.routes[routeId];
    if (!r) return;
    const wp = routeId.startsWith('walk')
      ? []
      : (['park-dam', 'malga-breguzzo', 'fall-chiese', 'malga-val-di-fumo', 'rifugio-val-di-fumo'] as const)
          .map((id) => trip?.points[id])
          .filter(Boolean)
          .map((p) => ({ lat: p!.coordinates[1], lon: p!.coordinates[0], ele: p!.elevationM, name: p!.name }));
    const xml = toGpx(
      { name: r.name, description: 'Traccia DERIVATA da OpenStreetMap (ODbL), non rilevata sul campo né confrontata con la traccia ufficiale SAT. Quote da DEM (stime).', points: r.geometry.map((g, i) => ({ lon: g[0], lat: g[1], ele: r.elevations[i] })), waypoints: wp },
    );
    const blob = new Blob([xml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = file;
    document.body.appendChild(el);
    el.click();
    el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const shareGpxFile = async (routeId: string, file: string) => {
    const r = trip?.routes[routeId];
    if (!r) return;
    const xml = toGpx({ name: r.name, description: 'Traccia derivata da OpenStreetMap (ODbL), non verificata sul campo.', points: r.geometry.map((g, i) => ({ lon: g[0], lat: g[1], ele: r.elevations[i] })) });
    const f = new File([xml], file, { type: 'application/gpx+xml' });
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: r.name });
        return;
      }
    } catch {
      return;
    }
    downloadGpx(routeId, file);
  };

  const onImport = async (file: File | undefined) => {
    setGpxErr(null);
    setCmp(null);
    if (!file) return;
    try {
      const data = parseGpx(await file.text());
      const t = data.tracks.reduce((best, cur) => (cur.points.length > best.points.length ? cur : best));
      const pts = decimate(t.points, 5).map((p) => [p.lon, p.lat] as [number, number]);
      const ref = trip?.routes['route-out'];
      if (!ref) throw new Error('Traccia di riferimento non disponibile.');
      const result = compareToReference(new Polyline(ref.geometry), pts);
      setCmp({ name: t.name, result, pts });
    } catch (e) {
      setGpxErr(e instanceof Error ? e.message : 'Importazione non riuscita');
    }
  };

  const installedCore = offline?.installed?.resources.filter((r) => r.group === 'core') ?? [];
  const installedMap = offline?.installed?.resources.filter((r) => r.group === 'map') ?? [];

  return (
    <div className="stack">
      <h1>Sicurezza e offline</h1>
      <div className="card alert-warning" role="note">
        <strong>L’app non sostituisce prudenza, esperienza e segnavia.</strong> Non promette che una chiamata di emergenza sia possibile senza copertura.
      </div>

      <Fold id="sec-gps" title="Stato GPS e posizione" icon="gps" open={focus === 'gps'}>
        <dl className="kv">
          <dt>Stato</dt>
          <dd data-testid="gps-status">{GPS_STATUS_TEXT[gps.status]}</dd>
          <dt>Precisione stimata</dt>
          <dd data-testid="gps-accuracy">{pos && fixQuality ? `±${Math.round(pos.accuracyM)} m — ${ACCURACY_LABEL[fixQuality.accuracy]}` : '—'}</dd>
          <dt>Ultimo aggiornamento</dt>
          <dd>{pos && fixQuality ? `${fmtAgo(fixQuality.ageMs)} — ${AGE_LABEL[fixQuality.age]}` : '—'}</dd>
          <dt>Coordinate correnti</dt>
          <dd className="mono" data-testid="gps-coords">{coordText ?? '—'}</dd>
          {pos ? (
            <>
              <dt>Gradi e minuti</dt>
              <dd className="mono small">{formatDegMin(pos.lat, pos.lng)}</dd>
            </>
          ) : null}
          <dt>Ultima posizione nota</dt>
          <dd data-testid="gps-last">
            {last ? (
              <>
                <span className="mono">{formatLatLon(last.lat, last.lng)}</span> (±{Math.round(last.accuracyM)} m)
                <br />
                <span className="small muted">{fmtDateTimeIT(last.timestamp)} — {fmtAgo(nowMs - last.timestamp)}</span>
              </>
            ) : (
              'nessuna (si salva solo dopo che attivi il GPS, solo su questo telefono)'
            )}
          </dd>
        </dl>
        <div className="row wrap" style={{ marginTop: 10 }}>
          {gps.status === 'tracking' || gps.status === 'requesting' ? (
            <button className="btn secondary" onClick={a.stopGps}><Icon name="gps" /> Disattiva GPS</button>
          ) : (
            <button className="btn" onClick={a.startGps} data-testid="gps-enable-safety"><Icon name="gps" /> Attiva GPS</button>
          )}
          <button className="btn secondary" disabled={!pos && !last} onClick={async () => { const t = pos ? formatLatLon(pos.lat, pos.lng) : last ? formatLatLon(last.lat, last.lng) : ''; a.showToast((await copyText(t)) ? 'Coordinate copiate' : 'Copia non riuscita'); }} data-testid="copy-coords">
            <Icon name="copy" /> Copia coordinate
          </button>
          <button className="btn secondary" disabled={!pos && !last} onClick={() => void share('La mia posizione', emergencyText())}>
            <Icon name="share" /> Condividi
          </button>
        </div>
        <label className="check" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={prefs.wakeLock} onChange={(e) => a.updatePrefs({ wakeLock: e.target.checked })} />
          <span>Mantieni lo schermo acceso con il GPS attivo <span className="muted small">(consuma batteria; non supportato da tutti i browser)</span></span>
        </label>
        <label className="check">
          <input type="checkbox" checked={prefs.offRouteAlerts} onChange={(e) => a.updatePrefs({ offRouteAlerts: e.target.checked })} />
          <span>Avviso di possibile allontanamento dalla traccia <span className="muted small">(solo con precisione ≤ 50 m, sobrio, senza suoni)</span></span>
        </label>
        <p className="muted small">
          Privacy: la posizione non viene letta prima del tuo consenso e non lascia mai il telefono. Su iPhone, Safari e le app aggiunte alla Home non garantiscono il tracciamento con lo schermo bloccato.
        </p>
        <button className="btn ghost small" onClick={async () => { await a.clearPersonalData(); a.showToast('Dati personali cancellati'); }}>
          Cancella posizione, orari e preferenze salvati
        </button>
      </Fold>

      <Fold id="sec-offline" title="Mappe e uso offline" icon="offline" open={focus === 'offline'}>
        <p>
          <strong data-testid="offline-state">{offline ? STATE_TEXT[offline.state] : '…'}</strong>
        </p>
        <p className="small">{offline?.reason}</p>
        <dl className="kv">
          <dt>Service worker</dt>
          <dd>{sw.supported ? (sw.controlled ? 'attivo' : sw.registered ? 'installato, non ancora attivo su questa pagina' : 'non registrato') : 'non supportato'}</dd>
          <dt>Versione installata</dt>
          <dd className="mono small">{offline?.installed ? `${offline.installed.buildId} / dati ${offline.installed.packVersion}` : '—'}</dd>
          <dt>Ultima verifica</dt>
          <dd>{offline?.record ? fmtDateTimeIT(offline.record.verifiedAt) : '—'}</dd>
          <dt>Risorse nucleo (testi, tracce, GPX)</dt>
          <dd>{installedCore.length ? `${installedCore.length} · ${fmtBytes(installedCore.reduce((t, r) => t + r.bytes, 0))}` : '—'}</dd>
          <dt>Risorse mappa (rilievo, curve, sentieri)</dt>
          <dd>{installedMap.length ? `${installedMap.length} · ${fmtBytes(installedMap.reduce((t, r) => t + r.bytes, 0))}` : '—'}</dd>
          <dt>Spazio usato dal sito</dt>
          <dd>{offline?.storage ? `${fmtBytes(offline.storage.usage)} di ${fmtBytes(offline.storage.quota)}` : 'n.d.'}</dd>
          <dt>Aggiornamento disponibile</dt>
          <dd>{offline?.updateAvailable || sw.updateAvailable ? 'sì' : 'no / non verificabile'}</dd>
          <dt>Aggiornamento dei dati meteo</dt>
          <dd>{a.weather.snapshot ? fmtDateTimeIT(a.weather.snapshot.fetchedAt) : 'nessun dato'}</dd>
        </dl>
        {offline && offline.missing.length > 0 ? (
          <div className="card alert-warning small">Mancano {offline.missing.length} risorse, ad es. <span className="mono">{offline.missing.slice(0, 3).join(', ')}</span>. Premi “Prepara il viaggio”.</div>
        ) : null}
        <p className="small muted">
          Mappe: dati OpenStreetMap e rilievo EU-DEM <strong>prodotti e distribuiti con l’app</strong> (nessun download da server di tile pubblici). Copertura limitata a circa 10 × 12 km attorno al percorso.
        </p>
        <div className="row wrap">
          <button className="btn" onClick={() => void a.prepareTrip()} disabled={prepare.running || import.meta.env.DEV || !a.online}>
            <Icon name="download" /> {prepare.running ? 'In corso…' : 'Prepara / aggiorna il pacchetto'}
          </button>
          <button className="btn secondary" onClick={() => void a.verifyNow()} disabled={prepare.running || !offline?.installed}>
            <Icon name="check" /> Verifica ora
          </button>
          {sw.updateAvailable ? (
            <button className="btn danger" onClick={() => applyUpdate()}>
              Applica l’aggiornamento dell’app
            </button>
          ) : null}
        </div>
        {sw.updateAvailable ? <p className="small muted">Fallo a casa, non durante l’escursione.</p> : null}
        {prepare.report ? <p className="small">{prepare.report.ok ? `Ultima verifica OK: ${prepare.report.checked} risorse.` : prepare.error}</p> : null}
        <h3 style={{ marginTop: 12 }}>Installazione su questo dispositivo</h3>
        <p className="small" data-testid="install-state">
          <strong>{a.install.standalone ? 'Installata: aperta dalla schermata Home.' : 'Non installata: aperta nel browser.'}</strong>
        </p>
        {a.install.canPrompt && !a.install.standalone ? (
          <button className="btn" onClick={async () => { const r = await a.installApp(); a.showToast(r === 'accepted' ? 'Installazione avviata' : r === 'dismissed' ? 'Installazione annullata' : 'Installazione non disponibile: usa il menu del browser'); }}>
            <Icon name="download" /> Installa l’app
          </button>
        ) : null}
        <p className="small"><strong>iPhone:</strong> usa <strong>Safari</strong> (con altri browser “Aggiungi alla schermata Home” dipende dalla versione di iOS). Apri l’indirizzo https → tasto Condividi → “Aggiungi alla schermata Home”, poi <strong>apri l’app dall’icona e premi “Prepara il viaggio” da lì</strong>: l’app installata ha una memoria separata da quella di Safari. Sui siti non installati Safari può cancellare i dati dopo alcuni giorni senza uso.</p>
        <p className="small"><strong>Android (Chrome):</strong> menu ⋮ → “Installa app” (o “Aggiungi a schermata Home”). Poi “Prepara il viaggio”.</p>
        {a.install.platform === 'ios' && !a.install.iosSafari && !a.install.standalone ? (
          <div className="card alert-warning small">Non stai usando Safari: se non trovi “Aggiungi alla schermata Home” nel menu Condividi, apri questo indirizzo in Safari.</div>
        ) : null}
      </Fold>

      <Fold id="sec-track" title="Traccia GPX: stato, esporta, confronta" icon="route" open={focus === 'traccia'}>
        {route ? (
          <dl className="kv">
            <dt>Percorso</dt>
            <dd>{route.name}</dd>
            <dt>Lunghezza calcolata</dt>
            <dd>{fmtDistance(route.lengthM)} · +{route.ascentM}/−{route.descentM} m (stima DEM)</dd>
            <dt>Fonte</dt>
            <dd style={{ fontWeight: 500 }}>{route.gpxSource}</dd>
            <dt>Stato</dt>
            <dd><ValidationBadge status={route.provenance.validation} long /></dd>
            <dt>Ultima modifica OSM</dt>
            <dd>{route.provenance.sourceUpdated ?? 'n.d.'}</dd>
            <dt>Verificato il</dt>
            <dd>{route.provenance.lastVerified} (confronto con fonti secondarie; nessun controllo sul campo)</dd>
            <dt>Difficoltà</dt>
            <dd>E (escursionistico) — classificazioni discordanti tra le fonti (T / E / EE)</dd>
            <dt>Controlli automatici dati</dt>
            <dd>{geo?.validation.ok ? `${geo.validation.data.checks.filter((c) => c.ok).length}/${geo.validation.data.checks.length} superati` : 'non disponibili'}</dd>
          </dl>
        ) : (
          <div className="card alert-danger">Traccia non disponibile.</div>
        )}
        <h3 style={{ marginTop: 12 }}>Esporta o condividi</h3>
        <div className="stack">
          {([
            ['route-out', 'andata-diga-rifugio.gpx', 'Andata (diga → rifugio)'],
            ['route-back', 'ritorno-rifugio-diga.gpx', 'Ritorno (rifugio → diga)'],
            ['route-out-bank', 'variante-sponda-opposta.gpx', 'Variante sponda opposta'],
            ['walk-leno', 'cascata-del-leno.gpx', 'Passeggiata al ponte del Leno'],
          ] as const).map(([id, file, label]) => (
            <div key={id} className="row between wrap">
              <span>{label}</span>
              <span className="row">
                <button className="btn secondary small" onClick={() => downloadGpx(id, file)} aria-label={`Scarica GPX: ${label}`}><Icon name="download" size={18} /> GPX</button>
                <button className="btn ghost small" onClick={() => void shareGpxFile(id, file)} aria-label={`Condividi GPX: ${label}`}><Icon name="share" size={18} /></button>
              </span>
            </div>
          ))}
        </div>
        <h3 style={{ marginTop: 12 }}>Confronta con un’altra traccia</h3>
        <p className="small muted">
          Se hai scaricato un GPX ufficiale (SAT, Parco, trentino.com) importalo qui: l’app misura lo scostamento dalla traccia incorporata, tutto sul telefono. Non sostituisce la verifica sul campo.
        </p>
        <input type="file" onChange={(e) => void onImport(e.target.files?.[0])} aria-label="Scegli un file GPX da confrontare" data-testid="gpx-input" />
        {gpxErr ? <div className="card alert-danger" role="alert" style={{ marginTop: 8 }}>{gpxErr}</div> : null}
        {cmp ? (
          <div className={`card ${cmp.result.verdict === 'coerente' ? 'alert-ok' : cmp.result.verdict === 'parzialmente-coerente' ? 'alert-warning' : 'alert-danger'}`} style={{ marginTop: 8 }} data-testid="gpx-result" role="status">
            <h3>{cmp.name}: {cmp.result.verdict === 'coerente' ? 'coerente con la traccia incorporata' : cmp.result.verdict === 'parzialmente-coerente' ? 'parzialmente coerente' : 'diversa dalla traccia incorporata'}</h3>
            <dl className="kv">
              <dt>Scostamento mediano / 95°</dt>
              <dd>{Math.round(cmp.result.medianM)} m / {Math.round(cmp.result.p95M)} m (massimo {Math.round(cmp.result.maxM)} m)</dd>
              <dt>Entro 25 m / 50 m</dt>
              <dd>{Math.round(cmp.result.within25Pct)} % / {Math.round(cmp.result.within50Pct)} %</dd>
              <dt>Percorso coperto</dt>
              <dd>{Math.round(cmp.result.coverageOfReferencePct)} %</dd>
              <dt>Lunghezza relativa</dt>
              <dd>{Math.round(cmp.result.lengthRatio * 100)} %</dd>
            </dl>
            {cmp.result.notes.map((n) => <p key={n} className="small">{n}</p>)}
            <div className="row wrap">
              <button className="btn secondary small" onClick={() => { a.updatePrefs({ importedTrack: { name: cmp.name, points: cmp.pts, importedAt: Date.now() } }); a.showToast('Traccia mostrata in Mappa (viola tratteggiata)'); }}>
                <Icon name="map" size={18} /> Mostra in Mappa
              </button>
            </div>
          </div>
        ) : null}
        {prefs.importedTrack ? (
          <p className="small">
            Traccia importata in Mappa: <strong>{prefs.importedTrack.name}</strong>{' '}
            <button className="btn ghost small" onClick={() => a.updatePrefs({ importedTrack: null })}>Rimuovi</button>
          </p>
        ) : null}
      </Fold>

      <Fold id="sec-emerg" title="Emergenze e soccorso" icon="shield" open={focus === 'emergenza'}>
        <div className="stack">
          {EMERGENCY_NUMBERS.map((n) => (
            <a key={n.value} className="btn danger big block" href={n.href} data-testid="call-112">
              <Icon name="phone" /> Chiama il {n.value}
            </a>
          ))}
          <div className="card alert-warning" style={{ margin: 0 }}>
            <strong>Senza copertura la chiamata può non partire.</strong> Il 112 usa qualsiasi rete disponibile, non solo la tua; dove non c’è nessuna rete non connette. Gli SMS non sono garantiti.
          </div>
        </div>
        <ol style={{ paddingLeft: 20 }}>
          {EMERGENCY_STEPS.map((s) => (
            <li key={s.title} style={{ marginBottom: 10 }}>
              <strong>{s.title}</strong>
              <div>{s.body}</div>
            </li>
          ))}
        </ol>
        <h3>Messaggio da leggere o inviare</h3>
        <pre className="card mono small" style={{ whiteSpace: 'pre-wrap', margin: '6px 0' }} data-testid="emergency-text">{emergencyText()}</pre>
        <div className="row wrap">
          <button className="btn secondary small" onClick={async () => a.showToast((await copyText(emergencyText())) ? 'Messaggio copiato' : 'Copia non riuscita')}><Icon name="copy" size={18} /> Copia</button>
          <button className="btn secondary small" onClick={() => void share('Emergenza', emergencyText())}><Icon name="share" size={18} /> Condividi</button>
        </div>
        <h3 style={{ marginTop: 12 }}>Numeri da verificare PRIMA di partire</h3>
        <ul style={{ paddingLeft: 20 }}>
          {CONTACTS_TO_VERIFY.map((c) => (
            <li key={c.value} style={{ marginBottom: 6 }}>
              <a href={c.href}>{c.value}</a> — {c.label}
            </li>
          ))}
        </ul>
        <p className="muted small">Questi non sono numeri di emergenza e non sono stati verificati da fonte ufficiale.</p>
      </Fold>

      <Fold id="sec-notices" title="Avvisi di sicurezza dell’itinerario" icon="alert">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {SAFETY_NOTICES.map((n) => (
            <li key={n.id} className={`card ${n.severity === 'warning' ? 'alert-warning' : n.severity === 'caution' ? 'alert-info' : ''}`} style={{ boxShadow: 'none' }}>
              <div className="row between wrap">
                <strong>{n.title}</strong>
                <ValidationBadge status={n.validation} />
              </div>
              <p className="small" style={{ margin: '4px 0 0' }}>{n.body}</p>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold id="sec-check" title="Checklist equipaggiamento" icon="list">
        {(['prima', 'abbigliamento', 'zaino', 'sicurezza', 'auto'] as const).map((g) => (
          <div key={g}>
            <h3 style={{ marginTop: 10 }}>{CHECKLIST_GROUP_LABEL[g]}</h3>
            {CHECKLIST.filter((i) => i.group === g).map((i) => (
              <label key={i.id} className="check">
                <input type="checkbox" checked={!!prefs.checklist[i.id]} onChange={(e) => a.updatePrefs({ checklist: { ...prefs.checklist, [i.id]: e.target.checked } })} />
                <span>
                  {i.label}
                  {i.note ? <span className="muted small"> — {i.note}</span> : null}
                </span>
              </label>
            ))}
          </div>
        ))}
        <p className="muted small">
          {CHECKLIST.filter((i) => prefs.checklist[i.id]).length}/{CHECKLIST.length} voci spuntate (solo su questo telefono).
        </p>
      </Fold>

      <Fold id="sec-limits" title="Limiti dell’app" icon="info">
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          {APP_LIMITS.map((l) => (
            <li key={l.title} style={{ marginBottom: 8 }}>
              <strong>{l.title}.</strong> {l.body}
            </li>
          ))}
        </ul>
      </Fold>

      <Fold id="sec-sources" title="Fonti, licenze e attribuzioni" icon="info">
        <p className="small">
          Dati cartografici: © <strong>OpenStreetMap contributors</strong>, licenza <strong>ODbL 1.0</strong>, tramite Overture Maps Foundation (release 2026-09-23.1).
          Rilievo: <em>Produced using Copernicus data and information funded by the European Union - EU-DEM layers</em> (Terrain Tiles su AWS Open Data).
          Mappa: MapLibre GL JS (BSD-3-Clause). Meteo: Open-Meteo (CC BY 4.0, uso non commerciale). Le tracce GPX esportate contengono l’attribuzione ODbL.
        </p>
        <p className="small muted">Le quattro fonti iniziali richieste (SAT, Parco, Visit Trentino, Iter Edizioni) non sono state consultate: erano bloccate in fase di sviluppo.</p>
        <ul style={{ paddingLeft: 18 }}>
          {SOURCES.map((s) => (
            <li key={s.id} className="small" style={{ marginBottom: 4 }}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>{' '}
              <span className="muted">— {s.accessMode === 'direct' ? 'letta' : s.accessMode === 'search-summary' ? 'sintesi di ricerca' : 'NON consultata'}; {s.reliability}</span>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold id="sec-look" title="Aspetto e accessibilità" icon="sun">
        <h3>Tema</h3>
        <div className="seg" role="group" aria-label="Tema">
          {([['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro'], ['contrast', 'Alto contrasto']] as Array<[ThemePref, string]>).map(([k, l]) => (
            <button key={k} aria-pressed={prefs.theme === k} onClick={() => a.updatePrefs({ theme: k })}>{l}</button>
          ))}
        </div>
        <h3 style={{ marginTop: 12 }}>Dimensione del testo</h3>
        <div className="seg" role="group" aria-label="Dimensione del testo">
          {([[1, 'Normale'], [1.15, 'Grande'], [1.3, 'Molto grande']] as const).map(([k, l]) => (
            <button key={k} aria-pressed={prefs.textScale === k} onClick={() => a.updatePrefs({ textScale: k })}>{l}</button>
          ))}
        </div>
        <p className="muted small">Il tema chiaro è pensato per la luce del sole; “Alto contrasto” aumenta bordi e colori. Le animazioni sono ridotte se il sistema lo chiede.</p>
      </Fold>
    </div>
  );
}
