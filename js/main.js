

        // ==========================================
        //   ðŸ”” TOAST DI CONFERMA (feedback azioni CRUD)
        // ==========================================
        function showToast(message, type) {
            const container = document.getElementById('toastContainer');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = 'toast toast-' + (type === 'error' ? 'error' : 'success');
            const icon = type === 'error' ? 'âš ï¸' : 'âœ…';
            toast.innerHTML = '<span>' + icon + '</span><span></span>';
            toast.querySelector('span:last-child').textContent = message;
            container.appendChild(toast);
            setTimeout(function() {
                toast.classList.add('toast-hide');
                setTimeout(function() { toast.remove(); }, 250);
            }, 3000);
        }

        // ==========================================
        //   â†º RESET FILTRI (Anime / Manga)
        // ==========================================
        function resetFiltriAnime() {
            currentSearchAnime = '';
            currentFilterStatoAnime = 'all';
            currentFilterVisioneAnime = 'all';
            currentFavFilterAnime = 'all';
            selectedGenresAnime = [];

            document.getElementById('searchInpAnime').value = '';
            document.getElementById('numFilterAnimeVotoMin').value = '';
            document.getElementById('numFilterAnimeStagioniEsatte').value = '';
            document.getElementById('sortSelAnime').value = 'title-asc';

            ['filterGroupStatoAnime', 'filterGroupVisioneAnime', 'filterGroupPreferitiAnime'].forEach(function(groupId) {
                const group = document.getElementById(groupId);
                if (!group) return;
                group.querySelectorAll('.filter-btn').forEach(function(btn) { btn.classList.remove('active'); });
                const first = group.querySelector('.filter-btn');
                if (first) first.classList.add('active');
            });

            document.querySelectorAll('.anime-filter-genre-cb:checked').forEach(function(cb) { cb.checked = false; });
            const badgeAnime = document.getElementById('badgeGenresAnimeCount');
            if (badgeAnime) badgeAnime.innerText = '0';

            renderListAnime();
            showToast('Filtri Anime azzerati', 'success');
        }

        function resetFiltriManga() {
            currentSearchManga = '';
            currentFilterTipologiaManga = 'all';
            currentFilterStatoManga = 'all';
            currentFilterAcquistatoManga = 'all';
            currentFilterLetturaManga = 'all';
            currentFavFilterManga = 'all';
            selectedGenresManga = [];

            document.getElementById('searchInpManga').value = '';
            document.getElementById('numFilterMangaVolumiMin').value = '';
            document.getElementById('numFilterMangaVolumiMax').value = '';
            document.getElementById('sortSelManga').value = 'title-asc';

            ['filterGroupTipologiaManga', 'filterGroupStatoManga', 'filterGroupAcquistatoManga', 'filterGroupLetturaManga', 'filterGroupPreferitiManga'].forEach(function(groupId) {
                const group = document.getElementById(groupId);
                if (!group) return;
                group.querySelectorAll('.filter-btn').forEach(function(btn) { btn.classList.remove('active'); });
                const first = group.querySelector('.filter-btn');
                if (first) first.classList.add('active');
            });

            document.querySelectorAll('.manga-filter-genre-cb:checked').forEach(function(cb) { cb.checked = false; });
            const badgeManga = document.getElementById('badgeGenresMangaCount');
            if (badgeManga) badgeManga.innerText = '0';

            renderListManga();
            showToast('Filtri Manga azzerati', 'success');
        }

        // Listener Real-Time per input e bottoni categoria
        document.getElementById('searchInpAnime').oninput = function(e) { currentSearchAnime = e.target.value; renderListAnime(); };
        document.getElementById('sortSelAnime').onchange = renderListAnime;
        document.getElementById('numFilterAnimeVotoMin').oninput = renderListAnime;
        document.getElementById('numFilterAnimeStagioniEsatte').oninput = renderListAnime;
        document.getElementById('btnResetFiltriAnime').onclick = resetFiltriAnime;

        document.getElementById('searchInpManga').oninput = function(e) { currentSearchManga = e.target.value; renderListManga(); };
        document.getElementById('sortSelManga').onchange = renderListManga;
        document.getElementById('numFilterMangaVolumiMin').oninput = renderListManga;
        document.getElementById('numFilterMangaVolumiMax').oninput = renderListManga;
        document.getElementById('btnResetFiltriManga').onclick = resetFiltriManga;

        document.querySelectorAll('#filterGroupStatoAnime .filter-btn').forEach(btn => {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupStatoAnime .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFilterStatoAnime = e.target.getAttribute('data-status');
                renderListAnime();
            };
        });
        document.querySelectorAll('#filterGroupVisioneAnime .filter-btn').forEach(btn => {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupVisioneAnime .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFilterVisioneAnime = e.target.getAttribute('data-vision');
                renderListAnime();
            };
        });

        document.querySelectorAll('#filterGroupTipologiaManga .filter-btn').forEach(btn => {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupTipologiaManga .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFilterTipologiaManga = e.target.getAttribute('data-type');
                renderListManga();
            };
        });
        document.querySelectorAll('#filterGroupStatoManga .filter-btn').forEach(btn => {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupStatoManga .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFilterStatoManga = e.target.getAttribute('data-status');
                renderListManga();
            };
        });

        document.querySelectorAll('#filterGroupAcquistatoManga .filter-btn').forEach(btn => {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupAcquistatoManga .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFilterAcquistatoManga = e.target.getAttribute('data-buy');
                renderListManga();
            };
        });
        document.querySelectorAll('#filterGroupLetturaManga .filter-btn').forEach(btn => {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupLetturaManga .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFilterLetturaManga = e.target.getAttribute('data-read');
                renderListManga();
            };
        });
		
// --- SISTEMAZIONE DEFINITIVA PULSANTE TORNA IN ALTO ---

// 1. Rileva lo scorrimento globale della finestra del browser
window.addEventListener('scroll', function() {
    const btn = document.getElementById("backToTop");
    if (btn) {
        // Rileva lo scorrimento reale della pagina
        const altezzaScroll = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
        
        // Se l'utente scende di oltre 250 pixel, fa apparire il bottone, altrimenti lo nasconde
        if (altezzaScroll > 250) {
            btn.style.display = "block";
        } else {
            btn.style.display = "none";
        }
    }
}, true);

// 2. Cattura l'azione di click ovunque avvenga (Delegation)
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'backToTop') {
        e.preventDefault();

        // Scroll diretto della finestra: la vecchia versione puntava con
        // scrollIntoView alla navbar, ma essendo sticky (sempre visibile)
        // la chiamata era un no-op e la pagina non si muoveva mai.
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
});

		// Stato globale del filtro preferiti (inizialmente su 'all')
let currentFavFilterManga = 'all';
let currentFavFilterAnime = 'all';

// Gestore eventi per i pulsanti del filtro preferiti (da agganciare al caricamento della pagina)
document.addEventListener("DOMContentLoaded", function() {
    const favButtons = document.querySelectorAll("#filterGroupPreferitiManga .filter-btn");
    favButtons.forEach(btn => {
        btn.addEventListener("click", function() {
            favButtons.forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentFavFilterManga = this.getAttribute("data-fav");
            renderListManga(); // Riesegue il rendering applicando i filtri
        });
    });
	
	// Gestore eventi per i pulsanti del filtro preferiti Anime
    const favButtonsAnime = document.querySelectorAll("#filterGroupPreferitiAnime .filter-btn");
    favButtonsAnime.forEach(btn => {
        btn.addEventListener("click", function() {
            favButtonsAnime.forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentFavFilterAnime = this.getAttribute("data-fav");
            renderListAnime(); // Riesegue il rendering applicando i filtri per gli Anime
        });
    });
});

// === NUOVA FUNZIONE: Incremento/Decremento dei Volumi Letti (pulsantini - / + in riga) ===
function modificaVolumiLettiManga(titolo, delta) {
    const item = mangaList.find(x => x.titolo === titolo);
    if (!item) return;

    const volumiTotali = parseInt(item.volumi) || 0;
    let volumiLetti = (parseInt(item.volumiLetti) || 0) + delta;

    // Il valore non puÃ² mai essere negativo nÃ© superare il totale dei volumi dell'opera
    if (volumiLetti < 0) volumiLetti = 0;
    if (volumiTotali > 0 && volumiLetti > volumiTotali) volumiLetti = volumiTotali;
    if (volumiTotali === 0) volumiLetti = 0; // Nessun volume registrato: niente da incrementare

    // Aggiornamento locale istantaneo (interfaccia reattiva)
    item.volumiLetti = volumiLetti;

    // Calcola lo stato di lettura: bianco (da leggere) / giallo (in lettura) / verde (letto)
    // - giallo: ha letto una parte dei volumi posseduti (0 < letti < totali)
    // - giallo: ha letto tutti i volumi posseduti ma l'opera Ã¨ ancora "In corso"
    // - verde: ha letto tutti i volumi posseduti e l'opera NON Ã¨ piÃ¹ "In corso"
    const statoOperaNorm = String(item.stato || 'In corso').trim().toLowerCase();
    if (volumiTotali <= 0 || volumiLetti <= 0) {
        item.coloreLettura = 'bianco';
    } else if (volumiLetti < volumiTotali) {
        item.coloreLettura = 'giallo';
    } else {
        item.coloreLettura = (statoOperaNorm === 'in corso') ? 'giallo' : 'verde';
    }

    // Ridisegna la tabella e ricalcola i contatori in tempo reale
    renderListManga();

    // NUOVO: se l'overlay dei volumi (widget "In Corso" della Home) Ã¨ aperto
    // per questo stesso titolo, aggiorna anche il suo contenuto in tempo reale
    if (typeof volumiOverlayTitoloCorrente !== 'undefined' && volumiOverlayTitoloCorrente &&
        volumiOverlayTitoloCorrente.trim() === titolo.trim()) {
        renderVolumiOverlay();
    }

    // NUOVO: se il widget "In Corso" della Home Ã¨ presente, ridisegnalo per
    // riflettere subito il nuovo stato (l'opera potrebbe uscire/entrare dalla
    // categoria "in lettura" a seconda del nuovo colore calcolato)
    if (document.getElementById('homeProgressList')) {
        renderWidgetInCorso();
    }

    updateMangaVolumiLettiSB_(titolo, volumiLetti)
        .then(function(res) {
            console.log("Volumi Letti aggiornati su Supabase per: " + titolo);
        })
        .catch(function(err) {
            console.error("Errore aggiornamento volumi letti: ", err);
            alert("âŒ Errore di sincronizzazione dei volumi letti. Ricarica la pagina.");
        });
}

// ==========================================================
// ðŸ“– OVERLAY "Avanzamento Volumi Letti" â€” richiamato dalle card
// manga del widget "In Corso" nella Home.
// ==========================================================
let volumiOverlayTitoloCorrente = null;

// ----------------------------------------------------------
// ðŸ–¼ï¸ Copertina mostrata di fianco all'elenco negli overlay di avanzamento
// aperti dal widget "In Corso" della Home (stagioni per gli anime, volumi
// per i manga). Rispetto alla card del widget qui l'immagine non viene
// ritagliata: si vede intera, in formato ridotto. Cliccandola si apre il
// lightbox a schermo intero, come per gli avatar nelle rispettive viste.
// Restituisce true se la copertina Ã¨ stata effettivamente disegnata, cosÃ¬
// chi chiama sa se allargare l'overlay o lasciarlo della misura di sempre.
// ----------------------------------------------------------
window.renderCopertinaOverlay = function(idContenitore, item) {
    const box = document.getElementById(idContenitore);
    if (!box) return false;

    const url = (item && item.immagine) ? String(item.immagine).trim() : '';
    if (url === '') {
        // Senza immagine non occupiamo spazio: l'elenco resta a tutta larghezza
        nascondiCopertinaOverlay(idContenitore);
        return false;
    }

    const safeImgUrl = url.replace(/'/g, "\\'");
    box.style.display = 'block';
    box.innerHTML = `<img class="overlay-copertina-img" src="${safeImgUrl}" alt="Copertina" title="Clicca per ingrandire" onclick="apriLightbox('${safeImgUrl}')" onerror="this.parentNode.style.display='none';">`;
    return true;
};

window.nascondiCopertinaOverlay = function(idContenitore) {
    const box = document.getElementById(idContenitore);
    if (!box) return;
    box.style.display = 'none';
    box.innerHTML = '';
};

window.apriAvanzamentoVolumiManga = function(titolo) {
    volumiOverlayTitoloCorrente = titolo;
    const titleEl = document.getElementById('volumiMangaModalTitle');
    if (titleEl) titleEl.innerText = 'ðŸ“– Volumi Letti â€” ' + titolo;
    // La copertina si disegna una volta sola all'apertura: renderVolumiOverlay()
    // viene richiamata a ogni +/- e ricaricare l'immagine la farebbe lampeggiare.
    const item = (mangaList || []).find(x => (x.titolo || '').trim() === String(titolo).trim());
    const conCopertina = renderCopertinaOverlay('volumiMangaCopertina', item);
    // Senza copertina l'overlay torna stretto come prima
    const modaleEl = document.querySelector('#modalOverlayVolumiManga .modal');
    if (modaleEl) modaleEl.style.maxWidth = conCopertina ? '520px' : '380px';
    renderVolumiOverlay();
    document.getElementById('modalOverlayVolumiManga').classList.add('active');
};

window.chiudiModaleVolumiManga = function() {
    document.getElementById('modalOverlayVolumiManga').classList.remove('active');
    volumiOverlayTitoloCorrente = null;
};

function renderVolumiOverlay() {
    const container = document.getElementById('volumiMangaContainer');
    if (!container || !volumiOverlayTitoloCorrente) return;

    const item = (mangaList || []).find(x => (x.titolo || '').trim() === volumiOverlayTitoloCorrente.trim());
    if (!item) {
        container.innerHTML = `<p style="color:var(--text-muted); padding: 10px 0; text-align:center;">Opera non trovata. Prova a ricaricare la pagina.</p>`;
        return;
    }

    const safeTitle = volumiOverlayTitoloCorrente.replace(/'/g, "\\'").replace(/"/g, '\\"');
    const totali = parseInt(item.volumi) || 0;
    const letti = parseInt(item.volumiLetti) || 0;
    const completa = totali > 0 && letti >= totali;
    const percentuale = totali > 0 ? Math.min(100, Math.round((letti / totali) * 100)) : 0;
    const disabledMeno = letti <= 0 ? 'disabled' : '';
    const disabledPiu = (totali <= 0 || letti >= totali) ? 'disabled' : '';

    container.innerHTML = `
        <div class="episodi-row">
            <div class="episodi-row-info">
                <div class="episodi-row-title">ðŸ“– Volumi letti ${completa ? 'âœ…' : ''}</div>
                <div class="episodi-row-count">${letti} / ${totali} volumi</div>
                <div class="episodi-progress-outer"><div class="episodi-progress-inner" style="width:${percentuale}%;"></div></div>
            </div>
            <div class="episodi-row-actions">
                <button class="episodi-btn" ${disabledMeno} onclick="modificaVolumiLettiManga('${safeTitle}', -1)">âˆ’</button>
                <button class="episodi-btn" ${disabledPiu} onclick="modificaVolumiLettiManga('${safeTitle}', 1)">+</button>
            </div>
        </div>
    `;
}

// Funzione interattiva per accendere/spegnere la stellina e salvare su Excel
function toggleFavoriteManga(titolo, btn) {
    // Inverte lo stato locale attuale
    let isFav = btn.classList.contains("is-favorite");
    let nuovoStato = !isFav;
    
    // Aggiornamento grafico istantaneo (interfaccia reattiva)
    if (nuovoStato) {
        btn.classList.add("is-favorite");
        btn.innerHTML = "â˜…";
    } else {
        btn.classList.remove("is-favorite");
        btn.innerHTML = "â˜†";
    }
    
    // Aggiorna anche l'array dei dati locale per non perdere lo stato durante altre ricerche/filtri
    let mangaLocale = mangaList.find(x => x.titolo === titolo); // cambia mangaList con il nome della tua variabile globale dei manga
    if (mangaLocale) mangaLocale.preferito = nuovoStato;
    
    // Se il filtro dei preferiti Ã¨ attivo e togliamo la stella, aggiorna la lista per nascondere la riga
    if (currentFavFilterManga === 'yes' && !nuovoStato) {
        renderListManga();
    }

    toggleMangaPreferitoSB_(titolo, nuovoStato)
        .then(function() {
             console.log("Preferito aggiornato su Supabase per: " + titolo);
        })
        .catch(function(err) {
             console.error("Errore aggiornamento preferito: ", err);
        });
}

// === NUOVA FUNZIONE: flagga l'acquisto di un manga direttamente dalla lista (senza modale) ===
// PuÃ² solo ACCENDERE il flag. Se Ã¨ giÃ  acquistato non fa nulla: lo spegnimento resta
// possibile solo dalla modale di modifica.
function flagAcquistoManga(titolo, btn) {
    const item = mangaList.find(x => x.titolo === titolo);
    if (!item || item.acquistato === 'SÃ¬') return;

    // Aggiornamento grafico istantaneo (interfaccia reattiva)
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'â³';
    }

    flagMangaAcquistatoSB_(titolo)
        .then(function(res) {
            item.acquistato = 'SÃ¬';
            renderListManga();
            showToast('ðŸ›’ ' + titolo + ' segnato come acquistato', 'success');
        })
        .catch(function(err) {
            console.error("Errore aggiornamento acquistato: ", err);
            alert("âŒ Errore durante l'aggiornamento dello stato di acquisto.");
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'âŒ No';
            }
        });
}

