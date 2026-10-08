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

/** Applica l'aggiornamento SOLO su richiesta dell'utente (mai a metà escursione in automatico). */
export function applyUpdate(): void {
  if (!waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
