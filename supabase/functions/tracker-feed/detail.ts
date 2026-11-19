/**
 * Scheda di una singola opera per la Dashboard personale (personal-life-manager), in sola
 * consultazione: la Dashboard la chiede solo quando Gabriele clicca un titolo nel riquadro del
 * tracker (GET tracker-feed?tipo=anime&titolo=...). Logica pura, senza Deno né Supabase: si prova
 * con `node --test` (detail.test.ts).
 *
 * L'opera si cerca per titolo, come fa il tracker stesso (log_attivita.id_titolo ed episodi_*
 * usano il titolo). Le note personali ci sono (scelta di Gabriele del 19/11/2026: la scheda le
 * chiede solo al clic, non finiscono nelle istantanee della Dashboard).
 * La forma dell'uscita è il contratto `trackerItemDetail` in
 * personal-life-manager/packages/shared/src/feeds/tracker.ts: se cambia qui, va cambiata là.
 */
import { animeColor, clip, safeImage, serieColor, type Visione } from './build.ts';

export const DETAIL_KINDS = ['anime', 'serie', 'manga', 'film', 'libro'] as const;
export type DetailKind = (typeof DETAIL_KINDS)[number];

/** Tabella del tracker e valore di log_attivita.tipo_media per ogni tipo di scheda. */
export const KIND_SOURCE: Record<DetailKind, { table: string; media: string }> = {
  anime: { table: 'anime', media: 'ANIME' },
  serie: { table: 'serie_tv', media: 'SERIE_TV' },
  manga: { table: 'manga', media: 'MANGA' },
  film: { table: 'cinema', media: 'CINEMA' },
  libro: { table: 'libri', media: 'LIBRO' },
};

/** Colonne lette per ogni tabella (verificate sul database vero il 19/11/2026). */
export const KIND_COLUMNS: Record<DetailKind, string> = {
  anime:
    'titolo, stato, note, valutazione, stagioni_totali, stagioni_viste, film_totali, film_visti, generi, preferito, immagine, priorita, abbandonata, anilist_id, creato_il',
  serie:
    'titolo, tmdb_id, stato, note, stagioni_totali, stagioni_viste, generi, preferito, immagine, abbandonata, piattaforme',
  manga:
    'titolo, tipologia, volumi, stato, acquistato, note, generi, preferito, immagine, volumi_letti, priorita, anilist_id, creato_il',
  film: 'titolo, data_uscita, data_visione, visione, immagine, streaming, trama, generi, tmdb_id, piattaforme',
  libro:
    'titolo, autore, anno_pubblicazione, generi, saga_nome, saga_numero, stato, preferito, priorita, immagine, note, creato_il',
};

// deno-lint-ignore no-explicit-any
export type Row = Record<string, any>;

export interface EpisodeRow {
  tipo?: string | null;
  numero: number | null;
  anno?: number | null;
  episodi_totali: number | null;
  episodi_visti: number | null;
}

export interface DetailLogRow {
  timestamp: string;
  tipo_evento: string;
  valore_nuovo: string | null;
}

export interface TrackerItemDetail {
  kind: DetailKind;
  title: string;
  image: string | null;
  /** Stato personale: "In visione", "In pari", "Completato", "Letto", "Visto"... */
  status: string | null;
  /** Stato dell'opera (in corso, conclusa, in arrivo), se il tracker lo registra. */
  release_status: string | null;
  rating: number | null;
  favorite: boolean;
  priority: boolean;
  genres: string[];
  /** Altri dati brevi, già con l'etichetta in italiano. */
  facts: { label: string; value: string }[];
  /** Avanzamento complessivo (stagioni, film, volumi). */
  progress: { label: string; done: number; total: number }[];
  /** Episodi per stagione (anime e serie). */
  episodes: { label: string; done: number; total: number }[];
  notes: string | null;
  plot: string | null;
  platforms: string[];
  links: { label: string; url: string }[];
  activity: { at: string; event: string; value: string | null }[];
  app_url: string;
}

