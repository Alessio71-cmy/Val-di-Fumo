import type { OfflinePackage, OfflineResource } from '../domain/types';

export const MANIFEST_PATH = 'precache-manifest.json';
export const CORE_CACHE_PREFIX = 'vdf-core-';
export const MAP_CACHE_PREFIX = 'vdf-map-';
export const RECORD_KEY = 'offline:record';

export const coreCacheName = (m: Pick<OfflinePackage, 'buildId'>) => `${CORE_CACHE_PREFIX}${m.buildId}`;
export const mapCacheName = (m: Pick<OfflinePackage, 'packVersion'>) => `${MAP_CACHE_PREFIX}${m.packVersion}`;

export function absoluteUrl(path: string, base?: string): string {
  const b = base ?? (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/');
  return new URL(path, b).toString();
}

export function isManifest(x: unknown): x is OfflinePackage {
  if (typeof x !== 'object' || x === null) return false;
  const m = x as Partial<OfflinePackage>;
  return typeof m.buildId === 'string' && typeof m.packVersion === 'string' && Array.isArray(m.resources) && m.resources.every(
    (r: OfflineResource) => typeof r.url === 'string' && typeof r.bytes === 'number' && typeof r.sha256 === 'string' && (r.group === 'core' || r.group === 'map'),
  );
}

/** Manifest dalla rete (senza cache HTTP). null se non raggiungibile o non valido. */
export async function fetchManifest(fetchImpl: typeof fetch = fetch, base?: string): Promise<OfflinePackage | null> {
  try {
    const res = await fetchImpl(absoluteUrl(MANIFEST_PATH, base), { cache: 'no-store' });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return isManifest(json) ? json : null;
  } catch {
    return null;
  }
}

export const groupOf = (m: OfflinePackage, g: OfflineResource['group']) => m.resources.filter((r) => r.group === g);
export const sumBytes = (rs: OfflineResource[]) => rs.reduce((t, r) => t + r.bytes, 0);
