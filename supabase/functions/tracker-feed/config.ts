/**
 * Configurazione del feed per la Dashboard personale. Questo repository è pubblico: qui non
 * c'è nessun segreto.
 * - OWNER_USER_ID: l'utente di cui mostrare i dati (il tracker ha due utenti). È solo un
 *   identificativo: senza la chiave di servizio, che resta dentro Supabase, non dà accesso a nulla.
 * - FEED_TOKEN_SHA256: impronta SHA-256 del token che la Dashboard manda nell'header
 *   `X-Feed-Token`. Il token vero sta solo tra i segreti del Worker Cloudflare
 *   (FEED_TOKEN_TRACKER); dall'impronta non si può risalire al token.
 * Per cambiare token: nella cartella di personal-life-manager `pnpm.cmd feed:token tracker`,
 * poi scrivere qui la nuova impronta e ripubblicare la funzione.
 */
export const OWNER_USER_ID = 'c2fcedfa-a2ff-4112-a0e1-7ed9f2053e34';
export const FEED_TOKEN_SHA256 = 'DA-IMPOSTARE';

/** Indirizzo del tracker, per i collegamenti dal riquadro. */
export const APP_URL = 'https://djkata94.github.io/tracker-anime-manga/';