// === NUOVA FUNZIONE: inserisce il voto di un anime direttamente dalla lista (senza modale) ===
// Funziona solo per l'INSERIMENTO di un voto non ancora presente. La modifica o la
// cancellazione di un voto giÃ  assegnato resta possibile solo dalla modale di modifica.
function impostaVotoAnimeLista(titolo, inputEl) {
    if (!inputEl) return;
    const valoreGrezzo = inputEl.value;

    if (valoreGrezzo === null || valoreGrezzo === undefined || String(valoreGrezzo).trim() === '') {
        alert("âš ï¸ Inserisci un voto da 0 a 10 prima di confermare.");
        return;
    }

    const votoNumerico = parseFloat(String(valoreGrezzo).replace(',', '.'));
    if (isNaN(votoNumerico) || votoNumerico < 0 || votoNumerico > 10) {
        alert("âš ï¸ Il voto deve essere un numero tra 0 e 10.");
        return;
    }

    inputEl.disabled = true;

        impostaVotoAnimeSB_(titolo, votoNumerico)
        .then(function(res) {
            if (res && res.errore) {
                alert("âŒ " + res.errore);
                renderListAnime();
                return;
            }
            const item = animeList.find(x => x.titolo === titolo);
            if (item) item.valutazione = (res && res.valutazione !== undefined) ? res.valutazione : votoNumerico;
            renderListAnime();
            showToast('â­ Voto assegnato a ' + titolo, 'success');
        })
        .catch(function(err) {
            console.error("Errore assegnazione voto anime: ", err);
            alert("âŒ Errore durante il salvataggio del voto.");
            inputEl.disabled = false;
        });
}

function toggleFavoriteAnime(titolo, btn) {
    // Inverte lo stato locale attuale
    let isFav = btn.classList.contains("is-favorite");
    let nuovoStato = !isFav;
    
    // Aggiornamento grafico istantaneo (interfaccia reattiva)
    if (nuovoStato) {
        btn.classList.add("is-favorite");
        btn.innerHTML = "â˜…";
    } else {
        btn.classList.remove("is-favorite");
        btn.innerHTML = "â˜†";
    }
    
    // Aggiorna anche l'array dei dati locale per non perdere lo stato durante altre ricerche/filtri
    let animeLocale = animeList.find(x => x.titolo === titolo);
    if (animeLocale) animeLocale.preferito = nuovoStato;
    
    // Se il filtro dei preferiti Ã¨ attivo e togliamo la stella, aggiorna la lista per nascondere la riga
    if (typeof currentFavFilterAnime !== 'undefined' && currentFavFilterAnime === 'yes' && !nuovoStato) {
        renderListAnime();
    }

    toggleAnimePreferitoSB_(titolo, nuovoStato)
        .then(function() {
             console.log("Preferito aggiornato su Supabase per Anime: " + titolo);
        })
        .catch(function(err) {
             console.error("Errore aggiornamento preferito Anime: ", err);
        });
}

// â›” Toggle abbandono dal pulsante riga (stesso schema Serie TV): congela
// (rosso, fuori dal widget) o riprende. Solo la colonna + log, mai il progresso.
function toggleAbbandonataAnime(titolo) {
    const item = animeList.find(x => x.titolo === titolo);
    if (!item) return;
    if (item.coloreVisione === 'verde') {
        showToast('âŒ Anime completato: non ha senso abbandonarlo.', 'error');
        return;
    }
    const nuovoStato = !item.abbandonata;
    const msg = nuovoStato
        ? 'Segno "' + titolo + '" come abbandonato: uscirÃ  dal widget "In Corso", il flag visione diventerÃ  rosso e il progresso resterÃ  congelato. Potrai riprenderlo quando vuoi.\n\nProcedo?'
        : 'Riprendo "' + titolo + '"? TornerÃ  nel widget "In Corso" se in visione.';
    if (!confirm(msg)) return;
    toggleAnimeAbbandonataSB_(titolo, nuovoStato)
        .then(function() {
            return registraLogSB_(titolo, 'ANIME', nuovoStato ? 'ABBANDONO' : 'RIPRESA',
                nuovoStato ? 'In visione' : 'Abbandonato', nuovoStato ? 'Abbandonato' : 'In visione');
        })
        .then(function() { return getAnimeDataSB_(); })
        .then(function(data) {
            animeList = data || [];
            renderListAnime();
            showToast(nuovoStato ? 'â›” Anime abbandonato' : 'Anime ripreso', 'success');
        }).catch(function(err) {
            console.error('Errore toggle abbandonato anime:', err);
            showToast('âŒ Errore aggiornamento: ' + err.message, 'error');
        });
}

// ==========================================================
// ðŸ“Œ NUOVO: Gestione della PRIORITÃ€ (pin) per Anime e Manga
// Le opere pinnate vengono mostrate in cima alla lista (in ordine
// alfabetico), seguite da tutte le altre (sempre in ordine alfabetico
// all'interno del criterio di ordinamento scelto).
// ==========================================================
function togglePinAnime(titolo, btn, event) {
    if (event) event.stopPropagation(); // Il pin non deve attivare altri click sulla riga

    // Inverte lo stato locale attuale
    let isPin = btn.classList.contains("is-priority");
    let nuovoStato = !isPin;

    // Aggiorna l'array dei dati locale per non perdere lo stato durante altre ricerche/filtri
    let animeLocale = animeList.find(x => x.titolo === titolo);
    if (animeLocale) animeLocale.priorita = nuovoStato;

    // Ridisegna subito la tabella: l'opera pinnata deve saltare in cima all'ordinamento
    renderListAnime();

    toggleAnimePrioritaSB_(titolo, nuovoStato)
        .then(function() {
             console.log("PrioritÃ  aggiornata su Supabase per Anime: " + titolo);
        })
        .catch(function(err) {
             console.error("Errore aggiornamento prioritÃ  Anime: ", err);
        });
}

function togglePinManga(titolo, btn, event) {
    if (event) event.stopPropagation(); // Il pin non deve attivare altri click sulla riga

    // Inverte lo stato locale attuale
    let isPin = btn.classList.contains("is-priority");
    let nuovoStato = !isPin;

    // Aggiorna l'array dei dati locale per non perdere lo stato durante altre ricerche/filtri
    let mangaLocale = mangaList.find(x => x.titolo === titolo);
    if (mangaLocale) mangaLocale.priorita = nuovoStato;

    // Ridisegna subito la tabella: l'opera pinnata deve saltare in cima all'ordinamento
    renderListManga();

    toggleMangaPrioritaSB_(titolo, nuovoStato)
        .then(function() {
             console.log("PrioritÃ  aggiornata su Supabase per Manga: " + titolo);
        })
        .catch(function(err) {
             console.error("Errore aggiornamento prioritÃ  Manga: ", err);
        });
}

// ==========================================
//   FASE 11 â€” GRUPPO SINOSSI (Supabase diretto)
// ==========================================

async function getSinossiSB_(titolo, tipo) {
    const tabella = (tipo === 'anime') ? 'sinossi_anime' : ((tipo === 'serietv') ? 'sinossi_serie_tv' : ((tipo === 'libri') ? 'sinossi_libri' : 'sinossi_manga'));
    const colonnaTitolo = (tipo === 'anime') ? 'anime_titolo' : ((tipo === 'serietv') ? 'serie_titolo' : ((tipo === 'libri') ? 'libro_titolo' : 'manga_titolo'));
    const messaggioErrore = "Nessuna informazione su questa opera!";

    const { data, error } = await supabaseClient.from(tabella).select('sinossi').eq(colonnaTitolo, String(titolo).trim());
    if (error) throw error;
    if (!data || data.length === 0) return messaggioErrore;

    const sinossi = String(data[0].sinossi || '').trim();
    return sinossi ? sinossi : messaggioErrore;
}

async function impostaSinossiSB_(titolo, tipo, testo) {
    const tabella = (tipo === 'anime') ? 'sinossi_anime' : ((tipo === 'serietv') ? 'sinossi_serie_tv' : ((tipo === 'libri') ? 'sinossi_libri' : 'sinossi_manga'));
    const colonnaTitolo = (tipo === 'anime') ? 'anime_titolo' : ((tipo === 'serietv') ? 'serie_titolo' : ((tipo === 'libri') ? 'libro_titolo' : 'manga_titolo'));
    const titoloTrim = String(titolo).trim();

    const { data, error: errSel } = await supabaseClient.from(tabella).select(colonnaTitolo).eq(colonnaTitolo, titoloTrim);
    if (errSel) throw errSel;

    if (data && data.length > 0) {
        const { error: errUpd } = await supabaseClient.from(tabella).update({ sinossi: testo || '' }).eq(colonnaTitolo, titoloTrim);
        if (errUpd) throw errUpd;
    } else {
        const nuovaRiga = {};
        nuovaRiga[colonnaTitolo] = titoloTrim;
        nuovaRiga.sinossi = testo || '';
        const { error: errIns } = await supabaseClient.from(tabella).insert([nuovaRiga]);
        if (errIns) throw errIns;
    }
    return true;
}
		
