# Pubblicazione su hosting HTTPS e condivisione del link

> **Stato:** nulla è stato pubblicato. Il repository contiene tutto il necessario (build statica, workflow, intestazioni consigliate), ma **pubblicare rende l'app visibile a chiunque abbia il link**: è una decisione del titolare del repository.

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

Il workflow di verifica `.github/workflows/ci.yml` (typecheck, test unitari, build, test E2E su Chromium) **non è stato eseguito** nell'ambiente di sviluppo: potrebbe richiedere piccoli aggiustamenti.

## Opzione B — Netlify / Cloudflare Pages

- Collegare il repository: comando di build `npm run build`, cartella di pubblicazione `dist`, Node 20. Oppure trascinare la cartella `dist/` nel pannello.
- Il file `dist/_headers` (da `public/_headers`) viene letto in automatico: imposta `no-cache` su `sw.js`, `precache-manifest.json`, `index.html`, `manifest.webmanifest`, `data/*`; cache immutabile su `assets/*`; **CSP restrittiva** (provata dai test) e `Permissions-Policy: geolocation=(self)`.

## Opzione C — Vercel

```bash
npm run build
npx vercel deploy dist --prod
```

(Se il progetto ha la protezione per le anteprime, il link deve essere **pubblico**, altrimenti gli amici vedranno una pagina di accesso.) Per le intestazioni usare `vercel.json` nella radice, copiando regole e CSP da `public/_headers`:

```json
{
  "headers": [
    { "source": "/(sw.js|precache-manifest.json|index.html|manifest.webmanifest)", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/(.*)", "headers": [
      { "key": "Content-Security-Policy", "value": "<copia la riga dal file public/_headers>" },
      { "key": "Permissions-Policy", "value": "geolocation=(self), camera=(), microphone=()" }
    ] }
  ]
}
```

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
