import { useEffect, useRef, type ReactNode } from 'react';
import { SOURCE_BY_ID } from '../../data/trip';
import type { ValidationStatus } from '../../domain/types';
import { VALIDATION_LABEL, VALIDATION_SHORT } from '../../domain/validation';
import { Icon, type IconName } from './Icon';

const VAL_ICON: Record<ValidationStatus, IconName> = {
  'field-verified': 'check',
  'official-verified': 'check',
  'cross-checked': 'check',
  'source-derived': 'info',
  estimated: 'clock',
  unverified: 'alert',
};

/** Stato di validazione: sempre testo + icona (mai solo colore). */
export function ValidationBadge({ status, long }: { status: ValidationStatus; long?: boolean }) {
  return (
    <span className={`badge ${status}`} title={VALIDATION_LABEL[status]}>
      <Icon name={VAL_ICON[status]} size={14} />
      {long ? VALIDATION_LABEL[status] : VALIDATION_SHORT[status]}
    </span>
  );
}

export function Stat({ label, value, sub, id }: { label: string; value: ReactNode; sub?: ReactNode; id?: string }) {
  return (
    <div className="stat" id={id}>
      <div className="l">{label}</div>
      <div className="v mono">{value}</div>
      {sub ? <div className="s">{sub}</div> : null}
    </div>
  );
}

/** Foglio modale con focus intrappolato, chiusura con Esc e ripristino del focus. */
export function Sheet({ title, onClose, children, id }: { title: string; onClose: () => void; children: ReactNode; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,summary,[tabindex]:not([tabindex="-1"])'));
        if (f.length === 0) return;
        const first = f[0] as HTMLElement;
        const last = f[f.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} id={id}>
        <header>
          <h2>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Chiudi">
            <Icon name="close" /> Chiudi
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Elenco delle fonti di un elemento, con stato di accesso. I link richiedono la rete. */
export function SourceList({ ids }: { ids: string[] }) {
  const items = ids.map((id) => SOURCE_BY_ID[id]).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <details className="fold" style={{ marginTop: 10 }}>
      <summary>
        <Icon name="info" /> Fonti ({items.length})
      </summary>
      <div className="body">
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {items.map((s) =>
            s ? (
              <li key={s.id} className="small" style={{ marginBottom: 6 }}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>{' '}
                <span className="muted">
                  — {s.publisher}; {s.accessMode === 'direct' ? 'letta direttamente' : s.accessMode === 'search-summary' ? 'solo sintesi di ricerca' : 'NON consultata'}; attendibilità {s.reliability}; {s.accessedAt}
                </span>
              </li>
            ) : null,
          )}
        </ul>
        <p className="muted small">I link si aprono nel browser e richiedono la rete.</p>
      </div>
    </details>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <span style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function copyText(text: string): Promise<boolean> {
  return (async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* ripiego */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  })();
}
