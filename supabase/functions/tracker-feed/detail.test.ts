// Test della scheda di un'opera per la Dashboard. Dalla cartella del tracker:
//   node --test supabase/functions/tracker-feed/detail.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildItemDetail, DETAIL_KINDS, KIND_SOURCE } from './detail.ts';

const APP = 'https://djkata94.github.io/tracker-anime-manga/';
const log = (timestamp: string, tipo_evento: string, valore_nuovo: string | null = null) => ({
  timestamp,
  tipo_evento,
  valore_nuovo,
});

describe('scheda di un’opera per la Dashboard', () => {
  it('anime: stato di visione, stagioni, episodi, note, AniList e attività', () => {
    const d = buildItemDetail({
      kind: 'anime',
      row: {
        titolo: 'Frieren',
        stato: 'In corso',
        note: 'Da rivedere con calma',
        valutazione: 9.5,
        stagioni_totali: 2,
        stagioni_viste: 1,
        film_totali: 0,
        film_visti: 0,
        generi: 'Fantasy, Adventure , ',
        preferito: true,
        immagine: 'https://img.example/f.jpg',
        priorita: false,
        abbandonata: false,
        anilist_id: 154587,
      },
      episodes: [
        { tipo: 'Stagione', numero: 2, episodi_totali: 12, episodi_visti: 3 },
        { tipo: 'Stagione', numero: 1, episodi_totali: 28, episodi_visti: 28 },
      ],
      logs: [log('2026-11-18T20:00:00Z', 'AVANZAMENTO', '2')],
      appUrl: APP,
    });
    assert.equal(d.status, 'In visione');
    assert.equal(d.release_status, 'In corso');
    assert.equal(d.rating, 9.5);
    assert.equal(d.favorite, true);
    assert.deepEqual(d.genres, ['Fantasy', 'Adventure']);
    assert.deepEqual(d.progress, [{ label: 'Stagioni', done: 1, total: 2 }]);
    assert.deepEqual(d.episodes, [
      { label: 'Stagione 1', done: 28, total: 28 },
      { label: 'Stagione 2', done: 3, total: 12 },
    ]);
    assert.equal(d.notes, 'Da rivedere con calma');
    assert.deepEqual(d.links, [{ label: 'AniList', url: 'https://anilist.co/anime/154587' }]);
    assert.deepEqual(d.activity, [{ at: '2026-11-18T20:00:00Z', event: 'AVANZAMENTO', value: '2' }]);
  });

  it('serie TV: piattaforme per nome e link TMDB', () => {
    const d = buildItemDetail({
      kind: 'serie',
      row: {
        titolo: 'Dark',
        tmdb_id: 70523,
        stato: 'Concluso',
        stagioni_totali: 3,
        stagioni_viste: 3,
        piattaforme: [{ nome: 'Netflix', logo: 'https://image.tmdb.org/x.png' }],
        immagine: 'javascript:alert(1)',
      },
      episodes: [{ numero: 1, anno: 2017, episodi_totali: 10, episodi_visti: 10 }],
      logs: [],
      appUrl: APP,
    });
    assert.equal(d.status, 'Completato');
    assert.equal(d.image, null);
    assert.deepEqual(d.platforms, ['Netflix']);
    assert.deepEqual(d.episodes, [{ label: 'Stagione 1 (2017)', done: 10, total: 10 }]);
    assert.deepEqual(d.links, [{ label: 'TMDB', url: 'https://www.themoviedb.org/tv/70523' }]);
  });

  it('manga: volumi, tipo e acquisto', () => {
    const d = buildItemDetail({
      kind: 'manga',
      row: { titolo: 'One Piece', tipologia: 'Manga', volumi: 110, volumi_letti: 105, acquistato: true },
      episodes: [],
      logs: [],
      appUrl: APP,
    });
    assert.equal(d.status, 'In lettura');
    assert.deepEqual(d.progress, [{ label: 'Volumi', done: 105, total: 110 }]);
    assert.deepEqual(d.facts, [
      { label: 'Tipo', value: 'Manga' },
      { label: 'Acquistato', value: 'sì' },
    ]);
    assert.deepEqual(d.episodes, []);
  });

  it('film: visto, date in formato italiano e trama', () => {
    const d = buildItemDetail({
      kind: 'film',
      row: {
        titolo: 'Dune',
        visione: true,
        data_uscita: '2021-09-16',
        data_visione: '2021-10-02',
        trama: 'Paul Atreides...',
        tmdb_id: 438631,
      },
      episodes: [],
      logs: [],
      appUrl: APP,
    });
    assert.equal(d.status, 'Visto');
    assert.deepEqual(d.facts, [
      { label: 'Uscita', value: '16/09/2021' },
      { label: 'Visto il', value: '02/10/2021' },
    ]);
    assert.equal(d.plot, 'Paul Atreides...');
    assert.equal(d.links[0]?.url, 'https://www.themoviedb.org/movie/438631');
  });

  it('libro: autore, anno e saga', () => {
    const d = buildItemDetail({
      kind: 'libro',
      row: { titolo: 'Il nome del vento', stato: 'Letto', autore: 'Patrick Rothfuss', anno_pubblicazione: 2007, saga_nome: 'Kingkiller', saga_numero: 1 },
      episodes: [],
      logs: [],
      appUrl: APP,
    });
    assert.equal(d.status, 'Letto');
    assert.deepEqual(d.facts, [
      { label: 'Autore', value: 'Patrick Rothfuss' },
      { label: 'Anno', value: '2007' },
      { label: 'Saga', value: 'Kingkiller #1' },
    ]);
  });

  it('ogni tipo ha tabella e tipo_media del registro', () => {
    for (const k of DETAIL_KINDS) assert.ok(KIND_SOURCE[k].table && KIND_SOURCE[k].media);
  });
});
