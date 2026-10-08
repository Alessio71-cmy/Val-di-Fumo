import type { GPSPosition } from '../domain/types';

/**
 * Controller della geolocalizzazione (senza React, testabile con una geolocation finta).
 *
 * Regole del brief (§6):
 *  - richiesta esplicita del permesso; NESSUNA posizione letta prima del consenso (start() va chiamato da un gesto dell'utente);
 *  - aggiornamento durante l'uso attivo; gestione di permesso negato, GPS non disponibile, timeout, posizione obsoleta;
 *  - nessuna posizione lascia il dispositivo.
 */
export type GpsStatus = 'idle' | 'requesting' | 'tracking' | 'denied' | 'unavailable' | 'unsupported' | 'insecure';

export interface GpsState {
  status: GpsStatus;
  position: GPSPosition | null;
  /** Ultimo errore non fatale (timeout, posizione non disponibile temporaneamente). */
  warning: 'timeout' | 'unavailable' | null;
  /** Numero di fix ricevuti da quando è stato avviato. */
  fixes: number;
  /** Epoch ms di avvio del tracking (per mostrare "in attesa del primo fix"). */
  startedAt: number | null;
}

export const INITIAL_GPS_STATE: GpsState = { status: 'idle', position: null, warning: null, fixes: 0, startedAt: null };

export interface GeolocationLike {
  watchPosition(success: PositionCallback, error?: PositionErrorCallback | null, options?: PositionOptions): number;
  clearWatch(id: number): void;
}

export interface GpsOptions {
  maximumAgeMs: number;
  timeoutMs: number;
  now?: () => number;
  /** Contesto sicuro? (HTTPS/localhost) — la geolocalizzazione lo richiede. */
  secureContext?: boolean;
}

type Listener = (s: GpsState) => void;

export class GpsController {
  private state: GpsState = INITIAL_GPS_STATE;
  private watchId: number | null = null;
  private listeners = new Set<Listener>();
  private readonly geo: GeolocationLike | undefined;
  private readonly opts: GpsOptions;
  private readonly now: () => number;

  constructor(geo: GeolocationLike | undefined, opts: GpsOptions) {
    this.geo = geo;
    this.opts = opts;
    this.now = opts.now ?? Date.now;
  }

  getState(): GpsState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<GpsState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  /** Da chiamare SOLO in risposta a un gesto esplicito dell'utente ("Attiva GPS"). */
  start(): void {
    if (this.watchId !== null) return;
    if (this.opts.secureContext === false) {
      this.set({ status: 'insecure' });
      return;
    }
    if (!this.geo) {
      this.set({ status: 'unsupported' });
      return;
    }
    this.set({ status: 'requesting', warning: null, fixes: 0, startedAt: this.now() });
    try {
      this.watchId = this.geo.watchPosition(
        (p) => this.onPosition(p),
        (e) => this.onError(e),
        { enableHighAccuracy: true, maximumAge: this.opts.maximumAgeMs, timeout: this.opts.timeoutMs },
      );
    } catch {
      this.set({ status: 'unavailable' });
    }
  }

  /** Riavvia il watch (utile quando la pagina torna in primo piano: su iOS il watch può essere stato sospeso). */
  restart(): void {
    if (this.watchId === null) return;
    this.stop(false);
    this.start();
  }

  stop(resetStatus = true): void {
    if (this.watchId !== null && this.geo) {
      try {
        this.geo.clearWatch(this.watchId);
      } catch {
        /* ignora */
      }
    }
    this.watchId = null;
    if (resetStatus) this.set({ status: 'idle', warning: null });
  }

  private onPosition(p: GeolocationPosition): void {
    const c = p.coords;
    const pos: GPSPosition = {
      lat: c.latitude,
      lng: c.longitude,
      accuracyM: c.accuracy,
      altitudeM: c.altitude,
      headingDeg: c.heading !== null && Number.isFinite(c.heading) ? c.heading : null,
      speedMps: c.speed !== null && Number.isFinite(c.speed) ? c.speed : null,
      timestamp: p.timestamp || this.now(),
    };
    this.set({ status: 'tracking', position: pos, warning: null, fixes: this.state.fixes + 1 });
  }

  private onError(e: GeolocationPositionError): void {
    // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
    if (e.code === 1) {
      this.stop(false);
      this.set({ status: 'denied', warning: null });
    } else if (e.code === 2) {
      this.set({ status: this.state.position ? 'tracking' : 'unavailable', warning: 'unavailable' });
    } else {
      this.set({ status: this.state.position ? 'tracking' : 'requesting', warning: 'timeout' });
    }
  }
}
