# Limiti noti

Elenco volutamente senza abbellimenti. Dove un limite ha un rimedio, è indicato. Le stesse informazioni essenziali sono nell'app (*Sicurezza e offline → Limiti dell'app*).

## 1. Dati e itinerario

| # | Limite | Impatto | Cosa fare |
|---|---|---|---|
| 1 | **Le quattro fonti iniziali del brief (SAT, Parco Adamello Brenta, Visit Trentino, Iter Edizioni) non sono state lette**: l'ambiente di sviluppo ne bloccava i domini. Le informazioni descrittive provengono da **sintesi di ricerca** e da OpenStreetMap. | Testi e dettagli (segnavia, tempi, avvertenze) possono essere incompleti o datati. | Leggere le fonti ufficiali prima di partire ([SOURCES.md](SOURCES.md)). |
| 2 | **La traccia è derivata da OpenStreetMap, mai verificata sul campo né confrontata con una traccia ufficiale SAT.** Ultima modifica OSM dei tratti principali: 21/12/2023 (alcuni fermi al 2014). | Il sentiero reale può differire (frane, ponti rifatti, deviazioni). L'avviso di allontanamento lavora sulla traccia mappata. | Fidarsi dei segnavia sul terreno. Importare nell'app un GPX ufficiale (*Sicurezza → Traccia GPX → Confronta*) e guardare lo scostamento. |
| 3 | **Numeri dei sentieri (SAT 240, 222, 246)** non verificabili dai dati (Overture non contiene le relazioni dei sentieri): vengono da fonti secondarie. | Possibili errori nei segnavia indicati. | Controllare i cartelli sul posto. |
| 4 | **Guadi e passaggi su pietre non sono rappresentati nei dati.** Sull'andata il dato OSM contiene 5 tratti-ponte (44 m). | Un attraversamento può richiedere di bagnarsi con acqua alta o gelo. | Se un passaggio non convince, non attraversare. |
| 5 | **Cascata del Leno:** il punto OSM della cascata è alla sommità (+190 m, 1,15 km); la sosta fotografica è al **ponte alla base**, *inferito* come il tratto-ponte più vicino. Salita ripida solo come informazione. | Il punto di sosta potrebbe non coincidere con il belvedere reale. | Verificare in loco; non cercare il nodo OSM con il GPS. |
| 6 | **Cascata del Chiese:** un solo punto OSM senza nome; una seconda cascatella citata dalle fonti non è localizzata. | La "cascata" mostrata è una candidata, non una certezza. | Guardare il torrente a monte di Malga Breguzzo. |
| 7 | **Apertura del Rifugio Val di Fumo il 9 ottobre: fonti discordanti** (stagione "fino all'11/10" oppure "fino al 30/09"). | Il rifugio potrebbe essere chiuso. | **Telefonare** (numero in app da verificare). Il programma non dipende dal rifugio: pranzo, acqua e strati si portano. |
| 8 | **Accesso e parcheggio alla diga:** possibile regolazione dal Parco, pagamento (monete), chiusure per neve. Nessuna ordinanza consultata. | Si può arrivare e non poter parcheggiare, o dover lasciare l'auto più a valle (tempi diversi). | Contattare il Parco (0465 806666). Ricalcolare il programma con i tempi del navigatore. |
| 9 | **Quote e dislivelli da modello digitale del terreno (EU-DEM, ~25 m):** errori anche di 20–30 m; dislivello andata calcolato +162 m contro 95–170 m delle fonti. | Valori di quota/dislivello solo indicativi. | Considerarli stime. |
| 10 | **Sole diretto in valle** stimato dal rilievo (±15–20 min); **tramonto** da calcolo astronomico locale (confrontato con una libreria indipendente). | Il freddo e la penombra arrivano prima del tramonto. | Rispettare l'*ultimo orario prudenziale per iniziare il ritorno*. |
| 11 | **Tempi di guida:** stime da distanze stradali OSM e velocità medie assunte, **senza traffico**. | Orari di arrivo ottimistici/pessimistici. | Inserire i tempi del proprio navigatore (*Programma → Tempi di guida*). |
| 12 | **Tempi di cammino:** modello di Tobler calibrato ×1,2 su fonti secondarie (78–120 min), ritmo regolabile. | Il vostro ritmo può differire. | Scegliere il ritmo; registrare gli orari reali (il programma si ricalcola). |
| 13 | **Meteo:** Open-Meteo (modello), con data dell'ultimo aggiornamento; **non è una previsione ufficiale** e **non è stato provato dal vivo** in sviluppo (host bloccato; risposta simulata nei test). | Dato assente o datato offline. | Consultare **Meteo Trentino** prima di partire. |
| 14 | **Pergine Valsugana** è l'etichetta della città in OSM, non il vostro punto di partenza. | Distanze/tempi di guida approssimati. | Modificare i tempi di guida. |
| 15 | **Nessuna fotografia** inclusa: nessuna immagine con licenza verificabile era raggiungibile (Wikimedia Commons e siti ufficiali bloccati). Le schede hanno suggerimenti fotografici generici. | Schede Esplora senza immagini. | Aggiungere foto con licenza nota in futuro (campo `photos`). |
| 16 | **Itinerario escluso per scelta:** Bivacco Segalla e percorsi alpinistici. La Piana della Val di Fumo è solo un punto d'interesse senza traccia guidata. | — | — |

## 2. Navigazione e GPS

