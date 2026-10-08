import type { SafetyNotice } from '../domain/types';

/** Avvisi di sicurezza dell'escursione. Ogni avviso ha fonte e stato di validazione. */
export const SAFETY_NOTICES: SafetyNotice[] = [
  {
    id: 'hut-opening',
    severity: 'warning',
    title: 'Rifugio: apertura il 9 ottobre da confermare',
    body: 'Le schede sono discordanti: Visit Trentino indica "fine maggio – seconda domenica di ottobre" (11/10/2026); altre schede (probabilmente datate) "20 giugno – 30 settembre". Telefona prima di partire (numero riportato da PlanetMountain: (0465) 804107, da verificare). Anche se aperto, non fare affidamento su cibo, acqua o riparo: porta tutto con te.',
    appliesTo: ['rifugio-val-di-fumo'],
    sourceIds: ['vt-rifugio', 'planetmountain-rifugio', 'bergwelten-rifugio', 'ildolomiti-sponsored'],
    validation: 'unverified',
  },
  {
    id: 'light-valley',
    severity: 'warning',
    title: 'In valle il sole sparisce molto prima del tramonto',
    body: 'Dal rilievo (stima ±15–20 min) il sole diretto lascia il rifugio dopo le 17:30 e la diga dopo le 16:30 (9 ottobre): nel fondovalle fa freddo e si vede peggio ben prima del tramonto astronomico. Rispetta l’ultimo orario prudenziale per iniziare il ritorno mostrato in Programma.',
    appliesTo: ['trek-back'],
    sourceIds: ['dem-terrarium', 'astral'],
    validation: 'estimated',
  },
  {
    id: 'parking',
    severity: 'caution',
    title: 'Parcheggio alla diga: accesso regolato e/o a pagamento',
    body: 'Il Parco può regolare l’accesso in alta stagione (prenotazione, numero chiuso, navette dai parcheggi a valle) e il parcheggio è segnalato a pagamento (≈4–6 €, orari di presidio variabili; una fonte del 2020 cita parcometro a sole monete). Non confermato per ottobre 2026: porta monete e verifica con il Parco (0465 806666, info@pnab.it).',
    appliesTo: ['park-dam'],
    sourceIds: ['campiglio-parcheggio', 'ladige-250', 'park4night-bissina'],
    validation: 'unverified',
  },
  {
    id: 'osm-track',
    severity: 'caution',
    title: 'Traccia da OpenStreetMap: non verificata sul campo',
    body: 'Il percorso viene da OpenStreetMap (ultima modifica dei tratti principali: 21/12/2023, alcuni tratti ferma al 2014). Non è stato confrontato con la traccia ufficiale SAT né percorso. Dopo il maltempo ponti o sentieri possono essere cambiati. In caso di dubbio fidati dei segnavia sul terreno, non dell’app.',
    appliesTo: ['route-out', 'route-back'],
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
  },
  {
    id: 'bridges',
    severity: 'caution',
    title: 'Ponti e passaggi sul torrente',
    body: 'Sull’andata il dato OSM contiene 5 tratti-ponte (44 m in totale): due tratti adiacenti sulla pista del lago (probabilmente un unico ponticello) e tre passerelle tra Malga Breguzzo e il rifugio, l’ultima delle quali è il ponte di Malga Val di Fumo. I guadi non sono rappresentati nei dati: se un attraversamento non ti convince, non attraversare.',
    appliesTo: ['route-out'],
    sourceIds: ['osm-overture'],
    validation: 'source-derived',
  },
  {
    id: 'october-mountain',
    severity: 'caution',
    title: 'Ottobre a 1.800–1.950 m',
    body: 'Possibili ghiaccio sul fondo all’ombra, neve fresca, nebbia, vento e temperature vicine allo zero nel pomeriggio. Porta strati caldi, guanti, berretto, giacca antivento/impermeabile e frontale. Consulta il bollettino di Meteo Trentino prima di partire.',
    sourceIds: ['open-meteo'],
    validation: 'estimated',
  },
  {
    id: 'hunting',
    severity: 'caution',
    title: 'Periodo venatorio',
    body: 'Il calendario provinciale 2026–2027 apre in ottobre alcuni prelievi; dentro il Parco il regime è diverso e non verificato. Indossa capi ben visibili, resta sul sentiero e non entrare in zone con cartelli di avviso.',
    sourceIds: ['caccia-2026-27'],
    validation: 'unverified',
  },
  {
    id: 'dogs',
    severity: 'info',
    title: 'Cani',
    body: 'Il Parco raccomanda il guinzaglio negli spazi aperti (cuccioli di ungulati). Il testo normativo non è stato reperito: per sicurezza tienilo al guinzaglio per tutto il percorso.',
    sourceIds: ['pnab-cani'],
    validation: 'unverified',
  },
  {
    id: 'coverage',
    severity: 'warning',
    title: 'La copertura mobile non è garantita',
    body: 'Il 112 usa qualsiasi rete disponibile, ma dove non c’è nessuna copertura una chiamata o un SMS possono non partire. Non contare su una chiamata di emergenza: informa qualcuno del tuo programma e dell’ora di rientro prevista.',
    sourceIds: ['112-trentino'],
    validation: 'unverified',
  },
  {
    id: 'ios-background',
    severity: 'caution',
    title: 'iPhone: il GPS può fermarsi con lo schermo bloccato',
    body: 'Safari e le app aggiunte alla Home non garantiscono il tracciamento continuo quando l’app è sospesa o lo schermo è bloccato. Tieni l’app in primo piano e lo schermo acceso quando ti serve la posizione, controlla l’ora dell’ultimo aggiornamento e usa la modalità risparmio.',
    sourceIds: [],
    validation: 'unverified',
  },
  {
    id: 'water',
    severity: 'info',
    title: 'Acqua',
    body: 'Fontane mappate (Boazzo, rifugio) non sono verificate. Porta almeno 1,5–2 litri a testa.',
    sourceIds: ['osm-overture'],
    validation: 'unverified',
  },
];

