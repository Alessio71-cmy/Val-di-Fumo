/**
 * Genera docs/ITINERARIO.md e docs/waypoints.csv dai dati e dai contenuti dell'app (stessa fonte della UI), così il documento
 * non può divergere dall'applicazione e nessuna coordinata viene ricopiata a mano.
 *
 * Uso: npm run docs:itinerary   (esegue questo file con vite-node)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { TRIP_CONFIG } from '../src/config/trip.config';
import { APP_LIMITS, CHECKLIST, CHECKLIST_GROUP_LABEL, CONTACTS_TO_VERIFY, EMERGENCY_NUMBERS, EMERGENCY_STEPS, SAFETY_NOTICES } from '../src/content/safety';
import { SOURCE_BY_ID } from '../src/data/trip';
import { VALIDATION_LABEL } from '../src/domain/validation';
import { fmtClock, fmtDistance, fmtDuration } from '../src/geo/format';
import { formatDegMin } from '../src/geo/geodesy';
import { minutesSinceLocalMidnight, sunTimes } from '../src/geo/sun';
import { buildSchedule } from '../src/schedule/engine';
import { buildScheduleInput } from '../src/schedule/input';
import { DEFAULT_PREFS } from '../src/storage/prefs';
import { loadTripFromDisk } from './diskData';

const { geo, trip, warnings } = await loadTripFromDisk();
if (warnings.length) throw new Error(`dati incompleti: ${warnings.join('; ')}`);

const esc = (s: string | number | undefined | null) => String(s ?? '—').replace(/\|/g, '/').replace(/\n/g, ' ');
const table = (head: string[], rows: Array<Array<string | number | undefined | null>>) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');
const srcList = (ids: string[]) => ids.map((id) => SOURCE_BY_ID[id]?.title ?? id).join('; ');
const coord = (c: [number, number]) => `${c[1].toFixed(5)}, ${c[0].toFixed(5)}`;
const MODE = { auto: 'in auto', piedi: 'a piedi', sosta: 'sosta' } as const;

const ref = trip.points[TRIP_CONFIG.sunReferencePoint];
const [rlon, rlat] = ref?.coordinates ?? [10.5134, 46.052];
const sun = sunTimes(trip.date, rlat, rlon);
const toMin = (ms: number) => minutesSinceLocalMidnight(ms, trip.date, TRIP_CONFIG.timezone);
const sunsetMin = toMin(sun.sunset);
const civilDuskMin = toMin(sun.civilDusk);
const sched = buildSchedule(buildScheduleInput({ prefs: DEFAULT_PREFS, geo, trip, sunsetMin, civilDuskMin }));
const out = trip.routes['route-out']!;
const back = trip.routes['route-back']!;
const bank = trip.routes['route-out-bank']!;

const L: string[] = [];
L.push('# Itinerario documentato — Val di Fumo, 9 ottobre 2026');
L.push('');
L.push('> **Documento generato** da `tools/render-itinerary.ts` a partire dagli stessi dati e testi usati dall\'app: non modificarlo a mano (`npm run docs:itinerary`).');
L.push('> **Stato dei dati:** tutta la geometria è derivata da OpenStreetMap (release Overture 2026-09-23.1) e **non è stata verificata sul campo né confrontata con la traccia ufficiale SAT**. Vedi `docs/01-research-report.md` e `docs/KNOWN-LIMITS.md`.');
L.push('');
L.push('## 1. Panoramica');
L.push('');
L.push(`- **Data:** ${trip.date} (modificabile in \`src/config/trip.config.ts\`).`);
L.push(`- **Partenza:** Pergine Valsugana, tra le ${fmtClock(TRIP_CONFIG.departureWindow.earliestMin)} e le ${fmtClock(TRIP_CONFIG.departureWindow.latestMin)}, in auto.`);
L.push(`- **Percorso a piedi principale:** ${out.name} — **${fmtDistance(out.lengthM)}**, +${out.ascentM} / −${out.descentM} m (quote da DEM, stima), quota ${out.minEleM}–${out.maxEleM} m, tempo nominale ≈ ${fmtDuration(out.nominalMin)} all'andata e ≈ ${fmtDuration(back.nominalMin)} al ritorno (modello calibrato su fonti secondarie).`);
L.push(`- **Variante di sponda opposta:** ${fmtDistance(bank.lengthM)} (${bank.lengthM >= out.lengthM ? '+' : '−'}${Math.abs(Math.round(bank.lengthM - out.lengthM))} m rispetto alla principale).`);
L.push(`- **Luce:** alba ${fmtClock(toMin(sun.sunrise))}, tramonto ${fmtClock(sunsetMin)}, fine crepuscolo civile ${fmtClock(civilDuskMin)} (calcolo astronomico locale). Il sole diretto in valle sparisce prima (stima da rilievo, ±15–20 min).`);
L.push('- **Non inclusi:** Bivacco Segalla e percorsi alpinistici oltre il rifugio.');
L.push('');
L.push('## 2. Tappe');
L.push('');
L.push(table(['#', 'Tappa', 'Modalità', 'Dalla precedente', 'Tempo indicativo', 'Segnavia', 'Stato'], trip.stages.map((s) => [
  s.order, s.name, MODE[s.mode], s.distanceFromPrevM ? fmtDistance(s.distanceFromPrevM) : '—', s.duration.nominal > 0 ? `≈${fmtDuration(s.duration.nominal)} (${fmtDuration(s.duration.min)}–${fmtDuration(s.duration.max)})` : '—', s.waymarks.join(', ') || '—', VALIDATION_LABEL[s.validation],
])));
L.push('');
for (const s of trip.stages) {
  const p = trip.points[s.placeId];
  L.push(`### ${s.order}. ${s.name}`);
  L.push('');
  L.push(`${s.summary}`);
  L.push('');
  L.push(`- **Posizione:** ${p ? `${p.name} — ${coord(p.coordinates)}${p.elevationM ? ` (quota ≈${p.elevationM} m, stima DEM)` : ''}` : 'non disponibile'}`);
  L.push(`- **Modalità / tempo:** ${MODE[s.mode]}${s.duration.nominal > 0 ? `, ≈${fmtDuration(s.duration.nominal)} (${s.duration.basis === 'model' ? 'modello' : s.duration.basis === 'estimated' ? 'stima' : 'da fonte'})` : ''}`);
  L.push(`- **Segnavia da seguire:** ${s.waymarks.join(' · ') || 'nessuno specifico'}`);
  for (const [t, a] of [['Cosa osservare', s.whatToSee], ['Difficoltà e avvertenze', s.difficulties], ['Come proseguire', s.howToContinue], ['Alternative', s.alternatives]] as const) {
    if (a.length) {
      L.push(`- **${t}:**`);
      for (const x of a) L.push(`  - ${x}`);
    }
  }
  L.push(`- **Stato:** ${VALIDATION_LABEL[s.validation]} · verificato il ${s.lastVerified} (verifica a tavolino: nessun controllo sul campo)`);
  L.push(`- **Fonti:** ${srcList(s.sourceIds)}`);
  L.push('');
}
L.push(`## 3. Programma d'esempio (partenza ${fmtClock(DEFAULT_PREFS.departureMin)}, ritmo normale)`);
L.push('');
L.push('Tutti gli orari sono **stime**. L\'app ricalcola l\'intero programma quando cambi partenza, ritmo, tempi di guida o registri gli orari reali.');
L.push('');
L.push(table(['Voce', 'Dalle', 'Alle', 'Durata', 'Base del dato'], sched.entries.map((e) => [e.label, fmtClock(e.plannedStartMin), fmtClock(e.plannedEndMin), e.durationMin > 0 ? fmtDuration(e.durationMin) : '—', e.basis])));
L.push('');
L.push(`- **Ultimo orario prudenziale per iniziare il ritorno:** ${fmtClock(sched.summary.latestReturnStartMin)} (tramonto − ${TRIP_CONFIG.safety.lightMarginMin} min di margine − tempo di ritorno + ${Math.round(TRIP_CONFIG.safety.marginFraction * 100)} % − soste).`);
L.push(`- **Inizio ritorno previsto:** ${fmtClock(sched.summary.projectedReturnStartMin)} → margine ${sched.summary.marginMin >= 0 ? '+' : '−'}${fmtDuration(Math.abs(sched.summary.marginMin))}.`);
L.push(`- **Rientro a Pergine previsto:** ${fmtClock(sched.summary.projectedHomeMin)}.`);
L.push('- I tempi di guida sono stime da distanze stradali OSM con velocità medie assunte, **senza traffico**: sostituiscili con quelli del tuo navigatore (Programma → *Tempi di guida*).');
L.push('');
L.push('## 4. Punti di attenzione sull\'andata (dal dato OSM)');
L.push('');
L.push(table(['Punto', 'Dalla diga', 'Coordinate', 'Dettaglio', 'ID OSM'], trip.criticalPoints.filter((c) => c.routeId === 'route-out').map((c) => [c.label, fmtDistance(c.chainM), coord(c.coordinates), c.detail, c.osmIds.slice(0, 2).join(', ')])));
L.push('');
L.push('## 5. Punti d\'interesse');
L.push('');
L.push(table(['Punto', 'Sul percorso?', 'Coordinate', 'Stato', 'Note'], trip.pois.map((p) => [p.name, p.onRoute ? 'sì' : `deviazione (+${fmtDistance(p.detourM ?? 0)})`, coord(p.coordinates), VALIDATION_LABEL[p.provenance.validation], p.warnings[0] ?? ''])));
L.push('');
L.push('Nessuna fotografia è inclusa: nessuna immagine con licenza verificabile era raggiungibile durante lo sviluppo (vedi `docs/KNOWN-LIMITS.md`).');
L.push('');
L.push('## 6. Database dei waypoint');
L.push('');
L.push('Fonte dei dati: `public/data/geo/points.json` (generato da `scripts/geodata/build_routes.py` con ID OSM). Elenco completo anche in `docs/waypoints.csv`.');
L.push('');
const pts = Object.values(trip.points).sort((a, b) => (a.chainOutM ?? 1e9) - (b.chainOutM ?? 1e9) || a.id.localeCompare(b.id));
L.push(table(['ID', 'Nome', 'Tipo', 'Lat, Lon', 'Quota DEM', 'Dalla diga', 'Stato', 'Verificato il', 'ID OSM'], pts.map((p) => [`\`${p.id}\``, p.name, p.type, coord(p.coordinates), p.elevationM ? `${p.elevationM} m` : '—', p.chainOutM !== undefined && (p.offRouteM ?? 9999) < 1000 ? fmtDistance(p.chainOutM) : '—', VALIDATION_LABEL[p.provenance.validation], p.provenance.lastVerified, p.osmIds.slice(0, 2).join(', ')])));
L.push('');
mkdirSync('docs', { recursive: true });
writeFileSync('docs/ITINERARIO.md', L.join('\n') + '\n');

const csvCell = (v: string | number | undefined | null) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [
  ['id', 'nome', 'tipo', 'lat', 'lon', 'quota_dem_m', 'progressiva_andata_m', 'distanza_dalla_traccia_m', 'stato_validazione', 'affidabilita', 'ultima_verifica', 'ultima_modifica_osm', 'id_osm', 'fonti'],
  ...pts.map((p) => [p.id, p.name, p.type, p.coordinates[1].toFixed(6), p.coordinates[0].toFixed(6), p.elevationM ?? '', p.chainOutM ?? '', p.offRouteM ?? '', p.provenance.validation, p.provenance.reliability, p.provenance.lastVerified, p.provenance.sourceUpdated ?? '', p.osmIds.join(' '), p.provenance.sourceIds.join(' ')]),
]
  .map((r) => r.map(csvCell).join(','))
  .join('\n');
writeFileSync('docs/waypoints.csv', csv + '\n');
// eslint-disable-next-line no-console
console.log(`docs/ITINERARIO.md (${L.length} righe) e docs/waypoints.csv (${pts.length} punti) generati`);

// ---------------------------------------------------------------------------------------------------------------------
// Guida di emergenza stampabile (stessi testi dell'app: src/content/safety.ts)
// ---------------------------------------------------------------------------------------------------------------------
const E: string[] = [];
E.push('# Guida di emergenza — Val di Fumo (da stampare o salvare)');
E.push('');
E.push("> **Documento generato** da `tools/render-itinerary.ts` con gli stessi testi dell'app (sezione *Sicurezza e offline → Emergenze e soccorso*, disponibile anche senza rete dopo la preparazione). Non modificarlo a mano.");
E.push('');
E.push('**Questa guida non promette che una chiamata sia possibile senza copertura.** Il 112 usa qualsiasi rete mobile disponibile, non solo quella del tuo operatore, ma dove non c\'è nessuna rete non si connette. Gli SMS non sono garantiti.');
E.push('');
E.push('## Numeri');
E.push('');
for (const n of EMERGENCY_NUMBERS) E.push(`- **${n.value}** — ${n.label}`);
E.push('');
E.push('## Cosa fare');
E.push('');
for (const st of EMERGENCY_STEPS) {
  E.push(`### ${st.title}`);
  E.push('');
  E.push(st.body);
  E.push('');
}
E.push('## Coordinate dei punti chiave (da OpenStreetMap, ±pochi metri: se hai il GPS usa quelle del telefono)');
E.push('');
const keyIds = ['park-dam', 'malga-breguzzo', 'fall-chiese', 'malga-val-di-fumo', 'rifugio-val-di-fumo', 'park-boazzo-centrale'];
E.push(table(['Punto', 'Gradi decimali', 'Gradi e minuti', 'Dalla diga (lungo il sentiero)'], keyIds.map((id) => {
  const p = trip.points[id];
  if (!p) return [id, 'non disponibile', '—', '—'];
  return [p.name, coord(p.coordinates), formatDegMin(p.coordinates[1], p.coordinates[0]), p.chainOutM !== undefined && (p.offRouteM ?? 9999) < 1000 ? fmtDistance(p.chainOutM) : '—'];
})));
E.push('');
E.push('## Dove sei (da dire al 112)');
E.push('');
E.push('Provincia di Trento, comune di Valdaone (Daone), Val di Fumo. Sentiero dalla diga di Malga Bissina (quota ≈1.800 m) al Rifugio Val di Fumo (≈1.900 m), lungo il Lago di Malga Bissina e il torrente Chiese. La carrozzabile asfaltata finisce alla diga.');
E.push('');
E.push('## Contatti da verificare PRIMA di partire (non sono numeri di emergenza)');
E.push('');
for (const c of CONTACTS_TO_VERIFY) E.push(`- **${c.value}** — ${c.label}`);
E.push('');
E.push('## Avvisi di sicurezza dell\'itinerario');
E.push('');
for (const n of SAFETY_NOTICES) E.push(`- **${n.title}.** ${n.body} _(stato: ${VALIDATION_LABEL[n.validation]})_`);
E.push('');
E.push('## Checklist equipaggiamento');
E.push('');
for (const g of ['prima', 'abbigliamento', 'zaino', 'sicurezza', 'auto'] as const) {
  E.push(`**${CHECKLIST_GROUP_LABEL[g]}**`);
  E.push('');
  for (const i of CHECKLIST.filter((x) => x.group === g)) E.push(`- [ ] ${i.label}${i.note ? ` — ${i.note}` : ''}`);
  E.push('');
}
E.push('## Limiti dell\'app');
E.push('');
for (const l of APP_LIMITS) E.push(`- **${l.title}.** ${l.body}`);
E.push('');
writeFileSync('docs/EMERGENCY.md', E.join('\n'));
// eslint-disable-next-line no-console
console.log('docs/EMERGENCY.md generato');
