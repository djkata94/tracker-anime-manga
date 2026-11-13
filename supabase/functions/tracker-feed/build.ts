/**
 * Logica pura del feed per la Dashboard personale (personal-life-manager): quali anime, serie
 * e manga sono "in corso" per il proprietario e quali sono le ultime attività. Nessuna
 * dipendenza da Deno o Supabase: si prova con `node --test` (vedi build.test.ts).
 *
 * Le regole "in visione / in lettura" sono le stesse dei colori del tracker
 * (calcolaColoreVisioneAnime_, calcolaColoreVisioneSerieTv_, calcolaColoreLetturaManga_).
 * La forma dell'uscita è il contratto `trackerFeedData` (versione 1) in
 * personal-life-manager/packages/shared/src/feeds/tracker.ts: se cambia qui, va cambiata là.
 */

export interface AnimeRow {
  titolo: string;
  stato: string | null;
  stagioni_totali: number | null;
  stagioni_viste: number | null;
  film_totali: number | null;
  film_visti: number | null;
  abbandonata: boolean | null;
  immagine: string | null;
  priorita: boolean | null;
}

export interface SerieRow {
  titolo: string;
  stato: string | null;
  stagioni_totali: number | null;
  stagioni_viste: number | null;
  abbandonata: boolean | null;
  immagine: string | null;
  /** La tabella serie_tv NON ha la colonna priorita (anime e manga sì). */
  priorita?: boolean | null;
}

export interface MangaRow {
  titolo: string;
  stato: string | null;
  volumi: number | null;
  volumi_letti: number | null;
  immagine: string | null;
  priorita: boolean | null;
}

export interface LogRow {
  timestamp: string;
  id_titolo: string;
  tipo_media: 'ANIME' | 'MANGA' | 'CINEMA' | 'SERIE_TV' | 'LIBRO';
  tipo_evento: string;
  valore_nuovo: string | null;
}

export interface ProgressItem {
  title: string;
  image: string | null;
  done: number;
  total: number;
  unit: 'stagioni' | 'volumi';
}

export interface TrackerFeedData {
  app_url: string;
  anime: ProgressItem[];
  series: ProgressItem[];
  manga: ProgressItem[];
  counts: {
    anime_watching: number;
    anime_caught_up: number;
    series_watching: number;
    manga_reading: number;
    books_to_read: number;
  };
  recent: Array<{
    at: string;
    media: LogRow['tipo_media'];
    event: string;
    title: string;
    value: string | null;
  }>;
}

export type Visione = 'bianco' | 'celeste' | 'giallo' | 'verde' | 'rosso';

const n = (value: number | null | undefined) => Number(value) || 0;
const concluso = (stato: string | null) => String(stato ?? '').trim().toLowerCase() === 'concluso';

/** Come calcolaColoreVisioneAnime_ del tracker. */
export function animeColor(a: AnimeRow, haProgressoParziale: boolean): Visione {
  if (a.abbandonata) return 'rosso';
  const completato = n(a.stagioni_viste) === n(a.stagioni_totali) && n(a.film_visti) === n(a.film_totali);
  const iniziato = n(a.stagioni_viste) > 0 || n(a.film_visti) > 0 || haProgressoParziale;
  if (!iniziato) return 'bianco';
  if (!completato) return 'celeste';
  return concluso(a.stato) ? 'verde' : 'giallo';
}

/** Come calcolaColoreVisioneSerieTv_ del tracker. */
export function serieColor(s: SerieRow, haProgressoParziale: boolean): Visione {
  if (s.abbandonata) return 'rosso';
  const completato = n(s.stagioni_viste) === n(s.stagioni_totali);
  const iniziato = n(s.stagioni_viste) > 0 || haProgressoParziale;
  if (!iniziato) return 'bianco';
  if (!completato) return 'celeste';
  return concluso(s.stato) ? 'verde' : 'giallo';
}

