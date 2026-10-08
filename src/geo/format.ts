/** Formattazione italiana di distanze, durate, orari. */

export function fmtDistance(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return '—';
  const a = Math.abs(m);
  if (a < 50) return `${Math.round(a)} m`;
  if (a < 995) return `${Math.round(a / 5) * 5} m`;
  return `${(a / 1000).toFixed(a < 10_000 ? 2 : 1).replace('.', ',')} km`;
}

/** Distanza in metri interi (per quote e valori brevi). */
export function fmtMeters(m: number): string {
  return `${Math.round(m)} m`;
}

export function fmtDuration(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return '—';
  const total = Math.round(Math.abs(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Minuti dalla mezzanotte → "HH:MM". */
export function fmtClock(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return '—';
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseClock(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

export function fmtDelay(min: number): string {
  const r = Math.round(min);
  if (r === 0) return 'in orario';
  return r > 0 ? `+${fmtDuration(r)} di ritardo` : `${fmtDuration(-r)} in anticipo`;
}

export function fmtDateIT(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "tra 12 min" / "12 min fa" per un intervallo in ms. */
export function fmtAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'adesso';
  if (s < 90) return `${s} s fa`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min fa`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min fa`;
}

export function fmtDateTimeIT(epochMs: number, timeZone = 'Europe/Rome'): string {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone }).format(epochMs);
}

export function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
