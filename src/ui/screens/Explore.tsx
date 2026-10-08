import { useState } from 'react';
import type { PointOfInterest } from '../../domain/types';
import { fmtDistance } from '../../geo/format';
import { formatLatLon } from '../../geo/geodesy';
import { useApp } from '../../state/AppState';
import { Icon, type IconName } from '../components/Icon';
import { copyText, SourceList, ValidationBadge } from '../components/ui';
import type { GotoFn } from '../tabs';

const ICON: Record<PointOfInterest['category'], IconName> = {
  cascata: 'waterfall',
  lago: 'drop',
  diga: 'bridge',
  malga: 'hut',
  rifugio: 'hut',
  paesaggio: 'mountain',
};

type Filter = 'tutti' | 'percorso' | 'deviazione';

export function ExploreScreen({ goto, focus }: { goto: GotoFn; focus?: string }) {
  const { trip, showToast, sun, loading } = useApp();
  const [filter, setFilter] = useState<Filter>('tutti');
  if (loading || !trip) return <p role="status">Caricamento…</p>;
  const list = trip.pois.filter((p) => (filter === 'tutti' ? true : filter === 'percorso' ? p.onRoute : !p.onRoute));
  const sunFor = (id: string) => {
    const w = sun?.direct[id];
    if (!w || w.length === 0) return null;
    const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
    return `${f(w[0]!.fromMin)}–${f(w[w.length - 1]!.toMin)}`;
  };
  const directKey: Record<string, string> = { 'poi-leno': 'park-boazzo-centrale', 'poi-diga': 'park-dam', 'poi-breguzzo': 'malga-breguzzo', 'poi-rifugio': 'rifugio-val-di-fumo' };
  return (
    <div className="stack">
      <h1>Esplora</h1>
      <p className="muted">Punti d’interesse dell’itinerario. Distinguiamo ciò che è <strong>direttamente sul percorso</strong> da ciò che richiede una <strong>deviazione</strong>.</p>
      <div className="seg" role="group" aria-label="Filtra le schede">
        <button aria-pressed={filter === 'tutti'} onClick={() => setFilter('tutti')}>Tutti ({trip.pois.length})</button>
        <button aria-pressed={filter === 'percorso'} onClick={() => setFilter('percorso')}>Sul percorso</button>
        <button aria-pressed={filter === 'deviazione'} onClick={() => setFilter('deviazione')}>Con deviazione</button>
      </div>
      <div className="stack" data-testid="poi-list">
        {list.map((p) => (
          <article key={p.id} className={`card ${focus === p.id ? 'alert-info' : ''}`} aria-labelledby={`h-${p.id}`} data-testid={`poi-${p.id}`}>
            <div className="row between wrap" style={{ marginBottom: 6 }}>
              <h2 id={`h-${p.id}`} style={{ margin: 0 }}>
                <Icon name={ICON[p.category]} /> {p.name}
              </h2>
              <span className={`chip ${p.onRoute ? 'ok' : 'warn'}`}>{p.onRoute ? 'Sul percorso' : `Richiede deviazione (+${fmtDistance(p.detourM)})`}</span>
            </div>
            <p>{p.description}</p>
            {p.highlights.length ? (
              <ul style={{ paddingLeft: 20, margin: '0 0 8px' }}>
                {p.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : null}
            <h3>
              <Icon name="camera" size={18} /> Suggerimenti fotografici
            </h3>
            <ul style={{ paddingLeft: 20, margin: '0 0 8px' }}>
              {p.photoTips.map((t) => (
                <li key={t}>{t}</li>
              ))}
              {directKey[p.id] && sunFor(directKey[p.id] as string) ? <li>Sole diretto sul punto (stima dal rilievo, ±15–20 min): {sunFor(directKey[p.id] as string)}.</li> : null}
            </ul>
            {p.warnings.length ? (
              <div className="card alert-warning" style={{ padding: 10, boxShadow: 'none' }}>
                <strong>
                  <Icon name="alert" size={18} /> Attenzione
                </strong>
                <ul style={{ paddingLeft: 18, margin: '4px 0 0' }}>
                  {p.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="muted small" style={{ marginTop: 8 }}>
              <Icon name="info" size={16} /> Nessuna fotografia inclusa: non era disponibile alcuna immagine con licenza verificabile (Wikimedia Commons e siti ufficiali non erano raggiungibili).
            </p>
            <div className="row wrap small" style={{ marginTop: 8 }}>
              <ValidationBadge status={p.provenance.validation} long />
              <span className="chip">Verificato il {p.provenance.lastVerified}</span>
              {p.provenance.sourceUpdated ? <span className="chip">Ult. modifica OSM {p.provenance.sourceUpdated}</span> : null}
            </div>
            <div className="row wrap" style={{ marginTop: 10 }}>
              <button className="btn secondary small" onClick={async () => showToast((await copyText(formatLatLon(p.coordinates[1], p.coordinates[0]))) ? 'Coordinate copiate' : 'Copia non riuscita')}>
                <Icon name="copy" size={16} /> {formatLatLon(p.coordinates[1], p.coordinates[0])}
              </button>
              <button className="btn ghost small" onClick={() => goto('mappa')}>
                <Icon name="map" size={16} /> Mappa
              </button>
            </div>
            <SourceList ids={p.provenance.sourceIds} />
          </article>
        ))}
      </div>
    </div>
  );
}
