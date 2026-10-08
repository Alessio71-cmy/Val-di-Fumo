# Fase 1 — Report di ricerca e verifica geografica

**Data della ricerca:** 8 ottobre 2026 — la vigilia dell'escursione prevista (9 ottobre 2026, venerdì).
**Autore:** sessione di sviluppo assistita da Claude. **Nessuna verifica sul territorio è stata eseguita.**

## 0. Sintesi (da leggere per prima)

**Cosa è solido (con i limiti spiegati sotto)**

- La **geometria** dell'itinerario (parcheggio della diga → pista lungo il lago → Malga Breguzzo → sponda del Chiese → Rifugio Val di Fumo) proviene da OpenStreetMap con **ID tracciabili** per ogni tratto e punto. Nessuna coordinata è stata scritta a mano.
- Le misure ricavate (lunghezza 6,10 km, pista del lago 3,49 km, quote, dislivello, tempo nominale) sono **coerenti con le descrizioni delle fonti secondarie** (≈6 km a senso unico, ≈3,5 km di pista, 95–170 m di dislivello, 1,3–2 h). I controlli automatici sono nel §6.
- Esiste davvero un **ritorno sull'altra sponda del torrente** (variante di 6,15 km, 15 % di sovrapposizione).

**Cosa NON è verificato**

1. **Le quattro fonti iniziali del brief (SAT, PNAB, Visit Trentino, Iter) non sono state lette**: l'ambiente di sviluppo ne blocca i domini. Nessuna traccia GPX ufficiale SAT è stata consultata.
2. **Apertura del Rifugio Val di Fumo il 9 ottobre**: le fonti sono discordanti (§3.11). Va confermata per telefono.
3. **Accesso e parcheggio alla diga** (prenotazione, numero chiuso, tariffa, orari di presidio) nel periodo: dato non confermato per ottobre 2026 (§3.3).
4. **Segnavia, bivi, ponti, eventuali guadi, danni da maltempo**: derivati dal dato OSM (ultima modifica della traccia principale: 21/12/2023; alcuni tratti fermi al 2014), mai confrontati con il terreno.
5. **Meteo**: l'app lo recupera sul dispositivo quando c'è rete; non è stato possibile provare il servizio dal vivo in sviluppo.

**Da fare prima di partire (nell'ordine di importanza)**

1. Telefonare al rifugio/SAT per sapere se è aperto il 9/10 (e se il locale invernale è accessibile): numero riportato da PlanetMountain (0465) 804107 — *da verificare, scheda probabilmente datata*; sede SAT Trento 0461 981871 (*da una sintesi, potrebbe essere cambiato*).
2. Parco Naturale Adamello Brenta (tel. 0465 806666, info@pnab.it): regole di accesso alla diga, parcheggio, eventuali chiusure/ordinanze.
3. Bollettino Meteo Trentino per la quota 1800–1950 m (temperatura, zero termico, neve fresca, vento).
4. Portare **monete** (una fonte del 2020 segnala parcometro a sole monete) e capi **ben visibili** (periodo venatorio in provincia).
5. Scaricare, se possibile, la traccia GPX pubblicata da trentino.com o da SAT e **importarla nell'app** (sezione Sicurezza e offline → *Confronta con un'altra traccia*): l'app misura lo scostamento dalla traccia incorporata.

## 1. Metodo e vincoli

### 1.1 Accesso alle fonti

| Fonte richiesta dal brief | Esito |
|---|---|
| sat.tn.it (Rifugio Val di Fumo) | **Bloccata** dalla policy di rete (CONNECT negato) — anche con WebFetch |
| pnab.it (PDF Val di Fumo) | **Bloccata** |
| visittrentino.info (Cascata del Leno) | **Bloccata** |
| iteredizioni.it | **Bloccata** |
| OpenStreetMap / Overpass / Nominatim | **Bloccati** (overpass-api.de, kumi, nominatim) |
| OSRM (tempi di guida), Open-Meteo (meteo) | **Bloccati** da qui |
| OpenTopoMap, tile.openstreetmap.org | Bloccati (e comunque non usabili per download massivo) |
| Wikipedia / Wikimedia Commons | Bloccati → **nessuna fotografia con licenza verificabile** è inclusa |
| **Overture Maps su S3** (dati OSM, ODbL) | **Accessibile** → usato per la geometria |
| **Terrain Tiles su S3** (EU-DEM) | **Accessibile** → quote, ombreggiatura, curve, orizzonte |
| raw.githubusercontent.com, npm, PyPI | Accessibili (testi di licenza, librerie) |
| **WebSearch** | Funziona: restituisce **sintesi** con fonti. Le pagine originali non sono state aperte |

