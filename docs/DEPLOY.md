# Pubblicazione su hosting HTTPS e condivisione del link

> **Stato (8 ottobre 2026): l'app è pubblicata su Vercel all'indirizzo https://val-di-fumo.vercel.app.** Progetto `val-di-fumo` nell'account Vercel del titolare, collegato a questo repository; distribuzione di produzione dal commit `3f692c1`, ID di versione dell'app `5c6971c70025`. **Chiunque abbia il link dovrebbe poterla aprire** (nessuna password, vedi sotto cosa non è verificato); le anteprime e gli indirizzi delle singole distribuzioni sono impostati come protetti dal login Vercel.
>
> **Non è stata provata dal vivo da chi l'ha pubblicata**: la rete dell'ambiente di sviluppo blocca `*.vercel.app`. Verificato soltanto che la distribuzione è «READY» e che ricompilando da zero il commit pubblicato (`npm ci` + `npm run build`, Node 22) si ottengono esattamente i file provati dai test (stesso ID di versione, 0 file diversi). **Non verificati:** le intestazioni HTTP servite (CSP, cache), che l'indirizzo sia davvero aperto senza login Vercel, l'installazione e l'uso offline sull'indirizzo reale. Fare i controlli del paragrafo «Controlli dopo la pubblicazione» **da un telefono non collegato a Vercel**.

L'app è **statica**: nessun server applicativo, nessuna chiave, nessun database, nessun account. Serve solo un hosting che consegni i file in `dist/` via **HTTPS** (indispensabile per service worker e geolocalizzazione).

```bash
npm ci
npm run build      # typecheck + build → dist/ (include sw.js stampato con l'ID di versione e precache-manifest.json)
npm run preview    # prova locale su http://127.0.0.1:4173
```

`base` è `./`: l'app funziona in qualsiasi sottocartella (es. `https://utente.github.io/Val-di-Fumo/`) senza configurazione.

## Opzione A — GitHub Pages (workflow incluso)

1. **Una tantum:** nel repository GitHub → *Settings → Pages → Build and deployment → Source: "GitHub Actions"*. (Per repository privati GitHub Pages richiede un piano che lo consenta.)
2. Il workflow `.github/workflows/pages.yml` parte a ogni push su **`main`**, oppure a mano da *Actions → "Pubblica su GitHub Pages" → Run workflow* scegliendo il ramo. Esegue typecheck, test unitari e build, poi pubblica `dist/`.
3. L'indirizzo sarà del tipo `https://<utente>.github.io/<repository>/` (per questo repository: `https://alessio71-cmy.github.io/Val-di-Fumo/`, da confermare nell'esito del workflow).
4. GitHub Pages **non permette intestazioni personalizzate**: nessuna CSP e cache HTTP di 10 minuti. È accettabile perché l'aggiornamento è governato dal service worker (che scarica `sw.js` e `precache-manifest.json` ignorando la cache HTTP).

Il workflow di verifica `.github/workflows/ci.yml` (typecheck, test unitari, build, test E2E su Chromium) parte a ogni push ed **è stato eseguito su GitHub**: le prime cinque esecuzioni sono fallite per un difetto di layout con font di sistema larghi (corretto, vedi [TEST-REPORT.md](TEST-REPORT.md) §6); l'esecuzione sul commit corretto è verde (67/67). Il workflow `pages.yml` invece **non è mai stato eseguito**: potrebbe richiedere piccoli aggiustamenti. Le azioni di GitHub usate mostrano un avviso di deprecazione di Node 20 (per ora non blocca nulla; gli aggiornamenti delle azioni vanno valutati dal titolare).

## Opzione B — Netlify / Cloudflare Pages

- Collegare il repository: comando di build `npm run build`, cartella di pubblicazione `dist`, Node 20. Oppure trascinare la cartella `dist/` nel pannello.
- Il file `dist/_headers` (da `public/_headers`) viene letto in automatico: imposta `no-cache` su `sw.js`, `precache-manifest.json`, `index.html`, `manifest.webmanifest`, `data/*`; cache immutabile su `assets/*`; **CSP restrittiva** (provata dai test) e `Permissions-Policy: geolocation=(self)`.

## Opzione C — Vercel

