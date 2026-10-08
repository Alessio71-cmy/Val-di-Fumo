# Report dei test

**Data:** 8 ottobre 2026 (vigilia dell'escursione). **Eseguiti da:** sessione di sviluppo assistita da Claude.

> ## Lettura in 30 secondi
>
> - **Test automatici: 173 unitari + 64 end-to-end, tutti superati** (da installazione pulita; suite E2E eseguita 3 volte di fila: 64/64 ogni volta, nessun test instabile nell'ultima versione).
> - **Nessun test su dispositivo fisico è stato eseguito.** Non c'erano iPhone, secondo telefono, modalità aereo reale né GPS reale. Quindi i test obbligatori n. **2** (installazione su iPhone) e n. **3** (secondo dispositivo) sono **NON ESEGUITI**, e i n. **5, 6, 9** sono solo **SIMULATI** su Chromium.
> - Il browser provato è **solo Chromium** (Playwright). **Safari/WebKit (iPhone) e Firefox non sono stati provati.**
> - Il meteo (Open-Meteo) **non è stato provato dal vivo** (host bloccato dall'ambiente); la risposta è simulata.
> - Le quattro fonti ufficiali del brief **non sono state lette**: nessun test può dire che la traccia coincida con quella ufficiale SAT.
>
> I test provano che **il software fa ciò che dichiara**; non provano che il sentiero reale coincida con la traccia né che il telefono di ciascuno si comporti come Chromium. La giornata di domani è la vera prova: vedi [FIELD-CHECKLIST.md](FIELD-CHECKLIST.md).

## 1. Categorie usate in questo report

| Categoria | Cosa significa |
|---|---|
| **AUTOMATICO** | Test ripetibile da comando (`npm test`, `npm run test:e2e`) che prova una logica o un comportamento in un browser/ambiente reale (Chromium) senza aiuti finti oltre a quelli indicati. |
| **SIMULATO** | Test automatico in cui una condizione reale è **sostituita da un'emulazione**: rete spenta con `setOffline`, "chiusura e riapertura" con un profilo browser ricreato, GPS con `setGeolocation` o override di `navigator.geolocation`, orologio finto, user agent iPhone su Chromium, evento `beforeinstallprompt` sintetico, risposta meteo registrata. Prova la **logica dell'app**, non l'hardware né il sistema operativo. |
| **FISICO** | Prova su un dispositivo reale, all'aperto. **Nessuna eseguita.** |

## 2. Come rieseguire

```bash
npm ci
npx playwright install chromium   # se manca
npm run test:all                  # typecheck + 173 test unitari + build + 64 test E2E (≈ 3 minuti)
```

I risultati strutturati vengono scritti in `test-results/` (non versionata); le schermate a più dimensioni in `test-results/screens/`.

## 3. Ambiente di prova

- Linux in container, Node 22.22, Vite 5.4 (build di **produzione**, servita da `vite preview` su `127.0.0.1:4173`, secure context).
- **Chromium 141** (build di Playwright 1.56.1), headless, profilo "Pixel 7" (412×915, touch); WebGL tramite SwiftShader (software).
- Rete esterna **limitata dall'ambiente**: Open-Meteo, SAT, PNAB, Visit Trentino, Iter Edizioni, Wikimedia, OpenStreetMap/Overpass non raggiungibili. Per questo il meteo e le fonti ufficiali non sono stati provati.

## 4. I 20 test obbligatori del brief

| # | Test obbligatorio | Categoria | Esito | Dove / come | Cosa **non** prova |
|---|---|---|---|---|---|
| 1 | Apertura dell'app online | AUTOMATICO | **Superato** | Tutte le specifiche E2E aprono la build di produzione; `a11y`, `content`, `pwa`. | Apertura da un telefono reale e da un URL pubblico (nulla è pubblicato). |
| 2 | Installazione su iPhone | — | **NON ESEGUITO** | Verificati in automatico solo manifest valido, icone con le dimensioni dichiarate, meta iOS, testi di guida (UA iPhone emulato). `pwa.spec.ts` | Qualsiasi comportamento di iOS/Safari: "Aggiungi alla schermata Home", memoria separata, service worker su WebKit. |
| 3 | Installazione su un secondo dispositivo | — | **NON ESEGUITO** | Lo stato offline è per dispositivo (IndexedDB e Cache Storage locali): un contesto browser vergine parte sempre da "non pronto" (`pwa.spec.ts`). | Un secondo telefono vero. |
| 4 | Download delle risorse offline | AUTOMATICO | **Superato** | "Prepara il viaggio" scarica 28 risorse (3,6 MB), rilegge dalla cache e confronta dimensione e SHA-256; la cache contiene davvero le risorse del manifest. `offline.spec.ts`, `pwa.spec.ts`; logica con cache finta in `offline.test.ts` (17 test: corruzione, hash con stessa dimensione, 404, pulizia versioni, stati). | Rete mobile reale, spazio insufficiente, interruzioni a metà download. |
| 5 | Attivazione della modalità aereo | **SIMULATO** | **Superato (simulazione)** | `BrowserContext.setOffline(true)`. `offline.spec.ts` | La vera modalità aereo (radio spente, GPS assistito). |
| 6 | Chiusura e riapertura dell'app | **SIMULATO** | **Superato (simulazione)** | Profilo browser persistente chiuso e riaperto **già offline**: l'app si apre, "Offline pronto", mappa, punti, emergenza. `offline.spec.ts` | Chiusura dal selettore delle app di iOS/Android, sfratto della cache da parte del sistema. |
| 7 | Consultazione della mappa offline | AUTOMATICO (offline simulato) | **Superato** | Mappa WebGL pronta senza rete (`data-ready`), ≥ 5 marker, nessun avviso pacchetto assente; ripiego SVG se manca WebGL o va perso il contesto o manca il pacchetto. `offline.spec.ts`, `data.spec.ts`, `map.spec.ts` | Resa su schermi reali, memoria dei telefoni, WebGL su iOS. |
| 8 | Consultazione dei waypoint offline | AUTOMATICO (offline simulato) | **Superato** | "Elenco punti" (5 punti con distanze e coordinate), Percorso (9 tappe), Esplora, guida di emergenza offline. `offline.spec.ts`, `content.spec.ts` | — |
| 9 | Acquisizione della posizione GPS senza dati mobili, in condizioni adeguate | **SIMULATO** | **Superato (simulazione)** | Consenso esplicito, posizione con precisione, distanze lungo la traccia con **rete spenta** e geolocalizzazione emulata. `offline.spec.ts`, `gps.spec.ts` | **Il ricevitore GPS di un telefono, il primo fix senza assistenza di rete, la precisione reale in valle stretta, iPhone con schermo bloccato.** |
| 10 | Gestione del GPS non disponibile | **SIMULATO** | **Superato (simulazione)** | Permesso negato (reale in Chromium senza permesso), `POSITION_UNAVAILABLE`, timeout, geolocalizzazione assente, precisione scarsa (±160 m), posizione obsoleta (> 120 s, orologio finto): messaggi chiari, nessun dato inventato, app utilizzabile. `gps.spec.ts` | Comportamento dei vari sistemi operativi. |
| 11 | Simulazione di posizione fuori percorso | **SIMULATO** | **Superato** | 200 m fuori traccia: nessun avviso al primo fix; avviso sobrio dopo ≥ 3 fix e > 30 s (`role=status`, nessun allarme); sparisce al rientro; con precisione scarsa non scatta; disattivabile. `gps.spec.ts` (≈ 40 s reali); logica in `offroute.test.ts`. | Oscillazioni reali del GPS in bosco/valle. |
| 12 | Aggiornamento dell'orario di partenza | AUTOMATICO | **Superato** | Slider 07:00–08:00: arrivo/ritorno scorrono di 30 min per 30 min di partenza, ultimo orario prudenziale invariato (dipende dal tramonto), margine coerente (= ora limite − inizio ritorno), persistenza dopo ricarica; ritmo, salto del Leno, suggerimenti di abbreviazione, ritardi con orologio finto. `flow.spec.ts`, `schedule.test.ts`, `schedule-input.test.ts` | Tempi di guida reali e traffico (stime dichiarate come tali). |
| 13 | Calcolo delle distanze lungo il GPX | AUTOMATICO | **Superato** | A 7 progressive diverse la distanza residua e quella al prossimo punto coincidono (±35 m) con i dati **indipendenti** della pipeline Python; elenco punti crescente e finale = lunghezza; esportazione GPX con lo stesso numero di punti della traccia; confronto GPX (uguale → coerente; +200 m → diversa; +20 m → coerente). `gps.spec.ts`, `map.spec.ts`, `polyline.test.ts`, `nav.test.ts` | Che la traccia coincida col sentiero reale. |
| 14 | Visualizzazione della via di ritorno | AUTOMATICO | **Superato** | Fasi della giornata, pulsante "Torna al parcheggio" apre il ritorno (rifugio → diga, 6,10 km), variante di sponda per il ritorno. `flow.spec.ts`, `map.spec.ts` | — |
| 15 | Gestione di dati incompleti | AUTOMATICO | **Superato** | Traccia assente/illeggibile, punti assenti, tempi di guida e orizzonte assenti (valori generici dichiarati), nessun dato geografico, pacchetto mappa incompleto, WebGL assente/perso: avvisi chiari, nessuna eccezione, nessuna schermata bianca. `data.spec.ts`, `data.test.ts`, `schedule-input.test.ts` | — |
| 16 | Controllo delle licenze cartografiche | AUTOMATICO + documentale | **Superato (controlli automatici)** | Attribuzioni ODbL/EU-DEM/MapLibre/Open-Meteo mostrate; GPX con autore e licenza; **nessun tile server di terzi** (host contattati = origine + meteo); dominio per dominio nel codice pubblicato; metadati dei dati. `licenses.spec.ts`; [DATA-LICENSE.md](../DATA-LICENSE.md) | **Non è una consulenza legale.** La conformità ODbL (condivisione alle stesse condizioni) va confermata dal titolare. |
| 17 | Leggibilità su schermi piccoli | AUTOMATICO | **Superato (misure)** | 320×568, 360×640, 375×667, 390×844 e 667×375: nessun overflow orizzontale, bersagli di tocco ≥ 44 px (marker mappa 30 px con area estesa), testo ≥ 11 px, niente testo troncato; azione principale visibile senza scorrere a 320×568; indicatori della mappa non sovrapposti. Schermate salvate e riviste a mano. `responsive.spec.ts` | **Leggibilità sotto luce solare, guanti, dita bagnate, resa dei caratteri su schermi reali.** |
| 18 | Verifica dell'accessibilità | AUTOMATICO | **Superato (parte automatizzabile)** | axe-core WCAG 2.2 A/AA: **0 violazioni** su 5 schermate × 3 temi (chiaro, scuro, alto contrasto) e sulle finestre di dialogo; tastiera (link "vai al contenuto", focus intrappolato nei dialoghi, Esc, focus visibile ≥ 2 px); un `main`, un `banner`, navigazione con nome, nessun ID duplicato; movimento ridotto; testo 130 % senza overflow; informazioni mai solo a colore. `a11y.spec.ts` | **Lettori di schermo (VoiceOver/TalkBack) e prove con persone con disabilità: non eseguite.** axe copre solo una parte dei criteri. Il canvas della mappa non è accessibile: l'equivalente è l'elenco testuale. |
| 19 | Nessuna richiesta di rete indispensabile offline | AUTOMATICO (offline simulato) | **Superato** | Dopo il download, riaprendo offline: **0** richieste verso altri domini, **0** richieste fallite, **0** risposte dalla rete (tutte dal service worker). Con una **CSP restrittiva** applicata davvero (e controprova che rileva le violazioni) l'app funziona per intero. `offline.spec.ts`, `csp.spec.ts`, `licenses.spec.ts` | Comportamento di altri browser. |
| 20 | Verifica delle limitazioni iOS e documentazione di ciò che non può essere garantito | **Documentale** | **Documentato; NON verificato su iOS** | Banner e testi in app (mappa, Sicurezza → Limiti, installazione) e [KNOWN-LIMITS.md](KNOWN-LIMITS.md), [INSTALL.md](INSTALL.md): nessun tracciamento garantito con schermo bloccato; memoria Safari separata dall'app installata; sfratto dei dati; permesso GPS. `content.spec.ts`, `pwa.spec.ts` verificano che i testi ci siano. | Che quanto documentato sia esattamente ciò che fa iOS: **le limitazioni sono note dal comportamento di piattaforma, non sono state osservate qui.** |

### 4.1 Criterio finale di accettazione (brief §15) — stato onesto

| Criterio | Stato | Nota |
|---|---|---|
| Partire da Pergine tra le 07:00 e le 08:00 | **Soddisfatto** (software) | Slider 07:00–08:00 che ricalcola l'intera giornata; tempi di guida **stimati** e modificabili. |
| Visitare la Cascata del Leno | **Parzialmente** | Tappa, passeggiata al ponte alla base (345 m) e programma presenti; il ponte è *inferito* dai dati OSM e il punto va verificato sul posto. |
| Raggiungere Malga Bissina in auto | **Parzialmente** | Link alla navigazione stradale con le coordinate dei dati; accesso, tariffe e regolazione del Parco **non verificati** per ottobre 2026. |
| Seguire il percorso escursionistico **verificato** fino al Rifugio Val di Fumo | **NON soddisfatto nel senso pieno** | Il percorso è mostrato e misurato, ma è **derivato da OpenStreetMap, non verificato sul campo né confrontato con la traccia SAT**: stato `source-derived`, dichiarato ovunque. |
| Tornare al parcheggio | **Soddisfatto** (software) | Ritorno sulla stessa traccia o variante; "Torna al parcheggio"; ora limite sempre in vista. |
| Semplice da installare e condividere | **Non dimostrato** | PWA con manifest e istruzioni; **nulla è pubblicato** e l'installazione su iPhone/Android **non è stata provata su dispositivi**. |
| Funzionare senza connessione dopo un download completo e verificato | **Soddisfatto in simulazione (Chromium)** | Non provato su telefoni reali. |
| Indicazioni affidabili, fonti consultabili, limiti espliciti, informazioni utili alla sicurezza | **Parzialmente** | Fonti registrate con stato di accesso (le quattro iniziali **non lette**), limiti espliciti in app e documenti, guida di emergenza; l'affidabilità è quella dei dati OSM e delle fonti secondarie. |

## 5. Prove aggiuntive eseguite (non richieste dal brief)

- **Controprove sull'integrità offline** (`pwa.spec.ts`): un file della mappa manomesso nella cache viene scoperto e lo stato smette di essere "pronto" (poi si ripara con *Prepara il viaggio*); la cache della mappa svuotata dal sistema riporta "Offline incompleto".
- **Aggiornamento del service worker** (`pwa.spec.ts`): una nuova build **attende la conferma** dell'utente, anche dopo una ricarica; solo dopo "Applica" diventa attiva e le vecchie cache vengono rimosse; lo stato "pronto" non si eredita.
- **Nessuna lettura della posizione prima del consenso**: la geolocalizzazione non viene mai interrogata navigando fra le schede; niente salvato prima del tocco; dopo il consenso l'ultima posizione si salva **solo** in IndexedDB e si cancella con un pulsante (`gps.spec.ts`).
- **Installazione**: stato "installata/nel browser", pulsante *Installa* solo su richiesta, testi per iPhone con Safari e con altri browser (`pwa.spec.ts`, UA emulato).
- **CSP**: `public/_headers` applicata da un server di prova; nessuna violazione; controprova negativa che le rileva (`csp.spec.ts`).

## 6. Difetti trovati durante le prove e corretti

| Difetto | Come è emerso | Correzione |
|---|---|---|
| Icone senza dimensione a tutta larghezza (schede Oggi, Sicurezza, Esplora) | Revisione delle schermate | Dimensione predefinita nel componente |
| Banner del GPS che copriva i selettori di percorso sulla mappa; mappa quasi invisibile a 320 px | Schermate a 320×568 | Layout a flusso, barra superiore ridotta, una sola riga di selettori, traccia inquadrata nell'area libera (misurata) |
| Marker della mappa schematica non selezionabili (cattura del puntatore al tocco; etichette sovrapposte) | `data.spec.ts` | Cattura solo durante il trascinamento; etichette solo se selezionato o con zoom |
| Marker sovrapposti (bersagli coperti) | axe `target-size` | Il meno importante si nasconde finché non c'è spazio (resta nell'elenco) |
| Nome accessibile dei marker sovrascritto da MapLibre ("Map marker") | Analisi dell'output di axe | Etichetta riapplicata dopo l'inserimento |
| "Vedi sulla mappa" (tappa/variante) non selezionava il percorso | Scrittura dei test | Parametro del percorso inoltrato alla mappa |
| Finestre di dialogo: focus e blocco dello scorrimento rieseguiti a ogni render | Revisione | `onClose` tenuto in un riferimento |
| Pulsante "pericolo" illeggibile nel tema scuro (contrasto 1,9:1) | axe `color-contrast` | Token dedicati |
| Mappa senza titolo di primo livello | `a11y.spec.ts` | Titolo nascosto per i lettori di schermo |
| Pulsanti del tema che sforavano a 320 px (+99 px); testi da 10–10,9 px; bersagli < 44 px | Misure in `responsive.spec.ts` | Pulsanti che vanno a capo, caratteri ≥ 11 px, bersagli ≥ 44 px |
| Stato offline valutato sulla sola **presenza** dei file | Progettazione delle controprove | Verifica profonda (hash) automatica una volta per sessione e a ogni *Verifica ora*; "pronto" mai mostrato se fallisce |
| Meteo: errore in inglese ("Failed to fetch"); campi dei tempi di guida vuoti senza dati | Revisione delle schermate | Messaggio in italiano; valore usato mostrato e dichiarato generico |
| Avviso "pacchetto mappa non disponibile" lampeggiante durante il caricamento | `map.spec.ts` | Stato neutro "Carico la mappa…" |
| Applicazione dell'aggiornamento del service worker non sempre immediata | Test instabile (1 su 3) → analisi con CDP | Causa: il test interrogava il vecchio worker mentre Chromium lo stava sostituendo (ogni richiesta lo tiene in vita). Test corretto; l'app ora ripete il messaggio e la documentazione avverte che può servire qualche secondo |

**Insidie dell'infrastruttura di test annotate:** (1) un percorso del profilo Chromium con caratteri non ASCII (es. un trattino lungo nel titolo del test) **impedisce la registrazione del service worker**: i profili persistenti usano un percorso ASCII; (2) due versioni di `playwright-core` (dipendenza di `@axe-core/playwright`) davano tipi incompatibili: bloccata con `overrides` in `package.json`.

## 7. Cosa i test **non** dimostrano (lacune dichiarate)

1. **Nessun dispositivo fisico**: iPhone/Safari, Android reale, secondo telefono, modalità aereo vera, GPS vero senza dati, batteria/consumi, memoria, sole.
2. **Solo Chromium**: Safari/WebKit e Firefox non provati. Possibili differenze su service worker, WebGL, geolocalizzazione e archiviazione.
3. **Traccia e luoghi non verificati sul campo** né confrontati con fonti ufficiali; i test confrontano l'app con i dati della pipeline e con misure secondarie, non con il terreno.
4. **Meteo dal vivo non provato**; **link esterni** (navigazione stradale) solo come costruzione degli indirizzi.
5. **Accessibilità**: nessun lettore di schermo reale.
6. **Hosting**: nessuna pubblicazione; workflow GitHub non eseguiti (`ci.yml`, `pages.yml`).
7. **Carico e durata**: nessuna prova di uso prolungato con GPS attivo per ore.
8. **Fuso orario/data**: provato con orologio finto al 9/10/2026; nessuna prova con data diversa dalla configurazione.

## 8. Elenco dei test automatici

<!-- BEGIN:test-list -->
### Test unitari (Vitest): 173 superati su 173

| File | Test superati | Cosa verifica |
|---|---|---|
| `data.test.ts` | 24 | integrità dei dati generati, chiavi dei luoghi, fonti, politica di guida, dati incompleti |
| `format.test.ts` | 6 | formati di distanza, durata, orario, età |
| `geodesy.test.ts` | 8 | distanze, direzioni, formato coordinate |
| `gps.test.ts` | 13 | consenso, stati, errori, qualità del fix (geolocalizzazione finta) |
| `install.test.ts` | 4 | rilevamento piattaforma per le istruzioni di installazione |
| `nav.test.ts` | 11 | progressione e distanza residua lungo la traccia, prossimo punto |
| `offline.test.ts` | 17 | manifest, download, verifica SHA-256, stati "pronto", aggiornamenti (cache finta) |
| `offroute.test.ts` | 9 | avviso di allontanamento: soglie, isteresi, precisione |
| `phase.test.ts` | 5 | fasi della giornata ed eventi |
| `polyline.test.ts` | 13 | proiezione e progressive lungo la polilinea |
| `prefs.test.ts` | 5 | preferenze: sanificazione e valori predefiniti |
| `schedule-input.test.ts` | 6 | priorità dei tempi (utente → dati → valori generici) |
| `schedule.test.ts` | 16 | motore del programma: ritardi, ora limite, suggerimenti |
| `storage.test.ts` | 2 | archivio locale con ripiego in memoria |
| `sun.test.ts` | 25 | alba/tramonto/crepuscolo contro riferimenti indipendenti (astral), orizzonte |
| `weather.test.ts` | 9 | meteo: URL, risposta SIMULATA, riepilogo, errori, cache |

### Test end-to-end (Playwright, Chromium): 64 superati su 64

**`a11y.spec.ts`**

- ✅ axe: tutte le sezioni, tema "Chiaro"
- ✅ axe: tutte le sezioni, tema "Scuro"
- ✅ axe: tutte le sezioni, tema "Alto contrasto"
- ✅ axe: finestre di dialogo e dettagli (preparazione, navigazione, tappa, elenco punti, scheda POI)
- ✅ tastiera: link "Vai al contenuto", ordine del focus, focus visibile, Esc chiude i dialoghi e restituisce il focus
- ✅ struttura: un solo main, nav con nome, intestazioni coerenti, lingua italiana, nessun ID duplicato
- ✅ movimento ridotto: nessuna transizione se il sistema lo chiede; informazioni mai affidate al solo colore
- ✅ dimensione del testo "molto grande" (130 %): nessun overflow orizzontale su 320 px

**`content.spec.ts`**

- ✅ Percorso: 9 tappe in ordine, ciascuna con modalità, posizione, distanza, tempo, segnavia, stato, data di verifica e fonti
- ✅ Percorso: punti di attenzione (ponti, bivi) con distanza dalla diga e dichiarazione di origine OSM
- ✅ Esplora: 8 schede con tipo (sul percorso/deviazione), provenienza, suggerimenti fotografici e nota sulle immagini; i filtri sono coerenti
- ✅ Oggi: dichiara che la traccia deriva da OpenStreetMap, non è verificata sul campo, e mostra lo stato incerto del rifugio
- ✅ Sicurezza: guida di emergenza, checklist persistente, limiti dell’app e limitazioni iOS dichiarate

**`csp.spec.ts`**

- ✅ con la CSP restrittiva l’app funziona per intero (mappa WebGL, download offline, GPS) e non viola alcuna regola

**`data.spec.ts`**

- ✅ traccia assente (404): avviso chiaro, mappa e programma non inventano nulla, il resto funziona
- ✅ traccia illeggibile (JSON troncato): stessa gestione, nessuna eccezione
- ✅ punti assenti (500): l’app resta usabile e lo dichiara
- ✅ tempi di guida e orizzonte assenti: il programma usa stime di ripiego dichiarate, senza sole diretto
- ✅ tutti i dati geografici assenti: nessuna schermata bianca, nessuna eccezione
- ✅ pacchetto mappa incompleto: mappa schematica con traccia e punti e avviso, non una mappa vuota
- ✅ WebGL non disponibile: ripiego SVG con traccia, punti selezionabili e tastiera
- ✅ contesto WebGL perso a mappa aperta: passaggio automatico alla mappa schematica con avviso

**`flow.spec.ts`**

- ✅ T12: l’orario di partenza (07:00–08:00) aggiorna orari previsti, margine e resta coerente
- ✅ ritmo del gruppo e sosta al Leno modificano il programma nel verso atteso
- ✅ margine tirato o negativo: compaiono i suggerimenti per accorciare, mai promesse
- ✅ giorno dell’escursione: i ritardi reali ricalcolano ora limite e margine
- ✅ T14: fasi della giornata, pulsante principale contestuale e via del ritorno
- ✅ navigazione stradale: link con le coordinate verificate dei dati, avvertenze sul parcheggio
- ✅ esito della verifica sul rifugio: lo stato è dichiarato dall’utente e persiste
- ✅ durante il trekking la Mappa mostra sempre l’ultimo orario prudenziale per iniziare il ritorno; al ritorno l’ora limite all’auto

**`gps.spec.ts`**

- ✅ nessuna lettura della posizione prima del consenso esplicito
- ✅ permesso negato: messaggio chiaro, nessuna posizione inventata, app utilizzabile
- ✅ GPS non disponibile (POSITION_UNAVAILABLE): avviso, nessun dato fittizio
- ✅ timeout del GPS (nessun primo segnale): avviso di attesa, nessun dato fittizio
- ✅ geolocalizzazione assente nel browser: messaggio dedicato
- ✅ precisione scarsa: distanza e avvisi sospesi, nessun falso "fuori percorso"
- ✅ posizione obsoleta (oltre 120 s senza aggiornamenti): progresso e avvisi sospesi
- ✅ fuori percorso: avviso sobrio solo con fix preciso e persistente; sparisce al rientro; disattivabile
- ✅ distanze lungo il GPX in vari punti del percorso (confronto con i dati della pipeline)

**`licenses.spec.ts`**

- ✅ attribuzioni visibili: mappa e schermata "Fonti, licenze e attribuzioni"
- ✅ le tracce GPX (statiche ed esportate) riportano autore OSM e licenza ODbL e dichiarano di non essere verificate sul campo
- ✅ nessun tile server né servizio cartografico di terzi: tutte le richieste restano sull’origine (meteo escluso, bloccato nel test)
- ✅ il codice pubblicato non contiene indirizzi di tile server o servizi di mappe a pagamento
- ✅ i dati cartografici dichiarano origine e licenza; i file di documentazione le riportano

**`map.spec.ts`**

- ✅ i marker hanno un nome accessibile significativo (non "Map marker") e il punto selezionato mostra distanza e stato di validazione
- ✅ marker troppo vicini non si sovrappongono: il meno importante riappare ingrandendo; i punti critici compaiono solo a zoom alto
- ✅ "Vedi sulla mappa" dalla tappa del Leno mostra la passeggiata al ponte (345 m); la variante mostra la sponda opposta
- ✅ scelta della sponda per il ritorno (anello): il ritorno usa la variante e lo ricorda
- ✅ elenco punti e mappa mostrano le stesse distanze lungo la traccia (da OSM, non in linea d’aria)
- ✅ confronto con un GPX importato: uguale → coerente; spostato di 200 m → diverso; file non valido → errore chiaro
- ✅ esportazione GPX: file valido, stesso numero di punti della traccia ufficiale incorporata, quote presenti

**`offline.spec.ts`**

- ✅ T4–T8, T19: download verificato → offline simulato → riapertura → mappa, punti e GPS senza rete

**`pwa.spec.ts`**

- ✅ manifest PWA completo; icone esistenti con le dimensioni dichiarate; meta per iOS
- ✅ "pronto per l’uso offline" compare solo dopo download e verifica; mai prima
- ✅ controprova: una risorsa della mappa manomessa nella cache viene scoperta e lo stato smette di essere "pronto"
- ✅ controprova: cache della mappa svuotata dal sistema → stato "incompleto" e mappa schematica, non "pronto"
- ✅ aggiornamento del service worker: la nuova versione attende la conferma dell’utente e poi pulisce le vecchie cache
- ✅ installazione: stato, pulsante "Installa l’app" (evento beforeinstallprompt SIMULATO) e istruzioni per iPhone/Safari

**`responsive.spec.ts`**

- ✅ iPhone SE (320×568): nessun overflow, bersagli ≥ 44 px, testo ≥ 11 px, niente testo troncato
- ✅ Android piccolo (360×640): nessun overflow, bersagli ≥ 44 px, testo ≥ 11 px, niente testo troncato
- ✅ iPhone 8 (375×667): nessun overflow, bersagli ≥ 44 px, testo ≥ 11 px, niente testo troncato
- ✅ iPhone 14 (390×844): nessun overflow, bersagli ≥ 44 px, testo ≥ 11 px, niente testo troncato
- ✅ telefono in orizzontale (667×375): nessun overflow, bersagli ≥ 44 px, testo ≥ 11 px, niente testo troncato
- ✅ 320×568: l’azione principale di "Oggi" è visibile senza scorrere e i tre indicatori della mappa non si sovrappongono

<!-- END:test-list -->
