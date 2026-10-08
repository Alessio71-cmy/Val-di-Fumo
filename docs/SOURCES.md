# Documentazione delle fonti

> File **generato** da `src/content/sources.json` (`python scripts/geodata/render_docs.py`). Non modificare a mano.

**Come leggere questo elenco.** Il livello di *attendibilita'* e' un giudizio editoriale (alta/media/bassa) sul tipo di fonte, non una
garanzia. Le fonti marcate *sintesi di ricerca* sono state lette solo tramite il riassunto prodotto dallo strumento di ricerca: le pagine
originali **non sono state aperte** e ogni dato va riverificato alla fonte. Le quattro fonti iniziali del brief erano **bloccate**
dalla policy di rete dell'ambiente di sviluppo e **non sono state consultate**.

## Dati aperti usati direttamente

### OpenStreetMap — estratto tramite Overture Maps (release 2026-09-23.1, snapshot OSM planet 2026-09-09)
- **ID**: `osm-overture`  ·  **Editore**: OpenStreetMap contributors / Overture Maps Foundation
- **URL**: <https://overturemaps.org>
- **Licenza**: ODbL-1.0 (dichiarata nei record `sources[].license`)
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: letta direttamente  ·  **Attendibilita'**: media
- **Usata per**: Geometria di sentieri/strade, ponti, parcheggi, cascate, edifici, laghi, torrenti, cime; ID OSM di ogni punto.
- **Note**: Dato collaborativo: nessun controllo sul campo. Ultima modifica OSM dei tratti della traccia principale tra 2014-02-13 e 2023-12-21. Overture non include le relazioni dei sentieri (numero SAT): il tracciato 240 NON e' identificabile per attributo ma solo per geometria.

### Terrain Tiles (formato Terrarium) su AWS Open Data — quote EU-DEM
- **ID**: `dem-terrarium`  ·  **Editore**: Tilezen/Mapzen (dati: Copernicus EU-DEM, ~25 m)
- **URL**: <https://registry.opendata.aws/terrain-tiles/>
- **Licenza**: Open data; attribuzione obbligatoria: "Produced using Copernicus data and information funded by the European Union - EU-DEM layers."
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: letta direttamente  ·  **Attendibilita'**: bassa
- **Usata per**: Quote dei punti, dislivelli, ombreggiatura, curve di livello, orizzonte del rilievo.
- **Note**: Risoluzione ~25 m: errori verticali anche di 20-30 m su versanti ripidi. Le quote derivate sono STIME.

### tilezen/joerd — docs/attribution.md (testo delle attribuzioni richieste)
- **ID**: `joerd-attribution`  ·  **Editore**: Tilezen
- **URL**: <https://github.com/tilezen/joerd/blob/master/docs/attribution.md>
- **Licenza**: Documentazione
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: letta direttamente  ·  **Attendibilita'**: alta
- **Usata per**: Formula di attribuzione EU-DEM e formato Terrarium.

