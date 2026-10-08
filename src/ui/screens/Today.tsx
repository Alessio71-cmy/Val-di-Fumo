import { useState } from 'react';
import { TRIP_CONFIG } from '../../config/trip.config';
import { fmtAgo, fmtClock, fmtDateIT, fmtDistance, fmtDuration } from '../../geo/format';
import { PHASE_BY_ID } from '../../state/phase';
import { STAGE_FOR_PHASE, STAGE_FOR_WAYPOINT } from '../../state/stages';
import { useApp } from '../../state/AppState';
import { Icon } from '../components/Icon';
import { Progress, ValidationBadge } from '../components/ui';
import type { GotoFn } from '../tabs';
import { SchedulePage } from './Schedule';
import { NavigateSheet, PrepareSheet } from './sheets';

function whenLabel(days: number | null): { text: string; cls: string } {
  if (days === null) return { text: '', cls: 'info' };
  if (days === 0) return { text: 'Oggi', cls: 'ok' };
  if (days === 1) return { text: 'Domani', cls: 'info' };
  if (days > 1) return { text: `Tra ${days} giorni`, cls: 'info' };
  return { text: 'Data trascorsa: cambia la data in config/trip.config.ts', cls: 'warn' };
}

export function TodayScreen({ goto, showSchedule, setShowSchedule }: { goto: GotoFn; showSchedule: boolean; setShowSchedule: (v: boolean) => void }) {
  const a = useApp();
  const { trip, phase, schedule, prefs, weather, offline, nowMs, online, daysUntilTrip, nav, activeRouteId } = a;
  const [sheet, setSheet] = useState<null | 'prepare' | 'navigate'>(null);
  if (a.loading || !trip) {
    return (
      <p role="status" style={{ padding: 16 }}>
        Caricamento dei dati…
      </p>
    );
  }
  if (showSchedule) return <SchedulePage onBack={() => setShowSchedule(false)} />;

  const def = PHASE_BY_ID[phase];
  const when = whenLabel(daysUntilTrip);
  const stageId = phase === 'trek-out' && nav?.next ? (STAGE_FOR_WAYPOINT[nav.next.id] ?? 's4-lago') : (STAGE_FOR_PHASE[phase] ?? null);
  const stage = stageId ? trip.stages.find((s) => s.id === stageId) : undefined;
  const s = schedule?.summary;
  const route = trip.routes['route-out'];

  const onPrimary = () => {
    switch (def.primary) {
      case 'prepare':
        setSheet('prepare');
        break;
      case 'navigate':
        setSheet('navigate');
        break;
      case 'route':
      case 'return':
        goto('mappa');
        break;
      case 'evaluate-return':
        setShowSchedule(true);
        break;
      default:
        break;
    }
  };

  const hut = prefs.hutStatus;
  const phaseIdx = ['prep', 'drive-out', 'leno', 'drive-dam', 'trek-prep', 'trek-out', 'hut', 'trek-back', 'drive-home', 'done'].indexOf(phase);
  const overall = phaseIdx / 9;
  const trekProgress = nav?.reliable && (phase === 'trek-out' || phase === 'trek-back') ? nav.progressPct / 100 : null;
  const weatherAge = weather.snapshot ? Math.max(0, nowMs - weather.snapshot.fetchedAt) : null;
  const driveToId = def.driveTo ?? 'park-boazzo-centrale';

  return (
    <div className="stack">
      <section className="card" aria-labelledby="hero">
        <div className="row between wrap">
          <span className={`chip ${when.cls}`}>
            <Icon name="clock" size={16} /> {when.text}
          </span>
          <span className="chip">{trip.stages.length} tappe</span>
        </div>
        <h1 id="hero" style={{ marginTop: 8 }}>
          {TRIP_CONFIG.title}
        </h1>
        <p style={{ marginBottom: 4 }}>
          <strong style={{ textTransform: 'capitalize' }}>{fmtDateIT(trip.date)}</strong>
        </p>
        <p className="muted small" style={{ margin: 0 }}>
          {TRIP_CONFIG.subtitle}
        </p>
        <hr style={{ border: 0, borderTop: '1px solid var(--c-line)', margin: '12px 0' }} />
        <button className="btn big block" onClick={onPrimary} data-testid="primary-action" disabled={def.primary === 'none'}>
          <Icon name={def.primary === 'prepare' ? 'download' : def.primary === 'navigate' ? 'car' : def.primary === 'evaluate-return' ? 'clock' : def.primary === 'return' ? 'route' : 'walk'} />
          {def.primaryLabel}
        </button>
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          Fase attuale: <strong data-testid="phase-label">{def.label}</strong>
        </p>
      </section>

      {def.advanceEvent ? (
        <section className="card" aria-labelledby="phase-h">
          <h2 id="phase-h">Avanzamento della giornata</h2>
          <Progress value={trekProgress ?? overall} label="Progressione complessiva" />
          <p className="small muted" style={{ margin: '6px 0 10px' }}>
            {trekProgress !== null && nav ? `Sul percorso: ${Math.round(nav.progressPct)} % — mancano ${fmtDistance(nav.remainingM)} (lungo la traccia)` : `Giornata: tappa ${Math.max(1, phaseIdx + 1)} di 10`}
          </p>
          <button className="btn secondary block" onClick={() => a.recordEvent(def.advanceEvent!)} data-testid="advance">
            <Icon name="check" /> {def.advanceLabel}
          </button>
          {Object.keys(prefs.actuals).length > 0 ? (
            <button className="btn ghost small" style={{ marginTop: 8 }} onClick={a.undoLastEvent}>
              Annulla l’ultimo passaggio
            </button>
          ) : null}
        </section>
      ) : null}

      <section className={`card ${hut === 'unknown' ? 'alert-warning' : hut === 'confirmed-open' ? 'alert-ok' : 'alert-danger'}`} aria-labelledby="hut-h" data-testid="hut-card">
        <h2 id="hut-h">
          <Icon name="hut" /> Rifugio Val di Fumo:{' '}
          {hut === 'unknown' ? 'apertura da confermare' : hut === 'confirmed-open' ? 'confermato aperto' : 'confermato chiuso'}
        </h2>
        {hut === 'unknown' ? (
          <p>
            Le schede sono discordanti (fino al 30 settembre oppure fino all’11 ottobre 2026). <strong>Non fare affidamento sul rifugio</strong> per acqua, cibo o riparo: porta tutto con te. Telefona e poi registra qui l’esito.
          </p>
        ) : (
          <p className="small">Esito registrato da te. Non basta a garantire servizi: porta pranzo, acqua e strati.</p>
        )}
        <div className="seg" role="group" aria-label="Esito della verifica sul rifugio">
          <button aria-pressed={hut === 'unknown'} onClick={() => a.updatePrefs({ hutStatus: 'unknown' })}>Non so</button>
          <button aria-pressed={hut === 'confirmed-open'} onClick={() => a.updatePrefs({ hutStatus: 'confirmed-open' })}>Aperto</button>
          <button aria-pressed={hut === 'confirmed-closed'} onClick={() => a.updatePrefs({ hutStatus: 'confirmed-closed' })}>Chiuso</button>
        </div>
      </section>

      {stage ? (
        <section className="card" aria-labelledby="next-h">
          <h2 id="next-h">Prossima tappa</h2>
          <p style={{ marginBottom: 4 }}>
            <strong>{stage.name}</strong> <ValidationBadge status={stage.validation} />
          </p>
          <p className="small">{stage.summary.split('. ')[0]}.</p>
          <div className="row wrap small muted">
            {stage.distanceFromPrevM ? <span><Icon name={stage.mode === 'auto' ? 'car' : 'walk'} size={16} /> {fmtDistance(stage.distanceFromPrevM)}</span> : null}
            {stage.duration.nominal > 0 ? <span><Icon name="clock" size={16} /> ≈{fmtDuration(stage.duration.nominal)} ({stage.duration.basis === 'estimated' ? 'stima' : 'modello'})</span> : null}
            {phase === 'trek-out' && nav?.next ? <span>Prossimo punto: {nav.next.name} tra {fmtDistance(nav.next.distAlongM)}</span> : null}
          </div>
          <button className="btn secondary small" style={{ marginTop: 10 }} onClick={() => goto('percorso', { stageId: stage.id })}>
            Dettagli della tappa <Icon name="chevron" size={18} />
          </button>
        </section>
      ) : null}

      {s ? (
        <section className={`card ${s.status === 'late' ? 'alert-danger' : s.status === 'tight' ? 'alert-warning' : ''}`} aria-labelledby="sched-h" data-testid="schedule-card">
          <h2 id="sched-h">Programma</h2>
          <div className="grid2">
            <div className="stat"><div className="l">Partenza</div><div className="v mono">{fmtClock(prefs.departureMin)}</div><div className="s">da Pergine</div></div>
            <div className="stat"><div className="l">Al rifugio</div><div className="v mono">{fmtClock(s.arrivalHutMin)}</div><div className="s">previsto (stima)</div></div>
            <div className="stat"><div className="l">Ritorno entro</div><div className="v mono">{fmtClock(s.latestReturnStartMin)}</div><div className="s">ultimo orario prudenziale</div></div>
            <div className="stat"><div className="l">Tramonto</div><div className="v mono">{fmtClock(s.sunsetMin)}</div><div className="s">sole in valle prima</div></div>
          </div>
          <p className="small" style={{ marginTop: 8 }}>
            {s.status === 'ok' ? 'Margine di luce adeguato.' : s.status === 'tight' ? 'Margine tirato: valuta di accorciare.' : 'Non compatibile con un rientro prudente: accorcia l’itinerario.'}
            {s.delayMin !== 0 ? ` Ritardo attuale: ${s.delayMin > 0 ? '+' : '−'}${fmtDuration(Math.abs(s.delayMin))}.` : ''}
          </p>
          <button className="btn block" onClick={() => setShowSchedule(true)} data-testid="open-schedule">
            <Icon name="clock" /> Programma completo e orario di partenza
          </button>
        </section>
      ) : null}

      <section className="card" aria-labelledby="meteo-h" data-testid="weather-card">
        <div className="row between">
          <h2 id="meteo-h">Meteo (Rifugio, ≈{TRIP_CONFIG.weather.elevationM} m)</h2>
          <button className="btn ghost small" onClick={a.refreshWeather} disabled={!online || weather.status === 'loading'} aria-label="Aggiorna il meteo">
            <Icon name="refresh" /> Aggiorna
          </button>
        </div>
        {weather.summary && weather.snapshot ? (
          <>
            <p style={{ marginBottom: 4 }}>
              <strong>{weather.summary.text}</strong>, {weather.summary.tempMinC !== null ? `${Math.round(weather.summary.tempMinC)}…${Math.round(weather.summary.tempMaxC ?? weather.summary.tempMinC)} °C` : 'temperatura n.d.'}
              {weather.summary.precipProbMaxPct !== null ? `, precipitazioni fino al ${Math.round(weather.summary.precipProbMaxPct)} %` : ''}
              {weather.summary.gustMaxKmh !== null ? `, raffiche fino a ${Math.round(weather.summary.gustMaxKmh)} km/h` : ''}.
            </p>
            <p className={`small ${weather.stale ? '' : 'muted'}`}>
              <span className={`chip ${weather.stale ? 'warn' : ''}`}>
                Aggiornato {weatherAge !== null ? fmtAgo(weatherAge) : ''}
                {weather.stale ? ' — dato vecchio' : ''}
              </span>{' '}
              (fascia 08–18, modello Open-Meteo: non è una previsione ufficiale; consulta Meteo Trentino)
            </p>
          </>
        ) : (
          <p className="small">
            {weather.status === 'loading'
              ? 'Aggiornamento in corso…'
              : online
                ? `Meteo non disponibile${weather.error ? ` (${weather.error})` : ''}.`
                : 'Meteo non disponibile: sei offline e non c’è un dato salvato. Consulta Meteo Trentino quando hai rete.'}
          </p>
        )}
        {weather.error && weather.snapshot ? <p className="small muted">Ultimo tentativo di aggiornamento fallito: {weather.error}</p> : null}
        <p className="small muted" style={{ marginBottom: 0 }}>
          Bollettino ufficiale (serve rete):{' '}
          <a href="https://www.meteotrentino.it/" target="_blank" rel="noopener noreferrer">
            Meteo Trentino
          </a>
        </p>
      </section>

      <section className={`card ${offline?.state === 'ready' ? 'alert-ok' : 'alert-warning'}`} aria-labelledby="off-h" data-testid="offline-card">
        <h2 id="off-h">
          <Icon name="offline" /> Preparazione offline: {offline ? STATE_TEXT[offline.state] : '…'}
        </h2>
        <p className="small">{offline?.reason}</p>
        {offline?.record ? <p className="small muted">Ultima verifica su questo dispositivo: {new Date(offline.record.verifiedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}.</p> : null}
        <p className="small" data-testid="install-line">
          <Icon name="info" size={16} />{' '}
          {a.install.standalone
            ? 'App installata: aperta dalla schermata Home.'
            : a.install.platform === 'ios'
              ? a.install.iosSafari
                ? 'Aperta nel browser. Su iPhone installa l’app: Condividi → “Aggiungi alla schermata Home”, poi prepara il viaggio dall’icona (Safari può cancellare i dati dei siti non installati).'
                : 'Aperta nel browser. Su iPhone l’installazione è affidabile da Safari: se qui non trovi “Aggiungi alla schermata Home”, apri lo stesso indirizzo in Safari.'
              : 'Aperta nel browser: installa l’app per usarla come le altre (menu del browser → “Installa app”).'}
        </p>
        <div className="row wrap">
          <button className="btn small" onClick={() => setSheet('prepare')}>
            <Icon name="download" /> {offline?.state === 'ready' ? 'Ripeti verifica' : 'Prepara il viaggio'}
          </button>
          {a.install.canPrompt && !a.install.standalone ? (
            <button className="btn secondary small" onClick={() => void a.installApp()} data-testid="install-button">
              <Icon name="download" /> Installa l’app
            </button>
          ) : null}
          <button className="btn ghost small" onClick={() => goto('sicurezza', { section: 'offline' })}>Dettagli</button>
        </div>
      </section>

      {route ? (
        <section className="card alert-info" aria-labelledby="osm-h">
          <h2 id="osm-h">Traccia da OpenStreetMap — non verificata sul campo</h2>
          <p className="small" style={{ margin: 0 }}>
            {fmtDistance(route.lengthM)} (andata), ≈{route.ascentM} m di salita (stima DEM). Ultima modifica OSM: {route.provenance.sourceUpdated ?? 'n.d.'}. Fidati dei segnavia sul terreno.
          </p>
          <p className="small" style={{ margin: '6px 0 0' }}>
            Percorso attivo in Mappa: <strong>{trip.routes[activeRouteId]?.name ?? activeRouteId}</strong>
          </p>
        </section>
      ) : null}

      {a.loadWarnings.length > 0 ? (
        <section className="card alert-danger" role="alert">
          <h2>Dati incompleti</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {a.loadWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <p className="small">Le funzioni che dipendono da questi dati sono disattivate o mostrate come non disponibili.</p>
        </section>
      ) : null}

      {sheet === 'prepare' ? <PrepareSheet onClose={() => setSheet(null)} /> : null}
      {sheet === 'navigate' ? <NavigateSheet placeId={driveToId} onClose={() => setSheet(null)} /> : null}
    </div>
  );
}

const STATE_TEXT: Record<string, string> = {
  ready: 'pronto',
  'needs-reload': 'riapri l’app',
  partial: 'parziale',
  none: 'non pronta',
  stale: 'da ripetere',
  unsupported: 'non supportata',
  dev: 'sviluppo',
};
