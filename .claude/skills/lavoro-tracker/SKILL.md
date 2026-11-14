---
name: lavoro-tracker
description: Procedura e regole di Gabriele per ogni modifica a NERD.TRACKER (tracker-anime-manga) - file, encoding, stile vetro, database Supabase, prove in locale, tracciamento (guida + patch notes), commit e pubblicazione su GitHub Pages. Da usare SEMPRE prima di modificare file del sito, toccare il database o pubblicare, anche per un ritocco piccolo.
---

# Lavorare su NERD.TRACKER

Regole decise con Gabriele (l'owner) nel tempo. Valgono per ogni modifica, anche piccola.
Se una regola qui è in conflitto con una richiesta esplicita di Gabriele, vale la richiesta.

## Il progetto in breve

- Sito statico senza build: `index.html`, `css/style.css` e 8 file JS caricati in quest'ordine:
  `state-ui`, `anime-all`, `serie-tv`, `manga`, `libri-patch`, `cinema`, `main`, `config-auth`.
- Online: https://djkata94.github.io/tracker-anime-manga/ (GitHub Pages dal ramo `main`,
  repo pubblica `djkata94/tracker-anime-manga`). **Un push su main va subito online.**
- Backend Supabase, ref `jcclzcyezqbhmxptlnoo`. RLS "solo le proprie righe" su tutte le tabelle.
  Edge Function: `tmdb-proxy`, `hardcover-proxy`, `tracker-feed` (in `supabase/functions/`).
- `supabaseClient` è una `const` globale, non `window.supabaseClient`.
- Diario tecnico: `guida_migrazione.md` (una sezione "## Richiesta N" per ogni richiesta).

## 1. Prima di cominciare

1. Leggi lo stato in digital-brain (progetto `tracker-anime-manga`): `get_project_state`, poi
   `search_memory` sull'argomento. La memoria di questi progetti è digital-brain, **non Engram**.
2. Il numero della prossima richiesta è quello dopo l'ultima "## Richiesta N" in
   `guida_migrazione.md` (le richieste possono arrivare anche da altre sessioni: controlla sempre).

## 2. Decidere con Gabriele

- Parla in italiano, semplice. Quando tocca a lui fare qualcosa: passi numerati, click per click.
- Prima di implementare qualcosa di visibile chiedi la disposizione con `AskUserQuestion`,
  con anteprime, e metti per prima l'opzione consigliata.
- Un ritocco chiesto "da PC" **non deve cambiare il telefono** (e viceversa): usa le media query.
- Bottoni delle schede: a sinistra ℹ️ e gli altri bottoni, a destra sempre ✏️ e poi 🗑️.
- Schede su telefono compatte (tre colonne con molti campi); prima di una lista nuova proponi
  il raggruppamento dei campi.
- Niente refactor non richiesti; resta nello stile del codice esistente (nomi e commenti in italiano).
- **Non riproporre**: restyle di hero/tabs/timeline, giardino, recap, Stats/Consigliami,
  leaked password protection. I TODO rimandati (Aggiorna tutti da AniList, prossimi episodi,
  Hardcover per i libri) si riprendono solo quando li richiama lui.

## 3. Modificare i file

- **Mai** `Get-Content`/`Set-Content` di PowerShell sui file del progetto: rovinano l'encoding.
- Usa lo strumento Edit. Per blocchi lunghi: scrivi il testo in un file nello scratchpad e
  appendilo con Node leggendo e scrivendo in `'utf8'` e portando i fine riga a CRLF
  (`.replace(/\r?\n/g, '\r\n')`).
- **Mai backtick o `${...}` dentro un `node -e "..."` lanciato da bash**: la shell li esegue e
  cancella parole dal testo. In quei casi usa Edit oppure uno script in un file.
