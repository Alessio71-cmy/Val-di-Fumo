import { useCallback, useEffect, useRef, useState } from 'react';
import { AppProvider, useApp } from './state/AppState';
import { Icon, type IconName } from './ui/components/Icon';
import { Toast } from './ui/components/ui';
import { ExploreScreen } from './ui/screens/Explore';
import { MapScreen } from './ui/screens/MapScreen';
import { RouteScreen } from './ui/screens/Route';
import { SafetyScreen } from './ui/screens/Safety';
import { TodayScreen } from './ui/screens/Today';
import { TABS, type GotoFn, type GotoOpts, type Tab } from './ui/tabs';

const TAB_ICON: Record<Tab, IconName> = { oggi: 'sun', mappa: 'map', percorso: 'route', esplora: 'compass', sicurezza: 'shield' };
const TAB_TITLE: Record<Tab, string> = { oggi: 'Oggi', mappa: 'Mappa', percorso: 'Percorso', esplora: 'Esplora', sicurezza: 'Sicurezza e offline' };

function parseHash(): Tab {
  const m = /^#\/?([a-z]+)/.exec(typeof location === 'undefined' ? '' : location.hash);
  const t = m?.[1];
  return TABS.some((x) => x.id === t) ? (t as Tab) : 'oggi';
}

function TopChips({ goto }: { goto: GotoFn }) {
  const { gps, fixQuality, offline, online } = useApp();
  const gpsOn = gps.status === 'tracking' && gps.position && fixQuality;
  const gpsChip = gpsOn
    ? { cls: fixQuality.usable ? (fixQuality.accuracy === 'buona' ? 'ok' : 'warn') : 'danger', text: `GPS ±${Math.round(gps.position!.accuracyM)} m${fixQuality.age === 'fresca' ? '' : ' · non aggiornato'}` }
    : gps.status === 'requesting'
      ? { cls: 'info', text: 'GPS: attesa segnale' }
      : gps.status === 'denied' || gps.status === 'unavailable' || gps.status === 'unsupported' || gps.status === 'insecure'
        ? { cls: 'danger', text: 'GPS non attivo' }
        : { cls: '', text: 'GPS spento' };
  const off = offline?.state;
  const offChip =
    off === 'ready'
      ? { cls: 'ok', text: 'Offline pronto' }
      : off === 'needs-reload'
        ? { cls: 'warn', text: 'Riapri l’app' }
        : off === 'partial' || off === 'stale'
          ? { cls: 'warn', text: 'Offline incompleto' }
          : off === 'dev'
            ? { cls: 'info', text: 'Sviluppo' }
            : { cls: 'danger', text: 'Offline non pronto' };
  return (
    <>
      <button className={`chip ${gpsChip.cls}`} onClick={() => goto('sicurezza', { section: 'gps' })} data-testid="chip-gps" aria-label={`Stato GPS: ${gpsChip.text}. Apri i dettagli`}>
        <Icon name="gps" size={15} /> {gpsChip.text}
      </button>
      <button className={`chip ${offChip.cls}`} onClick={() => goto('sicurezza', { section: 'offline' })} data-testid="chip-offline" aria-label={`Stato offline: ${offChip.text}. Apri i dettagli`}>
        <Icon name="offline" size={15} /> {offChip.text}
      </button>
      {!online ? (
        <span className="chip info" data-testid="chip-network" role="status">
          Senza rete
        </span>
      ) : null}
    </>
  );
}

function Shell() {
  const a = useApp();
  const [tab, setTab] = useState<Tab>(parseHash);
  const [opts, setOpts] = useState<GotoOpts>({});
  const [showSchedule, setShowSchedule] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  const goto = useCallback<GotoFn>((t, o = {}) => {
    setOpts(o);
    setTab(t);
    if (t === 'oggi') setShowSchedule(!!o.schedule);
    const h = `#/${t}`;
    if (location.hash !== h) history.pushState(null, '', h);
  }, []);

  useEffect(() => {
    const on = () => {
      setTab(parseHash());
      setOpts({});
      setShowSchedule(false);
    };
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener('hashchange', on);
    };
  }, []);

  // titolo del documento, focus sul contenuto e scorrimento in cima a ogni cambio di sezione (non al primo caricamento)
  useEffect(() => {
    document.title = `${TAB_TITLE[tab]} — Val di Fumo`;
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo?.(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [tab]);

  return (
    <div className={`app${tab === 'mappa' ? ' map-mode' : ''}`}>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>
        Vai al contenuto
      </a>
      <header className="topbar" role="banner">
        <span className="title">Val di Fumo · {TAB_TITLE[tab]}</span>
        <TopChips goto={goto} />
      </header>
      {a.sw.updateAvailable ? (
        <div className="card alert-info" role="status" style={{ margin: '10px 14px 0' }} data-testid="update-banner">
          <strong>Nuova versione dell’app disponibile.</strong> Applicala a casa, con rete e prima di partire: non durante l’escursione.{' '}
          <button className="btn small secondary" onClick={() => goto('sicurezza', { section: 'offline' })}>Dettagli</button>
        </div>
      ) : null}
      <main id="main" ref={mainRef} tabIndex={-1} className={tab === 'mappa' ? 'full' : undefined} data-tab={tab} style={{ outline: 'none' }}>
        {tab === 'oggi' ? <TodayScreen goto={goto} showSchedule={showSchedule} setShowSchedule={setShowSchedule} /> : null}
        {tab === 'mappa' ? <MapScreen goto={goto} /> : null}
        {tab === 'percorso' ? <RouteScreen goto={goto} initialStage={opts.stageId} /> : null}
        {tab === 'esplora' ? <ExploreScreen goto={goto} focus={opts.poiId} /> : null}
        {tab === 'sicurezza' ? <SafetyScreen focus={opts.section} /> : null}
      </main>
      <nav className="tabbar" aria-label="Sezioni dell’app">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => goto(t.id)} aria-current={tab === t.id ? 'page' : undefined} data-testid={`tab-${t.id}`}>
            <Icon name={TAB_ICON[t.id]} />
            {t.label}
          </button>
        ))}
      </nav>
      <Toast message={a.toast} />
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
