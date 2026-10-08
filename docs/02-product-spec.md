# Fase 2 — Specifica di prodotto

> Verifica di coerenza con gli obiettivi (brief §1, §15): l'app deve ridurre l'incertezza **senza creare un falso senso di sicurezza**; la priorità non è aggiungere funzioni ma garantire che quelle essenziali siano corrette, comprensibili, utilizzabili e testate.

## 1. Utenti e situazione d'uso

- Un gruppo di amici, ciascuno con il proprio telefono (iPhone e Android), che **non conosce la zona**.
- Uso reale: sera prima (installazione e download), mattina in auto, tappa alla Cascata del Leno, trekking all'aperto sotto il sole, soste, rientro, guida di ritorno. Spesso **senza rete**, con **una mano** sola, batteria limitata.
- Nessun account, nessuna chiave, nessun server da avviare.

## 2. Le tre domande della schermata di cammino

Durante il trekking la schermata principale (Mappa) risponde subito a: **Dove sono? · Dove devo andare? · Quanto manca?** Tre riquadri grandi e leggibili sopra la mappa:

1. *Dove sono*: stato GPS (precisione) e distanza dalla traccia ("sulla traccia" / "42 m dalla traccia" / "posizione imprecisa").
2. *Dove devo andare*: prossimo punto (nome) con distanza **lungo il percorso** e direzione della traccia in punti cardinali ("traccia verso NE"; nessuna freccia/bussola ricavata dal GPS in movimento, per evitare falsi allarmi).
3. *Quanto manca*: distanza residua sul percorso e tempo indicativo al prossimo punto. Durante il trekking una **striscia** sotto i riquadri mostra sempre l'**ultimo orario prudenziale per iniziare il ritorno** e il margine (al ritorno: ora limite all'auto e tramonto).

## 3. Fasi della giornata e pulsante contestuale

