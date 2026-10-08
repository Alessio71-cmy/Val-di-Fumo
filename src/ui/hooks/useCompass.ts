import { useCallback, useEffect, useRef, useState } from 'react';
import { readHeading, smoothAngle, type OrientationLike } from '../../geo/heading';

/** off: spenta · asking: attendo permesso/primo dato · on: attiva · denied: permesso negato · unsupported: nessun dato dal sensore. */
export type CompassState = 'off' | 'asking' | 'on' | 'denied' | 'unsupported';

const NO_DATA_MS = 4000;
const UPDATE_MS = 100;

type OrientationCtor = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Bussola del telefono, a richiesta (su iPhone il permesso si chiede solo con un tocco). Non usa il GPS e non invia nulla.
 * Restituisce la direzione in gradi (0 = nord, senso orario) solo se il sensore la fornisce davvero.
 */
export function useCompass() {
  const [state, setState] = useState<CompassState>('off');
  const [heading, setHeading] = useState<number | null>(null);
  const stop = useRef<() => void>(() => {});

  const disable = useCallback(() => {
    stop.current();
    stop.current = () => {};
    setHeading(null);
    setState('off');
  }, []);

  const enable = useCallback(async () => {
    stop.current();
    const Ctor = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
    if (!Ctor) {
      setState('unsupported');
      return;
    }
    setState('asking');
    if (typeof Ctor.requestPermission === 'function') {
      try {
        if ((await Ctor.requestPermission()) !== 'granted') {
          setState('denied');
          return;
        }
      } catch {
        setState('denied');
        return;
      }
    }
    let smoothed: number | null = null;
    let shown: number | null = null;
    let last = 0;
    const onEvent = (ev: Event) => {
      const h = readHeading(ev as unknown as OrientationLike);
      if (h === null) return;
      smoothed = smoothAngle(smoothed, h);
      const now = Date.now();
      if (shown === null) clearTimeout(timer);
      if (shown !== null && now - last < UPDATE_MS) return;
      const rounded = Math.round(smoothed) % 360;
      if (rounded === shown) return;
      last = now;
      shown = rounded;
      setHeading(rounded);
      setState('on');
    };
    window.addEventListener('deviceorientationabsolute', onEvent, true);
    window.addEventListener('deviceorientation', onEvent, true);
    const timer = setTimeout(() => {
      if (shown === null) {
        stop.current();
        setState('unsupported');
      }
    }, NO_DATA_MS);
    stop.current = () => {
      clearTimeout(timer);
      window.removeEventListener('deviceorientationabsolute', onEvent, true);
      window.removeEventListener('deviceorientation', onEvent, true);
    };
  }, []);

  useEffect(() => () => stop.current(), []);

  return { state, heading, enable, disable };
}
