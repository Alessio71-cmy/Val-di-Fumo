import { useEffect, useRef, useState } from 'react';
import type { Stage } from '../../domain/types';
import { fmtClock, fmtDistance, fmtDuration } from '../../geo/format';
import { formatLatLon } from '../../geo/geodesy';
import { useApp } from '../../state/AppState';
import { STAGE_FOR_PHASE } from '../../state/stages';
import { Icon } from '../components/Icon';
import { copyText, Sheet, SourceList, ValidationBadge } from '../components/ui';
import type { GotoFn } from '../tabs';
import { NavigateSheet } from './sheets';

const MODE_LABEL = { auto: 'In auto', piedi: 'A piedi', sosta: 'Sosta' } as const;

function Block({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: 12 }}>
      <h3>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}

function StageSheet({ stage, onClose, goto }: { stage: Stage; onClose: () => void; goto: GotoFn }) {
  const { trip, showToast, schedule } = useApp();
  const [nav, setNav] = useState(false);
  const place = trip?.points[stage.placeId];
  const d = stage.duration;
  const times = schedule?.entries;
  const timeHint =
    stage.id === 's2-leno' ? times?.find((e) => e.id === 'leno-stop') : stage.id === 's3-diga' ? times?.find((e) => e.id === 'drive-dam') : stage.id === 's7-rifugio' ? times?.find((e) => e.id === 'hike-out') : stage.id === 's8-ritorno' ? times?.find((e) => e.id === 'hike-back') : undefined;
  return (
    <Sheet title={stage.name} onClose={onClose}>
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <span className="chip">{MODE_LABEL[stage.mode]}</span>
        <ValidationBadge status={stage.validation} long />
        <span className="chip">Verificato il {stage.lastVerified}</span>
      </div>
      <p>{stage.summary}</p>
      <dl className="kv">
        <dt>Posizione</dt>
        <dd>
          {place ? (
            <>
              {place.name}
              <br />
              <span className="mono small">{formatLatLon(place.coordinates[1], place.coordinates[0])}</span>{' '}
              <button
                className="btn ghost small"
                onClick={async () => showToast((await copyText(formatLatLon(place.coordinates[1], place.coordinates[0]))) ? 'Coordinate copiate' : 'Copia non riuscita')}
                aria-label="Copia le coordinate della tappa"
              >
                <Icon name="copy" size={16} /> Copia
              </button>
              {place.elevationM ? <div className="small muted">Quota ≈{place.elevationM} m (stima DEM)</div> : null}
            </>
          ) : (
            'non disponibile (dati incompleti)'
          )}
        </dd>
        <dt>Distanza dalla tappa precedente</dt>
        <dd>
          {stage.distanceFromPrevM !== undefined ? fmtDistance(stage.distanceFromPrevM) : '—'} <span className="muted small">({MODE_LABEL[stage.mode].toLowerCase()})</span>
        </dd>
        <dt>Tempo indicativo</dt>
        <dd>
          {d.nominal > 0 ? (
            <>
              ≈{fmtDuration(d.nominal)} <span className="muted small">(intervallo {fmtDuration(d.min)}–{fmtDuration(d.max)}; {d.basis === 'estimated' ? 'stima' : d.basis === 'model' ? 'modello calibrato su fonti secondarie' : 'da fonte'})</span>
            </>
          ) : (
            '—'
          )}
        </dd>
        {timeHint ? (
          <>
            <dt>Nel programma di oggi</dt>
            <dd className="mono">
              {fmtClock(timeHint.plannedStartMin)}→{fmtClock(timeHint.plannedEndMin)}
            </dd>
          </>
        ) : null}
        <dt>Segnavia da seguire</dt>
        <dd style={{ fontWeight: 500 }}>{stage.waymarks.length ? stage.waymarks.join(' · ') : 'nessuno specifico'}</dd>
      </dl>
      <Block title="Cosa osservare" items={stage.whatToSee} />
      <Block title="Difficoltà e avvertenze" items={stage.difficulties} />
      <Block title="Come proseguire" items={stage.howToContinue} />
      <Block title="Alternative" items={stage.alternatives} />
      <SourceList ids={stage.sourceIds} />
      <div className="stack" style={{ marginTop: 14 }}>
        {stage.routeId ? (
          <button
            className="btn block"
            onClick={() => {
              goto('mappa', { routeId: stage.routeId });
              onClose();
            }}
          >
            <Icon name="map" /> Vedi sulla mappa
          </button>
        ) : null}
        {stage.mode === 'auto' ? (
          <button className="btn secondary block" onClick={() => setNav(true)}>
            <Icon name="car" /> Apri navigazione stradale
          </button>
        ) : null}
      </div>
      {nav ? <NavigateSheet placeId={stage.id === 's9-rientro' ? 'pergine' : stage.id === 's3-diga' ? 'park-dam' : 'park-boazzo-centrale'} onClose={() => setNav(false)} /> : null}
    </Sheet>
  );
}

