import { describe, expect, it } from 'vitest';
import { headingFromOrientation, readHeading, smoothAngle } from '../../src/geo/heading';

const close = (a: number, b: number, tol = 0.5) => expect(Math.abs(((a - b + 540) % 360) - 180)).toBeLessThanOrEqual(tol);

describe('direzione dal sensore di orientamento', () => {
  it('telefono in piedi: nord, ovest, sud, est', () => {
    close(headingFromOrientation(0, 90, 0), 0);
    close(headingFromOrientation(90, 90, 0), 270); // alpha cresce in senso antiorario
    close(headingFromOrientation(180, 90, 0), 180);
    close(headingFromOrientation(270, 90, 0), 90);
  });
  it('telefono in piano: direzione del bordo superiore', () => {
    close(headingFromOrientation(0, 0, 0), 0);
    close(headingFromOrientation(90, 0, 0), 270);
    close(headingFromOrientation(300, 5, -3), 60);
  });
  it('inclinato come quando si cammina guardando lo schermo (45°)', () => {
    close(headingFromOrientation(0, 45, 0), 0);
    close(headingFromOrientation(135, 45, 0), 225);
  });
  it('nessun salto fra la definizione "in piano" e "in piedi" attorno ai 20°', () => {
    for (const alpha of [10, 100, 200, 330]) close(headingFromOrientation(alpha, 19, 0), headingFromOrientation(alpha, 21, 0), 1.5);
  });
  it('legge iOS (webkitCompassHeading) e Android (angoli assoluti); ignora gli angoli relativi', () => {
    expect(readHeading({ webkitCompassHeading: 45 })).toBe(45);
    expect(readHeading({ webkitCompassHeading: -10 })).toBe(350);
    close(readHeading({ absolute: true, alpha: 90, beta: 90, gamma: 0 }) ?? -1, 270);
    expect(readHeading({ absolute: false, alpha: 90, beta: 90, gamma: 0 })).toBeNull();
    expect(readHeading({ absolute: true, alpha: null, beta: 90, gamma: 0 })).toBeNull();
    expect(readHeading({})).toBeNull();
  });
  it('la media passa per il tratto più corto e non inventa valori', () => {
    expect(smoothAngle(null, 123)).toBe(123);
    close(smoothAngle(350, 10, 0.5), 0, 0.01);
    close(smoothAngle(10, 350, 0.5), 0, 0.01);
    close(smoothAngle(90, 90, 0.3), 90, 0.001);
    expect(smoothAngle(0, 180, 1)).toBeCloseTo(180, 5);
  });
});
