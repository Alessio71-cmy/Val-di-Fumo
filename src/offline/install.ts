/**
 * Stato di installazione della PWA su questo dispositivo.
 *  - "standalone": l'app è aperta dalla Home (installata), non in una scheda del browser;
 *  - "canPrompt": Chrome/Edge su Android o desktop hanno offerto l'installazione (evento beforeinstallprompt);
 *  - su iPhone/iPad non esiste un pulsante programmabile: l'installazione è manuale ("Aggiungi alla schermata Home"), affidabile da Safari.
 */
export type Platform = 'ios' | 'android' | 'desktop' | 'other';

export interface InstallState {
  standalone: boolean;
  canPrompt: boolean;
  platform: Platform;
  /** iOS: Safari è il browser con cui l'installazione è garantita (gli altri dipendono dalla versione di iOS). */
  iosSafari: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return 'desktop';
  return 'other';
}

/** Safari su iOS (senza "CriOS", "FxiOS", "EdgiOS", "OPiOS"): il browser con cui "Aggiungi alla schermata Home" è garantito. */
export function isIosSafari(ua: string): boolean {
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

let deferred: BeforeInstallPromptEvent | null = null;
let started = false;
const listeners = new Set<(s: InstallState) => void>();

export function readInstallState(): InstallState {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const standalone =
    typeof window !== 'undefined' &&
    ((typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  return { standalone, canPrompt: deferred !== null, platform: detectPlatform(ua, typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints), iosSafari: isIosSafari(ua) };
}

function emit(): void {
  const s = readInstallState();
  for (const l of listeners) l(s);
}

/** Da chiamare una volta all'avvio: raccoglie l'evento di installazione senza mostrare nulla da solo. */
export function startInstallCapture(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    emit();
  });
}

export function subscribeInstall(fn: (s: InstallState) => void): () => void {
  listeners.add(fn);
  fn(readInstallState());
  return () => listeners.delete(fn);
}

/** Mostra la finestra di installazione del browser (solo dove disponibile, e solo su richiesta dell'utente). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const ev = deferred;
  deferred = null;
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    emit();
    return choice.outcome;
  } catch {
    emit();
    return 'unavailable';
  }
}