export interface EmergencyStep {
  title: string;
  body: string;
}

export const EMERGENCY_STEPS: EmergencyStep[] = [
  {
    title: '1. Fermati e metti in sicurezza',
    body: 'Ferma il gruppo in un punto stabile, lontano da torrente, pendii instabili e passaggi esposti. Valuta persone, freddo, luce residua. Non spostare chi potrebbe avere traumi.',
  },
  {
    title: '2. Chiama il 112 (Numero Unico Emergenze)',
    body: 'Il 112 instrada anche al soccorso alpino e può usare qualsiasi rete mobile disponibile, non solo la tua. Dove non c’è NESSUNA rete non connette. Se non c’è segnale prova a spostarti di poco in un punto aperto, solo se è sicuro. Gli SMS non sono garantiti.',
  },
  {
    title: '3. Cosa dire',
    body: 'Provincia di Trento, comune di Valdaone (Daone), Val di Fumo, sentiero dalla diga di Malga Bissina al Rifugio Val di Fumo. Le coordinate dalla scheda "Dove sono" (lat/lon in gradi decimali e in gradi/minuti), numero e condizioni delle persone, cosa è successo. Resta in linea e rispondi alle domande.',
  },
  {
    title: '4. Se non c’è copertura: segnale di soccorso alpino',
    body: 'Sei segnali (grida, fischi o lampi di torcia) in un minuto, uno ogni 10 secondi; poi un minuto di pausa; ripeti. La risposta sono tre segnali al minuto, uno ogni 20 secondi, con un minuto di pausa. Resta visibile (capi colorati, luce).',
  },
  {
    title: '5. Risparmia energia e calore',
    body: 'Riduci la luminosità, attiva il risparmio energetico, tieni il telefono al caldo vicino al corpo. Copri chi ha freddo con strati e coperta isotermica; isolalo dal suolo.',
  },
  {
    title: '6. App Where ARE U (da installare prima)',
    body: 'App gratuita del 112 che chiama e invia la posizione. Richiede comunque copertura. Installala e verifica che funzioni prima di partire.',
  },
];

export const EMERGENCY_NUMBERS = [
  { label: 'Numero Unico Emergenze (anche soccorso alpino)', value: '112', href: 'tel:112' },
] as const;

/** Contatti da verificare PRIMA di partire (non sono numeri di emergenza). */
export const CONTACTS_TO_VERIFY = [
  { label: 'Rifugio Val di Fumo / SAT (numero da PlanetMountain, da verificare)', value: '(0465) 804107', href: 'tel:+390465804107' },
  { label: 'Parco Naturale Adamello Brenta', value: '0465 806666', href: 'tel:+390465806666' },
  { label: 'SAT Trento (da una sintesi di ricerca, potrebbe essere cambiato)', value: '0461 981871', href: 'tel:+390461981871' },
] as const;

export interface ChecklistItem {
  id: string;
  label: string;
  note?: string;
  group: 'prima' | 'abbigliamento' | 'zaino' | 'sicurezza' | 'auto';
}

