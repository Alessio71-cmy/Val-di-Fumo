/**
 * Genera vercel.json da public/_headers. Uso: npm run vercel-config   (esegue questo file con vite-node)
 * Il test tests/unit/vercel-config.test.ts verifica che il file generato sia aggiornato.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { buildVercelConfig } from './vercelConfig';

const config = buildVercelConfig(readFileSync('public/_headers', 'utf8'));
writeFileSync('vercel.json', `${JSON.stringify(config, null, 2)}\n`);
console.log(`vercel.json aggiornato: ${config.headers.length} regole di intestazione`);
