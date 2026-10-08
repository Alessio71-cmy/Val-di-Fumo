import { readFileSync } from 'node:fs';
import { loadGeo } from '../src/data/loader';
import { buildTrip } from '../src/data/trip';

/** fetch finto che legge da public/ (per usare i dati generati fuori dal browser: test unitari e generazione dei documenti). */
export const fileFetch = (missing: string[] = []) =>
  (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    const name = url.pathname.replace(/^\//, '');
    if (missing.some((m) => name.endsWith(m))) return new Response('not found', { status: 404 });
    try {
      return new Response(new Uint8Array(readFileSync(`public/${name}`)));
    } catch {
      return new Response('not found', { status: 404 });
    }
  }) as typeof fetch;

export async function loadTripFromDisk(missing: string[] = []) {
  const geo = await loadGeo(fileFetch(missing), 'http://localhost/');
  return { geo, ...buildTrip(geo) };
}