// === NUOVE FUNZIONI DI GESTIONE OVERLAY PER LE SINOSSI ===
function mostraSinossi(titolo, tipo) {
    let overlay = document.getElementById('sinossiOverlay');
    
    // Se l'overlay non esiste nell'interfaccia, lo creiamo dinamicamente in linea con il tema
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sinossiOverlay';
        overlay.style = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(5, 5, 7, 0.85);
            backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000; opacity: 0; transition: opacity 0.25s ease;
            pointer-events: none;
        `;
        
        const content = document.createElement('div');
        content.id = 'sinossiContent';
        content.style = `
            background: var(--surface-solid, #14162a);
            border: 1px solid var(--border-color, #262a42);
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3);
            position: relative;
            transform: scale(0.9);
            transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        `;
        
        content.innerHTML = `
            <button id="closeSinossiBtn" style="position: absolute; top: 14px; right: 16px; background: none; border: none; color: var(--text-muted, #8890ab); font-size: 20px; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'">âœ•</button>
            <h3 id="sinossiTitle" style="margin-top: 0; margin-bottom: 16px; color: var(--text, #f2f3fa); font-size: 18px; font-weight: 600; padding-right: 24px; border-bottom: 1px solid var(--border-color, #262a42); padding-bottom: 10px;"></h3>
            <div id="sinossiBody" style="color: var(--text, #f2f3fa); font-size: 14px; line-height: 1.6; max-height: 250px; overflow-y: auto; white-space: pre-line; padding-right: 5px;"></div>
        `;
        
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        
        // Collega eventi per chiudere l'overlay
        document.getElementById('closeSinossiBtn').onclick = chiudiSinossi;
        overlay.onclick = function(e) { if (e.target === overlay) chiudiSinossi(); };
    }
    
    // Configurazione testi iniziali (caricamento asincrono)
    document.getElementById('sinossiTitle').innerText = titolo;
    const colorLoading = (tipo === 'anime' || tipo === 'serietv') ? 'var(--primary, #7c6cff)' : 'var(--accent, #ff5da2)';
    document.getElementById('sinossiBody').innerHTML = `<span style="color: ${colorLoading}; font-weight: 600; display: inline-block; animation: pulse 1.5s infinite;">â³ Recupero della sinossi...</span>`;
    
    // Mostra l'overlay grafico
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    document.getElementById('sinossiContent').style.transform = 'scale(1)';
    
    getSinossiSB_(titolo, tipo)
        .then(function(testoSinossi) {
            document.getElementById('sinossiBody').innerText = testoSinossi;
        })
        .catch(function(err) {
            console.error("Errore nel recupero della sinossi:", err);
            document.getElementById('sinossiBody').innerText = "Errore di connessione durante il recupero dei dati.";
        });
}

function chiudiSinossi() {
    const overlay = document.getElementById('sinossiOverlay');
    const content = document.getElementById('sinossiContent');
    if (overlay && content) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        content.style.transform = 'scale(0.9)';
    }
}

// ============================================================================
// ðŸ”Ž NUOVO: INTEGRAZIONE ANILIST â€” Overlay di ricerca sinossi (tradotta) + copertina
//
// Flusso a 3 fasi mostrate nello stesso overlay dinamico:
//   1) 'loading'    -> spinner mentre si contatta AniList
//   2) 'candidati'  -> griglia con gli 8 risultati trovati per il titolo digitato
//   3) 'dettaglio'  -> anteprima di copertina + sinossi tradotta (editabile) del
//                      candidato scelto, con pulsante di conferma
//
// La conferma NON scrive subito sul foglio: memorizza i dati scelti in variabili
// di sessione del modale (immagine -> subito nel campo del form; sinossi -> in
// sinossiPendenteAnime/Manga) che vengono scritte davvero solo al "Salva" finale
// del modale, per garantire che la riga nel foglio satellite Sinossi esista giÃ .
// ============================================================================

let sinossiPendenteAnime = null;
let sinossiPendenteManga = null;
let sinossiPendenteLibri = null; // View Libri (Richiesta 35): trama Hardcover in sospeso
let ultimoDettaglioHardcover = null; // dettaglio volume GB in anteprima nel picker
let ultimoDettaglioAniList = null; // { immagine, sinossi } del candidato attualmente in anteprima
let episodiPerStagionePendenteAnime = null; // { 1: episodi, 2: episodi, ... } da "Cerca stagioni/film collegati"

function creaOverlayAniListSeAssente_() {
    let overlay = document.getElementById('anilistOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'anilistOverlay';
    overlay.style = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(5, 5, 7, 0.85);
        backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 10001; opacity: 0; transition: opacity 0.25s ease;
        pointer-events: none;
    `;

    const content = document.createElement('div');
    content.id = 'anilistContent';
    content.style = `
        background: var(--surface-solid, #14162a);
        border: 1px solid var(--border-color, #262a42);
        border-radius: 12px;
        padding: 24px;
        max-width: 620px;
        width: 92%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3);
        position: relative;
        transform: scale(0.9);
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    content.innerHTML = `
        <button id="closeAnilistBtn" style="position: absolute; top: 14px; right: 16px; background: none; border: none; color: var(--text-muted, #8890ab); font-size: 20px; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'">âœ•</button>
        <h3 id="anilistTitle" style="margin-top: 0; margin-bottom: 16px; color: var(--text, #f2f3fa); font-size: 18px; font-weight: 600; padding-right: 24px; border-bottom: 1px solid var(--border-color, #262a42); padding-bottom: 10px;">ðŸ”Ž Ricerca AniList</h3>
        <div id="anilistBody" style="color: var(--text, #f2f3fa); font-size: 14px; line-height: 1.6;"></div>
    `;

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    document.getElementById('closeAnilistBtn').onclick = chiudiOverlayAniList;
    overlay.onclick = function(e) { if (e.target === overlay) chiudiOverlayAniList(); };

    return overlay;
}

function mostraOverlayAniList_() {
    const overlay = creaOverlayAniListSeAssente_();
    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    document.getElementById('anilistContent').style.transform = 'scale(1)';
}

// ==========================================
//   FASE 11/13 â€” GRUPPO ANILIST (chiamata diretta dal browser)
//   L'API pubblica di AniList supporta CORS per query pubbliche: nessuna
//   chiave necessaria, nessuna Edge Function necessaria per questo gruppo.
// ==========================================

async function eseguireRichiestaAniList_(gqlQuery, variables) {
    let response;
    try {
        response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: gqlQuery, variables: variables })
        });
    } catch (networkErr) {
        console.error('AniList - errore di rete: ' + networkErr);
        throw new Error('Rete: impossibile raggiungere AniList (' + networkErr.message + '). Controlla la connessione o riprova tra qualche minuto.');
    }

    const statusCode = response.status;
    const bodyText = await response.text();

    if (statusCode !== 200) {
        console.error('AniList - HTTP ' + statusCode + ': ' + bodyText.substring(0, 500));
        let motivo;
        if (statusCode === 429) motivo = 'troppe richieste in poco tempo (rate limit di AniList). Riprova tra qualche minuto.';
        else if (statusCode === 502 || statusCode === 503 || statusCode === 504) motivo = 'AniList Ã¨ temporaneamente non disponibile (probabile manutenzione o sovraccarico dei loro server).';
        else if (statusCode >= 500) motivo = 'errore interno del server AniList.';
        else if (statusCode === 400) motivo = 'richiesta non valida (query malformata).';
        else motivo = 'risposta HTTP inattesa.';
        throw new Error('AniList non disponibile [HTTP ' + statusCode + ']: ' + motivo);
    }

    let json;
    try {
        json = JSON.parse(bodyText);
    } catch (parseErr) {
        console.error('AniList - risposta non JSON: ' + bodyText.substring(0, 500));
        throw new Error('AniList ha restituito una risposta non valida (JSON malformato). Riprova tra poco.');
    }

    if (json.errors && json.errors.length > 0) {
        const msg = json.errors.map(function(e) { return e.message; }).join('; ');
        console.error('AniList - errore GraphQL: ' + msg);
        throw new Error('AniList ha segnalato un errore nella richiesta: ' + msg);
    }

    return json;
}

async function cercaCandidatiAniListSB_(query, tipoMedia) {
    const gqlQuery = `
        query ($search: String, $type: MediaType) {
            Page(page: 1, perPage: 8) {
                media(search: $search, type: $type, sort: SEARCH_MATCH) {
                    id
                    title { romaji english }
                    startDate { year }
                    coverImage { medium }
                }
            }
        }
    `;

    const json = await eseguireRichiestaAniList_(gqlQuery, { search: query, type: tipoMedia });

    if (!json.data || !json.data.Page || !json.data.Page.media) {
        console.error('AniList - struttura risposta inattesa: ' + JSON.stringify(json).substring(0, 500));
        throw new Error('AniList ha restituito una struttura dati inattesa. Riprova tra poco.');
    }

    return json.data.Page.media.map(function(m) {
        return {
            id: m.id,
            titolo: (m.title && (m.title.english || m.title.romaji)) || 'Senza titolo',
            titoloAlt: m.title ? m.title.romaji : '',
            anno: (m.startDate && m.startDate.year) ? m.startDate.year : '',
            immagine: (m.coverImage && m.coverImage.medium) ? m.coverImage.medium : ''
        };
    });
}

// Traduzione tramite l'endpoint pubblico gratuito di Google Translate (non
// ufficiale, nessuna chiave richiesta). Se non risponde per qualsiasi
// motivo, si torna al testo originale in inglese invece di bloccare il
// flusso: meglio una sinossi in inglese che nessuna sinossi.
async function tradurreTestoGoogleFree_(testo, sourceLang, targetLang) {
    if (!testo) return testo;
    try {
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + sourceLang + '&tl=' + targetLang + '&dt=t&q=' + encodeURIComponent(testo);
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const json = await resp.json();
        if (!json || !json[0]) return testo;
        return json[0].map(function(segmento) { return segmento[0]; }).join('');
    } catch (err) {
        console.error('Errore durante la traduzione: ' + err);
        return testo;
    }
}

async function getDettaglioTraduzioneAniListSB_(id) {
    const gqlQuery = `
        query ($id: Int) {
            Media(id: $id) {
                id
                title { romaji english }
                description(asHtml: false)
                coverImage { extraLarge large }
                genres
                tags { name }
                format
                episodes
                seasonYear
                volumes
                status
            }
        }
    `;

    const json = await eseguireRichiestaAniList_(gqlQuery, { id: parseInt(id) });

    try {
        if (!json.data || !json.data.Media) throw new Error('Opera non trovata su AniList (ID non valido o rimosso dal catalogo).');

        const media = json.data.Media;
        const immagine = (media.coverImage && (media.coverImage.extraLarge || media.coverImage.large)) || '';

        let descrizione = media.description || '';
        descrizione = descrizione
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<i>[\s\S]*?<\/i>/gi, '')
            .replace(/<\/?[^>]+(>|$)/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const sinossiTradotta = descrizione ? await tradurreTestoGoogleFree_(descrizione, 'en', 'it') : descrizione;

        return {
            id: media.id,
            titolo: (media.title && (media.title.english || media.title.romaji)) || '',
            sinossi: sinossiTradotta || 'Nessuna sinossi disponibile per questa opera.',
            immagine: immagine,
            generiSuggeriti: (media.genres || []).concat((media.tags || []).map(function(t) { return t.name; })),
            formato: media.format || '',
            episodi: media.episodes || 0,
            volumi: (media.volumes === null || media.volumes === undefined) ? null : media.volumes,
            statoAniList: media.status || '',
            anno: media.seasonYear || ''
        };
    } catch (err) {
        console.error('Errore dettaglio AniList: ' + err);
        throw err;
    }
}

// ==========================================
//   Stagioni/film collegati (grafo relazioni AniList)
// ==========================================

async function getRelazioniAniList_(id) {
    const gqlQuery = `
        query ($id: Int) {
            Media(id: $id) {
                id
                relations {
                    edges {
                        relationType(version: 2)
                        node {
                            id
                            format
                            episodes
                            seasonYear
                            title { romaji english }
                            coverImage { medium }
                        }
                    }
                }
            }
        }
    `;
    const json = await eseguireRichiestaAniList_(gqlQuery, { id: parseInt(id) });
    if (!json.data || !json.data.Media || !json.data.Media.relations) return [];
    return json.data.Media.relations.edges || [];
}

// Parte dal titolo scelto e segue a catena i legami PREQUEL/SEQUEL (in
// entrambe le direzioni) per ricostruire tutta la sequenza di stagioni TV;
// per ogni stagione trovata guarda anche i suoi SIDE_STORY/ALTERNATIVE di
// formato MOVIE come candidati film. Scarta sempre i SUMMARY (ricap).
async function costruisciGrafoStagioniAniList_(nodoIniziale) {
    const MAX_NODI = 20; // tetto di sicurezza contro cicli/grafi anomali
    const stagioniTv = new Map();
    const filmCandidati = new Map();
    const visitati = new Set();
    const daVisitare = [nodoIniziale.id];

    // Il titolo di partenza Ã¨ SEMPRE incluso nel risultato, anche quando non
    // ha alcuna relazione (opera monostagione): finisce tra le stagioni se Ã¨
    // una serie, tra i film se il formato AniList Ã¨ MOVIE. In entrambi i casi
    // Ã¨ marcato "preselezionato" perchÃ© Ã¨ il titolo che hai scelto tu.
    const formatoIniziale = String(nodoIniziale.formato || '').toUpperCase();
    if (formatoIniziale === 'MOVIE') {
        filmCandidati.set(nodoIniziale.id, {
            id: nodoIniziale.id, titolo: nodoIniziale.titolo, anno: nodoIniziale.anno,
            immagine: nodoIniziale.immagine, preselezionato: true
        });
    } else {
        stagioniTv.set(nodoIniziale.id, {
            id: nodoIniziale.id, titolo: nodoIniziale.titolo, anno: nodoIniziale.anno,
            episodi: nodoIniziale.episodi, immagine: nodoIniziale.immagine, preselezionato: true
        });
    }

    while (daVisitare.length > 0 && visitati.size < MAX_NODI) {
        const idCorrente = daVisitare.shift();
        if (visitati.has(idCorrente)) continue;
        visitati.add(idCorrente);

        let edges;
        try {
            edges = await getRelazioniAniList_(idCorrente);
        } catch (err) {
            console.error('Errore relazioni AniList per id ' + idCorrente + ': ' + err);
            continue;
        }

        edges.forEach(function(edge) {
            const tipo = edge.relationType;
            const nodo = edge.node;
            if (!nodo || tipo === 'SUMMARY') return; // scarta i ricap/riassunti

            const titoloNodo = (nodo.title && (nodo.title.english || nodo.title.romaji)) || 'Senza titolo';
            const immagineNodo = (nodo.coverImage && nodo.coverImage.medium) || '';

            if ((tipo === 'PREQUEL' || tipo === 'SEQUEL') && nodo.format === 'TV') {
                if (!stagioniTv.has(nodo.id)) {
                    stagioniTv.set(nodo.id, {
                        id: nodo.id, titolo: titoloNodo, anno: nodo.seasonYear || '',
                        episodi: nodo.episodes || 0, immagine: immagineNodo
                    });
                    daVisitare.push(nodo.id);
                }
            } else if ((tipo === 'SIDE_STORY' || tipo === 'ALTERNATIVE') && nodo.format === 'MOVIE') {
                if (!filmCandidati.has(nodo.id)) {
                    filmCandidati.set(nodo.id, {
                        id: nodo.id, titolo: titoloNodo, anno: nodo.seasonYear || '', immagine: immagineNodo
                    });
                }
            }
        });
    }

    const stagioniOrdinate = Array.from(stagioniTv.values()).sort(function(a, b) {
        const annoA = parseInt(a.anno) || 9999;
        const annoB = parseInt(b.anno) || 9999;
        if (annoA !== annoB) return annoA - annoB;
        return a.id - b.id;
    });

    return { stagioni: stagioniOrdinate, film: Array.from(filmCandidati.values()) };
}
		
function chiudiOverlayAniList() {
    const overlay = document.getElementById('anilistOverlay');
    const content = document.getElementById('anilistContent');
    if (overlay && content) {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        content.style.transform = 'scale(0.9)';
    }
    ultimoDettaglioAniList = null;
}

function apriRicercaAniList(tipo) {
    const inputId = tipo === 'anime' ? 'inpTitoloAnime' : 'inpTitoloManga';
    const titolo = document.getElementById(inputId).value.trim();
    if (!titolo) {
        alert('Inserisci prima un titolo da cercare.');
        return;
    }

    mostraOverlayAniList_();
    document.getElementById('anilistTitle').innerText = 'ðŸ”Ž Ricerca AniList: "' + titolo + '"';
    const colorLoading = tipo === 'anime' ? 'var(--primary, #7c6cff)' : 'var(--accent, #ff5da2)';
    document.getElementById('anilistBody').innerHTML =
        `<span style="color: ${colorLoading}; font-weight: 600; display: inline-block; animation: pulse 1.5s infinite;">â³ Ricerca dei candidati in corso...</span>`;

    cercaCandidatiAniListSB_(titolo, tipo === 'anime' ? 'ANIME' : 'MANGA')
        .then(function(candidati) { renderCandidatiAniList_(tipo, candidati); })
        .catch(function(err) { renderErroreAniList_(err); });
}

function renderCandidatiAniList_(tipo, candidati) {
    document.getElementById('anilistTitle').innerText = 'ðŸ”Ž Scegli l\'opera corretta';
    const body = document.getElementById('anilistBody');

    if (!candidati || candidati.length === 0) {
        body.innerHTML = `<p style="color: var(--text-muted);">Nessun risultato trovato su AniList per questo titolo. Puoi comunque procedere inserendo sinossi e copertina manualmente.</p>`;
        return;
    }

    body.innerHTML = '';
    const grid = document.createElement('div');
    grid.style = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap:10px;';

    candidati.forEach(function(c) {
        const card = document.createElement('div');
        card.style = `
            cursor: pointer; border: 1px solid var(--border-color, #262a42); border-radius: 8px;
            overflow: hidden; background: rgba(255,255,255,0.03); transition: transform 0.15s, border-color 0.15s;
        `;
        card.onmouseover = function() { card.style.transform = 'translateY(-2px)'; card.style.borderColor = 'var(--primary, #7c6cff)'; };
        card.onmouseout = function() { card.style.transform = 'translateY(0)'; card.style.borderColor = 'var(--border-color, #262a42)'; };

        const img = document.createElement('img');
        img.src = c.immagine || '';
        img.style = 'width:100%; height:150px; object-fit:cover; display:block; background:#222;';

        const label = document.createElement('div');
        label.style = 'padding:6px; font-size:11px; line-height:1.3; color: var(--text, #f2f3fa);';
        label.innerText = c.titolo + (c.anno ? ' (' + c.anno + ')' : '');

        card.appendChild(img);
        card.appendChild(label);
        card.onclick = function() { selezionaCandidatoAniList_(tipo, c.id, c.titolo); };
        grid.appendChild(card);
    });

    body.appendChild(grid);
}

function selezionaCandidatoAniList_(tipo, id, titoloCandidato) {
    document.getElementById('anilistTitle').innerText = 'ðŸ”Ž ' + titoloCandidato;
    const colorLoading = tipo === 'anime' ? 'var(--primary, #7c6cff)' : 'var(--accent, #ff5da2)';
    document.getElementById('anilistBody').innerHTML =
        `<span style="color: ${colorLoading}; font-weight: 600; display: inline-block; animation: pulse 1.5s infinite;">â³ Recupero sinossi e traduzione in corso...</span>`;

	    getDettaglioTraduzioneAniListSB_(id)
        .then(function(dettaglio) { renderDettaglioAniList_(tipo, dettaglio); })
        .catch(function(err) { renderErroreAniList_(err); });
}

function renderDettaglioAniList_(tipo, dettaglio) {
    ultimoDettaglioAniList = dettaglio;
    const body = document.getElementById('anilistBody');
    body.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style = 'display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;';

    const imgCol = document.createElement('img');
    imgCol.src = dettaglio.immagine || '';
    imgCol.style = 'width:140px; border-radius:8px; flex-shrink:0; background:#222;';

    const textCol = document.createElement('div');
    textCol.style = 'flex:1; min-width:220px;';
    textCol.innerHTML = `
        <label style="display:block; margin-bottom:6px; font-weight:600; color: var(--text-muted, #8890ab); font-size:12px;">
            Titolo completo (modificabile â€” verrÃ  riportato nel campo Titolo della scheda)
        </label>
        <input type="text" id="anilistTitoloInput" style="width:100%; background: rgba(255,255,255,0.04); border:1px solid var(--border-color, #262a42); border-radius:8px; color: var(--text, #f2f3fa); padding:8px; font-size:13px; margin-bottom:12px;">
        <label style="display:block; margin-bottom:6px; font-weight:600; color: var(--text-muted, #8890ab); font-size:12px;">
            Sinossi tradotta (modificabile prima di confermare)
        </label>
        <textarea id="anilistSinossiTextarea" rows="8" style="width:100%; background: rgba(255,255,255,0.04); border:1px solid var(--border-color, #262a42); border-radius:8px; color: var(--text, #f2f3fa); padding:8px; font-size:13px; line-height:1.5; resize:vertical;"></textarea>
    `;

    wrapper.appendChild(imgCol);
    wrapper.appendChild(textCol);
    body.appendChild(wrapper);

    document.getElementById('anilistTitoloInput').value = dettaglio.titolo || '';
    document.getElementById('anilistSinossiTextarea').value = dettaglio.sinossi || '';

    // Volumi manga in anteprima: mostra subito il numero che verrÃ  importato
    // (solo se il campo scheda Ã¨ vuoto/zero, altrimenti resta il tuo).
    // Stessa cosa per lo stato editoriale (riferito al Giappone): anteprima
    // e importazione solo lato manga, per gli anime resta manuale.
    if (tipo === 'manga') {
        const volumiNoti = (dettaglio.volumi !== null && dettaglio.volumi !== undefined);
        const mappaStatoManga = {
            'RELEASING': 'In corso',
            'FINISHED': 'Concluso',
            'NOT_YET_RELEASED': 'In arrivo',
            'CANCELLED': 'Concluso',
            'HIATUS': 'In corso'
        };
        const statoMappato = mappaStatoManga[dettaglio.statoAniList] || '';
        const volInfo = document.createElement('div');
        volInfo.style = 'margin-top:12px; font-size:13px; color: var(--text, #f2f3fa);';
        volInfo.innerHTML = (volumiNoti
            ? `ðŸ“š Volumi totali su AniList: <b>${dettaglio.volumi}</b> (importati solo se il campo scheda Ã¨ vuoto)`
            : `ðŸ“š AniList non indica i volumi di questa opera: inseriscili a mano nella scheda.`)
            + (statoMappato
                ? `<div style="margin-top:6px;">ðŸ“° Stato in Giappone: <b>${statoMappato}</b> (verrÃ  impostato, modificabile dopo)</div>`
                : `<div style="margin-top:6px;">ðŸ“° Stato non indicato su AniList: lascio il tuo.</div>`);
        body.appendChild(volInfo);
    }

    // === Generi/tag rilevati: confronto testuale (case-insensitive) tra ciÃ² che AniList
    // restituisce (genres + tags) e la tua lista predefinita MASTER_GENRES_LIST. Solo le
    // corrispondenze vengono mostrate, pre-selezionate, e deselezionabili una per una. ===
    const suggeriti = dettaglio.generiSuggeriti || [];
    const suggeritiLower = suggeriti.map(function(g) { return String(g).trim().toLowerCase(); });
    const generiCorrispondenti = MASTER_GENRES_LIST.filter(function(g) {
        return suggeritiLower.indexOf(g.toLowerCase()) !== -1;
    });

    const genreSection = document.createElement('div');
    genreSection.style = 'margin-top:16px;';
    if (generiCorrispondenti.length > 0) {
        genreSection.innerHTML = `
            <label style="display:block; margin-bottom:6px; font-weight:600; color: var(--text-muted, #8890ab); font-size:12px;">
                Generi rilevati (deseleziona quelli che non vuoi importare â€” verranno aggiunti a quelli giÃ  selezionati, senza toglierne nessuno)
            </label>
            <div id="anilistGenresPicker" class="genres-grid-container">
                ${generiCorrispondenti.map(function(g) {
                    return `<label><input type="checkbox" class="anilist_genre_cb" value="${g}" checked> ${g}</label>`;
                }).join('')}
            </div>
        `;
    } else {
        genreSection.innerHTML = `<p style="color: var(--text-muted); font-size:12px; margin-top:0;">Nessun genere della tua lista corrisponde a quelli restituiti da AniList per questa opera.</p>`;
    }
    body.appendChild(genreSection);

    if (tipo === 'anime') {
        const relSection = document.createElement('div');
        relSection.id = 'anilistRelazioniSection';
        relSection.style = 'margin-top:16px; border-top:1px solid var(--border-color, #262a42); padding-top:14px;';
        relSection.innerHTML = `
            <button type="button" class="btn btn-nav" id="anilistCercaRelazioniBtn" style="border:1px solid var(--border-color, #262a42);">
                ðŸ”— Cerca stagioni/film collegati
            </button>
            <div id="anilistRelazioniRisultato" style="margin-top:12px;"></div>
        `;
        body.appendChild(relSection);
        document.getElementById('anilistCercaRelazioniBtn').onclick = function() { avviaRicercaRelazioniAniList_(dettaglio); };
    }

    const footer = document.createElement('div');
    footer.style = 'display:flex; justify-content:flex-end; gap:8px; margin-top:16px; border-top:1px solid var(--border-color, #262a42); padding-top:14px;';
    footer.innerHTML = `
        <button type="button" class="btn btn-danger" id="anilistAnnullaBtn">Annulla</button>
        <button type="button" class="btn ${tipo === 'anime' ? 'btn-anime' : 'btn-manga'}" id="anilistConfermaBtn">âœ… Usa questi dati</button>
    `;
    body.appendChild(footer);

    document.getElementById('anilistAnnullaBtn').onclick = chiudiOverlayAniList;
    document.getElementById('anilistConfermaBtn').onclick = function() { confermaDatiAniList_(tipo); };
}

function applicaDatiPrincipaliAniList_(tipo) {
    if (!ultimoDettaglioAniList) return false;

    const titoloInput = document.getElementById('anilistTitoloInput');
    const titoloFinale = titoloInput ? titoloInput.value.trim() : ultimoDettaglioAniList.titolo;
    const testareaSinossi = document.getElementById('anilistSinossiTextarea');
    const sinossiFinale = testareaSinossi ? testareaSinossi.value : ultimoDettaglioAniList.sinossi;
    const immagineFinale = ultimoDettaglioAniList.immagine;

    const titoloInputId = tipo === 'anime' ? 'inpTitoloAnime' : 'inpTitoloManga';
    const imgInputId = tipo === 'anime' ? 'inpImmagineAnime' : 'inpImmagineManga';
    if (titoloFinale) document.getElementById(titoloInputId).value = titoloFinale;
    document.getElementById(imgInputId).value = immagineFinale || '';

    // Volumi manga da AniList: rispetta il numero giÃ  scritto a mano, lo
    // riempie solo se il campo Ã¨ vuoto/zero e AniList lo conosce davvero.
    if (tipo === 'manga') {
        const volumiAniList = (ultimoDettaglioAniList.volumi === null || ultimoDettaglioAniList.volumi === undefined)
            ? null : (parseInt(ultimoDettaglioAniList.volumi) || 0);
        const inpVolumi = document.getElementById('inpVolumiManga');
        const volumiAttuali = parseInt(inpVolumi.value) || 0;
        if (volumiAniList === null) {
            showToast('AniList non conosce i volumi di questa opera: inseriscili a mano.', 'error');
        } else if (volumiAttuali <= 0) {
            inpVolumi.value = volumiAniList;
            showToast('Volumi importati da AniList: ' + volumiAniList, 'success');
        } else {
            showToast('Tengo i tuoi volumi (' + volumiAttuali + '), AniList ne indica ' + volumiAniList + '.', 'success');
        }

        // Stato editoriale dal Giappone: imposta il menu, resta modificabile.
        const mappaStatoManga = {
            'RELEASING': 'In corso',
            'FINISHED': 'Concluso',
            'NOT_YET_RELEASED': 'In arrivo',
            'CANCELLED': 'Concluso',
            'HIATUS': 'In corso'
        };
        const statoMappato = mappaStatoManga[ultimoDettaglioAniList.statoAniList] || '';
        if (statoMappato) {
            document.getElementById('inpStatoManga').value = statoMappato;
            showToast('Stato editoriale (Giappone): ' + statoMappato, 'success');
        }
    }

    if (tipo === 'anime') sinossiPendenteAnime = sinossiFinale;
    else sinossiPendenteManga = sinossiFinale;

    // Applica i generi rilevati e ancora spuntati nel picker alle checkbox reali del form,
    // in modo ADDITIVO: non deseleziona mai un genere giÃ  scelto manualmente in precedenza.
    const genresPicker = document.getElementById('anilistGenresPicker');
    if (genresPicker) {
        const generiDaAggiungere = Array.from(genresPicker.querySelectorAll('.anilist_genre_cb:checked')).map(function(cb) { return cb.value; });
        const cbName = tipo === 'anime' ? 'anime_genres_cb' : 'manga_genres_cb';
        document.querySelectorAll('input[name="' + cbName + '"]').forEach(function(cb) {
            if (generiDaAggiungere.indexOf(cb.value) !== -1) cb.checked = true;
        });
    }
    return true;
}

function confermaDatiAniList_(tipo) {
    if (!applicaDatiPrincipaliAniList_(tipo)) return;
    chiudiOverlayAniList();
    showToast('Titolo, copertina, sinossi e generi applicati: premi "Salva" per confermare definitivamente', 'success');
}

// Avvia la ricostruzione del franchise (stagioni + film collegati) a partire
// dal titolo attualmente in anteprima nell'overlay AniList.
function avviaRicercaRelazioniAniList_(dettaglio) {
    const risultatoEl = document.getElementById('anilistRelazioniRisultato');
    const btn = document.getElementById('anilistCercaRelazioniBtn');
    btn.disabled = true;
    risultatoEl.innerHTML = `<span style="color: var(--primary, #7c6cff); font-size:13px; display:inline-block; animation: pulse 1.5s infinite;">â³ Ricostruzione del franchise in corso (puÃ² richiedere qualche secondo su serie lunghe)...</span>`;

    const nodoIniziale = {
        id: dettaglio.id, titolo: dettaglio.titolo, episodi: dettaglio.episodi,
        anno: dettaglio.anno, immagine: dettaglio.immagine, formato: dettaglio.formato
    };

    costruisciGrafoStagioniAniList_(nodoIniziale)
        .then(function(risultato) { renderRelazioniAniList_(risultato); })
        .catch(function(err) {
            console.error('Errore ricostruzione franchise AniList: ', err);
            risultatoEl.innerHTML = `<p style="color: var(--danger, #ff5d6c); font-size:13px;">âŒ Errore durante il recupero delle relazioni. Riprova.</p>`;
            btn.disabled = false;
        });
}

// Mostra la checklist di conferma: stagioni TV pre-spuntate (relazione
// affidabile), film/side story NON pre-spuntati (relazione piÃ¹ ambigua,
// vanno verificati uno per uno prima di confermare). Il titolo di partenza
// Ã¨ sempre pre-spuntato, anche quando Ã¨ l'unica voce (opera monostagione).
function renderRelazioniAniList_(risultato) {
    const risultatoEl = document.getElementById('anilistRelazioniRisultato');
    const btn = document.getElementById('anilistCercaRelazioniBtn');
    btn.disabled = false;

    // Caso limite: nemmeno il titolo di partenza (non dovrebbe capitare, ma
    // evita di mostrare una checklist vuota con il pulsante di conferma).
    if (risultato.stagioni.length === 0 && risultato.film.length === 0) {
        risultatoEl.innerHTML = `<p style="color: var(--text-muted); font-size:13px;">Nessuna stagione o film collegato trovato su AniList per questa opera.</p>`;
        return;
    }

    function rigaCheckbox(item, gruppo, checkedDiDefault) {
        const sub = (gruppo === 'stagione') ? (item.episodi ? (item.episodi + ' episodi') : 'episodi non noti') : 'film';
        const titoloSicuro = (item.titolo || '').replace(/"/g, '&quot;');
        const checked = (item.preselezionato === true) ? true : checkedDiDefault;
        return `
            <label style="display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;">
                <input type="checkbox" class="anilist-rel-cb" data-gruppo="${gruppo}" data-id="${item.id}" data-episodi="${item.episodi || 0}" ${checked ? 'checked' : ''}>
                <img src="${item.immagine || ''}" style="width:28px; height:40px; object-fit:cover; border-radius:3px; background:#222; flex-shrink:0;">
                <span style="flex:1;">${titoloSicuro}${item.anno ? ' (' + item.anno + ')' : ''}</span>
                <span style="color: var(--text-muted); font-size:11px;">${sub}</span>
            </label>
        `;
    }

    let html = '';

    // Nota esplicativa quando il franchise Ã¨ composto dalla sola opera scelta:
    // prima qui si usciva con "nessun risultato" e non c'era modo di importare
    // stagione ed episodi dei titoli monostagione.
    if (risultato.stagioni.length + risultato.film.length === 1) {
        html += `<p style="color: var(--text-muted); font-size:12px; margin:0 0 8px;">Nessuna stagione aggiuntiva o film collegato trovato su AniList: l'opera risulta a stagione unica. Puoi comunque applicarla qui sotto per importare stagione e numero di episodi.</p>`;
    }

    if (risultato.stagioni.length > 0) {
        html += `<div style="font-weight:600; font-size:12px; color: var(--text-muted, #8890ab); margin-bottom:6px;">ðŸ“º Stagioni TV trovate (${risultato.stagioni.length})</div>`;
        html += risultato.stagioni.map(function(s) { return rigaCheckbox(s, 'stagione', true); }).join('');
    }
    if (risultato.film.length > 0) {
        html += `<div style="font-weight:600; font-size:12px; color: var(--text-muted, #8890ab); margin:12px 0 6px;">ðŸŽ¬ Film/side story collegati â€” verifica prima di confermare (potrebbero includere ricap)</div>`;
        html += risultato.film.map(function(f) { return rigaCheckbox(f, 'film', false); }).join('');
    }
    html += `<button type="button" class="btn btn-anime" id="anilistApplicaRelazioniBtn" style="margin-top:14px; width:100%;">âœ… Applica stagioni e film spuntati</button>`;

    risultatoEl.innerHTML = html;
    document.getElementById('anilistApplicaRelazioniBtn').onclick = applicaRelazioniAniList_;
}

// Scrive direttamente nei campi "Stagioni Totali"/"Film Totali" della scheda
// Anime (giÃ  aperta dietro l'overlay AniList) e prepara la mappa
// numero-stagione -> episodi, usata da addAnimeSB_/updateAnimeSB_ per
// creare le righe di episodi_anime giÃ  con il totale corretto.
function applicaRelazioniAniList_() {
    const spuntati = Array.from(document.querySelectorAll('.anilist-rel-cb:checked'));
    const stagioniSpuntate = spuntati.filter(function(cb) { return cb.getAttribute('data-gruppo') === 'stagione'; });
    const filmSpuntati = spuntati.filter(function(cb) { return cb.getAttribute('data-gruppo') === 'film'; });

    document.getElementById('inpStagioniTotaliAnime').value = stagioniSpuntate.length;
    document.getElementById('inpFilmTotaliAnime').value = filmSpuntati.length;

    episodiPerStagionePendenteAnime = {};
    stagioniSpuntate.forEach(function(cb, idx) {
        episodiPerStagionePendenteAnime[idx + 1] = parseInt(cb.getAttribute('data-episodi')) || 0;
    });

    // Applica in un colpo solo anche titolo/sinossi/generi/immagine: non
    // serve piÃ¹ cliccare separatamente "Usa questi dati" dopo.
    applicaDatiPrincipaliAniList_('anime');

    showToast('Applicati titolo, sinossi, generi, ' + stagioniSpuntate.length + ' stagioni e ' + filmSpuntati.length + ' film: ricontrolla e premi "Salva"', 'success');
    chiudiOverlayAniList();
}

function renderErroreAniList_(err) {
    console.error('Errore AniList: ', err);
    document.getElementById('anilistTitle').innerText = 'âš ï¸ Errore AniList';

    // Il messaggio arriva giÃ  "diagnosticato" dal backend (es. rete assente,
    // rate limit HTTP 429, server AniList in manutenzione, risposta
    // malformata, errore GraphQL, ecc.) invece del generico "nessun
    // risultato": lo mostriamo cosÃ¬ com'Ã¨, per capire da cosa dipende senza
    // dover controllare i log di Apps Script.
    const messaggio = (err && err.message) ? err.message : 'Si Ã¨ verificato un errore imprevisto durante la comunicazione con AniList.';
    const ora = new Date().toLocaleTimeString('it-IT');

    document.getElementById('anilistBody').innerHTML =
        `<div style="background: rgba(255,107,107,0.08); border: 1px solid rgba(255,107,107,0.35); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px;">
            <p style="color: #ff6b6b; margin: 0 0 6px 0; font-weight: 600;">${messaggio}</p>
            <p style="color: var(--text-muted); font-size:12px; margin: 0;">Rilevato alle ${ora}</p>
         </div>
         <p style="color: var(--text-muted); font-size:13px;">Puoi comunque continuare inserendo sinossi e copertina manualmente.</p>`;
}

// ============================================================================
// ðŸ“œ NUOVO: LOG DI SISTEMA â€” Log Storico delle AttivitÃ  (Activity Log)
// ============================================================================
// Recupera le ultime attivitÃ  registrate sul foglio "Tab_Log" tramite la
// funzione backend ottieniUltimiLog() e le mostra nel widget della Home.
function caricaLogAttivita() {
    const loadingEl = document.getElementById('systemLogLoading');
    const listEl = document.getElementById('systemLogList');
    const btnRefresh = document.getElementById('btnRefreshLog');

    if (!listEl) return; // Il widget non Ã¨ presente in questa vista

    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.innerText = 'â³ Sincronizzazione feed in corso...';
    }

    // Feedback visivo sul pulsantino di refresh (icona rotante) mentre la
    // richiesta Ã¨ in corso, sia che sia partita dal pulsante stesso, sia
    // dal cambio di un filtro, sia dal caricamento automatico iniziale.
    if (btnRefresh) {
        btnRefresh.classList.add('spinning');
        btnRefresh.disabled = true;
    }

    // Legge i valori correnti dei filtri (Tipo, Azione, Titolo) e
    // dell'ordinamento. Se i controlli non sono presenti nel DOM, si ricade
    // sul comportamento "nessun filtro" / ordinamento di default.
    const selTipo = document.getElementById('filterLogTipo');
    const selEvento = document.getElementById('filterLogEvento');
    const inputTitolo = document.getElementById('filterLogTitolo');
    const btnOrdine = document.getElementById('btnToggleLogOrdine');
    const filtroTipo = selTipo ? selTipo.value : 'all';
    const filtroEvento = selEvento ? selEvento.value : 'all';
    const filtroTitolo = inputTitolo ? inputTitolo.value.trim() : '';
    const ordineAsc = btnOrdine ? (btnOrdine.getAttribute('data-asc') === 'true') : false;

    const filtriAttivi = (filtroTipo !== 'all' || filtroEvento !== 'all' || filtroTitolo !== '');

    ottieniUltimiLogSB_(filtroTipo, filtroEvento, filtroTitolo, ordineAsc)
        .then(function(logs) {
            if (loadingEl) loadingEl.style.display = 'none';
            if (btnRefresh) {
                btnRefresh.classList.remove('spinning');
                btnRefresh.disabled = false;
            }
            renderLogAttivita(logs || [], filtriAttivi);
        })
        .catch(function(err) {
            console.error('Errore nel caricamento del Log di Sistema:', err);
            if (loadingEl) {
                loadingEl.style.display = 'block';
                loadingEl.innerText = 'âš ï¸ Impossibile caricare il log delle attivitÃ .';
            }
            if (btnRefresh) {
                btnRefresh.classList.remove('spinning');
                btnRefresh.disabled = false;
            }
        });
}