- `css/style.css` è UTF-8 **con BOM** e CRLF: non togliere il BOM.
- Controlli dopo ogni modifica, sui file toccati:
  - `grep -cE 'Ã|ðŸ|â€|�' <file>` deve dare 0 (in `guida_migrazione.md` ce n'è 1 voluto);
  - `file <file>` deve dire "with CRLF line terminators";
  - `node --check <file>` per ogni JS.

## 4. Stile vetro (redesign v1.1.0)

- `backdrop-filter` rende l'elemento il contenitore dei figli `position:fixed` e crea un nuovo
  contesto di sovrapposizione: niente `backdrop-filter` annidati (es. sul `.modal`).
- Animare `opacity` o `filter` su un contenitore toglie il blur ai pannelli di vetro dentro
  (a fine animazione il vetro "salta"). Anima `transform` o elementi senza vetro.
- Piano B già presente: `@supports not (backdrop-filter)` e `prefers-reduced-transparency`.
- Effetto genio tra le sezioni (main.js, "CAMBIO SEZIONE A GENIO"): tempi approvati da Gabriele,
  PC `{esce:500, daQuando:500, entra:500, attesa:700}` (prima finisce il risucchio, poi esce
  la nuova), telefono `{esce:340, daQuando:240, entra:360, attesa:700}`. Non cambiarli senza
  chiederglielo.

## 5. Database Supabase

- Leggere è libero. Ogni modifica (schema o dati) **solo con l'ok di Gabriele**, in quest'ordine:
  1. prova dentro un `DO $$ ... $$` che finisce con `RAISE EXCEPTION 'PROVA ANNULLATA ...'`
     (controlla il numero di righe toccate);
  2. `apply_migration` con un nome in snake_case, senza id scritti a mano;
  3. `get_advisors` (security). L'avviso "Leaked Password Protection" è noto: non riproporlo.
- Le RLS "solo le proprie righe" coprono tutte le operazioni, DELETE compreso.
- Mai salvare password, chiavi o token in memoria, nei file o nei messaggi.

## 6. Provare in locale

- Server statico: `strumenti/serve.js` in questa cartella della skill. Configurazione in
  `.claude/launch.json` (ignorata da git), poi `preview_start`:
  ```json
  { "version": "0.0.1", "configurations": [ { "name": "tracker",
    "runtimeExecutable": "node",
    "runtimeArgs": [".claude/skills/lavoro-tracker/strumenti/serve.js", ".", "8765"],
    "port": 8765 } ] }
  ```
- Il login non si può fare (non inserire mai la password di Gabriele): dati finti in un file
  in `.claude/` caricati con fetch + eval, oppure sostituendo in console le funzioni
  `caricaDati*` / `caricaWidget*` e `supabaseClient.from` con versioni finte. Gli errori 401 in
  console sono normali.
- Prova PC (es. 1280 e 1440 di larghezza) **e** telefono (preset mobile). Ricarica la pagina
  dopo aver cambiato dimensione, altrimenti i widget del PC restano chiusi.
- Se il pannello del browser è nascosto, animazioni e `requestAnimationFrame` restano ferme:
  fai avanzare le animazioni a mano con `document.getAnimations()` o chiedi di mostrare il pannello.
- File di prova solo dentro `.claude/` (ignorata da git, tranne `.claude/skills/`).

## 7. Tracciamento

- In fondo a `guida_migrazione.md`: `## Richiesta N — Titolo (patch vX.Y.Z)` con segnalazione,
  causa, scelte di Gabriele, file toccati, prove fatte.
- In cima a `PATCH_NOTES` in `js/libri-patch.js` (salvo modifiche invisibili o ritocchi minimi):
  ```js
  { v: '1.1.5', titolo: 'Titolo breve', data: '14/11/2026', punti: [
      'Frase per Gabriele, non tecnica.',
  ] },
  ```
  Apostrofi scritti `\'`. La versione sale di una patch per ogni pubblicazione con novità;
  il numero di versione non coincide con il numero della richiesta.

## 8. Commit e pubblicazione

1. Mostra a Gabriele gli screenshot (PC e telefono) e **chiedi l'ok prima di pushare**:
   il push su `main` è la pubblicazione.
2. Commit: l'hook `.githooks/pre-commit` controlla la sintassi dei JS e aggiorna da solo i `?v=`
   in `index.html` (`tools/bump-version.js --staged`). Se manca:
   `git config core.hooksPath .githooks`. Messaggio: `Richiesta N: cosa cambia (patch vX.Y.Z)`.
   Lavori grossi su un ramo, poi `merge --no-ff` su main.
3. Dopo il push, verifica online con `curl` che `index.html` serva i nuovi `?v=` (l'API
   `pages/builds/latest` può restare indietro), poi apri il sito vero e controlla che le nuove
   funzioni esistano e che non ci siano errori JS.
4. Spiega a Gabriele come provarla, click per click (Ctrl+F5 su PC, chiudere e riaprire la
   scheda sul telefono).

## 9. A fine lavoro

- digital-brain: salva decisioni, cause dei problemi e cose imparate; aggiorna
  `update_project_summary`; archivia i TODO chiusi.
- Punto di ritorno prima del redesign vetro: commit `eddb64e` (v1.0.55), tag locale
  `prima-del-redesign`.

## Tenere aggiornata questa skill

Quando con Gabriele nasce una regola nuova o ne cambia una (un modo di lavorare, un no a
qualcosa, una trappola scoperta), **aggiorna subito questo file** nella sezione giusta,
committalo insieme al lavoro e diglielo in una riga. Tieni qui solo regole che valgono nel tempo:
lo stato del progetto e la cronaca vanno in digital-brain e in `guida_migrazione.md`.
