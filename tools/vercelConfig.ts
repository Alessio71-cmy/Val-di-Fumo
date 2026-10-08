/**
 * Traduce public/_headers (formato Netlify/Cloudflare) nella configurazione di Vercel (vercel.json): le intestazioni
 * collaudate dai test (CSP, cache del service worker) hanno così una sola fonte e non vengono ricopiate a mano.
 */
export interface HeaderBlock {
  path: string;
  headers: Array<[string, string]>;
}

export function parseHeadersFile(text: string): HeaderBlock[] {
  const blocks: HeaderBlock[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    if (/^\s/.test(raw)) {
      const block = blocks[blocks.length - 1];
      const i = raw.indexOf(':');
      if (!block || i < 0) throw new Error(`_headers: riga non valida "${raw}"`);
      block.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
    } else {
      blocks.push({ path: raw.trim(), headers: [] });
    }
  }
  return blocks;
}

/** "/assets/*" → "/assets/(.*)": la sintassi dei percorsi di Vercel usa gruppi di espressione regolare. */
export const toVercelSource = (path: string) => path.replace(/\*/g, '(.*)');

export function buildVercelConfig(headersFile: string) {
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: 'vite',
    installCommand: 'npm ci',
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
    headers: parseHeadersFile(headersFile).map((b) => ({
      source: toVercelSource(b.path),
      headers: b.headers.map(([key, value]) => ({ key, value })),
    })),
  };
}