| Fase | Quando | Pulsante principale in *Oggi* |
|---|---|---|
| `prep` | prima della partenza | **Prepara il viaggio** (download e verifica offline) |
| `drive-out` | trasferimento Pergine → Boazzo | **Apri navigazione stradale** |
| `leno` | sosta alla Cascata del Leno | **Visualizza percorso** (al ponte alla base) |
| `drive-dam` | trasferimento Boazzo → diga | **Apri navigazione stradale** |
| `trek-prep` | preparazione al trekking alla diga | **Visualizza percorso** |
| `trek-out` | andata a piedi | **Visualizza percorso** |
| `hut` | al rifugio / pranzo | **Valuta il ritorno** (mostra l'ora limite) |
| `trek-back` | ritorno a piedi | **Torna al parcheggio** |
| `drive-home` | rientro in auto | **Apri navigazione stradale** |
| `done` | fine | — |

La fase è **sempre scelta dall'utente** ("Registra: sono partito / arrivato / ripartito…"). L'app **non cambia fase da sola**. (Il suggerimento automatico di cambio fase, ipotizzato in origine, **non è stato implementato**.) Ogni registrazione salva l'ora effettiva (modificabile) e ricalcola il programma.

## 4. Le cinque sezioni

### A. Oggi
Dashboard: titolo, data, **meteo con data/ora dell'ultimo aggiornamento** (e avviso se vecchio o assente), **stato della preparazione offline**, orario di partenza, prossima tappa, progressione complessiva, pulsante contestuale (§3). Schede di avviso persistenti e sintetiche:
- *Rifugio: apertura non confermata* (finché non lo si conferma a mano; vedi §6);
- *Ora limite per iniziare il ritorno* e margine di luce;
- *Offline non pronto* (se la verifica non è completa);
- *Traccia non verificata sul campo*.
Sottopagina **Programma** con: orario pianificato, orario effettivo, durata stimata, tempo rimanente, ritardo, ultimo orario prudenziale per iniziare il ritorno; **selettore di orario di partenza 07:00–08:00** (slider, passo 5 minuti) e **ritmo del gruppo** (veloce/normale/lento). Se i tempi non sono compatibili con un rientro prudente propone **abbreviazioni** (senza presentarle come garanzie).

### B. Mappa
Mappa topografica **locale** (rilievo, curve di livello, acqua, boschi/rocce, strade e sentieri), traccia GPX del percorso, ritorno, posizione GPS con cerchio di precisione, orientamento rispetto al percorso, waypoint selezionabili, distanza al prossimo waypoint, distanza residua *lungo la traccia*, pulsanti *Centra su di me* e *Mostra tutto il percorso*, zoom e spostamento manuali, **evidenziazione dei punti critici** (ponti, bivi dal dato OSM, tratti ripidi). Nessuna istruzione di svolta ricavata dalla sola polilinea. Fallback: **mappa schematica SVG** locale (stessi dati) se WebGL non è disponibile o il pacchetto mappa non è presente.

### C. Percorso
Timeline di tutte le tappe (compatta); ogni tappa ha una **scheda di dettaglio** con: nome, descrizione sintetica, posizione, distanza dalla tappa precedente, tempo indicativo, segnavia da seguire, cosa osservare, difficoltà, come proseguire, alternative, **fonte** e **stato di validazione** con data di verifica.

### D. Esplora
Schede dei punti d'interesse (Cascata del Leno, Lago di Boazzo, Diga e Lago di Malga Bissina, Malga Breguzzo, Cascata del Chiese, Paesaggio della Val di Fumo, Rifugio Val di Fumo), con **"Sul percorso"** o **"Richiede deviazione (+X m)"**, informazioni contestuali, suggerimenti fotografici generali, fonte e stato. **Nessuna fotografia** (nessuna con licenza verificabile era raggiungibile): lo si dichiara nella scheda.

### E. Sicurezza e offline (sempre raggiungibile dalla barra inferiore)
Stato GPS e precisione; disponibilità e data della mappa offline con **verifica per risorsa**; stato della traccia (fonte, validazione, ultima modifica OSM); **emergenze e soccorso** (112, cosa dire, segnale alpino, limiti); **coordinate correnti copiabili** e condivisibili; **ultima posizione nota con ora**; **checklist equipaggiamento**; **limiti dell'app** (iOS in primo piano); esportazione/condivisione **GPX**; **importazione GPX** e confronto con la traccia incorporata. Non promette che una chiamata d'emergenza sia possibile senza copertura.

## 5. Comportamenti del GPS (requisiti → regole)

- **Consenso esplicito**: nessuna lettura della posizione prima del tap su *Attiva GPS*; nessuna posizione lascia il dispositivo.
- Aggiornamento continuo solo ad app in uso; se la scheda va in background il tracciamento **può fermarsi** (iOS in particolare): l'app lo dichiara e al ritorno in primo piano mostra "posizione non aggiornata da X min".
- **Precisione**: buona ≤ 20 m, discreta ≤ 50 m, scarsa ≤ 100 m, **inaffidabile** > 100 m (non usata per progresso né avvisi).
- **Obsoleta**: età del fix > 30 s ("non aggiornata"), > 120 s ("obsoleta"): progresso e avvisi sospesi.
- **Possibile allontanamento**: solo se precisione ≤ 50 m, distanza > max(60 m, 2× precisione) per ≥ 3 fix su ≥ 30 s; si annulla sotto max(40 m, 1,5× precisione) per 2 fix. Messaggio sobrio ("Possibile allontanamento dalla traccia mappata"), **nessun suono/vibrazione**, disattivabile.
- **Distanza residua** lungo la geometria del percorso, mai in linea d'aria; se fuori traccia (> 300 m) si dichiara "non affidabile".
- Nessun servizio di routing online durante il trekking.

## 6. Regole sui dati non verificati

Vedi stati in `01-research-report.md §1.3`. In pratica:
- ogni dato mostra **fonte**, **stato**, **data di verifica**;
- `unverified` non entra in nessun calcolo né avviso;
- i testi che si basano su fonti secondarie sono etichettati *"da fonte secondaria — da verificare"*;
- il rifugio compare come **"apertura da confermare"** finché l'utente non registra la conferma;
- i tempi di guida compaiono come **stima** e sono **modificabili**.

## 7. Design e accessibilità

Mobile-first, contrasto elevato, bersagli di tocco ≥ 44 px (pulsanti principali 52–64 px), testi brevi, terminologia corretta (sentiero, segnavia, malga, bivio), icone coerenti **sempre con etichetta testuale**, colori con valore funzionale ma **mai unico veicolo** (icona + testo), nessuna animazione superflua (`prefers-reduced-motion` rispettato), tema chiaro predefinito per la luce solare con **tema alto contrasto** e **tema scuro** selezionabili, dimensione del testo regolabile, `lang="it"`, struttura semantica, focus visibile.

## 8. Fuori ambito (dichiarato)

Navigazione turn-by-turn, tracciamento in background affidabile, registrazione del tracciato dell'utente, chat/condivisione tra dispositivi, account, fotografie, estensioni al Bivacco Segalla e percorsi alpinistici.

## 9. Stato finale rispetto alla specifica (scostamenti dichiarati)

| Specifica | Realizzato |
|---|---|
| Suggerimento automatico di cambio fase | **Non implementato** (la fase è sempre scelta dall'utente) |
| Bussola/direzione di marcia | Direzione della traccia in punti cardinali; nessuna freccia ricavata dal GPS in movimento. **Aggiunta a richiesta:** pulsante *Bussola* (sensori del telefono, mai il GPS) che mostra dove sei rivolto: indicativa, provata solo con eventi simulati |
| Punti critici: ponti, bivi, **tratti ripidi** | Ponti e bivi dal dato OSM; il tratto ripido del Leno è solo informazione testuale (non guidato) |
| Tema chiaro predefinito | Tema "automatico": segue le preferenze del sistema; chiaro, scuro e alto contrasto selezionabili |
| Fotografie autorizzate | **Nessuna fotografia** (nessuna immagine con licenza verificabile raggiungibile) |
| Service worker con Workbox | Service worker scritto a mano (poche righe, verifica offline sotto controllo) |
| Condivisione del GPX | Esportazione (download) e Web Share API dove disponibile; nessun invio automatico |
| Installazione guidata | Pulsante *Installa l'app* dove il browser lo consente; istruzioni per iPhone/Safari (nessun pulsante programmabile su iOS) |
| Meteo | Open-Meteo a runtime sul dispositivo, con data dell'ultimo aggiornamento; **non provato dal vivo** |