// Traduce i dati grezzi del log in frasi dinamiche, colorate e con icone
// dedicate a seconda del tipo di evento (CREAZIONE, AVANZAMENTO, ecc.)
function renderLogAttivita(logs, filtriAttivi) {
    const listEl = document.getElementById('systemLogList');
    const emptyEl = document.getElementById('systemLogEmpty');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!logs || logs.length === 0) {
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.innerText = filtriAttivi
                ? 'Nessuna attivitÃ  trovata con i filtri selezionati. ðŸ”'
                : 'Nessuna attivitÃ  registrata finora. Inizia a tracciare le tue opere! ðŸŽ®';
        }
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    logs.forEach(function(log, idx) {
        const li = document.createElement('li');
        li.className = 'system-log-item';
        li.style.animationDelay = (idx * 0.05) + 's';

        const tipoMedia = String(log.tipoMedia || '').toUpperCase();
        const isAnime = (tipoMedia === 'ANIME');
        const isCinema = (tipoMedia === 'CINEMA');
        const isSerieTv = (tipoMedia === 'SERIE_TV');
        const isLibro = (tipoMedia === 'LIBRO');
        const badgeClass = isSerieTv ? 'log-badge-serietv' : (isAnime ? 'log-badge-anime' : (isCinema ? 'log-badge-cinema' : (isLibro ? 'log-badge-libri' : 'log-badge-manga')));
        const badgeLabel = isSerieTv ? 'SERIE TV' : (isAnime ? 'ANIME' : (isCinema ? 'CINEMA' : (isLibro ? 'LIBRO' : 'MANGA')));

        const titoloHtml = '<span class="log-title-highlight">' + escapeHtmlLog(log.idTitolo || 'Titolo sconosciuto') + '</span>';
        const valoreNuovoHtml = '<span class="log-value-highlight">' + escapeHtmlLog(log.valoreNuovo) + '</span>';

        let frase = '';
        switch (String(log.tipoEvento || '').toUpperCase()) {
            case 'CREAZIONE':
                frase = isCinema
                    ? 'ðŸŽ¬ Nuovo film aggiunto: ' + titoloHtml + ' Ã¨ stato inserito nel tracker!'
                    : (isLibro
                        ? 'ðŸ“— Nuovo libro aggiunto: ' + titoloHtml + ' Ã¨ stato inserito in biblioteca!'
                        : 'ðŸ‘¾ Nuova opera aggiunta: ' + titoloHtml + ' Ã¨ stato inserito nel tracker!');
                break;
            case 'AVANZAMENTO':
                if (isAnime) {
                    frase = 'ðŸ“º Avanzamento su ' + titoloHtml + ': ora a ' + valoreNuovoHtml + '!';
                } else {
                    frase = isSerieTv ? 'ðŸ“¡ Avanzamento su ' + titoloHtml + ': ora a ' + valoreNuovoHtml + '!' : 'ðŸ“š Letto il volume ' + valoreNuovoHtml + ' di ' + titoloHtml + '!';
                }
                break;
            case 'COMPLETAMENTO':
                if (isCinema && String(log.valoreNuovo || '').includes('[streaming]')) {
                    frase = 'ðŸ¿ <span class="log-value-highlight">VISTO!</span> Hai visto ' + titoloHtml + ' in streaming! ðŸ“º';
                } else {
                    frase = isCinema
                        ? 'ðŸ¿ <span class="log-value-highlight">VISTO!</span> Hai visto ' + titoloHtml + ' al cinema! ðŸŽ¬'
                        : (isLibro
                            ? 'ðŸ“— <span class="log-value-highlight">LETTO!</span> Hai finito di leggere ' + titoloHtml + '! âœ¨'
                            : 'ðŸ† <span class="log-value-highlight">COMPLETATO!</span> Hai finito ' + titoloHtml + '! âœ¨');
                }
                break;
            case 'IN_PARI':
                frase = 'âœ… Sei in pari con ' + titoloHtml + ': ' + valoreNuovoHtml + '!';
                break;
            case 'VOTO':
                frase = 'â­ Hai valutato ' + titoloHtml + ' con un voto di ' + valoreNuovoHtml + '/10!';
                break;
            case 'CAMBIO_STATO':
                if (isCinema && String(log.valoreNuovo || '').toUpperCase() === 'ELIMINATO') {
                    frase = 'ðŸ—‘ï¸ Film eliminato dal tracker: ' + titoloHtml;
                } else if (isCinema) {
                    frase = 'ðŸ”„ ' + titoloHtml + ' rimesso tra i film da vedere.';
                } else {
                    frase = 'ðŸ”„ Stato aggiornato per ' + titoloHtml + ': ora ' + valoreNuovoHtml;
                }
                break;
            case 'ACQUISTO':
                frase = 'ðŸ›’ Hai acquistato ' + titoloHtml + '!';
                break;
            case 'ABBANDONO':
                frase = 'â›” Hai abbandonato ' + titoloHtml + ': progresso congelato.';
                break;
            case 'RIPRESA':
                frase = 'ðŸ”„ Hai ripreso ' + titoloHtml + ': di nuovo in pista!';
                break;
            default:
                frase = 'â„¹ï¸ Nuova attivitÃ  registrata per ' + titoloHtml;
        }

        li.innerHTML =
            '<span class="log-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
            '<div class="log-content">' +
                '<div class="log-text">' + frase + '</div>' +
                '<div class="log-timestamp">' + formatLogTimestamp(log.timestamp) + '</div>' +
            '</div>';

        listEl.appendChild(li);
    });
}

