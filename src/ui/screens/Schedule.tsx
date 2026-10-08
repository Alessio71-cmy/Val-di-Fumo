import { TRIP_CONFIG, type PaceKey } from '../../config/trip.config';
import type { ScheduleEventId } from '../../domain/types';
import { fmtClock, fmtDelay, fmtDistance, fmtDuration, parseClock } from '../../geo/format';
import { PHASES } from '../../state/phase';
import { useApp } from '../../state/AppState';
import { Icon } from '../components/Icon';

const PACE_LABEL: Record<PaceKey, string> = { veloce: 'Veloce', normale: 'Normale', lento: 'Lento' };
const EVENT_LABEL: Record<ScheduleEventId, string> = {
  departed: 'Partenza da Pergine',
  'arrived-boazzo': 'Arrivo a Boazzo',
  'left-boazzo': 'Ripartenza da Boazzo',
  'arrived-dam': 'Arrivo alla diga',
  'started-hike': 'Inizio trekking',
  'arrived-hut': 'Arrivo al rifugio',
  'started-return': 'Inizio ritorno',
  'back-at-car': 'Ritorno all’auto',
  home: 'Arrivo a casa',
};
const EVENT_ORDER = PHASES.flatMap((p) => (p.advanceEvent ? [p.advanceEvent] : []));

const BASIS_LABEL = { source: 'da fonte', estimated: 'stima', model: 'modello', user: 'a scelta' } as const;