| # | Limite | Note |
|---|---|---|
| 17 | **iPhone: nessun tracciamento affidabile con schermo bloccato o app in secondo piano** (Safari e PWA iOS). | L'app non promette il tracciamento in background e lo dichiara. Tenere l'app in primo piano; controllare l'ora dell'ultimo aggiornamento. |
| 18 | **Nessuna istruzione di svolta.** L'app mostra tappe, punti di attenzione dal dato OSM (ponti, bivi) con direzioni cardinali e la traccia. | Scelta voluta: non si inventano istruzioni da una polilinea. |
| 19 | **L'avviso di allontanamento è un'indicazione, non un allarme:** scatta solo con precisione ≤ 50 m, distanza > max(60 m, 2 × precisione) per almeno 3 rilevamenti in oltre 30 s; rientra con isteresi; si può disattivare; nessun suono né vibrazione. | Non rileva una svolta sbagliata se il ramo sbagliato resta entro ~60 m dalla traccia (es. alcuni bivi, la sponda parallela). |
| 20 | **Precisione del GPS** peggiore in valle stretta o nel bosco. | Con precisione > 100 m o posizione oltre 2 minuti vecchia, distanza e avvisi sono sospesi e lo dice. |
| 21 | **Distanza residua e progressione** valgono solo se la posizione cade entro 300 m dalla traccia e il fix è utilizzabile; altrimenti si mostra la lunghezza totale. | Mai distanza in linea d'aria. |
| 22 | **Navigazione stradale non inclusa:** l'app apre l'app di mappe del telefono. | Richiede rete/mappe offline di quell'app. |
| 23 | **Chiamate di emergenza:** l'app non può garantirle senza copertura. | Informare qualcuno del programma; segnale di soccorso alpino in app. |

## 3. Offline, installazione, piattaforme

| # | Limite | Note |
|---|---|---|
| 24 | **Lo stato "pronto" è per dispositivo.** Un link condiviso non prova che l'app sia installata o pronta. | Ogni partecipante prepara e testa il proprio telefono. |
| 25 | **iPhone: l'app installata ha memoria separata da Safari.** | Preparare il viaggio **dall'icona**. |
| 26 | **iOS può cancellare i dati dei siti non installati dopo alcuni giorni senza uso**; la memoria persistente di solito non è concessa. L'app ricontrolla a ogni avvio. | Installare sulla Home; ripetere la verifica la mattina. |
| 27 | **Android/Chrome** può svuotare i dati sotto pressione di spazio e il risparmio batteria può sospendere l'app. | Tenere l'app aperta; ripetere la verifica. |
| 28 | **Il controllo di integrità completo (SHA-256)** avviene a ogni *Prepara/Verifica* e una volta per sessione dopo circa 2 s dall'avvio: nei primi istanti lo stato può mostrare "pronto" in base alla sola presenza dei file. | Dopo l'avvio attendere un paio di secondi. |
| 29 | **Aggiornamento dell'app:** la nuova versione attende la conferma; l'attivazione può richiedere qualche secondo (e il browser la ritarda se il vecchio service worker è occupato). | Aggiornare a casa; se non si ricarica, chiudere e riaprire. |
| 30 | **Mappa dettagliata richiede WebGL.** Senza, o se il contesto va perso, c'è una mappa schematica (SVG). | Traccia, punti, elenco testuale e distanze funzionano sempre. |
| 31 | **Copertura della mappa limitata** a circa 9,9 × 12,5 km attorno al percorso (zoom massimo 17); curve di livello ogni 20 m; pochi toponimi (cime, laghi, rifugi). | Scelta per spazio e licenza. |
| 32 | **Solo italiano.** | — |
| 33 | **Fuso orario e data** da configurazione (`Europe/Rome`, 2026-10-09). | Modificare `src/config/trip.config.ts`. |

## 4. Accessibilità e compatibilità (cosa è stato e non è stato provato)

- Provati in automatico: assenza di violazioni WCAG 2.2 A/AA rilevabili da axe-core in tre temi, navigazione da tastiera, struttura, movimento ridotto, testo "molto grande" dell'app (130 %) su schermi da 320 px con cinque famiglie di caratteri (la CI di GitHub ha mostrato che il risultato dipende dal font di sistema: vedi [TEST-REPORT.md](TEST-REPORT.md) §6). **Non provati:** lettori di schermo (VoiceOver, TalkBack), prove con persone con disabilità, ingrandimento dei caratteri impostato dal **sistema operativo** (Android, Dimensione dinamica di iOS) e zoom del browser. L'axe copre solo una parte dei criteri.
- **Non seguono** l'impostazione "Dimensione del testo" dell'app: le etichette della **barra inferiore** (Oggi, Mappa, Percorso, Esplora, Sicurezza; 11–13,5 px in proporzione alla larghezza dello schermo, compromesso scelto per far entrare sempre cinque voci a 320 px senza tagliarle, anche con font larghi) e le **etichette sulla mappa** (12 px). Il resto del testo la segue.
- Il canvas della mappa non è accessibile al lettore di schermo: l'alternativa equivalente è *Elenco punti* e *Percorso*.
- **Browser provato: solo Chromium** (motore di Chrome/Edge/Android). **Non provati:** Safari/WebKit (iPhone), Firefox. Differenze di comportamento su iOS sono probabili (service worker, geolocalizzazione, WebGL, memoria).

## 5. Dati e licenze

- I file in `public/data` sono un database derivato da OpenStreetMap: **ODbL 1.0, con attribuzione e condivisione alle stesse condizioni** (vedi [DATA-LICENSE.md](../DATA-LICENSE.md)). Non è una consulenza legale.
- Il rilievo usa EU-DEM (Copernicus) tramite Terrain Tiles su AWS Open Data: attribuzione obbligatoria, mostrata in app e nella mappa.
- **Il codice sorgente non ha una licenza scelta** (decisione del titolare).

## 6. Come sono stati provati questi limiti

Vedi [TEST-REPORT.md](TEST-REPORT.md): vi è la distinzione fra test automatici, simulazioni e prove su dispositivi fisici (**non eseguite**).
