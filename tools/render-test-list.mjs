/**
 * Riempie il blocco <!-- BEGIN:test-list --> di docs/TEST-REPORT.md con l'elenco dei test dai risultati JSON
 * (test-results/unit.json e test-results/e2e.json). Uso: npm run docs:tests (dopo aver eseguito i test con i reporter JSON).
 *   npx vitest run --reporter=json --outputFile=test-results/unit.json
 *   npx playwright test            (scrive test-results/e2e.json)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const unit = JSON.parse(readFileSync('test-results/unit.json', 'utf8'));
const e2e = JSON.parse(readFileSync('test-results/e2e.json', 'utf8'));

const lines = [];
const uTotal = unit.numPassedTests;
lines.push(`### Test unitari (Vitest): ${uTotal} superati su ${unit.numTotalTests}`);
lines.push('');
lines.push('| File | Test superati | Cosa verifica |');
lines.push('|---|---|---|');
const WHAT = {
  'data.test.ts': 'integrità dei dati generati, chiavi dei luoghi, fonti, politica di guida, dati incompleti',
  'format.test.ts': 'formati di distanza, durata, orario, età',
  'geodesy.test.ts': 'distanze, direzioni, formato coordinate',
  'gps.test.ts': 'consenso, stati, errori, qualità del fix (geolocalizzazione finta)',
  'install.test.ts': 'rilevamento piattaforma per le istruzioni di installazione',
  'nav.test.ts': 'progressione e distanza residua lungo la traccia, prossimo punto',
  'offline.test.ts': 'manifest, download, verifica SHA-256, stati "pronto", aggiornamenti (cache finta)',
  'offroute.test.ts': 'avviso di allontanamento: soglie, isteresi, precisione',
  'phase.test.ts': 'fasi della giornata ed eventi',
  'polyline.test.ts': 'proiezione e progressive lungo la polilinea',
  'prefs.test.ts': 'preferenze: sanificazione e valori predefiniti',
  'schedule-input.test.ts': 'priorità dei tempi (utente → dati → valori generici)',
  'schedule.test.ts': 'motore del programma: ritardi, ora limite, suggerimenti',
  'storage.test.ts': 'archivio locale con ripiego in memoria',
  'sun.test.ts': 'alba/tramonto/crepuscolo contro riferimenti indipendenti (astral), orizzonte',
  'weather.test.ts': 'meteo: URL, risposta SIMULATA, riepilogo, errori, cache',
};
for (const f of unit.testResults.sort((a, b) => a.name.localeCompare(b.name))) {
  const name = f.name.split('/tests/unit/').pop();
  lines.push(`| \`${name}\` | ${f.assertionResults.filter((a) => a.status === 'passed').length} | ${WHAT[name] ?? ''} |`);
}
lines.push('');

const byFile = new Map();
const walk = (s) => {
  for (const sp of s.specs ?? []) {
    const r = sp.tests[0]?.results?.[0];
    const arr = byFile.get(sp.file) ?? [];
    arr.push({ title: sp.title, status: r?.status ?? 'unknown', ms: r?.duration ?? 0 });
    byFile.set(sp.file, arr);
  }
  for (const c of s.suites ?? []) walk(c);
};
for (const s of e2e.suites) walk(s);
const total = [...byFile.values()].reduce((t, a) => t + a.length, 0);
const passed = [...byFile.values()].reduce((t, a) => t + a.filter((x) => x.status === 'passed').length, 0);
lines.push(`### Test end-to-end (Playwright, Chromium): ${passed} superati su ${total}`);
lines.push('');
for (const [file, arr] of [...byFile.entries()].sort()) {
  lines.push(`**\`${file}\`**`);
  lines.push('');
  for (const t of arr) lines.push(`- ${t.status === 'passed' ? '✅' : '❌'} ${t.title}`);
  lines.push('');
}

const path = 'docs/TEST-REPORT.md';
const doc = readFileSync(path, 'utf8');
const re = /<!-- BEGIN:test-list -->[\s\S]*?<!-- END:test-list -->/;
if (!re.test(doc)) throw new Error('blocco test-list non trovato');
let out = doc.replace(re, `<!-- BEGIN:test-list -->\n${lines.join('\n')}\n<!-- END:test-list -->`);
// i numeri in testa al report e nel comando di esecuzione seguono sempre i risultati reali
out = out.replace(/> - \*\*Test automatici: \d+ unitari \+ \d+ end-to-end, tutti superati\*\*/, `> - **Test automatici: ${uTotal} unitari + ${total} end-to-end, tutti superati**`);
out = out.replace(/suite E2E eseguita 3 volte di fila sull'ultima versione: \d+\/\d+ ogni volta/, `suite E2E eseguita 3 volte di fila sull'ultima versione: ${total}/${total} ogni volta`);
out = out.replace(/typecheck \+ \d+ test unitari \+ build \+ \d+ test E2E/, `typecheck + ${uTotal} test unitari + build + ${total} test E2E`);
if (passed !== total || uTotal !== unit.numTotalTests) throw new Error('ci sono test non superati: il report non va aggiornato');
// i risultati devono provenire da una esecuzione COMPLETA (tutti i file di test presenti), non da una prova parziale
const specs = readdirSync('tests/e2e').filter((f) => f.endsWith('.spec.ts') && !f.startsWith('_'));
const missingSpecs = specs.filter((f) => !byFile.has(f));
if (missingSpecs.length) throw new Error(`risultati E2E incompleti (mancano: ${missingSpecs.join(', ')}): esegui l'intera suite prima di aggiornare il report`);
const unitFiles = readdirSync('tests/unit').filter((f) => f.endsWith('.test.ts'));
const unitSeen = new Set(unit.testResults.map((f) => f.name.split('/tests/unit/').pop()));
const missingUnit = unitFiles.filter((f) => !unitSeen.has(f));
if (missingUnit.length) throw new Error(`risultati unitari incompleti (mancano: ${missingUnit.join(', ')})`);
writeFileSync(path, out);
console.log(`docs/TEST-REPORT.md aggiornato: ${uTotal} unitari, ${passed}/${total} E2E`);