export function SchedulePage({ onBack }: { onBack: () => void }) {
  const { schedule, prefs, updatePrefs, sun, recordEvent, geo } = useApp();
  const win = TRIP_CONFIG.departureWindow;
  if (!schedule || !sun) {
    return (
      <div className="card alert-warning">
        <p>Programma non disponibile (mancano i dati del sole o del percorso).</p>
        <button className="btn secondary" onClick={onBack}>Indietro</button>
      </div>
    );
  }
  const s = schedule.summary;
  const legs = geo?.drive.ok ? geo.drive.data.legs : null;
  const statusText = s.status === 'ok' ? 'Margine di luce adeguato' : s.status === 'tight' ? 'Margine tirato' : 'Non compatibile con un rientro prudente';
  const statusClass = s.status === 'ok' ? 'ok' : s.status === 'tight' ? 'warn' : 'danger';
  const direct = sun.direct;
  const win2 = (k: string) => {
    const w = direct[k];
    if (!w || w.length === 0) return 'n.d.';
    return `${fmtClock(w[0]!.fromMin)}–${fmtClock(w[w.length - 1]!.toMin)}`;
  };

  return (
    <div className="stack">
      <button className="btn ghost small" onClick={onBack}>
        ← Oggi
      </button>
      <h1>Programma</h1>
      <p className="muted">
        Tutti gli orari sono <strong>stime</strong> costruite su distanze OpenStreetMap, un modello di cammino calibrato su fonti secondarie e un calcolo astronomico: non sono garanzie.
      </p>

      <section className="card" aria-labelledby="dep">
        <h2 id="dep">Orario di partenza da Pergine</h2>
        <div className="row between">
          <span className="mono" style={{ fontSize: '2rem', fontWeight: 900 }} id="dep-value" aria-live="polite">
            {fmtClock(prefs.departureMin)}
          </span>
          <span className="muted small">finestra {fmtClock(win.earliestMin)}–{fmtClock(win.latestMin)}</span>
        </div>
        <input
          type="range"
          min={win.earliestMin}
          max={win.latestMin}
          step={win.stepMin}
          value={prefs.departureMin}
          onChange={(e) => updatePrefs({ departureMin: Number(e.target.value) })}
          aria-labelledby="dep"
          aria-valuetext={`Partenza alle ${fmtClock(prefs.departureMin)}`}
          data-testid="departure-slider"
        />
        <div className="row between small muted">
          <span>{fmtClock(win.earliestMin)}</span>
          <span>{fmtClock(win.latestMin)}</span>
        </div>
        <h3 style={{ marginTop: 12 }}>Ritmo del gruppo</h3>
        <div className="seg" role="group" aria-label="Ritmo del gruppo">
          {(Object.keys(PACE_LABEL) as PaceKey[]).map((k) => (
            <button key={k} aria-pressed={prefs.pace === k} onClick={() => updatePrefs({ pace: k })}>
              {PACE_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="muted small">Moltiplica i tempi di cammino (×{TRIP_CONFIG.paceFactors[prefs.pace]}).</p>
        <label className="check" style={{ borderBottom: 0 }}>
          <input type="checkbox" checked={prefs.skipLeno} onChange={(e) => updatePrefs({ skipLeno: e.target.checked })} />
          <span>Salta la sosta alla Cascata del Leno</span>
        </label>
      </section>

      <section className={`card alert-${statusClass === 'ok' ? 'ok' : statusClass === 'warn' ? 'warning' : 'danger'}`} aria-labelledby="latest" data-testid="latest-card">
        <h2 id="latest">Ultimo orario prudenziale per iniziare il ritorno</h2>
        <div className="row between wrap">
          <span className="mono" style={{ fontSize: '2.2rem', fontWeight: 900 }} data-testid="latest-return">
            {fmtClock(s.latestReturnStartMin)}
          </span>
          <span className={`chip ${statusClass}`}>
            <Icon name={s.status === 'ok' ? 'check' : 'alert'} size={16} /> {statusText}
          </span>
        </div>
        <dl className="kv" style={{ marginTop: 8 }}>
          <dt>Arrivo al rifugio previsto</dt>
          <dd className="mono">{fmtClock(s.arrivalHutMin)}</dd>
          <dt>Inizio ritorno previsto</dt>
          <dd className="mono">{fmtClock(s.projectedReturnStartMin)}</dd>
          <dt>Margine</dt>
          <dd className="mono" data-testid="margin">
            {s.marginMin >= 0 ? `+${fmtDuration(s.marginMin)}` : `−${fmtDuration(-s.marginMin)} (oltre il limite)`}
          </dd>
          <dt>Da essere all’auto entro</dt>
          <dd className="mono">{fmtClock(s.carDeadlineMin)}</dd>
          <dt>Tramonto / crepuscolo civile</dt>
          <dd className="mono">
            {fmtClock(s.sunsetMin)} / {fmtClock(s.civilDuskMin)}
          </dd>
          <dt>Rientro a Pergine previsto</dt>
          <dd className="mono">
            {fmtClock(s.projectedHomeMin)} {s.homeAfterDusk ? '(dopo il crepuscolo)' : ''}
          </dd>
          {s.timeToLatestReturnMin !== undefined ? (
            <>
              <dt>Tempo rimanente all’ora limite</dt>
              <dd className="mono">{s.timeToLatestReturnMin >= 0 ? fmtDuration(s.timeToLatestReturnMin) : `superata da ${fmtDuration(-s.timeToLatestReturnMin)}`}</dd>
            </>
          ) : null}
          <dt>Ritardo attuale</dt>
          <dd>{fmtDelay(s.delayMin)}</dd>
        </dl>
        <p className="small" style={{ marginTop: 8 }}>
          Calcolo: tramonto − {TRIP_CONFIG.safety.lightMarginMin} min di margine − tempo di ritorno con +{Math.round(TRIP_CONFIG.safety.marginFraction * 100)} % di sicurezza. Il sole diretto in valle sparisce prima del tramonto (stima dal rilievo, ±15–20 min):
          rifugio {win2('rifugio-val-di-fumo')}, diga {win2('park-dam')}, Boazzo {win2('park-boazzo-centrale')}.
        </p>
      </section>

      {s.suggestions.length > 0 ? (
        <section className="card alert-warning" aria-labelledby="sugg" data-testid="suggestions">
          <h2 id="sugg">Come recuperare margine (suggerimenti, non garanzie)</h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {s.suggestions.map((g) => (
              <li key={g.id} style={{ marginBottom: 8 }}>
                {g.kind === 'shorten-lunch' && <>Riduci il pranzo a 30 minuti (+{g.savedMin} min).</>}
                {g.kind === 'shorten-leno' && <>Riduci la sosta al Leno a 20 minuti (+{g.savedMin} min).</>}
                {g.kind === 'skip-leno' && <>Salta la sosta al Leno (+{g.savedMin} min).</>}
                {g.kind === 'turnaround' && g.turnaround && (
                  <>
                    <strong>Accorcia l’itinerario:</strong> fermati a {g.turnaround.name} ({fmtDistance(g.turnaround.distanceM)} dalla diga), pranzo lì e torna: ritorno all’auto verso le {fmtClock(g.turnaround.backAtCarMin)}.
                  </>
                )}{' '}
                <span className={`chip ${g.sufficient ? 'ok' : 'warn'}`}>{g.sufficient ? 'sufficiente' : 'da solo non basta'} · margine {g.resultingMarginMin >= 0 ? '+' : '−'}
                  {fmtDuration(Math.abs(g.resultingMarginMin))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card" aria-labelledby="timeline">
        <h2 id="timeline">Giornata, voce per voce</h2>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="schedule-list">
          {schedule.entries.map((e) => (
            <li key={e.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--c-line)' }} aria-current={e.status === 'current' ? 'step' : undefined}>
              <div className="row between wrap">
                <strong>{e.label}</strong>
                <span className="muted small">
                  {e.durationMin > 0 ? fmtDuration(e.durationMin) : '—'} · {BASIS_LABEL[e.basis]}
                </span>
              </div>
              <div className="small mono">
                <span>Pianificato {fmtClock(e.plannedStartMin)}→{fmtClock(e.plannedEndMin)}</span>
                {' · '}
                <span>Effettivo {e.actualEndMin !== undefined ? fmtClock(e.actualEndMin) : '—'}</span>
                {' · '}
                <span>Previsto {fmtClock(e.projectedEndMin)}</span>
                {e.delayMin !== 0 ? <span> ({fmtDelay(e.delayMin)})</span> : null}
                {e.status === 'current' ? <span className="chip info" style={{ marginLeft: 6 }}>in corso</span> : null}
                {e.status === 'done' ? <span className="chip ok" style={{ marginLeft: 6 }}>fatto</span> : null}
              </div>
            </li>
          ))}
        </ol>
        <p className="muted small">Durata totale pianificata: {fmtDuration(s.totalPlannedMin)}.</p>
      </section>

      <section className="card" aria-labelledby="drive">
        <h2 id="drive">Tempi di guida (stime modificabili)</h2>
        <p className="muted small">
          Da distanze stradali OSM con velocità medie assunte (non includono traffico). Sostituiscili con il tempo indicato dal tuo navigatore.
        </p>
        {([
          ['toBoazzo', 'Pergine → Boazzo', legs?.['pergine-boazzo']],
          ['boazzoToDam', 'Boazzo → diga', legs?.['boazzo-dam']],
          ['home', 'Diga → Pergine', legs?.['dam-pergine']],
        ] as const).map(([k, label, leg]) => (
          <div key={k} className="row between" style={{ padding: '6px 0' }}>
            <label htmlFor={`drive-${k}`}>
              {label}
              {leg ? <span className="muted small"> ({leg.distanceKm} km, stima {leg.rangeMinutes[0]}–{leg.rangeMinutes[1]} min)</span> : <span className="muted small"> (valore generico: dati stradali non disponibili)</span>}
            </label>
            <span className="row">
              <input
                id={`drive-${k}`}
                type="number"
                inputMode="numeric"
                min={5}
                max={400}
                style={{ width: 84 }}
                value={prefs.driveOverrides[k] ?? leg?.nominalMinutes ?? TRIP_CONFIG.fallbackMin[k]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = { ...prefs.driveOverrides };
                  if (Number.isFinite(v) && v >= 5 && v <= 400) next[k] = Math.round(v);
                  else delete next[k];
                  updatePrefs({ driveOverrides: next });
                }}
              />
              <span>min</span>
            </span>
          </div>
        ))}
        <button className="btn ghost small" onClick={() => updatePrefs({ driveOverrides: {} })}>
          Ripristina le stime
        </button>
      </section>

      <section className="card" aria-labelledby="actuals">
        <h2 id="actuals">Orari effettivi</h2>
        <p className="muted small">Registra gli orari reali: il programma ricalcola ritardo e ora limite. Puoi correggerli a mano.</p>
        {EVENT_ORDER.map((ev) => (
          <div key={ev} className="row between" style={{ padding: '6px 0' }}>
            <label htmlFor={`ev-${ev}`}>{EVENT_LABEL[ev]}</label>
            <span className="row">
              <input
                id={`ev-${ev}`}
                type="time"
                value={prefs.actuals[ev] !== undefined ? fmtClock(prefs.actuals[ev] as number) : ''}
                onChange={(e) => {
                  const m = parseClock(e.target.value);
                  if (m !== null) recordEvent(ev, m);
                }}
              />
              <button className="btn ghost small" onClick={() => recordEvent(ev)} aria-label={`Registra ora: ${EVENT_LABEL[ev]}`}>
                Ora
              </button>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
