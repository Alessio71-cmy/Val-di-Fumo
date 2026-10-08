import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

interface Res {
  url: string;
  bytes: number;
  sha256: string;
  group: 'core' | 'map';
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');

/**
 * Genera dist/precache-manifest.json (URL relativi, dimensione e SHA-256 di ogni file; gruppo "core" o "map")
 * e stampa il BUILD_ID in dist/sw.js. buildId = hash dei file core; packVersion = hash dei file della mappa:
 * se i dati della mappa non cambiano, la cache della mappa resta valida dopo un aggiornamento dell'app.
 */
export function offlinePlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'vdf-offline-manifest',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files = walk(outDir)
        .map((f) => ({ f, url: relative(outDir, f).split(sep).join('/') }))
        .filter(({ url }) => url !== 'sw.js' && url !== 'precache-manifest.json' && !url.endsWith('.map') && !url.split('/').pop()!.startsWith('.'));
      const resources: Res[] = files
        .map(({ f, url }) => {
          const buf = readFileSync(f);
          return { url, bytes: buf.length, sha256: sha(buf), group: (url.startsWith('data/map/') ? 'map' : 'core') as Res['group'] };
        })
        .sort((a, b) => (a.url < b.url ? -1 : 1));
      const hashOf = (g: Res['group']) => sha(resources.filter((r) => r.group === g).map((r) => `${r.url}:${r.sha256}`).join('\n')).slice(0, 12);
      const buildId = hashOf('core');
      const packVersion = hashOf('map');
      const manifest = {
        buildId,
        packVersion,
        generatedAt: new Date().toISOString(),
        totalBytes: resources.reduce((t, r) => t + r.bytes, 0),
        resources,
      };
      writeFileSync(join(outDir, 'precache-manifest.json'), JSON.stringify(manifest, null, 1));
      const swPath = join(outDir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8');
      if (!sw.includes('__BUILD_ID__')) throw new Error('sw.js: segnaposto __BUILD_ID__ non trovato');
      writeFileSync(swPath, sw.replace('__BUILD_ID__', buildId));
      // eslint-disable-next-line no-console
      console.log(`\n[offline] manifest: ${resources.length} risorse, ${(manifest.totalBytes / 1048576).toFixed(2)} MB — buildId ${buildId}, packVersion ${packVersion}`);
    },
  };
}
