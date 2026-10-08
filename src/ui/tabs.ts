export type Tab = 'oggi' | 'mappa' | 'percorso' | 'esplora' | 'sicurezza';

export interface GotoOpts {
  stageId?: string;
  routeId?: string;
  poiId?: string;
  /** Apre la sottopagina "Programma" in Oggi. */
  schedule?: boolean;
  section?: 'offline' | 'emergenza' | 'traccia' | 'gps';
}

export type GotoFn = (tab: Tab, opts?: GotoOpts) => void;

export const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'oggi', label: 'Oggi' },
  { id: 'mappa', label: 'Mappa' },
  { id: 'percorso', label: 'Percorso' },
  { id: 'esplora', label: 'Esplora' },
  { id: 'sicurezza', label: 'Sicurezza' },
];
