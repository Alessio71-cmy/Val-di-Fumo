import { useEffect, useState } from 'react';
import { fmtBytes, fmtDateTimeIT } from '../../geo/format';
import { formatLatLon } from '../../geo/geodesy';
import { fetchManifest } from '../../offline/manifest';
import type { OfflinePackage } from '../../domain/types';
import { useApp } from '../../state/AppState';
import { Icon } from '../components/Icon';
import { copyText, Progress, Sheet } from '../components/ui';

const isIOS = () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

export function navLinks(lat: number, lon: number, name: string) {
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lon.toFixed(6)}&travelmode=driving`,
    apple: `https://maps.apple.com/?daddr=${lat.toFixed(6)},${lon.toFixed(6)}&dirflg=d`,
    geo: `geo:${lat.toFixed(6)},${lon.toFixed(6)}?q=${lat.toFixed(6)},${lon.toFixed(6)}(${encodeURIComponent(name)})`,
  };
}

/** Navigazione stradale: apre l'app di mappe del telefono. Richiede rete (e dati dell'app di mappe), non l'app. */
export function NavigateSheet({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const { trip, showToast } = useApp();
  const p = trip?.points[placeId];
  if (!p) {
    return (
      <Sheet title="Navigazione stradale" onClose={onClose}>
        <p>Posizione della destinazione non disponibile nei dati.</p>
      </Sheet>
    );
  }
  const [lon, lat] = p.coordinates;
  const l = navLinks(lat, lon, p.name);
  const ios = isIOS();
  const caution =
    placeId === 'park-boazzo-centrale'
      ? 'Il navigatore potrebbe fermarsi prima o proporre un altro accesso: l’ultimo tratto è una strada stretta e una fonte secondaria cita un cartello di divieto di transito. Parcheggia prima del divieto.'
      : placeId === 'park-dam'
        ? 'Ultimo tratto stretto e ripido a senso alternato; possibile accesso regolato o parcheggio a pagamento (porta monete). Se i parcheggi sono pieni potrebbero indirizzarti più a valle.'
        : 'Il punto è l’etichetta della città in OpenStreetMap: puoi sostituirlo con il tuo indirizzo.';
  return (
    <Sheet title="Apri navigazione stradale" onClose={onClose}>
      <p>
        <strong>{p.name}</strong>
        <br />
        <span className="mono">{formatLatLon(lat, lon)}</span>
      </p>
      <div className="stack">
        <a className={`btn big ${ios ? 'secondary' : ''}`} href={l.google} target="_blank" rel="noopener noreferrer">
          <Icon name="car" /> Apri con Google Maps
        </a>
        <a className={`btn big ${ios ? '' : 'secondary'}`} href={l.apple} target="_blank" rel="noopener noreferrer">
          <Icon name="car" /> Apri con Apple Maps
        </a>
        <a className="btn secondary" href={l.geo}>
          <Icon name="map" /> Altra app di mappe (geo:)
        </a>
        <button
          className="btn ghost"
          onClick={async () => showToast((await copyText(formatLatLon(lat, lon))) ? 'Coordinate copiate' : 'Copia non riuscita: selezionale e copiale a mano')}
        >
          <Icon name="copy" /> Copia coordinate
        </button>
      </div>
      <div className="card alert-warning" style={{ marginTop: 12 }}>
        <p style={{ margin: 0 }}>
          <strong>Attenzione:</strong> {caution}
        </p>
      </div>
      <p className="muted small">
        Questa funzione apre l’app di mappe del telefono (serve rete). Non è la navigazione dell’escursione: sul sentiero usa la scheda Mappa. Tempi di guida mostrati nell’app: <strong>stime</strong>, non includono il traffico.
      </p>
    </Sheet>
  );
}

/** "Prepara il viaggio": scarica il pacchetto e lo VERIFICA rileggendolo dalla cache (dimensione + SHA-256). */
export function PrepareSheet({ onClose }: { onClose: () => void }) {
  const { prepare, prepareTrip, offline, online, verifyNow } = useApp();
  const [manifest, setManifest] = useState<OfflinePackage | null>(null);
  const [manifestTried, setManifestTried] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetchManifest().then((m) => {
      if (alive) {
        setManifest(m);
        setManifestTried(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [online]);
  const p = prepare.progress;
  const ok = offline?.state === 'ready' || (prepare.report?.ok === true && offline?.state !== 'partial');
  const total = manifest?.totalBytes ?? 0;
  const mapBytes = manifest ? manifest.resources.filter((r) => r.group === 'map').reduce((t, r) => t + r.bytes, 0) : 0;
  return (
    <Sheet title="Prepara il viaggio" onClose={onClose}>
      <p>
        Scarica sul <strong>tuo telefono</strong> app, tracce, testi e mappa, poi li <strong>verifica</strong> rileggendoli dalla memoria del dispositivo.
        Ogni partecipante deve farlo sul proprio telefono: un link condiviso non prova che sia pronto.
      </p>
      {import.meta.env.DEV ? (
        <div className="card alert-info">Build di sviluppo: il download offline non è attivo. Usa la build di produzione (<code>npm run build && npm run preview</code>).</div>
      ) : manifestTried && !manifest ? (
        <div className="card alert-warning">
          {online ? 'Non riesco a leggere l’elenco delle risorse del pacchetto.' : 'Sei offline: per preparare il viaggio serve la rete (meglio una Wi-Fi).'}
          {offline?.installed ? ' Il pacchetto già presente resta utilizzabile: usa “Verifica ora”.' : ''}
        </div>
      ) : (
        <dl className="kv" style={{ marginBottom: 12 }}>
          <dt>Dimensione</dt>
          <dd>{manifest ? `${fmtBytes(total)} (di cui mappa ${fmtBytes(mapBytes)})` : '…'}</dd>
          <dt>Risorse</dt>
          <dd>{manifest ? manifest.resources.length : '…'}</dd>
          <dt>Versione</dt>
          <dd className="mono">{manifest ? `${manifest.buildId} / ${manifest.packVersion}` : '…'}</dd>
        </dl>
      )}

      {prepare.running && p ? (
        <div className="stack" aria-live="polite">
          <Progress value={p.done / Math.max(1, p.total)} label="Avanzamento del download e della verifica" />
          <p className="small">
            {p.stage === 'download' ? 'Download' : p.stage === 'verify' ? 'Verifica' : 'Fine'}: {p.done}/{p.total} risorse · {fmtBytes(p.bytesDone)} / {fmtBytes(p.bytesTotal)}
          </p>
          <p className="muted small mono" style={{ wordBreak: 'break-all' }}>{p.current}</p>
          {p.failed.length > 0 ? <p className="small">Errori finora: {p.failed.length}</p> : null}
        </div>
      ) : null}

      {!prepare.running && prepare.report ? (
        prepare.report.ok ? (
          <div className="card alert-ok" role="status">
            <h3>
              <Icon name="check" /> Pronto per l’uso offline
            </h3>
            <p style={{ margin: 0 }}>
              Verificate {prepare.report.checked} risorse ({fmtBytes(prepare.report.bytes)}) il {fmtDateTimeIT(prepare.report.at)}.{' '}
              {prepare.report.hashSkipped ? 'Hash non calcolabile in questo contesto: verifica limitata alla dimensione.' : 'Dimensione e SHA-256 corrispondono al manifest.'}
            </p>
          </div>
        ) : (
          <div className="card alert-danger" role="alert">
            <h3>
              <Icon name="alert" /> NON pronto: verifica non superata
            </h3>
            <p>{prepare.error}</p>
            {[...prepare.report.missing, ...prepare.report.corrupted].slice(0, 8).map((u) => (
              <div key={u} className="small mono">
                {u}
              </div>
            ))}
          </div>
        )
      ) : null}
      {prepare.error && !prepare.report ? (
        <div className="card alert-danger" role="alert">
          {prepare.error}
        </div>
      ) : null}
      {prepare.persisted !== null ? (
        <p className="muted small">
          Archiviazione persistente: {prepare.persisted ? 'concessa' : 'non concessa (il sistema potrebbe svuotare la cache; su iPhone installa l’app nella Home)'}.
        </p>
      ) : null}

      <div className="stack">
        <button className="btn big block" onClick={() => void prepareTrip()} disabled={prepare.running || import.meta.env.DEV || !online}>
          <Icon name="download" /> {ok ? 'Scarica e verifica di nuovo' : 'Scarica e verifica'}
        </button>
        <button className="btn secondary block" onClick={() => void verifyNow()} disabled={prepare.running || !offline?.installed}>
          <Icon name="check" /> Verifica ora (senza scaricare)
        </button>
      </div>

      <h3 style={{ marginTop: 16 }}>Test offline (consigliato)</h3>
      <ol className="small" style={{ paddingLeft: 20 }}>
        <li>Attiva la <strong>modalità aereo</strong>.</li>
        <li>Chiudi completamente l’app e riaprila dalla Home.</li>
        <li>Controlla che in alto compaia “Offline pronto” e che la Mappa mostri rilievo e traccia.</li>
        <li>Prova “Attiva GPS”: all’aperto la posizione può comparire anche senza dati mobili.</li>
      </ol>
    </Sheet>
  );
}
