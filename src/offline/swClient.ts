export interface SwState {
  supported: boolean;
  registered: boolean;
  controlled: boolean;
  /** Una nuova versione è installata e attende conferma dell'utente. */
  updateAvailable: boolean;
  error?: string;
}

type Listener = (s: SwState) => void;
let state: SwState = { supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator, registered: false, controlled: false, updateAvailable: false };
const listeners = new Set<Listener>();
let waiting: ServiceWorker | null = null;
let registration: ServiceWorkerRegistration | null = null;

function emit(patch: Partial<SwState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}

export function subscribeSw(fn: Listener): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export async function registerServiceWorker(): Promise<void> {
  if (!state.supported) return;
  try {
    const url = new URL('sw.js', document.baseURI).toString();
    const reg = await navigator.serviceWorker.register(url, { scope: new URL('./', document.baseURI).pathname });
    registration = reg;
    emit({ registered: true, controlled: !!navigator.serviceWorker.controller });
    const track = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) {
        waiting = r.waiting;
        emit({ updateAvailable: true });
      }
    };
    track(reg);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          waiting = w;
          emit({ updateAvailable: true });
        }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => emit({ controlled: !!navigator.serviceWorker.controller }));
  } catch (e) {
    emit({ error: e instanceof Error ? e.message : 'registrazione non riuscita' });
  }
}

/**
 * Applica l'aggiornamento SOLO su richiesta dell'utente (mai a metà escursione in automatico).
 * Il messaggio "SKIP_WAITING" viene riprovato qualche volta: un worker in attesa può essere fermo o in fase di avvio
 * e un singolo messaggio può andare perso (osservato nei test automatici).
 */
export function applyUpdate(): void {
  const first = registration?.waiting ?? waiting;
  if (!first) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  let tries = 0;
  const send = () => {
    const w = registration?.waiting ?? first;
    if (w.state !== 'installed' || tries++ >= 8) return; // già in attivazione, attivato o sostituito
    w.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(send, 600);
  };
  send();
}
