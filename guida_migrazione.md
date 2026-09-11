# 🗂️ Guida alla migrazione: da Google Sheets a Postgres

Documento vivo: lo aggiorniamo insieme, un pezzo alla volta, senza fretta.
Ogni volta che completi un passo, spuntalo mentalmente e passiamo al successivo.

---

## ✅ FASE 1 — Progettare le tabelle del database

### Perché partire da qui

Prima di aprire un account da qualsiasi parte, dobbiamo sapere **esattamente** come
saranno fatte le tabelle nel nuovo database. Le ho ricostruite leggendo riga per
riga il tuo `Codice.gs` attuale, foglio per foglio, colonna per colonna — quindi
questo schema rispecchia **esattamente** quello che hai oggi, niente di più
niente di meno.

Oggi hai 8 fogli "veri" (contano anche quelli satellite):

| Foglio Google Sheets attuale | Diventa tabella Postgres |
|---|---|
| Anime | `anime` |
| episodiAnime | `episodi_anime` |
| SinossiAnime | `sinossi_anime` |
| Manga | `manga` |
| SinossiManga | `sinossi_manga` |
| Cinema | `cinema` |
| Tab_Log | `log_attivita` |
| Tab_LogEpisodi | `log_episodi` |

### Una cosa importante che ti tolgo dalle spalle

Oggi, quando rinomini un anime, il tuo codice deve **manualmente** andare a
rinominare la riga corrispondente su SinossiAnime e su episodiAnime
(`rinominaTitoloSinossiAnime_`, `rinominaTitoloEpisodi_`), e quando cancelli un
anime deve andare a cancellare a mano le righe figlie (`cancellaEpisodiPerTitolo_`).

Con un database relazionale vero, possiamo dire al database "quando rinomini o
cancelli un titolo in `anime`, aggiorna/cancella **da solo** tutto quello che è
collegato altrove" (si chiama `ON UPDATE CASCADE` / `ON DELETE CASCADE`). Meno
codice da mantenere, meno bug possibili.

### Un'altra piccola pulizia

Il colore delle righe (verde/giallo/celeste) oggi lo leggi dal colore di sfondo
della cella. Ma se guardi le funzioni `calcolaColoreVisioneAnime_` e
`calcolaColoreLetturaManga`, il colore **si calcola sempre dagli altri dati**
(stato, episodi visti, ecc.) — non è un'informazione a sé stante. Quindi nel
database **non serve salvarlo**: lo ricalcoleremo al volo quando servirà,
esattamente con la stessa formula che hai già. Un problema in meno da tenere
sincronizzato.

---

### Tabella `anime`

Colonne del foglio "Anime" oggi (A→L): Titolo, Stato, Note, Valutazione,
StagioniTotali, StagioniViste, FilmTotali, FilmVisti, Generi, Preferito,
Immagine, Priorità.