export const CHECKLIST: ChecklistItem[] = [
  { id: 'offline', group: 'prima', label: 'Pacchetto offline scaricato e verificato sul MIO telefono', note: 'Lo stato "Pronto offline" è per dispositivo.' },
  { id: 'airplane-test', group: 'prima', label: 'Test in modalità aereo fatto (chiudi e riapri l’app)' },
  { id: 'call-hut', group: 'prima', label: 'Telefonato al rifugio/SAT: aperto il 9/10?' },
  { id: 'call-park', group: 'prima', label: 'Verificato accesso/parcheggio alla diga (Parco 0465 806666)' },
  { id: 'weather', group: 'prima', label: 'Letto il bollettino Meteo Trentino (zero termico, neve, vento)' },
  { id: 'told', group: 'prima', label: 'Avvisato qualcuno del programma e dell’ora di rientro' },
  { id: 'whereareu', group: 'prima', label: 'App "Where ARE U" installata' },
  { id: 'boots', group: 'abbigliamento', label: 'Scarponi da trekking (suola con grip)' },
  { id: 'layers', group: 'abbigliamento', label: 'Strati: maglia tecnica, pile, giacca antivento/impermeabile' },
  { id: 'warm', group: 'abbigliamento', label: 'Berretto, guanti, ghette o calze di ricambio' },
  { id: 'hivis', group: 'abbigliamento', label: 'Capo ben visibile (periodo venatorio)' },
  { id: 'water-bottle', group: 'zaino', label: 'Acqua: almeno 1,5–2 L a testa' },
  { id: 'lunch', group: 'zaino', label: 'Pranzo al sacco e snack (il rifugio può essere chiuso)' },
  { id: 'poles', group: 'zaino', label: 'Bastoncini (facoltativi)' },
  { id: 'sun', group: 'zaino', label: 'Occhiali da sole, crema solare' },
  { id: 'trash', group: 'zaino', label: 'Sacchetto per i rifiuti' },
  { id: 'headlamp', group: 'sicurezza', label: 'Frontale con pile cariche' },
  { id: 'firstaid', group: 'sicurezza', label: 'Kit di primo soccorso' },
  { id: 'blanket', group: 'sicurezza', label: 'Coperta isotermica' },
  { id: 'whistle', group: 'sicurezza', label: 'Fischietto' },
  { id: 'powerbank', group: 'sicurezza', label: 'Power bank e cavo' },
  { id: 'paper', group: 'sicurezza', label: 'Mappa cartacea o stampa della traccia (riserva)' },
  { id: 'coins', group: 'auto', label: 'Monete per il parcheggio' },
  { id: 'fuel', group: 'auto', label: 'Carburante sufficiente (≈175 km a/r)' },
  { id: 'documents', group: 'auto', label: 'Documenti e tessera sanitaria' },
];

export const CHECKLIST_GROUP_LABEL: Record<ChecklistItem['group'], string> = {
  prima: 'Prima di partire',
  abbigliamento: 'Abbigliamento',
  zaino: 'Zaino',
  sicurezza: 'Sicurezza',
  auto: 'Auto',
};

export interface LimitItem {
  title: string;
  body: string;
}

/** Limiti dell'app: dichiarati, non nascosti. */
export const APP_LIMITS: LimitItem[] = [
  { title: 'Non è una guida né una garanzia', body: 'L’app riduce l’incertezza, non la elimina. Le stime (tempi, quote, luce, meteo) non sono garanzie. Decidi sempre in base a ciò che vedi sul terreno.' },
  { title: 'Traccia non verificata sul campo', body: 'Il percorso è derivato da OpenStreetMap, confrontato solo con descrizioni secondarie. Non è stata consultata la traccia ufficiale SAT (accesso bloccato in fase di sviluppo).' },
  { title: 'Nessuna istruzione di svolta', body: 'L’app non ricava indicazioni "gira a destra/sinistra" dalla linea: mostra tappe, punti di attenzione dal dato OSM e direzioni cardinali.' },
  { title: 'GPS in background su iPhone', body: 'Safari e le app aggiunte alla Home non garantiscono il tracciamento continuo con app sospesa o schermo bloccato. Tieni l’app aperta e controlla l’ora dell’ultimo aggiornamento.' },
  { title: 'Precisione del GPS', body: 'In valle stretta o bosco la precisione può peggiorare. Con precisione scarsa l’app non calcola avvisi di allontanamento.' },
  { title: 'Offline per dispositivo', body: 'Un link condiviso non prova che l’app sia installata o pronta offline. Ogni partecipante deve scaricare e verificare sul proprio telefono. Se il sistema svuota la cache lo stato torna "non pronto".' },
  { title: 'Meteo', body: 'Si aggiorna solo con la rete; viene mostrato con data e ora dell’ultimo aggiornamento. Non è una previsione ufficiale: consulta Meteo Trentino.' },
  { title: 'Quote e orizzonte', body: 'Quote e curve di livello vengono da un modello digitale del terreno di ~25 m (errori anche di 20–30 m); il sole diretto in valle è una stima (±15–20 min).' },
  { title: 'Emergenze', body: 'Il 112 non funziona dove non c’è alcuna rete mobile. Non contare sul telefono come unico mezzo di soccorso.' },
  { title: 'Fotografie', body: 'Nessuna fotografia è inclusa (nessuna immagine con licenza verificabile era raggiungibile in fase di sviluppo).' },
];