Non ho tentato di aggirare il blocco. Per consultare davvero le fonti ufficiali: *impostazioni dell'ambiente cloud → Network access → aggiungere i domini in "Allowed domains"* (documentazione: <https://code.claude.com/docs/en/cloud-environments#network-access>), poi rieseguire la ricerca.

### 1.2 Principio "nessuna coordinata inventata"

- Ogni punto dell'itinerario è scelto **per ID OSM** (`way`/`node`/`relation`) in `scripts/geodata/build_routes.py`. Se un ID sparisce da una release futura la pipeline **si ferma** invece di sostituirlo.
- Le geometrie sono i vertici OSM dei tratti collegati (nessuna interpolazione manuale); le quote sono campionate dal DEM.
- I documenti e l'app leggono le coordinate dai JSON generati: per questo le tabelle sotto sono *generate* (`scripts/geodata/render_docs.py`).
- Il percorso non è disegnato: è il **cammino minimo sul grafo pedonale OSM** (pesi che penalizzano le strade asfaltate) tra punti scelti per ID, con *via* obbligato da Malga Breguzzo. La variante di sponda è il primo cammino alternativo (Yen) con meno del 25 % di sovrapposizione.

### 1.3 Stati di validazione usati nell'app

| Stato | Significato | Cosa può fare l'app |
|---|---|---|
| `field-verified` | Confermato sul territorio da una persona (con data) | Tutto |
| `official-verified` | Coordinate/geometria da fonte ufficiale (SAT/PNAB/Provincia), con data | Tutto |
| `cross-checked` | Da dato aperto e **coerente con ≥ 2 fonti indipendenti** su misure verificabili | Mostra, progressione e distanza residua *indicative*, avviso soft di allontanamento |
| `source-derived` | Da un'unica fonte aperta (OSM), con controlli di coerenza ma **senza** riscontro ufficiale/sul campo | Mostra, progressione e distanza residua *indicative*, avviso soft di allontanamento **disattivabile**; nessuna istruzione di svolta |
| `estimated` | Stima/modello (tempi di guida, quote DEM, tempi di cammino) | Solo informativo, sempre con la dicitura "stima" |
| `unverified` | Non verificabile | Solo visibile e grigio: **nessuna** guida automatica |

**Stato assegnato oggi a tutta la geometria dell'itinerario: `source-derived`.** Il prodotto più alto raggiungibile senza accesso alle fonti ufficiali sarebbe `cross-checked`, ma le fonti secondarie sono sintesi di ricerca non aperte: non lo dichiaro. Gli scostamenti rispetto alle misure secondarie sono riportati nel §6.

## 2. Itinerario ricostruito

Tutte le coordinate: tabella generata del §6.1. Distanze: §6.2.

| # | Tappa | Dato derivato | Stato |
|---|---|---|---|
| 1 | Pergine Valsugana (partenza, 07:00–08:00) | punto OSM della città | `source-derived` |
| 2 | Boazzo (Cascata del Leno) | Parcheggio presso la Centrale di Boazzo; pista sulla sponda ovest del lago per 345 m fino al ponte alla base della cascata | `source-derived` |
| 3 | Diga di Malga Bissina | Parcheggio presso il Bar alla Diga (esiste un secondo parcheggio più in alto) | `source-derived` |
| 4 | Pista lungo il Lago di Malga Bissina | 3,49 km sulla sponda NO, fondo sterrato | `source-derived` |
| 5 | Malga Breguzzo | edificio OSM (fonte secondaria: malga **non più in uso**, senza servizi) | `source-derived` |
| 6 | Cascata sul Chiese | un solo nodo OSM, 19 m dal tracciato, subito a monte di Malga Breguzzo | `source-derived` |
| 7 | Rifugio Val di Fumo | edificio OSM; fontana mappata accanto | `source-derived` |
| 8 | Ritorno alla diga | stessa traccia (default) o sponda opposta (variante) | `source-derived` |
| 9 | Rientro a Pergine | modello di guida | `estimated` |

