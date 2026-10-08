# Installazione su iPhone e Android

Guida per chi parteciperà all'escursione. **Non serve nessun account, nessuna chiave, nessun server sul telefono.** L'app è una pagina web che si installa sulla schermata Home e poi funziona anche senza rete, *dopo* aver scaricato il pacchetto offline (vedi [OFFLINE.md](OFFLINE.md)).

> **Ogni persona deve installare e preparare l'app sul proprio telefono.** Aver ricevuto il link non significa che l'app sia installata né pronta per l'uso offline: lo stato "Pronto per l'uso offline" compare solo dopo un download e una verifica fatti su *quel* dispositivo.

> Hai già l'app aperta e vuoi invitare un amico? *Sicurezza e offline → Mappe e uso offline → Condividi il link dell'app*.

## Cosa serve

- L'**indirizzo https** dell'app: **https://val-di-fumo.vercel.app** (se chi la pubblica te ne ha mandato un altro, usa quello; vedi [DEPLOY.md](DEPLOY.md)).
- Una connessione Wi-Fi (meglio) o dati mobili **a casa**, il giorno prima: il pacchetto pesa circa **3,6 MB** (di cui 2,1 MB di mappa).
- Circa 10 MB liberi, un iPhone con iOS recente (Safari) oppure un Android con Chrome recente. **L'app non è stata provata su iPhone né su un telefono reale** (vedi [TEST-REPORT.md](TEST-REPORT.md)): se sul tuo dispositivo la mappa dettagliata non si apre, l'app passa da sola alla mappa schematica e lo dichiara.

## Cose da NON fare

- **Non aprire il link dentro WhatsApp, Telegram, Instagram o Facebook** (browser integrato): copia l'indirizzo e aprilo in Safari (iPhone) o Chrome (Android). I browser integrati non permettono l'installazione e spesso cancellano i dati.
- **Non usare la navigazione privata/anonima**: i dati scaricati vengono cancellati alla chiusura.

## iPhone (Safari)

1. Apri l'indirizzo **in Safari**.
2. Tocca il tasto **Condividi** (il quadrato con la freccia verso l'alto, in basso).
3. Scorri e scegli **"Aggiungi alla schermata Home"**, poi **Aggiungi**.
4. **Chiudi Safari e apri l'app dall'icona "Val di Fumo"** sulla Home.
5. **Da lì**, in *Oggi*, tocca **Prepara il viaggio → Scarica e verifica** e attendi il messaggio verde **"Pronto per l'uso offline"**.

> **Importante:** su iPhone l'app installata sulla Home ha una memoria **separata** da quella di Safari. Se prepari il viaggio nella scheda di Safari e poi apri l'icona, **dovrai ripetere "Prepara il viaggio" dall'icona**. Fallo sempre dall'app installata.
>
> Con altri browser (Chrome, Firefox…) l'opzione "Aggiungi alla schermata Home" dipende dalla versione di iOS: se non la trovi, usa Safari.

Posizione (GPS), la prima volta che premi **Attiva GPS** nella Mappa:

- scegli **"Consenti mentre usi l'app"** e lascia attiva la **posizione precisa** (Impostazioni → Privacy e sicurezza → Localizzazione → Safari/siti web);
- con l'app installata, iOS può richiedere di nuovo il permesso alle aperture successive;
- **iPhone non garantisce il tracciamento con lo schermo bloccato o con l'app in secondo piano**: tieni l'app aperta quando ti serve la posizione e controlla l'ora dell'ultimo aggiornamento mostrata.

## Android (Chrome)

1. Apri l'indirizzo **in Chrome**.
2. Menu **⋮** in alto a destra → **"Installa app"** (oppure **"Aggiungi a schermata Home"**). Se compare un banner "Installa", puoi usare quello; nell'app c'è anche il pulsante **"Installa l'app"** (in *Oggi*, nella scheda *Preparazione offline*).
3. Apri l'app dall'icona **Val di Fumo**.
4. In *Oggi*: **Prepara il viaggio → Scarica e verifica** e attendi **"Pronto per l'uso offline"**.

Altri browser Android: Samsung Internet → menu → "Aggiungi pagina a" → "Schermata Home"; Firefox → menu → "Installa". Il comportamento può variare.

Posizione (GPS): alla prima richiesta scegli **"Consenti solo mentre l'app è in uso"** (o "Precisa"). Controlla che **Posizione** sia attiva nelle impostazioni rapide. Il risparmio energetico/ottimizzazione batteria può sospendere l'app in secondo piano: tienila aperta.

## Test finale (consigliato, 2 minuti)

1. Attiva la **modalità aereo**.
2. **Chiudi del tutto l'app** (dal selettore delle app) e **riaprila dall'icona**.
3. In alto deve comparire **"Offline pronto"** (e "Senza rete"); la **Mappa** deve mostrare rilievo e traccia; **Percorso** e **Sicurezza** devono aprirsi.
4. Nella Mappa premi **Attiva GPS**: all'aperto la posizione può comparire anche senza dati mobili (il primo rilevamento può richiedere qualche decina di secondi senza assistenza di rete).

Se qualcosa non va: [OFFLINE.md → Se qualcosa non funziona](OFFLINE.md#se-qualcosa-non-funziona).

## Aggiornare l'app

Se compare il banner **"Nuova versione dell'app disponibile"**: **fallo a casa, con la rete e prima di partire**, mai durante l'escursione. Vai in *Sicurezza e offline → Mappe e uso offline → Applica l'aggiornamento dell'app*; l'app si ricarica. Poi ripeti **Prepara il viaggio** e il test in modalità aereo. Lo stato "pronto" non si eredita da una versione precedente.

## Disinstallare o ripartire da zero

- **Dati personali dell'app** (ultima posizione, orari registrati, preferenze, checklist): *Sicurezza e offline → Stato GPS e posizione → "Cancella posizione, orari e preferenze salvati"*.
- **Tutto** (app + pacchetto offline): tieni premuta l'icona e rimuovila. Su iPhone, per cancellare anche i dati del sito: Impostazioni → Safari → Avanzate → Dati dei siti web.

## Privacy

Nessun account, nessuna analisi d'uso, nessun annuncio. **La posizione GPS non viene letta finché non premi "Attiva GPS", resta sul telefono e non viene inviata a nessuno.** L'unica richiesta verso un servizio esterno è il **meteo** (Open-Meteo): invia le coordinate approssimative del rifugio e la data, non la tua posizione. I link per la navigazione stradale aprono l'app di mappe del telefono (che ha le proprie regole).