### Open-Meteo — API di previsione (runtime, lato dispositivo)
- **ID**: `open-meteo`  ·  **Editore**: Open-Meteo.com
- **URL**: <https://open-meteo.com/>
- **Licenza**: CC BY 4.0 (uso non commerciale per l'API gratuita)
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: NON consultabile (host bloccato dall'ambiente di sviluppo)  ·  **Attendibilita'**: media
- **Usata per**: Meteo recuperato dal dispositivo quando c'e' rete e memorizzato con data/ora. Non testato dal vivo in sviluppo (host bloccato): solo con risposta simulata.
- **Note**: Non e' una previsione ufficiale di protezione civile: consultare Meteo Trentino.

## Riferimenti di calcolo

### astral (Python) — libreria di riferimento per alba/tramonto
- **ID**: `astral`  ·  **Editore**: Simon Kennedy
- **URL**: <https://pypi.org/project/astral/>
- **Licenza**: Apache-2.0
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: letta direttamente  ·  **Attendibilita'**: alta
- **Usata per**: Vettori di riferimento per i test dell'implementazione NOAA in TypeScript (alba, tramonto, crepuscolo civile).
- **Note**: Solo test: l'app calcola in locale, senza rete.

## Fonti ufficiali richieste dal brief

### SAT — Rifugio Val di Fumo (scheda ufficiale)
- **ID**: `sat-rifugio`  ·  **Editore**: Società degli Alpinisti Tridentini
- **URL**: <https://www.sat.tn.it/rifugio-val-di-fumo/>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: NON consultabile (host bloccato dall'ambiente di sviluppo)  ·  **Attendibilita'**: alta
- **Usata per**: NON CONSULTATA: host bloccato dalla policy di rete dell'ambiente di sviluppo. Da verificare.
- **Note**: Fonte prioritaria richiesta dal brief; resta la verifica piu' importante sull'apertura stagionale 2026.

### Parco Naturale Adamello Brenta — scheda Val di Fumo (PDF)
- **ID**: `pnab-val-di-fumo`  ·  **Editore**: Parco Naturale Adamello Brenta
- **URL**: <https://www.pnab.it/wp-content/uploads/2023/06/Val-di-Fumo.pdf>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: NON consultabile (host bloccato dall'ambiente di sviluppo)  ·  **Attendibilita'**: alta
- **Usata per**: NON CONSULTATA: host bloccato. Da verificare (percorso, regole del parco, accesso).
- **Note**: Contatti del Parco (da sintesi di ricerca): tel. 0465 806666, info@pnab.it.

### Visit Trentino — Cascata del Leno in Val di Daone
- **ID**: `visittrentino-leno`  ·  **Editore**: Trentino Marketing
- **URL**: <https://www.visittrentino.info/it/guida/natura/cascate/cascata-del-leno-in-val-di-daone_md_2309>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: NON consultabile (host bloccato dall'ambiente di sviluppo)  ·  **Attendibilita'**: alta
- **Usata per**: NON CONSULTATA: host bloccato.

## Altre fonti richieste dal brief

### Iter Edizioni — Lago di Bissina, Rifugio Val di Fumo, Bivacco Segalla
- **ID**: `iter-bissina`  ·  **Editore**: Iter Edizioni
- **URL**: <https://www.iteredizioni.it/lago-di-bissina-rifugio-val-di-fumo-bivacco-segalla/>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: NON consultabile (host bloccato dall'ambiente di sviluppo)  ·  **Attendibilita'**: media
- **Usata per**: NON CONSULTATA: host bloccato.

## Fonti secondarie (lette tramite WebSearch)

### Visit Trentino — scheda Rifugio Val di Fumo (Daone)
- **ID**: `vt-rifugio`  ·  **Editore**: Trentino Marketing
- **URL**: <https://www.visittrentino.info/pl/daone/rifugio/val-di-fumo_dr343796>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Apertura riportata: fine maggio – seconda domenica di ottobre (11/10/2026), con invito a sentire il gestore.
- **Note**: Letta solo tramite sintesi dello strumento di ricerca; pagina originale non aperta.

### PlanetMountain — Rifugio Val di Fumo alla Malga Val di Fumo
- **ID**: `planetmountain-rifugio`  ·  **Editore**: PlanetMountain
- **URL**: <https://www.planetmountain.com/it/rifugi/rifugio-val-di-fumo-alla-malga-val-di-fumo-val-di-fumo.html>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: bassa
- **Usata per**: Apertura 20 giugno – 30 settembre; tel. (0465) 804107; tempo ~1,3 h per il tratto 240.
- **Note**: La scheda cita ancora il gestore precedente: probabilmente datata.

### Bergwelten — Val di Fumo
- **ID**: `bergwelten-rifugio`  ·  **Editore**: Bergwelten
- **URL**: <https://www.bergwelten.com/h/node44373>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: bassa
- **Usata per**: Apertura giugno–settembre.
- **Note**: Cita ancora il gestore precedente: probabilmente datata.

### Montagna.TV — Il rifugio Val di Fumo cerca il nuovo gestore
- **ID**: `montagnatv-gestore`  ·  **Editore**: Montagna.TV
- **URL**: <https://www.montagna.tv/264410/il-rifugio-val-di-fumo-cerca-il-nuovo-gestore/amp/>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: 57 posti letto di cui 6 nel locale invernale; accesso piu' facile dalla diga ~1 h 45.

### l'Adige — Il rifugio SAT Val di Fumo affidato a Michela Foresti
- **ID**: `ladige-gestrice`  ·  **Editore**: l'Adige
- **URL**: <https://www.ladige.it/montagna/il-rifugio-sat-val-di-fumo-affidato-a-michela-foresti-g0dagimd>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Nuova gestione del rifugio (2026).

### il Dolomiti — articoli 2026 sul Rifugio Val di Fumo (contenuto sponsorizzato)
- **ID**: `ildolomiti-sponsored`  ·  **Editore**: il Dolomiti
- **URL**: <https://www.ildolomiti.it/montagna/2026/ho-scelto-di-mettermi-in-gioco-michela-foresti-30-anni-e-la-nuova-gestrice-del-rifugio-val-di-fumo-la-montagna-deve-restare-un-luogo-autentico-e-rispettato>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: bassa
- **Usata per**: Apertura indicativa 'da fine primavera a inizio autunno'; locale invernale da 6 posti; tempo dalla diga 1,5–1,75 h.
- **Note**: Contenuto sponsorizzato: date e tempi vanno confermati.

### suedtirol.live — Trekking al Rifugio Val di Fumo
- **ID**: `suedtirol-live-rifugio`  ·  **Editore**: suedtirol.live
- **URL**: <https://suedtirol.live/it/escursione/trekking-al-rifugio-val-di-fumo-t23294>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: bassa
- **Usata per**: Descrizione: scendere al primo tornante sotto il parcheggio, cartello del 240 e scorciatoia a piedi; anello ~12 km, 4,5 h.
- **Note**: Aggregatore: la descrizione del primo tratto non e' stata confermata da fonte ufficiale.

### Campiglio Dolomiti — Rifugio Val di Fumo (itinerario)
- **ID**: `campiglio-rifugio`  ·  **Editore**: APT Madonna di Campiglio
- **URL**: <https://campigliodolomiti.it/en/routes-trails/rifugio-val-di-fumo>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: A Malga Breguzzo si puo' scegliere la sponda del Chiese; la maggior parte sceglie la 'sinistra'.
- **Note**: 'Sinistra' e' ambiguo (orografica o del verso di marcia): l'app descrive le sponde con punti cardinali.

### Campiglio Dolomiti — Cascata del Leno in Valle di Daone
- **ID**: `campiglio-leno`  ·  **Editore**: APT Madonna di Campiglio
- **URL**: <https://www.campigliodolomiti.it/en/interesting-spots/cascata-del-leno-in-valle-di-daone>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Parcheggio centrale di Boazzo; ~5 minuti a piedi fino alla base della cascata; Daone a ~20 minuti d'auto; salto di ~150 m.
- **Note**: Un altro elenco riporta 300 m di altezza: dato discordante.

### trentino.com — Al Rifugio Val di Fumo
- **ID**: `trentino-rifugio`  ·  **Editore**: Trentino Marketing
- **URL**: <https://www.trentino.com/it/sport-e-tempo-libero/montagne-ed-escursioni/escursioni-estive/al-rifugio-val-di-fumo/>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Scheda: 3 h 40 min, 12,3 km a/r (rilevazione 2013); offre una traccia GPX (da scaricare da una rete non bloccata per il confronto).

### Campiglio Dolomiti — mobilita: Val di Daone – Val di Fumo (parcheggio)
- **ID**: `campiglio-parcheggio`  ·  **Editore**: APT Madonna di Campiglio
- **URL**: <https://mobilita.campigliodolomiti.it/en/location/valdidaone/parcheggio.html>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Parcheggio regolato/prenotabile, tariffe (4–6 € auto), navetta dai parcheggi di valle quando la diga e' piena.
- **Note**: Tariffe e calendario non coerenti con il 2026 nelle sintesi: verificare. Contatto PNAB: 0465 806666.

### l'Adige — A Malga Bissina automobili a numero chiuso, al massimo 250 al giorno fino alla diga
- **ID**: `ladige-250`  ·  **Editore**: l'Adige
- **URL**: <https://www.ladige.it/territori/giudicarie-rendena/a-malga-bissina-automobili-a-numero-chiuso-al-massimo-250-al-giorno-fin-oalla-diga-rhumnmsw>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Regime a numero chiuso (periodo Covid): non confermato per ottobre 2026.
- **Note**: Articolo datato.

### Provincia di Trento — Divieto di transito in Valle di Daone (comunicato 198, 31/01/2014)
- **ID**: `provincia-divieto-daone`  ·  **Editore**: Provincia autonoma di Trento — Ufficio stampa
- **URL**: <https://www.ufficiostampa.provincia.tn.it/Comunicati/DIVIETO-DI-TRANSITO-IN-VALLE-DI-DAONE>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: alta
- **Usata per**: Esempio di divieto invernale di transito nella valle (neve/valanghe): la strada puo' chiudere.
- **Note**: Datato (2014): indica la possibilita' di chiusure, non lo stato attuale.

### park4night — parcheggio alla diga di Malga Bissina (scheda 41861)
- **ID**: `park4night-bissina`  ·  **Editore**: park4night (contributi utenti)
- **URL**: <https://park4night.com/it/place/41861>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: bassa
- **Usata per**: Stagione del parcheggio ~1 maggio–30 ottobre; chiusura invernale per neve; un utente: gratuito fuori stagione (aneddoto).
- **Note**: Contributi non verificati.

### motorradundreisen.de — Val di Daone (valico/strada)
- **ID**: `motorrad-daone`  ·  **Editore**: motorradundreisen.de
- **URL**: <https://www.motorradundreisen.de/alpenpaesse/374_val-di-danone.html>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: bassa
- **Usata per**: Imbocco della Val Daone dalla SS237 (~15 km da Storo, subito dopo un ponte).

### calcolopercorso.it — Trento – Pergine Valsugana
- **ID**: `calcolopercorso-trento-pergine`  ·  **Editore**: calcolopercorso.it
- **URL**: <https://calcolopercorso.it/it/distanza/Trento/Pergine-Valsugana>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Calibrazione del modello di guida: 11,6 km, ~12 min.

### 112 Numero Unico Emergenze in Trentino (attivo dal 6 giugno 2017) e app Where ARE U
- **ID**: `112-trentino`  ·  **Editore**: Provincia autonoma di Trento / l'Adige / Fanpage
- **URL**: <https://www.ladige.it/cronaca/chiamate-di-emergenza-da-oggi-attivo-in-trentino-il-numero-europeo-112-risponde-la-centrale-unica-wdlerh03>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: 112 instrada anche al soccorso alpino; funziona su qualsiasi rete mobile disponibile, non senza alcuna copertura; app gratuita Where ARE U invia la posizione.
- **Note**: Instradamento in zone di confine (Val del Chiese verso Brescia) non confermato: indicare sempre provincia, comune e coordinate.

### Segnale di soccorso alpino: 6 segnali al minuto, risposta 3 al minuto
- **ID**: `segnale-soccorso`  ·  **Editore**: CNSAS / sintesi di articoli
- **URL**: <https://www.sportoutdoor24.it/sport/trekking/perche-dovresti-sempre-portare-un-fischietto-durante-le-escursioni>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Schema del segnale di richiesta di soccorso.
- **Note**: Procedura internazionale consolidata.

### Provincia di Trento — Stagione venatoria 2026-2027: nuove disposizioni (comunicato 991, 17/04/2026)
- **ID**: `caccia-2026-27`  ·  **Editore**: Provincia autonoma di Trento — Ufficio stampa
- **URL**: <https://www.ufficiostampa.provincia.tn.it/layout/set/print/Comunicati/Stagione-Venatoria-2026-2027-Approvate-le-nuove-disposizioni-e-limitazioni-tecniche>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Calendario provinciale: in ottobre alcuni prelievi sono aperti; nel Parco vale un regime diverso, non verificato.
- **Note**: Cautela: indossare capi ben visibili e restare sul sentiero.

### l'Adige — L'invito del Parco Adamello: tenete i cani al guinzaglio
- **ID**: `pnab-cani`  ·  **Editore**: l'Adige
- **URL**: <https://www.ladige.it/cronaca/linvito-del-parco-adamello-ci-sono-i-piccoli-di-ungulato-tenete-i-cani-al-guinzaglio-hjok06cn>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Raccomandazione del Parco di tenere i cani al guinzaglio (testo normativo non reperito).

### Italia.it — Val di Fumo (portale nazionale del turismo)
- **ID**: `italia-val-di-fumo`  ·  **Editore**: ENIT — Italia.it
- **URL**: <https://www.italia.it/it/trentino/cosa-fare/val-di-fumo>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: media
- **Usata per**: Malga Breguzzo descritta come struttura non più in uso (nessun servizio); rifugio aperto da fine primavera a fine estate con bar, ristorante e ~50 posti (6 nel locale invernale); Malga Val di Fumo come sosta per prodotti tipici.
- **Note**: Letta solo tramite sintesi di ricerca.

### Komoot — schede utenti: cascata sul Chiese / Malga Breguzzo (Val di Fumo)
- **ID**: `komoot-chiese`  ·  **Editore**: Komoot (contributi utenti)
- **URL**: <https://www.komoot.com/highlight/4507126>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: bassa
- **Usata per**: Cascata presso Malga Breguzzo all'inizio della Val di Fumo; una cascatella prima di un ponte in legno più vicino al rifugio (relazione di un utente, non localizzata).
- **Note**: Contributo di utenti, non verificato. L'identificazione precisa della scheda è approssimativa.

### Komoot — schede utenti: Lago di Malga Bissina (diga, pista, divieto per le biciclette oltre Breguzzo)
- **ID**: `komoot-bissina`  ·  **Editore**: Komoot (contributi utenti)
- **URL**: <https://www.komoot.com/highlight/1979748>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: bassa
- **Usata per**: Pista larga sulla sponda del lago fino al rifugio; restrizione al transito delle biciclette oltre Malga Breguzzo (2025); sommità della diga visitabile solo in certi giorni.
- **Note**: Contributi di utenti con date diverse e talvolta contraddittori; identificazione precisa della scheda approssimativa.

### il Dolomiti — itinerario Val di Fumo (contenuto sponsorizzato)
- **ID**: `ildolomiti-itinerario`  ·  **Editore**: il Dolomiti
- **URL**: <https://www.ildolomiti.it/altra-montagna/itinerari/un-piccolo-gioiello-di-25-chilometri-che-si-estende-tra-boschi-pascoli-e-alte-montagne-nelle-atmosfere-della-val-di-fumo-ai-piedi-delladamello>
- **Licenza**: —
- **Data di consultazione**: 2026-10-08  ·  **Modalita'**: solo sintesi dello strumento di ricerca (pagina non aperta)  ·  **Attendibilita'**: bassa
- **Usata per**: Dopo il ponte il sentiero SAT 222 sale al colle del rifugio; classificazione EE per l'itinerario completo (non adottata).
- **Note**: Contenuto sponsorizzato; la classificazione EE si riferisce all'itinerario completo, non al solo tratto fino al rifugio.
