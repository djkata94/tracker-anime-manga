// Lista Globale dei Generi unificata
        const MASTER_GENRES_LIST = [
            "Action", "Adventure", "Avant Garde", "Award Winning", "Boys Love", "Comedy", "Crime", 
            "Cyberpunk", "Dark Fantasy", "Drama", "Ecchi", "Erotica", "Fantasy", 
            "Girls Love", "Gourmet", "Harem", "Historical", "Horror", "Isekai", 
            "Iyashikei", "Josei", "Martial Arts", "Mecha", "Military", "Music", 
            "Mystery", "Mythology", "Parody", "Post-Apocalyptic", "Psychological", 
            "Romance", "Romantic Comedy", "School", "Sci-Fi", "Seinen", "Shoujo", 
            "Shounen", "Slice of Life", "Space", "Sports", "Super Power", 
            "Supernatural", "Suspense", "Thriller", "Vampire", "Workplace"
        ];
		
        // Lista statica dei generi "film" ufficiali di TMDB (stabile da anni,
        // nessun bisogno di interrogare l'API per recuperarla). Nomi in
        // italiano, esattamente come restituiti da TMDB con language=it-IT.
        const TMDB_GENRES_LIST = [
            "Azione", "Avventura", "Animazione", "Commedia", "Crime", "Documentario",
            "Dramma", "Famiglia", "Fantasy", "Storia", "Horror", "Musica", "Mistero",
            "Romantico", "Fantascienza", "Film TV", "Thriller", "Guerra", "Western"
        ];

        // Stessa idea per le serie TV: i 16 generi ufficiali TMDB per il
        // mezzo televisivo, nomi in italiano come restituiti con language=it-IT.
        const TMDB_TV_GENRES_LIST = [
            "Azione e Avventura", "Animazione", "Commedia", "Crime", "Documentario",
            "Dramma", "Famiglia", "Kids", "Mistero", "News", "Reality",
            "Fantascienza e Fantasy", "Soap", "Talk", "Guerra e Politica", "Western"
        ];

        // Generazione automatica dei checkbox nelle modali e nei filtri avanzati fluttuanti all'avvio
        function buildGenresForms() {
            const animeGrid = document.getElementById('animeGenresGrid');
            const mangaGrid = document.getElementById('mangaGenresGrid');
            const libriGrid = document.getElementById('libriGenresGrid');
            const animeFilterDropdown = document.getElementById('dropdownGenresAnime');
            const mangaFilterDropdown = document.getElementById('dropdownGenresManga');
            const libriFilterDropdown = document.getElementById('dropdownGenresLibri');
            const cinemaFilterDropdown = document.getElementById('dropdownGenresCinema');
            const serieTvFilterDropdown = document.getElementById('dropdownGenresSerieTv');
            
            if (animeGrid) {
                animeGrid.innerHTML = MASTER_GENRES_LIST.map(g => 
                    `<label><input type="checkbox" name="anime_genres_cb" value="${g}"> ${g}</label>`
                ).join('');
            }
            if (mangaGrid) {
                mangaGrid.innerHTML = MASTER_GENRES_LIST.map(g =>
                    `<label><input type="checkbox" name="manga_genres_cb" value="${g}"> ${g}</label>`
                ).join('');
            }
            // View Libri (Richiesta 35): stessa lista generi dei manga, sia nel
            // modale (libriGenresGrid) che nel filtro fluttuante.
            if (libriGrid) {
                libriGrid.innerHTML = MASTER_GENRES_LIST.map(g =>
                    `<label><input type="checkbox" name="libri_genres_cb" value="${g}"> ${g}</label>`
                ).join('');
            }
            
            // Genera checkbox fluttuanti per filtri di ricerca
            if (animeFilterDropdown) {
                animeFilterDropdown.innerHTML = MASTER_GENRES_LIST.map(g => 
                    `<label><input type="checkbox" class="anime-filter-genre-cb" value="${g}"> ${g}</label>`
                ).join('');
            }
            if (mangaFilterDropdown) {
                mangaFilterDropdown.innerHTML = MASTER_GENRES_LIST.map(g =>
                    `<label><input type="checkbox" class="manga-filter-genre-cb" value="${g}"> ${g}</label>`
                ).join('');
            }
            if (libriFilterDropdown) {
                libriFilterDropdown.innerHTML = MASTER_GENRES_LIST.map(g =>
                    `<label><input type="checkbox" class="libri-filter-genre-cb" value="${g}"> ${g}</label>`
                ).join('');
            }
            if (cinemaFilterDropdown) {
                cinemaFilterDropdown.innerHTML = TMDB_GENRES_LIST.map(g =>
                    `<label><input type="checkbox" class="cinema-filter-genre-cb" value="${g}"> ${g}</label>`
                ).join('');
            }
            if (serieTvFilterDropdown) {
                serieTvFilterDropdown.innerHTML = TMDB_TV_GENRES_LIST.map(g =>
                    `<label><input type="checkbox" class="serietv-filter-genre-cb" value="${g}"> ${g}</label>`
                ).join('');
            }
        }
        buildGenresForms();

        // Stati globali memorizzati
        let animeList = [];
        let mangaList = [];
        let libriList = []; // View Libri (Richiesta 35): righe della tabella libri
        let episodiAnimeList = []; // NUOVO: righe di episodiAnime per TUTTI i titoli (stagioni/film)

        // NUOVO: true se il titolo ha almeno un episodio segnato come visto, anche se nessuna
        // stagione/film risulta ancora completato per intero (usato per il colore "In Visione")
        function haProgressoEpisodiParziale(titolo) {
            const titoloTrim = (titolo || '').trim();
            return episodiAnimeList.some(e => (e.titolo || '').trim() === titoloTrim && (parseInt(e.episodiVisti) || 0) > 0);
        }
        
        let currentFilterStatoAnime = 'all'; 
        let currentFilterVisioneAnime = 'all'; 
        let currentSearchAnime = '';
        let selectedGenresAnime = []; // Array dei generi attivi nel filtro avanzato
        
        let currentFilterTipologiaManga = 'all';
        let currentFilterStatoManga = 'all'; 
        let currentFilterAcquistatoManga = 'all'; 
        let currentFilterLetturaManga = 'all'; 
        let currentSearchManga = '';
        let selectedGenresManga = []; // Array dei generi attivi nel filtro avanzato

        // View Libri (Richiesta 35): filtri dedicati, stesso schema dei manga
        let currentSearchLibri = '';
        let currentSearchSagaLibri = '';
        let currentFilterStatoLibri = 'all';
        let selectedGenresLibri = [];
        let currentFavFilterLibri = 'all';

        let selectedGenresCinema = []; // Array dei generi TMDB attivi nel filtro avanzato Cinema

        let targetEditTitleAnime = null;
        let targetEditTitleManga = null;
        let targetEditTitleLibri = null;

        // Gestione apertura/chiusura delle finestre fluttuanti generi al click sul rispettivo tasto
        document.getElementById('btnToggleGenresAnime').onclick = function(e) {
            e.stopPropagation();
            document.getElementById('dropdownGenresManga').classList.remove('active');
            document.getElementById('dropdownGenresAnime').classList.toggle('active');
        };
        document.getElementById('btnToggleGenresManga').onclick = function(e) {
            e.stopPropagation();
            document.getElementById('dropdownGenresAnime').classList.remove('active');
            const dropLibriManga = document.getElementById('dropdownGenresLibri');
            if (dropLibriManga) dropLibriManga.classList.remove('active');
            document.getElementById('dropdownGenresManga').classList.toggle('active');
        };
        // View Libri (Richiesta 35): apre/chiude il filtro generi chiudendo gli altri
        const btnToggleGenresLibriEl = document.getElementById('btnToggleGenresLibri');
        if (btnToggleGenresLibriEl) {
            btnToggleGenresLibriEl.onclick = function(e) {
                e.stopPropagation();
                document.getElementById('dropdownGenresAnime').classList.remove('active');
                document.getElementById('dropdownGenresManga').classList.remove('active');
                document.getElementById('dropdownGenresLibri').classList.toggle('active');
            };
        }
        const btnToggleGenresCinemaEl = document.getElementById('btnToggleGenresCinema');
        if (btnToggleGenresCinemaEl) {
            btnToggleGenresCinemaEl.onclick = function(e) {
                e.stopPropagation();
                document.getElementById('dropdownGenresCinema').classList.toggle('active');
            };
        }
        // Chiusura automatica dei popup cliccando all'esterno delle finestre fluttuanti
        window.addEventListener('click', function(e) {
            const dropAnime = document.getElementById('dropdownGenresAnime');
            const dropManga = document.getElementById('dropdownGenresManga');
            const dropLibri = document.getElementById('dropdownGenresLibri');
            const dropCinema = document.getElementById('dropdownGenresCinema');
            const dropSerieTv = document.getElementById('dropdownGenresSerieTv');
            if (dropAnime && !dropAnime.contains(e.target) && e.target.id !== 'btnToggleGenresAnime') {
                dropAnime.classList.remove('active');
            }
            if (dropManga && !dropManga.contains(e.target) && e.target.id !== 'btnToggleGenresManga') {
                dropManga.classList.remove('active');
            }
            if (dropLibri && !dropLibri.contains(e.target) && e.target.id !== 'btnToggleGenresLibri') {
                dropLibri.classList.remove('active');
            }
            if (dropCinema && !dropCinema.contains(e.target) && e.target.id !== 'btnToggleGenresCinema') {
                dropCinema.classList.remove('active');
            }
            if (dropSerieTv && !dropSerieTv.contains(e.target) && e.target.id !== 'btnToggleGenresSerieTv') {
                dropSerieTv.classList.remove('active');
            }
        });

        // Intercettamento modifiche sui checkbox fluttuanti
        document.getElementById('dropdownGenresAnime').addEventListener('change', function() {
            selectedGenresAnime = Array.from(document.querySelectorAll('.anime-filter-genre-cb:checked')).map(cb => cb.value);
            document.getElementById('badgeGenresAnimeCount').innerText = selectedGenresAnime.length;
            renderListAnime();
        });
        document.getElementById('dropdownGenresManga').addEventListener('change', function() {
            selectedGenresManga = Array.from(document.querySelectorAll('.manga-filter-genre-cb:checked')).map(cb => cb.value);
            document.getElementById('badgeGenresMangaCount').innerText = selectedGenresManga.length;
            renderListManga();
        });
        // View Libri (Richiesta 35): filtro generi con logica AND come i manga
        const dropdownGenresLibriEl = document.getElementById('dropdownGenresLibri');
        if (dropdownGenresLibriEl) {
            dropdownGenresLibriEl.addEventListener('change', function() {
                selectedGenresLibri = Array.from(document.querySelectorAll('.libri-filter-genre-cb:checked')).map(cb => cb.value);
                document.getElementById('badgeGenresLibriCount').innerText = selectedGenresLibri.length;
                renderListLibri();
            });
        }
        const dropdownGenresCinemaEl = document.getElementById('dropdownGenresCinema');
        if (dropdownGenresCinemaEl) {
            dropdownGenresCinemaEl.addEventListener('change', function() {
                selectedGenresCinema = Array.from(document.querySelectorAll('.cinema-filter-genre-cb:checked')).map(cb => cb.value);
                document.getElementById('badgeGenresCinemaCount').innerText = selectedGenresCinema.length;
                renderListCinema();
            });
        }

        // SPA View Switcher Modificato per accendere i bottoni corretti in navbar