// Formatta il timestamp ISO restituito dal backend in un formato leggibile (gg/mm - hh:mm)
function formatLogTimestamp(isoString) {
    if (!isoString) return '';
    try {
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        const dataStr = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
        const oraStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        return dataStr + ' â€” ' + oraStr;
    } catch (e) {
        return '';
    }
}

// Piccola utility di escaping per evitare problemi di markup nei titoli/valori dinamici
function escapeHtmlLog(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Gestione del click sull'header per collassare/espandere il widget
(function initSystemLogWidget() {
    const headerEl = document.getElementById('systemLogHeader');
    const widgetEl = document.getElementById('systemLogWidget');
    if (headerEl && widgetEl) {
        headerEl.addEventListener('click', function() {
            widgetEl.classList.toggle('collapsed');
        });
    }
})();

// ðŸ” Gestione dei filtri del Log di Sistema (Tipo Media + Tipo Evento).
// I due filtri sono combinabili (es. Anime + Completamento). Ogni modifica
// ricarica il log dal backend, che si occupa di restituire sempre fino a
// 15 righe corrispondenti ai filtri correnti.
(function initSystemLogFilters() {
    const filtersEl = document.getElementById('systemLogFilters');
    const selTipo = document.getElementById('filterLogTipo');
    const selEvento = document.getElementById('filterLogEvento');
    const inputTitolo = document.getElementById('filterLogTitolo');

    if (!filtersEl || !selTipo || !selEvento) return;

    // Impedisce che un click sui filtri (per aprire la select o scrivere nel
    // campo di ricerca) faccia scattare anche il click sull'header, che
    // collasserebbe il widget.
    filtersEl.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    function aggiornaStatoVisivoFiltro(selectEl) {
        if (selectEl.value === 'all') {
            selectEl.classList.remove('filter-active');
        } else {
            selectEl.classList.add('filter-active');
        }
    }

    [selTipo, selEvento].forEach(function(selectEl) {
        selectEl.addEventListener('change', function(e) {
            e.stopPropagation();
            aggiornaStatoVisivoFiltro(selectEl);
            caricaLogAttivita();
        });
    });

    // ðŸ” Filtro per titolo: ricerca "contiene" combinabile con gli altri
    // filtri. Usa un debounce per evitare di interrogare il backend ad ogni
    // singolo tasto premuto: la ricerca parte ~350ms dopo l'ultima digitazione.
    if (inputTitolo) {
        let debounceTimer = null;

        function aggiornaStatoVisivoInput() {
            if (inputTitolo.value.trim() === '') {
                inputTitolo.classList.remove('filter-active');
            } else {
                inputTitolo.classList.add('filter-active');
            }
        }

        inputTitolo.addEventListener('input', function(e) {
            e.stopPropagation();
            aggiornaStatoVisivoInput();
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function() {
                caricaLogAttivita();
            }, 350);
        });

        // Invio immediato dei risultati alla pressione di "Invio", senza
        // attendere il debounce.
        inputTitolo.addEventListener('keydown', function(e) {
            e.stopPropagation();
            if (e.key === 'Enter') {
                if (debounceTimer) clearTimeout(debounceTimer);
                caricaLogAttivita();
            }
        });
    }
})();