/** Manga in lettura: iniziato e con volumi ancora da leggere (giallo con letti < totali). */
export function mangaReading(m: MangaRow): boolean {
  const totali = n(m.volumi);
  const letti = n(m.volumi_letti);
  return totali > 0 && letti > 0 && letti < totali;
}

/** Accorcia un testo ai limiti del contratto (un testo troppo lungo farebbe scartare il feed). */
export function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Solo copertine https e di lunghezza ragionevole. */
export function safeImage(url: string | null): string | null {
  const value = (url ?? '').trim();
  return /^https:\/\/\S+$/.test(value) && value.length <= 500 ? value : null;
}

const MAX_ITEMS = 8;
const MAX_RECENT = 6;

/**
 * Ordina per attività più recente (dal registro), poi per priorità, poi per titolo:
 * così in cima c'è quello che stai davvero seguendo.
 */
function byActivity<T extends { titolo: string; priorita?: boolean | null }>(
  rows: T[],
  lastActivity: Map<string, string>,
): T[] {
  return [...rows].sort((a, b) => {
    const la = lastActivity.get(a.titolo) ?? '';
    const lb = lastActivity.get(b.titolo) ?? '';
    if (la !== lb) return lb.localeCompare(la);
    if (!!a.priorita !== !!b.priorita) return a.priorita ? -1 : 1;
    return a.titolo.localeCompare(b.titolo, 'it');
  });
}

export function buildTrackerFeed(input: {
  appUrl: string;
  anime: AnimeRow[];
  animeWithEpisodes: Set<string>;
  series: SerieRow[];
  seriesWithEpisodes: Set<string>;
  manga: MangaRow[];
  booksToRead: number;
  /** Registro attività dal più recente. */
  logs: LogRow[];
}): TrackerFeedData {
  const lastActivity = new Map<string, string>();
  for (const log of input.logs) {
    if (!lastActivity.has(log.id_titolo)) lastActivity.set(log.id_titolo, log.timestamp);
  }

  const animeWatching = input.anime.filter(
    (a) => animeColor(a, input.animeWithEpisodes.has(a.titolo)) === 'celeste',
  );
  const animeCaughtUp = input.anime.filter(
    (a) => animeColor(a, input.animeWithEpisodes.has(a.titolo)) === 'giallo',
  );
  const seriesWatching = input.series.filter(
    (s) => serieColor(s, input.seriesWithEpisodes.has(s.titolo)) === 'celeste',
  );
  const mangaReadingList = input.manga.filter(mangaReading);

  return {
    app_url: input.appUrl,
    anime: byActivity(animeWatching, lastActivity)
      .slice(0, MAX_ITEMS)
      .map((a) => ({
        title: clip(a.titolo, 200),
        image: safeImage(a.immagine),
        done: n(a.stagioni_viste),
        total: n(a.stagioni_totali),
        unit: 'stagioni' as const,
      })),
    series: byActivity(seriesWatching, lastActivity)
      .slice(0, MAX_ITEMS)
      .map((s) => ({
        title: clip(s.titolo, 200),
        image: safeImage(s.immagine),
        done: n(s.stagioni_viste),
        total: n(s.stagioni_totali),
        unit: 'stagioni' as const,
      })),
    manga: byActivity(mangaReadingList, lastActivity)
      .slice(0, MAX_ITEMS)
      .map((m) => ({
        title: clip(m.titolo, 200),
        image: safeImage(m.immagine),
        done: n(m.volumi_letti),
        total: n(m.volumi),
        unit: 'volumi' as const,
      })),
    counts: {
      anime_watching: animeWatching.length,
      anime_caught_up: animeCaughtUp.length,
      series_watching: seriesWatching.length,
      manga_reading: mangaReadingList.length,
      books_to_read: input.booksToRead,
    },
    recent: input.logs.slice(0, MAX_RECENT).map((l) => ({
      at: l.timestamp,
      media: l.tipo_media,
      event: clip(l.tipo_evento, 30),
      title: clip(l.id_titolo, 200),
      value: l.valore_nuovo === null ? null : clip(String(l.valore_nuovo), 40),
    })),
  };
}
