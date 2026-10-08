# Preparare e verificare l'uso offline

In montagna la copertura mobile non è garantita. L'app è costruita perché le funzioni essenziali (mappa, traccia, tappe, waypoint, programma, guida di emergenza) funzionino **senza rete**, ma solo **dopo** che il pacchetto è stato scaricato **e verificato su quel telefono**.

## Quando

**A casa, con Wi-Fi, il giorno prima** (o comunque prima di lasciare la copertura). Poi rifai il test in modalità aereo la mattina della partenza.

## Procedura

1. Installa l'app ([INSTALL.md](INSTALL.md)) e aprila **dall'icona** (su iPhone è importante: vedi l'avviso in quella guida).
2. In *Oggi* tocca **Prepara il viaggio** (oppure *Sicurezza e offline → Mappe e uso offline*).
3. Controlla dimensione e versione mostrate e tocca **Scarica e verifica**.
4. Attendi la barra di avanzamento: prima *Download* (ogni risorsa), poi *Verifica* (ogni risorsa viene **riletta dalla memoria del telefono** e confrontata per dimensione e impronta SHA-256 con l'elenco della versione).
5. Deve comparire il riquadro verde **"Pronto per l'uso offline"** con numero di risorse, data e ora. In alto, il segnalino diventa **"Offline pronto"**.
6. **Test in modalità aereo** (vedi [INSTALL.md](INSTALL.md#test-finale-consigliato-2-minuti)): chiudi l'app, riaprila, controlla Mappa, Percorso, Sicurezza.

## Cosa significa "Pronto per l'uso offline"

L'app lo mostra **solo se tutte** queste condizioni sono vere:

- tutte le risorse dell'elenco (app, testi, tracce GPX, dati geografici e **mappa**) sono presenti nella memoria del telefono;
- ciascuna è **integra** (dimensione e SHA-256 corrispondono);
- la verifica è stata fatta **su questo dispositivo** per **questa versione** dell'app;
- il service worker controlla la pagina (altrimenti compare "Riapri l'app").

Lo stato viene **ricontrollato a ogni apertura**: dopo circa 2 secondi l'app rilegge e verifica di nuovo tutte le risorse (una volta per sessione). Se il sistema ha svuotato la memoria o un file è danneggiato, il segnalino passa a **"Offline incompleto"** e dice cosa manca: basta ripetere *Prepara il viaggio*.

**Non significa** che il GPS, il meteo o le app di navigazione stradale funzionino senza rete (vedi sotto).

## Cosa funziona senza rete / cosa no

| Funzione | Senza rete |
|---|---|
| Mappa topografica locale (rilievo, curve di livello 20 m, acqua, sentieri OSM), traccia, waypoint | Sì |
| Elenco testuale dei punti, tappe, schede, programma orario, calcolo dell'ultimo orario prudenziale | Sì |
| GPS (posizione, precisione, distanza dal sentiero e lungo il sentiero) | **Sì, se il telefono riceve il segnale satellitare** (all'aperto; il primo rilevamento può essere lento senza assistenza di rete). Non è stato provato su telefoni reali |
| Guida di emergenza, checklist, esportazione/importazione GPX | Sì |
| **Meteo** | **No**: si aggiorna solo con la rete; offline mostra l'ultimo dato salvato con la sua ora, oppure "non disponibile" |
| **Navigazione stradale** | **No**: l'app apre l'app di mappe del telefono (Google/Apple/altra), che ha bisogno dei suoi dati. **Scarica la zona Trentino/Val Daone nelle mappe offline di quell'app prima di partire** (se la tua app lo permette). La strada oltre Daone può essere priva di copertura |
| Link alle fonti | No (si aprono nel browser) |
| **Chiamata d'emergenza** | **Non è garantita**: il 112 usa qualsiasi rete disponibile ma non funziona dove non c'è nessuna rete |

## Spazio e memoria

- Totale circa **3,6 MB** (come mostrato dall'app): app e dati circa 1,4 MB + mappa circa 2,1 MB. L'app mostra lo spazio usato dal sito in *Sicurezza e offline → Mappe e uso offline*.
- L'app chiede al sistema di rendere la memoria **persistente**; l'esito è mostrato dopo il download. **Non è garantito** (su iPhone di solito non viene concesso: per questo conviene installare l'app sulla Home). Se il sistema libera spazio, può cancellare i dati dei siti: l'app lo scopre al successivo avvio.

## Aggiornamenti

La nuova versione dell'app si scarica in silenzio ma **non sostituisce quella in uso** finché non lo decidi tu (banner "Nuova versione dell'app disponibile" → *Applica l'aggiornamento*). Fallo **a casa**. Dopo l'aggiornamento ripeti *Prepara il viaggio*: lo stato "pronto" non passa da una versione all'altra.

L'aggiornamento può richiedere qualche secondo; se dopo il tocco la pagina non si ricarica, chiudi del tutto l'app e riaprila.

## Se qualcosa non funziona

| Segnalino / messaggio | Cosa fare |
|---|---|
| **Offline non pronto** | Mai preparato su questo dispositivo: *Prepara il viaggio* (serve la rete). |
| **Offline incompleto** / "Parziale: mancano risorse" | Una parte è stata cancellata o è danneggiata. Con la rete: *Prepara il viaggio → Scarica e verifica* ripara solo ciò che manca. |
| **Riapri l'app** | È tutto in memoria ma la pagina non è ancora controllata dal service worker: chiudi del tutto l'app e riaprila una volta. |
| "La verifica risale a una versione precedente" | Dopo un aggiornamento: ripeti *Prepara il viaggio*. |
| **Non supportato in questo contesto** | Serve HTTPS (o localhost) e un browser con service worker. Non usare navigazione privata né il browser interno di altre app. |
| La mappa dettagliata non si apre e compare una **mappa schematica** | Il dispositivo non ha WebGL, l'ha perso per poca memoria o il pacchetto mappa manca. Traccia, punti, elenco testuale e distanze funzionano comunque. Chiudi altre app e riapri. |
| GPS: "Permesso negato" | Impostazioni del telefono → Privacy/Posizione → consenti per il browser/app → riprova. |
| GPS: "Posizione non disponibile" o "Ancora nessun segnale" | Vai all'aperto con cielo libero; controlla che Posizione sia attiva; attendi fino a un minuto. |
| GPS: "Posizione non aggiornata/obsoleta" | Il telefono non sta più inviando posizioni (su iPhone succede con schermo bloccato o app in secondo piano). Riporta l'app in primo piano. |

## Verifica manuale tecnica (facoltativa)

In Chrome per Android o desktop: DevTools → Application → *Cache storage*: devono esistere `vdf-core-<versione>` e `vdf-map-<versione>`; *Service Workers*: stato "activated". In *Network* con "Offline" attivo la pagina deve ricaricarsi senza errori. I test automatici (`npm run test:e2e`) eseguono questa prova su Chromium — **non** su iPhone.
