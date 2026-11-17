// Edge Function tmdb-proxy: il sito chiede a TMDB (film e serie TV) passando
// da qui, così la chiave TMDB resta un secret del server (TMDB_API_KEY).
// Risponde solo a utenti che hanno fatto l'accesso al tracker.
// Copia salvata nel repository con la Richiesta 64 (prima esisteva solo su
// Supabase): ogni modifica va pubblicata con deploy_edge_function, verify_jwt
// false (il controllo dell'accesso è fatto qui sotto).
import { createClient } from 'jsr:@supabase/supabase-js@2';
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Verifica manuale del login (sostituisce il vecchio toggle "legacy") ---
    // Creiamo un client Supabase usando il token dell'utente che ha chiamato
    // questa funzione (preso dall'header Authorization) e chiediamo "chi sei?".
    // Se il token non corrisponde a un utente autenticato reale, blocchiamo.
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData || !userData.user) {
      return new Response(JSON.stringify({ error: 'Accesso non autorizzato: effettua il login.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
      const generiTesto = (media.genres || []).map((g: any) => g.name).filter(Boolean).join(', ');

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
        immagine: immagine,
        trama: media.overview || '',
        generi: generiTesto
      };
      return new Response(JSON.stringify(dettaglio), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'movie_recommendations') {
      // Richiesta 65: come tv_recommendations (R64) ma per i film: pagine 1 e
      // 2 (fino a 40, prima le prime 10), con trama italiana e, dove manca,
      // inglese (tramaEn). Campi vecchi invariati: compatibile col sito vecchio.
      const id = body.id || '';
      const urlPagina = (lingua: string, pagina: number) => 'https://api.themoviedb.org/3/movie/' + encodeURIComponent(id)
        + '/recommendations?api_key=' + encodeURIComponent(apiKey) + '&language=' + lingua + '&region=IT&page=' + pagina;
      const leggi = async (lingua: string, pagina: number) => {
        try {
          const r = await fetch(urlPagina(lingua, pagina));
          const j = await r.json();
          return (j && Array.isArray(j.results)) ? j.results : [];
        } catch (_e) { return []; }
      };
      const [p1, p2] = await Promise.all([leggi('it-IT', 1), leggi('it-IT', 2)]);
      const visti = new Set<number>();
      const grezzi = p1.concat(p2).filter((m: any) => {
        if (!m || !m.id || visti.has(m.id)) return false;
        visti.add(m.id);
        return true;
      });
      const tramaEn: Record<number, string> = {};
      if (grezzi.some((m: any) => !m.overview)) {
        const [e1, e2] = await Promise.all([leggi('en-US', 1), leggi('en-US', 2)]);
        e1.concat(e2).forEach((m: any) => { if (m && m.id && m.overview) tramaEn[m.id] = m.overview; });
      }
      const risultati = grezzi.map((m: any) => ({
        id: m.id,
        tipo: m.media_type || '',
        titolo: m.title || m.original_title || 'Senza titolo',
        anno: (m.release_date || '').substring(0, 4),
        voto: (typeof m.vote_average === 'number' && m.vote_average > 0) ? Math.round(m.vote_average * 10) / 10 : null,
        votiTotali: (typeof m.vote_count === 'number') ? m.vote_count : null,
        immagine: m.poster_path ? ('https://image.tmdb.org/t/p/w342' + m.poster_path) : '',
        trama: m.overview || '',
        tramaEn: m.overview ? '' : (tramaEn[m.id] || '')
      }));
      return new Response(JSON.stringify(risultati), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'tv_search') {
      const query = body.query || '';
      const tmdbUrl = 'https://api.themoviedb.org/3/search/tv?api_key=' + encodeURIComponent(apiKey)
        + '&query=' + encodeURIComponent(query) + '&language=it-IT&include_adult=false';
      const resp = await fetch(tmdbUrl);
      const json = await resp.json();
      const risultati = (json.results || []).slice(0, 8).map((s: any) => ({
        id: s.id,
        titolo: s.name || s.original_name || 'Senza titolo',
        anno: (s.first_air_date || '').substring(0, 4),
        immagine: s.poster_path ? ('https://image.tmdb.org/t/p/w342' + s.poster_path) : ''
      }));
      return new Response(JSON.stringify(risultati), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'tv_detail') {
      const id = body.id || '';
      const tmdbUrl = 'https://api.themoviedb.org/3/tv/' + encodeURIComponent(id)
        + '?api_key=' + encodeURIComponent(apiKey) + '&language=it-IT';
      const resp = await fetch(tmdbUrl);
      const serie = await resp.json();
      if (!serie || serie.success === false) {
        return new Response(JSON.stringify({ error: 'Serie non trovata su TMDB.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const immagine = serie.poster_path ? ('https://image.tmdb.org/t/p/w500' + serie.poster_path) : '';
      const generiTesto = (serie.genres || []).map((g: any) => g.name).filter(Boolean).join(', ');

      const mappaStato: Record<string, string> = {
        'Returning Series': 'In corso',
        'Ended': 'Concluso',
        'Canceled': 'Concluso',
        'In Production': 'In arrivo',
        'Planned': 'In arrivo',
        'Pilot': 'In arrivo'
      };
      const statoMappato = mappaStato[serie.status] || 'In corso';

      // Esclude sempre la Stagione 0 (Specials): contenuti extra/dietro le
      // quinte, non fa parte della visione "normale" della serie.
      const stagioni = (serie.seasons || [])
        .filter((s: any) => s.season_number && s.season_number > 0)
        .map((s: any) => ({
          numero: s.season_number,
          nome: s.name || ('Stagione ' + s.season_number),
          episodi: s.episode_count || 0,
          anno: (s.air_date || '').substring(0, 4),
          immagine: s.poster_path ? ('https://image.tmdb.org/t/p/w185' + s.poster_path) : immagine
        }));

      const dettaglio = {
        id: serie.id,
        titolo: serie.name || serie.original_name || '',
        trama: serie.overview || '',
        immagine: immagine,
        generi: generiTesto,
        stato: statoMappato,
        stagioni: stagioni
      };
      return new Response(JSON.stringify(dettaglio), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'tv_recommendations') {
      // Richiesta 64: pagine 1 e 2 di TMDB (fino a 40 serie, prima erano le
      // prime 10 della pagina 1), con la trama italiana e, dove manca, quella
      // inglese (tramaEn) che il sito traduce. Stessi campi di prima più
      // trama/tramaEn/votiTotali: la versione vecchia del sito continua a
      // funzionare (prende solo i primi risultati).
      const id = body.id || '';
      const urlPagina = (lingua: string, pagina: number) => 'https://api.themoviedb.org/3/tv/' + encodeURIComponent(id)
        + '/recommendations?api_key=' + encodeURIComponent(apiKey) + '&language=' + lingua + '&page=' + pagina;
      const leggi = async (lingua: string, pagina: number) => {
        try {
          const r = await fetch(urlPagina(lingua, pagina));
          const j = await r.json();
          return (j && Array.isArray(j.results)) ? j.results : [];
        } catch (_e) { return []; }
      };
      const [p1, p2] = await Promise.all([leggi('it-IT', 1), leggi('it-IT', 2)]);
      const visti = new Set<number>();
      const grezzi = p1.concat(p2).filter((m: any) => {
        if (!m || !m.id || visti.has(m.id)) return false;
        visti.add(m.id);
        return true;
      });
      // Trama inglese solo se serve (2 richieste in più al massimo)
      const tramaEn: Record<number, string> = {};
      if (grezzi.some((m: any) => !m.overview)) {
        const [e1, e2] = await Promise.all([leggi('en-US', 1), leggi('en-US', 2)]);
        e1.concat(e2).forEach((m: any) => { if (m && m.id && m.overview) tramaEn[m.id] = m.overview; });
      }
      const risultati = grezzi.map((m: any) => ({
        id: m.id,
        tipo: m.media_type || '',
        titolo: m.name || m.original_name || 'Senza titolo',
        anno: (m.first_air_date || '').substring(0, 4),
        voto: (typeof m.vote_average === 'number' && m.vote_average > 0) ? Math.round(m.vote_average * 10) / 10 : null,
        votiTotali: (typeof m.vote_count === 'number') ? m.vote_count : null,
        immagine: m.poster_path ? ('https://image.tmdb.org/t/p/w342' + m.poster_path) : '',
        trama: m.overview || '',
        tramaEn: m.overview ? '' : (tramaEn[m.id] || '')
      }));
      return new Response(JSON.stringify(risultati), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Parametro "action" mancante o non valido (usa "search", "detail", "movie_recommendations", "tv_search", "tv_detail" o "tv_recommendations").' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Errore interno della funzione: ' + (err && err.message ? err.message : String(err)) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
