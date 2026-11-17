// Cambio sezione con l'effetto "genio" (Richiesta 55): la sezione vecchia viene
// risucchiata nella sua icona della barra e la nuova esce dall'icona cliccata
// (da PC a imbuto, come il Dock del Mac; sul telefono una versione leggera che
// rimpicciolisce e basta). Il motore è in main.js ("CAMBIO SEZIONE A GENIO"):
// se non può partire (riduci movimento attivo, stessa sezione, barra nascosta)
// la sezione cambia subito come prima.
function switchView(viewName) {
            const conGenio = typeof genioCambiaSezione_ === 'function' && genioCambiaSezione_(viewName);
            if (!conGenio) switchViewOra_(viewName);
            if (typeof aggiornaIndicatoreNav_ === 'function') aggiornaIndicatoreNav_('nav-' + viewName, true);
        }

function switchViewOra_(viewName) {
            document.getElementById('homeView').style.display = 'none';
            document.getElementById('animeView').style.display = 'none';
            document.getElementById('mangaView').style.display = 'none';
            document.getElementById('libriView').style.display = 'none';
            document.getElementById('cinemaView').style.display = 'none';
            var wsrSwitch = document.getElementById('widgetInCorsoSearchResults');
            if (wsrSwitch) wsrSwitch.style.display = 'none';
            document.getElementById('serietvView').style.display = 'none';

            // Chiudi eventuali filtri fluttuanti aperti cambiando pagina
            document.getElementById('dropdownGenresAnime').classList.remove('active');
            document.getElementById('dropdownGenresManga').classList.remove('active');
            const dropLibriSwitch = document.getElementById('dropdownGenresLibri');
            if (dropLibriSwitch) dropLibriSwitch.classList.remove('active');
            const dropCinemaSwitch = document.getElementById('dropdownGenresCinema');
            if (dropCinemaSwitch) dropCinemaSwitch.classList.remove('active');
            const dropSerieTvSwitch = document.getElementById('dropdownGenresSerieTv');
            if (dropSerieTvSwitch) dropSerieTvSwitch.classList.remove('active');
            
            // Togli illuminazione da tutti i bottoni navbar
            document.querySelectorAll('.navbar .btn-nav').forEach(btn => btn.classList.remove('active-view'));
            if (viewName === 'home') {
                document.getElementById('homeView').style.display = 'flex';
                document.getElementById('nav-home').classList.add('active-view');
                caricaWidgetInCorso(); // Ricarica il widget "In Corso" per riflettere eventuali modifiche fatte altrove
                caricaWidgetCinemaProssimi(); // Ricarica il widget "Prossimi al Cinema" per lo stesso motivo
                if (typeof caricaConteggiCataloghi === 'function') caricaConteggiCataloghi(); // numeri sui riquadri dei cataloghi
            } else if (viewName === 'anime') {
                document.getElementById('animeView').style.display = 'block';
                document.getElementById('nav-anime').classList.add('active-view');
                caricaDatiAnime();
            } else if (viewName === 'serietv') {
                document.getElementById('serietvView').style.display = 'block';
                document.getElementById('nav-serietv').classList.add('active-view');
                caricaDatiSerieTv();
            } else if (viewName === 'manga') {
                document.getElementById('mangaView').style.display = 'block';
                document.getElementById('nav-manga').classList.add('active-view');
                caricaDatiManga();
            } else if (viewName === 'libri') {
                document.getElementById('libriView').style.display = 'block';
                document.getElementById('nav-libri').classList.add('active-view');
                caricaDatiLibri();
            } else if (viewName === 'cinema') {
                document.getElementById('cinemaView').style.display = 'block';
                document.getElementById('nav-cinema').classList.add('active-view');
                caricaDatiCinema();
            }
        }

        // ==========================================
        //                  LOGICA ANIME
        // ==========================================
        // ==========================================
        //   FASE 11 — GRUPPO ANIME (Supabase diretto)
        // ==========================================

        // Porting 1:1 di calcolaColoreVisioneAnime_ da codice.gs — pura
        // logica, nessuna chiamata al server, quindi la traduzione è
        // identica riga per riga.
        function calcolaColoreVisioneAnime_(stagioniTotali, stagioniViste, filmTotali, filmVisti, stato, haProgressoParziale, abbandonata) {
            if (abbandonata) return 'rosso';
            const statoClean = String(stato || '').trim().toLowerCase();
            const completato = (stagioniViste === stagioniTotali) && (filmVisti === filmTotali);
            const iniziato = (stagioniViste > 0) || (filmVisti > 0) || !!haProgressoParziale;
            if (!iniziato) return 'bianco';
            if (!completato) return 'celeste';
            return (statoClean === 'concluso') ? 'verde' : 'giallo';
        }

        // Porting di getAnimeData(): legge la tabella anime + episodi_anime da
        // Supabase e ricostruisce esattamente lo stesso "shape" di dati che
        // produceva codice.gs (stessi nomi di campo, stesso calcolo colore,
        // stesso auto-link delle URL nelle note).
        async function getAnimeDataSB_() {
            const [animeRes, episodiRes] = await Promise.all([
                supabaseClient.from('anime').select('*').order('titolo', { ascending: true }),
                supabaseClient.from('episodi_anime').select('anime_titolo,tipo,numero,episodi_totali,episodi_visti')
            ]);
            if (animeRes.error) throw animeRes.error;
            if (episodiRes.error) throw episodiRes.error;

            const animeRows = animeRes.data || [];
            const episodiRows = episodiRes.data || [];

            const titoliConProgressoParziale = new Set();
            episodiRows.forEach(function(e) {
                if ((parseInt(e.episodi_visti) || 0) > 0) {
                    titoliConProgressoParziale.add(e.anime_titolo);
                }
            });

            return animeRows.map(function(a) {
                let notaTesto = a.note || '';
                if (typeof notaTesto === 'string' && !notaTesto.includes('<a ') && notaTesto.match(/https?:\/\/[^\s]+/i)) {
                    notaTesto = notaTesto.replace(/(https?:\/\/[^\s]+)/gi, '<a href="$1" target="_blank" style="color: #00ffcc; text-decoration: underline; font-weight: 500;">$1</a>');
                }

                const haProgressoParziale = titoliConProgressoParziale.has(a.titolo);
                const coloreVisione = calcolaColoreVisioneAnime_(
                    a.stagioni_totali, a.stagioni_viste, a.film_totali, a.film_visti, a.stato, haProgressoParziale, !!a.abbandonata
                );

                return {
                    titolo: a.titolo, stato: a.stato || 'In corso', note: notaTesto,
                    valutazione: (a.valutazione === null || a.valutazione === undefined) ? '-' : a.valutazione,
                    stagioniTotali: a.stagioni_totali || 0, stagioniViste: a.stagioni_viste || 0,
                    filmTotali: a.film_totali || 0, filmVisti: a.film_visti || 0,
                    coloreVisione: coloreVisione, generi: a.generi || '', preferito: !!a.preferito,
                    immagine: a.immagine || '', priorita: !!a.priorita, abbandonata: !!a.abbandonata,
                    anilistId: a.anilist_id || null // Richiesta 62: collegamento ad AniList (prima stagione)
                };
            });
        }

        // Porting di getTuttiEpisodiAnime()
        async function getTuttiEpisodiAnimeSB_() {
            const { data, error } = await supabaseClient
                .from('episodi_anime')
                .select('anime_titolo,tipo,numero,episodi_totali,episodi_visti');
            if (error) throw error;
            return (data || []).map(function(r) {
                return { titolo: r.anime_titolo, tipo: r.tipo, numero: r.numero, episodiTotali: r.episodi_totali, episodiVisti: r.episodi_visti };
            });
        }
        // --- Funzioni di scrittura Anime (add/update/delete/toggle/voto) ---

        async function registraLogSB_(idTitolo, tipoMedia, tipoEvento, valPrec, valNuovo) {
            try {
                await supabaseClient.from('log_attivita').insert([{
                    timestamp: new Date().toISOString(),
                    id_titolo: idTitolo || '',
                    tipo_media: tipoMedia || '',
                    tipo_evento: tipoEvento || '',
                    valore_precedente: (valPrec === undefined || valPrec === null || valPrec === '') ? 'N/D' : String(valPrec),
                    valore_nuovo: (valNuovo === undefined || valNuovo === null || valNuovo === '') ? 'N/D' : String(valNuovo)
                }]);
            } catch (err) {
                console.error("Errore durante la registrazione del log ('" + tipoEvento + "' su '" + idTitolo + "'): " + err);
            }
        }

        // ↩️ PASSI INDIETRO NEI LOG (Richiesta 58)
        // Prima un passo indietro (volume, stagioni) veniva scritto come un
        // avanzamento ("Letto il volume 4" anche togliendo il 5): un clic sbagliato
        // e corretto lasciava doppioni. Ora, tornando indietro:
        // - se l'ultima voce di quel titolo è proprio il passo avanti che si sta
        //   annullando (stessi valori invertiti) ed è di meno di 10 minuti fa, la
        //   voce viene cancellata, come se il clic sbagliato non ci fosse mai stato;
        // - altrimenti resta scritta una CORREZIONE ("↩️ tornato al volume 4").
        const FINESTRA_ANNULLA_MS_ = 10 * 60 * 1000;
        function logRecente_(riga) {
            return !!riga && (Date.now() - new Date(riga.timestamp).getTime()) < FINESTRA_ANNULLA_MS_;
        }

        async function registraPassoIndietroSB_(idTitolo, tipoMedia, valPrec, valNuovo) {
            try {
                const { data: ultime, error } = await supabaseClient.from('log_attivita')
                    .select('id,timestamp,tipo_evento,valore_precedente,valore_nuovo')
                    .eq('id_titolo', idTitolo || '').eq('tipo_media', tipoMedia)
                    .order('timestamp', { ascending: false }).limit(2);
                if (error) throw error;
                const righe = ultime || [];
                const daCancellare = [];
                let i = 0;
                // manga: arrivando all'ultimo volume si scrive anche COMPLETAMENTO "4/5 → 5/5"
                const r0 = righe[0];
                if (tipoMedia === 'MANGA' && logRecente_(r0) && r0.tipo_evento === 'COMPLETAMENTO'
                    && String(r0.valore_precedente).split('/')[0] === String(valNuovo)
                    && String(r0.valore_nuovo).split('/')[0] === String(valPrec)) {
                    daCancellare.push(r0.id);
                    i = 1;
                }
                const r = righe[i];
                if (logRecente_(r) && ['AVANZAMENTO', 'IN_PARI', 'COMPLETAMENTO'].indexOf(r.tipo_evento) !== -1
                    && String(r.valore_precedente) === String(valNuovo) && String(r.valore_nuovo) === String(valPrec)) {
                    daCancellare.push(r.id);
                    const { error: errDel } = await supabaseClient.from('log_attivita').delete().in('id', daCancellare);
                    if (errDel) throw errDel;
                    return 'ANNULLATO';
                }
            } catch (err) {
                console.error("Errore nell'annullare l'ultimo avanzamento di '" + idTitolo + "': " + err);
            }
            await registraLogSB_(idTitolo, tipoMedia, 'CORREZIONE', valPrec, valNuovo);
            return 'CORREZIONE';
        }

        // Episodi: togliendo un episodio appena segnato per sbaglio (ultima voce del
        // log episodi per quella stagione/film, "visto" da meno di 10 minuti con gli
        // stessi numeri invertiti) la voce viene cancellata invece di aggiungere
        // "rimosso". Restituisce true se l'ha cancellata.
        async function annullaUltimoEpisodioSB_(titolo, tipo, numero, daValore, aValore, tipoMedia) {
            try {
                const { data, error } = await supabaseClient.from('log_episodi')
                    .select('id,timestamp,azione,episodio_precedente,episodio_nuovo')
                    .eq('titolo', titolo).eq('tipo', tipo).eq('numero', parseInt(numero) || 0)
                    .eq('tipo_media', tipoMedia)
                    .order('timestamp', { ascending: false }).limit(1);
                if (error) throw error;
                const r = data && data[0];
                if (logRecente_(r) && r.azione === 'VISTO'
                    && (parseInt(r.episodio_precedente) || 0) === (parseInt(aValore) || 0)
                    && (parseInt(r.episodio_nuovo) || 0) === (parseInt(daValore) || 0)) {
                    const { error: errDel } = await supabaseClient.from('log_episodi').delete().eq('id', r.id);
                    if (errDel) throw errDel;
                    return true;
                }
            } catch (err) {
                console.error("Errore nell'annullare l'ultimo episodio di '" + titolo + "': " + err);
            }
            return false;
        }

        async function aggiungiRigheEpisodiSB_(titolo, tipo, daNumero, aNumero, mappaTotaliEpisodi) {
            if (daNumero > aNumero) return;
            const titoloTrim = String(titolo).trim();
            const nuoveRighe = [];
            const defaultTotale = (tipo === 'Film') ? 1 : 0;
            for (let n = daNumero; n <= aNumero; n++) {
                const totaleNoto = (mappaTotaliEpisodi && mappaTotaliEpisodi[n] !== undefined) ? (parseInt(mappaTotaliEpisodi[n]) || 0) : defaultTotale;
                nuoveRighe.push({ anime_titolo: titoloTrim, tipo: tipo, numero: n, episodi_totali: totaleNoto, episodi_visti: 0 });
            }
            if (nuoveRighe.length === 0) return;
            const { error } = await supabaseClient.from('episodi_anime').insert(nuoveRighe);
            if (error) throw error;
        }

        async function rimuoviRigheEpisodiEccedentiSB_(titolo, tipo, numeroMinimoDaRimuovere) {
            const titoloTrim = String(titolo).trim();
            const { data, error: selErr } = await supabaseClient
                .from('episodi_anime').select('episodi_visti')
                .eq('anime_titolo', titoloTrim).eq('tipo', tipo).gte('numero', numeroMinimoDaRimuovere);
            if (selErr) throw selErr;
            const avevaProgresso = (data || []).some(function(r) { return (parseInt(r.episodi_visti) || 0) > 0; });
            const { error: delErr } = await supabaseClient
                .from('episodi_anime').delete()
                .eq('anime_titolo', titoloTrim).eq('tipo', tipo).gte('numero', numeroMinimoDaRimuovere);
            if (delErr) throw delErr;
            return avevaProgresso;
        }

        // Segna come viste tutte le righe con totale noto, sia Stagioni che
        // Film (usato dal flag "Anime già visto per intero"). Le righe a
        // totale 0 restano a 0: vanno corrette a mano con la matita, come per
        // le Serie TV.
        async function segnaEpisodiComeVistiAnimeSB_(titolo) {
            const titoloTrim = String(titolo).trim();
            const { data: righe, error: errSel } = await supabaseClient
                .from('episodi_anime').select('tipo,numero,episodi_totali').eq('anime_titolo', titoloTrim);
            if (errSel) throw errSel;
            const aggiornamenti = (righe || [])
                .filter(function(r) { return (parseInt(r.episodi_totali) || 0) > 0; })
                .map(function(r) {
                    return supabaseClient.from('episodi_anime')
                        .update({ episodi_visti: parseInt(r.episodi_totali) || 0 })
                        .eq('anime_titolo', titoloTrim).eq('tipo', r.tipo).eq('numero', r.numero);
                });
            if (aggiornamenti.length > 0) await Promise.all(aggiornamenti);
            return aggiornamenti.length;
        }

        async function calcolaProgressoAnimeSB_(titolo) {
            const titoloTrim = String(titolo).trim();
            const { data: righeAnime, error: errAnime } = await supabaseClient
                .from('anime').select('stato,stagioni_totali,film_totali,abbandonata').eq('titolo', titoloTrim);
            if (errAnime) throw errAnime;
            if (!righeAnime || righeAnime.length === 0) return null;

            const { data: righeEpisodi, error: errEp } = await supabaseClient
                .from('episodi_anime').select('tipo,numero,episodi_totali,episodi_visti').eq('anime_titolo', titoloTrim);
            if (errEp) throw errEp;

            const stato = righeAnime[0].stato || 'In corso';
            const stagioniTotali = righeAnime[0].stagioni_totali || 0;
            const filmTotali = righeAnime[0].film_totali || 0;
            const episodi = (righeEpisodi || []).map(function(e) {
                return { tipo: e.tipo, numero: e.numero, episodiTotali: e.episodi_totali, episodiVisti: e.episodi_visti };
            });

            const stagioniRighe = episodi.filter(function(e) { return e.tipo === 'Stagione'; });
            const filmRighe = episodi.filter(function(e) { return e.tipo === 'Film'; });

            function contaCompletiContigui(righe) {
                let count = 0;
                for (let n = 1; n <= righe.length; n++) {
                    const riga = righe.find(function(r) { return r.numero === n; });
                    if (!riga || riga.episodiTotali <= 0 || riga.episodiVisti < riga.episodiTotali) break;
                    count++;
                }
                return count;
            }

            const stagioniViste = contaCompletiContigui(stagioniRighe);
            const filmVisti = contaCompletiContigui(filmRighe);
            const haProgressoParziale = episodi.some(function(e) { return (parseInt(e.episodiVisti) || 0) > 0; });
            const coloreVisione = calcolaColoreVisioneAnime_(stagioniTotali, stagioniViste, filmTotali, filmVisti, stato, haProgressoParziale, !!righeAnime[0].abbandonata);

            return { stagioniViste: stagioniViste, filmVisti: filmVisti, coloreVisione: coloreVisione,
                     stato: stato, stagioniTotali: stagioniTotali, filmTotali: filmTotali, eventoLoggato: null };
        }

        async function ricalcolaSincronizzaELoggaSB_(titolo) {
            const titoloTrim = String(titolo).trim();
            const { data: righePrima, error: errPrima } = await supabaseClient
                .from('anime').select('stagioni_viste,film_visti').eq('titolo', titoloTrim);
            if (errPrima) throw errPrima;
            if (!righePrima || righePrima.length === 0) return null;

            const vecchieStagioniViste = righePrima[0].stagioni_viste || 0;
            const vecchiFilmVisti = righePrima[0].film_visti || 0;

            const risultato = await calcolaProgressoAnimeSB_(titoloTrim);
            if (!risultato) return null;

            let eventoDaLoggare = null;
            let valPrec = '', valNuovo = '';
            if (risultato.stagioniViste !== vecchieStagioniViste || risultato.filmVisti !== vecchiFilmVisti) {
                const tuttoVisto = (risultato.stagioniViste === risultato.stagioniTotali) && (risultato.filmVisti === risultato.filmTotali);
                const statoConclusoOra = String(risultato.stato).trim().toLowerCase().includes('conclus');
                valPrec = vecchieStagioniViste + ' stagioni / ' + vecchiFilmVisti + ' film';
                valNuovo = risultato.stagioniViste + ' stagioni / ' + risultato.filmVisti + ' film';
                eventoDaLoggare = (tuttoVisto && statoConclusoOra) ? 'COMPLETAMENTO' : (tuttoVisto ? 'IN_PARI' : 'AVANZAMENTO');
                // passo indietro (Richiesta 58): annulla l'avanzamento appena scritto o scrive una correzione
                if (risultato.stagioniViste <= vecchieStagioniViste && risultato.filmVisti <= vecchiFilmVisti) eventoDaLoggare = 'INDIETRO';
                risultato.eventoLoggato = (eventoDaLoggare === 'INDIETRO') ? 'CORREZIONE' : eventoDaLoggare;
            }

            const scritture = [
                supabaseClient.from('anime').update({ stagioni_viste: risultato.stagioniViste, film_visti: risultato.filmVisti }).eq('titolo', titoloTrim)
            ];
            if (eventoDaLoggare === 'INDIETRO') scritture.push(registraPassoIndietroSB_(titoloTrim, 'ANIME', valPrec, valNuovo));
            else if (eventoDaLoggare) scritture.push(registraLogSB_(titoloTrim, 'ANIME', eventoDaLoggare, valPrec, valNuovo));
            await Promise.all(scritture);

            return risultato;
        }

        async function addAnimeSB_(dati) {
            const { error: errIns } = await supabaseClient.from('anime').insert([{
                titolo: dati.titolo, stato: dati.stato || 'In corso', note: dati.note || '',
                valutazione: (dati.valutazione === '' || dati.valutazione === undefined || dati.valutazione === '-') ? null : dati.valutazione,
                stagioni_totali: parseInt(dati.stagioniTotali) || 0, stagioni_viste: parseInt(dati.stagioniViste) || 0,
                film_totali: parseInt(dati.filmTotali) || 0, film_visti: parseInt(dati.filmVisti) || 0,
                generi: dati.generi || '', preferito: false, immagine: dati.immagine || '', priorita: false,
                abbandonata: !!dati.abbandonata,
                anilist_id: dati.anilistId || null
            }]);
            if (errIns) throw errIns;

            await supabaseClient.from('sinossi_anime').insert([{ anime_titolo: dati.titolo, sinossi: '' }]);
            await registraLogSB_(dati.titolo, 'ANIME', 'CREAZIONE', 'N/D', dati.stato || 'In corso');
            if (dati.abbandonata) await registraLogSB_(dati.titolo, 'ANIME', 'ABBANDONO', 'N/D', 'Abbandonato');

            try {
                const stagioniTotaliNuove = parseInt(dati.stagioniTotali) || 0;
                const filmTotaliNuovi = parseInt(dati.filmTotali) || 0;
                if (stagioniTotaliNuove > 0) await aggiungiRigheEpisodiSB_(dati.titolo, 'Stagione', 1, stagioniTotaliNuove, dati.episodiPerStagione);
                if (filmTotaliNuovi > 0) await aggiungiRigheEpisodiSB_(dati.titolo, 'Film', 1, filmTotaliNuovi);
                if (dati.segnaComeVista) {
                    await segnaEpisodiComeVistiAnimeSB_(dati.titolo);
                    await ricalcolaSincronizzaELoggaSB_(dati.titolo);
                }
            } catch (epErr) {
                console.error("Errore durante la creazione delle righe episodi per '" + dati.titolo + "': " + epErr);
            }

            return getAnimeDataSB_();
        }

        async function updateAnimeSB_(vecchioTitolo, dati) {
            const vecchioTitoloTrim = String(vecchioTitolo).trim();
            const { data: righeVecchie, error: errSel } = await supabaseClient.from('anime').select('*').eq('titolo', vecchioTitoloTrim);
            if (errSel) throw errSel;
            if (!righeVecchie || righeVecchie.length === 0) return getAnimeDataSB_();
            const vecchiaRiga = righeVecchie[0];

            const vecchioStatoLog = vecchiaRiga.stato || 'In corso';
            const vecchiaValutazioneLog = vecchiaRiga.valutazione;
            const vecchieStagioniTotaliLog = vecchiaRiga.stagioni_totali || 0;
            const vecchiFilmTotaliLog = vecchiaRiga.film_totali || 0;

            const campiAnime = {
                titolo: dati.titolo, stato: dati.stato, note: dati.note,
                valutazione: (dati.valutazione === '' || dati.valutazione === undefined || dati.valutazione === '-') ? null : dati.valutazione,
                stagioni_totali: parseInt(dati.stagioniTotali) || 0, stagioni_viste: parseInt(dati.stagioniViste) || 0,
                film_totali: parseInt(dati.filmTotali) || 0, film_visti: parseInt(dati.filmVisti) || 0,
                generi: dati.generi || '', immagine: dati.immagine || '', abbandonata: !!dati.abbandonata
            };
            // Collegamento AniList (Richiesta 62): scritto solo se in questa modifica
            // è stata scelta un'opera AniList, mai cancellato da una modifica normale.
            if (dati.anilistId) campiAnime.anilist_id = dati.anilistId;
            const { error: errUpd } = await supabaseClient.from('anime').update(campiAnime).eq('titolo', vecchioTitoloTrim);
            if (errUpd) throw errUpd;

            const nuovoTitoloEffettivo = dati.titolo || vecchioTitolo;
            let risultatoProgresso = null;
            try {
                const nuoveStagioniTotaliEp = parseInt(dati.stagioniTotali) || 0;
                const nuoviFilmTotaliEp = parseInt(dati.filmTotali) || 0;

                if (nuoveStagioniTotaliEp > vecchieStagioniTotaliLog) {
                    await aggiungiRigheEpisodiSB_(nuovoTitoloEffettivo, 'Stagione', vecchieStagioniTotaliLog + 1, nuoveStagioniTotaliEp, dati.episodiPerStagione);
                } else if (nuoveStagioniTotaliEp < vecchieStagioniTotaliLog) {
                    const avevaProgresso = await rimuoviRigheEpisodiEccedentiSB_(nuovoTitoloEffettivo, 'Stagione', nuoveStagioniTotaliEp + 1);
                    if (avevaProgresso) console.warn("Rimosse righe stagioni con episodi già visti per '" + nuovoTitoloEffettivo + "'.");
                }

                if (nuoviFilmTotaliEp > vecchiFilmTotaliLog) {
                    await aggiungiRigheEpisodiSB_(nuovoTitoloEffettivo, 'Film', vecchiFilmTotaliLog + 1, nuoviFilmTotaliEp);
                } else if (nuoviFilmTotaliEp < vecchiFilmTotaliLog) {
                    const avevaProgresso = await rimuoviRigheEpisodiEccedentiSB_(nuovoTitoloEffettivo, 'Film', nuoviFilmTotaliEp + 1);
                    if (avevaProgresso) console.warn("Rimosse righe film con episodi già visti per '" + nuovoTitoloEffettivo + "'.");
                }

                if (dati.segnaComeVista) {
                    await segnaEpisodiComeVistiAnimeSB_(nuovoTitoloEffettivo);
                }
                risultatoProgresso = await ricalcolaSincronizzaELoggaSB_(nuovoTitoloEffettivo);
            } catch (epErr) {
                console.error("Errore durante la sincronizzazione episodi per '" + nuovoTitoloEffettivo + "': " + epErr);
            }

            try {
                const titoloLog = nuovoTitoloEffettivo;
                const nuovaValutazione = dati.valutazione;
                const nuovoStato = dati.stato || 'In corso';

                if (nuovaValutazione && String(nuovaValutazione).trim() !== '' &&
                    String(nuovaValutazione).trim() !== String(vecchiaValutazioneLog || '').trim()) {
                    await registraLogSB_(titoloLog, 'ANIME', 'VOTO', vecchiaValutazioneLog || 'N/D', nuovaValutazione);
                }
                if (String(nuovoStato).trim() !== String(vecchioStatoLog).trim()) {
                    // Il passaggio a Concluso indica fine distribuzione dell'opera,
                    // non fine visione: si logga sempre come semplice cambio stato.
                    // Il completamento vero resta quello del ricalcolo episodi.
                    await registraLogSB_(titoloLog, 'ANIME', 'CAMBIO_STATO', vecchioStatoLog, nuovoStato);
                }
                const eraAbbandonataLogAnime = !!vecchiaRiga.abbandonata;
                const oraAbbandonataLogAnime = !!dati.abbandonata;
                if (oraAbbandonataLogAnime && !eraAbbandonataLogAnime) {
                    await registraLogSB_(titoloLog, 'ANIME', 'ABBANDONO', 'In visione', 'Abbandonato');
                } else if (!oraAbbandonataLogAnime && eraAbbandonataLogAnime) {
                    await registraLogSB_(titoloLog, 'ANIME', 'RIPRESA', 'Abbandonato', 'In visione');
                }
            } catch (logErr) {
                console.error("Errore durante la valutazione degli eventi di log per updateAnime: " + logErr);
            }

            return getAnimeDataSB_();
        }

        async function deleteAnimeSB_(titolo) {
            const { error } = await supabaseClient.from('anime').delete().eq('titolo', String(titolo).trim());
            if (error) throw error;
            return getAnimeDataSB_();
        }

        async function toggleAnimePreferitoSB_(titolo, preferitoStato) {
            const { error } = await supabaseClient.from('anime').update({ preferito: !!preferitoStato }).eq('titolo', String(titolo).trim());
            if (error) throw error;
        }

        async function toggleAnimeAbbandonataSB_(titolo, abbandonataStato) {
            const { error } = await supabaseClient.from('anime').update({ abbandonata: !!abbandonataStato }).eq('titolo', String(titolo).trim());
            if (error) throw error;
        }

        async function impostaVotoAnimeSB_(titolo, voto) {
            const votoPulito = String(voto).trim().replace(',', '.');
            const votoNumerico = parseFloat(votoPulito);
            if (votoPulito === '' || isNaN(votoNumerico) || votoNumerico < 0 || votoNumerico > 10) {
                return { errore: 'Voto non valido: deve essere un numero tra 0 e 10.' };
            }
            const { data: righe, error: errSel } = await supabaseClient.from('anime').select('valutazione').eq('titolo', String(titolo).trim());
            if (errSel) throw errSel;
            if (!righe || righe.length === 0) return { errore: 'Anime non trovato.' };

            const vecchiaValutazione = righe[0].valutazione;
            if (vecchiaValutazione !== null && vecchiaValutazione !== undefined) {
                return { errore: 'Questa opera ha già un voto: per modificarlo usa la modale di modifica.' };
            }

            const { error: errUpd } = await supabaseClient.from('anime').update({ valutazione: votoNumerico }).eq('titolo', String(titolo).trim());
            if (errUpd) throw errUpd;

            try {
                await registraLogSB_(titolo, 'ANIME', 'VOTO', 'N/D', votoNumerico);
            } catch (logErr) {
                console.error("Errore durante la registrazione del log per impostaVotoAnime: " + logErr);
            }

            return { valutazione: votoNumerico };
        }

        async function toggleAnimePrioritaSB_(titolo, prioritaStato) {
            const { error } = await supabaseClient.from('anime').update({ priorita: !!prioritaStato }).eq('titolo', String(titolo).trim());
            if (error) throw error;
        }
		
        // ==========================================
        //   ⭐ VOTO ANIME (overlay griglia 0.5-10)
        //   Si apre dal pill "Vota" in lista (solo senza voto: se votato apre
        //   la modale di modifica) e in automatico al + che completa tutto
        //   l'anime Concluso mai votato. Salvataggio via impostaVotoAnimeSB_
        //   (stesse regole: 0-10, un solo voto, log VOTO).
        // ==========================================
        let votoAnimeTargetTitolo = null;
        let votoAnimeSelezionato = 0;

        function disegnaGrigliaVotoAnime_() {
            const grid = document.getElementById('votoAnimeGrid');
            if (!grid) return;
            grid.innerHTML = '';
            for (let i = 1; i <= 20; i++) {
                (function(valore) {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.textContent = (Math.round(valore * 2) / 2).toFixed(1);
                    if (valore === votoAnimeSelezionato) b.classList.add('sel');
                    b.onclick = function() {
                        votoAnimeSelezionato = valore;
                        document.getElementById('votoAnimeValore').textContent = (Math.round(valore * 2) / 2).toFixed(1);
                        document.getElementById('btnConfermaVotoAnime').disabled = false;
                        grid.querySelectorAll('button').forEach(function(x) { x.classList.remove('sel'); });
                        b.classList.add('sel');
                    };
                    grid.appendChild(b);
                })(i / 2);
            }
        }

        window.apriVotoAnime = function(titolo, automatico) {
            const item = (animeList || []).find(function(a) { return a.titolo === titolo; });
            if (!item) return;
            const v = item.valutazione;
            if (v !== undefined && v !== null && String(v).trim() !== '' && v !== '-') {
                apriModificaAnime(titolo);
                return;
            }
            votoAnimeTargetTitolo = titolo;
            votoAnimeSelezionato = 0;
            disegnaGrigliaVotoAnime_();
            document.getElementById('votoAnimeValore').textContent = '–';
            document.getElementById('btnConfermaVotoAnime').disabled = true;
            document.getElementById('votoAnimeModalTitle').innerText = '⭐ Vota — ' + titolo;
            document.getElementById('btnSaltaVotoAnime').style.display = automatico ? '' : 'none';
            document.getElementById('modalOverlayVotoAnime').classList.add('active');
        };

        window.chiudiModaleVotoAnime = function() {
            document.getElementById('modalOverlayVotoAnime').classList.remove('active');
            votoAnimeTargetTitolo = null;
            votoAnimeSelezionato = 0;
        };

        window.confermaVotoAnime = function() {
            if (!votoAnimeTargetTitolo || !votoAnimeSelezionato) {
                showToast('Scegli un voto da 0.5 a 10.', 'error');
                return;
            }
            const btn = document.getElementById('btnConfermaVotoAnime');
            btn.innerText = 'Salvataggio...';
            impostaVotoAnimeSB_(votoAnimeTargetTitolo, votoAnimeSelezionato)
                .then(function(res) {
                    btn.innerText = 'Conferma voto';
                    if (res && res.errore) {
                        showToast(res.errore, 'error');
                        return;
                    }
                    const votoAppenaDato = votoAnimeSelezionato;
                    return getAnimeDataSB_().then(function(data) {
                        animeList = data || [];
                        renderListAnime();
                        chiudiModaleVotoAnime();
                        showToast('Voto registrato: ' + votoAppenaDato, 'success');
                    });
                })
                .catch(function(err) {
                    btn.innerText = 'Conferma voto';
                    showToast('❌ Errore salvataggio voto: ' + err.message, 'error');
                });
        };


        function caricaDatiAnime() {
            document.getElementById('loadingAnime').style.display = 'block';
            document.getElementById('animeTable').style.display = 'none';

            getAnimeDataSB_()
                .then(function(data) {
                    animeList = data || [];
                    return getTuttiEpisodiAnimeSB_();
                })
                .then(function(epData) {
                    episodiAnimeList = epData || [];
                    document.getElementById('loadingAnime').style.display = 'none';
                    document.getElementById('animeTable').style.display = 'table';
                    renderListAnime();
                })
                .catch(function(err) {
                    console.error('Errore caricamento dati Anime da Supabase:', err);
                    document.getElementById('loadingAnime').style.display = 'none';
                    alert('❌ Errore nel caricamento degli anime. Controlla la console per i dettagli.');
                });
        }

        // --- SUGGERIMENTI ANIME via AniList (Richiesta 36) ---
        // Niente id salvato: search sul titolo, poi recommendations (tutto dal
        // browser, gratis). Dati già completi: niente secondo giro di rete.
        function pulisciTramaAniList_(s) {
            return String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }

        // Scrive subito meta+trama (dati già in mano, niente rete), poi prova
        // la traduzione IT con lo stesso traduttore gratis dei manga.
        function arricchisciSuggLocali_(candidati) {
            const gen = suggGen_;
            candidati.slice(0, 5).forEach(function(c, i) {
                if (gen !== suggGen_) return;
                const metaEl = document.getElementById('suggMeta' + i);
                if (metaEl) {
                    const pezzi = [c.anno || '', c.stato || ''].filter(Boolean);
                    if (c.volumi) pezzi.push(c.volumi + (c.volumi === 1 ? ' volume' : ' volumi'));
                    if (c.generi) pezzi.push(c.generi);
                    if (c.voto !== null && c.voto !== undefined) pezzi.push('⭐ ' + c.voto);
                    metaEl.textContent = pezzi.join(' · ');
                }
                const tramaEl = document.getElementById('suggTrama' + i);
                if (tramaEl && c.trama) tramaEl.textContent = c.trama;
                if (c.trama && c.trama.length > 40) {
                    traduciLungoSugg_(c.trama).then(function(t) {
                        if (gen !== suggGen_) return;
                        const el = document.getElementById('suggTrama' + i);
                        if (el && t && t !== c.trama) el.textContent = t;
                    }).catch(function() {});
                }
            });
        }

        // ==========================================
        //   💡 SUGGERIMENTI ANIME (Richiesta 62)
        //   - Anime di partenza: collegamento AniList salvato (anime.anilist_id)
        //     o ricerca con Wikidata (P8729) + AniList, scelta della copertina se
        //     non è sicuro (stesse funzioni dei manga, tipo 'ANIME').
        //   - Nella lista ogni anime è una serie intera: ogni suggerimento viene
        //     riportato alla sua PRIMA stagione (si risale la catena dei PREQUEL),
        //     così niente 2ª/3ª stagione di serie che hai già e, per le serie
        //     nuove, si parte sempre dall'inizio.
        //   - 25 raccomandazioni, niente speciali e video musicali, esclusione
        //     tollerante (sinonimi AniList, spazi, refusi, titolo contenuto).
        //   - Fino a 10 in vista, gli altri in una riga chiusa.
        // ==========================================

        async function salvaAniListIdAnimeSB_(titolo, anilistId) {
            const { error } = await supabaseClient.from('anime').update({ anilist_id: anilistId }).eq('titolo', String(titolo).trim());
            if (error) throw error;
            const item = (animeList || []).find(function(a) { return a && a.titolo === titolo; });
            if (item) item.anilistId = anilistId;
        }

        const CAMPI_ANIME_SUGG_ = 'id title { romaji english } synonyms format episodes status startDate { year } coverImage { medium large } genres averageScore description(asHtml: false) relations { edges { relationType node { id type format } } }';
        // Formati proposti come suggerimento (niente OVA, speciali, spot, video
        // musicali) e formati seguiti per risalire alla prima stagione (solo
        // serie: un OVA o un film "prequel" non è l'inizio della serie).
        const FORMATI_SERIE_ANIME_ = ['TV', 'TV_SHORT', 'ONA', 'MOVIE'];
        const FORMATI_STAGIONE_ANIME_ = ['TV', 'TV_SHORT', 'ONA'];

        function animeDaAniList_(m) {
            const t = m.title || {};
            const prequel = ((m.relations && m.relations.edges) || []).find(function(e) {
                return e && e.relationType === 'PREQUEL' && e.node && e.node.type === 'ANIME' &&
                    FORMATI_STAGIONE_ANIME_.indexOf(e.node.format) !== -1 && FORMATI_STAGIONE_ANIME_.indexOf(m.format) !== -1;
            });
            // Tutte le opere anime collegate (stagioni, film, OVA, spin-off): servono
            // a escludere dai suggerimenti i pezzi della stessa serie
            const collegati = ((m.relations && m.relations.edges) || []).filter(function(e) {
                return e && e.node && e.node.type === 'ANIME';
            }).map(function(e) { return e.node.id; });
            return {
                id: m.id,
                titolo: t.english || t.romaji || 'Senza titolo',
                titoloAlt: t.romaji || '',
                sinonimi: Array.isArray(m.synonyms) ? m.synonyms : [],
                formato: m.format || '',
                episodi: (typeof m.episodes === 'number' && m.episodes > 0) ? m.episodes : null,
                anno: (m.startDate && m.startDate.year) ? m.startDate.year : '',
                voto: (typeof m.averageScore === 'number' && m.averageScore > 0) ? Math.round(m.averageScore) / 10 : null,
                immagine: (m.coverImage && (m.coverImage.large || m.coverImage.medium)) || '',
                generi: Array.isArray(m.genres) ? m.genres.join(', ') : '',
                trama: pulisciTramaAniList_(m.description || ''),
                prequelId: prequel ? prequel.node.id : null,
                collegati: collegati
            };
        }

        // Per ogni anime risale i PREQUEL fino alla prima stagione (al massimo
        // 6 passi, una richiesta per passo per tutti insieme).
        async function radiciAnime_(anime) {
            const noti = {};
            anime.forEach(function(a) { noti[a.id] = a; });
            const radice = {};
            anime.forEach(function(a) { radice[a.id] = a.id; });
            for (let passo = 0; passo < 6; passo++) {
                const daCaricare = [];
                Object.keys(radice).forEach(function(k) {
                    const r = noti[radice[k]];
                    if (r && r.prequelId && !noti[r.prequelId] && daCaricare.indexOf(r.prequelId) === -1) daCaricare.push(r.prequelId);
                });
                if (daCaricare.length > 0) {
                    const gql = 'query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ' + CAMPI_ANIME_SUGG_ + ' } } }';
                    const json = await eseguireRichiestaAniList_(gql, { ids: daCaricare });
                    (((json.data || {}).Page || {}).media || []).forEach(function(m) { noti[m.id] = animeDaAniList_(m); });
                }
                let mosso = false;
                Object.keys(radice).forEach(function(k) {
                    const r = noti[radice[k]];
                    if (r && r.prequelId && noti[r.prequelId] && r.prequelId !== radice[k]) { radice[k] = r.prequelId; mosso = true; }
                });
                if (!mosso) break;
            }
            const out = {};
            Object.keys(radice).forEach(function(k) { out[k] = noti[radice[k]] || noti[k]; });
            return out;
        }

        // Titolo per i confronti anime: senza parentesi ("(Netflix)", "(2019)")
        // e senza "The" iniziale, poi compattato.
        function compattaTitoloAnime_(s) {
            return compattaTitoloSugg_(String(s || '').replace(/\([^)]*\)/g, ' ').replace(/^\s*the\s+/i, ''));
        }

        // true se l'anime è già nella lista: titolo (o sinonimo) uguale, con al
        // massimo 2 lettere diverse se lungo, oppure un titolo contiene l'altro
        // (es. "From me to you" in "Kimi ni Todoke: From Me to You").
        function animeGiaPosseduto_(titoli, posseduti) {
            return titoli.some(function(t) {
                const c = compattaTitoloAnime_(t);
                if (!c || c.length < 3) return false;
                return posseduti.some(function(p) {
                    if (!p) return false;
                    if (p === c) return true;
                    if (c.length >= 9 && p.length >= 9 && distanzaTitoli_(c, p, 2) <= 2) return true;
                    if (p.length >= 8 && c.indexOf(p) !== -1) return true;
                    if (c.length >= 8 && p.indexOf(c) !== -1) return true;
                    return false;
                });
            });
        }

        async function getSuggAnime_(anilistId) {
            const gql = 'query ($id: Int) { Media(id: $id) { ' + CAMPI_ANIME_SUGG_ + ' recommendations(sort: RATING_DESC, perPage: 25) { nodes { mediaRecommendation { ' + CAMPI_ANIME_SUGG_ + ' } } } } }';
            const json = await eseguireRichiestaAniList_(gql, { id: anilistId });
            const media = (json.data || {}).Media || {};
            const base = media.id ? animeDaAniList_(media) : null;
            const nodes = ((media.recommendations || {}).nodes) || [];
            const consigli = nodes.map(function(n) { return n.mediaRecommendation; }).filter(function(m) {
                return m && m.id && FORMATI_SERIE_ANIME_.indexOf(m.format) !== -1; // niente speciali, spot, video musicali
            }).map(animeDaAniList_);
            return { base: base, consigli: consigli };
        }

        async function suggAnime_(titolo) {
            const item = (animeList || []).find(function(x) { return x && x.titolo === titolo; });
            if (!item) return;
            showToast('Cerco suggerimenti…');
            try {
                let anilistId = await collegaMangaAniList_(item, 'ANIME');
                if (!anilistId) return; // scelta annullata
                let res = await getSuggAnime_(anilistId);
                // Il collegamento va sempre alla prima stagione: se è una stagione
                // successiva si risale e si salva la prima, poi si riparte da lì
                if (res.base && res.base.prequelId) {
                    try {
                        const rb = (await radiciAnime_([res.base]))[res.base.id];
                        if (rb && rb.id !== anilistId) {
                            anilistId = rb.id;
                            salvaAniListIdAnimeSB_(item.titolo, anilistId).catch(function(err) { console.error('Collegamento AniList non salvato: ' + err); });
                            res = await getSuggAnime_(anilistId);
                        }
                    } catch (errB) { console.error('Prima stagione non trovata: ' + errB); }
                }
                const daRisalire = res.consigli.slice();
                if (res.base) daRisalire.push(res.base);
                let radici = {};
                try { radici = await radiciAnime_(daRisalire); } catch (errR) { console.error('Prime stagioni non ricostruite: ' + errR); }

                const posseduti = [];
                const possedutiId = {};
                (animeList || []).forEach(function(x) {
                    if (!x) return;
                    if (x.titolo) posseduti.push(compattaTitoloAnime_(x.titolo));
                    if (x.anilistId) possedutiId[x.anilistId] = true;
                });
                possedutiId[anilistId] = true;
                // Serie di partenza: lei, la sua prima stagione e tutto ciò che
                // AniList le collega (stagioni, film, OVA, spin-off)
                const stessaSerie = {};
                stessaSerie[anilistId] = true;
                if (res.base) {
                    possedutiId[res.base.id] = true;
                    stessaSerie[res.base.id] = true;
                    (res.base.collegati || []).forEach(function(id) { stessaSerie[id] = true; });
                    const rb = radici[res.base.id];
                    if (rb) {
                        possedutiId[rb.id] = true;
                        stessaSerie[rb.id] = true;
                        (rb.collegati || []).forEach(function(id) { stessaSerie[id] = true; });
                    }
                }
                const dellaStessaSerie = function(x) {
                    return !!x && (stessaSerie[x.id] || (x.collegati || []).some(function(id) { return stessaSerie[id]; }));
                };

                const visti = {};
                const lista = [];
                res.consigli.forEach(function(c) {
                    const r = radici[c.id] || c;
                    if (visti[r.id] || possedutiId[r.id] || possedutiId[c.id]) return;
                    if (dellaStessaSerie(c) || dellaStessaSerie(r)) return;
                    const titoli = [r.titolo, r.titoloAlt].concat(r.sinonimi, [c.titolo, c.titoloAlt], c.sinonimi);
                    if (animeGiaPosseduto_(titoli, posseduti)) return;
                    visti[r.id] = true;
                    lista.push(r);
                });
                mostraSuggAnimeOverlay_(item.titolo, lista.slice(0, 10), lista.slice(10));
            } catch (err) {
                showToast(err.message || 'Suggerimenti non disponibili.', 'error');
            }
        }

        window.suggAnime_ = suggAnime_;

        function cardSuggAnime_(c, indice) {
            const img = c.immagine
                ? '<img src="' + escapeHtmlSugg_(c.immagine) + '" alt="" style="width:45px;height:65px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--border-color);cursor:zoom-in;" loading="lazy" onclick="apriLightbox(\'' + escapeHtmlSugg_(c.immagine).replace(/'/g, "\\'") + '\')">'
                : '<div style="width:45px;height:65px;border-radius:6px;flex-shrink:0;border:1px solid var(--border-color);"></div>';
            const originale = (c.titoloAlt && compattaTitoloSugg_(c.titoloAlt) !== compattaTitoloSugg_(c.titolo)) ? c.titoloAlt : '';
            const formati = { TV: 'Serie TV', TV_SHORT: 'Serie TV corta', ONA: 'Serie web', OVA: 'OVA', MOVIE: 'Film' };
            const meta = [c.anno || '', formati[c.formato] || c.formato || '', (c.episodi && c.formato !== 'MOVIE') ? c.episodi + (c.episodi === 1 ? ' episodio' : ' episodi') : '', c.generi || '', (c.voto !== null && c.voto !== undefined) ? '⭐ ' + c.voto : ''].filter(Boolean).join(' · ');
            const titoloPerAdd = String(c.titolo).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const addBtn = '<button class="action-icon-btn" style="flex-shrink:0;color:var(--primary);font-size:16px;font-weight:700;" onclick="suggAggiungiAnime_(' + c.id + ', \'' + escapeHtmlSugg_(titoloPerAdd) + '\')" title="Aggiungi con tutti i dati">＋</button>';
            return '<div style="display:flex;gap:12px;align-items:flex-start;">' + img +
                '<div style="min-width:0;flex:1;"><div style="font-weight:600;">' + escapeHtmlSugg_(c.titolo) + '</div>' +
                (originale ? '<div style="font-size:11px;opacity:0.6;">' + escapeHtmlSugg_(originale) + '</div>' : '') +
                '<div style="font-size:12px;opacity:0.7;">' + escapeHtmlSugg_(meta) + '</div>' +
                '<div id="suggAnimeTrama' + indice + '" class="sugg-trama" title="Clicca per espandere/comprimere" onclick="this.classList.toggle(\'trama-aperta\')" style="font-size:12px;opacity:0.85;margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;"></div></div>' + addBtn + '</div>';
        }

        function mostraSuggAnimeOverlay_(titoloBase, primi, altri) {
            mostraSuggOverlay_(titoloBase, [], 'anime');
            const gen = suggGen_;
            const lista = document.getElementById('suggOverlayLista');
            let html = primi.length
                ? primi.map(function(c, i) { return cardSuggAnime_(c, i); }).join('')
                : '<p style="font-size:13px;opacity:0.75;margin:0;">Nessun suggerimento nuovo: li hai già tutti in lista.</p>';
            if (altri.length > 0) {
                html += '<details id="suggAnimeAltri" style="border-top:1px solid var(--border-color);padding-top:8px;">' +
                    '<summary style="cursor:pointer;font-size:13px;opacity:0.85;">Altri ' + altri.length + ' suggerimenti</summary>' +
                    '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' +
                    altri.map(function(c, i) { return cardSuggAnime_(c, primi.length + i); }).join('') + '</div></details>';
            }
            lista.innerHTML = html;
            const tutti = primi.concat(altri);
            const traduci = function(da, a) {
                tutti.slice(da, a).forEach(function(c, k) {
                    const i = da + k;
                    const el = document.getElementById('suggAnimeTrama' + i);
                    if (!el || !c.trama) return;
                    el.textContent = c.trama;
                    if (c.trama.length > 40 && !c._tradotta) {
                        c._tradotta = true;
                        traduciLungoSugg_(c.trama).then(function(t) {
                            if (gen !== suggGen_) return;
                            const e2 = document.getElementById('suggAnimeTrama' + i);
                            if (e2 && t) e2.textContent = t;
                        }).catch(function() {});
                    }
                });
            };
            traduci(0, primi.length);
            const dettagli = document.getElementById('suggAnimeAltri');
            if (dettagli) dettagli.addEventListener('toggle', function() { if (dettagli.open) traduci(primi.length, tutti.length); });
        }

        // ＋ da un suggerimento anime (Richiesta 62): apre Nuovo Anime e lo
        // compila con l'import AniList di sempre (copertina, trama tradotta,
        // generi, "Cerca stagioni/film collegati"); il collegamento AniList
        // viene salvato con l'anime.
        function suggAggiungiAnime_(anilistId, titolo) {
            chiudiSuggOverlay();
            const btn = document.getElementById('btnNuovoAnime');
            if (btn) btn.click();
            const inp = document.getElementById('inpTitoloAnime');
            if (inp) inp.value = titolo || '';
            if (!anilistId) return;
            mostraOverlayAniList_();
            document.getElementById('anilistTitle').innerText = '🔎 ' + (titolo || 'Anime suggerito');
            document.getElementById('anilistBody').innerHTML = '<span style="color: var(--primary, #7c6cff); font-weight: 600; display: inline-block; animation: pulse 1.5s infinite;">⏳ Recupero dati e traduzione in corso...</span>';
            getDettaglioTraduzioneAniListSB_(anilistId)
                .then(function(d) { renderDettaglioAniList_('anime', d); })
                .catch(function(err) { renderErroreAniList_(err); });
        }

        window.suggAggiungiAnime_ = suggAggiungiAnime_;

        // Stessa mappatura dell'import manga (guida: RELEASING→In corso, ecc).
        function statoMangaSugg_(s) {
            if (s === 'FINISHED' || s === 'CANCELLED') return 'Concluso';
            if (s === 'NOT_YET_RELEASED') return 'In arrivo';
            if (s === 'RELEASING' || s === 'HIATUS') return 'In corso';
            return '';
        }

        // ==========================================
        //   💡 SUGGERIMENTI MANGA PUBBLICATI IN ITALIA (Richiesta 61)
        //   1. Collegamento del manga ad AniList: ID salvato (manga.anilist_id),
        //      altrimenti ricerca col titolo italiano (Wikidata, P8731 = ID
        //      AniList manga) e su AniList; se non è sicuro si sceglie tra le
        //      copertine e la scelta resta salvata.
        //   2. 25 raccomandazioni AniList, tolti i manga già in lista (confronto
        //      tollerante: spazi, piccoli refusi, ID, titolo italiano).
        //   3. Edizione italiana: Wikidata → pagina it.wikipedia → infobox
        //      "editore italiano" / "volumi in italiano". Fino a 10 confermati
        //      in vista, gli altri in una riga chiusa.
        // ==========================================

        // Titolo compatto per i confronti: niente accenti, spazi né simboli.
        function compattaTitoloSugg_(s) {
            return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        }

        // Distanza di modifica (Levenshtein) con uscita anticipata oltre `max`.
        function distanzaTitoli_(a, b, max) {
            if (Math.abs(a.length - b.length) > max) return max + 1;
            let prec = [];
            for (let j = 0; j <= b.length; j++) prec[j] = j;
            for (let i = 1; i <= a.length; i++) {
                const cur = [i];
                let minRiga = i;
                for (let j = 1; j <= b.length; j++) {
                    cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                    if (cur[j] < minRiga) minRiga = cur[j];
                }
                if (minRiga > max) return max + 1;
                prec = cur;
            }
            return prec[b.length];
        }

        // true se uno dei titoli è già nella lista: uguale una volta compattato,
        // oppure con al massimo 2 lettere diverse se il titolo è lungo (refusi).
        function titoloGiaPosseduto_(titoli, possedutiCompatti) {
            return titoli.some(function(t) {
                const c = compattaTitoloSugg_(t);
                if (!c) return false;
                if (possedutiCompatti.indexOf(c) !== -1) return true;
                if (c.length < 9) return false;
                return possedutiCompatti.some(function(p) { return p.length >= 9 && distanzaTitoli_(c, p, 2) <= 2; });
            });
        }

        async function salvaAniListIdMangaSB_(titolo, anilistId) {
            const { error } = await supabaseClient.from('manga').update({ anilist_id: anilistId }).eq('titolo', String(titolo).trim());
            if (error) throw error;
            const item = (mangaList || []).find(function(m) { return m && m.titolo === titolo; });
            if (item) item.anilistId = anilistId;
        }

        // Wikidata: manga con ID AniList che corrispondono al titolo (anche
        // italiano). Restituisce [{ anilistId, titoli: [it, en, mul] }].
        // tipo: 'MANGA' (P8731) o 'ANIME' (P8729, Richiesta 62)
        async function cercaMangaWikidataPerTitolo_(titolo, tipo) {
            const prop = (tipo === 'ANIME') ? 'P8729' : 'P8731';
            const base = 'https://www.wikidata.org/w/api.php?format=json&formatversion=2&origin=*&';
            const ricerca = await fetchJsonConLimite_(base + 'action=query&list=search&srprop=&srlimit=4&srsearch=' + encodeURIComponent(titolo + ' haswbstatement:' + prop), 6000);
            const ids = ((ricerca.query && ricerca.query.search) || []).map(function(r) { return r.title; });
            if (ids.length === 0) return [];
            const ent = await fetchJsonConLimite_(base + 'action=wbgetentities&props=labels|aliases|claims&languages=it|en|mul&ids=' + ids.join('|'), 6000);
            const out = [];
            ids.forEach(function(id) {
                const e = ent.entities && ent.entities[id];
                const c = e && e.claims && e.claims[prop] && e.claims[prop][0];
                const al = c && c.mainsnak && c.mainsnak.datavalue ? parseInt(c.mainsnak.datavalue.value) : NaN;
                if (isNaN(al)) return;
                const L = e.labels || {};
                const A = e.aliases || {};
                const alias = [].concat(A.it || [], A.en || [], A.mul || []).map(function(x) { return x.value; });
                out.push({ anilistId: al, titoli: [L.it, L.en, L.mul].filter(function(x) { return x; }).map(function(x) { return x.value; }).concat(alias) });
            });
            return out;
        }

        async function infoMangaAniList_(ids, tipo) {
            if (!ids.length) return [];
            const gql = 'query ($ids: [Int]) { Page(perPage: 10) { media(id_in: $ids, type: ' + (tipo === 'ANIME' ? 'ANIME' : 'MANGA') + ') { id title { romaji english } startDate { year } format coverImage { medium } } } }';
            const json = await eseguireRichiestaAniList_(gql, { ids: ids });
            return (((json.data || {}).Page || {}).media || []).map(function(m) {
                return {
                    id: m.id, titolo: (m.title && (m.title.english || m.title.romaji)) || '', titoloAlt: m.title ? (m.title.romaji || '') : '',
                    anno: (m.startDate && m.startDate.year) ? m.startDate.year : '', formato: m.format || '',
                    immagine: (m.coverImage && m.coverImage.medium) || ''
                };
            });
        }

        // Trova l'ID AniList del manga di partenza. Se è sicuro lo salva e lo
        // restituisce; altrimenti fa scegliere (null = annullato).
        // tipo: 'MANGA' (predefinito) o 'ANIME' (Richiesta 62). Per la ricerca si
        // tolgono le aggiunte tra parentesi ("(Netflix)", "(2019)").
        async function collegaMangaAniList_(item, tipo) {
            tipo = (tipo === 'ANIME') ? 'ANIME' : 'MANGA';
            const salva = (tipo === 'ANIME') ? salvaAniListIdAnimeSB_ : salvaAniListIdMangaSB_;
            if (item.anilistId) return item.anilistId;
            const titoloRicerca = String(item.titolo).replace(/\s*\([^)]*\)\s*/g, ' ').trim() || item.titolo;
            const titoloC = compattaTitoloSugg_(titoloRicerca);
            const esiti = await Promise.allSettled([cercaMangaWikidataPerTitolo_(titoloRicerca, tipo), cercaCandidatiAniListSB_(titoloRicerca, tipo)]);
            const wd = esiti[0].status === 'fulfilled' ? esiti[0].value : [];
            const al = esiti[1].status === 'fulfilled' ? esiti[1].value : [];
            // AniList non risponde (es. troppe richieste): meglio dirlo che mostrare
            // un "non trovo" fuorviante; senza AniList i suggerimenti non partono comunque
            if (esiti[1].status === 'rejected') throw esiti[1].reason;

            let sicuro = null;
            // Anime: Wikidata mette spesso per primi film o stagioni successive,
            // quindi prima il titolo identico su AniList (Richiesta 62)
            // Un anno tra parentesi nel titolo ("Fruits Basket (2019)") indica la
            // versione: si sceglie quella di quell'anno, mai un'altra in automatico
            const annoTitolo = (String(item.titolo).match(/\((\d{4})\)/) || [])[1] || '';
            if (tipo === 'ANIME') {
                const iniziaCon = function(a) { return compattaTitoloSugg_(a.titolo).indexOf(titoloC) === 0 || compattaTitoloSugg_(a.titoloAlt).indexOf(titoloC) === 0; };
                const alPrima = annoTitolo
                    ? al.find(function(a) { return String(a.anno) === annoTitolo && iniziaCon(a); })
                    : al.find(function(a) { return compattaTitoloSugg_(a.titolo) === titoloC || compattaTitoloSugg_(a.titoloAlt) === titoloC; });
                if (alPrima) sicuro = alPrima.id;
            }
            const annoDiverso = function(id) {
                if (!annoTitolo) return false;
                const a = al.find(function(x) { return x.id === id; });
                return !!(a && a.anno && String(a.anno) !== annoTitolo);
            };
            const wdUguale = wd.find(function(w) { return w.titoli.some(function(t) { return compattaTitoloSugg_(t) === titoloC; }); });
            if (!sicuro && wdUguale) sicuro = wdUguale.anilistId;
            // Due fonti d'accordo: il primo manga di Wikidata (trovato col titolo
            // italiano) è anche tra i risultati di AniList
            if (!sicuro && wd.length > 0 && al.some(function(a) { return a.id === wd[0].anilistId; })) sicuro = wd[0].anilistId;
            if (!sicuro) {
                const alUguale = al.find(function(a) { return compattaTitoloSugg_(a.titolo) === titoloC || compattaTitoloSugg_(a.titoloAlt) === titoloC; });
                if (alUguale) sicuro = alUguale.id;
            }
            if (sicuro && annoDiverso(sicuro)) sicuro = null; // anno diverso da quello nel titolo: si chiede
            if (sicuro) {
                salva(item.titolo, sicuro).catch(function(err) { console.error('Collegamento AniList non salvato: ' + err); });
                return sicuro;
            }

            // Scelta: prima i manga trovati da Wikidata (titolo italiano), poi AniList
            const idsWd = wd.map(function(w) { return w.anilistId; });
            let infoWd = [];
            try { infoWd = await infoMangaAniList_(idsWd.slice(0, 3), tipo); } catch (e) { console.error(e); }
            const visti = {};
            const scelte = [];
            infoWd.concat(al).forEach(function(c) {
                if (!c || !c.id || visti[c.id] || scelte.length >= 4) return;
                visti[c.id] = true;
                scelte.push(c);
            });
            // Nessun candidato: la finestra si apre lo stesso, con la casella per
            // cercare con un altro titolo (inglese o giapponese)
            const scelto = await scegliMangaAniList_(item.titolo, scelte, tipo);
            if (!scelto) return null;
            await salva(item.titolo, scelto);
            return scelto;
        }

        // Finestra "Quale manga intendi?" dentro l'overlay dei suggerimenti.
        function scegliMangaAniList_(titolo, scelte, tipo) {
            const isAnime = (tipo === 'ANIME');
            return new Promise(function(risolvi) {
                mostraSuggOverlay_(titolo, [], isAnime ? 'anime' : 'manga');
                document.getElementById('suggOverlayTitolo').textContent = isAnime ? 'Quale anime intendi?' : 'Quale manga intendi?';
                const lista = document.getElementById('suggOverlayLista');
                lista.innerHTML = '<p style="font-size:13px;opacity:0.8;margin:0;">' + (scelte.length
                    ? 'Non sono sicuro di quale opera sia <b>' + escapeHtmlSugg_(titolo) + '</b>: scegli quella giusta, la ricorderò.'
                    : 'Non trovo <b>' + escapeHtmlSugg_(titolo) + '</b> con questo titolo: prova a cercarlo con il titolo inglese o giapponese.') + '</p>';
                const griglia = document.createElement('div');
                griglia.style = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;';
                const disegna = function(elenco) {
                    griglia.innerHTML = '';
                    if (elenco.length === 0) {
                        griglia.innerHTML = '<div style="font-size:12px;opacity:0.7;">Nessun risultato.</div>';
                        return;
                    }
                    elenco.forEach(function(c) {
                        const card = document.createElement('div');
                        card.style = 'cursor:pointer;border:1px solid var(--border-color);border-radius:8px;overflow:hidden;background:rgba(255,255,255,0.03);';
                        card.innerHTML = (c.immagine ? '<img src="' + escapeHtmlSugg_(c.immagine) + '" alt="" style="width:100%;height:150px;object-fit:cover;display:block;background:#222;">' : '<div style="height:150px;display:flex;align-items:center;justify-content:center;background:#222;font-size:28px;">' + (isAnime ? '📺' : '📕') + '</div>') +
                            '<div style="padding:6px;font-size:11px;line-height:1.3;"><div style="font-weight:700;">' + escapeHtmlSugg_(c.titolo) + '</div><div style="opacity:.7;">' + escapeHtmlSugg_([c.titoloAlt !== c.titolo ? c.titoloAlt : '', c.anno, c.formato].filter(Boolean).join(' · ')) + '</div></div>';
                        card.onclick = function() { risolvi(c.id); };
                        griglia.appendChild(card);
                    });
                };
                if (scelte.length) disegna(scelte);
                lista.appendChild(griglia);
                // Ricerca con un altro titolo (inglese, giapponese, romaji)
                const riga = document.createElement('div');
                riga.style = 'display:flex;gap:6px;';
                riga.innerHTML = '<input type="search" placeholder="Altro titolo (inglese o giapponese)" style="flex:1;min-width:0;font-family:inherit;">' +
                    '<button type="button" class="btn">🔎 Cerca</button>';
                const campo = riga.querySelector('input');
                const cerca = function() {
                    const q = campo.value.trim();
                    if (!q) return;
                    griglia.innerHTML = '<div style="font-size:12px;opacity:0.7;">⏳ Ricerca su AniList...</div>';
                    cercaCandidatiAniListSB_(q, isAnime ? 'ANIME' : 'MANGA')
                        .then(function(r) { disegna((r || []).slice(0, 6)); })
                        .catch(function(err) { griglia.innerHTML = '<div style="font-size:12px;color:var(--danger);">' + escapeHtmlSugg_(err.message || String(err)) + '</div>'; });
                };
                riga.querySelector('button').onclick = cerca;
                campo.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); cerca(); } });
                lista.appendChild(riga);
                const nessuno = document.createElement('button');
                nessuno.type = 'button';
                nessuno.className = 'btn btn-danger';
                nessuno.style = 'align-self:flex-end;';
                nessuno.textContent = 'Nessuno di questi';
                nessuno.onclick = function() { chiudiSuggOverlay(); risolvi(null); };
                lista.appendChild(nessuno);
            });
        }

        // Pulisce un valore di infobox Wikipedia: [[a|b]] → b, via commenti,
        // note e modelli.
        function pulisciValoreWiki_(v) {
            return String(v || '')
                .replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '')
                .replace(/\{\{[^{}]*\}\}/g, '').replace(/<[^>]+>/g, '')
                .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'{2,}/g, '').trim();
        }

        // Edizione italiana di una lista di ID AniList. Restituisce
        // { id: { titoloIt, editore, volumi } } solo per quelli confermati.
        async function edizioniItalianeManga_(ids) {
            const risultato = {};
            if (!ids.length) return risultato;
            const sparql = 'SELECT ?al ?itLabel ?pagina WHERE { VALUES ?al { ' + ids.map(function(i) { return '"' + i + '"'; }).join(' ') + ' } ' +
                '?item wdt:P8731 ?al . OPTIONAL { ?item rdfs:label ?itLabel FILTER(lang(?itLabel) = "it") } ' +
                'OPTIONAL { ?pagina schema:about ?item ; schema:isPartOf <https://it.wikipedia.org/> } }';
            const wd = await fetchJsonConLimite_('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql), 8000);
            const perPagina = {};
            const titoliIt = {};
            ((wd.results && wd.results.bindings) || []).forEach(function(b) {
                const id = parseInt(b.al.value);
                if (b.itLabel) titoliIt[id] = b.itLabel.value;
                if (b.pagina) {
                    const pagina = decodeURIComponent(b.pagina.value.split('/wiki/')[1] || '').replace(/_/g, ' ');
                    if (pagina) (perPagina[pagina] = perPagina[pagina] || []).push(id);
                }
            });
            const pagine = Object.keys(perPagina);
            for (let i = 0; i < pagine.length; i += 25) {
                const blocco = pagine.slice(i, i + 25);
                const w = await fetchJsonConLimite_('https://it.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=' + encodeURIComponent(blocco.join('|')), 8000);
                const daTitolo = {};
                ((w.query && w.query.normalized) || []).concat((w.query && w.query.redirects) || []).forEach(function(x) { daTitolo[x.to] = daTitolo[x.from] || x.from; });
                ((w.query && w.query.pages) || []).forEach(function(p) {
                    const testo = (p.revisions && p.revisions[0] && p.revisions[0].slots && p.revisions[0].slots.main) ? p.revisions[0].slots.main.content : '';
                    if (!testo) return;
                    // La pagina può avere più schede (manga, anime, film): uso quella del manga
                    const schede = testo.split(/\{\{\s*Fumetto e animazione/i).slice(1);
                    const scheda = schede.find(function(s) { return /\|\s*tipo\s*=\s*(manga|light novel|manhwa|romanzo)/i.test(s); });
                    if (!scheda) return;
                    const campo = function(nome) {
                        const m = scheda.match(new RegExp('\\|\\s*' + nome + '\\s*=\\s*([^\\n]*)', 'i'));
                        return m ? pulisciValoreWiki_(m[1]) : '';
                    };
                    const editore = campo('editore italiano') || campo('etichetta italiana');
                    if (!editore) return;
                    const volumi = parseInt(campo('volumi in italiano')) || null;
                    const titoloScheda = campo('titolo italiano');
                    const chiave = daTitolo[p.title] || p.title;
                    (perPagina[chiave] || perPagina[p.title] || []).forEach(function(id) {
                        risultato[id] = { titoloIt: titoliIt[id] || titoloScheda || '', editore: editore, volumi: volumi };
                    });
                });
            }
            return risultato;
        }

        async function getSuggManga_(anilistId) {
            const gql = 'query ($id: Int) { Media(id: $id) { recommendations(sort: RATING_DESC, perPage: 25) { nodes { rating mediaRecommendation { id title { romaji english } startDate { year } coverImage { medium large } genres averageScore status volumes format description(asHtml: false) } } } } }';
            const json = await eseguireRichiestaAniList_(gql, { id: anilistId });
            const nodes = ((((json.data || {}).Media || {}).recommendations || {}).nodes) || [];
            return nodes.map(function(n) {
                const m = n.mediaRecommendation || {};
                const t = m.title || {};
                return {
                    id: m.id,
                    titolo: t.english || t.romaji || 'Senza titolo',
                    titoloAlt: t.romaji || '',
                    anno: (m.startDate && m.startDate.year) ? m.startDate.year : '',
                    voto: (typeof m.averageScore === 'number' && m.averageScore > 0) ? Math.round(m.averageScore) / 10 : null,
                    immagine: (m.coverImage && (m.coverImage.large || m.coverImage.medium)) || '',
                    generi: Array.isArray(m.genres) ? m.genres.join(', ') : '',
                    stato: statoMangaSugg_(m.status),
                    volumi: (typeof m.volumes === 'number' && m.volumes > 0) ? m.volumes : null,
                    trama: pulisciTramaAniList_(m.description || '')
                };
            }).filter(function(c) { return c.id; });
        }

        async function suggManga_(titolo) {
            const item = (mangaList || []).find(function(x) { return x && x.titolo === titolo; });
            if (!item) return;
            showToast('Cerco suggerimenti…');
            try {
                const anilistId = await collegaMangaAniList_(item);
                if (!anilistId) return; // scelta annullata
                const possedutiC = [];
                const possedutiId = {};
                (mangaList || []).forEach(function(x) {
                    if (!x) return;
                    if (x.titolo) possedutiC.push(compattaTitoloSugg_(x.titolo));
                    if (x.anilistId) possedutiId[x.anilistId] = true;
                });
                possedutiId[anilistId] = true;
                const tutti = await getSuggManga_(anilistId);
                let edizioni = {};
                try {
                    edizioni = await edizioniItalianeManga_(tutti.map(function(c) { return c.id; }));
                } catch (errIt) {
                    console.error('Verifica edizioni italiane non riuscita: ' + errIt);
                    showToast('Non riesco a verificare le edizioni italiane: li mostro tutti come non confermati.', 'error');
                }
                const nuovi = tutti.filter(function(c) {
                    if (possedutiId[c.id]) return false;
                    const ed = edizioni[c.id];
                    return !titoloGiaPosseduto_([c.titolo, c.titoloAlt, ed ? ed.titoloIt : ''], possedutiC);
                });
                nuovi.forEach(function(c) { c.edizione = edizioni[c.id] || null; });
                const confermati = nuovi.filter(function(c) { return c.edizione; }).slice(0, 10);
                const altri = nuovi.filter(function(c) { return !c.edizione; });
                mostraSuggMangaOverlay_(item.titolo, confermati, altri);
            } catch (err) {
                showToast(err.message || 'Suggerimenti non disponibili.', 'error');
            }
        }

        window.suggManga_ = suggManga_;

        function cardSuggManga_(c, indice) {
            const imgFull = c.immagine || '';
            const img = c.immagine
                ? '<img src="' + escapeHtmlSugg_(c.immagine) + '" alt="" style="width:45px;height:65px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--border-color);cursor:zoom-in;" loading="lazy" onclick="apriLightbox(\'' + escapeHtmlSugg_(imgFull).replace(/'/g, "\\'") + '\')">'
                : '<div style="width:45px;height:65px;border-radius:6px;flex-shrink:0;border:1px solid var(--border-color);"></div>';
            const ed = c.edizione;
            const titoloIt = ed && ed.titoloIt ? ed.titoloIt : '';
            const principale = titoloIt || c.titolo;
            const originale = (titoloIt && compattaTitoloSugg_(titoloIt) !== compattaTitoloSugg_(c.titolo)) ? c.titolo : '';
            const rigaItalia = ed
                ? '<div style="font-size:12px;color:var(--success);font-weight:600;">📚 In Italia: ' + escapeHtmlSugg_(ed.editore) + (ed.volumi ? ' · ' + ed.volumi + (ed.volumi === 1 ? ' volume' : ' volumi') + ' in italiano' : '') + '</div>'
                : '<div style="font-size:12px;opacity:0.6;">Edizione italiana non confermata</div>';
            const meta = [c.anno || '', c.stato ? c.stato + ' in Giappone' : '', c.generi || '', (c.voto !== null && c.voto !== undefined) ? '⭐ ' + c.voto : ''].filter(Boolean).join(' · ');
            const titoloPerAdd = String(principale).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const addBtn = '<button class="action-icon-btn" style="flex-shrink:0;color:var(--primary);font-size:16px;font-weight:700;" onclick="suggAggiungiManga_(' + c.id + ', \'' + escapeHtmlSugg_(titoloPerAdd) + '\')" title="Aggiungi con tutti i dati">＋</button>';
            return '<div style="display:flex;gap:12px;align-items:flex-start;">' + img +
                '<div style="min-width:0;flex:1;"><div style="font-weight:600;">' + escapeHtmlSugg_(principale) + '</div>' +
                (originale ? '<div style="font-size:11px;opacity:0.6;">' + escapeHtmlSugg_(originale) + '</div>' : '') +
                rigaItalia +
                '<div style="font-size:12px;opacity:0.7;">' + escapeHtmlSugg_(meta) + '</div>' +
                '<div id="suggMangaTrama' + indice + '" class="sugg-trama" title="Clicca per espandere/comprimere" onclick="this.classList.toggle(\'trama-aperta\')" style="font-size:12px;opacity:0.85;margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;"></div></div>' + addBtn + '</div>';
        }

        function mostraSuggMangaOverlay_(titoloBase, confermati, altri) {
            mostraSuggOverlay_(titoloBase, [], 'manga');
            const gen = suggGen_;
            const lista = document.getElementById('suggOverlayLista');
            let html = '';
            if (confermati.length === 0) {
                html += '<p style="font-size:13px;opacity:0.75;margin:0;">Nessun suggerimento risulta pubblicato in Italia.</p>';
            } else {
                html += confermati.map(function(c, i) { return cardSuggManga_(c, i); }).join('');
            }
            if (altri.length > 0) {
                html += '<details id="suggMangaAltri" style="border-top:1px solid var(--border-color);padding-top:8px;">' +
                    '<summary style="cursor:pointer;font-size:13px;opacity:0.85;">Altri ' + altri.length + ' non confermati in Italia (Wikipedia non conosce un\'edizione italiana: potrebbero comunque esserci)</summary>' +
                    '<div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">' +
                    altri.map(function(c, i) { return cardSuggManga_(c, confermati.length + i); }).join('') + '</div></details>';
            }
            lista.innerHTML = html;
            const trame = confermati.concat(altri);
            const traduci = function(da, a) {
                trame.slice(da, a).forEach(function(c, k) {
                    const i = da + k;
                    const el = document.getElementById('suggMangaTrama' + i);
                    if (!el || !c.trama) return;
                    el.textContent = c.trama;
                    if (c.trama.length > 40 && !c._tradotta) {
                        c._tradotta = true;
                        traduciLungoSugg_(c.trama).then(function(t) {
                            if (gen !== suggGen_) return;
                            const e2 = document.getElementById('suggMangaTrama' + i);
                            if (e2 && t) e2.textContent = t;
                        }).catch(function() {});
                    }
                });
            };
            traduci(0, confermati.length);
            const dettagli = document.getElementById('suggMangaAltri');
            if (dettagli) dettagli.addEventListener('toggle', function() { if (dettagli.open) traduci(confermati.length, trame.length); });
        }

        // ＋ da un suggerimento manga (Richiesta 61): apre Nuovo Manga e lo
        // compila con l'import AniList di sempre (copertina, trama tradotta,
        // generi, volumi, stato), con il titolo italiano e il collegamento.
        function suggAggiungiManga_(anilistId, titoloIt) {
            chiudiSuggOverlay();
            const btn = document.getElementById('btnNuovoManga');
            if (btn) btn.click();
            const inp = document.getElementById('inpTitoloManga');
            if (inp) inp.value = titoloIt || '';
            if (!anilistId) return;
            mostraOverlayAniList_();
            document.getElementById('anilistTitle').innerText = '🔎 ' + (titoloIt || 'Manga suggerito');
            document.getElementById('anilistBody').innerHTML = '<span style="color: var(--accent, #ff5da2); font-weight: 600; display: inline-block; animation: pulse 1.5s infinite;">⏳ Recupero dati e traduzione in corso...</span>';
            getDettaglioTraduzioneAniListSB_(anilistId)
                .then(function(d) {
                    if (titoloIt) d.titolo = titoloIt;
                    renderDettaglioAniList_('manga', d);
                })
                .catch(function(err) { renderErroreAniList_(err); });
        }

        window.suggAggiungiManga_ = suggAggiungiManga_;

        // Traduzione a pezzi (il traduttore gratis taglia i testi lunghi):
        // spezza a fine frase sotto i 900 caratteri e ricuce.
        async function traduciLungoSugg_(testo) {
            const pezzi = [];
            let resto = String(testo || '');
            while (resto.length > 900) {
                let taglio = resto.lastIndexOf('. ', 900);
                if (taglio < 300) taglio = 900;
                pezzi.push(resto.substring(0, taglio + 1));
                resto = resto.substring(taglio + 1).trim();
            }
            if (resto) pezzi.push(resto);
            const tradotti = [];
            for (let i = 0; i < pezzi.length; i++) {
                tradotti.push(await tradurreTestoGoogleFree_(pezzi[i], 'en', 'it'));
            }
            return tradotti.join(' ');
        }

        function renderListAnime() {
            const tbody = document.getElementById('animeTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            
            let animeVistiCount = 0;
            let animeTotaliCount = 0;
            let stagioniVisteTotali = 0;
            let stagioniTotaliGlobali = 0;
            let filmVistiTotali = 0;
            let filmTotaliGlobali = 0;
            animeList.forEach(item => {
                if (!item) return;
                animeTotaliCount++;
                const sVis = parseInt(item.stagioniViste) || 0;
                const sTot = parseInt(item.stagioniTotali) || 0;
                const fVis = parseInt(item.filmVisti) || 0;
                const fTot = parseInt(item.filmTotali) || 0;

                stagioniVisteTotali += sVis;
                stagioniTotaliGlobali += sTot;
                filmVistiTotali += fVis;
                filmTotaliGlobali += fTot;

                if (sVis > 0 || fVis > 0) {
                    animeVistiCount++;
                }
            });
            document.getElementById('statAnimeVisti').innerText = `${animeVistiCount} / ${animeTotaliCount}`;
            document.getElementById('statStagioniViste').innerText = `${stagioniVisteTotali} / ${stagioniTotaliGlobali}`;
            document.getElementById('statFilmVisti').innerText = `${filmVistiTotali} / ${filmTotaliGlobali}`;

            // NUOVO: contatore globale episodi visti / episodi totali (da episodiAnimeList)
            let episodiVistiGlobali = 0;
            let episodiTotaliGlobali = 0;
            episodiAnimeList.forEach(ep => {
                episodiVistiGlobali += parseInt(ep.episodiVisti) || 0;
                episodiTotaliGlobali += parseInt(ep.episodiTotali) || 0;
            });
            const statEpEl = document.getElementById('statEpisodiVisti');
            if (statEpEl) statEpEl.innerText = `${episodiVistiGlobali} / ${episodiTotaliGlobali}`;
            
            const votoMinVal = document.getElementById('numFilterAnimeVotoMin').value;
            const stagioniExactVal = document.getElementById('numFilterAnimeStagioniEsatte').value;
            
            let filtered = animeList.filter(item => {
                if (!item) return false;
                
				const titoloOriginale = item.titolo || '';
				// Cerca sia nel titolo che nelle note (gestendo eventuali note vuote)
				let notaTestoAnime = "";
				if (item.note && typeof item.note === "string") {
					notaTestoAnime = item.note.toLowerCase();
				} else if (item.note) {
					notaTestoAnime = String(item.note).toLowerCase();
				}
				
				// Convertiamo in minuscolo anche il testo cercato dall'utente per renderlo case-insensitive
				const termineRicerca = (currentSearchAnime || '').toLowerCase();
				const matchesSearch = (item.titolo || '').toLowerCase().includes(termineRicerca) || notaTestoAnime.includes(termineRicerca);
                
                const statoOriginale = item.stato || 'In corso';
                const statoClean = statoOriginale.trim().toLowerCase();
                let matchesStato = false;
                if (currentFilterStatoAnime === 'all') {
                    matchesStato = true;
                } else if (currentFilterStatoAnime === 'Altro') {
                    matchesStato = (statoClean !== 'in corso' && statoClean !== 'concluso');
                } else {
                    matchesStato = (statoClean === currentFilterStatoAnime.toLowerCase());
                }
                
                const stagioniTotali = parseInt(item.stagioniTotali) || 0;
                const stagioniViste = parseInt(item.stagioniViste) || 0;
                const filmTotali = parseInt(item.filmTotali) || 0;
                const filmVisti = parseInt(item.filmVisti) || 0;
                
                let coloreVisione = 'bianco';

					const completato =
						stagioniViste === stagioniTotali &&
						filmVisti === filmTotali;
					
					const iniziato =
						stagioniViste > 0 ||
						filmVisti > 0 ||
						haProgressoEpisodiParziale(item.titolo);
					
					if (!iniziato) {
					
						coloreVisione = 'bianco';
					
					} else if (!completato) {
					
						coloreVisione = 'celeste';
					
					} else {
					
					if (statoClean === 'concluso') {
						coloreVisione = 'verde';
					} else {
						coloreVisione = 'giallo';
					}
				}
                if (item.abbandonata) coloreVisione = 'rosso';

                const matchesVisione = (currentFilterVisioneAnime === 'all' || coloreVisione === currentFilterVisioneAnime);
                let matchesVoto = true;
                if (votoMinVal !== '') {
                    const itemVoto = parseFloat(item.valutazione);
                    if (isNaN(itemVoto)) matchesVoto = false; 
                    else matchesVoto = itemVoto >= parseFloat(votoMinVal);
                }
                
                let matchesStagioni = true;
                if (stagioniExactVal !== '') {
                    matchesStagioni = (stagioniTotali === parseInt(stagioniExactVal));
                }

                // COMBO DI FILTRAGGIO GENRE AVANZATO (Logica AND)
                let matchesGenres = true;
                if (selectedGenresAnime.length > 0) {
                    const itemGenres = item.generi ? item.generi.split(',').map(g => g.trim()) : [];
                    matchesGenres = selectedGenresAnime.every(g => itemGenres.includes(g));
                }
                
                // Controllo filtro preferiti Anime
                let matchesFav = true;
                if (typeof currentFavFilterAnime !== 'undefined' && currentFavFilterAnime === 'yes') {
                    matchesFav = (item.preferito === true);
                }
                
                return matchesSearch && matchesStato && matchesVisione && matchesVoto && matchesStagioni && matchesGenres && matchesFav;
            });

            const countAnimeEl = document.getElementById('countAnime');
            if (countAnimeEl) countAnimeEl.textContent = filtered.length + ' di ' + animeList.length + ' anime';

            const sortVal = document.getElementById('sortSelAnime').value;
            filtered.sort((a, b) => {
                // NUOVO: le opere contrassegnate come prioritarie (📌) vengono sempre
                // mostrate per prime, indipendentemente dal criterio di ordinamento scelto
                const pA = a.priorita ? 1 : 0;
                const pB = b.priorita ? 1 : 0;
                if (pA !== pB) return pB - pA;

                const tA = a.titolo || '';
                const tB = b.titolo || '';
                if (sortVal === 'title-asc') return tA.localeCompare(tB);
                if (sortVal === 'title-desc') return tB.localeCompare(tA);
                if (sortVal === 'rating-desc') {
                    const rA = parseFloat(a.valutazione) || 0;
                    const rB = parseFloat(b.valutazione) || 0;
                    return rB - rA;
                }
                return tA.localeCompare(tB); // Fallback: alfabetico
            });
            filtered.forEach(item => {
                const tr = document.createElement('tr');
                const statoOriginale = item.stato || '';
                const statoClean = statoOriginale.trim().toLowerCase();
                let statusClass = 'status-altro-anime';
                if (statoClean === 'in corso') statusClass = 'status-in-corso';
                else if (statoClean === 'concluso') statusClass = 'status-concluso';
                
                const stagioniTotali = parseInt(item.stagioniTotali) || 0;
                const stagioniViste = parseInt(item.stagioniViste) || 0;
                const filmTotali = parseInt(item.filmTotali) || 0;
                const filmVisti = parseInt(item.filmVisti) || 0;
                
              let coloreVisione = 'bianco';

				const completato =
					stagioniViste === stagioniTotali &&
					filmVisti === filmTotali;
				
				const iniziato =
					stagioniViste > 0 ||
					filmVisti > 0 ||
					haProgressoEpisodiParziale(item.titolo);
				
				if (!iniziato) {
				
					coloreVisione = 'bianco';
				
				} else if (!completato) {
				
					coloreVisione = 'celeste';
				
				} else {
				
					if (statoClean === 'concluso') {
						coloreVisione = 'verde';
					} else {
						coloreVisione = 'giallo';
					}
				
				}
                if (item.abbandonata) coloreVisione = 'rosso';
                
                const safeTitle = (item.titolo || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                
                // Renderizzazione Generi sotto alle informazioni stagioni/film
                let genresHTML = '';
                if (item.generi && item.generi.trim() !== '') {
                    genresHTML = `<div class="genre-tags-list" style="color: var(--primary);">🎭 ${item.generi}</div>`;
                }

                // Cella Voto: pill "Vota" che apre l'overlay griglia; se già votato
                // mostra il voto e apre la modale di modifica (unica via di modifica).
                const haVotoGiaAssegnato = item.valutazione !== undefined && item.valutazione !== null &&
                    String(item.valutazione).trim() !== '' && item.valutazione !== '-';
                const votoCellHTML = haVotoGiaAssegnato
                    ? `<button class="action-icon-btn" style="font-weight:bold; color:var(--primary); font-size:15px;" onclick="apriModificaAnime('${safeTitle}')" title="Modifica voto dalla scheda">${item.valutazione}</button>`
                    : `<button class="filter-btn active" style="font-size:12px; border-radius:999px;" onclick="apriVotoAnime('${safeTitle}')" title="Assegna voto">Vota</button>`;

                // Definizione dinamica di classe e icona della stella per l'Anime
                const starClass = item.preferito ? 'action-icon-btn is-favorite' : 'action-icon-btn';
                const starIcon = item.preferito ? '★' : '☆';

                // NUOVO: Definizione dinamica di classe e titolo per il pin di priorità (📌)
                const pinClass = item.priorita ? 'pin-btn is-priority' : 'pin-btn';
                const pinTitle = item.priorita ? 'Rimuovi dalle priorità' : 'Contrassegna come prioritario';

                // --- GESTIONE COSTRUZIONE AVATAR MODIFICATA CON EFFETTO ZOOM E LIGHTBOX ---
                let avatarHTML = '';
                if (item.immagine && item.immagine.trim() !== '') {
                    const safeImgUrl = item.immagine.trim().replace(/'/g, "\\'");
                    avatarHTML = `<img src="${safeImgUrl}" style="width: 45px; height: 45px; border-radius: 6px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border-color); cursor: zoom-in;" alt="Avatar" onclick="apriLightbox('${safeImgUrl}')">`;
                } else {
                    avatarHTML = `<div style="width: 45px; height: 45px; flex-shrink: 0;"></div>`;
                }

                // data-label, classi td-*/ordine-*/solo-schede: servono alle schede su telefono
                // (Richiesta 48, css "LISTE A SCHEDE"); su PC le celle Stagioni e Film restano nascoste.
                const noteVuoteClass = (item.note && String(item.note).trim() !== '') ? '' : ' td-vuota';
                tr.innerHTML = `
                    <td class="media-title td-titolo">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <button class="${starClass}" style="color: var(--warning); font-size: 16px; flex-shrink: 0;" onclick="toggleFavoriteAnime('${safeTitle}', this)">${starIcon}</button>
                            <button class="${pinClass}" onclick="togglePinAnime('${safeTitle}', this, event)" title="${pinTitle}">📌</button>
                            
                            ${avatarHTML}
                            
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                    <span>${item.titolo || 'Senza Titolo'}</span>
                                </div>
                                <div style="font-size: 12px; color: var(--text-muted); font-weight: normal;">
                                    <span class="stagioni-titolo">Stagioni: <b>${stagioniViste}/${stagioniTotali}</b> | Film: <b>${filmVisti}/${filmTotali}</b></span>${item.abbandonata ? ' <span style="color:#f87171; font-weight:700;">⛔ Abbandonato</span>' : ''}
                                </div>
                                ${genresHTML}
                            </div>
                        </div>
                    </td>
                    <td class="solo-schede" style="font-weight: 700;" data-label="Stagioni">${stagioniViste}/${stagioniTotali}</td>
                    <td class="solo-schede" style="font-weight: 700;" data-label="Film">${filmVisti}/${filmTotali}</td>
                    <td class="ordine-2" data-label="Stato prod."><span class="status-badge ${statusClass}">${item.stato || '-'}</span></td>
                    <td class="td-note${noteVuoteClass}" style="color:var(--text-muted); font-size:13px;" data-label="Note personali">${item.note || '-'}</td>
                    <td class="ordine-3" style="text-align: center; font-weight: bold; color:var(--primary); font-size:15px;" data-label="Voto">${votoCellHTML}</td>
                    <td class="ordine-1" style="text-align: center;" data-label="Visione">
                        <span class="vision-box box-${coloreVisione}"></span>
                    </td>
                    <td class="td-azioni" style="text-align: center;">
                        <span class="azioni-griglia" style="display:inline-grid;grid-template-columns:repeat(3,max-content);gap:2px;justify-items:center;justify-content:center;"><button class="action-icon-btn info-azioni" onclick="mostraSinossi('${safeTitle}', 'anime')" title="Visualizza Sinossi">ℹ️</button>
                        <button class="action-icon-btn" onclick="apriGestioneEpisodi('${safeTitle}')" title="Gestisci Episodi">📺</button>
                        <button class="action-icon-btn" onclick="suggAnime_('${safeTitle}')" title="Potrebbero piacerti anche">💡</button>
                        <button class="action-icon-btn" style="${item.abbandonata ? '' : 'opacity:0.45;'}" onclick="toggleAbbandonataAnime('${safeTitle}')" title="${item.abbandonata ? 'Riprendi l\'anime' : 'Abbandona l\'anime'}">⛔</button>
                        <button class="action-icon-btn btn-modifica" onclick="apriModificaAnime('${safeTitle}')">✏️</button>
                        <button class="action-icon-btn btn-elimina" onclick="rimuoviAnime('${safeTitle}')">🗑️</button></span>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
		
		// Gestione del consiglio casuale (Dice Button)
        document.getElementById('btnNuovoAnime').onclick = function() {
            targetEditTitleAnime = null;
            sinossiPendenteAnime = null; // <--- NUOVO: azzera eventuale sinossi AniList in sospeso
            episodiPerStagionePendenteAnime = null;
            anilistIdPendenteAnime = null; // Richiesta 62
            document.getElementById('modalTitleAnime').innerText = "Nuovo Anime";
            document.getElementById('animeForm').reset();
            document.getElementById('inpStagioniTotaliAnime').value = 0;
            document.getElementById('inpStagioniVisteAnime').value = 0;
            document.getElementById('inpFilmTotaliAnime').value = 0;
            document.getElementById('inpFilmVistiAnime').value = 0;
            document.getElementById('inpImmagineAnime').value = ''; // <--- NUOVO: Svuota campo immagine
            document.getElementById('inpGiaVistoAnime').checked = false;
            document.getElementById('inpAbbandonataAnime').checked = false;
            document.getElementById('inpAbbandonataAnime').disabled = false;
            // Uncheck tutti i checkbox generi anime
            document.querySelectorAll('input[name="anime_genres_cb"]').forEach(cb => cb.checked = false);
            document.getElementById('modalOverlayAnime').classList.add('active');
        };

        window.apriModificaAnime = function(titolo) {
            const item = animeList.find(a => a.titolo === titolo);
            if (!item) return;
            
            targetEditTitleAnime = titolo;
            sinossiPendenteAnime = null; // <--- NUOVO: azzera eventuale sinossi AniList in sospeso
            episodiPerStagionePendenteAnime = null;
            anilistIdPendenteAnime = null; // Richiesta 62
            document.getElementById('modalTitleAnime').innerText = "Modifica Anime";
            document.getElementById('inpTitoloAnime').value = item.titolo || '';
            document.getElementById('inpStatoAnime').value = item.stato || '';
            document.getElementById('inpStagioniTotaliAnime').value = item.stagioniTotali || 0;
            document.getElementById('inpStagioniVisteAnime').value = item.stagioniViste || 0;
            document.getElementById('inpFilmTotaliAnime').value = item.filmTotali || 0;
            document.getElementById('inpFilmVistiAnime').value = item.filmVisti || 0;
            document.getElementById('inpNoteAnime').value = item.note || '';
            document.getElementById('inpValutazioneAnime').value = item.valutazione || '';
            document.getElementById('inpImmagineAnime').value = item.immagine || ''; // <--- NUOVO: Carica l'immagine esistente
            // In modifica il flag nasce spuntato se l'anime è già tutto visto
            // (stagioni e film in pari), così riflette la situazione reale.
            const giaTuttoVistoAnime = ((parseInt(item.stagioniTotali) || 0) + (parseInt(item.filmTotali) || 0)) > 0 &&
                (parseInt(item.stagioniViste) || 0) >= (parseInt(item.stagioniTotali) || 0) &&
                (parseInt(item.filmVisti) || 0) >= (parseInt(item.filmTotali) || 0);
            document.getElementById('inpGiaVistoAnime').checked = giaTuttoVistoAnime;
            // Anime verde (finito davvero): abbandonarlo non ha senso.
            document.getElementById('inpAbbandonataAnime').checked = !!item.abbandonata;
            const eAnimeVerde = giaTuttoVistoAnime && String(item.stato || '').trim().toLowerCase().includes('conclus');
            document.getElementById('inpAbbandonataAnime').disabled = eAnimeVerde;
            
            // Ripristina la selezione dei checkbox generi anime
            document.querySelectorAll('input[name="anime_genres_cb"]').forEach(cb => {
                cb.checked = false;
                if (item.generi) {
                    const splitGeneri = item.generi.split(',').map(g => g.trim());
                    if (splitGeneri.includes(cb.value)) cb.checked = true;
                }
            });

            document.getElementById('modalOverlayAnime').classList.add('active');
        };

        // "Già visto" e "Abbandonato" si escludono a vicenda.
        document.getElementById('inpGiaVistoAnime').onchange = function() {
            if (this.checked) document.getElementById('inpAbbandonataAnime').checked = false;
        };
        document.getElementById('inpAbbandonataAnime').onchange = function() {
            if (this.checked) document.getElementById('inpGiaVistoAnime').checked = false;
        };

        document.getElementById('animeForm').onsubmit = function(e) {
            e.preventDefault();
            document.getElementById('btnSalvaAnime').innerText = "Salvataggio...";
            
            // Raccoglie i generi spuntati
            const selectedGenres = Array.from(document.querySelectorAll('input[name="anime_genres_cb"]:checked'))
                                        .map(cb => cb.value)
                                        .join(', ');

            const sTot = parseInt(document.getElementById('inpStagioniTotaliAnime').value) || 0;
            let sVis = parseInt(document.getElementById('inpStagioniVisteAnime').value) || 0;
            const fTot = parseInt(document.getElementById('inpFilmTotaliAnime').value) || 0;
            let fVis = parseInt(document.getElementById('inpFilmVistiAnime').value) || 0;
			if (sVis > sTot) {
				alert("❌ Le stagioni viste non possono superare le stagioni totali.");
				document.getElementById('btnSalvaAnime').innerText = "Salva";
				return;
			}
			
			if (fVis > fTot) {
				alert("❌ I film visti non possono superare i film totali.");
				document.getElementById('btnSalvaAnime').innerText = "Salva";
				return;
			}

            // Flag "📺 Anime già visto per intero": stesso ragionamento delle
            // Serie TV, valutato prima del salvataggio perché può interromperlo.
            // Porta viste = totali e marca le righe episodi via segnaComeVista
            // (solo quelle con totale noto, come per le serie).
            const flagGiaVistoAnime = document.getElementById('inpGiaVistoAnime').checked;
            const isEditAnimeFlag = !!targetEditTitleAnime;
            let segnaComeVistaAnime = false;
            if (flagGiaVistoAnime) {
                if (sTot + fTot <= 0) {
                    alert('❌ Con "Anime già visto" devi indicare almeno 1 stagione o 1 film totale.');
                    document.getElementById('btnSalvaAnime').innerText = "Salva";
                    return;
                }
                const itemCorrenteAnime = isEditAnimeFlag ? animeList.find(a => a.titolo === targetEditTitleAnime) : null;
                const giaTuttoVisto = !!(itemCorrenteAnime &&
                    ((parseInt(itemCorrenteAnime.stagioniTotali) || 0) + (parseInt(itemCorrenteAnime.filmTotali) || 0)) > 0 &&
                    (parseInt(itemCorrenteAnime.stagioniViste) || 0) >= (parseInt(itemCorrenteAnime.stagioniTotali) || 0) &&
                    (parseInt(itemCorrenteAnime.filmVisti) || 0) >= (parseInt(itemCorrenteAnime.filmTotali) || 0));
                if (!(isEditAnimeFlag && giaTuttoVisto)) {
                    const okVista = confirm('Segno "' + document.getElementById('inpTitoloAnime').value.trim() + '" come visto per intero: ' + sTot + ' stagioni e ' + fTot + ' film, tutti gli episodi con totale noto.\n\nProcedo con il salvataggio?');
                    if (!okVista) {
                        document.getElementById('btnSalvaAnime').innerText = "Salva";
                        return;
                    }
                }
                sVis = sTot;
                fVis = fTot;
                segnaComeVistaAnime = true;
            }

            // Flag "⛔ Anime abbandonato": congela l'anime (flag rosso, fuori
            // dal widget In Corso). Conferma solo sulla transizione, non a ogni
            // salvataggio. Prevale su "già visto".
            const flagAbbandonataAnime = document.getElementById('inpAbbandonataAnime').checked;
            const itemCorrenteAbbAnime = isEditAnimeFlag ? animeList.find(a => a.titolo === targetEditTitleAnime) : null;
            const eraAbbandonataAnime = !!(itemCorrenteAbbAnime && itemCorrenteAbbAnime.abbandonata);
            let abbandonataNuovaAnime = false;
            if (flagAbbandonataAnime) {
                if (!eraAbbandonataAnime) {
                    const okAbbandonoAnime = confirm('Segno "' + document.getElementById('inpTitoloAnime').value.trim() + '" come abbandonato: uscirà dal widget "In Corso", il flag visione diventerà rosso e il progresso resterà congelato. Potrai riprenderlo quando vuoi.\n\nProcedo con il salvataggio?');
                    if (!okAbbandonoAnime) {
                        document.getElementById('btnSalvaAnime').innerText = "Salva";
                        return;
                    }
                }
                abbandonataNuovaAnime = true;
                segnaComeVistaAnime = false;
            }
            const stOriginale = document.getElementById('inpStatoAnime').value || 'In corso';
            const stClean = stOriginale.trim().toLowerCase();

            // Calcolo del coloreVisione mancante
            let colVisione = 'bianco';

			const completato =
				sVis === sTot &&
				fVis === fTot;
			
			const iniziato =
				sVis > 0 ||
				fVis > 0 ||
				haProgressoEpisodiParziale(document.getElementById('inpTitoloAnime').value);
			
			if (!iniziato) {
			
				colVisione = 'bianco';
			
			} else if (!completato) {
			
				colVisione = 'celeste';
			
			} else {
			
				if (stClean === 'concluso') {
					colVisione = 'verde';
				} else {
					colVisione = 'giallo';
				}
			
			}

                        const dati = {
                titolo: document.getElementById('inpTitoloAnime').value,
                stato: stOriginale,
                note: document.getElementById('inpNoteAnime').value,
                valutazione: document.getElementById('inpValutazioneAnime').value,
                stagioniTotali: sTot,
                stagioniViste: sVis,
                filmTotali: fTot,
                filmVisti: fVis,
                coloreVisione: colVisione,
                generi: selectedGenres,
                immagine: document.getElementById('inpImmagineAnime').value, // <--- NUOVO: Salva l'URL dell'immagine nel foglio
                episodiPerStagione: episodiPerStagionePendenteAnime,
                segnaComeVista: segnaComeVistaAnime,
                abbandonata: abbandonataNuovaAnime,
                anilistId: anilistIdPendenteAnime // Richiesta 62: opera AniList scelta con 🔎 o dal ＋ dei suggerimenti
            };
            const isEditAnime = !!targetEditTitleAnime;
            const cb = function(data) {
                animeList = data || [];
                episodiPerStagionePendenteAnime = null;
                anilistIdPendenteAnime = null;
                // Se in questa sessione del modale è stata scelta una sinossi da AniList,
                // la scriviamo ora sul foglio satellite: a questo punto la riga in SinossiAnime
                // esiste di sicuro (creata da addAnime, o già presente in caso di modifica).
                if (sinossiPendenteAnime) {
                    impostaSinossiSB_(dati.titolo, 'anime', sinossiPendenteAnime)
                        .catch(function(err) {
                            console.error('Errore salvataggio sinossi AniList: ' + err);
                            showToast('Opera salvata, ma la sinossi AniList non è stata scritta. Riprova dal pulsante 🔎.', 'error');
                        });
                    sinossiPendenteAnime = null;
                }
                document.getElementById('btnSalvaAnime').innerText = "Salva";
                chiudiModale('Anime');
                // Ricarica anche gli episodi: le righe stagioni/film sono
                // cambiate (stesso schema del salvataggio Serie TV). Senza
                // questo l'overlay appena creato risultava vuoto fino al
                // refresh manuale della pagina.
                getTuttiEpisodiAnimeSB_().then(function(epData) {
                    episodiAnimeList = epData || [];
                    renderListAnime();
                }).catch(function() { renderListAnime(); });
                showToast(isEditAnime ? 'Anime aggiornato con successo' : 'Anime aggiunto con successo', 'success');
            };
            const errorCb = function(err) {
                alert("❌ Errore durante il salvataggio Anime: " + err.message);
                document.getElementById('btnSalvaAnime').innerText = "Salva";
            };
            
                        if (targetEditTitleAnime) {
                updateAnimeSB_(targetEditTitleAnime, dati).then(cb).catch(errorCb);
            } else {
                addAnimeSB_(dati).then(cb).catch(errorCb);
            }
        };

        window.rimuoviAnime = function(titolo) {
            if (confirm("Eliminare definitivamente '" + titolo + "'?")) {
                deleteAnimeSB_(titolo).then(function(data) {
                    animeList = data || [];
                    return getTuttiEpisodiAnimeSB_();
                }).then(function(epData) {
                    episodiAnimeList = epData || [];
                    renderListAnime();
                    showToast('Anime eliminato', 'success');
                }).catch(function(err) {
                    console.error('Errore eliminazione anime:', err);
                    alert("❌ Errore durante l'eliminazione.");
                });
            }
        };

        // ==========================================
        //        GESTIONE EPISODI ANIME (Overlay)
        // ==========================================
        let episodiOverlayTitoloCorrente = null;

        // Il secondo parametro (facoltativo) viene passato solo dalle card del
        // widget "In Corso" della Home: in quel caso di fianco all'elenco delle
        // stagioni si vede la copertina dell'opera e l'overlay si allarga un po'.
        // Aperto dall'icona 📺 della vista Anime resta identico a prima.
        window.apriGestioneEpisodi = function(titolo, mostraCopertina) {
            episodiOverlayTitoloCorrente = titolo;
            document.getElementById('episodiModalTitle').innerText = '📺 Episodi — ' + titolo;

            let conCopertina = false;
            if (mostraCopertina) {
                const anime = (animeList || []).find(x => (x.titolo || '').trim() === String(titolo).trim());
                conCopertina = renderCopertinaOverlay('episodiCopertina', anime);
            } else {
                nascondiCopertinaOverlay('episodiCopertina');
            }

            // L'overlay si allarga solo se la copertina c'è davvero: senza
            // immagine resta della larghezza di sempre.
            const modaleEl = document.querySelector('#modalOverlayEpisodi .modal');
            if (modaleEl) modaleEl.style.maxWidth = conCopertina ? '640px' : '560px';

            renderEpisodiOverlay();
            document.getElementById('modalOverlayEpisodi').classList.add('active');
        };

        window.chiudiModaleEpisodi = function() {
            document.getElementById('modalOverlayEpisodi').classList.remove('active');
            episodiOverlayTitoloCorrente = null;
        };

        function renderEpisodiOverlay() {
            const container = document.getElementById('episodiListContainer');
            if (!container || !episodiOverlayTitoloCorrente) return;

            const safeTitle = episodiOverlayTitoloCorrente.replace(/'/g, "\\'").replace(/"/g, '\\"');
            const righe = episodiAnimeList
                .filter(ep => (ep.titolo || '').trim() === episodiOverlayTitoloCorrente.trim())
                .slice()
                .sort((a, b) => {
                    if (a.tipo !== b.tipo) return a.tipo === 'Stagione' ? -1 : 1;
                    return a.numero - b.numero;
                });

            if (righe.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); padding: 20px 0; text-align:center;">Nessuna stagione o film registrato per questo titolo. Imposta le "Stagioni Totali" / "Film Totali" dal pulsante ✏️ per generare le righe.</p>`;
                return;
            }

            // Determina, per ciascun tipo, se la riga precedente è completa (per il vincolo sequenziale lato UI)
            let html = '';
            const stagioni = righe.filter(r => r.tipo === 'Stagione');
            const film = righe.filter(r => r.tipo === 'Film');

            // Anime abbandonato: i visti sono congelati (banner + controlli
            // disabilitati/nascosti), i totali restano modificabili con ✏️.
            const animeCorrenteOverlay = (animeList || []).find(function(x) { return (x.titolo || '').trim() === episodiOverlayTitoloCorrente.trim(); });
            const overlayCongelatoAnime = !!(animeCorrenteOverlay && animeCorrenteOverlay.abbandonata);
            if (overlayCongelatoAnime) {
                html += `<p style="color:#f87171; font-size:12.5px; font-weight:600; margin:0 0 6px 0;">⛔ Anime abbandonato: i progressi sono congelati. Riprendilo (⛔ nella lista) per modificarli — i totali restano modificabili con ✏️.</p>`;
            }

            function renderGruppo(gruppo, iconaTipo) {
                let out = '';
                gruppo.forEach((ep, idx) => {
                    const totali = parseInt(ep.episodiTotali) || 0;
                    const visti = parseInt(ep.episodiVisti) || 0;
                    const completa = totali > 0 && visti >= totali;
                    const precedente = idx > 0 ? gruppo[idx - 1] : null;
                    const precedenteCompleta = !precedente || (parseInt(precedente.episodiTotali) > 0 && parseInt(precedente.episodiVisti) >= parseInt(precedente.episodiTotali));
                    const bloccata = !precedenteCompleta;
                    const percentuale = totali > 0 ? Math.min(100, Math.round((visti / totali) * 100)) : 0;
                    const disabledMeno = (visti <= 0 || overlayCongelatoAnime) ? 'disabled' : '';
                    const disabledPiu = (bloccata || overlayCongelatoAnime || (totali > 0 && visti >= totali)) ? 'disabled' : '';

                    // ✅ = segna l'unità come tutta vista (solo se sbloccata e non
                    // già completa); 🔢 = imposta a mano gli episodi visti.
                    const btnTuttaVista = (!completa && !bloccata && !overlayCongelatoAnime)
                        ? `<button class="episodi-btn-edit" onclick="segnaUnitaComeVistaAnime('${safeTitle}', '${ep.tipo}', ${ep.numero})" title="Segna ${ep.tipo} ${ep.numero} come tutto visto">✅</button>`
                        : '';
                    const btnVistiManualAnime = overlayCongelatoAnime
                        ? ''
                        : `<button class="episodi-btn-edit" onclick="modificaVistiEpisodi('${safeTitle}', '${ep.tipo}', ${ep.numero}, ${visti}, ${totali})" title="Imposta manualmente gli episodi visti">🔢</button>`;

                    out += `
                        <div class="episodi-row ${bloccata ? 'locked' : ''}">
                            <div class="episodi-row-info">
                                <div class="episodi-row-title">${iconaTipo} ${ep.tipo} ${ep.numero} ${completa ? '✅' : (bloccata ? '🔒' : '')}
                                    <button class="episodi-btn-edit" onclick="modificaTotaleEpisodi('${safeTitle}', '${ep.tipo}', ${ep.numero}, ${totali})" title="Modifica episodi totali">✏️</button>
                                    ${btnVistiManualAnime}
                                    ${btnTuttaVista}
                                </div>
                                <div class="episodi-row-count">${visti} / ${totali} episodi</div>
                                <div class="episodi-progress-outer"><div class="episodi-progress-inner" style="width:${percentuale}%;"></div></div>
                            </div>
                            <div class="episodi-row-actions">
                                <button class="episodi-btn" ${disabledMeno} onclick="incrementaEpisodio('${safeTitle}', '${ep.tipo}', ${ep.numero}, -1)">−</button>
                                <button class="episodi-btn" ${disabledPiu} onclick="incrementaEpisodio('${safeTitle}', '${ep.tipo}', ${ep.numero}, 1)">+</button>
                            </div>
                        </div>`;
                });
                return out;
            }

            if (stagioni.length > 0) {
                html += `<div class="section-title-label" style="margin:14px 0 10px 0; font-size:12px;">Stagioni</div>`;
                html += renderGruppo(stagioni, '🎞️');
            }
            if (film.length > 0) {
                html += `<div class="section-title-label" style="margin:14px 0 10px 0; font-size:12px;">Film</div>`;
                html += renderGruppo(film, '🎬');
            }

            container.innerHTML = html;
        }

        // --- Funzioni di scrittura Episodi Anime ---

        async function registraLogEpisodioSB_(titolo, tipo, numero, episodioPrecedente, episodioNuovo, episodiTotali, azione, esito, tipoMedia) {
            try {
                await supabaseClient.from('log_episodi').insert([{
                    timestamp: new Date().toISOString(),
                    titolo: titolo || '', tipo: tipo || '', numero: parseInt(numero) || 0,
                    episodio_precedente: parseInt(episodioPrecedente) || 0,
                    episodio_nuovo: parseInt(episodioNuovo) || 0,
                    episodi_totali: parseInt(episodiTotali) || 0,
                    azione: azione || '', esito: esito || '',
                    tipo_media: tipoMedia || 'ANIME'
                }]);
            } catch (err) {
                console.error("Errore durante la registrazione del log episodio ('" + azione + "' su '" + titolo + "' " + tipo + " " + numero + "'): " + err);
            }
        }

        // senzaLogEpisodio = true per ✅/🔢 da overlay (popolamento archivio):
        // aggiorna i visti e ricalcola, ma non scrive righe nel log episodi.
        async function updateEpisodioVistiSB_(titolo, tipo, numero, delta, senzaLogEpisodio) {
            const titoloTrim = String(titolo).trim();
            const numeroInt = parseInt(numero) || 0;
            const deltaInt = parseInt(delta) || 0;

            const numeriDaLeggere = (deltaInt > 0 && numeroInt > 1) ? [numeroInt - 1, numeroInt] : [numeroInt];
            const { data: righe, error: errSel } = await supabaseClient
                .from('episodi_anime').select('numero,episodi_totali,episodi_visti')
                .eq('anime_titolo', titoloTrim).eq('tipo', tipo).in('numero', numeriDaLeggere);
            if (errSel) throw errSel;

            const rigaTarget = (righe || []).find(function(r) { return r.numero === numeroInt; });
            if (!rigaTarget) return { errore: 'Riga episodi non trovata.' };

            const episodiTotali = rigaTarget.episodi_totali;
            const episodiVistiAttuale = rigaTarget.episodi_visti;

            if (deltaInt > 0 && numeroInt > 1) {
                const rigaPrec = righe.find(function(r) { return r.numero === numeroInt - 1; });
                const rigaPrecedenteCompleta = !!(rigaPrec && rigaPrec.episodi_totali > 0 && rigaPrec.episodi_visti >= rigaPrec.episodi_totali);
                if (!rigaPrecedenteCompleta) {
                    return { errore: 'Devi prima completare ' + tipo + ' ' + (numeroInt - 1) + '.' };
                }
            }

            let nuovoValore = episodiVistiAttuale + deltaInt;
            if (nuovoValore < 0) nuovoValore = 0;
            if (episodiTotali > 0 && nuovoValore > episodiTotali) nuovoValore = episodiTotali;

            const { error: errUpd } = await supabaseClient
                .from('episodi_anime').update({ episodi_visti: nuovoValore })
                .eq('anime_titolo', titoloTrim).eq('tipo', tipo).eq('numero', numeroInt);
            if (errUpd) throw errUpd;

            const risultatoSync = await ricalcolaSincronizzaELoggaSB_(titoloTrim);

            // togliendo un episodio appena segnato per sbaglio si cancella la sua voce
            // invece di aggiungere "rimosso" (Richiesta 58)
            const episodioAnnullato = (nuovoValore < episodiVistiAttuale && !senzaLogEpisodio)
                && await annullaUltimoEpisodioSB_(titoloTrim, tipo, numeroInt, episodiVistiAttuale, nuovoValore, 'ANIME');
            if (nuovoValore !== episodiVistiAttuale && !senzaLogEpisodio && !episodioAnnullato) {
                await registraLogEpisodioSB_(
                    titoloTrim, tipo, numeroInt, episodiVistiAttuale, nuovoValore, episodiTotali,
                    (nuovoValore > episodiVistiAttuale) ? 'VISTO' : 'RIMOSSO',
                    (risultatoSync && risultatoSync.eventoLoggato) || '',
                    'ANIME'
                );
            }

            const [animeAggiornato, episodiTutti] = await Promise.all([getAnimeDataSB_(), getTuttiEpisodiAnimeSB_()]);
            return { episodiVisti: nuovoValore, episodiTotali: episodiTotali, anime: animeAggiornato, episodiTutti: episodiTutti };
        }

        async function updateEpisodioTotaliSB_(titolo, tipo, numero, nuovoTotale) {
            const titoloTrim = String(titolo).trim();
            const numeroInt = parseInt(numero) || 0;

            const { data: righeTarget, error: errSel } = await supabaseClient
                .from('episodi_anime').select('episodi_visti')
                .eq('anime_titolo', titoloTrim).eq('tipo', tipo).eq('numero', numeroInt);
            if (errSel) throw errSel;
            if (!righeTarget || righeTarget.length === 0) return { errore: 'Riga episodi non trovata.' };

            let totaleNuovo = parseInt(nuovoTotale) || 0;
            if (totaleNuovo < 0) totaleNuovo = 0;

            let episodiVistiNuovo = righeTarget[0].episodi_visti;
            if (episodiVistiNuovo > totaleNuovo) episodiVistiNuovo = totaleNuovo;

            const { error: errUpd } = await supabaseClient
                .from('episodi_anime').update({ episodi_totali: totaleNuovo, episodi_visti: episodiVistiNuovo })
                .eq('anime_titolo', titoloTrim).eq('tipo', tipo).eq('numero', numeroInt);
            if (errUpd) throw errUpd;

            await ricalcolaSincronizzaELoggaSB_(titoloTrim);

            const [animeAggiornato, episodiTutti] = await Promise.all([getAnimeDataSB_(), getTuttiEpisodiAnimeSB_()]);
            return { episodiVisti: episodiVistiNuovo, episodiTotali: totaleNuovo, anime: animeAggiornato, episodiTutti: episodiTutti };
        }
		
        window.incrementaEpisodio = function(titolo, tipo, numero, delta) {
            const colorePrimaAutoVoto = ((animeList || []).find(function(a) { return a.titolo === titolo; }) || {}).coloreVisione || null;
            updateEpisodioVistiSB_(titolo, tipo, numero, delta)
                .then(function(result) {
                    if (result && result.errore) {
                        showToast(result.errore, 'error');
                        return;
                    }
                    animeList = result.anime || animeList;
                    episodiAnimeList = result.episodiTutti || episodiAnimeList;
                    renderEpisodiOverlay();
                    renderListAnime();
                    aggiornaLogEpisodiSeVisibile();
                    if (document.getElementById('homeProgressList')) {
                        renderWidgetInCorso();
                    }
                    // Auto-voto: solo + che completa TUTTO l'anime Concluso
                    // (verde) mai votato. Niente ✅/🔢/matita, niente singole
                    // stagioni, niente modale flag.
                    if (parseInt(delta) > 0 && colorePrimaAutoVoto !== 'verde') {
                        const itemDopo = (animeList || []).find(function(a) { return a.titolo === titolo; });
                        const votoDopo = itemDopo ? itemDopo.valutazione : null;
                        const senzaVoto = votoDopo === undefined || votoDopo === null || String(votoDopo).trim() === '' || votoDopo === '-';
                        if (itemDopo && itemDopo.coloreVisione === 'verde' && senzaVoto) {
                            apriVotoAnime(titolo, true);
                        }
                    }
                })
                .catch(function(err) {
                    showToast('❌ Errore aggiornamento episodio: ' + err.message, 'error');
                });
        };

        window.modificaTotaleEpisodi = function(titolo, tipo, numero, totaleAttuale) {
            const nuovoTotaleStr = prompt(`Numero totale episodi per ${tipo} ${numero}:`, totaleAttuale);
            if (nuovoTotaleStr === null) return; // annullato
            const nuovoTotale = parseInt(nuovoTotaleStr);
            if (isNaN(nuovoTotale) || nuovoTotale < 0) {
                showToast('❌ Inserisci un numero valido', 'error');
                return;
            }
			
            updateEpisodioTotaliSB_(titolo, tipo, numero, nuovoTotale)
                .then(function(result) {
                    if (result && result.errore) {
                        showToast(result.errore, 'error');
                        return;
                    }
                    animeList = result.anime || animeList;
                    episodiAnimeList = result.episodiTutti || episodiAnimeList;
                    renderEpisodiOverlay();
                    renderListAnime();
                    showToast('Totale episodi aggiornato', 'success');
                })
                .catch(function(err) {
                    showToast('❌ Errore aggiornamento totale episodi: ' + err.message, 'error');
                });
        };

        // ✅ Segna l'unità come tutta vista in un colpo solo (es. 3 stagioni
        // già viste su 5). Delega a updateEpisodioVistiSB_ con il delta
        // mancante, così restano validi vincolo sequenziale, log e ricalcolo.
        window.segnaUnitaComeVistaAnime = function(titolo, tipo, numero) {
            const riga = (episodiAnimeList || []).find(function(e) {
                return (e.titolo || '').trim() === String(titolo).trim() && e.tipo === tipo && parseInt(e.numero) === parseInt(numero);
            });
            if (!riga) {
                showToast('❌ Riga non trovata', 'error');
                return;
            }
            const totali = parseInt(riga.episodiTotali) || 0;
            const visti = parseInt(riga.episodiVisti) || 0;
            if (totali <= 0) {
                showToast('❌ Imposta prima gli episodi totali con la matita ✏️, poi segna come vista.', 'error');
                return;
            }
            if (visti >= totali) {
                showToast('Unità già completa.', 'success');
                return;
            }
            updateEpisodioVistiSB_(titolo, tipo, numero, totali - visti, true)
                .then(function(result) {
                    if (result && result.errore) {
                        showToast(result.errore, 'error');
                        return;
                    }
                    animeList = result.anime || animeList;
                    episodiAnimeList = result.episodiTutti || episodiAnimeList;
                    if (document.getElementById('homeProgressList')) {
                        renderWidgetInCorso();
                    }
                    renderEpisodiOverlay();
                    renderListAnime();
                    aggiornaLogEpisodiSeVisibile();
                    showToast('✅ ' + tipo + ' ' + numero + ' segnata come tutta vista', 'success');
                })
                .catch(function(err) {
                    showToast('❌ Errore aggiornamento episodio: ' + err.message, 'error');
                });
        };

        // 🔢 Imposta a mano gli episodi visti (es. 450 su 800 senza premere
        // + 450 volte). Stessa delega: aumenti vincolati alla sequenza,
        // diminuzioni sempre permesse, clamp al totale come il +.
        window.modificaVistiEpisodi = function(titolo, tipo, numero, vistiAttuali, totaleAttuale) {
            const totali = parseInt(totaleAttuale) || 0;
            const intervallo = totali > 0 ? ' (0–' + totali + ')' : '';
            const nuovoVistiStr = prompt(`Episodi visti per ${tipo} ${numero}${intervallo}:`, vistiAttuali);
            if (nuovoVistiStr === null) return; // annullato
            const nuovoVisti = parseInt(nuovoVistiStr);
            if (isNaN(nuovoVisti) || nuovoVisti < 0) {
                showToast('❌ Inserisci un numero valido', 'error');
                return;
            }
            if (totali > 0 && nuovoVisti > totali) {
                showToast('❌ Il massimo per ' + tipo + ' ' + numero + ' è ' + totali + ' episodi.', 'error');
                return;
            }
            const visti = parseInt(vistiAttuali) || 0;
            if (nuovoVisti === visti) {
                showToast('Nessuna modifica.', 'success');
                return;
            }
            updateEpisodioVistiSB_(titolo, tipo, numero, nuovoVisti - visti, true)
                .then(function(result) {
                    if (result && result.errore) {
                        showToast(result.errore, 'error');
                        return;
                    if (document.getElementById('homeProgressList')) {
                        renderWidgetInCorso();
                    }
                    }
                    animeList = result.anime || animeList;
                    episodiAnimeList = result.episodiTutti || episodiAnimeList;
                    renderEpisodiOverlay();
                    renderListAnime();
                    aggiornaLogEpisodiSeVisibile();
                    showToast('Episodi visti aggiornati', 'success');
                })
                .catch(function(err) {
                    showToast('❌ Errore aggiornamento episodi visti: ' + err.message, 'error');
                });
        };

        // ==========================================================
        // 🕘 NUOVO: LOG EPISODI (tab dedicato dentro la vista Anime)
        // ==========================================================
        // Switch tra la lista classica e il log storico dei singoli episodi.
        // Il widget "Log di Sistema" della Home non viene mai toccato da
        // questa sezione: legge un foglio completamente separato.
        function switchAnimeSubview(subview) {
            const paneLista = document.getElementById('animePaneLista');
            const paneLog = document.getElementById('animePaneLog');
            const tabLista = document.getElementById('tabAnimeLista');
            const tabLog = document.getElementById('tabAnimeLog');
            if (!paneLista || !paneLog || !tabLista || !tabLog) return;

            if (subview === 'log') {
                paneLista.style.display = 'none';
                paneLog.style.display = 'block';
                tabLista.classList.remove('active');
                tabLog.classList.add('active');
                caricaLogEpisodi(); // sempre aggiornato al momento dello switch
            } else {
                paneLog.style.display = 'none';
                paneLista.style.display = 'block';
                tabLog.classList.remove('active');
                tabLista.classList.add('active');
            }
        }

        // ==========================================
        //   FASE 11 — GRUPPO LOG (Supabase diretto)
        // ==========================================

        async function ottieniUltimiLogSB_(filtroTipoMedia, filtroTipoEvento, filtroTitolo, ordineAsc) {
            try {
                const MAX_LOG = 15;
                const filtroMedia = String(filtroTipoMedia || 'all').toUpperCase();
                const filtroEvento = String(filtroTipoEvento || 'all').toUpperCase();
                const filtroTesto = String(filtroTitolo || '').trim();
                const isAsc = (ordineAsc === true || ordineAsc === 'true');

                let query = supabaseClient.from('log_attivita').select('*');
                if (filtroMedia !== 'ALL') query = query.eq('tipo_media', filtroMedia);
                if (filtroEvento !== 'ALL') query = query.eq('tipo_evento', filtroEvento);
                if (filtroTesto !== '') query = query.ilike('id_titolo', '%' + filtroTesto + '%');
                query = query.order('timestamp', { ascending: isAsc }).limit(MAX_LOG);

                const { data, error } = await query;
                if (error) throw error;

                return (data || []).map(function(r) {
                    return {
                        timestamp: r.timestamp, idTitolo: r.id_titolo || '', tipoMedia: r.tipo_media || '',
                        tipoEvento: r.tipo_evento || '', valorePrecedente: r.valore_precedente || '', valoreNuovo: r.valore_nuovo || ''
                    };
                });
            } catch (err) {
                console.error("Errore in ottieniUltimiLogSB_: " + err);
                return [];
            }
        }

        async function ottieniLogEpisodiSB_(filtroTitolo, filtroTipo, filtroAzione, dataDa, dataA, ordineAsc, filtroTipoMedia) {
            try {
                const MAX_LOG = 100;
                const filtroTesto = String(filtroTitolo || '').trim();
                const filtroTipoNorm = String(filtroTipo || 'all');
                const filtroAzioneNorm = String(filtroAzione || 'all').toUpperCase();
                const isAsc = (ordineAsc === true || ordineAsc === 'true');

                let query = supabaseClient.from('log_episodi').select('*');
                if (filtroTesto !== '') query = query.ilike('titolo', '%' + filtroTesto + '%');
                if (filtroTipoNorm !== 'all') query = query.eq('tipo', filtroTipoNorm);
                if (filtroTipoMedia) query = query.eq('tipo_media', filtroTipoMedia);
                if (filtroAzioneNorm !== 'ALL') query = query.eq('azione', filtroAzioneNorm);
                if (dataDa) query = query.gte('timestamp', dataDa + 'T00:00:00');
                if (dataA) query = query.lte('timestamp', dataA + 'T23:59:59');
                query = query.order('timestamp', { ascending: isAsc }).limit(MAX_LOG);

                const { data, error } = await query;
                if (error) throw error;

                return (data || []).map(function(r) {
                    const episodioPrecedente = r.episodio_precedente || 0;
                    const episodioNuovo = r.episodio_nuovo || 0;
                    const azione = String(r.azione || '').toUpperCase();
                    return {
                        timestamp: r.timestamp, titolo: r.titolo || '', tipo: r.tipo || '', numero: r.numero || 0,
                        episodioPrecedente: episodioPrecedente, episodioNuovo: episodioNuovo,
                        episodiTotali: r.episodi_totali || 0, azione: azione, esito: String(r.esito || '').toUpperCase(),
                        episodioInteressato: (azione === 'RIMOSSO') ? episodioPrecedente : episodioNuovo
                    };
                });
            } catch (err) {
                console.error("Errore in ottieniLogEpisodiSB_: " + err);
                return [];
            }
        }
		
        // Recupera le ultime 100 righe (filtrate/ordinate) dal foglio
        // "Tab_LogEpisodi" tramite ottieniLogEpisodi() e le mostra nella tabella.
        function caricaLogEpisodi() {
            const loadingEl = document.getElementById('loadingEpisodiLog');
            const tableEl = document.getElementById('episodiLogTable');
            const btnRefresh = document.getElementById('btnRefreshEpLog');
            if (!tableEl) return;

            if (loadingEl) {
                loadingEl.style.display = 'block';
                loadingEl.innerText = '⏳ Caricamento log episodi...';
            }
            tableEl.style.display = 'none';
            if (btnRefresh) {
                btnRefresh.classList.add('spinning');
                btnRefresh.disabled = true;
            }

            const inputTitolo = document.getElementById('filterEpLogTitolo');
            const selTipo = document.getElementById('filterEpLogTipo');
            const selAzione = document.getElementById('filterEpLogAzione');
            const inputDal = document.getElementById('filterEpLogDal');
            const inputAl = document.getElementById('filterEpLogAl');
            const btnOrdine = document.getElementById('btnToggleEpLogOrdine');

            const filtroTitolo = inputTitolo ? inputTitolo.value.trim() : '';
            const filtroTipo = selTipo ? selTipo.value : 'all';
            const filtroAzione = selAzione ? selAzione.value : 'all';
            const dataDal = inputDal ? inputDal.value : '';
            const dataAl = inputAl ? inputAl.value : '';
            const ordineAsc = btnOrdine ? (btnOrdine.getAttribute('data-asc') === 'true') : false;

            const filtriAttivi = (filtroTitolo !== '' || filtroTipo !== 'all' || filtroAzione !== 'all' || dataDal !== '' || dataAl !== '');

            ottieniLogEpisodiSB_(filtroTitolo, filtroTipo, filtroAzione, dataDal, dataAl, ordineAsc, 'ANIME')
                .then(function(logs) {
                    if (loadingEl) loadingEl.style.display = 'none';
                    if (btnRefresh) {
                        btnRefresh.classList.remove('spinning');
                        btnRefresh.disabled = false;
                    }
                    tableEl.style.display = 'table';
                    renderLogEpisodi(logs || [], filtriAttivi);
                })
                .catch(function(err) {
                    console.error('Errore nel caricamento del Log Episodi:', err);
                    if (loadingEl) {
                        loadingEl.style.display = 'block';
                        loadingEl.innerText = '⚠️ Impossibile caricare il log episodi.';
                    }
                    if (btnRefresh) {
                        btnRefresh.classList.remove('spinning');
                        btnRefresh.disabled = false;
                    }
                });
        }

        function renderLogEpisodi(logs, filtriAttivi) {
            const bodyEl = document.getElementById('episodiLogTableBody');
            const emptyEl = document.getElementById('episodiLogEmpty');
            const countEl = document.getElementById('countEpLog');
            if (!bodyEl) return;

            bodyEl.innerHTML = '';

            if (countEl) countEl.innerText = logs && logs.length ? (logs.length + ' risultati') : '';

            if (!logs || logs.length === 0) {
                document.getElementById('episodiLogTable').style.display = 'none';
                if (emptyEl) {
                    emptyEl.style.display = 'block';
                    emptyEl.innerText = filtriAttivi
                        ? 'Nessun episodio trovato con i filtri selezionati. 🔍'
                        : 'Nessun episodio registrato finora. 📺';
                }
                return;
            }
            if (emptyEl) emptyEl.style.display = 'none';

            logs.forEach(function(log) {
                const tr = document.createElement('tr');

                const tipoClass = (log.tipo === 'Film') ? 'ep-log-badge-film' : 'ep-log-badge-stagione';
                const tipoIcona = (log.tipo === 'Film') ? '🎬' : '🎞️';

                const isVisto = String(log.azione).toUpperCase() === 'VISTO';

                // Ep. X/Y: X = episodio interessato dall'azione, Y = totale episodi
                // della stagione/film (0 = totale sconosciuto/non impostato)
                const epLabel = 'Ep. ' + log.episodioInteressato + (log.episodiTotali > 0 ? ('/' + log.episodiTotali) : '');

                // L'azione "Visto" che raggiunge l'ultimo episodio della stagione/film
                // (episodioInteressato === episodiTotali) porta con sé anche l'esito di
                // completamento calcolato lato server (stessa identica logica del
                // widget "Log di Sistema" della Home): COMPLETAMENTO -> Anime Completato,
                // altrimenti -> Stagione completata / Film completato.
                const haCompletatoUnita = isVisto && log.episodiTotali > 0 && log.episodioInteressato === log.episodiTotali;

                let azioneClass = isVisto ? 'ep-log-azione-visto' : 'ep-log-azione-rimosso';
                let azioneLabel = isVisto ? '✅ Visto' : '↩️ Rimosso';

                if (haCompletatoUnita) {
                    if (String(log.esito).toUpperCase() === 'COMPLETAMENTO') {
                        azioneClass = 'ep-log-azione-completato-anime';
                        azioneLabel = '✅ Visto — 🏆 Anime Completato';
                    } else {
                        azioneClass = 'ep-log-azione-completato-unita';
                        azioneLabel = '✅ Visto — 🎬 ' + (log.tipo === 'Film' ? 'Film completato' : 'Stagione completata');
                    }
                }

                // td-log-*: servono alla scheda compatta su telefono (Richiesta 49,
                // css "LISTE A SCHEDE", variante schede-log); su PC non cambiano nulla.
                tr.innerHTML =
                    '<td class="ep-log-timestamp td-log-data">' + formatLogTimestamp(log.timestamp) + '</td>' +
                    '<td class="ep-log-titolo td-log-titolo">' + escapeHtmlLog(log.titolo) + '</td>' +
                    '<td><span class="ep-log-badge ' + tipoClass + '">' + tipoIcona + ' ' + escapeHtmlLog(log.tipo) + ' ' + log.numero + '</span></td>' +
                    '<td style="text-align:center; font-family:\'Courier New\', monospace;">' + epLabel + '</td>' +
                    '<td style="text-align:center;"><span class="ep-log-azione ' + azioneClass + '">' + azioneLabel + '</span></td>';

                bodyEl.appendChild(tr);
            });
        }

        // 🔍 Filtri di testata (Titolo, Tipo, Azione, Dal/Al): la ricerca per
        // titolo usa un debounce di 350ms, tutti gli altri ricaricano subito.
        (function initEpisodiLogFilters() {
            const inputTitolo = document.getElementById('filterEpLogTitolo');
            const selTipo = document.getElementById('filterEpLogTipo');
            const selAzione = document.getElementById('filterEpLogAzione');
            const inputDal = document.getElementById('filterEpLogDal');
            const inputAl = document.getElementById('filterEpLogAl');
            if (!inputTitolo || !selTipo || !selAzione) return;

            [selTipo, selAzione, inputDal, inputAl].forEach(function(el) {
                if (!el) return;
                el.addEventListener('change', function() { caricaLogEpisodi(); });
            });

            let debounceTimer = null;
            inputTitolo.addEventListener('input', function() {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function() { caricaLogEpisodi(); }, 350);
            });
            inputTitolo.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    if (debounceTimer) clearTimeout(debounceTimer);
                    caricaLogEpisodi();
                }
            });
        })();

        // 🔃 / ↺ / 🔄 Ordinamento, reset filtri e refresh manuale
        (function initEpisodiLogActions() {
            const btnOrdine = document.getElementById('btnToggleEpLogOrdine');
            const btnReset = document.getElementById('btnResetEpLogFiltri');
            const btnRefresh = document.getElementById('btnRefreshEpLog');
            const inputTitolo = document.getElementById('filterEpLogTitolo');
            const selTipo = document.getElementById('filterEpLogTipo');
            const selAzione = document.getElementById('filterEpLogAzione');
            const inputDal = document.getElementById('filterEpLogDal');
            const inputAl = document.getElementById('filterEpLogAl');

            if (btnOrdine) {
                btnOrdine.addEventListener('click', function() {
                    const isAsc = btnOrdine.getAttribute('data-asc') === 'true';
                    const nuovoStato = !isAsc;
                    btnOrdine.setAttribute('data-asc', String(nuovoStato));
                    btnOrdine.innerHTML = nuovoStato ? '⬆️ Meno recenti' : '⬇️ Recenti';
                    btnOrdine.title = nuovoStato ? 'Inverti ordinamento (dal più recente)' : 'Inverti ordinamento (dal più vecchio)';
                    btnOrdine.classList.toggle('filter-active', nuovoStato);
                    caricaLogEpisodi();
                });
            }

            if (btnReset) {
                btnReset.addEventListener('click', function() {
                    if (inputTitolo) inputTitolo.value = '';
                    if (selTipo) selTipo.value = 'all';
                    if (selAzione) selAzione.value = 'all';
                    if (inputDal) inputDal.value = '';
                    if (inputAl) inputAl.value = '';
                    if (btnOrdine) {
                        btnOrdine.setAttribute('data-asc', 'false');
                        btnOrdine.innerHTML = '⬇️ Recenti';
                        btnOrdine.title = 'Inverti ordinamento (dal più vecchio)';
                        btnOrdine.classList.remove('filter-active');
                    }
                    caricaLogEpisodi();
                });
            }

            if (btnRefresh) {
                btnRefresh.addEventListener('click', function() { caricaLogEpisodi(); });
            }
        })();

        // Se il tab "Log Episodi" è attualmente visibile, lo ricarica: usata
        // dopo un'azione (+/-/✏️) sull'overlay episodi, così il log resta
        // coerente con quanto appena segnato, senza dover cambiare tab.
        function aggiornaLogEpisodiSeVisibile() {
            const paneLog = document.getElementById('animePaneLog');
            if (paneLog && paneLog.style.display !== 'none') {
                caricaLogEpisodi();
            }
        }

        // ==========================================
        //                  LOGICA MANGA
        // ==========================================

        // ==========================================
        //   📡 TRACKER SERIE TV (view "Serie TV")
        //   Stesso disegno della vista Anime (serie ad episodi), semplificato:
        //   niente film collegati, niente voto, niente priorita. Generi e
        //   stagioni arrivano da TMDB via Edge Function tmdb-proxy
        //   (action tv_search / tv_detail), come il Gruppo Cinema.
        // ==========================================
        let serieTvList = [];
        let episodiSerieTvList = []; // righe di episodi_serie_tv per TUTTI i titoli

        // true se il titolo ha almeno un episodio segnato come visto, anche se
        // nessuna stagione risulta ancora completata (colore "In Visione").