import { Component, type ErrorInfo, type ReactNode } from 'react';
import { EMERGENCY_STEPS } from '../../content/safety';
import { resetPrefs } from '../../storage/prefs';

interface State {
  error: Error | null;
}

/**
 * Ultima rete di sicurezza: se un errore imprevisto interrompe il disegno dell'interfaccia non resta una pagina bianca.
 * Il testo di emergenza qui sotto è statico (non dipende dallo stato dell'app né dai dati caricati).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Errore imprevisto', error, info.componentStack);
  }

  private reset = async () => {
    try {
      await resetPrefs();
    } catch {
      /* si ricarica comunque */
    }
    window.location.reload();
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const signal = EMERGENCY_STEPS.find((s) => s.title.startsWith('4.'));
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
        <div className="card alert-danger" role="alert">
          <h1>Errore imprevisto</h1>
          <p>L’app ha incontrato un problema e si è fermata. Nessun dato è stato inviato a nessuno.</p>
          <div className="stack">
            <button className="btn big block" onClick={() => window.location.reload()}>
              Ricarica l’app
            </button>
            <button className="btn secondary block" onClick={() => void this.reset()}>
              Cancella i dati salvati (orari, preferenze, ultima posizione) e ricarica
            </button>
          </div>
        </div>
        <div className="card">
          <h2>In caso di emergenza</h2>
          <p>
            <a className="btn danger block" href="tel:112">
              Chiama il 112
            </a>
          </p>
          <p className="small">Il 112 usa qualsiasi rete disponibile ma non funziona dove non c’è alcuna rete mobile. Gli SMS non sono garantiti.</p>
          {signal ? (
            <p className="small">
              <strong>{signal.title.replace(/^4\.\s*/, '')}.</strong> {signal.body}
            </p>
          ) : null}
        </div>
        <details className="small">
          <summary>Dettagli tecnici</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
        </details>
      </main>
    );
  }
}