```sql
CREATE TABLE anime (
    id                SERIAL PRIMARY KEY,
    titolo            TEXT NOT NULL UNIQUE,
    stato             TEXT NOT NULL DEFAULT 'In corso',
    note              TEXT DEFAULT '',
    valutazione       NUMERIC(3,1),              -- da 0.0 a 10.0, NULL = "nessun voto" (oggi era '-')
    stagioni_totali   INTEGER NOT NULL DEFAULT 0,
    stagioni_viste    INTEGER NOT NULL DEFAULT 0,
    film_totali       INTEGER NOT NULL DEFAULT 0,
    film_visti        INTEGER NOT NULL DEFAULT 0,
    generi            TEXT DEFAULT '',            -- restano una stringa "Azione, Avventura, ..." come oggi
    preferito         BOOLEAN NOT NULL DEFAULT FALSE,
    immagine          TEXT DEFAULT '',
    priorita          BOOLEAN NOT NULL DEFAULT FALSE,
    creato_il         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Spiegazione riga per riga (così capisci ogni scelta, poi per le altre tabelle andrò più veloce):**
- `id SERIAL PRIMARY KEY`: numero automatico 1, 2, 3... che il database assegna da solo. Non lo vedrai mai nell'interfaccia, è "dietro le quinte".
- `titolo TEXT NOT NULL UNIQUE`: è il tuo vecchio "indice" — `UNIQUE` vuol dire che il database stesso ti impedisce di avere due opere con lo stesso identico titolo (oggi questo controllo non esisteva per niente lato foglio).
- `valutazione NUMERIC(3,1)`: numero decimale (es. 8.5), può restare vuoto (`NULL`) finché non voti — il frontend continuerà a mostrare "-" quando è vuoto, semplicemente lo decide lui.
- `preferito BOOLEAN` e `priorita BOOLEAN`: oggi sono la stringa "Sì" o cella vuota; nel database diventano un vero e proprio "sì/no" (`TRUE`/`FALSE`), più pulito e più veloce da interrogare.
- `creato_il TIMESTAMPTZ`: un bonus che oggi non hai — sapere quando hai aggiunto un'opera, gratis, perché il database lo scrive da solo.

### Tabella `episodi_anime`

Foglio "episodiAnime" oggi: Titolo, Tipo, Numero, Episodi Totali, Episodi Visti.

```sql
CREATE TABLE episodi_anime (
    id              SERIAL PRIMARY KEY,
    anime_titolo    TEXT NOT NULL REFERENCES anime(titolo)
                        ON UPDATE CASCADE ON DELETE CASCADE,
    tipo            TEXT NOT NULL CHECK (tipo IN ('Stagione', 'Film')),
    numero          INTEGER NOT NULL,
    episodi_totali  INTEGER NOT NULL DEFAULT 0,
    episodi_visti   INTEGER NOT NULL DEFAULT 0,
    UNIQUE (anime_titolo, tipo, numero)
);
```

- `REFERENCES anime(titolo) ON UPDATE CASCADE ON DELETE CASCADE`: è la parte "magica" spiegata sopra. Se rinomini l'anime in `anime`, tutte le righe qui si aggiornano da sole. Se lo cancelli, spariscono da sole anche queste. Zero codice extra da scrivere per questo.
- `CHECK (tipo IN ('Stagione', 'Film'))`: il database stesso rifiuta un valore diverso da questi due, come una specie di "controllo ortografico" automatico.
- `UNIQUE (anime_titolo, tipo, numero)`: impedisce doppioni (es. due righe "Stagione 1" per lo stesso anime).

### Tabella `sinossi_anime`

```sql
CREATE TABLE sinossi_anime (
    anime_titolo  TEXT PRIMARY KEY REFERENCES anime(titolo)
                     ON UPDATE CASCADE ON DELETE CASCADE,
    sinossi       TEXT DEFAULT ''
);
```

Qui il titolo stesso è la chiave: c'è al massimo una sinossi per opera, proprio
come oggi (una riga per titolo su SinossiAnime).

### Tabella `manga`

Foglio "Manga" oggi (A→K): Titolo, Tipologia, Volumi, Stato, Acquistato, Note,
Generi, Preferito, Immagine, VolumiLetti, Priorità.

```sql
CREATE TABLE manga (
    id             SERIAL PRIMARY KEY,
    titolo         TEXT NOT NULL UNIQUE,
    tipologia      TEXT NOT NULL DEFAULT 'Manga',
    volumi         INTEGER NOT NULL DEFAULT 0,       -- volumi totali dell'opera
    stato          TEXT NOT NULL DEFAULT 'In corso',
    acquistato     BOOLEAN NOT NULL DEFAULT FALSE,    -- oggi era testo "Sì"/"No"
    note           TEXT DEFAULT '',
    generi         TEXT DEFAULT '',
    preferito      BOOLEAN NOT NULL DEFAULT FALSE,
    immagine       TEXT DEFAULT '',
    volumi_letti   INTEGER NOT NULL DEFAULT 0,
    priorita       BOOLEAN NOT NULL DEFAULT FALSE,
    creato_il      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabella `sinossi_manga`

```sql
CREATE TABLE sinossi_manga (
    manga_titolo  TEXT PRIMARY KEY REFERENCES manga(titolo)
                     ON UPDATE CASCADE ON DELETE CASCADE,
    sinossi       TEXT DEFAULT ''
);
```

### Tabella `cinema`

Foglio "Cinema" oggi: Titolo, Data Uscita, Data Visione, Visione, Immagine, Streaming.

```sql
CREATE TABLE cinema (
    id            SERIAL PRIMARY KEY,
    titolo        TEXT NOT NULL,
    data_uscita   DATE,                              -- vero tipo DATA, non più testo "a mano"
    data_visione  DATE,
    visione       BOOLEAN NOT NULL DEFAULT FALSE,
    immagine      TEXT DEFAULT '',
    streaming     BOOLEAN NOT NULL DEFAULT FALSE
);
```

Piccola nota positiva: oggi nel tuo codice c'è tutta una funzione
(`formattaDataCinemaISO_`) dedicata solo a raddrizzare le date perché Google
Sheets a volte le "impasticcia" da solo. Con una vera colonna `DATE` in
Postgres questo problema non esiste strutturalmente: o è una data valida, o il
database la rifiuta subito dicendotelo, niente sorprese silenziose.

Qui **non** metto `UNIQUE` sul titolo perché nel tuo flusso, quando un film in
streaming viene confermato, la riga viene eliminata — quindi in teoria in
futuro potresti ri-aggiungere lo stesso titolo. Nessun problema a lasciarlo
libero.

### Tabella `log_attivita` (era Tab_Log)

```sql
CREATE TABLE log_attivita (
    id                  BIGSERIAL PRIMARY KEY,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT now(),
    id_titolo           TEXT NOT NULL,
    tipo_media          TEXT NOT NULL CHECK (tipo_media IN ('ANIME', 'MANGA', 'CINEMA')),
    tipo_evento         TEXT NOT NULL,   -- CREAZIONE / AVANZAMENTO / COMPLETAMENTO / VOTO / CAMBIO_STATO / ACQUISTO
    valore_precedente   TEXT,
    valore_nuovo        TEXT
);
```

Questa è la tabella che risolve *esattamente* il problema che hai raccontato
all'inizio: oggi, per evitare che Sheets trasformi "4/5" in una data, devi
forzare a mano il formato testo delle colonne (quel blocco commentato
"IMPORTANTE" che hai in `registraLog`). In una colonna `TEXT` di Postgres
questo bug **non può accadere per definizione**: il database non "indovina"
mai il tipo di un dato, tu gli dici che è testo e lui lo tratta sempre e solo
come testo.

### Tabella `log_episodi` (era Tab_LogEpisodi)

```sql
CREATE TABLE log_episodi (
    id                    BIGSERIAL PRIMARY KEY,
    timestamp             TIMESTAMPTZ NOT NULL DEFAULT now(),
    titolo                TEXT NOT NULL,
    tipo                  TEXT NOT NULL CHECK (tipo IN ('Stagione', 'Film')),
    numero                INTEGER NOT NULL,
    episodio_precedente   INTEGER NOT NULL DEFAULT 0,
    episodio_nuovo        INTEGER NOT NULL DEFAULT 0,
    episodi_totali        INTEGER NOT NULL DEFAULT 0,
    azione                TEXT NOT NULL,   -- VISTO / RIMOSSO
    esito                 TEXT DEFAULT ''  -- COMPLETAMENTO / IN_PARI / AVANZAMENTO / vuoto
);
```

Nota: qui i log **non** hanno la foreign key `ON DELETE CASCADE` verso
`anime`/`manga`. È voluto: se cancelli un'opera, il registro storico
("quello che è successo") deve restare intatto per sempre, esattamente come
oggi il tuo Tab_Log non viene mai ripulito quando cancelli un'opera.

---

## ✅ FASE 2 — Account Supabase creato

- Servizio scelto: **Supabase** (non Neon, per la comodità della REST API automatica).
- Progetto: `tracker-anime-manga`, organizzazione `MieiProgetti`, piano Free.
- **API URL**: `https://jcclzcyezqbhmxptlnoo.supabase.co/rest/v1/`
- **Secret key**: salvata in luogo sicuro (mai condividerla, mai incollarla in chat).
- Impostazioni Data API: Data API ✅ · Auto-expose nuove tabelle ⬜ (disattivato) · Auto RLS ✅.

## ✅ FASE 3 — Creazione delle tabelle

Schema SQL eseguito tramite **SQL Editor** del progetto Supabase (vedi blocco SQL
completo condiviso in chat, tutte le 8 tabelle di Fase 1 nell'ordine corretto).

## ✅ FASE 3 — Tabelle create

Tutte e 8 le tabelle create con successo in Supabase (verificate nel Table Editor:
anime, cinema, episodi_anime, log_attivita, log_episodi, manga, sinossi_anime,
sinossi_manga — l'ordine alfabetico mostrato dal pannello è solo estetico).

## ⏳ FASE 4 — Migrazione dei dati da Google Sheets a Supabase
*(script "una tantum" dentro Apps Script, da eseguire tabella per tabella)*

**Note tecniche imparate strada facendo (utili se ricapita in futuro):**
- La **secret key nuova** (`sb_secret_...`) blocca le chiamate che sembrano
  provenire da un browser guardando l'header `User-Agent` — e Apps Script non
  permette di personalizzare davvero quell'header, quindi da Apps Script va
  usata invece la chiave **`service_role`** (si trova in Supabase → Settings →
  API Keys → scheda "Legacy anon, service_role API keys").
- Le tabelle create a mano via SQL Editor non hanno di default i permessi di
  scrittura per `service_role`: vanno concessi una volta con `GRANT ALL ON ALL
  TABLES IN SCHEMA public TO service_role;` (+ `ALTER DEFAULT PRIVILEGES...`
  per le tabelle future). Fatto una volta sola, vale per sempre.

**Avanzamento:**
- [x] `migrateAnime()` → 181/181 righe migrate correttamente ✅
- [x] `migrateEpisodiESinossiAnime()` → 345 righe episodi + 181 sinossi ✅
- [x] `migrateManga()` → 67/67 righe migrate ✅
- [x] `migrateSinossiManga()` → 67/67 righe migrate ✅
- [x] `migrateCinema()` → 255/255 righe migrate ✅
- [ ] `migrateLogAttivita()`
- [ ] `migrateLogEpisodi()`

## ✅ FASE 4 — Migrazione dati completata

Tutte le tabelle migrate e verificate:
anime 181 · episodi_anime 345 · sinossi_anime 181 · manga 67 · sinossi_manga 67
· cinema 255 · log_attivita ✅ · log_episodi ✅. Tutti i conteggi corrispondono
ai fogli originali.

## ⏳ FASE 5 — Collegare Codice.gs a Supabase
*(riscriviamo le funzioni una alla volta, il frontend non cambia)*

Lavoriamo su una **copia di test** del progetto (Google Sheet "My Tracker - TEST"
+ relativo Apps Script + deployment separato), per non toccare mai il sito
usato ogni giorno finché non siamo sicuri al 100%.

File aggiunti alla copia di test:
- `SupabaseClient.gs` → funzioni di appoggio (`supabaseConfig_`, `sbHeaders_`, `sbSelect_`, `sbInsert_`, ...)
- Le funzioni originali vengono rinominate `nomeFunzione_OLD_SHEET` invece di
  essere cancellate, così restano come riferimento/paracadute.

**Checklist completa (roadmap dell'intera Fase 5):**

*Gruppo ANIME*
- [x] `getAnimeData()` ✅
- [x] `addAnime()` ✅
- [x] `updateAnime()` ✅
- [x] `deleteAnime()` ✅
- [x] `getEpisodiAnimeData()` / `getTuttiEpisodiAnime()` ✅
- [x] `updateEpisodioVisti()` / `updateEpisodioTotali()` ✅
- [x] `ricalcolaProgressoAnime()` / `_ricalcolaSincronizzaELogga()` ✅
- [x] `toggleAnimePreferito()` / `toggleAnimePriorita()` / `impostaVotoAnime()` ✅
- [x] `getSinossi()` / `impostaSinossi()` (gestiscono sia anime che manga, fatte una volta per tutte) ✅
- [x] 🗑️ Eliminate: `rinominaTitoloEpisodi_`, `rinominaTitoloSinossiAnime_`, `cancellaEpisodiPerTitolo_`

**GRUPPO ANIME COMPLETATO E TESTATO** (episodi sequenziali, vincolo "completa prima N-1",
modifica titolo con CASCADE automatico, preferiti/priorità/voto, cancellazione con CASCADE,
log_attivita intatto dopo cancellazione — tutto verificato ok).

*Gruppo MANGA*
- [x] `getMangaData()`, `addManga()`, `updateManga()`, `updateMangaVolumiLetti()`, `deleteManga()` ✅
- [x] `toggleMangaPreferito()` / `flagMangaAcquistato()` / `toggleMangaPriorita()` ✅
- [x] `getSinossi()` / `impostaSinossi()` (già fatte insieme al gruppo anime) ✅

**GRUPPO MANGA COMPLETATO E TESTATO.**

📝 Nota per dopo (non bloccante, non legata alla migrazione): cliccando molto
rapidamente i pulsanti +/- dei volumi letti, l'ordine dei numeri nel log può
apparire "sfalsato" (es. 1→2, 0→1, 2→3...) perché il frontend non disabilita
il pulsante mentre aspetta la risposta del server — capita probabilmente
anche con la versione a foglio. Il valore finale mostrato è sempre corretto.
Miglioramento facoltativo futuro: disabilitare il pulsante durante l'attesa.

*Gruppo CINEMA*
- [x] `getCinemaData()`, `addCinema()`, `toggleVisioneCinema()`, `confermaVisioneStreamingCinema()`, `modificaDataVisioneCinema()`, `eliminaCinema()` ✅

**GRUPPO CINEMA COMPLETATO E TESTATO** (creazione normale/streaming, log
selettivo, visto/non visto con data, conferma streaming, blocco cancellazione
film visti — tutto verificato ok). Eliminata `getCinemaSheet_` (obsoleta).

*Gruppo LOG*
- [x] `registraLog()` ✅
- [x] `ottieniUltimiLog()` ✅
- [x] `registraLogEpisodio_()` / `ottieniLogEpisodi()` ✅
- [x] `_leggiTabLogCompleto_()` ✅

**GRUPPO LOG COMPLETATO E TESTATO** (filtri, ordinamento, intervallo date,
tutto verificato ok). Eliminata `getLogEpisodiSheet_` (obsoleta). Le funzioni
di lettura si sono accorciate molto: filtri/ordinamento/limite ora li fa
il database con una query, non più uno scan manuale riga per riga.

*Gruppo RICERCA/STATISTICHE*
- [x] `getStatsData()` ✅ (nessuna modifica necessaria: si appoggiava già solo su funzioni già convertite)
- [x] `getIndiceRicerca()` ✅ (riscritta appoggiandosi a getAnimeData/getMangaData/getCinemaData invece di duplicare la lettura fogli)

*Varie*
- [x] `getSpreadsheetUrl()` ✅ — deciso: punta al Table Editor di Supabase (stesso bottone, stessa etichetta nel sito)

**FASE 5 COMPLETATA E TESTATA AL 100%** (ricerca globale + bottone Supabase, verificati ok). Tutti i gruppi (Anime, Manga, Cinema, Log, Ricerca/Statistiche) migrati e testati.

**Invariate, nessuna modifica necessaria:** tutte le funzioni AniList/TMDB
(`eseguireRichiestaAniList_`, `cercaCandidatiCinemaTMDB`, ecc.), le funzioni di
calcolo colore (`calcolaColoreVisioneAnime_`, `calcolaColoreLetturaManga`,
...), gli helper statistici puri (`_round1_`, `_parseGeneriString_`, ecc.).

## ✅ FASE 6 — Passaggio in produzione COMPLETATO

Backup del foglio originale creato ("My Tracker - BACKUP pre-migrazione").
Tabelle Supabase ripulite (`TRUNCATE ... RESTART IDENTITY CASCADE`) e
rimigrate con i dati aggiornati direttamente dal progetto di produzione.
`SupabaseClient.gs` portato nel progetto vero, `Migrazione.gs` di produzione
ripulito dalla `supabaseConfig_` duplicata, `Codice.gs` sostituito con la
versione pulita (senza le funzioni `_OLD_SHEET`), deployment aggiornato sullo
stesso URL di sempre. Verifica finale ok.

Aggiunta post-migrazione: bottone "sposta in streaming" nella sezione Cinema
(nuova funzione `trasformaCinemaInStreaming`, icona 📺 accanto al cestino).

## 📌 Stato attuale del progetto

Il sito è **in produzione su Supabase**, stesso URL di sempre, tutte le
funzioni migrate e testate (Anime, Manga, Cinema, Log, Ricerca/Statistiche).

**Prestazioni**: la maggior parte delle azioni è scattante. Fa eccezione
"segna episodio visto" (~3.5s invece di essere istantaneo come il manga),
per via di una catena di più chiamate a Supabase necessarie a quella logica
specifica (verifica episodio precedente + ricalcolo progresso + log). Già
ottimizzata due volte (chiamate unite con "embedding" + scritture in
parallelo con `UrlFetchApp.fetchAll`), margine di ulteriore taglio ormai
minimo restando su Apps Script. Deciso di lasciarla così per ora — non vale
lo sforzo di un cambio di infrastruttura per una sola azione.

**💡 Idea per il futuro (non urgente, valutare insieme se/quando interessa):**
La causa di fondo dei 3-4 secondi non è più il database, ma l'overhead
strutturale di Google Apps Script come "ponte" tra sito e server (il
meccanismo `google.script.run` + il costo fisso di ogni chiamata
`UrlFetchApp`). Per eliminarlo davvero servirebbe spostare il frontend fuori
da Apps Script (es. hosting gratuito su Cloudflare Pages/Vercel/GitHub Pages)
e far parlare il sito con Supabase più direttamente (via le sue funzioni
serverless o le regole di sicurezza a livello di riga). È un cambio di
impianto paragonabile per portata all'intera Fase 5, quindi solo se un giorno
vale la pena investirci.

**Altre piccole note aperte, non bloccanti:**
- Click rapidi ripetuti sui pulsanti +/- (manga) possono mostrare il log in
  ordine "sfalsato" — valore finale sempre corretto, miglioramento facoltativo:
  disabilitare il pulsante durante l'attesa risposta server.
- `Migrazione.gs` può restare nel progetto di produzione (innocuo) o essere
  rimosso per pulizia, quando vuoi.
- Il foglio Google originale resta "in pensione" come archivio storico.

---

# 🚀 PARTE 2 — Da Apps Script a sito statico (GitHub Pages + Supabase diretto)

Nuova chat, nuovo obiettivo: eliminare Apps Script come "ponte" tra sito e
database, per risolvere il ritardo strutturale (~3.5s su "segna episodio
visto") e avere un sito vero, veloce, ospitato gratis.

**Decisioni prese all'inizio di questa fase:**
- 🔐 Protezione d'accesso: **login vero con Supabase Auth** (non solo URL
  segreto) — un'unica utenza autorizzata, il resto del mondo non entra.
- 🐙 Account GitHub: **da creare da zero** (mai usato prima).

**Cosa NON cambia rispetto a Parte 1:** schema del database (8 tabelle),
grafica/CSS del sito, logica di business (viene tradotta, non reinventata).

### Roadmap di questa parte (aggiornata man mano che si avanza)

- [ ] **Fase 7** — Creare l'account GitHub e il repository per il sito
- [ ] **Fase 8** — Pubblicare `index.html` "così com'è" su GitHub Pages (sito online, ancora collegato al vecchio backend Apps Script) — per avere da subito un URL vero da usare
- [ ] **Fase 9** — Attivare Supabase Auth: creare l'utenza autorizzata e la pagina/schermata di login
- [ ] **Fase 10** — Attivare la Row Level Security sulle 8 tabelle con le policy giuste (solo l'utente autenticato legge/scrive)
- [ ] **Fase 11** — Creare il client Supabase lato browser (chiave pubblica `anon`) e sostituire, un gruppo alla volta come nella Fase 5, le chiamate `google.script.run.xxx()` con chiamate dirette a Supabase (Anime → Manga → Cinema → Log → Ricerca/Statistiche)
- [ ] **Fase 12** — Spostare la chiave segreta TMDB in una Supabase Edge Function, e adattare `cercaCandidatiCinemaTMDB` / `getDettaglioCinemaTMDB` per passare da lì
- [ ] **Fase 13** — Decidere se anche AniList merita lo stesso trattamento o può restare una chiamata diretta dal browser
- [ ] **Fase 14** — Portare in JavaScript frontend (o in funzioni Postgres dove più sensato) tutta la logica ancora "orfana": calcolo colori, validazioni, cascade manuali non coperti da RLS/foreign key, log
- [ ] **Fase 15** — Test end-to-end e spegnimento definitivo del vecchio deployment Apps Script

---

## ⏳ FASE 7 — Account GitHub e repository del sito

*(completata ✅)*

**Avanzamento:**
- [x] Account GitHub creato (registrazione tramite Google, non email/password — equivalente)
- [x] Repository creata, nome scelto: **`tracker-anime-manga`**, **pubblica**
      (repository pubblica = ok anche per sicurezza, dato che proteggeremo
      l'accesso con Supabase Auth + RLS, non con la segretezza del codice)
- [x] Caricamento `index.html` come `index.html` nella repository
- [x] Attivazione GitHub Pages

### Perché partire da qui

GitHub Pages è il servizio (gratuito) che prenderà i file del tuo sito e li
"servirà" a un indirizzo web pubblico, esattamente come fa oggi
`HtmlService` di Apps Script — ma senza il ponte lento in mezzo. Per usarlo
serve prima un account GitHub e un "repository" (la cartella online che
conterrà i file del sito).

### Passo 1 — Creare l'account GitHub

1. Vai su **https://github.com/signup** (aprilo in una nuova scheda).
2. Ti chiederà un **indirizzo email**: usa una email che controlli davvero,
   perché GitHub manda un'email di verifica con un codice.
3. Poi ti chiederà di **creare una password**: scegline una robusta, magari
   salvala nel gestore password che usi di solito.
4. Poi ti chiederà di scegliere uno **username** (il nome pubblico del tuo
   account, es. `marco-rossi123`): può essere qualsiasi cosa, non deve avere
   per forza a che fare col progetto. Attenzione: **sarà visibile
   pubblicamente** nell'URL del sito finale (es.
   `https://tuousername.github.io/nome-repository/`), quindi se preferisci
   restare anonimo scegline uno che non ti identifichi.
5. Ti farà rispondere a una domanda tipo "vuoi ricevere aggiornamenti via
   email?" — rispondi come preferisci, non è rilevante.
6. Potrebbe chiederti di risolvere un piccolo puzzle/captcha per verificare
   che non sei un robot.
7. A questo punto ti manda un'email con un **codice di verifica** a 6-8
   cifre: aprila e inserisci il codice nella pagina di GitHub.
8. Fatto: sei dentro alla tua dashboard GitHub (si chiama "Dashboard" o
   dopo il login potresti vedere una breve serie di domande facoltative
   tipo "cosa vuoi fare su GitHub" — puoi anche saltarle con "Skip
   personalization" in basso).

Quando hai fatto questo passo, dimmelo e ti spiego il prossimo (creare il
repository che conterrà `index.html`).

### Passo 2 — Creare il repository ✅ fatto

Repository creata: **`tracker-anime-manga`**, pubblica, con README.

### Passo 3 — Caricare `index.html` nella repository

Per ora carichiamo il file **così com'è**, identico a quello che hai oggi
(ancora pieno di `google.script.run`, non funzionerà ancora del tutto una
volta online) — l'obiettivo di questo passo è solo avere un URL vero e
verificare che GitHub Pages funzioni. Sistemeremo le chiamate al backend
nelle fasi successive.

1. Apri la tua repository: `https://github.com/tuousername/tracker-anime-manga`
2. Clicca il pulsante **"Add file"** (in alto a destra, sopra l'elenco file) → **"Upload files"**.
3. Trascina il tuo file `Index.html` nella zona tratteggiata (oppure clicca "choose your files" e selezionalo dal computer).
4. **Importante**: GitHub Pages cerca un file che si chiama **esattamente** `index.html` (minuscolo). Se il tuo file oggi si chiama `Index.html` (con la I maiuscola, come in Apps Script), dopo il caricamento clicca sulla matita (✏️ "rinomina") accanto al nome del file nella schermata di riepilogo, e correggilo in `index.html` tutto minuscolo, prima di confermare.
5. In basso, nel riquadro "Commit changes", puoi lasciare il messaggio proposto di default (es. "Add files via upload").
6. Clicca il pulsante verde **"Commit changes"**.

Il file ora è nella repository. Dimmi quando fatto e passiamo all'attivazione di GitHub Pages (il passo che rende il sito effettivamente visibile a un indirizzo pubblico).

### Passo 4 — Attivare GitHub Pages

1. Nella tua repository, vai su **"Settings"** (in alto, nella barra dei tab della repository — non le impostazioni del tuo account, quelle della repository).
2. Nel menu a sinistra, clicca su **"Pages"**.
3. Sotto "Build and deployment" → "Source", assicurati sia selezionato **"Deploy from a branch"**.
4. Subito sotto, in "Branch", scegli **`main`** e come cartella **`/ (root)`**, poi clicca **"Save"**.
5. Aspetta 1-2 minuti (GitHub Pages impiega un attimo a pubblicare la prima volta), poi ricarica la pagina "Settings → Pages": in alto dovresti vedere una scritta verde tipo *"Your site is live at https://tuousername.github.io/tracker-anime-manga/"*.

Quel link sarà il nuovo indirizzo del tuo sito (per ora ancora "rotto" per via delle chiamate ad Apps Script, è normale). Mandamelo quando ce l'hai, così verifichiamo insieme che si apra e passiamo alla Fase 8.

## ✅ FASE 7 — Completata

Sito online e raggiungibile: **https://djkata94.github.io/tracker-anime-manga/**
Verificato: pagina, CSS e struttura si caricano correttamente. I dati non
compaiono ancora (le chiamate `google.script.run` non funzionano fuori da
Apps Script) — atteso, si risolve nelle fasi successive.

## ✅ FASE 8 — Sito pubblicato su GitHub Pages

Di fatto già completata insieme alla Fase 7 (caricamento file + attivazione
Pages = pubblicazione). Nessun passo aggiuntivo necessario.

## ⏳ FASE 9 — Attivare Supabase Auth (login)

*(in corso)*

### Perché questo passo prima della Row Level Security

La Row Level Security (Fase 10) ha bisogno di sapere **chi** è loggato per
poter dire "solo questo utente specifico può leggere/scrivere". Quindi prima
creiamo l'utenza di login, poi scriviamo le regole che la usano.

Useremo l'autenticazione più semplice possibile per un caso a **singolo
utente** come il tuo: email + password, con un'unica utenza (la tua), niente
registrazione pubblica aperta ad altri.

### Passo 1 — Attivare il provider Email in Supabase

1. Vai sul tuo progetto Supabase (`tracker-anime-manga`), sezione
   **Authentication** (icona a forma di persona/scudo nel menu a sinistra).
2. Clicca sulla scheda **"Providers"** (o "Sign In / Providers" a seconda
   della versione dell'interfaccia).
3. Assicurati che **"Email"** sia **attivo** (di solito lo è già di
   default in un progetto nuovo — se vedi un interruttore/toggle verde
   acceso va bene così).
4. Clicca su "Email" per aprirne le impostazioni e controlla questa voce:
   **"Confirm email"** — per un'utenza unica creata da te stesso, puoi
   **disattivarla** (così non devi confermare via email ogni volta che crei
   l'utenza), oppure lasciarla attiva se preferisci il passaggio extra di
   sicurezza. Ti consiglio di **disattivarla** per semplicità, tanto l'unica
   utenza sarai tu.
5. Salva se hai cambiato qualcosa.

### Passo 2 — Creare la tua utenza di login

1. Sempre in **Authentication**, vai sulla scheda **"Users"**.
2. Clicca **"Add user"** → **"Create new user"**.
3. Inserisci una **email** (può essere una qualsiasi tua email, non deve
   corrispondere a quella dell'account Supabase) e una **password robusta**
   — salvale entrambe da qualche parte sicura, ti serviranno per accedere al
   sito ogni volta.
4. Se compare la casella **"Auto Confirm User"**, spuntala (evita il
   passaggio di conferma email per questa utenza creata a mano).
5. Clicca **"Create user"**.

Dimmi quando hai fatto questi due passi e passiamo a scrivere la pagina di
login vera e propria (l'aggiungeremo a `index.html`, senza toccare il resto
della grafica).

**Avanzamento:**
- [x] Provider Email verificato attivo in Supabase (era già acceso di default)
- [x] Utenza di login creata a mano in "Users", con "Auto Confirm User"
- [ ] Recupero URL progetto + chiave pubblica `anon` (servono per collegare il sito a Supabase)
- [ ] Scrittura schermata di login in `index.html`

### Passo 3 — Recuperare URL progetto e chiave pubblica `anon`

Per collegare il sito (che gira nel browser, senza server dietro) a
Supabase, servono due informazioni che **non sono segrete** — sono fatte
apposta per stare in chiaro nel codice del frontend, a differenza della
`service_role` usata da `SupabaseClient.gs` che invece va sempre tenuta
nascosta:

1. Nel progetto Supabase, vai su **Settings** (icona ingranaggio in basso a
   sinistra) → **API Keys** (o **"Data API"** a seconda della versione).
2. Copia il valore di **Project URL** (es. `https://jcclzcyezqbhmxptlnoo.supabase.co`).
3. Copia la chiave **`anon` / `public`** (nelle interfacce più recenti si
   chiama anche **"publishable key"**, spesso inizia con `sb_publishable_...`
   o è un lungo token che comincia con `eyJ...`). **Non** la chiave
   `service_role`/`secret` — quella resta riservata ad Apps Script.

Incollamele qui in chat (sono progettate per essere pubbliche, quindi va
benissimo scriverle in chiaro) e scrivo subito il codice della schermata di
login.

**Avanzamento:**
- [x] Recuperati URL progetto e chiave `anon`:
      `https://jcclzcyezqbhmxptlnoo.supabase.co` /
      `sb_publishable_YsZNPRv7TVA39DoOi1P5cg_VJds36b5`
- [x] Scritta la schermata di login in `index.html`

### Passo 4 — Cosa è stato aggiunto a `index.html`

- Libreria `@supabase/supabase-js` caricata da CDN.
- Un overlay `#loginOverlay` (email + password) che appare subito dopo il
  caricamento della pagina se non c'è una sessione valida.
- Tutto il resto del sito è stato avvolto in un contenitore `#appRoot`,
  nascosto finché il login non va a buon fine — **zero modifiche** alla
  grafica esistente, solo un contenitore in più attorno.
- Un pulsante **"🚪 Esci"** in fondo alla navbar per fare logout.
- Le chiavi Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) sono ora scritte
  in chiaro in cima allo script — è normale e sicuro: sono la chiave
  pubblica, protetta dalle regole RLS (prossima fase), non dalla segretezza.

**⚠️ Importante — cosa NON succede ancora:** login e logout ora funzionano,
ma appena entri nel sito i dati restano vuoti, perché le viste (Anime,
Manga, Cinema, Log, Stats) chiamano ancora `google.script.run`, che fuori da
Apps Script non esiste e genera errori in console. Questo è normale e atteso
a questo punto della migrazione — lo sistemiamo nella Fase 11, gruppo per
gruppo. Il login serve a "chiudere la porta" da subito, prima ancora che il
resto della casa sia arredato.

### Passo 5 — Testare il login

1. Carica il nuovo `index.html` nella repository GitHub (stesso procedimento
   della Fase 7 — Passo 3: "Add file" → "Upload files", trascina il file,
   conferma il nome `index.html` minuscolo, "Commit changes").
2. Aspetta ~1 minuto che GitHub Pages ripubblichi.
3. Apri **https://djkata94.github.io/tracker-anime-manga/**: dovresti
   vedere la schermata di login al posto del sito.
4. Prova ad accedere con l'email/password creata nel Passo 2: dovresti
   vedere apparire il sito sotto (ancora senza dati, per il motivo spiegato
   sopra) e il pulsante "Esci" in navbar.
5. Prova anche a inserire una password sbagliata, per verificare che compaia
   il messaggio d'errore.

Fammi sapere com'è andato il test, poi passiamo alla **Fase 10 — Row Level
Security**, che è quella che collega davvero questo login alla protezione
del database.

## ✅ FASE 9 — Completata

Login e logout testati con successo (accesso corretto, rifiuto password
errata, comparsa/scomparsa del sito). Il sito è online con schermata di
login funzionante:
**https://djkata94.github.io/tracker-anime-manga/**

## ⏳ FASE 10 — Row Level Security

*(in corso)*

### Perché questo è il passo più importante

Finché le tabelle non hanno RLS attiva, la chiave pubblica `anon` incollata
in `index.html` permette a **chiunque la trovi** di leggere/scrivere
liberamente sul database via REST, login o non login — il login di per sé
non blocca nulla lato database, blocca solo l'accesso *al sito*. RLS è la
regola scritta **dentro Postgres stesso** che dice chi può fare cosa,
indipendentemente da come arriva la richiesta.

La logica che useremo, identica per tutte le 8 tabelle: *"se la richiesta
arriva da un utente che ha fatto login (ruolo `authenticated`), può fare
tutto — leggere, inserire, modificare, cancellare; se non è loggato (ruolo
`anon`), non può fare nulla."* Dato che l'unica utenza sei tu, non servono
regole più complesse (tipo "solo le proprie righe") — è già tutto tuo.

### Passo 1 — Eseguire lo script SQL

1. Nel progetto Supabase, vai su **SQL Editor** (menu a sinistra, icona
   `>_`) — lo stesso strumento usato in Fase 3 per creare le tabelle.
2. Clicca **"New query"**.
3. Incolla questo script (attiva RLS + crea la regola su tutte e 8 le
   tabelle in un colpo solo):

```sql
-- Attiva la Row Level Security su tutte le tabelle
ALTER TABLE anime           ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodi_anime   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinossi_anime   ENABLE ROW LEVEL SECURITY;
ALTER TABLE manga           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sinossi_manga   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cinema          ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_attivita    ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_episodi     ENABLE ROW LEVEL SECURITY;

-- Una regola per tabella: "chi ha fatto login può fare tutto"
CREATE POLICY "utente autenticato ha accesso completo" ON anime
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "utente autenticato ha accesso completo" ON episodi_anime
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "utente autenticato ha accesso completo" ON sinossi_anime
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "utente autenticato ha accesso completo" ON manga
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "utente autenticato ha accesso completo" ON sinossi_manga
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "utente autenticato ha accesso completo" ON cinema
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "utente autenticato ha accesso completo" ON log_attivita
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "utente autenticato ha accesso completo" ON log_episodi
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

4. Clicca **"Run"** (o Ctrl/Cmd+Enter).
5. Dovresti vedere "Success. No rows returned".

**Spiegazione delle due righe-tipo per tabella:**
- `ENABLE ROW LEVEL SECURITY`: da questo momento Postgres **nega tutto per
  default** su quella tabella, finché non trova una regola che dice
  esplicitamente "questo è permesso".
- `CREATE POLICY ... FOR ALL TO authenticated USING (true) WITH CHECK
  (true)`: la regola che riapre l'accesso, ma solo per chi ha fatto login
  (`TO authenticated`). `USING (true)` riguarda leggere/modificare/cancellare
  righe esistenti, `WITH CHECK (true)` riguarda le righe nuove che si
  inseriscono — `true` per entrambe vuol dire "nessuna condizione
  aggiuntiva, va sempre bene", dato che non ci servono regole più fini con
  un solo utente.

### Passo 2 — Verificare che funzioni

Un modo semplice per controllare che RLS blocchi davvero chi non è loggato:

1. Apri il sito, fai **logout** (bottone "Esci").
2. Apri gli **strumenti sviluppatore del browser** (F12 o clic destro →
   "Ispeziona") → scheda **"Console"**.
3. Incolla questo comando e premi Invio (sostituendo `TUA_ANON_KEY` con la
   tua chiave pubblica):

```js
fetch('https://jcclzcyezqbhmxptlnoo.supabase.co/rest/v1/anime?select=*', {
  headers: { apikey: 'sb_publishable_YsZNPRv7TVA39DoOi1P5cg_VJds36b5' }
}).then(r => r.json()).then(console.log)
```

4. Il risultato atteso è un **array vuoto `[]`** (RLS blocca, perché non sei
   autenticato) — se invece vedi i tuoi dati, vuol dire che le policy non
   sono attive e vanno controllate.

Fammi sapere l'esito di entrambi i passi (script eseguito + verifica) e
passiamo alla Fase 11: il pezzo più corposo, dove le viste del sito
iniziano finalmente a parlare direttamente con Supabase invece che con
Apps Script.

## ✅ FASE 10 — Completata

RLS attiva su tutte le 8 tabelle. Scoperta utile: le tabelle create via SQL
Editor non hanno permessi di base (`GRANT`) di default — stesso problema
già incontrato in Fase 4 con `service_role`, stavolta risolto per il ruolo
`authenticated` con:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```
Verificato: utente anonimo → `401 permission denied` ✅ blocco confermato.
Utente autenticato → 181 righe anime restituite correttamente ✅ accesso
confermato.

**A questo punto il database è protetto sul serio.** Da qui in poi il
lavoro è "solo" collegare il sito ai dati veri.

## ⏳ FASE 11 — Riscrivere le chiamate del sito (Apps Script → Supabase diretto)

*(in corso — la fase più corposa di tutte)*

### Come procediamo

Stesso metodo della Fase 5 originale: **un gruppo alla volta**, si scrive,
si carica su GitHub, si testa dal vivo, si passa al gruppo successivo. Per
ogni funzione: si parte da quella già scritta e testata in `codice.gs`, se
ne traduce la logica in JavaScript lato browser (non si reinventa nulla), e
si sostituisce la chiamata `google.script.run.xxx()` corrispondente nel
punto (o nei punti) in cui compare in `index.html`.

**Roadmap dei gruppi (checklist):**
- [ ] *Gruppo ANIME* — `getAnimeData`, `addAnime`, `updateAnime`, `deleteAnime`, `getTuttiEpisodiAnime`, `updateEpisodioVisti`, `updateEpisodioTotali`, `toggleAnimePreferito`, `toggleAnimePriorita`, `impostaVotoAnime`
- [ ] *Gruppo MANGA* — `getMangaData`, `addManga`, `updateManga`, `updateMangaVolumiLetti`, `deleteManga`, `toggleMangaPreferito`, `flagMangaAcquistato`, `toggleMangaPriorita`
- [ ] *Gruppo CINEMA* — `getCinemaData`, `addCinema`, `toggleVisioneCinema`, `confermaVisioneStreamingCinema`, `trasformaCinemaInStreaming`, `modificaDataVisioneCinema`, `eliminaCinema`
- [ ] *Gruppo SINOSSI (condiviso anime/manga)* — `getSinossi`, `impostaSinossi`
- [ ] *Gruppo LOG* — `registraLog`, `ottieniUltimiLog`, `ottieniLogEpisodi`
- [ ] *Gruppo RICERCA/STATISTICHE* — `getIndiceRicerca`, `getStatsData`
- [ ] *Gruppo AniList/TMDB* — `cercaCandidatiAniList`, `getDettaglioTraduzioneAniList`, `cercaCandidatiCinemaTMDB`, `getDettaglioCinemaTMDB` (queste toccano anche Fase 12/13: la chiave TMDB, essendo segreta, non può restare nel browser)
- [ ] *Varie* — `getSpreadsheetUrl` (si risolve da sé: il bottone punterà a un link statico verso il Table Editor Supabase scritto direttamente nel codice, non serve più chiamare il server per saperlo)

Iniziamo dal **Gruppo ANIME**: il più complesso, ma anche quello con la
logica (calcolo colori, calcolo progresso) che riutilizzeremo identica
anche per Manga.

### Gruppo ANIME — lettura dati (`getAnimeData`, `getTuttiEpisodiAnime`)

**Fatto:**
- [x] Tradotta `calcolaColoreVisioneAnime_` (logica pura, nessuna modifica di comportamento)
- [x] Tradotta `getAnimeData` → `getAnimeDataSB_()` (legge `anime` + `episodi_anime` da Supabase, stesso identico formato dati di prima, incluso l'auto-link delle URL nelle note)
- [x] Tradotta `getTuttiEpisodiAnime` → `getTuttiEpisodiAnimeSB_()`
- [x] `caricaDatiAnime()` in `index.html` ora chiama queste due funzioni invece di `google.script.run`

**Nota tecnica:** la funzione `coloreVisione` viene ancora calcolata e
salvata su ogni oggetto anime (serve al widget "In Corso" della Home, che
legge `item.coloreVisione` direttamente) — il frontend nella vista Anime la
ricalcola *anche* localmente per i filtri, ma questo era già così anche
nella versione Apps Script, non è un doppione introdotto ora.

**Cosa NON è ancora collegato:** il resto della vista Anime (aggiungi,
modifica, elimina, episodi, preferiti/priorità/voto) chiama ancora
`google.script.run` — è normale, sono i prossimi passi di questo stesso
gruppo. Anche il widget "In Corso" della Home resta a `google.script.run`
per ora, perché mescola dati Anime + Manga e lo sistemiamo quando anche il
Gruppo Manga sarà pronto.

### Come testare questo pezzo

1. Carica il nuovo `index.html` su GitHub (stessa procedura di sempre).
2. Apri il sito, fai login, vai sulla tab **"📺 Anime"**.
3. Dovresti vedere la tabella popolarsi con i tuoi 181 anime, con colori,
   voti, generi, note (link cliccabili se presenti) — tutto uguale a prima.
4. Apri la Console (F12) e controlla che non ci siano errori rossi legati
   ad Anime (potresti vedere ancora errori per Manga/Cinema/Log/Stats, è
   normale, li sistemiamo nei prossimi gruppi).

Fammi sapere come va, poi continuiamo con il resto del Gruppo Anime
(aggiungi/modifica/elimina anime, gestione episodi, preferiti/priorità/voto).

**Aggiornamento — pacchetto CRUD + toggle completato e testato:**
- [x] `addAnime` → `addAnimeSB_`
- [x] `updateAnime` → `updateAnimeSB_` (incluso il ricalcolo/log episodi via `ricalcolaSincronizzaELoggaSB_`)
- [x] `deleteAnime` → `deleteAnimeSB_`
- [x] `toggleAnimePreferito` → `toggleAnimePreferitoSB_`
- [x] `impostaVotoAnime` → `impostaVotoAnimeSB_`
- [x] `toggleAnimePriorita` → `toggleAnimePrioritaSB_`
- [x] Funzioni di supporto tradotte: `registraLogSB_`, `aggiungiRigheEpisodiSB_`, `rimuoviRigheEpisodiEccedentiSB_`, `calcolaProgressoAnimeSB_`, `ricalcolaSincronizzaELoggaSB_`

Testato dal vivo: aggiunta, modifica, voto (con rifiuto su doppio voto),
preferito, priorità, eliminazione — tutto ok.

**Nota di metodo:** da qui in poi, per risparmiare token, le modifiche a
`index.html` vengono date come istruzioni "cerca questo blocco / sostituiscilo
con quello" da applicare a mano su GitHub, invece di rigenerare il file
intero ogni volta. Il file completo resta comunque disponibile su richiesta.

**Ancora da fare nel Gruppo Anime:** gestione episodi (`updateEpisodioVisti`,
`updateEpisodioTotali`) — l'overlay con i pulsanti (+)/(−) per segnare gli
episodi visti di ogni stagione/film.

## ✅ GRUPPO ANIME — Completato al 100%

Inclusa gestione episodi (`updateEpisodioVisti`/`updateEpisodioTotali`,
con correzione di un piccolo bug preesistente in `codice.gs` su
`updateEpisodioTotali`, che restituiva variabili mai definite). Testato
dal vivo: tutto ok.

## ✅ GRUPPO MANGA — Completato al 100%

`getMangaData`, `addManga`, `updateManga`, `updateMangaVolumiLetti`,
`deleteManga`, `toggleMangaPreferito`, `flagMangaAcquistato`,
`toggleMangaPriorita`. Testato dal vivo: tutto ok.

## 🔧 Fix navbar + icona pulsante Esci

Il pulsante "Esci" era il primo figlio della navbar con `margin-left:auto`,
che spingeva a destra anche tutto il resto (essendo un flex container).
Spostato come ultimo figlio → ora solo lui va a destra, il resto resta
allineato a sinistra come nell'originale. Icona cambiata in "⏻" (simbolo
on/off da telecomando).

## ✅ GRUPPO CINEMA — Completato al 100%

`getCinemaData`, `addCinema`, `toggleVisioneCinema`,
`confermaVisioneStreamingCinema`, `trasformaCinemaInStreaming`,
`modificaDataVisioneCinema`, `eliminaCinema`, incluso il widget Home
"Prossimi al Cinema" (caricamento + spunta visione).

**Bug scoperto e risolto durante il test:** il pulsante "+ Nuovo Film" non
si apriva. Causa: `getSpreadsheetUrl()` (bottone "Apri Database" della Home)
era rimasta su `google.script.run`, ormai inesistente fuori da Apps Script.
L'errore lanciato interrompeva tutto il resto del blocco `DOMContentLoaded`
in cui girava, incluso l'aggancio del pulsante "Nuovo Film". Risolto
calcolando il link al Table Editor Supabase direttamente in JS da
`SUPABASE_URL` — **la voce "Varie/getSpreadsheetUrl" della roadmap Fase 11
è quindi già chiusa**, un pezzo in meno da fare.

**Nota per i prossimi gruppi:** se un pulsante smette di rispondere dopo
una modifica, il sospetto numero uno è sempre lo stesso — un `google.script.run`
dimenticato da qualche parte nello stesso blocco di inizializzazione.

**Aggiornamento roadmap Gruppi rimanenti:**
- [ ] Sinossi (condivisa Anime/Manga): `getSinossi`, `impostaSinossi`
- [ ] Log: `registraLog` (già fatto, riusato ovunque), `ottieniUltimiLog`, `ottieniLogEpisodi`
- [ ] Ricerca/Statistiche: `getIndiceRicerca`, `getStatsData`
- [ ] AniList/TMDB (richiede anche Fase 12/13 per la chiave segreta TMDB)
- [x] ~~Varie: `getSpreadsheetUrl`~~ — già risolto sopra

## ✅ FASE 11 — Gruppi SINOSSI, LOG, RICERCA, STATISTICHE completati

`getSinossi`, `impostaSinossi`, `ottieniUltimiLog`, `ottieniLogEpisodi`,
`getIndiceRicerca`, `getStatsData` — tutti tradotti e testati. Anche il
widget Home "In Corso" (che mescolava Anime+Manga) è stato aggiornato per
usare le funzioni Supabase dirette invece del vecchio wrapper
`google.script.run`.

**Tutti i gruppi "dati puri" della Fase 11 sono chiusi.** Resta solo il
Gruppo AniList/TMDB, che è anche il collegamento verso le Fasi 12-13.

**Decisione presa:** traduzione tramite l'endpoint pubblico gratuito di
Google Translate (`translate.googleapis.com/translate_a/single`) — non
ufficiale/non documentato, ma ampiamente usato in progetti hobbistici,
nessuna chiave né account richiesti. Se un giorno smettesse di funzionare o
diventasse inaffidabile, si può sempre spostare la traduzione in una Edge
Function con un servizio a pagamento, senza toccare il resto del sito.

## ✅ FASE 11 — Gruppo ANILIST completato

`cercaCandidatiAniList` → `cercaCandidatiAniListSB_` e
`getDettaglioTraduzioneAniList` → `getDettaglioTraduzioneAniListSB_`,
entrambe chiamate **direttamente dal browser** (nessuna Edge Function
necessaria: l'API pubblica di AniList supporta CORS). Tradotta anche la
funzione di supporto `eseguireRichiestaAniList_` con gestione errori
identica all'originale (rete, HTTP, GraphQL, JSON malformato).

**Ultimo pezzo rimasto in assoluto:** il Gruppo TMDB
(`cercaCandidatiCinemaTMDB`, `getDettaglioCinemaTMDB`), bloccato in attesa
della Fase 12 (Edge Function per nascondere la chiave segreta TMDB).

## ⏳ FASE 12 — Edge Function per la chiave segreta TMDB

*(in corso)*

### Perché serve

`TMDB_API_KEY` oggi vive nelle Proprietà Script di Apps Script, quindi non
è mai stata visibile al browser. Se il codice che fa le chiamate a TMDB
passasse così com'è dentro `index.html`, la chiave sarebbe leggibile da
chiunque apra la pagina (view-source, o semplicemente la scheda Network del
browser). Una Edge Function gira invece sui server di Supabase: il browser
le manda una richiesta senza chiave, lei aggiunge la chiave (letta da un
"secret" configurato lato server, mai spedito al browser) e interroga TMDB
per conto nostro.

### Come la creiamo

Verificato che dal 2025 Supabase permette di creare, scrivere, testare e
pubblicare le Edge Function **direttamente dalla Dashboard**, senza CLI né
Docker — l'editor ha anche evidenziazione sintassi e un tester integrato.
Useremo questa strada.

**Nota di sicurezza aggiuntiva:** la funzione richiederà un utente
autenticato (JWT verificato), esattamente come le tabelle protette da RLS —
quindi anche se qualcuno scoprisse l'URL della funzione, senza aver fatto
login sul sito non potrebbe usarla.

### Passo 1 — Creare la Edge Function

1. Nel progetto Supabase, vai su **Edge Functions** (menu a sinistra, icona
   `</>`  con un fulmine, o simile).
2. Clicca **"Create a new function"** (o **"Deploy a new function"**).
3. Se ti propone dei template, scegli l'opzione **"Via Editor"** / scrivi da
   zero (non serve nessun template preconfezionato).
4. Come **nome della funzione** inserisci esattamente: `tmdb-proxy`
   (diventerà parte dell'URL della funzione).
5. Assicurati che l'opzione **"Enforce JWT Verification"** (o **"Verify
   JWT"**) sia **attiva** — è il controllo che richiede il login per usarla.
6. Nell'editor che si apre, cancella il codice di esempio e incolla questo:

```typescript
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('TMDB_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key TMDB non configurata sul server.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'search') {
      const query = body.query || '';
      const tmdbUrl = 'https://api.themoviedb.org/3/search/movie?api_key=' + encodeURIComponent(apiKey)
        + '&query=' + encodeURIComponent(query) + '&language=it-IT&region=IT&include_adult=false';
      const resp = await fetch(tmdbUrl);
      const json = await resp.json();
      const risultati = (json.results || []).slice(0, 8).map((m: any) => ({
        id: m.id,
        titolo: m.title || m.original_title || 'Senza titolo',
        anno: (m.release_date || '').substring(0, 4),
        immagine: m.poster_path ? ('https://image.tmdb.org/t/p/w342' + m.poster_path) : ''
      }));
      return new Response(JSON.stringify(risultati), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'detail') {
      const id = body.id || '';
      const tmdbUrl = 'https://api.themoviedb.org/3/movie/' + encodeURIComponent(id)
        + '?api_key=' + encodeURIComponent(apiKey) + '&language=it-IT&append_to_response=release_dates';
      const resp = await fetch(tmdbUrl);
      const media = await resp.json();
      if (!media || media.success === false) {
        return new Response(JSON.stringify({ error: 'Film non trovato su TMDB.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const immagine = media.poster_path ? ('https://image.tmdb.org/t/p/w500' + media.poster_path) : '';

      let dataUscitaIT = '';
      try {
        const risultatiRelease = (media.release_dates && media.release_dates.results) || [];
        const itEntry = risultatiRelease.find((r: any) => r.iso_3166_1 === 'IT');
        if (itEntry && itEntry.release_dates && itEntry.release_dates.length > 0) {
          const teatrali = itEntry.release_dates.filter((rd: any) => rd.type === 3 || rd.type === 2);
          const candidati = (teatrali.length > 0 ? teatrali : itEntry.release_dates)
            .map((rd: any) => rd.release_date).filter(Boolean).sort();
          if (candidati.length > 0) dataUscitaIT = candidati[0].substring(0, 10);
        }
      } catch (_e) { /* ignora, si usa il fallback sotto */ }

      if (!dataUscitaIT && media.release_date) dataUscitaIT = media.release_date;

      const dettaglio = {
        titolo: media.title || media.original_title || '',
        dataUscita: dataUscitaIT,
        immagine: immagine
      };
      return new Response(JSON.stringify(dettaglio), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Parametro "action" mancante o non valido (usa "search" o "detail").' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Errore interno della funzione: ' + (err && err.message ? err.message : String(err)) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

7. Clicca **"Deploy"** (o "Save and deploy").

### Passo 2 — Configurare la chiave segreta TMDB come "secret"

1. Sempre nella sezione Edge Functions, cerca **"Manage secrets"** / **"Secrets"**
   (a volte sotto **Project Settings → Edge Functions**).
2. Aggiungi un nuovo secret: nome **`TMDB_API_KEY`**, valore = la tua chiave
   API TMDB (la stessa che oggi è nelle Proprietà Script di Apps Script —
   se non la ricordi, la trovi sul tuo account TMDB, sezione "Impostazioni
   → API").
3. Salva. I secret sono condivisi da tutte le Edge Function del progetto,
   quindi da questo momento `Deno.env.get('TMDB_API_KEY')` nella funzione
   troverà il valore.

### Passo 3 — Testare la funzione dalla Dashboard (prima di toccare il sito)

1. Nella pagina della funzione `tmdb-proxy`, cerca il tab **"Test"** /
   **"Invoke"** integrato.
2. Prova una chiamata con questo corpo JSON:
   ```json
   { "action": "search", "query": "Dune" }
   ```
3. Dovresti ricevere una risposta con un array di film (titolo, anno,
   immagine). Se ricevi un errore 401, controlla di aver eseguito il test
   da autenticato (la Dashboard di solito lo fa in automatico); se ricevi
   "API Key TMDB non configurata", ricontrolla il secret del Passo 2.

Fammi sapere l'esito di questi 3 passi, poi finiamo il Gruppo TMDB
collegando `index.html` alla funzione appena creata.

## ✅ FASE 12 — Completata

Edge Function `tmdb-proxy` creata dalla Dashboard Supabase (senza CLI né
Docker). Corretta una svista iniziale: il toggle "Verify JWT with legacy
secret" **non basta da solo** a richiedere il login (lo soddisfa anche la
sola chiave pubblica `anon`) — disattivato e sostituito con un controllo
esplicito nel codice della funzione (`supabase.auth.getUser()` sul token
ricevuto). Chiave `TMDB_API_KEY` salvata come secret del progetto.
Verificato dal vivo: utente loggato → risposta corretta con `error: null`;
utente sloggato → `401 Unauthorized`. Sicurezza confermata su tre livelli
indipendenti (RLS sul database, login sul sito, controllo esplicito nella
Edge Function).

## ✅ FASE 11 — Gruppo TMDB completato → FASE 11 CHIUSA AL 100%

`cercaCandidatiCinemaTMDB` → `cercaCandidatiCinemaTMDBSB_` e
`getDettaglioCinemaTMDB` → `getDettaglioCinemaTMDBSB_`, entrambe collegate
a `supabaseClient.functions.invoke('tmdb-proxy', ...)`. Testato dal vivo:
ricerca, selezione film, recupero data di uscita nelle sale italiane,
comparsa corretta nel widget Home "Prossimi al Cinema" (ordinamento per
data verificato con un film reale).

**Verifica finale di copertura:** ricontrollate tutte le funzioni di
`codice.gs` una per una. Tutte tradotte e collegate, tranne quattro residui
dell'epoca Google Sheets mai chiamati dal sito attuale (`getEpisodiSheet_`,
`popolaEpisodiAnimeStorico`, `coloreVisioneAnimeToHex_`,
`coloreLetturaMangaToHex`) — nessuna funzionalità persa.

**Aggiornamento roadmap generale:**
- ~~Fase 13 (decidere trattamento AniList)~~ → già risolta nella Fase 11: ricerca e traduzione AniList restano lato browser, nessuna Edge Function necessaria.
- ~~Fase 14 (portare la logica di business in JS)~~ → già svolta "in itinere", gruppo per gruppo, durante tutta la Fase 11 (calcolo colori, cascade episodi, validazioni, log): non serve un passaggio a parte.
- **Resta solo la Fase 15**, il collaudo finale.

## ⏳ FASE 15 — Collaudo finale e spegnimento del vecchio Apps Script

*(prossimo passo)*

A questo punto il sito su GitHub Pages fa tutto da solo, senza più
dipendere da Apps Script per nessuna funzione. Prima di considerare la
migrazione conclusa, conviene:

1. **Giro di test completo** su ogni vista (Anime, Manga, Cinema, Log,
   Stats, ricerca globale, AniList, TMDB) usando il sito per qualche giorno
   nell'uso reale, non solo con dati "di prova".
2. **Verificare da dispositivo mobile** (il sito era pensato anche per
   quello?) e da un browser diverso da quello usato finora.
3. Solo dopo essersi fidati del nuovo sito: **disattivare/eliminare il
   vecchio deployment di Apps Script** (Estensioni → Apps Script → Distribuisci
   → Gestisci distribuzioni → Archivia), così da non lasciare comunque
   attivo un vecchio ingresso al database con la chiave `service_role`.
4. Facoltativo: rimuovere `Codice.gs` e `SupabaseClient.gs` dal progetto
   Apps Script (o lasciarli come archivio storico, sono innocui se il
   deployment è disattivato).
5. Facoltativo: nella repository GitHub, salvare questa guida
   (`guida_migrazione.md`) come promemoria di come è fatto il sito.

Fammi sapere quando vuoi iniziare il collaudo finale, o se preferisci
prima rivedere/rifinire qualche dettaglio del sito.

---

# 🔧 PARTE 3 — Miglioramenti post-migrazione

La migrazione (Parti 1 e 2) è conclusa. Da qui in poi la guida raccoglie le
richieste di modifica fatte sul sito già migrato — utile per ricordare cosa
è stato cambiato e perché, oltre alle istruzioni per riprodurlo.

## Richiesta 1 — Ordinamento "Da Vedere in Streaming"

Cambiato da alfabetico a **data di uscita più recente in alto**, coerente
con l'idea che i titoli usciti da poco sono probabilmente quelli più "caldi"
da recuperare in streaming.

## Richiesta 2 — Trama e generi dai dati TMDB

TMDB fornisce già `overview` (trama, in italiano grazie a `language=it-IT`)
e `genres` nella stessa risposta di dettaglio che usiamo già: nessuna
chiamata TMDB aggiuntiva necessaria.

**Modifiche:**
- 2 nuove colonne sulla tabella `cinema` (`trama` testo, `generi` testo)
- Edge Function `tmdb-proxy`: la risposta di `action: "detail"` ora include
  anche `trama` e `generi`
- `index.html`: le funzioni di lettura/scrittura Cinema salvano e restituiscono
  questi due campi; la preview nel modale "+ Nuovo Film" li mostra;
  aggiunto un pulsante **ℹ️** nella lista Cinema (solo sui film che hanno
  questi dati) per rivedere trama e generi in un popup, riusando lo stesso
  stile dell'overlay sinossi di Anime/Manga

**Nota:** i film già presenti in lista da prima di questa modifica non
avranno trama/generi (colonne vuote) finché non vengono ri-aggiunti — non è
possibile recuperarli retroattivamente senza ripetere la ricerca TMDB per
ciascuno. Non è un problema per i nuovi film aggiunti da ora in poi.

**Bonus:** aggiunto anche uno script "usa e getta" da Console per fare il
backfill di trama/generi sui film già presenti in lista (non fa parte del
codice del sito, lanciato una tantum).

## Richiesta 3 — Stagioni/film collegati via grafo relazioni AniList

**Problema di partenza:** AniList non ha un concetto di "franchise": ogni
stagione, film, OAV è un `Media` indipendente. I collegamenti esistono solo
come relazioni tipizzate (`PREQUEL`, `SEQUEL`, `SIDE_STORY`, `ALTERNATIVE`,
`SUMMARY`...) tra un `Media` e l'altro — un grafo, non una lista ordinata.

**Design scelto (automatizza ma lascia sempre l'ultima parola a te):**
- Nuovo pulsante **"🔗 Cerca stagioni/film collegati"** nell'overlay AniList
  (solo lato Anime), facoltativo — nulla parte in automatico.
- `getRelazioniAniList_(id)`: legge le `relations` di un singolo titolo.
- `costruisciGrafoStagioniAniList_(nodoIniziale)`: cammina lungo la catena
  `PREQUEL`/`SEQUEL` di formato `TV` per ricostruire tutte le stagioni; per
  ciascuna stagione trovata guarda anche i suoi `SIDE_STORY`/`ALTERNATIVE`
  di formato `MOVIE` come film candidati. I `SUMMARY` (ricap) sono sempre
  scartati. Tetto di sicurezza a 20 nodi contro grafi anomali.
- Checklist di conferma: **stagioni TV pre-spuntate** (relazione affidabile),
  **film/side story NON pre-spuntati** (relazione più ambigua, verifica
  manuale prima di confermare).
- Alla conferma: scrive direttamente `stagioniTotali`/`filmTotali` nella
  scheda Anime (già aperta dietro l'overlay) e prepara una mappa
  `numero_stagione → episodi_totali` (dato reale, noto da AniList).
- **Bonus:** `aggiungiRigheEpisodiSB_` ora accetta questa mappa opzionale:
  le righe di `episodi_anime` nascono già con il totale episodi corretto
  per stagione, invece del placeholder `0` da correggere poi a mano con la
  matita ✏️. Funziona sia in creazione (`addAnimeSB_`) sia in modifica
  (`updateAnimeSB_`, quando si aumentano le stagioni totali).

**Limiti espliciti:** OAV/Special non hanno una casella dedicata nello
schema attuale (solo Stagione/Film) — al momento vengono semplicemente
ignorati nella ricerca. Su titoli di nicchia la checklist potrebbe uscire
corta o vuota se la community AniList non ha compilato bene le relazioni:
resta comunque disponibile l'inserimento manuale come fallback, come oggi.

## Richiesta 4 — Anime monostagione: importare comunque stagione ed episodi

**Problema riscontrato (segue la Richiesta 3):** su un anime che esiste in
una sola stagione (es. *INUYASHIKI LAST HERO*, *LAZARUS*, *takt op.Destiny*)
il pulsante "🔗 Cerca stagioni/film collegati" rispondeva sempre
"Nessuna stagione o film collegato trovato". L'unica strada rimasta era
"✅ Usa questi dati", che però importa solo titolo, sinossi, generi e
copertina: Stagioni Totali e numero episodi restavano da mettere a mano.

**Causa:** in `renderRelazioniAniList_()` la condizione di uscita era
`stagioni.length <= 1 && film.length === 0`. Il titolo di partenza viene
sempre inserito nel grafo, quindi su un monostagione il risultato è
esattamente 1 stagione e 0 film → la funzione usciva subito con il messaggio
di "nessun risultato", senza mai disegnare la checklist né il pulsante di
conferma. Verificato interrogando AniList: quei titoli non hanno alcuna
relazione `PREQUEL`/`SEQUEL` di formato `TV` (solo `SOURCE`/`ADAPTATION`
verso il manga), mentre *My Dress-Up Darling* ha un `SEQUEL:TV` — ecco
perché i multi-stagione funzionavano e i monostagione no. Nessun problema
di rete o di API: era solo la soglia sbagliata.

**Modifiche (solo `index.html`, nessuna modifica a database o Edge Function):**
- `renderRelazioniAniList_()`: la condizione di uscita diventa
  `stagioni.length === 0 && film.length === 0` (caso limite che in pratica
  non si verifica mai). Con una sola voce la checklist viene comunque
  disegnata, pre-spuntata, con il numero di episodi reale e il pulsante
  "✅ Applica stagioni e film spuntati" → Stagioni Totali = 1 ed
  `episodiPerStagionePendenteAnime = { 1: episodi }`.
- Aggiunta una riga informativa sopra la checklist quando il franchise è
  composto dalla sola opera scelta ("l'opera risulta a stagione unica…"),
  così resta chiaro che non è un errore di ricerca.
- `costruisciGrafoStagioniAniList_()`: il nodo iniziale non finisce più
  d'ufficio tra le stagioni TV. Se il suo `format` AniList è `MOVIE` viene
  messo tra i film, altrimenti tra le stagioni. In entrambi i casi è marcato
  `preselezionato: true`. Serviva perché ora la checklist si mostra sempre:
  senza questa distinzione un film cercato come Anime sarebbe comparso come
  "1 stagione TV".
- `rigaCheckbox()`: rispetta il flag `preselezionato` (il titolo scelto è
  sempre spuntato, anche quando finisce nel gruppo film, che di default è
  non spuntato).
- `avviaRicercaRelazioniAniList_()`: passa `formato: dettaglio.formato` nel
  nodo iniziale (il campo `format` era già letto da
  `getDettaglioTraduzioneAniListSB_`, semplicemente non veniva propagato).

**Comportamento invariato:** il pulsante "✅ Usa questi dati" continua a
importare solo titolo/sinossi/generi/copertina — la ricerca stagioni resta
un passaggio facoltativo e separato, come da design della Richiesta 3.


## Richiesta 5 — Copertina dell'opera negli overlay aperti dal widget "In Corso"

**Problema riscontrato:** le card del widget "In Corso" della Home mostrano
l'immagine dell'opera in un banner alto 88px con `object-fit: cover`, quindi
tagliata e ingrandita (sgranata). Cliccando la card si apre l'overlay di
avanzamento (stagioni/film per gli anime, volumi per i manga), dove
l'immagine non compariva affatto.

**Soluzione:** negli overlay aperti *dal widget* la copertina si vede di
fianco all'elenco, intera (`object-fit: contain`, niente ritaglio) e in
formato ridotto (colonna da 160px, altezza massima 260px): abbastanza
grande da essere leggibile, ma senza far diventare enorme l'overlay. Per
vederla a schermo intero si clicca l'immagine e si apre il lightbox già
esistente (`apriLightbox()`), lo stesso degli avatar nelle viste Anime e
Manga.

**Modifiche (solo `index.html`, nessuna modifica a database o Edge Function):**
- **CSS** (subito sotto le regole `.episodi-*`): nuove classi
  `.overlay-con-copertina` (riga flex copertina + elenco),
  `.overlay-lista` (`flex: 1; min-width: 0`), `.overlay-copertina`
  (colonna fissa da 160px) e `.overlay-copertina-img`
  (`object-fit: contain`, `max-height: 260px`, bordo e `cursor: zoom-in`
  come le altre immagini cliccabili). Media query sotto i 560px: la
  copertina va sopra l'elenco, incolonnata e a 140px.
- **Markup** dei due overlay: dentro `#modalOverlayEpisodi` e
  `#modalOverlayVolumiManga` il contenitore dell'elenco è ora avvolto in un
  `div.overlay-con-copertina` insieme al nuovo box della copertina
  (`#episodiCopertina` e `#volumiMangaCopertina`, `display:none` di
  partenza). Gli `id` dei contenitori esistenti (`episodiListContainer`,
  `volumiMangaContainer`) NON sono cambiati, quindi tutte le funzioni di
  render restano valide.
- **`renderCopertinaOverlay(idContenitore, item)` / `nascondiCopertinaOverlay(idContenitore)`**
  (nuove, vicino all'overlay volumi): disegnano o nascondono la copertina
  a partire dal campo `immagine` dell'opera. Riusano lo stesso schema di
  escape degli avatar della lista (`replace(/'/g, "\\'")`) e hanno
  `onerror` che nasconde il box se l'URL è rotto.
  `renderCopertinaOverlay` restituisce `true` solo se la copertina è stata
  davvero disegnata.
- **`apriGestioneEpisodi(titolo, mostraCopertina)`**: nuovo secondo
  parametro *facoltativo*. Passato `true` solo dal widget "In Corso";
  l'icona 📺 della vista Anime continua a chiamarla con il solo titolo e
  l'overlay resta identico a prima (copertina nascosta, `max-width` 560px).
  Con la copertina l'overlay passa a 640px.
- **`apriAvanzamentoVolumiManga(titolo)`**: mostra sempre la copertina
  (questo overlay è aperto solo dal widget). `max-width` 520px con
  copertina, 380px senza. La copertina viene disegnata una sola volta
  all'apertura e non dentro `renderVolumiOverlay()`, che viene richiamata a
  ogni +/-: ricaricare l'immagine a ogni click la farebbe lampeggiare.
- **`creaProgressCard()`**: la card anime ora chiama
  `apriGestioneEpisodi(item.titolo, true)`.

**Comportamento invariato:** il banner ritagliato dentro la card del widget
resta com'era (lì serve il ritaglio per tenere le card tutte uguali); la
vista Anime, la vista Manga e il lightbox non sono stati toccati. Se
l'opera non ha immagine, o l'URL non carica, il box sparisce e l'elenco
torna a tutta larghezza come prima.


## Richiesta 6 — Flag "opera già letta per intero" nel modale Manga + fix generi su iOS

**Problemi riscontrati (emersi con il secondo utente che sta ripopolando il
suo archivio da zero):**
1. Inserendo un manga vecchio, già finito di leggere anni fa, non c'era modo
   di dichiararlo letto in fase di creazione: l'unica strada era salvare e poi
   cliccare ➕ dalla riga della lista una volta per ogni volume.
2. Da iPhone i generi sotto al titolo (`.genre-tags-list`, 11px) uscivano più
   grandi del titolo stesso. Su Android non succedeva.

**Modifiche (solo `index.html`, nessuna modifica a database o Edge Function —
la colonna `volumi_letti` esiste già dalla migrazione).**

### Flag "📗 Opera già letta per intero"

- **Markup**: nuovo `form-group` dentro `#modalOverlayManga`, fra "Generi
  Associa" e "Note", con checkbox `inpGiaLettoManga` e spiegazione in
  `<small>`. Stesso schema del flag "📺 Da vedere in streaming" del modale
  Cinema (checkbox dentro la `<label>`, testo esplicativo sotto).
- **`btnNuovoManga.onclick`**: flag sempre spento sulle nuove opere.
- **`apriModificaManga()`**: in modifica il flag nasce spuntato se l'opera è
  già completata (`volumiLetti >= volumi`), così riflette la situazione reale.
- **`mangaForm.onsubmit`**: il flag viene valutato *prima* di mettere il
  pulsante in "Salvataggio...", perché può interrompere il salvataggio.
  - Flag spuntato ma Numero Volumi = 0 → toast di errore, non salva.
  - Flag spuntato su un'opera già completata (modifica) → nessuna conferma,
    non c'è nulla da cambiare: evita il popup a ogni salvataggio.
  - Altrimenti → `confirm()` che annuncia volumi letti = volumi totali e lo
    stato di lettura risultante. Se si annulla, non viene salvato nulla.
  - Il risultato finisce in `dati.segnaComeLetto`.
- **`addMangaSB_()`**: `volumi_letti` non è più fisso a `0`; con il flag
  l'opera nasce già completata.
- **`updateMangaSB_()`**: con il flag porta `volumi_letti` al totale e
  registra nel Log gli stessi eventi del ➕ dalla lista (`AVANZAMENTO`, più
  `COMPLETAMENTO` se l'opera diventa verde), riusando lo schema di
  `updateMangaVolumiLettiSB_()`.

**Scelte di design da ricordare:**
- **Togliere la spunta non azzera i volumi letti** (scritto anche nella
  spiegazione sotto al flag): un reset silenzioso di dati reali sarebbe
  pericoloso. Il flag è un'azione "porta a fine lettura", non un interruttore
  a due vie.
- **Il flag non tocca lo Stato Editoriale.** Su un'opera ancora "In corso" il
  quadratino resta giallo anche a volumi in pari — è la regola già esistente
  in `calcolaColoreLetturaManga_()`. Il messaggio di conferma si adatta e lo
  dice esplicitamente, invece di promettere un verde che non arriverebbe.

### Fix generi di dimensione diversa su iPhone

**Causa:** il *text autosizing* di Safari/iOS. Su una tabella più larga del
viewport Safari ingrandisce di sua iniziativa i blocchi che considera
contenuto principale, ignorando gli `11px` di `.genre-tags-list`. Chrome su
Android usa un algoritmo diverso e non lo faceva: non era un problema del
sito né dei dati.

**Modifica:** aggiunte `-webkit-text-size-adjust: 100%` e
`text-size-adjust: 100%` alla regola `html { }` in cima al CSS. Vale per
entrambe le liste (Anime e Manga) e per qualsiasi altro testo che Safari
stesse gonfiando. Sui dispositivi che avevano già visitato il sito serve un
ricaricamento forzato per superare la cache di GitHub Pages.

## Richiesta 7 — "TypeError: Load failed" in salvataggio su iPhone

**Problema riscontrato:** salvando un nuovo manga da iPhone compariva ogni
tanto "❌ Errore durante il salvataggio: TypeError: Load failed". Ricliccando
subito "Salva" il salvataggio andava a buon fine. Solo su iOS, mai su Android.

**Causa:** `TypeError: Load failed` è il messaggio con cui Safari segnala che
la richiesta non è nemmeno partita — non è un errore di Supabase (quelli
arrivano come testo: *duplicate key*, *row-level security*, ecc.), non c'entra
il multi-utente. Safari tiene aperte le connessioni verso Supabase e le chiude
senza preavviso quando la pagina resta in background, lo schermo si spegne o
il telefono passa da Wi-Fi a rete dati; il browser prova comunque a riusarle e
la prima chiamata muore sul nascere, mentre la seconda ne apre una nuova e
funziona. Da qui il "Salva → errore → Salva → ok".
Il salvataggio di un manga è particolarmente esposto perché non è una sola
chiamata ma quattro/cinque in fila (insert `manga` → insert `sinossi_manga` →
log CREAZIONE → eventuale log ACQUISTO → rilettura lista con
`getMangaDataSB_()`): basta che una qualsiasi becchi la connessione morta.

**Modifiche (solo `index.html`, nessuna modifica a database o Edge Function):**
- Nuova `fetchConRitentativi_(input, init)` subito sopra `createClient`, con
  le costanti `TENTATIVI_RETE` (3) e `ATTESE_RITENTATIVO_MS` ([400, 1200]) e
  la funzione di supporto `attendi_(ms)`.
- `createClient(...)` ora riceve `{ global: { fetch: fetchConRitentativi_ } }`:
  `supabase-js` accetta una fetch personalizzata, così la correzione sta in un
  punto solo invece che nelle decine di chiamate sparse nel file.
- Ogni ritentativo scrive un `console.warn`, utile se il problema si ripresenta.

**Regola importante del ritentativo:** si ripete **solo** quando `fetch`
fallisce con un `TypeError`, cioè quando la richiesta non è arrivata a
destinazione. Se il server ha risposto — anche con un errore — la risposta
viene restituita così com'è e non si ritenta nulla: una chiamata che potrebbe
aver già scritto sul database non va ripetuta alla cieca.

**Copertura:** valendo sul client Supabase, il ritentativo protegge tutte le
operazioni (anime, manga, cinema, log, statistiche, login e refresh sessione)
e anche la Edge Function `tmdb-proxy`, che passa da `functions.invoke`.
Restano fuori le due `fetch` dirette verso AniList e l'API di traduzione: sono
sole letture, se falliscono non si perde nulla e basta ripremere 🔎.

**Caso limite noto:** se la richiesta fosse arrivata al server e si fosse persa
solo la risposta, il ritentativo di un inserimento verrebbe respinto dal
vincolo di unicità `(titolo, user_id)` con il messaggio Postgres
`duplicate key…`. Non è un rischio introdotto ora (succedeva già ricliccando
"Salva" a mano) e il dato resta corretto: nessun doppione a database.


## Richiesta 8 — Rimozione Stats/Consigliami + nuova sezione Serie TV

### Rimozioni (solo `index.html`, backup `index_backup_pre_serietv.html` prima di toccare nulla)

- **Stats**: via bottone `nav-stats`, intero `statsView` (HTML), script CDN Chart.js,
  ramo `stats` in `switchView`, ~800 righe JS (`getStatsDataSB_`, `caricaDatiStats`,
  `renderStats*`, gauge, heatmap, palette). Conservati i 3 pezzi riusati altrove:
  `toggleStatsWidget` (widget Cinema), `COLORE_VISIONE_LABELS` (ricerca globale),
  `cssVar`; nel toggle rimosso il riferimento a `statsCharts` (ormai inesistente,
  avrebbe rotto l'apertura dei widget Cinema). CSS di card/widget lasciato (riusato
  dai widget Cinema).
- **"Consigliami cosa guardare"**: via bottone `btnRandomAnime` + intero handler
  `onclick` (autonomo, nessuna dipendenza).

### Prerequisiti fatti da utente (dashboard Supabase, fuori da `index.html`)

- Tabelle `serie_tv` / `episodi_serie_tv` / `sinossi_serie_tv` (nate già multi-utente:
  `user_id`, UNIQUE composti, FK composite con CASCADE, RLS "solo le proprie righe").
- Edge Function `tmdb-proxy` estesa con `tv_search` (primi 8 risultati) e `tv_detail`
  (titolo, trama, immagine w500, generi, stato mappato Returning→In corso,
  Ended/Canceled→Concluso, resto→In arrivo; Stagione 0 sempre esclusa).
- **SQL richiesto prima del deploy** (il vincolo bloccava i log delle serie):
  ```sql
  ALTER TABLE log_attivita DROP CONSTRAINT log_attivita_tipo_media_check;
  ALTER TABLE log_attivita ADD CONSTRAINT log_attivita_tipo_media_check
    CHECK (tipo_media IN ('ANIME','MANGA','CINEMA','SERIE_TV'));
  ```

### Decisioni prese (punti 1–12 della richiesta)

1. Flag "già vista" + picker TMDB: con TMDB segna tutto coi numeri reali; senza TMDB
   le stagioni a totale 0 restano a 0 e si correggono a mano con la matita.
2. Season 0 / Specials esclusi. 3. Mappatura stati confermata. 4. Generi in sola
   lettura da TMDB (modello Cinema), filtro sulla lista fissa `TMDB_TV_GENRES_LIST`
   (16 voci TV ufficiali). 5. Contatori: Serie Iniziate, Stagioni Viste, Episodi
   Visti, Serie Completate. 6. Niente voto né priorità, solo preferito. 7. Overlay
   episodi dedicato (non condiviso con Anime). 8. Ricerca globale estesa.
   9. Totali TMDB = "uscito finora", nessun auto-aggiornamento. 10. Nuovo pulsante
   🔄 "Aggiorna da TMDB": aggiunge solo stagioni con numero nuovo, mai
   sovrascrive/cancella (richiede `tmdb_id` salvato). 11. Serie celesti nel widget
   In Corso con avanzamento episodio per episodio. 12. Log episodi dedicato nella
   vista + azioni generiche nel log Home (testata con genere SERIE_TV).
   Extra: `log_episodi` condiviso senza colonna media (collisioni solo a parità di
   titolo, accettato); icona sezione 📡.

### Frontend (solo `index.html`, stile/nomi come gli Anime, suffissi `SerieTv`/`serietv`)

- **Vista** `serietvView` (tra Anime e Manga): contatori, linguette Lista/Log,
  filtri come Anime meno voto e stagioni esatte, tabella senza colonna Voto, azioni
  riga ⭐/ℹ️ (trama via `mostraSinossi(...,'serietv')`)/📡/🔄/✏️/🗑️.
- **Modali** `modalOverlaySerieTv` (titolo+TMDB, stato, stagioni tot/viste auto,
  generi readonly, flag già-vista con `confirm`, note, immagine, checklist stagioni
  TMDB) e `modalOverlayStagioniSerieTv` dedicato.
- **JS dati**: `getSerieTvDataSB_`, `add/update/deleteSerieTvSB_`,
  `ricalcolaSincronizzaELoggaSerieTvSB_` (log SERIE_TV: CREAZIONE/AVANZAMENTO/
  IN_PARI/COMPLETAMENTO/CAMBIO_STATO), `segnaStagioniComeVisteSerieTvSB_`,
  update stagioni con vincolo sequenziale, TMDB `tv_search`/`tv_detail`.
- **Condivisi estesi**: sinossi (`serietv`→`sinossi_serie_tv`), widget In Corso
  (card SERIE TV + overlay con copertina), log Home (badge + frasi), ricerca
  globale (gruppo Serie TV), dropdown generi in `buildGenresForms`, `switchView`.
- **CSS nuovi**: `btn-serietv`, `log-badge-serietv`, `tipo-serietv` (label/placeholder
  ricerca).

**Fix log episodi Serie TV (mostrava gli anime):** `log_episodi` condiviso senza distinzione di media. Aggiunta colonna `tipo_media` (SQL sotto), scritta da `registraLogEpisodioSB_` (nuovo parametro, default `ANIME`) e filtrata da `ottieniLogEpisodiSB_` (nuovo parametro: `ANIME` nella vista Anime, `SERIE_TV` in quella Serie TV). Le righe storiche nascono `ANIME` di default; quelle delle serie già scritte vengono riclassificate dai titoli in `serie_tv`.

**Fix post-deploy (home bianca / bottoni morti):** la rimozione del ramo `stats` in `switchView` aveva portato via anche la `}` di chiusura del blocco Cinema → `SyntaxError: Unexpected end of input`, l intero script non girava. Ripristinata la chiusura; sistemati anche `getIndiceRicercaSB_` (mancava `getSerieTvDataSB_` nel `Promise.all`, push serie annidato nel forEach cinema) e rimossa una riga spuria finita dopo `</html>`. Verifica: pagina aperta in Chrome headless, zero `Uncaught` in console.

## Richiesta 9 — Aggiornamento TMDB massivo Serie TV

Nuovo bottone "🔄 Aggiorna tutte" in testata vista (`btnAggiornaTutteSerieTv`) + overlay `modalOverlayBulkSerieTv` con checkbox per serie/stagione/episodi, selettori Tutte/Nessuna e riepilogo scansione (novità / già aggiornate / senza link TMDB / errori). `aggiornaTutteSerieTvDaTMDB_` interroga `tv_detail` solo per serie non concluse con `tmdbId` (una chiamata alla volta, avanzamento visibile); mostra solo stagioni con numero maggiore del massimo salvato. `salvaBulkSerieTvTMDB_` aggiunge le sole righe mancanti (controllo anti-duplicato per numero), aggiorna `stagioni_totali`, ricalcola colore e logga AVANZAMENTO per serie. Nuove stagioni a zero visti. Solo `index.html` (backup `index_backup_pre_bulk.html`), nessun cambio DB/Edge. Verifica: Chrome headless, zero `Uncaught`.

# 👥 PARTE 4 — Multi-utente

Obiettivo: condividere il sito con una seconda persona (login separato),
mantenendo i dati delle due utenze completamente separati — stessa
interfaccia, stesso codice, dati isolati per proprietario.

## ⏳ FASE 17 — Multi-utente: isolamento dati per proprietario

*(in corso — pianificazione)*

### Il piano in breve

1. **Aggiungere una colonna `user_id`** a tutte le 8 tabelle, valorizzata in
   automatico con `auth.uid()` (l'utente che sta scrivendo) — il sito non
   deve specificarla mai a mano.
2. **Aggiornare le relazioni tra tabelle** che oggi si collegano tramite
   titolo (`episodi_anime`/`sinossi_anime` → `anime`, `sinossi_manga` →
   `manga`): il titolo da solo non basta più a identificare una riga in modo
   univoco (tu e il tuo amico potreste avere entrambi "Naruto"), quindi
   diventa **titolo + proprietario insieme**. `log_attivita`/`log_episodi`
   non hanno vincoli di questo tipo (sono testo libero), gli basta il nuovo
   `user_id` per essere filtrati correttamente.
3. **Riscrivere le regole RLS**: da "chiunque sia loggato vede tutto" a
   "vedi solo le righe con il tuo `user_id`".
4. **Creare la seconda utenza** Supabase Auth per il tuo amico.
5. **Adattare le funzioni di scrittura in `index.html`** che oggi
   identificano una riga solo con il titolo, per usarne due (titolo +
   proprietario) dove serve — non tutte le funzioni, solo quelle di
   Anime/Manga che toccano le tabelle collegate.

### ⚠️ Prima di iniziare: backup

Questa fase modifica la struttura delle tabelle con dati reali dentro. Prima
di procedere:
1. Vai su **Table Editor** (o **Database → Backups** se sul piano Free è
   disponibile) e **esporta ogni tabella in CSV** (pulsante di export in
   alto a destra nel Table Editor), oppure
2. **SQL Editor → nuova query**: `SELECT * FROM anime;` (e così per le
   altre 7 tabelle), poi copia i risultati da qualche parte al sicuro.

Meglio pochi minuti spesi ora che un imprevisto senza rete di sicurezza.

Fammi sapere quando hai fatto il backup, poi partiamo dal primo passo vero:
recuperare il tuo `user_id` attuale (serve per "assegnarti" retroattivamente
tutti i dati già esistenti, prima di attivare le nuove regole).

## ✅ FASE 17 — Completata

**Schema:** aggiunta colonna `user_id` (UUID, `DEFAULT auth.uid()`, `NOT
NULL`) a tutte le 8 tabelle, dati esistenti assegnati retroattivamente al
tuo utente. Le relazioni per titolo sono diventate composite
(`titolo`/`anime_titolo`/`manga_titolo` + `user_id`):
- `anime`/`manga`: vincolo univoco `(titolo, user_id)`
- `episodi_anime`: vincolo univoco `(anime_titolo, tipo, numero, user_id)`,
  foreign key composita verso `anime (titolo, user_id)`
- `sinossi_anime`/`sinossi_manga`: chiave primaria diventata
  `(anime_titolo/manga_titolo, user_id)`, foreign key composita
- Tutte le FK con `ON UPDATE CASCADE ON DELETE CASCADE` preservato

**Intoppo incontrato e risolto:** il primo tentativo ha provato a eliminare
i vecchi vincoli univoci (`anime_titolo_key`, `manga_titolo_key`) prima
delle foreign key che ne dipendevano ancora → errore Postgres `2BP01`.
Nessun danno (era dentro una transazione, rollback automatico) — corretto
semplicemente l'ordine delle operazioni: prima le foreign key dipendenti,
poi i vincoli che sostituiscono.

**RLS riscritta:** da `USING (true)` (chiunque loggato vede tutto) a
`USING (user_id = auth.uid())` (ognuno vede solo le proprie righe), su
tutte le 8 tabelle.

**Nessuna modifica al codice del sito.** Le query in `index.html` restano
identiche a prima (`select('*')`, `.eq('titolo', ...)`): è la RLS a
filtrare in automatico, in modo trasparente, senza che il JavaScript debba
sapere nulla dell'esistenza di altri utenti.

**Testato dal vivo:** creata la seconda utenza per l'amico (stessa
procedura della Fase 9), login effettuato → sito correttamente vuoto,
pronto per i suoi dati, senza vedere nulla di quanto già inserito.

**Cosa NON ha richiesto modifiche** (già multi-utente "per natura"):
Edge Function `tmdb-proxy` (controlla solo "sei autenticato", non importa
chi), chiamate AniList e traduzione (pubbliche, senza distinzione di
utente), chiavi/URL Supabase (stesso progetto per entrambi, cambia solo
l'account di login).

---
*Ultimo aggiornamento: Fase 17 completata e testata — sito multi-utente, dati isolati per proprietario via RLS, nessuna modifica al codice frontend necessaria.*