// ðŸ”„ / â†º Gestione dei pulsanti "Reimposta filtri" e "Aggiorna log" del
// Log di Sistema. Entrambi vivono nell'header del widget, quindi va
// bloccata la propagazione del click per non far scattare anche il
// toggle di apertura/chiusura del widget.
(function initSystemLogActions() {
    const actionsEl = document.getElementById('systemLogActions');
    const btnReset = document.getElementById('btnResetLogFiltri');
    const btnRefresh = document.getElementById('btnRefreshLog');
    const btnOrdine = document.getElementById('btnToggleLogOrdine');
    const selTipo = document.getElementById('filterLogTipo');
    const selEvento = document.getElementById('filterLogEvento');
    const inputTitolo = document.getElementById('filterLogTitolo');

    if (!actionsEl) return;

    actionsEl.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    // ðŸ”ƒ Inverte l'ordinamento cronologico del log. Default (â–¾/â¬‡ï¸): dal piÃ¹
    // recente al piÃ¹ vecchio. Attivo (â–´/â¬†ï¸): dal piÃ¹ vecchio al piÃ¹ recente
    // (mostra le 15 attivitÃ  piÃ¹ vecchie che rispettano i filtri correnti).
    // Combinabile con tutti gli altri filtri (Tipo, Azione, Titolo).
    if (btnOrdine) {
        btnOrdine.addEventListener('click', function(e) {
            e.stopPropagation();
            const isAsc = btnOrdine.getAttribute('data-asc') === 'true';
            const nuovoStato = !isAsc;
            btnOrdine.setAttribute('data-asc', String(nuovoStato));
            if (nuovoStato) {
                btnOrdine.textContent = 'â¬†ï¸';
                btnOrdine.title = 'Inverti ordinamento (dal piÃ¹ recente)';
                btnOrdine.classList.add('filter-active');
            } else {
                btnOrdine.textContent = 'â¬‡ï¸';
                btnOrdine.title = 'Inverti ordinamento (dal piÃ¹ vecchio)';
                btnOrdine.classList.remove('filter-active');
            }
            caricaLogAttivita();
        });
    }

    // Riporta tutti i filtri (Tipo, Azione, Titolo) e l'ordinamento sui
    // valori di default e ricarica il log di default (ultime 15 attivitÃ 
    // senza alcun filtro, dal piÃ¹ recente al piÃ¹ vecchio).
    if (btnReset) {
        btnReset.addEventListener('click', function(e) {
            e.stopPropagation();
            if (selTipo) {
                selTipo.value = 'all';
                selTipo.classList.remove('filter-active');
            }
            if (selEvento) {
                selEvento.value = 'all';
                selEvento.classList.remove('filter-active');
            }
            if (inputTitolo) {
                inputTitolo.value = '';
                inputTitolo.classList.remove('filter-active');
            }
            if (btnOrdine) {
                btnOrdine.setAttribute('data-asc', 'false');
                btnOrdine.textContent = 'â¬‡ï¸';
                btnOrdine.title = 'Inverti ordinamento (dal piÃ¹ vecchio)';
                btnOrdine.classList.remove('filter-active');
            }
            caricaLogAttivita();
        });
    }

    // Ricarica il log con i filtri correnti, senza dover aggiornare
    // l'intera pagina (utile ad es. dopo aver segnato un volume letto
    // dal widget "Opere in corso").
    if (btnRefresh) {
        btnRefresh.addEventListener('click', function(e) {
            e.stopPropagation();
            caricaLogAttivita();
        });
    }
})();

// Caricamento del Log di Sistema all'avvio dell'app, ritardato di ~1 secondo
// per non rallentare il rendering dei contenuti principali della dashboard.
setTimeout(caricaLogAttivita, 1000);

// ============================================================================
// ðŸŽ¬ NUOVO: WIDGET "IN CORSO" (Home) â€” Anime in Visione & Manga in Lettura
// ============================================================================
// Carica anime, manga ed episodi (necessari per riusare l'overlay episodi
// della vista Anime) e popola le card cliccabili del widget nella Home.
function caricaWidgetInCorso(tentativo) {
    const loadingEl = document.getElementById('homeProgressLoading');
    const listEl = document.getElementById('homeProgressList');
    if (!listEl) return; // Il widget non Ã¨ presente in questa vista

    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.innerText = 'â³ Caricamento opere in corso...';
    }
    const emptyEl = document.getElementById('homeProgressEmpty');
    if (emptyEl) emptyEl.style.display = 'none';

    // Le cinque chiamate (anime, manga, episodi anime, serie TV, episodi serie TV) sono indipendenti
    // e partono tutte insieme. Ognuna Ã¨ protetta singolarmente: se una fallisce (es. token in
    // refresh dopo inattivitÃ ) le altre passano lo stesso. Al primo tentativo fallito si riprova
    // una sola volta dopo 1.5s, poi si disegna comunque con i dati arrivati.
    const tentativiWidget = parseInt(tentativo) || 0;
    let erroriWidget = 0;
    function sicuraWidgetInCorso_(promessa) {
        return promessa.catch(function(err) {
            erroriWidget++;
            console.warn('Widget In Corso: chiamata fallita (' + erroriWidget + '/5), uso lista vuota. Dettaglio: ' + err);
            return [];
        });
    }
    Promise.all([
        sicuraWidgetInCorso_(getAnimeDataSB_()),
        sicuraWidgetInCorso_(getMangaDataSB_()),
        sicuraWidgetInCorso_(getTuttiEpisodiAnimeSB_()),
        sicuraWidgetInCorso_(getSerieTvDataSB_()),
        sicuraWidgetInCorso_(getTuttiEpisodiSerieTvSB_())
    ])
        .then(function(risultati) {
            animeList = risultati[0] || [];
            mangaList = risultati[1] || [];
            episodiAnimeList = risultati[2] || [];
            serieTvList = risultati[3] || [];
            episodiSerieTvList = risultati[4] || [];
            if (erroriWidget > 0 && tentativiWidget < 1) {
                if (loadingEl) loadingEl.innerText = 'â³ Riconnessione in corso...';
                setTimeout(function() { caricaWidgetInCorso(tentativiWidget + 1); }, 1500);
                return;
            }
            if (loadingEl) loadingEl.style.display = 'none';
            renderWidgetInCorso();
        })
        .catch(function(err) {
            console.error('Errore caricamento dati per il widget "In Corso":', err);
            if (loadingEl) {
                loadingEl.style.display = 'block';
                loadingEl.innerText = 'âš ï¸ Impossibile caricare le opere in corso.';
            }
        });
}

// Filtra anime "In Visione" (flag blu, coloreVisione === 'celeste') e manga
// "In Lettura" (flag giallo, coloreLettura === 'giallo') e ridisegna le card.
function renderWidgetInCorso() {
    const listEl = document.getElementById('homeProgressList');
    const emptyEl = document.getElementById('homeProgressEmpty');
    const countEl = document.getElementById('homeProgressCount');
    if (!listEl) return;

    listEl.innerHTML = '';

    const animeInVisione = (animeList || [])
        .filter(item => item && item.coloreVisione === 'celeste')
        .map(item => ({ tipo: 'anime', item: item }));

    const mangaInLettura = (mangaList || [])
        .filter(item => item && item.coloreLettura === 'giallo')
        .map(item => ({ tipo: 'manga', item: item }));

    const serieTvInVisione = (typeof serieTvList !== 'undefined' ? serieTvList : [])
        .filter(item => item && item.coloreVisione === 'celeste')
        .map(item => ({ tipo: 'serietv', item: item }));

    const combinati = animeInVisione.concat(serieTvInVisione, mangaInLettura).sort((a, b) => {
        const tA = (a.item.titolo || '').toLowerCase();
        const tB = (b.item.titolo || '').toLowerCase();
        return tA.localeCompare(tB);
    });

    if (countEl) countEl.textContent = combinati.length + (combinati.length === 1 ? ' opera' : ' opere');

    if (combinati.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    combinati.forEach(function(entry, idx) {
        listEl.appendChild(creaProgressCard(entry.tipo, entry.item, idx));
    });
}

// Costruisce la singola card cliccabile (banner + titolo + avanzamento)
function creaProgressCard(tipo, item, idx) {
    const isAnime = (tipo === 'anime');
    const isSerieTv = (tipo === 'serietv');
    const card = document.createElement('div');
    card.className = 'progress-card';
    card.style.animationDelay = (idx * 0.04) + 's';
    card.title = item.titolo || '';

    // --- Banner (stessa immagine mostrata a inizio riga nelle rispettive viste) ---
    let bannerHTML = '';
    if (item.immagine && item.immagine.trim() !== '') {
        const safeImg = item.immagine.trim().replace(/'/g, "\\'").replace(/"/g, '&quot;');
        bannerHTML = `<img class="progress-card-banner" src="${safeImg}" alt="Banner" loading="lazy" onerror="this.style.display='none';">`;
    } else {
        bannerHTML = `<div class="progress-card-banner-placeholder">${isAnime ? 'ðŸ“º' : 'ðŸ“š'}</div>`;
    }

    // --- Avanzamento attuale ---
    let progressoHTML = '';
    if (isAnime) {
        const sVis = parseInt(item.stagioniViste) || 0;
        const sTot = parseInt(item.stagioniTotali) || 0;
        const fVis = parseInt(item.filmVisti) || 0;
        const fTot = parseInt(item.filmTotali) || 0;
        progressoHTML = `ðŸŽžï¸ ${sVis}/${sTot} stagioni`;
        if (fTot > 0) progressoHTML += `<br>ðŸŽ¬ ${fVis}/${fTot} film`;
    } else {
        const vLetti = parseInt(item.volumiLetti) || 0;
        const vTot = parseInt(item.volumi) || 0;
        progressoHTML = `ðŸ“– ${vLetti}/${vTot} volumi`;
    }
    if (isSerieTv) {
        const sVis = parseInt(item.stagioniViste) || 0;
        const sTot = parseInt(item.stagioniTotali) || 0;
        progressoHTML = `ðŸŽžï¸ ${sVis}/${sTot} stagioni`;
    }

    const badgeClass = isSerieTv ? 'log-badge-serietv' : (isAnime ? 'log-badge-anime' : 'log-badge-manga');
    const badgeLabel = isSerieTv ? 'SERIE TV' : (isAnime ? 'ANIME' : (item.tipologia || 'Manga'));

    card.innerHTML = `
        ${bannerHTML}
        <div class="progress-card-body">
            <span class="progress-card-badge ${badgeClass}">${escapeHtmlLog(badgeLabel)}</span>
            <div class="progress-card-title">${escapeHtmlLog(item.titolo || 'Senza Titolo')}</div>
            <div class="progress-card-progress">${progressoHTML}</div>
        </div>
    `;

    // Click sulla card: apre l'overlay di avanzamento corretto in base al tipo
    card.onclick = function() {
        if (isSerieTv) {
            apriGestioneStagioniSerieTv(item.titolo, true);
        } else if (isAnime) {
            apriGestioneEpisodi(item.titolo, true); // Stesso overlay aperto dall'icona ðŸ“º nella vista Anime, qui con la copertina di fianco
        } else {
            apriAvanzamentoVolumiManga(item.titolo); // Nuovo overlay compatto per i volumi letti
        }
    };

    return card;
}

// Gestione del click sull'header per collassare/espandere il widget "In Corso"
        // ================================================================
        // ðŸ” RICERCA RAPIDA nel widget "In Corso" (solo anime/manga/serie TV,
        // i film hanno giÃ  il loro widget). Trova un'opera qualsiasi e ne apre
        // subito l'overlay di avanzamento (stagioni/episodi o volumi): al primo
        // episodio/volume segnato l'opera entra in corso e compare nel widget,
        // perchÃ© i callback degli overlay ridisegnano giÃ  la lista (stesso
        // schema giÃ  usato per il manga).
        // ================================================================
        function widgetInCorsoCercaOpere_(testo) {
            const q = normalizzaTestoRicerca(testo || '');
            if (!q) return [];
            const risultati = [];
            (animeList || []).forEach(function(a) {
                if (!a || !a.titolo) return;
                if (!normalizzaTestoRicerca(a.titolo).includes(q)) return;
                risultati.push({ tipo: 'anime', titolo: a.titolo, immagine: a.immagine || '',
                    sub: 'Stagioni ' + (parseInt(a.stagioniViste) || 0) + '/' + (parseInt(a.stagioniTotali) || 0) + ' Â· ' + (a.stato || 'In corso') });
            });
            (serieTvList || []).forEach(function(s) {
                if (!s || !s.titolo) return;
                if (!normalizzaTestoRicerca(s.titolo).includes(q)) return;
                risultati.push({ tipo: 'serietv', titolo: s.titolo, immagine: s.immagine || '',
                    sub: 'Stagioni ' + (parseInt(s.stagioniViste) || 0) + '/' + (parseInt(s.stagioniTotali) || 0) + ' Â· ' + (s.stato || 'In corso') });
            });
            (mangaList || []).forEach(function(m) {
                if (!m || !m.titolo) return;
                if (!normalizzaTestoRicerca(m.titolo).includes(q)) return;
                risultati.push({ tipo: 'manga', titolo: m.titolo, immagine: m.immagine || '',
                    sub: 'Volumi ' + (parseInt(m.volumiLetti) || 0) + '/' + (parseInt(m.volumi) || 0) + ' Â· ' + (m.stato || 'In corso') });
            });
            risultati.sort(function(x, y) { return (x.titolo || '').localeCompare(y.titolo || ''); });
            return risultati.slice(0, 10);
        }

        function renderRisultatiWidgetInCorso_(risultati) {
            const box = document.getElementById('widgetInCorsoSearchResults');
            if (!box) return;
            if (!risultati || risultati.length === 0) {
                box.innerHTML = '<div class="global-search-empty">Nessun titolo tra anime, manga e serie TV.</div>';
                box.style.display = 'block';
                posizionaRisultatiWidgetInCorso_();
                return;
            }
            let html = '';
            risultati.forEach(function(item) {
                const safeTitle = String(item.titolo || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                const badgeClass = item.tipo === 'serietv' ? 'log-badge-serietv' : (item.tipo === 'anime' ? 'log-badge-anime' : 'log-badge-manga');
                const badgeLabel = item.tipo === 'serietv' ? 'SERIE TV' : item.tipo.toUpperCase();
                const icona = item.tipo === 'serietv' ? 'ðŸ“¡' : (item.tipo === 'anime' ? 'ðŸ“º' : 'ðŸ“š');
                const thumb = item.immagine
                    ? '<img class="global-search-thumb" src="' + item.immagine + '" loading="lazy">'
                    : '<div class="global-search-thumb-placeholder tipo-' + item.tipo + '">' + icona + '</div>';
                html += '<div class="global-search-row" onclick="apriOperaWidgetInCorso_(\'' + item.tipo + '\', \'' + safeTitle + '\')">'
                    + thumb
                    + '<div class="global-search-row-info">'
                    + '<div class="global-search-row-title">' + escapeHtmlLog(item.titolo) + '</div>'
                    + '<div class="global-search-row-sub"><span class="log-badge ' + badgeClass + '">' + badgeLabel + '</span> ' + escapeHtmlLog(item.sub) + '</div>'
                    + '</div></div>';
            });
            box.innerHTML = html;
            box.style.display = 'block';
            posizionaRisultatiWidgetInCorso_();
        }

        // Allinea il riquadro fluttuante sotto la casella di ricerca
        // (position:fixed, fuori dal flusso: le card non si spostano).
        function posizionaRisultatiWidgetInCorso_() {
            const input = document.getElementById('widgetInCorsoSearch');
            const box = document.getElementById('widgetInCorsoSearchResults');
            if (!input || !box || box.style.display === 'none') return;
            const r = input.getBoundingClientRect();
            box.style.left = Math.max(8, r.left) + 'px';
            box.style.top = (r.bottom + 6) + 'px';
            box.style.width = Math.min(Math.max(r.width, 300), window.innerWidth - 16) + 'px';
        }

        function apriOperaWidgetInCorso_(tipo, titolo) {
            const box = document.getElementById('widgetInCorsoSearchResults');
            if (box) { box.style.display = 'none'; box.innerHTML = ''; }
            const input = document.getElementById('widgetInCorsoSearch');
            if (input) input.value = '';
            if (tipo === 'anime') {
                apriGestioneEpisodi(titolo, true);
            } else if (tipo === 'serietv') {
                apriGestioneStagioniSerieTv(titolo, true);
            } else if (tipo === 'manga') {
                apriAvanzamentoVolumiManga(titolo);
            }
        }

        (function initWidgetInCorsoSearch() {
            const input = document.getElementById('widgetInCorsoSearch');
            const box = document.getElementById('widgetInCorsoSearchResults');
            if (!input || !box) return;
            // L'header apre/chiude il widget al click: il click nella casella
            // non deve propagare (stesso schema dello switch Sala/Streaming).
            input.addEventListener('click', function(e) { e.stopPropagation(); });
            input.addEventListener('input', function() {
                const testo = input.value.trim();
                if (!testo) { box.style.display = 'none'; box.innerHTML = ''; return; }
                renderRisultatiWidgetInCorso_(widgetInCorsoCercaOpere_(testo));
            });
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') { box.style.display = 'none'; input.blur(); }
            });
            document.addEventListener('click', function(e) {
                if (e.target !== input && !box.contains(e.target)) box.style.display = 'none';
            });
            window.addEventListener('scroll', function() { posizionaRisultatiWidgetInCorso_(); }, true);
            window.addEventListener('resize', function() { posizionaRisultatiWidgetInCorso_(); });
        })();

        (function initHomeProgressWidget() {
    const headerEl = document.getElementById('homeProgressHeader');
    const widgetEl = document.getElementById('homeProgressWidget');
    if (headerEl && widgetEl) {
        headerEl.addEventListener('click', function() {
            widgetEl.classList.toggle('collapsed');
        });
    }
})();

