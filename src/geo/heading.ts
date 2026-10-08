/**
 * Direzione verso cui è rivolto il telefono, dai sensori di orientamento (bussola magnetica), NON dal GPS.
 * È un'indicazione: serve la calibrazione del sensore e può sbagliare di molti gradi vicino a metalli o magneti.
 */
export interface OrientationLike {
  alpha?: number | null;
  beta?: number | null;
  gamma?: number | null;
  absolute?: boolean;
  /** iOS/Safari: direzione magnetica già calcolata dal sistema. */
  webkitCompassHeading?: number | null;
}

const RAD = Math.PI / 180;
const norm = (d: number) => ((d % 360) + 360) % 360;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Da alpha/beta/gamma (angoli del W3C, rispetto al nord magnetico) alla direzione in gradi (0 = nord, senso orario).
 * Telefono in piano: direzione del bordo superiore; telefono in piedi o inclinato: direzione in cui punta il retro
 * (come quando si cammina guardando lo schermo). Le due definizioni coincidono vicino ai 20° di inclinazione.
 */
export function headingFromOrientation(alpha: number, beta: number, gamma: number): number {
  const top = norm(360 - alpha);
  if (Math.abs(beta) < 20) return top;
  const a = alpha * RAD;
  const b = beta * RAD;
  const g = gamma * RAD;
  const vx = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const vy = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  if (Math.hypot(vx, vy) < 1e-6) return top;
  return norm(Math.atan2(vx, vy) / RAD);
}

/** Direzione utilizzabile da un evento di orientamento, oppure null (es. angoli relativi, senza riferimento al nord). */
export function readHeading(e: OrientationLike): number | null {
  if (finite(e.webkitCompassHeading)) return norm(e.webkitCompassHeading);
  if (e.absolute === true && finite(e.alpha) && finite(e.beta) && finite(e.gamma)) return headingFromOrientation(e.alpha, e.beta, e.gamma);
  return null;
}

/** Media mobile su angoli (passa per il tratto più corto, es. 359° → 1°). k = peso del nuovo valore. */
export function smoothAngle(prev: number | null, next: number, k = 0.3): number {
  if (prev === null) return norm(next);
  const delta = ((next - prev + 540) % 360) - 180;
  return norm(prev + delta * k);
}