Il file `vercel.json` è **già incluso**: imposta la compilazione (Vite, `npm ci`, `npm run build`, cartella `dist`) e le stesse intestazioni di `public/_headers` (cache del service worker, CSP, `Permissions-Policy`). È generato da `public/_headers` con `npm run vercel-config`; il test unitario `vercel-config.test.ts` fallisce se i due file non sono allineati.

- Collegando il repository a un progetto Vercel (preset Vite, nessuna variabile d'ambiente), ogni push sul ramo di produzione pubblica una nuova versione: **dal giorno prima dell'escursione in poi evitare push che cambiano il codice** (ogni nuova versione obbliga a ripetere *Prepara il viaggio*). Le modifiche ai soli documenti non cambiano `dist/` e quindi nemmeno l'ID di versione dell'app.
- In alternativa, dalla propria macchina: `npm run build && npx vercel deploy --prod` (la CLI usa `vercel.json`).
- **Protezione:** il progetto `val-di-fumo` è nato con la protezione predefinita dell'account («tutte le distribuzioni tranne i domini personalizzati»), che senza un dominio personalizzato **dovrebbe chiedere il login Vercel anche sull'indirizzo di produzione**. È stata portata a *Standard Protection* (API: `prod_deployment_urls_and_all_previews`): l'indirizzo di produzione `val-di-fumo.vercel.app` dovrebbe essere pubblico, mentre gli indirizzi delle singole distribuzioni e delle anteprime chiedono l'accesso a Vercel. **Da confermare aprendo il link da un telefono:** se compare una pagina di accesso a Vercel, impostare *Settings → Deployment Protection → Vercel Authentication* su «Standard Protection» (o «Only Preview Deployments»). Agli amici va mandato **solo** `https://val-di-fumo.vercel.app`.

## Opzione D — qualsiasi server (nginx, Apache…)

Servire `dist/` con HTTPS valido. Regole minime: `Cache-Control: no-cache` per `sw.js`, `precache-manifest.json`, `index.html`, `manifest.webmanifest`; `.webmanifest` come `application/manifest+json`; `.geojson`/`.json` come JSON; **nessun reindirizzamento da https a http** e nessun contenuto misto.

## Controlli dopo la pubblicazione (5 minuti)

1. Aprire l'indirizzo **da un telefono**, con il lucchetto HTTPS.
2. `curl -I <indirizzo>/sw.js` → deve avere `content-type: …javascript` e non una cache lunga; `curl -s <indirizzo>/precache-manifest.json | head` → elenco delle risorse.
3. Installare l'app ([INSTALL.md](INSTALL.md)), **Prepara il viaggio**, attendere "Pronto per l'uso offline", poi **test in modalità aereo** ([OFFLINE.md](OFFLINE.md)).
4. In *Sicurezza e offline → Mappe e uso offline* leggere versione e data; annotarle (servono per capire chi ha quale versione).
5. Aprire *Mappa* → *Attiva GPS* all'aperto.

## Condividere il link

- Mandare l'indirizzo https **e** il link a [INSTALL.md](INSTALL.md) (o il suo testo). Dall'app, *Sicurezza e offline → Mappe e uso offline* ha i pulsanti **Condividi il link dell'app** e **Copia il link**. Un **codice QR** dell'indirizzo è comodo per chi è insieme (non è generato dall'app).
- Ricordare a ognuno di **preparare e testare il proprio telefono**: il link non prova nulla.
- Congelare le pubblicazioni **il giorno prima** dell'escursione: ogni nuova versione obbliga a ripetere *Prepara il viaggio* e a rifare il test su ogni telefono.

## Aggiornare dati o app

1. Modificare i contenuti/dati, `npm run test:all`, `npm run build`, pubblicare.
2. Chi ha già l'app vedrà **"Nuova versione dell'app disponibile"**: deve applicarla **a casa** e ripetere la preparazione. Il pacchetto mappa è versionato a parte: se non cambia, resta valido.
3. Per tornare indietro: ripubblicare la versione precedente (stessi passi); anche questo richiede un aggiornamento su ogni telefono.

## Cosa NON fare

- Non pubblicare con dati d'esempio o provenienza dubbia: ogni elemento mostra fonte e stato di validazione.
- Non inserire chiavi API, account o analisi d'uso: l'app è progettata per non averne.
- Non servire l'app da `file://` o da `http://` (tranne `localhost`): service worker e GPS non funzionano.
