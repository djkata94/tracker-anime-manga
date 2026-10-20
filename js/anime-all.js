        function switchView(viewName) {
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
        //   FASE 11 â€” GRUPPO ANIME (Supabase diretto)
        // ==========================================

        // Porting 1:1 di calcolaColoreVisioneAnime_ da codice.gs â€” pura
        // logica, nessuna chiamata al server, quindi la traduzione Ã¨
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
                    immagine: a.immagine || '', priorita: !!a.priorita, abbandonata: !!a.abbandonata
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
        // Film (usato dal flag "Anime giÃ  visto per intero"). Le righe a
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
                risultato.eventoLoggato = eventoDaLoggare;
            }

            const scritture = [
                supabaseClient.from('anime').update({ stagioni_viste: risultato.stagioniViste, film_visti: risultato.filmVisti }).eq('titolo', titoloTrim)
            ];
            if (eventoDaLoggare) scritture.push(registraLogSB_(titoloTrim, 'ANIME', eventoDaLoggare, valPrec, valNuovo));
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
                abbandonata: !!dati.abbandonata
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

            const { error: errUpd } = await supabaseClient.from('anime').update({
                titolo: dati.titolo, stato: dati.stato, note: dati.note,
                valutazione: (dati.valutazione === '' || dati.valutazione === undefined || dati.valutazione === '-') ? null : dati.valutazione,
                stagioni_totali: parseInt(dati.stagioniTotali) || 0, stagioni_viste: parseInt(dati.stagioniViste) || 0,
                film_totali: parseInt(dati.filmTotali) || 0, film_visti: parseInt(dati.filmVisti) || 0,
                generi: dati.generi || '', immagine: dati.immagine || '', abbandonata: !!dati.abbandonata
            }).eq('titolo', vecchioTitoloTrim);
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
                    if (avevaProgresso) console.warn("Rimosse righe stagioni con episodi giÃ  visti per '" + nuovoTitoloEffettivo + "'.");
                }

                if (nuoviFilmTotaliEp > vecchiFilmTotaliLog) {
                    await aggiungiRigheEpisodiSB_(nuovoTitoloEffettivo, 'Film', vecchiFilmTotaliLog + 1, nuoviFilmTotaliEp);
                } else if (nuoviFilmTotaliEp < vecchiFilmTotaliLog) {
                    const avevaProgresso = await rimuoviRigheEpisodiEccedentiSB_(nuovoTitoloEffettivo, 'Film', nuoviFilmTotaliEp + 1);
                    if (avevaProgresso) console.warn("Rimosse righe film con episodi giÃ  visti per '" + nuovoTitoloEffettivo + "'.");
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
                return { errore: 'Questa opera ha giÃ  un voto: per modificarlo usa la modale di modifica.' };
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
        //   â­ VOTO ANIME (overlay griglia 0.5-10)
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
            document.getElementById('votoAnimeValore').textContent = 'â€“';
            document.getElementById('btnConfermaVotoAnime').disabled = true;
            document.getElementById('votoAnimeModalTitle').innerText = 'â­ Vota â€” ' + titolo;
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
                    showToast('âŒ Errore salvataggio voto: ' + err.message, 'error');
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
                    alert('âŒ Errore nel caricamento degli anime. Controlla la console per i dettagli.');
                });
        }

        // --- GIARDINO DIGITALE (mind-garden): un seme per titolo (Richiesta 33) ---
        // Bottone ðŸŒ± in ogni riga anime/manga: overlay di scrittura, salva crea/aggiorna
        // la nota nel giardino (upsert su tipo+titolo, mai duplicati). Tags: tipo + generi.
        const GIARDINO_URL = 'https://mind-garden-tau.vercel.app';
        // Token di scrittura del giardino (SEED_TOKEN di mind-garden). Gira nel browser:
        // visibile a chi ispeziona il sito; a basso privilegio (pianta/aggiorna solo note).
        const GIARDINO_SEED_TOKEN = 'zBJiX+ItDAsKHPPKRxMSzACR1jEUj8LJgmvKEKjRMz0=';
        const GIARDINO_SEED_MAX = 300;
        const GIARDINO_GROWING_MAX = 1500;
        let GIARDINO_TITOLO_ = '';
        let GIARDINO_TIPO_ = '';

        function slugPerGiardino_(s) {
            return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }

        function stadioPerGiardino_(testo) {
            const len = String(testo || '').length;
            if (len < GIARDINO_SEED_MAX) return 'Seme';
            if (len < GIARDINO_GROWING_MAX) return 'In crescita';
            return 'Matura';
        }

        function testoSenzaHtml_(html) {
            const d = document.createElement('div');
            d.innerHTML = html || '';
            return (d.textContent || '').trim();
        }

        // Bottone riga solo per il proprietario (come driveShortcutBtn).
        function giardinoBtn_(tipo, safeTitle) {
            if (!window.GIARDINO_IS_OWNER_) return '';
            return '<button class="action-icon-btn" style="font-size: 13px; padding: 0; background: none; border: none; cursor: pointer;" onclick="apriGiardinoOverlay(\'' + safeTitle + '\', \'' + tipo + '\')" title="Pianta nel giardino">ðŸŒ±</button>';
        }

        function elementoGiardino_(tipo, titolo) {
            const lista = (tipo === 'anime' ? (typeof animeList !== 'undefined' ? animeList : []) : (typeof mangaList !== 'undefined' ? mangaList : []));
            for (let i = 0; i < lista.length; i++) {
                if (lista[i] && lista[i].titolo === titolo) return lista[i];
            }
            return null;
        }

        function generiPerGiardino_(tipo, item) {
            const tags = [tipo];
            const raw = item && item.generi ? String(item.generi).split(',') : [];
            for (let i = 0; i < raw.length; i++) {
                const g = raw[i].trim();
                if (g && tags.indexOf(g) === -1) tags.push(g);
            }
            return tags;
        }

        async function giardinoCheck_(tipo, titolo) {
            const params = new URLSearchParams({ source: 'tracker', source_id: tipo + '-' + slugPerGiardino_(titolo) });
            const res = await fetch(GIARDINO_URL + '/api/seed?' + params.toString(), {
                headers: { 'Authorization': 'Bearer ' + GIARDINO_SEED_TOKEN }
            });
            const data = await res.json().catch(function() { return {}; });
            if (!res.ok) throw new Error((data && data.error) || 'Controllo giardino non riuscito.');
            return data.url ? GIARDINO_URL + data.url : null;
        }

        async function giardinoLeggi_(slug) {
            const res = await fetch(GIARDINO_URL + '/api/notes/' + encodeURIComponent(slug));
            if (!res.ok) return null;
            const data = await res.json().catch(function() { return null; });
            return (data && data.slug) ? data : null;
        }

        function apriGiardinoOverlay(titolo, tipo) {
            if (!window.GIARDINO_IS_OWNER_) {
                showToast('Funzione riservata al proprietario.', 'error');
                return;
            }
            GIARDINO_TITOLO_ = titolo;
            GIARDINO_TIPO_ = tipo;
            let box = document.getElementById('giardinoOverlay');
            if (!box) {
                box = document.createElement('div');
                box.id = 'giardinoOverlay';
                box.className = 'modal-overlay';
                box.innerHTML =
                    '<div class="modal">' +
                    '<div class="modal-header"><h2 id="giardinoOverlayTitolo">ðŸŒ± Pianta nel giardino</h2>' +
                    '<button class="close-modal" onclick="chiudiGiardinoOverlay()">&times;</button></div>' +
                    '<div id="giardinoOverlayCarico" style="font-size:13px;opacity:0.7;display:none;">Caricamento notaâ€¦</div>' +
                    '<div class="form-group"><label>Titolo</label><input id="giardinoTitolo" maxlength="200"></div>' +
                    '<div class="form-group"><label>Nota</label><textarea id="giardinoTesto" rows="8" style="resize:vertical;"></textarea></div>' +
                    '<p id="giardinoStadio" style="font-size:12px;opacity:0.7;margin:0 0 10px;"></p>' +
                    '<p id="giardinoMsg" style="font-size:13px;margin:0 0 10px;display:none;"></p>' +
                    '<p id="giardinoLinkWrap" style="font-size:13px;margin:0 0 10px;display:none;"><a id="giardinoLink" href="#" target="_blank" rel="noreferrer" style="color:var(--info);text-decoration:underline;">Vedi nel giardino â†’</a></p>' +
                    '<div class="modal-footer">' +
                    '<button class="btn" onclick="chiudiGiardinoOverlay()">Annulla</button>' +
                    '<button class="btn" style="background:var(--primary);color:#fff;" onclick="giardinoSalva_()">Salva nel giardino</button>' +
                    '</div></div>';
                box.addEventListener('click', function(e) { if (e.target === box) chiudiGiardinoOverlay(); });
                document.body.appendChild(box);
                document.getElementById('giardinoTesto').addEventListener('input', aggiornaStadioGiardino_);
            }
            box.classList.add('active');
            document.getElementById('giardinoOverlayTitolo').textContent = 'ðŸŒ± Pianta nel giardino';
            document.getElementById('giardinoMsg').style.display = 'none';
            document.getElementById('giardinoLinkWrap').style.display = 'none';
            const item = elementoGiardino_(tipo, titolo);
            const base = item && item.note ? testoSenzaHtml_(item.note) : '';
            document.getElementById('giardinoTitolo').value = titolo;
            document.getElementById('giardinoTesto').value = base;
            aggiornaStadioGiardino_();
            // Se il titolo ha giÃ  un seme, precarica titolo e testo dalla nota.
            document.getElementById('giardinoOverlayCarico').style.display = 'block';
            giardinoCheck_(tipo, titolo).then(function(url) {
                if (!url) return null;
                document.getElementById('giardinoOverlayTitolo').textContent = 'ðŸŒ± Aggiorna nel giardino';
                const slug = url.split('/notes/')[1];
                if (!slug) return null;
                return giardinoLeggi_(decodeURIComponent(slug));
            }).then(function(nota) {
                if (nota && document.getElementById('giardinoOverlay').classList.contains('active')) {
                    document.getElementById('giardinoTitolo').value = nota.title || titolo;
                    document.getElementById('giardinoTesto').value = nota.content || '';
                    aggiornaStadioGiardino_();
                    const lw = document.getElementById('giardinoLinkWrap');
                    lw.style.display = 'block';
                    document.getElementById('giardinoLink').href = GIARDINO_URL + '/notes/' + nota.slug;
                }
            }).catch(function(err) {
                giardinoAvviso_('Non riesco a caricare la nota precedente: ' + err.message);
            }).finally(function() {
                document.getElementById('giardinoOverlayCarico').style.display = 'none';
            });
        }

        function aggiornaStadioGiardino_() {
            const t = document.getElementById('giardinoTesto');
            if (!t) return;
            document.getElementById('giardinoStadio').textContent = 'DiventerÃ : ' + stadioPerGiardino_(t.value) + ' (' + t.value.length + ' caratteri)';
        }

        function giardinoAvviso_(testo) {
            const m = document.getElementById('giardinoMsg');
            if (!m) return;
            m.textContent = testo;
            m.style.display = 'block';
        }

        function chiudiGiardinoOverlay() {
            const box = document.getElementById('giardinoOverlay');
            if (box) box.classList.remove('active');
        }

        async function giardinoSalva_() {
            const titolo = document.getElementById('giardinoTitolo').value.trim();
            const testo = document.getElementById('giardinoTesto').value;
            if (!titolo) {
                giardinoAvviso_('Il titolo Ã¨ obbligatorio.');
                return;
            }
            const item = elementoGiardino_(GIARDINO_TIPO_, GIARDINO_TITOLO_);
            const tags = generiPerGiardino_(GIARDINO_TIPO_, item);
            giardinoAvviso_('Salvataggioâ€¦');
            try {
                const res = await fetch(GIARDINO_URL + '/api/seed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GIARDINO_SEED_TOKEN },
                    body: JSON.stringify({
                        source: 'tracker',
                        source_id: GIARDINO_TIPO_ + '-' + slugPerGiardino_(GIARDINO_TITOLO_),
                        title: titolo,
                        content: testo,
                        tags: tags
                    })
                });
                const data = await res.json().catch(function() { return {}; });
                if (!res.ok) throw new Error((data && data.error) || 'Salvataggio non riuscito.');
                document.getElementById('giardinoOverlayTitolo').textContent = 'ðŸŒ± Aggiorna nel giardino';
                const lw = document.getElementById('giardinoLinkWrap');
                lw.style.display = 'block';
                document.getElementById('giardinoLink').href = GIARDINO_URL + data.url;
                giardinoAvviso_('Salvato nel giardino!');
            } catch (err) {
                giardinoAvviso_(err.message);
            }
        }

        // Esposte globali come le altre action di riga (onclick inline).
        window.apriGiardinoOverlay = apriGiardinoOverlay;
        window.chiudiGiardinoOverlay = chiudiGiardinoOverlay;
        window.giardinoSalva_ = giardinoSalva_;

        // --- SUGGERIMENTI ANIME via AniList (Richiesta 36) ---
        // Niente id salvato: search sul titolo, poi recommendations (tutto dal
        // browser, gratis). Dati giÃ  completi: niente secondo giro di rete.
        function pulisciTramaAniList_(s) {
            return String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        }

        async function getSuggAnime_(titolo) {
            const hits = await cercaCandidatiAniListSB_(titolo, 'ANIME');
            if (!hits || hits.length === 0 || !hits[0].id) {
                throw new Error('Titolo non trovato su AniList.');
            }
            const gql = 'query ($id: Int) { Media(id: $id) { recommendations(sort: RATING_DESC, perPage: 10) { nodes { rating mediaRecommendation { id title { romaji english } startDate { year } coverImage { medium large } genres averageScore description(asHtml: false) } } } } }';
            const json = await eseguireRichiestaAniList_(gql, { id: hits[0].id });
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
                    trama: pulisciTramaAniList_(m.description || '')
                };
            }).filter(function(c) { return c.id; });
        }

        // Scrive subito meta+trama (dati giÃ  in mano, niente rete), poi prova
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
                    if (c.voto !== null && c.voto !== undefined) pezzi.push('â­ ' + c.voto);
                    metaEl.textContent = pezzi.join(' Â· ');
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

        async function suggAnime_(titolo) {
            showToast('Cerco suggerimentiâ€¦');
            try {
                const posseduti = {};
                animeList.forEach(function(x) { if (x && x.titolo) posseduti[normTitoloSugg_(x.titolo)] = true; });
                posseduti[normTitoloSugg_(titolo)] = true;
                const res = await getSuggAnime_(titolo);
                const top = res.filter(function(c) {
                    return !posseduti[normTitoloSugg_(c.titolo)] && !posseduti[normTitoloSugg_(c.titoloAlt)];
                }).slice(0, 5);
                mostraSuggOverlay_(titolo, top, 'anime');
                arricchisciSuggLocali_(top);
            } catch (err) {
                showToast(err.message || 'Suggerimenti non disponibili.', 'error');
            }
        }

        window.suggAnime_ = suggAnime_;

        // ï¼‹ da un suggerimento anime: apre Nuovo Anime col titolo pronto
        // (l'import resta manuale, come da modale).
        function suggAggiungiAnime_(titolo) {
            chiudiSuggOverlay();
            const btn = document.getElementById('btnNuovoAnime');
            if (btn) btn.click();
            const inp = document.getElementById('inpTitoloAnime');
            if (inp) inp.value = titolo || '';
        }

        window.suggAggiungiAnime_ = suggAggiungiAnime_;

        // ï¼‹ da un suggerimento manga: apre Nuovo Manga col titolo pronto.
        function suggAggiungiManga_(titolo) {
            chiudiSuggOverlay();
            const btn = document.getElementById('btnNuovoManga');
            if (btn) btn.click();
            const inp = document.getElementById('inpTitoloManga');
            if (inp) inp.value = titolo || '';
        }

        window.suggAggiungiManga_ = suggAggiungiManga_;

        // Stessa mappatura dell'import manga (guida: RELEASINGâ†’In corso, ecc).
        function statoMangaSugg_(s) {
            if (s === 'FINISHED' || s === 'CANCELLED') return 'Concluso';
            if (s === 'NOT_YET_RELEASED') return 'In arrivo';
            if (s === 'RELEASING' || s === 'HIATUS') return 'In corso';
            return '';
        }
        // Stessa mappatura dell'import manga (RELEASINGâ†’In corso, ecc).
        function statoMangaSugg_(s) {
            if (s === 'FINISHED' || s === 'CANCELLED') return 'Concluso';
            if (s === 'NOT_YET_RELEASED') return 'In arrivo';
            if (s === 'RELEASING' || s === 'HIATUS') return 'In corso';
            return '';
        }

        async function getSuggManga_(titolo) {
            const hits = await cercaCandidatiAniListSB_(titolo, 'MANGA');
            if (!hits || hits.length === 0 || !hits[0].id) {
                throw new Error('Titolo non trovato su AniList.');
            }
            const gql = 'query ($id: Int) { Media(id: $id) { recommendations(sort: RATING_DESC, perPage: 10) { nodes { rating mediaRecommendation { id title { romaji english } startDate { year } coverImage { medium large } genres averageScore status volumes description(asHtml: false) } } } } }';
            const json = await eseguireRichiestaAniList_(gql, { id: hits[0].id });
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
            showToast('Cerco suggerimentiâ€¦');
            try {
                const posseduti = {};
                mangaList.forEach(function(x) { if (x && x.titolo) posseduti[normTitoloSugg_(x.titolo)] = true; });
                posseduti[normTitoloSugg_(titolo)] = true;
                const res = await getSuggManga_(titolo);
                const top = res.filter(function(c) {
                    return !posseduti[normTitoloSugg_(c.titolo)] && !posseduti[normTitoloSugg_(c.titoloAlt)];
                }).slice(0, 5);
                mostraSuggOverlay_(titolo, top, 'manga');
                arricchisciSuggLocali_(top);
            } catch (err) {
                showToast(err.message || 'Suggerimenti non disponibili.', 'error');
            }
        }

        window.suggManga_ = suggManga_;

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
                // NUOVO: le opere contrassegnate come prioritarie (ðŸ“Œ) vengono sempre
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
                    genresHTML = `<div class="genre-tags-list" style="color: var(--primary);">ðŸŽ­ ${item.generi}</div>`;
                }

                // Cella Voto: pill "Vota" che apre l'overlay griglia; se giÃ  votato
                // mostra il voto e apre la modale di modifica (unica via di modifica).
                const haVotoGiaAssegnato = item.valutazione !== undefined && item.valutazione !== null &&
                    String(item.valutazione).trim() !== '' && item.valutazione !== '-';
                const votoCellHTML = haVotoGiaAssegnato
                    ? `<button class="action-icon-btn" style="font-weight:bold; color:var(--primary); font-size:15px;" onclick="apriModificaAnime('${safeTitle}')" title="Modifica voto dalla scheda">${item.valutazione}</button>`
                    : `<button class="filter-btn active" style="font-size:12px; border-radius:999px;" onclick="apriVotoAnime('${safeTitle}')" title="Assegna voto">Vota</button>`;

                // Definizione dinamica di classe e icona della stella per l'Anime
                const starClass = item.preferito ? 'action-icon-btn is-favorite' : 'action-icon-btn';
                const starIcon = item.preferito ? 'â˜…' : 'â˜†';

                // NUOVO: Definizione dinamica di classe e titolo per il pin di prioritÃ  (ðŸ“Œ)
                const pinClass = item.priorita ? 'pin-btn is-priority' : 'pin-btn';
                const pinTitle = item.priorita ? 'Rimuovi dalle prioritÃ ' : 'Contrassegna come prioritario';

                // --- GESTIONE COSTRUZIONE AVATAR MODIFICATA CON EFFETTO ZOOM E LIGHTBOX ---
                let avatarHTML = '';
                if (item.immagine && item.immagine.trim() !== '') {
                    const safeImgUrl = item.immagine.trim().replace(/'/g, "\\'");
                    avatarHTML = `<img src="${safeImgUrl}" style="width: 45px; height: 45px; border-radius: 6px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border-color); cursor: zoom-in;" alt="Avatar" onclick="apriLightbox('${safeImgUrl}')">`;
                } else {
                    avatarHTML = `<div style="width: 45px; height: 45px; flex-shrink: 0;"></div>`;
                }

                tr.innerHTML = `
                    <td class="media-title">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <button class="${starClass}" style="color: var(--warning); font-size: 16px; flex-shrink: 0;" onclick="toggleFavoriteAnime('${safeTitle}', this)">${starIcon}</button>
                            <button class="${pinClass}" onclick="togglePinAnime('${safeTitle}', this, event)" title="${pinTitle}">ðŸ“Œ</button>
                            
                            ${avatarHTML}
                            
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                    <span>${item.titolo || 'Senza Titolo'}</span>
                                    <button class="action-icon-btn" style="font-size: 13px; padding: 0; background: none; border: none; cursor: pointer;" onclick="mostraSinossi('${safeTitle}', 'anime')" title="Visualizza Sinossi">â„¹ï¸</button>
                                    <button class="action-icon-btn" style="font-size: 13px; padding: 0; background: none; border: none; cursor: pointer;" onclick="apriGestioneEpisodi('${safeTitle}')" title="Gestisci Episodi">ðŸ“º</button>
                                    ${giardinoBtn_('anime', safeTitle)}
                                </div>
                                <div style="font-size: 12px; color: var(--text-muted); font-weight: normal;">
                                    Stagioni: <b>${stagioniViste}/${stagioniTotali}</b> | Film: <b>${filmVisti}/${filmTotali}</b>${item.abbandonata ? ' <span style="color:#f87171; font-weight:700;">â›” Abbandonato</span>' : ''}
                                </div>
                                ${genresHTML}
                            </div>
                        </div>
                    </td>
                    <td><span class="status-badge ${statusClass}">${item.stato || '-'}</span></td>
                    <td style="color:var(--text-muted); font-size:13px;">${item.note || '-'}</td>
                    <td style="text-align: center; font-weight: bold; color:var(--primary); font-size:15px;">${votoCellHTML}</td>
                    <td style="text-align: center;">
                        <span class="vision-box box-${coloreVisione}"></span>
                    </td>
                    <td style="text-align: center;">
                        <span style="display:inline-grid;grid-template-columns:repeat(2,max-content);gap:2px;justify-items:center;justify-content:center;"><button class="action-icon-btn" onclick="apriModificaAnime('${safeTitle}')">âœï¸</button>
                        <button class="action-icon-btn" onclick="suggAnime_('${safeTitle}')" title="Potrebbero piacerti anche">ðŸ’¡</button>
                        <button class="action-icon-btn" onclick="rimuoviAnime('${safeTitle}')">ðŸ—‘ï¸</button>
                        <button class="action-icon-btn" style="${item.abbandonata ? '' : 'opacity:0.45;'}" onclick="toggleAbbandonataAnime('${safeTitle}')" title="${item.abbandonata ? 'Riprendi l\'anime' : 'Abbandona l\'anime'}">â›”</button></span>
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
            // In modifica il flag nasce spuntato se l'anime Ã¨ giÃ  tutto visto
            // (stagioni e film in pari), cosÃ¬ riflette la situazione reale.
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

        // "GiÃ  visto" e "Abbandonato" si escludono a vicenda.
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
				alert("âŒ Le stagioni viste non possono superare le stagioni totali.");
				document.getElementById('btnSalvaAnime').innerText = "Salva";
				return;
			}
			
			if (fVis > fTot) {
				alert("âŒ I film visti non possono superare i film totali.");
				document.getElementById('btnSalvaAnime').innerText = "Salva";
				return;
			}

            // Flag "ðŸ“º Anime giÃ  visto per intero": stesso ragionamento delle
            // Serie TV, valutato prima del salvataggio perchÃ© puÃ² interromperlo.
            // Porta viste = totali e marca le righe episodi via segnaComeVista
            // (solo quelle con totale noto, come per le serie).
            const flagGiaVistoAnime = document.getElementById('inpGiaVistoAnime').checked;
            const isEditAnimeFlag = !!targetEditTitleAnime;
            let segnaComeVistaAnime = false;
            if (flagGiaVistoAnime) {
                if (sTot + fTot <= 0) {
                    alert('âŒ Con "Anime giÃ  visto" devi indicare almeno 1 stagione o 1 film totale.');
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

            // Flag "â›” Anime abbandonato": congela l'anime (flag rosso, fuori
            // dal widget In Corso). Conferma solo sulla transizione, non a ogni
            // salvataggio. Prevale su "giÃ  visto".
            const flagAbbandonataAnime = document.getElementById('inpAbbandonataAnime').checked;
            const itemCorrenteAbbAnime = isEditAnimeFlag ? animeList.find(a => a.titolo === targetEditTitleAnime) : null;
            const eraAbbandonataAnime = !!(itemCorrenteAbbAnime && itemCorrenteAbbAnime.abbandonata);
            let abbandonataNuovaAnime = false;
            if (flagAbbandonataAnime) {
                if (!eraAbbandonataAnime) {
                    const okAbbandonoAnime = confirm('Segno "' + document.getElementById('inpTitoloAnime').value.trim() + '" come abbandonato: uscirÃ  dal widget "In Corso", il flag visione diventerÃ  rosso e il progresso resterÃ  congelato. Potrai riprenderlo quando vuoi.\n\nProcedo con il salvataggio?');
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
                abbandonata: abbandonataNuovaAnime
            };
            const isEditAnime = !!targetEditTitleAnime;
            const cb = function(data) {
                animeList = data || [];
                episodiPerStagionePendenteAnime = null;
                // Se in questa sessione del modale Ã¨ stata scelta una sinossi da AniList,
                // la scriviamo ora sul foglio satellite: a questo punto la riga in SinossiAnime
                // esiste di sicuro (creata da addAnime, o giÃ  presente in caso di modifica).
                if (sinossiPendenteAnime) {
                    impostaSinossiSB_(dati.titolo, 'anime', sinossiPendenteAnime)
                        .catch(function(err) {
                            console.error('Errore salvataggio sinossi AniList: ' + err);
                            showToast('Opera salvata, ma la sinossi AniList non Ã¨ stata scritta. Riprova dal pulsante ðŸ”Ž.', 'error');
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
                alert("âŒ Errore durante il salvataggio Anime: " + err.message);
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
                    alert("âŒ Errore durante l'eliminazione.");
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
        // Aperto dall'icona ðŸ“º della vista Anime resta identico a prima.
        window.apriGestioneEpisodi = function(titolo, mostraCopertina) {
            episodiOverlayTitoloCorrente = titolo;
            document.getElementById('episodiModalTitle').innerText = 'ðŸ“º Episodi â€” ' + titolo;

            let conCopertina = false;
            if (mostraCopertina) {
                const anime = (animeList || []).find(x => (x.titolo || '').trim() === String(titolo).trim());
                conCopertina = renderCopertinaOverlay('episodiCopertina', anime);
            } else {
                nascondiCopertinaOverlay('episodiCopertina');
            }

            // L'overlay si allarga solo se la copertina c'Ã¨ davvero: senza
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
                container.innerHTML = `<p style="color:var(--text-muted); padding: 20px 0; text-align:center;">Nessuna stagione o film registrato per questo titolo. Imposta le "Stagioni Totali" / "Film Totali" dal pulsante âœï¸ per generare le righe.</p>`;
                return;
            }

            // Determina, per ciascun tipo, se la riga precedente Ã¨ completa (per il vincolo sequenziale lato UI)
            let html = '';
            const stagioni = righe.filter(r => r.tipo === 'Stagione');
            const film = righe.filter(r => r.tipo === 'Film');

            // Anime abbandonato: i visti sono congelati (banner + controlli
            // disabilitati/nascosti), i totali restano modificabili con âœï¸.
            const animeCorrenteOverlay = (animeList || []).find(function(x) { return (x.titolo || '').trim() === episodiOverlayTitoloCorrente.trim(); });
            const overlayCongelatoAnime = !!(animeCorrenteOverlay && animeCorrenteOverlay.abbandonata);
            if (overlayCongelatoAnime) {
                html += `<p style="color:#f87171; font-size:12.5px; font-weight:600; margin:0 0 6px 0;">â›” Anime abbandonato: i progressi sono congelati. Riprendilo (â›” nella lista) per modificarli â€” i totali restano modificabili con âœï¸.</p>`;
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

                    // âœ… = segna l'unitÃ  come tutta vista (solo se sbloccata e non
                    // giÃ  completa); ðŸ”¢ = imposta a mano gli episodi visti.
                    const btnTuttaVista = (!completa && !bloccata && !overlayCongelatoAnime)
                        ? `<button class="episodi-btn-edit" onclick="segnaUnitaComeVistaAnime('${safeTitle}', '${ep.tipo}', ${ep.numero})" title="Segna ${ep.tipo} ${ep.numero} come tutto visto">âœ…</button>`
                        : '';
                    const btnVistiManualAnime = overlayCongelatoAnime
                        ? ''
                        : `<button class="episodi-btn-edit" onclick="modificaVistiEpisodi('${safeTitle}', '${ep.tipo}', ${ep.numero}, ${visti}, ${totali})" title="Imposta manualmente gli episodi visti">ðŸ”¢</button>`;

                    out += `
                        <div class="episodi-row ${bloccata ? 'locked' : ''}">
                            <div class="episodi-row-info">
                                <div class="episodi-row-title">${iconaTipo} ${ep.tipo} ${ep.numero} ${completa ? 'âœ…' : (bloccata ? 'ðŸ”’' : '')}
                                    <button class="episodi-btn-edit" onclick="modificaTotaleEpisodi('${safeTitle}', '${ep.tipo}', ${ep.numero}, ${totali})" title="Modifica episodi totali">âœï¸</button>
                                    ${btnVistiManualAnime}
                                    ${btnTuttaVista}
                                </div>
                                <div class="episodi-row-count">${visti} / ${totali} episodi</div>
                                <div class="episodi-progress-outer"><div class="episodi-progress-inner" style="width:${percentuale}%;"></div></div>
                            </div>
                            <div class="episodi-row-actions">
                                <button class="episodi-btn" ${disabledMeno} onclick="incrementaEpisodio('${safeTitle}', '${ep.tipo}', ${ep.numero}, -1)">âˆ’</button>
                                <button class="episodi-btn" ${disabledPiu} onclick="incrementaEpisodio('${safeTitle}', '${ep.tipo}', ${ep.numero}, 1)">+</button>
                            </div>
                        </div>`;
                });
                return out;
            }

            if (stagioni.length > 0) {
                html += `<div class="section-title-label" style="margin:14px 0 10px 0; font-size:12px;">Stagioni</div>`;
                html += renderGruppo(stagioni, 'ðŸŽžï¸');
            }
            if (film.length > 0) {
                html += `<div class="section-title-label" style="margin:14px 0 10px 0; font-size:12px;">Film</div>`;
                html += renderGruppo(film, 'ðŸŽ¬');
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

        // senzaLogEpisodio = true per âœ…/ðŸ”¢ da overlay (popolamento archivio):
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

            if (nuovoValore !== episodiVistiAttuale && !senzaLogEpisodio) {
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
                    // (verde) mai votato. Niente âœ…/ðŸ”¢/matita, niente singole
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
                    showToast('âŒ Errore aggiornamento episodio: ' + err.message, 'error');
                });
        };

        window.modificaTotaleEpisodi = function(titolo, tipo, numero, totaleAttuale) {
            const nuovoTotaleStr = prompt(`Numero totale episodi per ${tipo} ${numero}:`, totaleAttuale);
            if (nuovoTotaleStr === null) return; // annullato
            const nuovoTotale = parseInt(nuovoTotaleStr);
            if (isNaN(nuovoTotale) || nuovoTotale < 0) {
                showToast('âŒ Inserisci un numero valido', 'error');
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
                    showToast('âŒ Errore aggiornamento totale episodi: ' + err.message, 'error');
                });
        };

        // âœ… Segna l'unitÃ  come tutta vista in un colpo solo (es. 3 stagioni
        // giÃ  viste su 5). Delega a updateEpisodioVistiSB_ con il delta
        // mancante, cosÃ¬ restano validi vincolo sequenziale, log e ricalcolo.
        window.segnaUnitaComeVistaAnime = function(titolo, tipo, numero) {
            const riga = (episodiAnimeList || []).find(function(e) {
                return (e.titolo || '').trim() === String(titolo).trim() && e.tipo === tipo && parseInt(e.numero) === parseInt(numero);
            });
            if (!riga) {
                showToast('âŒ Riga non trovata', 'error');
                return;
            }
            const totali = parseInt(riga.episodiTotali) || 0;
            const visti = parseInt(riga.episodiVisti) || 0;
            if (totali <= 0) {
                showToast('âŒ Imposta prima gli episodi totali con la matita âœï¸, poi segna come vista.', 'error');
                return;
            }
            if (visti >= totali) {
                showToast('UnitÃ  giÃ  completa.', 'success');
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
                    showToast('âœ… ' + tipo + ' ' + numero + ' segnata come tutta vista', 'success');
                })
                .catch(function(err) {
                    showToast('âŒ Errore aggiornamento episodio: ' + err.message, 'error');
                });
        };

        // ðŸ”¢ Imposta a mano gli episodi visti (es. 450 su 800 senza premere
        // + 450 volte). Stessa delega: aumenti vincolati alla sequenza,
        // diminuzioni sempre permesse, clamp al totale come il +.
        window.modificaVistiEpisodi = function(titolo, tipo, numero, vistiAttuali, totaleAttuale) {
            const totali = parseInt(totaleAttuale) || 0;
            const intervallo = totali > 0 ? ' (0â€“' + totali + ')' : '';
            const nuovoVistiStr = prompt(`Episodi visti per ${tipo} ${numero}${intervallo}:`, vistiAttuali);
            if (nuovoVistiStr === null) return; // annullato
            const nuovoVisti = parseInt(nuovoVistiStr);
            if (isNaN(nuovoVisti) || nuovoVisti < 0) {
                showToast('âŒ Inserisci un numero valido', 'error');
                return;
            }
            if (totali > 0 && nuovoVisti > totali) {
                showToast('âŒ Il massimo per ' + tipo + ' ' + numero + ' Ã¨ ' + totali + ' episodi.', 'error');
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
                    showToast('âŒ Errore aggiornamento episodi visti: ' + err.message, 'error');
                });
        };

        // ==========================================================
        // ðŸ•˜ NUOVO: LOG EPISODI (tab dedicato dentro la vista Anime)
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
        //   FASE 11 â€” GRUPPO LOG (Supabase diretto)
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
                loadingEl.innerText = 'â³ Caricamento log episodi...';
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
                        loadingEl.innerText = 'âš ï¸ Impossibile caricare il log episodi.';
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
                        ? 'Nessun episodio trovato con i filtri selezionati. ðŸ”'
                        : 'Nessun episodio registrato finora. ðŸ“º';
                }
                return;
            }
            if (emptyEl) emptyEl.style.display = 'none';

            logs.forEach(function(log) {
                const tr = document.createElement('tr');

                const tipoClass = (log.tipo === 'Film') ? 'ep-log-badge-film' : 'ep-log-badge-stagione';
                const tipoIcona = (log.tipo === 'Film') ? 'ðŸŽ¬' : 'ðŸŽžï¸';

                const isVisto = String(log.azione).toUpperCase() === 'VISTO';

                // Ep. X/Y: X = episodio interessato dall'azione, Y = totale episodi
                // della stagione/film (0 = totale sconosciuto/non impostato)
                const epLabel = 'Ep. ' + log.episodioInteressato + (log.episodiTotali > 0 ? ('/' + log.episodiTotali) : '');

                // L'azione "Visto" che raggiunge l'ultimo episodio della stagione/film
                // (episodioInteressato === episodiTotali) porta con sÃ© anche l'esito di
                // completamento calcolato lato server (stessa identica logica del
                // widget "Log di Sistema" della Home): COMPLETAMENTO -> Anime Completato,
                // altrimenti -> Stagione completata / Film completato.
                const haCompletatoUnita = isVisto && log.episodiTotali > 0 && log.episodioInteressato === log.episodiTotali;

                let azioneClass = isVisto ? 'ep-log-azione-visto' : 'ep-log-azione-rimosso';
                let azioneLabel = isVisto ? 'âœ… Visto' : 'â†©ï¸ Rimosso';

                if (haCompletatoUnita) {
                    if (String(log.esito).toUpperCase() === 'COMPLETAMENTO') {
                        azioneClass = 'ep-log-azione-completato-anime';
                        azioneLabel = 'âœ… Visto â€” ðŸ† Anime Completato';
                    } else {
                        azioneClass = 'ep-log-azione-completato-unita';
                        azioneLabel = 'âœ… Visto â€” ðŸŽ¬ ' + (log.tipo === 'Film' ? 'Film completato' : 'Stagione completata');
                    }
                }

                tr.innerHTML =
                    '<td class="ep-log-timestamp">' + formatLogTimestamp(log.timestamp) + '</td>' +
                    '<td class="ep-log-titolo">' + escapeHtmlLog(log.titolo) + '</td>' +
                    '<td><span class="ep-log-badge ' + tipoClass + '">' + tipoIcona + ' ' + escapeHtmlLog(log.tipo) + ' ' + log.numero + '</span></td>' +
                    '<td style="text-align:center; font-family:\'Courier New\', monospace;">' + epLabel + '</td>' +
                    '<td style="text-align:center;"><span class="ep-log-azione ' + azioneClass + '">' + azioneLabel + '</span></td>';

                bodyEl.appendChild(tr);
            });
        }

        // ðŸ” Filtri di testata (Titolo, Tipo, Azione, Dal/Al): la ricerca per
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

        // ðŸ”ƒ / â†º / ðŸ”„ Ordinamento, reset filtri e refresh manuale
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
                    btnOrdine.innerHTML = nuovoStato ? 'â¬†ï¸ Meno recenti' : 'â¬‡ï¸ Recenti';
                    btnOrdine.title = nuovoStato ? 'Inverti ordinamento (dal piÃ¹ recente)' : 'Inverti ordinamento (dal piÃ¹ vecchio)';
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
                        btnOrdine.innerHTML = 'â¬‡ï¸ Recenti';
                        btnOrdine.title = 'Inverti ordinamento (dal piÃ¹ vecchio)';
                        btnOrdine.classList.remove('filter-active');
                    }
                    caricaLogEpisodi();
                });
            }

            if (btnRefresh) {
                btnRefresh.addEventListener('click', function() { caricaLogEpisodi(); });
            }
        })();

        // Se il tab "Log Episodi" Ã¨ attualmente visibile, lo ricarica: usata
        // dopo un'azione (+/-/âœï¸) sull'overlay episodi, cosÃ¬ il log resta
        // coerente con quanto appena segnato, senza dover cambiare tab.
function aggiornaLogEpisodiSeVisibile() {
    const paneLog = document.getElementById('animePaneLog');
    if (paneLog && paneLog.style.display !== 'none') {
        caricaLogEpisodi();
    }
}
