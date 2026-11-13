/**
 * Edge Function `tracker-feed`: riassunto in sola lettura di cosa stai guardando e leggendo,
 * per la Dashboard personale (personal-life-manager).
 *
 * - Pubblicata con verify_jwt = false: l'autenticazione è il token nell'header `X-Feed-Token`,
 *   confrontato con la sua impronta in config.ts.
 * - Legge con la chiave di servizio che Supabase fornisce alla funzione: non esce mai da qui.
 *   Il tracker ha DUE utenti, quindi ogni query filtra sul proprietario (OWNER_USER_ID).
 * - Solo `select`: non modifica dati, tabelle né regole RLS del tracker.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { buildTrackerFeed, type AnimeRow, type LogRow, type MangaRow, type SerieRow } from './build.ts';
import { APP_URL, FEED_TOKEN_SHA256, OWNER_USER_ID } from './config.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Restituisce i dati di una query, oppure lancia un errore senza dettagli interni. */
function must<T>(res: { data: T | null; error: unknown }, what: string): T {
  if (res.error || res.data === null) {
    console.error(`tracker-feed: lettura di ${what} non riuscita`);
    throw new Error('lettura non riuscita');
  }
  return res.data;
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return json({ errore: 'Usa GET.' }, 405);

  const token = req.headers.get('X-Feed-Token') ?? '';
  if (!token || token.length > 200 || !timingSafeEqual(await sha256Hex(token), FEED_TOKEN_SHA256)) {
    return json({ errore: 'Token mancante o non valido.' }, 401);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const [anime, animeEp, series, seriesEp, manga, books, logs] = await Promise.all([
      db
        .from('anime')
        .select('titolo, stato, stagioni_totali, stagioni_viste, film_totali, film_visti, abbandonata, immagine, priorita')
        .eq('user_id', OWNER_USER_ID),
      db.from('episodi_anime').select('anime_titolo').eq('user_id', OWNER_USER_ID).gt('episodi_visti', 0),
      db
        .from('serie_tv')
        .select('titolo, stato, stagioni_totali, stagioni_viste, abbandonata, immagine, priorita')
        .eq('user_id', OWNER_USER_ID),
      db.from('episodi_serie_tv').select('serie_titolo').eq('user_id', OWNER_USER_ID).gt('episodi_visti', 0),
      db
        .from('manga')
        .select('titolo, stato, volumi, volumi_letti, immagine, priorita')
        .eq('user_id', OWNER_USER_ID),
      db
        .from('libri')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', OWNER_USER_ID)
        .eq('stato', 'Da leggere'),
      db
        .from('log_attivita')
        .select('timestamp, id_titolo, tipo_media, tipo_evento, valore_nuovo')
        .eq('user_id', OWNER_USER_ID)
        .order('timestamp', { ascending: false })
        .limit(300),
    ]);
    if (books.error) throw new Error('lettura non riuscita');

    const data = buildTrackerFeed({
      appUrl: APP_URL,
      anime: must(anime, 'anime') as AnimeRow[],
      animeWithEpisodes: new Set(must(animeEp, 'episodi anime').map((e) => e.anime_titolo as string)),
      series: must(series, 'serie') as SerieRow[],
      seriesWithEpisodes: new Set(must(seriesEp, 'episodi serie').map((e) => e.serie_titolo as string)),
      manga: must(manga, 'manga') as MangaRow[],
      booksToRead: books.count ?? 0,
      logs: must(logs, 'attività') as LogRow[],
    });
    return json({ source: 'tracker', version: 1, generated_at: new Date().toISOString(), data });
  } catch {
    return json({ errore: 'Lettura del tracker non riuscita.' }, 500);
  }
});