// Caricamento del widget "In Corso" all'avvio dell'app (Home Ã¨ la vista di
// default), ritardato di ~1 secondo come per il Log di Sistema.
setTimeout(caricaWidgetInCorso, 1000);

// ==========================================================================
// ðŸŽŸï¸ WIDGET "PROSSIMI AL CINEMA" (home) â€” mostra i primi 5 film "da vedere"
// al cinema (esclusi i promemoria streaming), ordinati per data di uscita
// crescente. Permette di segnarli come visti direttamente da qui, con la
// data di visione inserita tramite un input date inline (niente prompt()).
// ==========================================================================
let homeCinemaQueue = [];

function caricaWidgetCinemaProssimi() {
    const loadingEl = document.getElementById('homeCinemaLoading');
    const listEl = document.getElementById('homeCinemaList');
    if (!listEl) return; // Il widget non Ã¨ presente in questa vista

    if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.innerText = 'â³ Caricamento film in uscita...';
    }
    const emptyEl = document.getElementById('homeCinemaEmpty');
    if (emptyEl) emptyEl.style.display = 'none';

        getCinemaDataSB_()
        .then(function(data) {
            const tutti = data || [];
            // Solo i film "da vedere" (esclusi i promemoria streaming),
            // ordinati per data di uscita crescente. Film senza data valida
            // finiscono in coda invece di rompere l'ordinamento.
            homeCinemaQueue = tutti
                .filter(item => item && item.visione !== 'SÃ¬' && !item.streaming)
                .sort((a, b) => {
                    const dA = a.dataUscita || '9999-99-99';
                    const dB = b.dataUscita || '9999-99-99';
                    return dA.localeCompare(dB);
                });
            if (loadingEl) loadingEl.style.display = 'none';
            renderWidgetCinemaProssimi();
        })
        .catch(function(err) {
            console.error('Errore caricamento widget "Prossimi al Cinema": ', err);
            if (loadingEl) {
                loadingEl.style.display = 'block';
                loadingEl.innerText = 'âš ï¸ Impossibile caricare i film in uscita.';
            }
        });
}
// Ridisegna il widget mostrando al massimo i primi 5 film della coda
// (giÃ  ordinata). Va richiamata anche dopo ogni spunta, cosÃ¬ il 6Â° film,
// se esiste, prende automaticamente il posto di quello appena confermato.
function renderWidgetCinemaProssimi() {
    const listEl = document.getElementById('homeCinemaList');
    const emptyEl = document.getElementById('homeCinemaEmpty');
    const countEl = document.getElementById('homeCinemaCount');
    if (!listEl) return;

    listEl.innerHTML = '';

    const daMostrare = homeCinemaQueue.slice(0, 5);

    if (countEl) countEl.textContent = homeCinemaQueue.length + (homeCinemaQueue.length === 1 ? ' film in attesa' : ' film in attesa');

    if (daMostrare.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    daMostrare.forEach(function(item) {
        listEl.appendChild(creaCinemaUpcomingCard(item));
    });
}

// Costruisce la singola card: banner + titolo + data di uscita + azione di
// spunta con input date inline (precompilato con la data odierna, modificabile).
function creaCinemaUpcomingCard(item) {
    const card = document.createElement('div');
    card.className = 'progress-card cinema-upcoming-card';

    let bannerHTML = '';
    if (item.immagine) {
        bannerHTML = `<img src="${item.immagine}" class="progress-card-banner" alt="" onerror="this.outerHTML='<div class=\\'progress-card-banner-placeholder\\'>ðŸŽ¬</div>'">`;
    } else {
        bannerHTML = `<div class="progress-card-banner-placeholder">ðŸŽ¬</div>`;
    }

    const dataUscitaLabel = item.dataUscita ? formattaDataItalianaCinema_(item.dataUscita) : 'Data da definire';
    const oggiISO = new Date().toISOString().slice(0, 10);

    card.innerHTML = `
        ${bannerHTML}
        <div class="progress-card-body">
            <span class="progress-card-badge log-badge-cinema">CINEMA</span>
            <div class="progress-card-title">${escapeHtmlLog(item.titolo || 'Senza Titolo')}</div>
            <div class="progress-card-progress">ðŸ“… ${dataUscitaLabel}</div>
            <div class="cinema-upcoming-actions">
                <input type="date" class="cinema-upcoming-date-input" value="${oggiISO}" title="Data in cui hai visto il film">
                <button class="cinema-upcoming-check-btn" title="Segna come visto">âœ…</button>
            </div>
        </div>
    `;

    const dateInput = card.querySelector('.cinema-upcoming-date-input');
    const checkBtn = card.querySelector('.cinema-upcoming-check-btn');

    // La card non Ã¨ cliccabile: solo i suoi controlli lo sono.
    dateInput.addEventListener('click', e => e.stopPropagation());
    checkBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const dataVisioneISO = dateInput.value;
        if (!dataVisioneISO) {
            alert('âš ï¸ Seleziona una data di visione prima di confermare.');
            return;
        }
        checkBtn.disabled = true;
        dateInput.disabled = true;

        toggleVisioneCinemaSB_(item.titolo, true, dataVisioneISO)
            .then(function() {
                // Rimuove il film dalla coda e ridisegna: il 6Â° film (se esiste)
                // prende automaticamente il posto di quello appena spuntato.
                homeCinemaQueue = homeCinemaQueue.filter(x => x.titolo !== item.titolo);
                renderWidgetCinemaProssimi();
                showToast('ðŸŽ¬ "' + item.titolo + '" segnato come visto', 'success');
            })
            .catch(function(err) {
                console.error('Errore aggiornamento visione Cinema (widget home): ', err);
                alert('âŒ Errore durante l\'aggiornamento dello stato di visione.');
                checkBtn.disabled = false;
                dateInput.disabled = false;
            });
    });

    return card;
}

// Gestione del click sull'header per collassare/espandere il widget
(function initHomeCinemaWidget() {
    const headerEl = document.getElementById('homeCinemaHeader');
    const widgetEl = document.getElementById('homeCinemaWidget');
    if (headerEl && widgetEl) {
        headerEl.addEventListener('click', function() {
            widgetEl.classList.toggle('collapsed');
        });
    }
})();

// Caricamento del widget "Prossimi al Cinema" all'avvio dell'app, ritardato
// di ~1 secondo come gli altri due widget della home.
setTimeout(caricaWidgetCinemaProssimi, 1000);

// ==========================================================================
//   ðŸ” RICERCA GLOBALE (Home) â€” Anime + Manga + Cinema
// ==========================================================================
// L'indice (titoli + pochi metadati) viene richiesto una sola volta, al
// primo focus sulla barra, e tenuto in cache in ricercaGlobaleIndice: cosÃ¬
// l'apertura della Home resta leggera e la ricerca, una volta caricato
// l'indice, Ã¨ istantanea perchÃ© lavora tutta lato client.
let ricercaGlobaleIndice = null;
let ricercaGlobaleCaricamento = false;
let ricercaGlobaleRisultatiFlat = [];
let ricercaGlobaleAttivo = -1;
let ricercaGlobaleTimer = null;

const RICERCA_GLOBALE_ICONE = { anime: 'ðŸ“º', manga: 'ðŸ“š', libri: 'ðŸ“—', cinema: 'ðŸŽ¬', serietv: 'ðŸ“¡' };
const RICERCA_GLOBALE_LABEL = { anime: 'Anime', manga: 'Manga', libri: 'Libri', cinema: 'Cinema', serietv: 'Serie TV' };

