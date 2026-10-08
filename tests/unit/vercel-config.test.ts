import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildVercelConfig, parseHeadersFile, toVercelSource } from '../../tools/vercelConfig';

const headersFile = readFileSync('public/_headers', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as ReturnType<typeof buildVercelConfig>;

describe('vercel.json', () => {
  it('è aggiornato rispetto a public/_headers (rigenerare con `npm run vercel-config`)', () => {
    expect(vercel).toEqual(buildVercelConfig(headersFile));
  });

  it('riporta le intestazioni che proteggono l’aggiornamento offline e l’app', () => {
    const find = (source: string) => vercel.headers.find((h) => h.source === source)?.headers ?? [];
    for (const f of ['/sw.js', '/precache-manifest.json', '/index.html', '/manifest.webmanifest', '/data/(.*)']) {
      expect(find(f), f).toContainEqual({ key: 'Cache-Control', value: 'no-cache' });
    }
    expect(find('/assets/(.*)')).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' });
    const all = find('/(.*)');
    const csp = all.find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(all.map((h) => h.key)).toEqual(expect.arrayContaining(['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']));
  });

  it('compila come app statica Vite', () => {
    expect(vercel).toMatchObject({ framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist' });
  });

  it('il lettore di _headers rifiuta righe non valide e converte i caratteri jolly', () => {
    expect(() => parseHeadersFile('  Cache-Control: no-cache')).toThrow();
    expect(toVercelSource('/assets/*')).toBe('/assets/(.*)');
    expect(parseHeadersFile('# commento\n/a\n  X: 1\n  Y: a: b\n')).toEqual([{ path: '/a', headers: [['X', '1'], ['Y', 'a: b']] }]);
  });
});