## 3. Verifiche richieste dal brief, una per una

**3.1 Coordinate GPS di parcheggi, cascate, malghe, ponti, bivi, rifugio.** Ottenute da OSM con ID (tabella §6.1). Nessuna da fonte ufficiale. Quote da DEM (±20–30 m). *Esito: parziale — coordinate tracciabili ma non confermate sul campo.*

**3.2 Accessibilità in automobile alla Cascata del Leno e alla diga.** La rete OSM mostra la SP27 ("Strada Provinciale 27 di Daone") asfaltata fino ai parcheggi presso la diga; una fonte secondaria colloca la fine della strada al lago di Bissina e la diga a 1.790 m. Per il Leno una fonte secondaria indica il parcheggio centrale di Boazzo a ~20 minuti d'auto da Daone. *Esito: plausibile; nessuna ordinanza consultata.*

**3.3 Chiusure stradali, pedaggi, limitazioni stagionali.** Segnalazioni **non confermate per ottobre 2026**:
- parcheggio alla diga **a pagamento** (4–6 € per auto nelle fonti; orari di presidio variabili; una fonte del 2020 riferisce parcometro a **sole monete**);
- **accesso regolato** dal Parco in alta stagione (tetto di auto/prenotazione, navetta dai parcheggi più a valle quando la diga è piena; l'articolo sul "numero chiuso 250" risale al periodo Covid);
- **chiusura invernale** per neve (esistono comunicati della Provincia su divieti di transito in Valle di Daone); stagione del parcheggio citata ~1 maggio–30 ottobre;
- un aneddoto riferisce parcheggio gratuito fuori stagione.
*Esito: **non verificato**. Contattare il Parco (0465 806666, info@pnab.it) e consultare la pagina mobilità di Campiglio Dolomiti (vedi SOURCES.md).*

**3.4 Percorso pedonale dalla Centrale di Boazzo alla Cascata del Leno.** Dal parcheggio presso la Centrale una pista sulla sponda ovest del lago porta in **345 m** al ponte dove il torrente Leno entra nel lago (fonte secondaria: ~5 minuti a piedi fino alla base: **coincide**). Il nodo OSM "Cascata del Leno" è invece nella parte **alta** (quota DEM ~1.430 m, ~190 m sopra il parcheggio): per raggiungerlo servono 1,15 km e circa +250 m di salita ripida (sentiero tipo SAT 246 secondo una fonte secondaria, "poco più di un'ora" fino alla sommità). **Scelta di prodotto: la sosta fotografica è al ponte alla base; la salita è mostrata solo come informazione, non guidata.** Il ponte alla base è stato *inferito* come il tratto marcato `ponte` più vicino al nodo della cascata (178 m): **da verificare**.

**3.5 Tracciato del sentiero SAT 240.** Overture non include le relazioni dei sentieri: il numero 240 **non è identificabile per attributo**. La traccia incorporata è il cammino che la geometria suggerisce (pista del lago → Malga Breguzzo → sponda del Chiese → rifugio). Le fonti secondarie dicono: 240 dopo il primo tornante sotto il parcheggio (con scorciatoia a piedi), segnavia 240 oltre Malga Breguzzo, e una fonte cita il **222** per l'ultimo tratto fino al colle del rifugio. *Esito: coerente per lunghezza/quote/tempi; numeri dei segnavia da verificare in loco.*

**3.6 Collocazione della cascata del Chiese.** Un nodo OSM senza nome (`n965276885`) a 19 m dal tracciato e ~145 m a monte di Malga Breguzzo. Fonti secondarie (Komoot, tramite ricerca) citano una cascata presso Malga Breguzzo all'inizio della Val di Fumo **e** una cascatella prima di un ponte in legno più vicino al rifugio (non localizzata). *Esito: una candidata plausibile; l'altra non localizzata; nessuna conferma ufficiale.*

**3.7 Ritorno sull'altra sponda del torrente.** Esiste: variante di 6,15 km (+49 m) con 15 % di sovrapposizione, sponda SE tra Malga Breguzzo e il ponte di Malga Val di Fumo. Una fonte secondaria dice che a Breguzzo si può scegliere la sponda e che la maggioranza prende la "sinistra": **ambiguo** (sinistra orografica ≠ sinistra del verso di marcia), quindi l'app usa punti cardinali. *Il ritorno predefinito è la stessa traccia dell'andata (già vista, più semplice); la variante è facoltativa.*

**3.8 Attraversamenti, ponti, difficoltà.** Sull'andata il dato OSM contiene **5 tratti-ponte** (44 m in totale): tabella §6.3. Overture **non rappresenta i guadi**: l'eventuale presenza di guadi/passaggi su pietre non è escludibile. Difficoltà: classificazioni discordanti (T / E / EE); la scheda più concreta indica **E**.

**3.9 Lunghezza, dislivello, tempi.** Andata 6,10 km, +162/−54 m (DEM), tempo nominale ~99 min andata e ~91 min ritorno (modello di Tobler calibrato ×1,2 sulle fonti: 78–120 min). Un giro completo ha richiesto 3 h 40 (12,3 km a/r) in una rilevazione citata. *Stime, non garanzie.*

**3.10 Orari di luce e meteo.** Alba e tramonto sono calcolati in locale (NOAA) e confrontati con una libreria indipendente (§6.5). Il **sole diretto sul fondovalle sparisce molto prima del tramonto** (stima da rilievo). Meteo: recuperato a runtime da Open-Meteo e memorizzato con data/ora; **non testato dal vivo**.

**3.11 Apertura stagionale del Rifugio Val di Fumo.** Fonti **discordanti**:
- Visit Trentino: dalla fine di maggio alla **seconda domenica di ottobre = 11 ottobre 2026**, con invito a sentire il gestore;
- PlanetMountain: 20 giugno–30 settembre; Bergwelten: giugno–settembre (**entrambe citano il gestore precedente → probabilmente datate**);
- articolo sponsorizzato 2026: "da fine primavera a inizio autunno".
Nuova gestione dal 2026 (Michela Foresti); 57 posti letto, di cui **6 nel locale invernale** (fonte secondaria). *Il 9 ottobre potrebbe essere aperto o appena chiuso: non assumerlo. Telefonare.*

## 4. Discordanze tra fonti (da non nascondere)

| Dato | Valori riportati | DEM / calcolo | Come lo tratto |
|---|---|---|---|
| Quota rifugio | 1.887 / 1.918 m | 1.896 m | mostrato come "≈1.900 m (fonti 1.887–1.918)" |
| Quota parcheggio diga | 1.790–1.847 m | 1.807 m | "≈1.800 m" |
| Dislivello andata | 95–170 m | +162 m | "≈100–160 m (stima)" |
| Tempo diga→rifugio | 78–120 min | 99 min | nominale 100 min, range 80–120 |
| Difficoltà | T / E / EE | — | "E (classificazioni discordanti)" |
| Altezza cascata del Leno | 150 m / 300 m | — | non mostrata come dato |
| Tariffa parcheggio | 4 / 5 / 6 € | — | "circa 4–6 € (da verificare)" |

## 5. Decisioni di prodotto derivate

1. **Nessuna istruzione di svolta** inventata dalla polilinea: l'app mostra tappe, **punti di attenzione** (bivi/ponti dal dato OSM, con direzioni cardinali) e testi descrittivi etichettati con fonte e stato.
2. **Badge permanente** "Traccia da OpenStreetMap — non verificata sul campo" accanto a distanza/progresso; avviso di allontanamento solo con precisione adeguata, soglie larghe, isteresi e **disattivabile**.
3. **Il rifugio non è un riparo né un ristoro garantito**: programma e sicurezza non dipendono da esso (pranzo al sacco, acqua, strati caldi).
4. **Bivacco Segalla e percorsi oltre il rifugio esclusi** dal percorso principale. La *Piana della Val di Fumo* (oltre il rifugio) è solo un punto d'interesse con deviazione, senza traccia guidata.
5. **Importazione GPX** per sostituire/confrontare la traccia con una ufficiale scaricata dall'utente (dopo aver sbloccato la rete o da casa).
6. **Fotografie**: nessuna immagine inclusa (nessuna con licenza verificabile era raggiungibile); le schede usano rilievo/mappa e suggerimenti fotografici di carattere generale.

## 6. Allegati generati dai dati

### 6.1 Punti (coordinate lette dall'estrazione OSM)

<!-- BEGIN:points -->
| ID | Nome in OSM | Lat | Lon | Quota DEM (m) | ID OSM | Ult. modifica OSM | Progressiva andata | Distanza dalla traccia |
|---|---|---|---|---|---|---|---|---|
| `park-dam` | — | 46.05205 | 10.51341 | 1807 | `w82897607@5` | 2017-07-29 | 0 m | 27 m |
| `park-dam-alt` | — | 46.05093 | 10.51065 | 1860 | `w82897614@8` | 2023-09-03 | 0 m | 266 m |
| `toilets-dam` | — | 46.05150 | 10.51146 | 1857 | `w506258604@2` | 2017-07-28 | 0 m | 184 m |
| `dam-bissina` | Diga di Malga Bissina | 46.05359 | 10.51890 | 1766 | `r4557683@3` | 2020-08-10 | 230 m | 385 m |
| `fall-lakeside` | — | 46.05812 | 10.51331 | 1863 | `n1111843019@2` | 2017-07-28 | 756 m | 66 m |
| `lake-bissina` | Lago di Malga Bissina | 46.06186 | 10.52667 | 1765 | `r4557684@3` | — | 1794 m | 338 m |
| `malga-breguzzo` | Malga Breguzzo | 46.07093 | 10.54056 | 1810 | `w60145454@4` | 2018-03-19 | 3494 m | 8 m |
| `sign-breguzzo` | Malga di Breguzzo | 46.07117 | 10.54074 | 1812 | `n5000770915@2` | 2017-10-07 | 3531 m | 5 m |
| `fall-chiese` | — | 46.07170 | 10.54152 | 1814 | `n965276885@2` | 2013-10-06 | 3639 m | 19 m |
| `malga-val-di-fumo` | Malga Val di Fumo | 46.08354 | 10.55844 | 1884 | `n5000770909@2` | 2017-10-05 | 5699 m | 0 m |
| `fountain-rifugio` | — | 46.08443 | 10.56267 | 1900 | `n5000770906@3` | 2021-10-27 | 6091 m | 1 m |
| `piana-val-di-fumo` | Piana della Val di Fumo | 46.09053 | 10.56662 | 1899 | `n5035244590@3` | 2025-09-21 | 6096 m | 738 m |
| `rifugio-val-di-fumo` | Rifugio Val Di Fumo | 46.08449 | 10.56253 | 1896 | `w82967465@6` | 2023-06-26 | 6096 m | 14 m |
| `bridge-leno` | — | 46.00334 | 10.51151 | 1205 | `w228119292@4`, `w228119295@2` | — | — | — |
| `dam-boazzo` | Diga Malga Boazzo | 45.99640 | 10.52330 | 1235 | `r4557593@2` | 2015-06-14 | — | — |
| `fall-leno` | Cascata del Leno | 46.00332 | 10.50922 | 1431 | `n3011054285@2` | 2025-08-20 | — | — |
| `lake-boazzo` | Lago di Malga Boazzo | 46.00266 | 10.51637 | 1205 | `r3953956@11` | — | — | — |
| `park-boazzo-centrale` | — | 46.00633 | 10.51219 | 1237 | `n3759967757@2` | 2017-12-24 | — | — |
| `park-boazzo-nord` | — | 46.01011 | 10.51376 | 1240 | `n2989519691@1` | 2014-07-31 | — | — |
| `pergine` | Pergine Valsugana | 46.06053 | 11.24067 | — | `n64776659@22`, `r46718@14` | 2026-08-28 | — | — |
| `view-leno` | — | 46.00318 | 10.50938 | 1418 | `n2371177775@1` | 2013-07-02 | — | — |
| `water-boazzo` | — | 46.01208 | 10.52039 | 1527 | `n2376443057@1` | 2013-07-06 | — | — |
<!-- END:points -->

### 6.2 Percorsi calcolati

<!-- BEGIN:routes -->
| ID | Nome | Lunghezza | Dislivello (stima DEM) | Quote | Tempo nominale (modello) | Modifiche OSM (min … max) |
|---|---|---|---|---|---|---|
| `route-out` | Andata: parcheggio diga → Malga Breguzzo → Rifugio Val di Fumo | 6.10 km | +162 / −54 m | 1791–1899 m | 99 min | 2014-02-13 … 2023-12-21 |
| `route-out-bank` | Variante andata: sponda opposta del Chiese (Breguzzo → ponte di Malga Val di Fumo) | 6.15 km | +160 / −54 m | 1791–1899 m | 99 min | 2017-07-28 … 2023-09-27 |
| `route-back` | Ritorno: Rifugio Val di Fumo → parcheggio diga (stessa traccia) | 6.10 km | +54 / −162 m | 1791–1899 m | 91 min | 2014-02-13 … 2023-12-21 |
| `route-back-bank` | Variante ritorno: sponda opposta del Chiese (rifugio → Malga Breguzzo → diga) | 6.15 km | +54 / −160 m | 1791–1899 m | 91 min | 2017-07-28 … 2023-09-27 |
| `walk-leno` | Passeggiata al ponte alla base della Cascata del Leno (da parcheggio Centrale di Boazzo) | 0.34 km | +30 / −64 m | 1203–1268 m | 14 min | 2025-08-20 … 2025-08-20 |
| `walk-leno-nord` | Passeggiata al ponte alla base della Cascata del Leno (da parcheggio nord) | 0.86 km | +47 / −86 m | 1203–1268 m | 24 min | 2025-08-20 … 2026-05-04 |
| `walk-leno-top` | Estensione ripida (facoltativa, NON guidata): fino al nodo OSM alla sommita' della cascata | 1.15 km | +253 / −66 m | 1198–1423 m | 48 min | 2023-07-01 … 2025-08-20 |
<!-- END:routes -->

### 6.3 Tratti-ponte lungo l'andata

<!-- BEGIN:bridges -->
| Progressiva andata | Lunghezza | Posizione | ID OSM |
|---|---|---|---|
| 735 m | 8 m | 46.05792, 10.51414 | w38564823@8, w511165933@1 |
| 748 m | 8 m | 46.05803, 10.51416 | w38564823@8, w511165933@1 |
| 3582 m | 11 m | 46.07165, 10.54087 | w232215958@3 |
| 4701 m | 5 m | 46.07815, 10.55030 | w240878912@3 |
| 5710 m | 12 m | 46.08342, 10.55849 | w1114890567@1 |
<!-- END:bridges -->

### 6.4 Bivi lungo l'andata (dal dato OSM)

<!-- BEGIN:junctions -->
| Progressiva andata | Posizione | Rami che si staccano dalla traccia (direzione, tipo, lunghezza) |
|---|---|---|
| 269 m | 46.05397, 10.51394 | E service 569 m |
| 493 m | 46.05578, 10.51376 | SO track 146 m |
| 3040 m | 46.07132, 10.53547 | NE track 147 m |
| 3142 m | 46.07134, 10.53672 | NO track 147 m |
| 5016 m | 46.08008, 10.55288 | N path 121 m |
| 5129 m | 46.08107, 10.55287 | SO path 121 m |
| 5701 m | 46.08355, 10.55846 | O path 5014 m; NE path 304 m; S path 509 m |
| 5896 m | 46.08359, 10.56069 | S path 91 m |
| 6047 m | 46.08429, 10.56221 | NO path 76 m; SO path 230 m |
| 6093 m | 46.08445, 10.56270 | E path 47 m |
<!-- END:junctions -->

### 6.5 Alba, tramonto e sole diretto stimato — 9 ottobre 2026

Calcolo di riferimento con la libreria `astral` e profilo dell'orizzonte da DEM (`build_horizon.py`). L'app ricalcola in locale con una propria implementazione, verificata contro questi riferimenti (vedi `tests/`).

<!-- BEGIN:sun -->
| Punto | Alba (CEST) | Tramonto (CEST) | Fine crepuscolo civile | Sole diretto stimato dal rilievo (±15–20 min) |
|---|---|---|---|---|
| Parcheggio Centrale di Boazzo (Leno) | 07:26 | 18:42 | 19:13 | 09:18–15:24 |
| Parcheggio diga Malga Bissina | 07:26 | 18:42 | 19:13 | 09:30–16:42 |
| Malga Breguzzo | 07:26 | 18:42 | 19:13 | 10:22–17:38 |
| Rifugio Val di Fumo | 07:26 | 18:42 | 19:13 | 10:40–17:42 |
<!-- END:sun -->

### 6.6 Controlli di coerenza automatici

<!-- BEGIN:validation -->
| Controllo | Valore | Atteso (fonti secondarie) | Esito | Nota |
|---|---|---|---|---|
| snap:park-dam | 26.9 m | ≤ soglia | OK | classe path |
| snap:malga-breguzzo | 7.9 m | ≤ soglia | OK | classe path |
| snap:rifugio-val-di-fumo | 13.6 m | ≤ soglia | OK | classe path |
| ponte Leno: distanza dal nodo cascata (m) | 178 | 0–450 | OK | Ponte alla base scelto come tratto is_bridge piu' vicino al nodo OSM della cascata |
| snap:park-boazzo-centrale | 9.9 m | ≤ soglia | OK | classe service |
| snap:park-boazzo-nord | 9.5 m | ≤ soglia | OK | classe tertiary |
| snap:park-boazzo-centrale | 9.9 m | ≤ soglia | OK | classe service |
| snap:fall-leno | 16.4 m | ≤ soglia | OK | classe path |
| lunghezza andata (m) | 6095.6 | 5500–6600 | OK | Fonti secondarie: ~6 km a senso unico; 12,3 km a/r (portale Trentino); 3,5 km pista del lago fino a Malga Breguzzo |
| pista lago fino a Malga Breguzzo (m) | 3494.0 | 3000–3900 | OK | Fonte secondaria: ~3,5 km |
| tempo andata modello Tobler (min) | 98.9 | 70–120 | OK | Fonti secondarie: 1,3 h (78') / 1,5-1,75 h / 1h45 / 1,5-2 h per diga->rifugio |
| dislivello positivo andata (m) | 162 | 60–220 | OK | Fonti secondarie: 95-170 m |
| quota rifugio da DEM (m) | 1896.0 | 1870–1940 | OK | Fonti secondarie: 1887 / 1918 m |
| quota Malga Breguzzo da DEM (m) | 1810.0 | 1790–1850 | OK | Fonte secondaria: 1826 m |
| quota parcheggio diga da DEM (m) | 1807.0 | 1780–1870 | OK | Fonti secondarie: 1790-1847 m |
| distanza cascata Chiese dal percorso (m) | 19 | 0–80 | OK | Attesa vicino a Malga Breguzzo |
| lunghezza passeggiata Leno al ponte (m) | 345.0 | 150–700 | OK | Fonte secondaria: ~5 min a piedi dal parcheggio al ponte alla base |
| lunghezza totale tratti-ponte sull'andata (m) | 44 | 0–200 | OK | I ponti sono brevi: un valore alto indicherebbe l'errore dei flag senza intervallo |
| lunghezza variante sponda (m) | 6145.2 | 5486–7315 | OK | Sponda opposta, lunghezza simile |
<!-- END:validation -->

## 7. Tempi di guida (stime di modello)

File: `public/data/geo/drive.json`. Distanze dalla rete stradale OSM; tempo = distanza / velocità media assunta per classe (+10 %). Non includono traffico né soste.

| Tratto | Distanza | Strade principali | Tempo nominale | Intervallo |
|---|---|---|---|---|
| Pergine → parcheggio Centrale di Boazzo | 83,0 km | SS47, SS45bis, SS237, SP27 | 1 h 50 | 1 h 30 – 2 h 25 |
| Boazzo → parcheggio diga | 8,4 km | SP27 | 20 min | 15 – 30 min |
| Parcheggio diga → Pergine | 90,6 km | SP27, SS237, SS45bis, SS47 | 2 h 05 | 1 h 45 – 2 h 45 |

## 8. Cosa resta da verificare sul territorio

Vedi `docs/FIELD-CHECKLIST.md`.
