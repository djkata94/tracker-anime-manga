// Test della logica del feed per la Dashboard. Si lanciano con Node 22.6+ (che esegue
// direttamente i file .ts), dalla cartella del tracker:
//   node --test supabase/functions/tracker-feed/build.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  animeColor,
  buildTrackerFeed,
  clip,
  mangaReading,
  safeImage,
  serieColor,
  type AnimeRow,
  type LogRow,
  type MangaRow,
  type SerieRow,
} from './build.ts';

const anime = (o: Partial<AnimeRow>): AnimeRow => ({
  titolo: 'Anime',
  stato: 'In corso',
  stagioni_totali: 3,
  stagioni_viste: 1,
  film_totali: 0,
  film_visti: 0,
  abbandonata: false,
  immagine: 'https://img.example/a.jpg',
  priorita: false,
  ...o,
});
const serie = (o: Partial<SerieRow>): SerieRow => ({
  titolo: 'Serie',
  stato: 'In corso',
  stagioni_totali: 2,
  stagioni_viste: 1,
  abbandonata: false,
  immagine: '',
  priorita: false,
  ...o,
});
const manga = (o: Partial<MangaRow>): MangaRow => ({
  titolo: 'Manga',
  stato: 'In corso',
  volumi: 10,
  volumi_letti: 4,
  immagine: null,
  priorita: false,
  ...o,
});
const log = (o: Partial<LogRow>): LogRow => ({
  timestamp: '2026-11-13T10:00:00Z',
  id_titolo: 'Anime',
  tipo_media: 'ANIME',
  tipo_evento: 'AVANZAMENTO',
  valore_nuovo: '2',
  ...o,
});

describe('colori come nel tracker', () => {
  it('anime: celeste se iniziato e non finito, giallo se in pari ma in uscita', () => {
    assert.equal(animeColor(anime({}), false), 'celeste');
    assert.equal(animeColor(anime({ stagioni_viste: 0 }), false), 'bianco');
    assert.equal(animeColor(anime({ stagioni_viste: 0 }), true), 'celeste'); // episodi visti
    assert.equal(animeColor(anime({ stagioni_viste: 3 }), false), 'giallo');
    assert.equal(animeColor(anime({ stagioni_viste: 3, stato: 'Concluso' }), false), 'verde');
    assert.equal(animeColor(anime({ abbandonata: true }), false), 'rosso');
    assert.equal(animeColor(anime({ stagioni_viste: 3, film_totali: 1 }), false), 'celeste');
  });

  it('serie: stesse regole senza film', () => {
    assert.equal(serieColor(serie({}), false), 'celeste');
    assert.equal(serieColor(serie({ stagioni_viste: 2, stato: 'Concluso' }), false), 'verde');
  });

  it('manga in lettura solo con volumi letti e ancora da leggere', () => {
    assert.equal(mangaReading(manga({})), true);
    assert.equal(mangaReading(manga({ volumi_letti: 0 })), false);
    assert.equal(mangaReading(manga({ volumi_letti: 10 })), false);
    assert.equal(mangaReading(manga({ volumi: 0 })), false);
  });
});

describe('buildTrackerFeed', () => {
  const base = {
    appUrl: 'https://djkata94.github.io/tracker-anime-manga/',
    animeWithEpisodes: new Set<string>(),
    series: [],
    seriesWithEpisodes: new Set<string>(),
    manga: [],
    booksToRead: 4,
    logs: [],
  };

  it('mette in cima quello seguito più di recente e conta le categorie', () => {
    const feed = buildTrackerFeed({
      ...base,
      anime: [
        anime({ titolo: 'Vecchio' }),
        anime({ titolo: 'Recente' }),
        anime({ titolo: 'Prioritario', priorita: true }),
        anime({ titolo: 'In pari', stagioni_viste: 3 }),
        anime({ titolo: 'Finito', stagioni_viste: 3, stato: 'Concluso' }),
      ],
      manga: [manga({ titolo: 'One Piece', volumi: 110, volumi_letti: 105 })],
      logs: [
        log({ id_titolo: 'Recente', timestamp: '2026-11-13T09:00:00Z' }),
        log({ id_titolo: 'Vecchio', timestamp: '2026-10-01T09:00:00Z' }),
      ],
    });
    assert.deepEqual(
      feed.anime.map((a) => a.title),
      ['Recente', 'Vecchio', 'Prioritario'],
    );
    assert.deepEqual(feed.counts, {
      anime_watching: 3,
      anime_caught_up: 1,
      series_watching: 0,
      manga_reading: 1,
      books_to_read: 4,
    });
    assert.deepEqual(feed.manga[0], {
      title: 'One Piece',
      image: null,
      done: 105,
      total: 110,
      unit: 'volumi',
    });
    assert.equal(feed.recent.length, 2);
    assert.equal(feed.recent[0]?.title, 'Recente');
  });

  it('limita gli elenchi e accorcia i testi', () => {
    const molti = Array.from({ length: 12 }, (_, i) => anime({ titolo: `A${i}` }));
    const lungo = 'x'.repeat(300);
    const feed = buildTrackerFeed({
      ...base,
      anime: molti,
      logs: Array.from({ length: 10 }, () => log({ id_titolo: lungo, valore_nuovo: lungo })),
    });
    assert.equal(feed.anime.length, 8);
    assert.equal(feed.counts.anime_watching, 12);
    assert.equal(feed.recent.length, 6);
    assert.equal(feed.recent[0]?.title.length, 200);
    assert.equal(feed.recent[0]?.value?.length, 40);
  });
});

describe('utilità', () => {
  it('accetta solo copertine https', () => {
    assert.equal(safeImage('https://img.example/x.jpg'), 'https://img.example/x.jpg');
    assert.equal(safeImage('http://img.example/x.jpg'), null);
    assert.equal(safeImage('javascript:alert(1)'), null);
    assert.equal(safeImage(''), null);
    assert.equal(safeImage(null), null);
  });

  it('accorcia i testi lunghi', () => {
    assert.equal(clip('breve', 10), 'breve');
    assert.equal(clip('abcdef', 4), 'abc…');
  });
});