const n = (value: unknown) => Number(value) || 0;
const text = (value: unknown, max: number) => {
  const t = String(value ?? '').trim();
  return t ? clip(t, max) : null;
};
const genres = (value: unknown) =>
  String(value ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((g) => clip(g, 40));
const platforms = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((p) => (p && typeof p === 'object' ? text((p as Row).nome, 40) : null))
        .filter((p): p is string => p !== null)
        .slice(0, 10)
    : [];
/** "2026-11-19" → "19/11/2026" (date di calendario, nessun fuso). */
const day = (value: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
};
const positiveId = (value: unknown) => (Number.isInteger(value) && Number(value) > 0 ? Number(value) : null);

const VISIONE_LABEL: Record<Visione, string> = {
  bianco: 'Da iniziare',
  celeste: 'In visione',
  giallo: 'In pari (in attesa di nuovi episodi)',
  verde: 'Completato',
  rosso: 'Abbandonato',
};

function mangaStatus(m: Row): string {
  const letti = n(m.volumi_letti);
  const totali = n(m.volumi);
  if (letti <= 0) return 'Da iniziare';
  if (totali > 0 && letti >= totali) return 'Letto tutto';
  return 'In lettura';
}

function episodeRows(rows: EpisodeRow[], kind: 'anime' | 'serie') {
  return [...rows]
    .sort((a, b) => String(a.tipo ?? '').localeCompare(String(b.tipo ?? '')) || n(a.numero) - n(b.numero))
    .slice(0, 40)
    .map((e) => ({
      label:
        kind === 'anime' && e.tipo === 'Film'
          ? `Film ${n(e.numero)}`
          : `Stagione ${n(e.numero)}${e.anno ? ` (${e.anno})` : ''}`,
      done: n(e.episodi_visti),
      total: n(e.episodi_totali),
    }));
}

export function buildItemDetail(input: {
  kind: DetailKind;
  row: Row;
  episodes: EpisodeRow[];
  logs: DetailLogRow[];
  appUrl: string;
}): TrackerItemDetail {
  const { kind, row: r } = input;
  const facts: TrackerItemDetail['facts'] = [];
  const progress: TrackerItemDetail['progress'] = [];
  const links: TrackerItemDetail['links'] = [];
  let status: string | null = null;
  let releaseStatus: string | null = text(r.stato, 60);

  if (kind === 'anime') {
    status = VISIONE_LABEL[animeColor(r as never, input.episodes.some((e) => n(e.episodi_visti) > 0))];
    progress.push({ label: 'Stagioni', done: n(r.stagioni_viste), total: n(r.stagioni_totali) });
    if (n(r.film_totali) > 0) progress.push({ label: 'Film', done: n(r.film_visti), total: n(r.film_totali) });
    const id = positiveId(r.anilist_id);
    if (id) links.push({ label: 'AniList', url: `https://anilist.co/anime/${id}` });
  } else if (kind === 'serie') {
    status = VISIONE_LABEL[serieColor(r as never, input.episodes.some((e) => n(e.episodi_visti) > 0))];
    progress.push({ label: 'Stagioni', done: n(r.stagioni_viste), total: n(r.stagioni_totali) });
    const id = positiveId(r.tmdb_id);
    if (id) links.push({ label: 'TMDB', url: `https://www.themoviedb.org/tv/${id}` });
  } else if (kind === 'manga') {
    status = mangaStatus(r);
    progress.push({ label: 'Volumi', done: n(r.volumi_letti), total: n(r.volumi) });
    const tipologia = text(r.tipologia, 40);
    if (tipologia) facts.push({ label: 'Tipo', value: tipologia });
    if (r.acquistato !== null && r.acquistato !== undefined) {
      facts.push({ label: 'Acquistato', value: r.acquistato ? 'sì' : 'no' });
    }
    const id = positiveId(r.anilist_id);
    if (id) links.push({ label: 'AniList', url: `https://anilist.co/manga/${id}` });
  } else if (kind === 'film') {
    status = r.visione ? 'Visto' : 'Da vedere';
    releaseStatus = null;
    const uscita = day(r.data_uscita);
    const visione = day(r.data_visione);
    if (uscita) facts.push({ label: 'Uscita', value: uscita });
    if (visione) facts.push({ label: 'Visto il', value: visione });
    const id = positiveId(r.tmdb_id);
    if (id) links.push({ label: 'TMDB', url: `https://www.themoviedb.org/movie/${id}` });
  } else {
    status = text(r.stato, 60);
    releaseStatus = null;
    const autore = text(r.autore, 120);
    if (autore) facts.push({ label: 'Autore', value: autore });
    if (positiveId(r.anno_pubblicazione)) facts.push({ label: 'Anno', value: String(r.anno_pubblicazione) });
    const saga = text(r.saga_nome, 120);
    if (saga) {
      const numero = Number(r.saga_numero);
      facts.push({ label: 'Saga', value: numero > 0 ? `${saga} #${numero}` : saga });
    }
  }

  const rating = Number(r.valutazione);
  return {
    kind,
    title: clip(String(r.titolo ?? ''), 200),
    image: safeImage(r.immagine ?? null),
    status,
    release_status: releaseStatus,
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    favorite: r.preferito === true,
    priority: r.priorita === true,
    genres: genres(r.generi),
    facts,
    progress,
    episodes: kind === 'anime' || kind === 'serie' ? episodeRows(input.episodes, kind) : [],
    notes: text(r.note, 4000),
    plot: kind === 'film' ? text(r.trama, 2000) : null,
    platforms: platforms(r.piattaforme),
    links,
    activity: input.logs.slice(0, 10).map((l) => ({
      at: l.timestamp,
      event: clip(String(l.tipo_evento ?? ''), 30),
      value: l.valore_nuovo === null ? null : clip(String(l.valore_nuovo), 40),
    })),
    app_url: input.appUrl,
  };
}
