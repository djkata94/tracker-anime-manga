// NERD.TRACKER service worker: serve SOLO l'installabilità come app
// (icona dedicata, niente barra indirizzi) + cache di immagini e librerie.
// NON mette mai in cache index.html né le API Supabase: app e dati freschi.
const IMG_CACHE = 'nerdtracker-img-v1';
const LIB_CACHE = 'nerdtracker-lib-v1';
const MAX_IMMAGINI = 150;

self.addEventListener('install', function() {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil((async function() {
        const chiavi = await caches.keys();
        await Promise.all(chiavi
            .filter(function(k) { return k !== IMG_CACHE && k !== LIB_CACHE; })
            .map(function(k) { return caches.delete(k); }));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    let url;
    try {
        url = new URL(event.request.url);
    } catch (e) { return; }

    // Locandine TMDB: cache-first con tetto (offline si vedono le già viste)
    if (url.hostname === 'image.tmdb.org') {
        event.respondWith((async function() {
            const cache = await caches.open(IMG_CACHE);
            const trovata = await cache.match(event.request);
            if (trovata) return trovata;
            const risposta = await fetch(event.request);
            if (risposta && risposta.ok) {
                cache.put(event.request, risposta.clone());
                const chiavi = await cache.keys();
                if (chiavi.length > MAX_IMMAGINI) await cache.delete(chiavi[0]);
            }
            return risposta;
        })());
        return;
    }

    // Librerie CDN: prima la cache, intanto aggiorna in sottofondo
    if (url.hostname === 'cdn.jsdelivr.net') {
        event.respondWith((async function() {
            const cache = await caches.open(LIB_CACHE);
            const trovata = await cache.match(event.request);
            const rete = fetch(event.request).then(function(risposta) {
                if (risposta && risposta.ok) cache.put(event.request, risposta.clone());
                return risposta;
            }).catch(function() { return trovata; });
            return trovata || rete;
        })());
        return;
    }

    // Tutto il resto (index.html, Supabase, TMDB via proxy): solo rete, mai cache.
});
