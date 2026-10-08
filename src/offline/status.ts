import type { OfflinePackage } from '../domain/types';
import { kvGet } from '../storage/idb';
import { absoluteUrl, coreCacheName, fetchManifest, isManifest, MANIFEST_PATH, mapCacheName, RECORD_KEY } from './manifest';
import { storageEstimate, type OfflineRecord } from './pack';

export type Readiness =
  | 'ready' // tutto presente, verificato su questo dispositivo, service worker attivo
  | 'needs-reload' // tutto in cache ma la pagina non è ancora controllata dal service worker
  | 'partial' // mancano risorse
  | 'none' // mai preparato
  | 'stale' // verifica fatta su una versione diversa da quella installata
  | 'unsupported' // niente service worker/Cache API (es. contesto non sicuro)
  | 'dev'; // build di sviluppo: funzioni offline disattivate

export interface ReadinessInfo {
  state: Readiness;
  reason: string;
  swControlled: boolean;
  installed: OfflinePackage | null;
  record: OfflineRecord | null;
  missing: string[];
  /** true se in rete esiste una versione più recente di quella in esecuzione. */
  updateAvailable: boolean;
  storage: { usage: number; quota: number } | null;
}

/** Manifest della build in esecuzione (salvato nella cache dal service worker). */
export async function readInstalledManifest(cs: CacheStorage = caches, base?: string): Promise<OfflinePackage | null> {
  for (const name of await cs.keys()) {
    if (!name.startsWith('vdf-core-')) continue;
    const cache = await cs.open(name);
    const res = await cache.match(absoluteUrl(MANIFEST_PATH, base));
    if (!res) continue;
    try {
      const json: unknown = await res.clone().json();
      if (isManifest(json) && coreCacheName(json) === name) return json;
    } catch {
      /* continua */
    }
  }
  return null;
}

/** Valutazione rapida (presenza, non hash) a ogni avvio: se il sistema ha svuotato la cache lo stato torna "non pronto". */
export async function evaluateReadiness(opts: { dev?: boolean; cachesImpl?: CacheStorage; controlled?: boolean; base?: string; fetchImpl?: typeof fetch } = {}): Promise<ReadinessInfo> {
  const empty: ReadinessInfo = { state: 'none', reason: '', swControlled: false, installed: null, record: null, missing: [], updateAvailable: false, storage: null };
  const dev = opts.dev ?? import.meta.env.DEV;
  if (dev) return { ...empty, state: 'dev', reason: 'Build di sviluppo: le funzioni offline sono disattivate.' };
  const cs = opts.cachesImpl ?? (typeof caches !== 'undefined' ? caches : undefined);
  const hasSw = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  if (!cs || !hasSw) {
    return { ...empty, state: 'unsupported', reason: 'Questo browser o contesto non supporta service worker/Cache (serve HTTPS).' };
  }
  const controlled = opts.controlled ?? !!navigator.serviceWorker.controller;
  const [installed, record, storage] = await Promise.all([readInstalledManifest(cs, opts.base), kvGet<OfflineRecord>(RECORD_KEY), storageEstimate()]);
  const info: ReadinessInfo = { ...empty, swControlled: controlled, installed, record: record ?? null, storage };
  const latest = await fetchManifest(opts.fetchImpl ?? fetch, opts.base).catch(() => null);
  info.updateAvailable = !!(latest && installed && latest.buildId !== installed.buildId);
  if (!installed) {
    return { ...info, state: 'none', reason: 'Nessun pacchetto installato su questo dispositivo: premi "Prepara il viaggio".' };
  }
  // presenza di tutte le risorse
  const core = await cs.open(coreCacheName(installed));
  const map = await cs.open(mapCacheName(installed));
  const missing: string[] = [];
  for (const r of installed.resources) {
    const hit = await (r.group === 'core' ? core : map).match(absoluteUrl(r.url, opts.base));
    if (!hit) missing.push(r.url);
  }
  info.missing = missing;
  if (missing.length > 0) {
    const onlyMap = missing.every((u) => u.startsWith('data/map/'));
    return { ...info, state: 'partial', reason: onlyMap ? 'Il pacchetto mappa non è stato scaricato (o è stato rimosso dal sistema).' : `Mancano ${missing.length} risorse in cache.` };
  }
  if (!record || record.buildId !== installed.buildId || record.packVersion !== installed.packVersion) {
    return { ...info, state: record ? 'stale' : 'none', reason: record ? 'La verifica risale a una versione precedente: ripeti "Prepara il viaggio".' : 'Risorse presenti ma mai verificate su questo dispositivo.' };
  }
  if (!controlled) return { ...info, state: 'needs-reload', reason: 'Tutto è in cache: chiudi e riapri l’app una volta per attivare l’uso offline.' };
  return { ...info, state: 'ready', reason: 'Pacchetto completo, integro e verificato su questo dispositivo.' };
}