export function RouteScreen({ goto, initialStage }: { goto: GotoFn; initialStage?: string }) {
  const { trip, phase, prefs, updatePrefs, loading } = useApp();
  const [open, setOpen] = useState<string | null>(initialStage ?? null);
  const first = useRef(true);
  useEffect(() => {
    if (initialStage) setOpen(initialStage);
  }, [initialStage]);
  useEffect(() => {
    first.current = false;
  }, []);
  if (loading || !trip) return <p role="status">Caricamento…</p>;
  const current = STAGE_FOR_PHASE[phase];
  const stage = trip.stages.find((s) => s.id === open);
  const crit = trip.criticalPoints.filter((c) => c.routeId === 'route-out');
  const variant = trip.routes['route-out-bank'];
  const main = trip.routes['route-out'];
  return (
    <div className="stack">
      <h1>Percorso</h1>
      <p className="muted">
        Itinerario in {trip.stages.length} tappe, nell’ordine. Ogni scheda riporta fonte, stato di validazione e data di verifica. Tocca una tappa per il dettaglio.
      </p>
      <ol className="timeline" data-testid="timeline">
        {trip.stages.map((s) => (
          <li key={s.id}>
            <span className={`dot ${s.mode === 'auto' ? 'auto' : ''}`} aria-hidden="true">
              {s.order}
            </span>
            <button className="item" onClick={() => setOpen(s.id)} aria-current={current === s.id ? 'step' : undefined} data-testid={`stage-${s.id}`}>
              <div className="row between wrap">
                <strong>{s.name}</strong>
                <span className="chip">{MODE_LABEL[s.mode]}</span>
              </div>
              <div className="small muted" style={{ margin: '4px 0' }}>
                {s.summary.split('. ')[0]}.
              </div>
              <div className="row wrap small">
                {s.distanceFromPrevM ? <span><Icon name={s.mode === 'auto' ? 'car' : 'walk'} size={16} /> {fmtDistance(s.distanceFromPrevM)}</span> : null}
                {s.duration.nominal > 0 ? <span><Icon name="clock" size={16} /> ≈{fmtDuration(s.duration.nominal)}</span> : null}
                <ValidationBadge status={s.validation} />
                {current === s.id ? <span className="chip info">tappa attuale</span> : null}
              </div>
            </button>
          </li>
        ))}
      </ol>

      <section className="card" aria-labelledby="crit-h">
        <h2 id="crit-h">Punti di attenzione sull’andata</h2>
        <p className="muted small">
          Ponti, passerelle e bivi <strong>dal dato OpenStreetMap</strong> (non verificati sul campo). L’app non dice “destra/sinistra”: resta sul percorso evidenziato e sui segnavia.
        </p>
        {crit.length === 0 ? <p className="small">Nessun dato disponibile.</p> : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="critical-list">
            {crit.map((c) => (
              <li key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--c-line)' }}>
                <div className="row between wrap">
                  <strong>
                    <Icon name={c.kind === 'bridge' ? 'bridge' : 'fork'} size={18} /> {c.label}
                  </strong>
                  <span className="mono small">{fmtDistance(c.chainM)} dalla diga</span>
                </div>
                <div className="small muted">{c.detail}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {variant && main ? (
        <section className="card" aria-labelledby="var-h">
          <h2 id="var-h">Variante: sponda opposta del Chiese</h2>
          <p className="small">
            Tra Malga Breguzzo e il ponte di Malga Val di Fumo esiste un sentiero anche sulla <strong>sponda sud-est</strong>: {fmtDistance(variant.lengthM)} in totale ({variant.lengthM >= main.lengthM ? '+' : '−'}
            {Math.abs(Math.round(variant.lengthM - main.lengthM))} m rispetto alla principale). Una fonte secondaria dice che a Breguzzo si può scegliere la sponda; “sinistra” è ambiguo, quindi qui usiamo i punti cardinali.
          </p>
          <label className="check">
            <input type="checkbox" checked={prefs.bank.back} onChange={(e) => updatePrefs({ bank: { ...prefs.bank, back: e.target.checked } })} />
            <span>Usa la sponda sud-est per il <strong>ritorno</strong> (anello). Consigliata solo con buona visibilità.</span>
          </label>
          <label className="check" style={{ borderBottom: 0 }}>
            <input type="checkbox" checked={prefs.bank.out} onChange={(e) => updatePrefs({ bank: { ...prefs.bank, out: e.target.checked } })} />
            <span>Usa la sponda sud-est anche per l’<strong>andata</strong>.</span>
          </label>
          <button className="btn secondary small" onClick={() => goto('mappa', { routeId: 'route-out-bank' })}>
            <Icon name="map" /> Vedi la variante sulla mappa
          </button>
        </section>
      ) : null}

      {stage ? <StageSheet stage={stage} onClose={() => setOpen(null)} goto={goto} /> : null}
    </div>
  );
}