// Toglie gli accenti e uniforma il case, cosÃ¬ "citta" trova "CittÃ " e viceversa.
function normalizzaTestoRicerca(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

async function getIndiceRicercaSB_() {
    const [animeData, mangaData, cinemaData, serieTvData, libriData] = await Promise.all([
        getAnimeDataSB_(), getMangaDataSB_(), getCinemaDataSB_(), getSerieTvDataSB_(), getLibriDataSB_()
    ]);
    const risultati = [];
    animeData.forEach(function(a) {
        risultati.push({
            titolo: a.titolo, tipo: 'anime', stato: a.stato, coloreVisione: a.coloreVisione,
            valutazione: a.valutazione, stagioniTotali: a.stagioniTotali, stagioniViste: a.stagioniViste,
            filmTotali: a.filmTotali, filmVisti: a.filmVisti, immagine: a.immagine
        });
    });
    mangaData.forEach(function(m) {
        risultati.push({
            titolo: m.titolo, tipo: 'manga', stato: m.stato, acquistato: m.acquistato,
            volumiLetti: m.volumiLetti, volumi: m.volumi, immagine: m.immagine
        });
    });
    cinemaData.forEach(function(c) {
        risultati.push({
            titolo: c.titolo, tipo: 'cinema', dataUscita: c.dataUscita, dataVisione: c.dataVisione,
            visione: c.visione, immagine: c.immagine, streaming: c.streaming
        });
    });
    serieTvData.forEach(function(s) {
        risultati.push({
            titolo: s.titolo, tipo: 'serietv', stato: s.stato, coloreVisione: s.coloreVisione,
            stagioniTotali: s.stagioniTotali, stagioniViste: s.stagioniViste, immagine: s.immagine
        });
    });
    (libriData || []).forEach(function(l) {
        risultati.push({
            titolo: l.titolo, tipo: 'libri', stato: l.stato, autore: l.autore,
            sagaNome: l.sagaNome, sagaNumero: l.sagaNumero, immagine: l.immagine
        });
    });
    return risultati;
}

// Carica (una sola volta) l'indice di ricerca dal server e lo mette in cache.
// Se Ã¨ giÃ  in cache o in corso di caricamento, richiama semplicemente il callback.
function garantisciIndiceRicercaGlobale(callback) {
    if (ricercaGlobaleIndice !== null) { callback(); return; }
    if (ricercaGlobaleCaricamento) { return; }

    ricercaGlobaleCaricamento = true;
    mostraStatoRicercaGlobale('â³ Carico i titoli...');

    getIndiceRicercaSB_()
        .then(function (data) {
            ricercaGlobaleIndice = data || [];
            ricercaGlobaleCaricamento = false;
            callback();
        })
        .catch(function (err) {
            console.error('Errore nel caricamento dell\'indice di ricerca:', err);
            ricercaGlobaleIndice = [];
            ricercaGlobaleCaricamento = false;
            mostraStatoRicercaGlobale('âš ï¸ Impossibile caricare i titoli. Riprova.');
        });
}

function mostraStatoRicercaGlobale(messaggio) {
    const box = document.getElementById('globalSearchResults');
    if (!box) return;
    box.innerHTML = '<div class="global-search-loading">' + messaggio + '</div>';
    box.style.display = 'block';
}

function nascondiRisultatiRicercaGlobale() {
    const box = document.getElementById('globalSearchResults');
    if (box) box.style.display = 'none';
    ricercaGlobaleRisultatiFlat = [];
    ricercaGlobaleAttivo = -1;
}

// Filtra l'indice in cache e disegna i risultati raggruppati per tipo.
function eseguiRicercaGlobale(query) {
    const q = normalizzaTestoRicerca(query.trim());
    if (!q) { nascondiRisultatiRicercaGlobale(); return; }
    if (!ricercaGlobaleIndice) return;

    const gruppi = { anime: [], manga: [], libri: [], cinema: [], serietv: [] };
    ricercaGlobaleIndice.forEach(function (item) {
        const titoloMatch = normalizzaTestoRicerca(item.titolo).includes(q);
        const autoreMatch = (item.tipo === 'libri' && item.autore) ? normalizzaTestoRicerca(item.autore).includes(q) : false;
        const sagaMatch = (item.tipo === 'libri' && item.sagaNome) ? normalizzaTestoRicerca(item.sagaNome).includes(q) : false;
        if (titoloMatch || autoreMatch || sagaMatch) {
            gruppi[item.tipo].push(item);
        }
    });

    renderRisultatiRicercaGlobale(gruppi);
}

function sottotitoloRisultatoRicercaGlobale(item) {
    if (item.tipo === 'anime') {
        const voto = (item.valutazione && item.valutazione !== '-') ? ' Â· voto ' + item.valutazione : '';
        const statoOpera = escapeHtmlLog(item.stato || 'In corso'); // "In corso" / "Concluso": stato di produzione dell'opera
        const labelVisione = COLORE_VISIONE_LABELS[item.coloreVisione] || '';

        // "Da iniziare" (bianco) o Completato (verde): nessun avanzamento da mostrare,
        // nel caso "verde" le frazioni coincidono coi totali quindi sarebbero ridondanti.
        if (item.coloreVisione === 'bianco' || item.coloreVisione === 'verde') {
            return statoOpera + ' Â· ' + escapeHtmlLog(labelVisione) + voto;
        }

        // In visione / in pari: aggiunge anche l'avanzamento (stagioni e/o film).
        const parti = [];
        if (item.stagioniTotali > 0) parti.push(item.stagioniViste + '/' + item.stagioniTotali + ' stag.');
        if (item.filmTotali > 0) parti.push(item.filmVisti + '/' + item.filmTotali + ' film');
        const avanzamento = parti.length > 0 ? ' (' + parti.join(', ') + ')' : '';

        return statoOpera + ' Â· ' + escapeHtmlLog(labelVisione) + avanzamento + voto;
    }
    if (item.tipo === 'serietv') {
        const statoOpera = escapeHtmlLog(item.stato || 'In corso');
        const labelVisione = COLORE_VISIONE_LABELS[item.coloreVisione] || 
''
;
        if (item.coloreVisione === 'bianco' || item.coloreVisione === 'verde') {
            return statoOpera + ' Â· ' + escapeHtmlLog(labelVisione);
        }
        const avanzamento = (item.stagioniTotali > 0) ? ' (' + item.stagioniViste + '/' + item.stagioniTotali + ' stag.)' : '';
        return statoOpera + ' Â· ' + escapeHtmlLog(labelVisione) + avanzamento;
    }
    if (item.tipo === 'manga') {
        const vol = item.volumi ? ' Â· vol. ' + item.volumiLetti + '/' + item.volumi : '';
        const acquisto = item.acquistato === 'SÃ¬' ? ' Â· Acquistato' : ' Â· Non acquistato';
        return escapeHtmlLog(item.stato) + vol + acquisto;
    }
    if (item.tipo === 'libri') {
        const autore = item.autore ? ' Â· ' + escapeHtmlLog(item.autore) : '';
        const saga = (item.sagaNome) ? ' Â· ðŸ“š ' + escapeHtmlLog(item.sagaNome) + (item.sagaNumero ? ' #' + item.sagaNumero : '') : '';
        return escapeHtmlLog(item.stato || 'Da leggere') + autore + saga;
    }
    // cinema
    if (item.visione === 'SÃ¬') return 'Visto' + (item.streaming ? ' in streaming' : '') + (item.dataVisione ? ' il ' + item.dataVisione : '');
    if (item.streaming) return 'Da vedere in streaming';
    return item.dataUscita ? 'Al cinema dal ' + item.dataUscita : 'Da vedere al cinema';
}

function evidenziaTitoloRicercaGlobale(titolo, query) {
    const safeTitolo = escapeHtmlLog(titolo);
    const idx = titolo.toLowerCase().indexOf(query.trim().toLowerCase());
    if (idx === -1) return safeTitolo;
    const prima = escapeHtmlLog(titolo.slice(0, idx));
    const match = escapeHtmlLog(titolo.slice(idx, idx + query.trim().length));
    const dopo = escapeHtmlLog(titolo.slice(idx + query.trim().length));
    return prima + '<mark>' + match + '</mark>' + dopo;
}

function renderRisultatiRicercaGlobale(gruppi) {
    const box = document.getElementById('globalSearchResults');
    if (!box) return;
    const query = document.getElementById('globalSearchInput').value;

    ricercaGlobaleRisultatiFlat = [];
    ricercaGlobaleAttivo = -1;

    const totale = gruppi.anime.length + gruppi.manga.length + (gruppi.libri ? gruppi.libri.length : 0) + gruppi.cinema.length + gruppi.serietv.length;
    if (totale === 0) {
        box.innerHTML = '<div class="global-search-empty">Nessun titolo trovato per "' + escapeHtmlLog(query) + '"</div>';
        box.style.display = 'block';
        return;
    }

    let html = '';
    ['anime', 'serietv', 'manga', 'libri', 'cinema'].forEach(function (tipo) {
        const lista = gruppi[tipo].slice(0, 6);
        if (lista.length === 0) return;

        html += '<div class="global-search-group">';
        html += '<div class="global-search-group-label tipo-' + tipo + '">' + RICERCA_GLOBALE_LABEL[tipo] + ' Â· ' + gruppi[tipo].length + '</div>';

        lista.forEach(function (item) {
            const flatIndex = ricercaGlobaleRisultatiFlat.length;
            ricercaGlobaleRisultatiFlat.push(item);
            const safeTitle = String(item.titolo || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
            const thumb = item.immagine
                ? '<img class="global-search-thumb" src="' + item.immagine + '" loading="lazy">'
                : '<div class="global-search-thumb-placeholder tipo-' + tipo + '">' + RICERCA_GLOBALE_ICONE[tipo] + '</div>';

            html += '<div class="global-search-row" data-flat-index="' + flatIndex + '" onclick="apriRisultatoRicercaGlobale(\'' + tipo + '\', \'' + safeTitle + '\')">';
            html += thumb;
            html += '<div class="global-search-row-info">';
            html += '<div class="global-search-row-title">' + evidenziaTitoloRicercaGlobale(item.titolo, query) + '</div>';
            html += '<div class="global-search-row-sub">' + sottotitoloRisultatoRicercaGlobale(item) + '</div>';
            html += '</div></div>';
        });

        html += '</div>';
    });

    box.innerHTML = html;
    box.style.display = 'block';
}

// Apre il dettaglio del risultato scelto: overlay sinossi giÃ  esistente per
// Anime/Manga/Libri/Serie TV, scheda rapida dedicata per Cinema (che non ha
// una sinossi).
function apriRisultatoRicercaGlobale(tipo, titolo) {
    nascondiRisultatiRicercaGlobale();
    if (tipo === 'anime' || tipo === 'manga' || tipo === 'serietv' || tipo === 'libri') {
        mostraSinossi(titolo, tipo);
    } else if (tipo === 'cinema') {
        mostraDettaglioCinemaRicercaGlobale(titolo);
    }
}

// Scheda rapida per un risultato Cinema: niente sinossi da recuperare dal
// server, i dati bastano quelli giÃ  in cache nell'indice di ricerca.
function mostraDettaglioCinemaRicercaGlobale(titolo) {
    const item = (ricercaGlobaleIndice || []).find(function (i) { return i.tipo === 'cinema' && i.titolo === titolo; });
    if (!item) return;

    let overlay = document.getElementById('globalSearchCinemaOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'globalSearchCinemaOverlay';
        overlay.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(5,5,7,0.85); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:10000; opacity:0; transition:opacity 0.25s ease; pointer-events:none;';

        const content = document.createElement('div');
        content.id = 'globalSearchCinemaContent';
        content.style = 'background:var(--surface-solid,#14162a); border:1px solid var(--border-color,#262a42); border-radius:12px; padding:24px; max-width:420px; width:90%; box-shadow:0 20px 40px rgba(0,0,0,0.6); position:relative; transform:scale(0.9); transition:transform 0.25s cubic-bezier(0.175,0.885,0.32,1.275);';
        content.innerHTML = '<button id="closeGlobalSearchCinemaBtn" style="position:absolute; top:14px; right:16px; background:none; border:none; color:var(--text-muted,#8890ab); font-size:20px; cursor:pointer;">âœ•</button>'
            + '<h3 id="globalSearchCinemaTitle" style="margin-top:0; margin-bottom:14px; color:var(--text,#f2f3fa); font-size:18px; font-weight:600; padding-right:24px; border-bottom:1px solid var(--border-color,#262a42); padding-bottom:10px;"></h3>'
            + '<div id="globalSearchCinemaBody" style="color:var(--text,#f2f3fa); font-size:14px; line-height:1.7;"></div>';

        overlay.appendChild(content);
        document.body.appendChild(overlay);
        document.getElementById('closeGlobalSearchCinemaBtn').onclick = chiudiDettaglioCinemaRicercaGlobale;
        overlay.onclick = function (e) { if (e.target === overlay) chiudiDettaglioCinemaRicercaGlobale(); };
    }

    document.getElementById('globalSearchCinemaTitle').innerText = item.titolo;
    document.getElementById('globalSearchCinemaBody').innerHTML = sottotitoloRisultatoRicercaGlobale(item);

    overlay.style.pointerEvents = 'auto';
    overlay.style.opacity = '1';
    document.getElementById('globalSearchCinemaContent').style.transform = 'scale(1)';
}

function chiudiDettaglioCinemaRicercaGlobale() {
    const overlay = document.getElementById('globalSearchCinemaOverlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    document.getElementById('globalSearchCinemaContent').style.transform = 'scale(0.9)';
}

function aggiornaEvidenziazioneAttivaRicercaGlobale() {
    document.querySelectorAll('#globalSearchResults .global-search-row').forEach(function (row) {
        row.classList.toggle('active', parseInt(row.dataset.flatIndex, 10) === ricercaGlobaleAttivo);
    });
    const attiva = document.querySelector('#globalSearchResults .global-search-row.active');
    if (attiva) attiva.scrollIntoView({ block: 'nearest' });
}

(function initGlobalSearch() {
    const input = document.getElementById('globalSearchInput');
    const wrap = document.getElementById('globalSearchWrap');
    if (!input || !wrap) return;

    // Precarica l'indice al primo focus, cosÃ¬ quando l'utente inizia a
    // digitare la ricerca Ã¨ giÃ  pronta e istantanea.
    input.addEventListener('focus', function () {
        garantisciIndiceRicercaGlobale(function () {
            if (input.value.trim()) eseguiRicercaGlobale(input.value);
        });
    }, { once: true });

    input.addEventListener('input', function () {
        clearTimeout(ricercaGlobaleTimer);
        const valore = input.value;
        ricercaGlobaleTimer = setTimeout(function () {
            if (ricercaGlobaleIndice === null) {
                garantisciIndiceRicercaGlobale(function () { eseguiRicercaGlobale(valore); });
            } else {
                eseguiRicercaGlobale(valore);
            }
        }, 150);
    });

    input.addEventListener('keydown', function (e) {
        if (ricercaGlobaleRisultatiFlat.length === 0) {
            if (e.key === 'Escape') { input.value = ''; nascondiRisultatiRicercaGlobale(); input.blur(); }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            ricercaGlobaleAttivo = Math.min(ricercaGlobaleAttivo + 1, ricercaGlobaleRisultatiFlat.length - 1);
            aggiornaEvidenziazioneAttivaRicercaGlobale();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            ricercaGlobaleAttivo = Math.max(ricercaGlobaleAttivo - 1, 0);
            aggiornaEvidenziazioneAttivaRicercaGlobale();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const scelto = ricercaGlobaleRisultatiFlat[ricercaGlobaleAttivo >= 0 ? ricercaGlobaleAttivo : 0];
            if (scelto) apriRisultatoRicercaGlobale(scelto.tipo, scelto.titolo);
        } else if (e.key === 'Escape') {
            input.value = '';
            nascondiRisultatiRicercaGlobale();
            input.blur();
        }
    });

    // Chiude il dropdown se si clicca fuori dalla barra di ricerca.
    document.addEventListener('click', function (e) {
        if (!wrap.contains(e.target)) nascondiRisultatiRicercaGlobale();
    });
})();

// ==========================================================================
//   STATISTICHE - vista rimossa (sezione superflua): restano qui solo i
//   pezzi riusati altrove: toggleStatsWidget (widget Cinema), la mappa
//   COLORE_VISIONE_LABELS (ricerca globale) e cssVar.
// ==========================================================================

// Legge una CSS custom property del tema (es. '--primary') giÃ  risolta a runtime
function cssVar(nome) {
    return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

const COLORE_VISIONE_LABELS = { bianco: 'Da iniziare', celeste: 'In visione', giallo: 'In pari', verde: 'Completato', rosso: 'Abbandonata' };

// Apre/chiude un widget a tendina (Home, Cinema), animando l'altezza
// reale del contenuto (stessa tecnica del widget "Log di sistema" in Home).
function toggleStatsWidget(widgetId) {
    const widget = document.getElementById(widgetId);
    if (!widget) return;
    const body = widget.querySelector('.stats-widget-body');
    if (!body) return;

    const staAprendo = widget.classList.contains('collapsed');

    if (staAprendo) {
        widget.classList.remove('collapsed');
        void body.offsetHeight; // forza il reflow prima di leggere/animare l'altezza
        body.style.maxHeight = body.scrollHeight + 'px';

        setTimeout(function () {
            body.style.maxHeight = 'none'; // libera l'altezza per eventuali ridimensionamenti futuri
            void widget.offsetHeight; // ricalcolo layout (la vista Stats con i grafici e' rimossa)
        }, 380);
    } else {
        body.style.maxHeight = body.scrollHeight + 'px'; // punto di partenza esplicito per poter animare verso 0
        void body.offsetHeight; // forza il reflow
        widget.classList.add('collapsed'); // la regola !important riporta max-height a 0 e la transizione anima la chiusura
    }
}
