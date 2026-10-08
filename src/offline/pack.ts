import type { OfflinePackage, OfflineResource } from '../domain/types';
import { kvSet } from '../storage/idb';
import { absoluteUrl, coreCacheName, CORE_CACHE_PREFIX, MAP_CACHE_PREFIX, mapCacheName, RECORD_KEY, sumBytes } from './manifest';

export interface VerifyReport {
  ok: boolean;
  checked: number;
  missing: string[];
  corrupted: string[];
  /** Risorse verificate con la sola dimensione perché l'hash non era calcolabile (contesto non sicuro). */
  hashSkipped: boolean;
  bytes: number;
  at: number;
  buildId: string;
  packVersion: string;
}

export interface PackProgress {
  stage: 'download' | 'verify' | 'done';
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
  current?: string;
  failed: string[];
}

export interface OfflineRecord {
  verifiedAt: number;
  buildId: string;
  packVersion: string;
  resources: number;
  bytes: number;
  hashSkipped: boolean;
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const d = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

type Status = 'ok' | 'missing' | 'corrupted';

/** Rilegge la risorsa dalla cache e confronta dimensione ed (se possibile) SHA-256 con il manifest. */
export async function verifyResource(cache: Cache, base: string | undefined, r: OfflineResource, deep: boolean): Promise<{ status: Status; hashSkipped: boolean }> {
  const res = await cache.match(absoluteUrl(r.url, base));
  if (!res) return { status: 'missing', hashSkipped: false };
  if (!deep) return { status: 'ok', hashSkipped: true };
  const buf = await res.clone().arrayBuffer();
  if (buf.byteLength !== r.bytes) return { status: 'corrupted', hashSkipped: false };
  const h = await sha256Hex(buf);
  if (h === null) return { status: 'ok', hashSkipped: true };
  return { status: h === r.sha256 ? 'ok' : 'corrupted', hashSkipped: false };
}

async function caches_(cs: CacheStorage, m: OfflinePackage) {
  return { core: await cs.open(coreCacheName(m)), map: await cs.open(mapCacheName(m)) };
}

/** Verifica di tutte le risorse del manifest (profonda = hash completo). */
export async function verifyAll(m: OfflinePackage, opts: { deep: boolean; cachesImpl?: CacheStorage; base?: string; onProgress?: (p: PackProgress) => void } = { deep: true }): Promise<VerifyReport> {
  const cs = opts.cachesImpl ?? caches;
  const c = await caches_(cs, m);
  const missing: string[] = [];
  const corrupted: string[] = [];
  let hashSkipped = false;
  let done = 0;
  const bytesTotal = sumBytes(m.resources);
  let bytesDone = 0;
  for (const r of m.resources) {
    const cache = r.group === 'core' ? c.core : c.map;
    const v = await verifyResource(cache, opts.base, r, opts.deep);
    if (v.status === 'missing') missing.push(r.url);
    else if (v.status === 'corrupted') corrupted.push(r.url);
    if (v.hashSkipped && opts.deep) hashSkipped = true;
    done++;
    bytesDone += r.bytes;
    opts.onProgress?.({ stage: 'verify', done, total: m.resources.length, bytesDone, bytesTotal, current: r.url, failed: [...missing, ...corrupted] });
  }
  return {
    ok: missing.length === 0 && corrupted.length === 0,
    checked: m.resources.length,
    missing,
    corrupted,
    hashSkipped,
    bytes: bytesTotal,
    at: Date.now(),
    buildId: m.buildId,
    packVersion: m.packVersion,
  };
}

async function fetchOne(r: OfflineResource, cache: Cache, fetchImpl: typeof fetch, base: string | undefined, signal?: AbortSignal): Promise<boolean> {
  const url = absoluteUrl(r.url, base);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) return false;
    try {
      const res = await fetchImpl(url, { cache: 'reload', signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await cache.put(url, res.clone());
      return true;
    } catch {
      await new Promise((ok) => setTimeout(ok, 400 * (attempt + 1)));
    }
  }
  return false;
}

/**
 * "Prepara il viaggio": scarica ogni risorsa del manifest (nucleo + mappa) e poi la VERIFICA rileggendola dalla cache.
 * Lo stato "pronto" viene registrato solo se tutte le risorse indispensabili risultano presenti e integre.
 */
export async function downloadAndVerify(
  m: OfflinePackage,
  opts: { onProgress?: (p: PackProgress) => void; signal?: AbortSignal; fetchImpl?: typeof fetch; cachesImpl?: CacheStorage; base?: string } = {},
): Promise<VerifyReport> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const cs = opts.cachesImpl ?? caches;
  const c = await caches_(cs, m);
  const failed: string[] = [];
  const bytesTotal = sumBytes(m.resources);
  let done = 0;
  let bytesDone = 0;
  // scarica solo ciò che manca o non è integro (nucleo gia' installato dal service worker: verifica rapida)
  for (const r of m.resources) {
    const cache = r.group === 'core' ? c.core : c.map;
    const have = await verifyResource(cache, opts.base, r, true);
    let ok = have.status === 'ok';
    if (!ok) {
      if (have.status === 'corrupted') await cache.delete(absoluteUrl(r.url, opts.base));
      ok = await fetchOne(r, cache, fetchImpl, opts.base, opts.signal);
    }
    if (!ok) failed.push(r.url);
    done++;
    bytesDone += r.bytes;
    opts.onProgress?.({ stage: 'download', done, total: m.resources.length, bytesDone, bytesTotal, current: r.url, failed: [...failed] });
  }
  const report = await verifyAll(m, { deep: true, cachesImpl: cs, base: opts.base, onProgress: opts.onProgress });
  if (report.ok) {
    const rec: OfflineRecord = { verifiedAt: report.at, buildId: m.buildId, packVersion: m.packVersion, resources: m.resources.length, bytes: report.bytes, hashSkipped: report.hashSkipped };
    await kvSet(RECORD_KEY, rec);
    await pruneOldCaches(m, cs);
  }
  opts.onProgress?.({ stage: 'done', done: m.resources.length, total: m.resources.length, bytesDone: bytesTotal, bytesTotal, failed: [...report.missing, ...report.corrupted] });
  return report;
}

/** Elimina le cache di versioni precedenti (dopo che quella corrente è stata verificata). */
export async function pruneOldCaches(m: OfflinePackage, cs: CacheStorage = caches): Promise<string[]> {
  const keep = new Set([coreCacheName(m), mapCacheName(m)]);
  const removed: string[] = [];
  for (const k of await cs.keys()) {
    if ((k.startsWith(CORE_CACHE_PREFIX) || k.startsWith(MAP_CACHE_PREFIX)) && !keep.has(k)) {
      await cs.delete(k);
      removed.push(k);
    }
  }
  return removed;
}

export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e || e.usage === undefined || e.quota === undefined) return null;
    return { usage: e.usage, quota: e.quota };
  } catch {
    return null;
  }
}
