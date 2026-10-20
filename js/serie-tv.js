        let serieTvList = [];
        let episodiSerieTvList = []; // righe di episodi_serie_tv per TUTTI i titoli

        // true se il titolo ha almeno un episodio segnato come visto, anche se
        // nessuna stagione risulta ancora completata (colore "In Visione").
        function haProgressoStagioniParzialeSerieTv(titolo) {
            const titoloTrim = (titolo || '').trim();
            return episodiSerieTvList.some(e => (e.titolo || '').trim() === titoloTrim && (parseInt(e.episodiVisti) || 0) > 0);
        }

        let currentFilterStatoSerieTv = 'all';
        let currentFilterVisioneSerieTv = 'all';
        let currentSearchSerieTv = '';
        let currentFavFilterSerieTv = 'all';
        let selectedGenresSerieTv = []; // generi TMDB attivi nel filtro avanzato Serie TV

        let targetEditTitleSerieTv = null;
        let sinossiPendenteSerieTv = null; // trama TMDB in sospeso, scritta su sinossi_serie_tv al salvataggio
        let episodiPerStagionePendenteSerieTv = null; // { 1: episodi, ... } dal picker stagioni TMDB
        let anniPerStagionePendenteSerieTv = null; // { 1: anno, ... } dal picker stagioni TMDB (solo anni noti)
        let generiSelezionatiSerieTv = ''; // generi TMDB in sospeso, scritti su serie_tv al salvataggio
        let tmdbIdSelezionatoSerieTv = null; // id TMDB in sospeso, scritto su serie_tv al salvataggio

        // Stesso calcolo degli anime, senza la parte film: bianco = da iniziare,
        // celeste = in visione, giallo = in pari (tutto visto ma opera non conclusa),
        // verde = completato (tutto visto e opera conclusa).
        // rosso = abbandonata (vince su tutto: la serie esce dal widget In Corso).
        function calcolaColoreVisioneSerieTv_(stagioniTotali, stagioniViste, stato, haProgressoParziale, abbandonata) {
            if (abbandonata) return 'rosso';
            const statoClean = String(stato || '').trim().toLowerCase();
            const completato = (stagioniViste === stagioniTotali);
            const iniziato = (stagioniViste > 0) || !!haProgressoParziale;
            if (!iniziato) return 'bianco';
            if (!completato) return 'celeste';
            return (statoClean === 'concluso') ? 'verde' : 'giallo';
        }

        async function getSerieTvDataSB_() {
            const [serieRes, episodiRes] = await Promise.all([
                supabaseClient.from('serie_tv').select('*').order('titolo', { ascending: true }),
                supabaseClient.from('episodi_serie_tv').select('serie_titolo,numero,episodi_totali,episodi_visti')
            ]);
            if (serieRes.error) throw serieRes.error;
            if (episodiRes.error) throw episodiRes.error;

            const serieRows = serieRes.data || [];
            const episodiRows = episodiRes.data || [];

            const titoliConProgressoParziale = new Set();
            episodiRows.forEach(function(e) {
                if ((parseInt(e.episodi_visti) || 0) > 0) {
                    titoliConProgressoParziale.add(e.serie_titolo);
                }
            });

            return serieRows.map(function(s) {
                let notaTesto = s.note || '';
                if (typeof notaTesto === 'string' && !notaTesto.includes('<a ') && notaTesto.match(/https?:\/\/[^\s]+/i)) {
                    notaTesto = notaTesto.replace(/(https?:\/\/[^\s]+)/gi, '<a href="$1" target="_blank" style="color: #00ffcc; text-decoration: underline; font-weight: 500;">$1</a>');
                }

                const haProgressoParziale = titoliConProgressoParziale.has(s.titolo);
                const coloreVisione = calcolaColoreVisioneSerieTv_(
                    s.stagioni_totali, s.stagioni_viste, s.stato, haProgressoParziale, !!s.abbandonata
                );

                return {
                    titolo: s.titolo, stato: s.stato || 'In corso', note: notaTesto,
                    stagioniTotali: s.stagioni_totali || 0, stagioniViste: s.stagioni_viste || 0,
                    coloreVisione: coloreVisione, generi: s.generi || '', preferito: !!s.preferito,
                    immagine: s.immagine || '', tmdbId: s.tmdb_id || null, abbandonata: !!s.abbandonata
                };
            });
        }

        async function getTuttiEpisodiSerieTvSB_() {
            const { data, error } = await supabaseClient
                .from('episodi_serie_tv')
                .select('serie_titolo,numero,episodi_totali,episodi_visti,anno');
            if (error) throw error;
            return (data || []).map(function(r) {
                return { titolo: r.serie_titolo, numero: r.numero, episodiTotali: r.episodi_totali, episodiVisti: r.episodi_visti,
                         anno: (r.anno !== undefined && r.anno !== null && r.anno !== '') ? r.anno : null };
            });
        }

        async function aggiungiRigheStagioniSerieTvSB_(titolo, daNumero, aNumero, mappaTotaliEpisodi, mappaAnni) {
            if (daNumero > aNumero) return;
            const titoloTrim = String(titolo).trim();
            const nuoveRighe = [];
            for (let n = daNumero; n <= aNumero; n++) {
                const totaleNoto = (mappaTotaliEpisodi && mappaTotaliEpisodi[n] !== undefined) ? (parseInt(mappaTotaliEpisodi[n]) || 0) : 0;
                const annoGrezzo = (mappaAnni && mappaAnni[n] !== undefined && mappaAnni[n] !== null && mappaAnni[n] !== '') ? (parseInt(mappaAnni[n]) || null) : null;
                nuoveRighe.push({ serie_titolo: titoloTrim, numero: n, episodi_totali: totaleNoto, episodi_visti: 0, anno: annoGrezzo });
            }
            if (nuoveRighe.length === 0) return;
            const { error } = await supabaseClient.from('episodi_serie_tv').insert(nuoveRighe);
            if (error) throw error;
        }

        async function rimuoviRigheStagioniEccedentiSerieTvSB_(titolo, numeroMinimoDaRimuovere) {
            const titoloTrim = String(titolo).trim();
            const { data, error: selErr } = await supabaseClient
                .from('episodi_serie_tv').select('episodi_visti')
                .eq('serie_titolo', titoloTrim).gte('numero', numeroMinimoDaRimuovere);
            if (selErr) throw selErr;
            const avevaProgresso = (data || []).some(function(r) { return (parseInt(r.episodi_visti) || 0) > 0; });
            const { error: delErr } = await supabaseClient
                .from('episodi_serie_tv').delete()
                .eq('serie_titolo', titoloTrim).gte('numero', numeroMinimoDaRimuovere);
            if (delErr) throw delErr;
            return avevaProgresso;
        }

        async function calcolaProgressoSerieTvSB_(titolo) {
            const titoloTrim = String(titolo).trim();
            const { data: righeSerie, error: errSerie } = await supabaseClient
                .from('serie_tv').select('stato,stagioni_totali,abbandonata').eq('titolo', titoloTrim);
            if (errSerie) throw errSerie;
            if (!righeSerie || righeSerie.length === 0) return null;

            const { data: righeStagioni, error: errSt } = await supabaseClient
                .from('episodi_serie_tv').select('numero,episodi_totali,episodi_visti').eq('serie_titolo', titoloTrim);
            if (errSt) throw errSt;

            const stato = righeSerie[0].stato || 'In corso';
            const stagioniTotali = righeSerie[0].stagioni_totali || 0;
            const stagioni = (righeStagioni || []).map(function(e) {
                return { numero: e.numero, episodiTotali: e.episodi_totali, episodiVisti: e.episodi_visti };
            });

            let stagioniViste = 0;
            for (let n = 1; n <= stagioni.length; n++) {
                const riga = stagioni.find(function(r) { return r.numero === n; });
                if (!riga || riga.episodiTotali <= 0 || riga.episodiVisti < riga.episodiTotali) break;
                stagioniViste++;
            }
            const haProgressoParziale = stagioni.some(function(e) { return (parseInt(e.episodiVisti) || 0) > 0; });
            const coloreVisione = calcolaColoreVisioneSerieTv_(stagioniTotali, stagioniViste, stato, haProgressoParziale, !!righeSerie[0].abbandonata);

            return { stagioniViste: stagioniViste, coloreVisione: coloreVisione,
                     stato: stato, stagioniTotali: stagioniTotali, eventoLoggato: null };
        }

        async function ricalcolaSincronizzaELoggaSerieTvSB_(titolo) {
            const titoloTrim = String(titolo).trim();
            const { data: righePrima, error: errPrima } = await supabaseClient
                .from('serie_tv').select('stagioni_viste').eq('titolo', titoloTrim);
            if (errPrima) throw errPrima;
            if (!righePrima || righePrima.length === 0) return null;

            const vecchieStagioniViste = righePrima[0].stagioni_viste || 0;

            const risultato = await calcolaProgressoSerieTvSB_(titoloTrim);
            if (!risultato) return null;

            let eventoDaLoggare = null;
            let valPrec = '', valNuovo = '';
            if (risultato.stagioniViste !== vecchieStagioniViste) {
                const tuttoVisto = (risultato.stagioniViste === risultato.stagioniTotali);
                const statoConclusoOra = String(risultato.stato).trim().toLowerCase().includes('conclus');
                valPrec = vecchieStagioniViste + ' stagioni';
                valNuovo = risultato.stagioniViste + ' stagioni';
                eventoDaLoggare = (tuttoVisto && statoConclusoOra) ? 'COMPLETAMENTO' : (tuttoVisto ? 'IN_PARI' : 'AVANZAMENTO');
                risultato.eventoLoggato = eventoDaLoggare;
            }

            const scritture = [
                supabaseClient.from('serie_tv').update({ stagioni_viste: risultato.stagioniViste }).eq('titolo', titoloTrim)
            ];
            if (eventoDaLoggare) scritture.push(registraLogSB_(titoloTrim, 'SERIE_TV', eventoDaLoggare, valPrec, valNuovo));
            await Promise.all(scritture);

            return risultato;
        }

        // Segna come visti tutti gli episodi con totale noto (usato dal flag
        // "Serie giÃ  vista per intero"). Le stagioni a totale 0 restano a 0:
        // vanno corrette a mano con la matita, come da accordi.
        async function segnaStagioniComeVisteSerieTvSB_(titolo) {
            const titoloTrim = String(titolo).trim();
            const { data: righe, error: errSel } = await supabaseClient
                .from('episodi_serie_tv').select('numero,episodi_totali').eq('serie_titolo', titoloTrim);
            if (errSel) throw errSel;
            const aggiornamenti = (righe || [])
                .filter(function(r) { return (parseInt(r.episodi_totali) || 0) > 0; })
                .map(function(r) {
                    return supabaseClient.from('episodi_serie_tv')
                        .update({ episodi_visti: parseInt(r.episodi_totali) || 0 })
                        .eq('serie_titolo', titoloTrim).eq('numero', r.numero);
                });
            if (aggiornamenti.length > 0) await Promise.all(aggiornamenti);
            return aggiornamenti.length;
        }

        async function addSerieTvSB_(dati) {
            const { error: errIns } = await supabaseClient.from('serie_tv').insert([{
                titolo: dati.titolo, stato: dati.stato || 'In corso', note: dati.note || '',
                stagioni_totali: parseInt(dati.stagioniTotali) || 0, stagioni_viste: 0,
                generi: dati.generi || '', preferito: false, immagine: dati.immagine || '',
                tmdb_id: dati.tmdbId || null, abbandonata: !!dati.abbandonata
            }]);
            if (errIns) throw errIns;

            await supabaseClient.from('sinossi_serie_tv').insert([{ serie_titolo: dati.titolo, sinossi: '' }]);
            await registraLogSB_(dati.titolo, 'SERIE_TV', 'CREAZIONE', 'N/D', dati.stato || 'In corso');
            if (dati.abbandonata) await registraLogSB_(dati.titolo, 'SERIE_TV', 'ABBANDONO', 'N/D', 'Abbandonata');

            try {
                const stagioniTotaliNuove = parseInt(dati.stagioniTotali) || 0;
                if (stagioniTotaliNuove > 0) await aggiungiRigheStagioniSerieTvSB_(dati.titolo, 1, stagioniTotaliNuove, dati.episodiPerStagione, dati.anniPerStagione);
                if (dati.segnaComeVista) {
                    await segnaStagioniComeVisteSerieTvSB_(dati.titolo);
                    await ricalcolaSincronizzaELoggaSerieTvSB_(dati.titolo);
                }
            } catch (epErr) {
                console.error("Errore durante la creazione delle righe stagioni per '" + dati.titolo + "': " + epErr);
            }

            return getSerieTvDataSB_();
        }

        async function updateSerieTvSB_(vecchioTitolo, dati) {
            const vecchioTitoloTrim = String(vecchioTitolo).trim();
            const { data: righeVecchie, error: errSel } = await supabaseClient.from('serie_tv').select('*').eq('titolo', vecchioTitoloTrim);
            if (errSel) throw errSel;
            if (!righeVecchie || righeVecchie.length === 0) return getSerieTvDataSB_();
            const vecchiaRiga = righeVecchie[0];

            const vecchioStatoLog = vecchiaRiga.stato || 'In corso';
            const vecchieStagioniTotaliLog = vecchiaRiga.stagioni_totali || 0;

            const { error: errUpd } = await supabaseClient.from('serie_tv').update({
                titolo: dati.titolo, stato: dati.stato, note: dati.note,
                stagioni_totali: parseInt(dati.stagioniTotali) || 0,
                generi: dati.generi || '', immagine: dati.immagine || '',
                tmdb_id: dati.tmdbId || null, abbandonata: !!dati.abbandonata
            }).eq('titolo', vecchioTitoloTrim);
            if (errUpd) throw errUpd;

            const nuovoTitoloEffettivo = dati.titolo || vecchioTitolo;
            let risultatoProgresso = null;
            try {
                const nuoveStagioniTotaliEp = parseInt(dati.stagioniTotali) || 0;

                if (nuoveStagioniTotaliEp > vecchieStagioniTotaliLog) {
                    await aggiungiRigheStagioniSerieTvSB_(nuovoTitoloEffettivo, vecchieStagioniTotaliLog + 1, nuoveStagioniTotaliEp, dati.episodiPerStagione, dati.anniPerStagione);
                } else if (nuoveStagioniTotaliEp < vecchieStagioniTotaliLog) {
                    const avevaProgresso = await rimuoviRigheStagioniEccedentiSerieTvSB_(nuovoTitoloEffettivo, nuoveStagioniTotaliEp + 1);
                    if (avevaProgresso) console.warn("Rimosse righe stagioni con episodi giÃ  visti per '" + nuovoTitoloEffettivo + "'.");
                }

                if (dati.segnaComeVista) {
                    await segnaStagioniComeVisteSerieTvSB_(nuovoTitoloEffettivo);
                }
                risultatoProgresso = await ricalcolaSincronizzaELoggaSerieTvSB_(nuovoTitoloEffettivo);
            } catch (epErr) {
                console.error("Errore durante la sincronizzazione stagioni per '" + nuovoTitoloEffettivo + "': " + epErr);
            }

            try {
                const titoloLog = nuovoTitoloEffettivo;
                const nuovoStato = dati.stato || 'In corso';

                if (String(nuovoStato).trim() !== String(vecchioStatoLog).trim()) {
                    // Come negli anime: fine distribuzione, non fine visione.
                    await registraLogSB_(titoloLog, 'SERIE_TV', 'CAMBIO_STATO', vecchioStatoLog, nuovoStato);
                }
                const eraAbbandonataLog = !!vecchiaRiga.abbandonata;
                const oraAbbandonataLog = !!dati.abbandonata;
                if (oraAbbandonataLog && !eraAbbandonataLog) {
                    await registraLogSB_(titoloLog, 'SERIE_TV', 'ABBANDONO', 'In visione', 'Abbandonata');
                } else if (!oraAbbandonataLog && eraAbbandonataLog) {
                    await registraLogSB_(titoloLog, 'SERIE_TV', 'RIPRESA', 'Abbandonata', 'In visione');
                }
            } catch (logErr) {
                console.error("Errore durante la valutazione degli eventi di log per updateSerieTv: " + logErr);
            }

            return getSerieTvDataSB_();
        }

        async function deleteSerieTvSB_(titolo) {
            const { error } = await supabaseClient.from('serie_tv').delete().eq('titolo', String(titolo).trim());
            if (error) throw error;
            return getSerieTvDataSB_();
        }

        async function toggleSerieTvPreferitoSB_(titolo, preferitoStato) {
            const { error } = await supabaseClient.from('serie_tv').update({ preferito: !!preferitoStato }).eq('titolo', String(titolo).trim());
            if (error) throw error;
        }

        async function toggleAbbandonataSerieTvSB_(titolo, abbandonataStato) {
            const { error } = await supabaseClient.from('serie_tv').update({ abbandonata: !!abbandonataStato }).eq('titolo', String(titolo).trim());
            if (error) throw error;
        }

        // --- TMDB via Edge Function tmdb-proxy (stesso schema del Cinema) ---
        async function cercaCandidatiSerieTvTMDBSB_(query) {
            const { data, error } = await supabaseClient.functions.invoke('tmdb-proxy', {
                body: { action: 'tv_search', query: query }
            });
            if (error) throw new Error('Impossibile contattare TMDB. Riprova piÃ¹ tardi.');
            if (data && data.error) throw new Error(data.error);
            return data || [];
        }

        async function getDettaglioSerieTvTMDBSB_(id) {
            const { data, error } = await supabaseClient.functions.invoke('tmdb-proxy', {
                body: { action: 'tv_detail', id: id }
            });
            if (error) throw new Error('Impossibile recuperare i dettagli da TMDB. Riprova piÃ¹ tardi.');
            if (data && data.error) throw new Error(data.error);
            return data;
        }

        function caricaDatiSerieTv() {
            document.getElementById('loadingSerieTv').style.display = 'block';
            document.getElementById('serietvTable').style.display = 'none';

            getSerieTvDataSB_()
                .then(function(data) {
                    serieTvList = data || [];
                    return getTuttiEpisodiSerieTvSB_();
                })
                .then(function(epData) {
                    episodiSerieTvList = epData || [];
                    document.getElementById('loadingSerieTv').style.display = 'none';
                    document.getElementById('serietvTable').style.display = 'table';
                    renderListSerieTv();
                })
                .catch(function(err) {
                    console.error('Errore caricamento dati Serie TV da Supabase:', err);
                    document.getElementById('loadingSerieTv').style.display = 'none';
                    alert('âŒ Errore nel caricamento delle serie TV. Controlla la console per i dettagli.');
                });
        }

        // --- SUGGERIMENTI "POTREBBERO PIACERTI ANCHE" (Richiesta 34) ---
        // Bottone ðŸ’¡ in fondo alla riga serie TV (solo con tmdb_id): top 5
        // recommendations TMDB via proxy, esclusi i titoli giÃ  in lista.
        function normTitoloSugg_(s) {
            return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        }

        async function getSuggSerieTv_(tmdbId) {
            const res = await supabaseClient.functions.invoke('tmdb-proxy', {
                body: { action: 'tv_recommendations', id: tmdbId }
            });
            if (res.error) throw new Error('Impossibile contattare TMDB. Riprova piÃ¹ tardi.');
            const data = res.data;
            if (data && data.error) throw new Error(data.error);
            const lista = Array.isArray(data) ? data : [];
            // TMDB mischia film e serie: tieni solo serie (se l'Edge non
            // passa ancora il tipo, non filtrare per non svuotare tutto).
            return lista.filter(function(m) { return !m.tipo || m.tipo === 'tv'; });
        }

        // Generazione overlay: se l'utente apre un altro overlay mentre i
        // dettagli sono in volo, le risposte vecchie vengono scartate.
        let suggGen_ = 0;

        function mostraSuggOverlay_(titoloBase, candidati, kind) {
            suggGen_ += 1;
            let box = document.getElementById('suggOverlay');
            if (!box) {
                box = document.createElement('div');
                box.id = 'suggOverlay';
                box.className = 'modal-overlay';
                box.innerHTML =
                    '<div class="modal">' +
                    '<div class="modal-header"><h2 id="suggOverlayTitolo">Potrebbero piacerti anche</h2>' +
                    '<button class="close-modal" onclick="chiudiSuggOverlay()">&times;</button></div>' +
                    '<div id="suggOverlayLista" style="display:flex;flex-direction:column;gap:10px;"></div>' +
                    '</div>';
                box.addEventListener('click', function(e) { if (e.target === box) chiudiSuggOverlay(); });
                document.body.appendChild(box);
            }
            document.getElementById('suggOverlayTitolo').textContent = 'Potrebbero piacerti anche (da: ' + titoloBase + ')';
            const lista = document.getElementById('suggOverlayLista');
            if (candidati.length === 0) {
                lista.innerHTML = '<p style="font-size:13px;opacity:0.7;">Nessun suggerimento disponibile.</p>';
            } else {
                lista.innerHTML = candidati.map(function(c, i) {
                    const imgFull = c.immagine ? c.immagine.replace('/w342', '/w500') : '';
                    const img = c.immagine
                        ? '<img src="' + c.immagine + '" alt="" style="width:45px;height:65px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid var(--border-color);cursor:zoom-in;" loading="lazy" onclick="apriLightbox(\'' + imgFull + '\')">'
                        : '<div style="width:45px;height:65px;border-radius:6px;flex-shrink:0;border:1px solid var(--border-color);"></div>';
                    const meta = (c.anno ? c.anno : '') + ((c.voto !== null && c.voto !== undefined) ? ' Â· â­ ' + c.voto : '');
                    const safeSugg = String(c.titolo || '').replace(/'/g, "\\'");
                    const addBtn = (kind === 'serie')
                        ? '<button class="action-icon-btn" style="flex-shrink:0;color:var(--primary);font-size:16px;font-weight:700;" onclick="suggAggiungiSerieTv_(' + c.id + ')" title="Carica nella scheda nuova serie">ï¼‹</button>'
                        : (kind === 'cinema')
                        ? '<button class="action-icon-btn" style="flex-shrink:0;color:var(--primary);font-size:16px;font-weight:700;" onclick="suggAggiungiCinema_(' + c.id + ', \'' + safeSugg + '\')" title="Carica nella scheda nuovo film">ï¼‹</button>'
                        : (kind === 'manga')
                        ? '<button class="action-icon-btn" style="flex-shrink:0;color:var(--primary);font-size:16px;font-weight:700;" onclick="suggAggiungiManga_(\'' + safeSugg + '\')" title="Nuovo manga con questo titolo">ï¼‹</button>'
                        : '<button class="action-icon-btn" style="flex-shrink:0;color:var(--primary);font-size:16px;font-weight:700;" onclick="suggAggiungiAnime_(\'' + safeSugg + '\')" title="Nuovo anime con questo titolo">ï¼‹</button>';
                    return '<div style="display:flex;gap:12px;align-items:flex-start;">' + img +
                        '<div style="min-width:0;flex:1;"><div style="font-weight:600;">' + escapeHtmlSugg_(c.titolo) + '</div>' +
                        '<div id="suggMeta' + i + '" style="font-size:12px;opacity:0.7;">' + escapeHtmlSugg_(meta) + '</div>' +
                        '<div id="suggTrama' + i + '" class="sugg-trama" title="Clicca per espandere/comprimere" onclick="this.classList.toggle(\'trama-aperta\')" style="font-size:12px;opacity:0.85;margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;"></div></div>' + addBtn + '</div>';
                }).join('');
            }
            box.classList.add('active');
        }

        // Dettagli progressivi: trama, stato e stagioni per ogni suggerimento.
        // (Chiamato dal flusso serie/cinema DOPO mostra: mai da dentro mostra,
        // altrimenti i dettagli serie finirebbero anche sulle card dei film.)
        function arricchisciSuggSerieTv_(candidati) {
            const gen = suggGen_;
            candidati.slice(0, 5).forEach(function(c, i) {
                if (!c || !c.id) return;
                getDettaglioSerieTvTMDBSB_(c.id).then(function(d) {
                    if (!d || gen !== suggGen_) return;
                    const metaEl = document.getElementById('suggMeta' + i);
                    if (metaEl) {
                        const pezzi = [c.anno || '', d.stato || ''].filter(Boolean);
                        if (d.stagioni && d.stagioni.length > 0) pezzi.push(d.stagioni.length + (d.stagioni.length === 1 ? ' stagione' : ' stagioni'));
                        if (c.voto !== null && c.voto !== undefined) pezzi.push('â­ ' + c.voto);
                        metaEl.textContent = pezzi.join(' Â· ');
                    }
                    const tramaEl = document.getElementById('suggTrama' + i);
                    if (tramaEl && d.trama) tramaEl.textContent = d.trama;
                }).catch(function() {});
            });
        }

        function escapeHtmlSugg_(s) {
            return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function chiudiSuggOverlay() {
            suggGen_ += 1;
            const box = document.getElementById('suggOverlay');
            if (box) box.classList.remove('active');
        }

        async function suggSerieTv_(titolo) {
            const item = (typeof serieTvList !== 'undefined' ? serieTvList : []).find(function(x) { return x && x.titolo === titolo; });
            if (!item || !item.tmdbId) {
                showToast('Suggerimenti non disponibili senza ID TMDB.', 'error');
                return;
            }
            showToast('Cerco suggerimentiâ€¦');
            try {
                const posseduti = {};
                serieTvList.forEach(function(x) { if (x && x.titolo) posseduti[normTitoloSugg_(x.titolo)] = true; });
                posseduti[normTitoloSugg_(titolo)] = true;
                const res = await getSuggSerieTv_(item.tmdbId);
                const top = res.filter(function(c) { return !posseduti[normTitoloSugg_(c.titolo)]; }).slice(0, 5);
                mostraSuggOverlay_(titolo, top, 'serie');
                arricchisciSuggSerieTv_(top);
            } catch (err) {
                showToast(err.message || 'Suggerimenti non disponibili.', 'error');
            }
        }

        window.suggSerieTv_ = suggSerieTv_;
        window.chiudiSuggOverlay = chiudiSuggOverlay;

        // ï¼‹ da un suggerimento: apre la modale nuova serie e lancia lo stesso
        // precaricamento TMDB (stagioni incluse) del flusso manuale.
        function suggAggiungiSerieTv_(tmdbId) {
            chiudiSuggOverlay();
            const btn = document.getElementById('btnNuovaSerieTv');
            if (btn) btn.click();
            selezionaCandidatoSerieTvTMDB_(tmdbId);
        }

        window.suggAggiungiSerieTv_ = suggAggiungiSerieTv_;

        // ï¼‹ da un suggerimento film: modale nuovo film + stesso precaricamento.
        // Il contenitore preview esiste solo dopo una search: lo si crea qui.
        function suggAggiungiCinema_(tmdbId, titolo) {
            chiudiSuggOverlay();
            apriModaleNuovoCinema();
            const wrapper = document.getElementById('cinemaCandidatiWrapper');
            if (wrapper) wrapper.innerHTML = costruisciFooterCinemaManuale_();
            try {
                selezionaCandidatoCinema_(tmdbId, titolo || '');
            } catch (err) {
                showToast((err && err.message) || 'Apertura non riuscita.', 'error');
            }
        }

        window.suggAggiungiCinema_ = suggAggiungiCinema_;

        function renderListSerieTv() {
            const tbody = document.getElementById('serietvTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            // Contatori sopra i filtri: iniziate / stagioni viste / episodi visti / completate (verdi)
            let serieIniziateCount = 0;
            let serieTotaliCount = 0;
            let stagioniVisteTotali = 0;
            let stagioniTotaliGlobali = 0;
            let serieCompletateCount = 0;
            serieTvList.forEach(item => {
                if (!item) return;
                serieTotaliCount++;
                const sVis = parseInt(item.stagioniViste) || 0;
                const sTot = parseInt(item.stagioniTotali) || 0;
                stagioniVisteTotali += sVis;
                stagioniTotaliGlobali += sTot;
                if (sVis > 0 || haProgressoStagioniParzialeSerieTv(item.titolo)) serieIniziateCount++;
                if (item.coloreVisione === 'verde') serieCompletateCount++;
            });
            document.getElementById('statSerieTvIniziate').innerText = `${serieIniziateCount} / ${serieTotaliCount}`;
            document.getElementById('statSerieTvStagioniViste').innerText = `${stagioniVisteTotali} / ${stagioniTotaliGlobali}`;
            document.getElementById('statSerieTvCompletate').innerText = `${serieCompletateCount} / ${serieTotaliCount}`;

            let episodiVistiGlobali = 0;
            let episodiTotaliGlobali = 0;
            episodiSerieTvList.forEach(ep => {
                episodiVistiGlobali += parseInt(ep.episodiVisti) || 0;
                episodiTotaliGlobali += parseInt(ep.episodiTotali) || 0;
            });
            const statEpEl = document.getElementById('statSerieTvEpisodiVisti');
            if (statEpEl) statEpEl.innerText = `${episodiVistiGlobali} / ${episodiTotaliGlobali}`;

            let filtered = serieTvList.filter(item => {
                if (!item) return false;

                const titoloOriginale = item.titolo || '';
                let notaTestoSerie = "";
                if (item.note && typeof item.note === "string") {
                    notaTestoSerie = item.note.toLowerCase();
                } else if (item.note) {
                    notaTestoSerie = String(item.note).toLowerCase();
                }

                const termineRicerca = (currentSearchSerieTv || '').toLowerCase();
                const matchesSearch = (item.titolo || '').toLowerCase().includes(termineRicerca) || notaTestoSerie.includes(termineRicerca);

                const statoOriginale = item.stato || 'In corso';
                const statoClean = statoOriginale.trim().toLowerCase();
                let matchesStato = false;
                if (currentFilterStatoSerieTv === 'all') {
                    matchesStato = true;
                } else if (currentFilterStatoSerieTv === 'Altro') {
                    matchesStato = (statoClean !== 'in corso' && statoClean !== 'concluso');
                } else {
                    matchesStato = (statoClean === currentFilterStatoSerieTv.toLowerCase());
                }

                const stagioniTotali = parseInt(item.stagioniTotali) || 0;
                const stagioniViste = parseInt(item.stagioniViste) || 0;

                let coloreVisione = 'bianco';
                const completato = (stagioniViste === stagioniTotali);
                const iniziato = (stagioniViste > 0) || haProgressoStagioniParzialeSerieTv(item.titolo);
                if (!iniziato) {
                    coloreVisione = 'bianco';
                } else if (!completato) {
                    coloreVisione = 'celeste';
                } else {
                    coloreVisione = (statoClean === 'concluso') ? 'verde' : 'giallo';
                }
                if (item.abbandonata) coloreVisione = 'rosso';

                const matchesVisione = (currentFilterVisioneSerieTv === 'all' || coloreVisione === currentFilterVisioneSerieTv);

                // Filtro generi TMDB (logica AND, come il Cinema)
                let matchesGenres = true;
                if (selectedGenresSerieTv.length > 0) {
                    const itemGenres = item.generi ? item.generi.split(',').map(g => g.trim()) : [];
                    matchesGenres = selectedGenresSerieTv.every(g => itemGenres.includes(g));
                }

                let matchesFav = true;
                if (typeof currentFavFilterSerieTv !== 'undefined' && currentFavFilterSerieTv === 'yes') {
                    matchesFav = (item.preferito === true);
                }

                return matchesSearch && matchesStato && matchesVisione && matchesGenres && matchesFav;
            });

            const countEl = document.getElementById('countSerieTv');
            if (countEl) countEl.textContent = filtered.length + ' di ' + serieTvList.length + ' serie TV';

            const sortVal = document.getElementById('sortSelSerieTv').value;
            filtered.sort((a, b) => {
                const tA = a.titolo || '';
                const tB = b.titolo || '';
                if (sortVal === 'title-desc') return tB.localeCompare(tA);
                return tA.localeCompare(tB); // default: alfabetico A-Z
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

                let coloreVisione = 'bianco';
                const completato = (stagioniViste === stagioniTotali);
                const iniziato = (stagioniViste > 0) || haProgressoStagioniParzialeSerieTv(item.titolo);
                if (!iniziato) {
                    coloreVisione = 'bianco';
                } else if (!completato) {
                    coloreVisione = 'celeste';
                } else {
                    coloreVisione = (statoClean === 'concluso') ? 'verde' : 'giallo';
                }
                if (item.abbandonata) coloreVisione = 'rosso';

                const safeTitle = (item.titolo || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

                let genresHTML = '';
                if (item.generi && item.generi.trim() !== '') {
                    genresHTML = `<div class="genre-tags-list" style="color: var(--primary);">ðŸŽ­ ${item.generi}</div>`;
                }

                const starClass = item.preferito ? 'action-icon-btn is-favorite' : 'action-icon-btn';
                const starIcon = item.preferito ? 'â˜…' : 'â˜†';

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
                            <button class="${starClass}" style="color: var(--warning); font-size: 16px; flex-shrink: 0;" onclick="toggleFavoriteSerieTv('${safeTitle}', this)">${starIcon}</button>
                            ${avatarHTML}
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                    <span>${item.titolo || 'Senza Titolo'}</span>
                                    <button class="action-icon-btn" style="font-size: 13px; padding: 0; background: none; border: none; cursor: pointer;" onclick="mostraSinossi('${safeTitle}', 'serietv')" title="Visualizza Trama">â„¹ï¸</button>
                                    <button class="action-icon-btn" style="font-size: 13px; padding: 0; background: none; border: none; cursor: pointer;" onclick="apriGestioneStagioniSerieTv('${safeTitle}')" title="Gestisci Stagioni">ðŸ“º</button>
                                </div>
                                <div style="font-size: 12px; color: var(--text-muted); font-weight: normal;">
                                    Stagioni: <b>${stagioniViste}/${stagioniTotali}</b>${item.abbandonata ? ' <span style="color:#f87171; font-weight:700;">â›” Abbandonata</span>' : ''}
                                </div>
                                ${genresHTML}
                            </div>
                        </div>
                    </td>
                    <td><span class="status-badge ${statusClass}">${item.stato || '-'}</span></td>
                    <td style="color:var(--text-muted); font-size:13px;">${item.note || '-'}</td>
                    <td style="text-align: center;">
                        <span class="vision-box box-${coloreVisione}"></span>
                    </td>
                    <td style="text-align: center; white-space: nowrap;">

                        ${item.tmdbId ? `<button class="action-icon-btn" onclick="apriSeriesGraphSerieTv(${item.tmdbId})" title="Voti episodi su Series Graph">ðŸ“Š</button>` : ''}
                        ${item.tmdbId ? `<button class="action-icon-btn" onclick="suggSerieTv_('${safeTitle}')" title="Potrebbero piacerti anche">ðŸ’¡</button>` : ''}
                        <button class="action-icon-btn" onclick="aggiornaStagioniSerieTvDaTMDB('${safeTitle}')" title="Rileggi da TMDB: aggiunge eventuali nuove stagioni uscite">ðŸ”„</button>
                        <button class="action-icon-btn" onclick="apriModificaSerieTv('${safeTitle}')">âœï¸</button>
                        <button class="action-icon-btn" onclick="rimuoviSerieTv('${safeTitle}')">ðŸ—‘ï¸</button>
                        <button class="action-icon-btn" style="${item.abbandonata ? '' : 'opacity:0.45;'}" onclick="toggleAbbandonataSerieTv('${safeTitle}')" title="${item.abbandonata ? 'Riprendi la serie' : 'Abbandona la serie'}">â›”</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        document.getElementById('btnNuovaSerieTv').onclick = function() {
            targetEditTitleSerieTv = null;
            sinossiPendenteSerieTv = null;
            episodiPerStagionePendenteSerieTv = null;
            anniPerStagionePendenteSerieTv = null;
            generiSelezionatiSerieTv = '';
            tmdbIdSelezionatoSerieTv = null;
            document.getElementById('modalTitleSerieTv').innerText = "Nuova Serie TV";
            document.getElementById('serietvForm').reset();
            document.getElementById('inpStagioniTotaliSerieTv').value = 0;
            document.getElementById('inpStagioniVisteSerieTv').value = 0;
            document.getElementById('inpGeneriSerieTv').value = '';
            document.getElementById('inpImmagineSerieTv').value = '';
            document.getElementById('inpGiaVistaSerieTv').checked = false;
            document.getElementById('inpAbbandonataSerieTv').checked = false;
            document.getElementById('inpAbbandonataSerieTv').disabled = false;
            document.getElementById('serieTvCandidatiWrapper').innerHTML = '';
            document.getElementById('serieTvStagioniWrapper').innerHTML = '';
            document.getElementById('modalOverlaySerieTv').classList.add('active');
        };

        window.apriModificaSerieTv = function(titolo) {
            const item = serieTvList.find(s => s.titolo === titolo);
            if (!item) return;

            targetEditTitleSerieTv = titolo;
            sinossiPendenteSerieTv = null;
            episodiPerStagionePendenteSerieTv = null;
            anniPerStagionePendenteSerieTv = null;
            generiSelezionatiSerieTv = item.generi || '';
            tmdbIdSelezionatoSerieTv = item.tmdbId || null;
            document.getElementById('modalTitleSerieTv').innerText = "Modifica Serie TV";
            document.getElementById('inpTitoloSerieTv').value = item.titolo || '';
            document.getElementById('inpStatoSerieTv').value = ['In corso', 'Concluso', 'In arrivo'].includes(item.stato) ? item.stato : 'In corso';
            document.getElementById('inpStagioniTotaliSerieTv').value = item.stagioniTotali || 0;
            document.getElementById('inpStagioniVisteSerieTv').value = item.stagioniViste || 0;
            document.getElementById('inpGeneriSerieTv').value = item.generi || '';
            document.getElementById('inpNoteSerieTv').value = item.note || '';
            document.getElementById('inpImmagineSerieTv').value = item.immagine || '';
            // In modifica il flag nasce spuntato se la serie Ã¨ giÃ  tutta vista
            const giaTuttaVista = (parseInt(item.stagioniTotali) || 0) > 0 && (parseInt(item.stagioniViste) || 0) >= (parseInt(item.stagioniTotali) || 0);
            document.getElementById('inpGiaVistaSerieTv').checked = giaTuttaVista;
            // Serie verde (finita davvero): abbandonarla non ha senso.
            document.getElementById('inpAbbandonataSerieTv').checked = !!item.abbandonata;
            const eSerieVerde = giaTuttaVista && String(item.stato || '').trim().toLowerCase().includes('conclus');
            document.getElementById('inpAbbandonataSerieTv').disabled = eSerieVerde;
            document.getElementById('serieTvCandidatiWrapper').innerHTML = '';
            document.getElementById('serieTvStagioniWrapper').innerHTML = '';

            document.getElementById('modalOverlaySerieTv').classList.add('active');
        };

        // "GiÃ  vista" e "Abbandonata" si escludono a vicenda.
        document.getElementById('inpGiaVistaSerieTv').onchange = function() {
            if (this.checked) document.getElementById('inpAbbandonataSerieTv').checked = false;
        };
        document.getElementById('inpAbbandonataSerieTv').onchange = function() {
            if (this.checked) document.getElementById('inpGiaVistaSerieTv').checked = false;
        };

        document.getElementById('serietvForm').onsubmit = function(e) {
            e.preventDefault();

            const titoloForm = document.getElementById('inpTitoloSerieTv').value.trim();
            if (!titoloForm) {
                showToast('âŒ Inserisci un titolo.', 'error');
                return;
            }

            const sTot = parseInt(document.getElementById('inpStagioniTotaliSerieTv').value) || 0;
            const flagGiaVista = document.getElementById('inpGiaVistaSerieTv').checked;
            const isEdit = !!targetEditTitleSerieTv;

            // Il flag viene valutato PRIMA di mettere il pulsante in
            // "Salvataggio...", perchÃ© puÃ² interrompere il salvataggio.
            let segnaComeVista = false;
            if (flagGiaVista) {
                if (sTot <= 0) {
                    showToast('âŒ Con "Serie giÃ  vista" devi indicare almeno 1 stagione totale.', 'error');
                    return;
                }
                const itemCorrente = isEdit ? serieTvList.find(s => s.titolo === targetEditTitleSerieTv) : null;
                const giaCompleta = !!(itemCorrente && (parseInt(itemCorrente.stagioniTotali) || 0) > 0 &&
                    (parseInt(itemCorrente.stagioniViste) || 0) >= (parseInt(itemCorrente.stagioniTotali) || 0));
                if (!(isEdit && giaCompleta)) {
                    const statoForm = document.getElementById('inpStatoSerieTv').value || 'In corso';
                    const coloreRisultante = calcolaColoreVisioneSerieTv_(sTot, sTot, statoForm, true);
                    const etichettaColore = (coloreRisultante === 'verde') ? 'verde (completata)' :
                        (coloreRisultante === 'giallo') ? 'giallo (in pari: la serie non Ã¨ conclusa)' : coloreRisultante;
                    const ok = confirm('Segno "' + titoloForm + '" come vista per intero: ' + sTot + ' stagioni, tutti gli episodi con totale noto.\nLo stato di visione risultante sarÃ  ' + etichettaColore + '.\n\nProcedo con il salvataggio?');
                    if (!ok) return;
                }
                segnaComeVista = true;
            }

            // Flag "â›” Serie abbandonata": congela la serie (flag rosso, fuori
            // dal widget In Corso). Conferma solo sulla transizione, non a ogni
            // salvataggio. Prevale su "giÃ  vista".
            const flagAbbandonata = document.getElementById('inpAbbandonataSerieTv').checked;
            const itemCorrenteAbb = isEdit ? serieTvList.find(s => s.titolo === targetEditTitleSerieTv) : null;
            const eraAbbandonata = !!(itemCorrenteAbb && itemCorrenteAbb.abbandonata);
            let abbandonataNuova = false;
            if (flagAbbandonata) {
                if (!eraAbbandonata) {
                    const okAbbandono = confirm('Segno "' + titoloForm + '" come abbandonata: uscirÃ  dal widget "In Corso", il flag visione diventerÃ  rosso e il progresso resterÃ  congelato. Potrai riprenderla quando vuoi.\n\nProcedo con il salvataggio?');
                    if (!okAbbandono) return;
                }
                abbandonataNuova = true;
                segnaComeVista = false;
            }

            document.getElementById('btnSalvaSerieTv').innerText = "Salvataggio...";

            const dati = {
                titolo: titoloForm,
                stato: document.getElementById('inpStatoSerieTv').value || 'In corso',
                note: document.getElementById('inpNoteSerieTv').value,
                stagioniTotali: sTot,
                generi: generiSelezionatiSerieTv || '',
                immagine: document.getElementById('inpImmagineSerieTv').value,
                tmdbId: tmdbIdSelezionatoSerieTv || null,
                episodiPerStagione: episodiPerStagionePendenteSerieTv,
                anniPerStagione: anniPerStagionePendenteSerieTv,
                segnaComeVista: segnaComeVista,
                abbandonata: abbandonataNuova
            };
            const cb = function(data) {
                serieTvList = data || [];
                episodiPerStagionePendenteSerieTv = null;
                anniPerStagionePendenteSerieTv = null;
                generiSelezionatiSerieTv = '';
                tmdbIdSelezionatoSerieTv = null;
                // Trama TMDB scelta in sessione: la scriviamo ora, la riga in
                // sinossi_serie_tv esiste di sicuro (creata da add, o giÃ  presente).
                if (sinossiPendenteSerieTv) {
                    impostaSinossiSB_(dati.titolo, 'serietv', sinossiPendenteSerieTv)
                        .catch(function(err) {
                            console.error('Errore salvataggio trama TMDB: ' + err);
                            showToast('Serie salvata, ma la trama TMDB non Ã¨ stata scritta. Riprova dal pulsante TMDB.', 'error');
                        });
                    sinossiPendenteSerieTv = null;
                }
                // Ricarica anche gli episodi: le righe stagioni sono cambiate
                getTuttiEpisodiSerieTvSB_().then(function(epData) {
                    episodiSerieTvList = epData || [];
                    renderListSerieTv();
                }).catch(function() { renderListSerieTv(); });
                document.getElementById('btnSalvaSerieTv').innerText = "Salva";
                chiudiModale('SerieTv');
                showToast(isEdit ? 'Serie TV aggiornata con successo' : 'Serie TV aggiunta con successo', 'success');
            };
            const errorCb = function(err) {
                alert("âŒ Errore durante il salvataggio Serie TV: " + (err && err.message ? err.message : err));
                document.getElementById('btnSalvaSerieTv').innerText = "Salva";
            };

            if (targetEditTitleSerieTv) {
                updateSerieTvSB_(targetEditTitleSerieTv, dati).then(cb).catch(errorCb);
            } else {
                addSerieTvSB_(dati).then(cb).catch(errorCb);
            }
        };

        // ðŸ“Š Apre la pagina Series Graph della serie (voti IMDb per episodio).
        // Series Graph indirizza per TMDB ID: niente ambiguita di omonimi ne
        // problemi di lingua. Il bottone in riga esiste solo sulle serie collegate.
        window.apriSeriesGraphSerieTv = function(tmdbId) {
            const id = parseInt(tmdbId) || 0;
            if (!id) {
                showToast('Nessun collegamento TMDB per questa serie.', 'error');
                return;
            }
            window.open('https://seriesgraph.com/show/' + id, '_blank', 'noopener');
        };


        window.rimuoviSerieTv = function(titolo) {
            if (confirm("Eliminare definitivamente '" + titolo + "'?")) {
                deleteSerieTvSB_(titolo).then(function(data) {
                    serieTvList = data || [];
                    return getTuttiEpisodiSerieTvSB_();
                }).then(function(epData) {
                    episodiSerieTvList = epData || [];
                    renderListSerieTv();
                    showToast('Serie TV eliminata', 'success');
                }).catch(function(err) {
                    console.error('Errore eliminazione serie TV:', err);
                    alert("âŒ Errore durante l'eliminazione.");
                });
            }
        };

        window.toggleFavoriteSerieTv = function(titolo, btn) {
            const item = serieTvList.find(s => s.titolo === titolo);
            if (!item) return;
            const nuovoStato = !item.preferito;
            toggleSerieTvPreferitoSB_(titolo, nuovoStato).then(function() {
                item.preferito = nuovoStato;
                renderListSerieTv();
                showToast(nuovoStato ? 'Aggiunta ai preferiti' : 'Rimossa dai preferiti', 'success');
            }).catch(function(err) {
                console.error('Errore toggle preferito serie TV:', err);
                showToast('âŒ Errore aggiornamento preferito: ' + err.message, 'error');
            });
        };

        // â›” Toggle abbandono dal pulsante riga: congela (rosso, fuori dal
        // widget) o riprende. Solo la colonna + log dedicato, mai il progresso.
        window.toggleAbbandonataSerieTv = function(titolo) {
            const item = serieTvList.find(s => s.titolo === titolo);
            if (!item) return;
            if (item.coloreVisione === 'verde') {
                showToast('âŒ Serie completata: non ha senso abbandonarla.', 'error');
                return;
            }
            const nuovoStato = !item.abbandonata;
            const msg = nuovoStato
                ? 'Segno "' + titolo + '" come abbandonata: uscirÃ  dal widget "In Corso", il flag visione diventerÃ  rosso e il progresso resterÃ  congelato. Potrai riprenderla quando vuoi.\n\nProcedo?'
                : 'Riprendo "' + titolo + '"? TornerÃ  nel widget "In Corso" se in visione.';
            if (!confirm(msg)) return;
            toggleAbbandonataSerieTvSB_(titolo, nuovoStato)
                .then(function() {
                    return registraLogSB_(titolo, 'SERIE_TV', nuovoStato ? 'ABBANDONO' : 'RIPRESA',
                        nuovoStato ? 'In visione' : 'Abbandonata', nuovoStato ? 'Abbandonata' : 'In visione');
                })
                .then(function() { return getSerieTvDataSB_(); })
                .then(function(data) {
                    serieTvList = data || [];
                    renderListSerieTv();
                    showToast(nuovoStato ? 'â›” Serie abbandonata' : 'Serie ripresa', 'success');
                }).catch(function(err) {
                    console.error('Errore toggle abbandonata serie TV:', err);
                    showToast('âŒ Errore aggiornamento: ' + err.message, 'error');
                });
        };

        // ==========================================
        //   GESTIONE STAGIONI SERIE TV (Overlay dedicato)
        // ==========================================
        let stagioniSerieTvOverlayTitoloCorrente = null;

        // Secondo parametro facoltativo come negli anime: passato solo dalle
        // card del widget "In Corso", mostra la copertina di fianco all'elenco.
        window.apriGestioneStagioniSerieTv = function(titolo, mostraCopertina) {
            stagioniSerieTvOverlayTitoloCorrente = titolo;
            document.getElementById('stagioniSerieTvModalTitle').innerText = 'ðŸ“º Stagioni â€” ' + titolo;

            let conCopertina = false;
            if (mostraCopertina) {
                const serie = (serieTvList || []).find(x => (x.titolo || '').trim() === String(titolo).trim());
                conCopertina = renderCopertinaOverlay('stagioniSerieTvCopertina', serie);
            } else {
                nascondiCopertinaOverlay('stagioniSerieTvCopertina');
            }

            const modaleEl = document.querySelector('#modalOverlayStagioniSerieTv .modal');
            if (modaleEl) modaleEl.style.maxWidth = conCopertina ? '640px' : '560px';

            renderStagioniSerieTvOverlay();
            document.getElementById('modalOverlayStagioniSerieTv').classList.add('active');
        };

        window.chiudiModaleStagioniSerieTv = function() {
            document.getElementById('modalOverlayStagioniSerieTv').classList.remove('active');
            stagioniSerieTvOverlayTitoloCorrente = null;
        };

        function renderStagioniSerieTvOverlay() {
            const container = document.getElementById('stagioniSerieTvListContainer');
            if (!container || !stagioniSerieTvOverlayTitoloCorrente) return;

            const safeTitle = stagioniSerieTvOverlayTitoloCorrente.replace(/'/g, "\\'").replace(/"/g, '\\"');
            const righe = episodiSerieTvList
                .filter(ep => (ep.titolo || '').trim() === stagioniSerieTvOverlayTitoloCorrente.trim())
                .slice()
                .sort((a, b) => a.numero - b.numero);

            if (righe.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); padding: 20px 0; text-align:center;">Nessuna stagione registrata per questo titolo. Imposta le "Stagioni Totali" dal pulsante âœï¸ per generare le righe.</p>`;
                return;
            }

            let html = `<div class="section-title-label" style="margin:14px 0 10px 0; font-size:12px;">Stagioni</div>`;
            // Serie abbandonata: i visti sono congelati (banner + controlli
            // disabilitati/nascosti), i totali restano modificabili con âœï¸.
            const serieCorrenteOverlay = (serieTvList || []).find(function(x) { return (x.titolo || '').trim() === stagioniSerieTvOverlayTitoloCorrente.trim(); });
            const overlayCongelato = !!(serieCorrenteOverlay && serieCorrenteOverlay.abbandonata);
            if (overlayCongelato) {
                html += `<p style="color:#f87171; font-size:12.5px; font-weight:600; margin:0 0 6px 0;">â›” Serie abbandonata: i progressi sono congelati. Riprendila (â›” nella lista) per modificarli â€” i totali restano modificabili con âœï¸.</p>`;
            }
            righe.forEach((ep, idx) => {
                const totali = parseInt(ep.episodiTotali) || 0;
                const visti = parseInt(ep.episodiVisti) || 0;
                const completa = totali > 0 && visti >= totali;
                const precedente = idx > 0 ? righe[idx - 1] : null;
                const precedenteCompleta = !precedente || (parseInt(precedente.episodiTotali) > 0 && parseInt(precedente.episodiVisti) >= parseInt(precedente.episodiTotali));
                const bloccata = !precedenteCompleta;
                const percentuale = totali > 0 ? Math.min(100, Math.round((visti / totali) * 100)) : 0;
                const disabledMeno = (visti <= 0 || overlayCongelato) ? 'disabled' : '';
                const disabledPiu = (bloccata || overlayCongelato || (totali > 0 && visti >= totali)) ? 'disabled' : '';

                // âœ… = segna la stagione come tutta vista (solo se sbloccata e non
                // giÃ  completa); ðŸ”¢ = imposta a mano gli episodi visti.
                const btnTuttaVistaSerieTv = (!completa && !bloccata && !overlayCongelato)
                    ? `<button class="episodi-btn-edit" onclick="segnaStagioneComeVistaSerieTv('${safeTitle}', ${ep.numero})" title="Segna Stagione ${ep.numero} come tutta vista">âœ…</button>`
                    : '';
                const btnVistiManualSerieTv = overlayCongelato
                    ? ''
                    : `<button class="episodi-btn-edit" onclick="modificaVistiStagioneSerieTv('${safeTitle}', ${ep.numero}, ${visti}, ${totali})" title="Imposta manualmente gli episodi visti">ðŸ”¢</button>`;

                html += `
                    <div class="episodi-row ${bloccata ? 'locked' : ''}">
                        <div class="episodi-row-info">
                            <div class="episodi-row-title">ðŸŽžï¸ Stagione ${ep.numero}${ep.anno ? ' (' + ep.anno + ')' : ''} ${completa ? 'âœ…' : (bloccata ? 'ðŸ”’' : '')}
                                <button class="episodi-btn-edit" onclick="modificaTotaleStagioneSerieTv('${safeTitle}', ${ep.numero}, ${totali})" title="Modifica episodi totali">âœï¸</button>
                                ${btnVistiManualSerieTv}
                                ${btnTuttaVistaSerieTv}
                            </div>
                            <div class="episodi-row-count">${visti} / ${totali} episodi</div>
                            <div class="episodi-progress-outer"><div class="episodi-progress-inner" style="width:${percentuale}%;"></div></div>
                        </div>
                        <div class="episodi-row-actions">
                            <button class="episodi-btn" ${disabledMeno} onclick="incrementaStagioneSerieTv('${safeTitle}', ${ep.numero}, -1)">âˆ’</button>
                            <button class="episodi-btn" ${disabledPiu} onclick="incrementaStagioneSerieTv('${safeTitle}', ${ep.numero}, 1)">+</button>
                        </div>
                    </div>`;
            });

            container.innerHTML = html;
        }

        // senzaLogEpisodio = true per âœ…/ðŸ”¢ da overlay (popolamento archivio):
        // aggiorna i visti e ricalcola, ma non scrive righe nel log episodi.
        async function updateStagioneVistiSerieTvSB_(titolo, numero, delta, senzaLogEpisodio) {
            const titoloTrim = String(titolo).trim();
            const numeroInt = parseInt(numero) || 0;
            const deltaInt = parseInt(delta) || 0;

            const numeriDaLeggere = (deltaInt > 0 && numeroInt > 1) ? [numeroInt - 1, numeroInt] : [numeroInt];
            const { data: righe, error: errSel } = await supabaseClient
                .from('episodi_serie_tv').select('numero,episodi_totali,episodi_visti')
                .eq('serie_titolo', titoloTrim).in('numero', numeriDaLeggere);
            if (errSel) throw errSel;

            const rigaTarget = (righe || []).find(function(r) { return r.numero === numeroInt; });
            if (!rigaTarget) return { errore: 'Riga stagione non trovata.' };

            const episodiTotali = rigaTarget.episodi_totali;
            const episodiVistiAttuale = rigaTarget.episodi_visti;

            if (deltaInt > 0 && numeroInt > 1) {
                const rigaPrec = righe.find(function(r) { return r.numero === numeroInt - 1; });
                const rigaPrecedenteCompleta = !!(rigaPrec && rigaPrec.episodi_totali > 0 && rigaPrec.episodi_visti >= rigaPrec.episodi_totali);
                if (!rigaPrecedenteCompleta) {
                    return { errore: 'Devi prima completare la Stagione ' + (numeroInt - 1) + '.' };
                }
            }

            let nuovoValore = episodiVistiAttuale + deltaInt;
            if (nuovoValore < 0) nuovoValore = 0;
            if (episodiTotali > 0 && nuovoValore > episodiTotali) nuovoValore = episodiTotali;

            const { error: errUpd } = await supabaseClient
                .from('episodi_serie_tv').update({ episodi_visti: nuovoValore })
                .eq('serie_titolo', titoloTrim).eq('numero', numeroInt);
            if (errUpd) throw errUpd;

            const risultatoSync = await ricalcolaSincronizzaELoggaSerieTvSB_(titoloTrim);

            if (nuovoValore !== episodiVistiAttuale && !senzaLogEpisodio) {
                await registraLogEpisodioSB_(
                    titoloTrim, 'Stagione', numeroInt, episodiVistiAttuale, nuovoValore, episodiTotali,
                    (nuovoValore > episodiVistiAttuale) ? 'VISTO' : 'RIMOSSO',
                    (risultatoSync && risultatoSync.eventoLoggato) || '',
                    'SERIE_TV'
                );
            }

            const [serieAggiornate, episodiTutti] = await Promise.all([getSerieTvDataSB_(), getTuttiEpisodiSerieTvSB_()]);
            return { episodiVisti: nuovoValore, episodiTotali: episodiTotali, serie: serieAggiornate, episodiTutti: episodiTutti };
        }

        async function updateStagioneTotaliSerieTvSB_(titolo, numero, nuovoTotale) {
            const titoloTrim = String(titolo).trim();
            const numeroInt = parseInt(numero) || 0;

            const { data: righeTarget, error: errSel } = await supabaseClient
                .from('episodi_serie_tv').select('episodi_visti')
                .eq('serie_titolo', titoloTrim).eq('numero', numeroInt);
            if (errSel) throw errSel;
            if (!righeTarget || righeTarget.length === 0) return { errore: 'Riga stagione non trovata.' };

            let totaleNuovo = parseInt(nuovoTotale) || 0;
            if (totaleNuovo < 0) totaleNuovo = 0;

            let episodiVistiNuovo = righeTarget[0].episodi_visti;
            if (episodiVistiNuovo > totaleNuovo) episodiVistiNuovo = totaleNuovo;

            const { error: errUpd } = await supabaseClient
                .from('episodi_serie_tv').update({ episodi_totali: totaleNuovo, episodi_visti: episodiVistiNuovo })
                .eq('serie_titolo', titoloTrim).eq('numero', numeroInt);
            if (errUpd) throw errUpd;

            await ricalcolaSincronizzaELoggaSerieTvSB_(titoloTrim);

            const [serieAggiornate, episodiTutti] = await Promise.all([getSerieTvDataSB_(), getTuttiEpisodiSerieTvSB_()]);
            return { episodiVisti: episodiVistiNuovo, episodiTotali: totaleNuovo, serie: serieAggiornate, episodiTutti: episodiTutti };
        }

        window.incrementaStagioneSerieTv = function(titolo, numero, delta) {
            updateStagioneVistiSerieTvSB_(titolo, numero, delta)
                .then(function(result) {
                    if (result && result.errore) {
                        showToast(result.errore, 'error');
                        return;
                    }
                    serieTvList = result.serie || serieTvList;
                    episodiSerieTvList = result.episodiTutti || episodiSerieTvList;
                    renderStagioniSerieTvOverlay();
                    renderListSerieTv();
                    aggiornaLogStagioniSerieTvSeVisibile();
                    if (document.getElementById('homeProgressList')) {
                        renderWidgetInCorso();
                    }
                })
                .catch(function(err) {
                    showToast('âŒ Errore aggiornamento episodio: ' + err.message, 'error');
                });
        };

        window.modificaTotaleStagioneSerieTv = function(titolo, numero, totaleAttuale) {
            const nuovoTotaleStr = prompt(`Numero totale episodi per Stagione ${numero}:`, totaleAttuale);
            if (nuovoTotaleStr === null) return; // annullato
            const nuovoTotale = parseInt(nuovoTotaleStr);
            if (isNaN(nuovoTotale) || nuovoTotale < 0) {
                showToast('âŒ Inserisci un numero valido', 'error');
                return;
            }

            updateStagioneTotaliSerieTvSB_(titolo, numero, nuovoTotale)
                .then(function(result) {
                    if (result && result.errore) {
                        showToast(result.errore, 'error');
                        return;
                    }
                    serieTvList = result.serie || serieTvList;
                    episodiSerieTvList = result.episodiTutti || episodiSerieTvList;
                    renderStagioniSerieTvOverlay();
                    renderListSerieTv();
                    showToast('Totale episodi aggiornato', 'success');
                })
                .catch(function(err) {
                    showToast('âŒ Errore aggiornamento totale episodi: ' + err.message, 'error');
                });
        };

        // âœ… Segna la stagione come tutta vista in un colpo solo. Delega a
        // updateStagioneVistiSerieTvSB_ col delta mancante, cosÃ¬ restano validi
        // vincolo sequenziale, log SERIE_TV e ricalcolo (stesso schema anime).
        window.segnaStagioneComeVistaSerieTv = function(titolo, numero) {
            const riga = (episodiSerieTvList || []).find(function(e) {
                return (e.titolo || '').trim() === String(titolo).trim() && parseInt(e.numero) === parseInt(numero);
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
                showToast('Stagione giÃ  completa.', 'success');
                return;
            }
            updateStagioneVistiSerieTvSB_(titolo, numero, totali - visti, true)
                .then(function(result) {
                    if (result && result.errore) {
                        showToast(result.errore, 'error');
                        return;
                    }
                    serieTvList = result.serie || serieTvList;
                    episodiSerieTvList = result.episodiTutti || episodiSerieTvList;
                    if (document.getElementById('homeProgressList')) {
                        renderWidgetInCorso();
                    }
                    renderStagioniSerieTvOverlay();
                    renderListSerieTv();
                    aggiornaLogStagioniSerieTvSeVisibile();
                    showToast('âœ… Stagione ' + numero + ' segnata come tutta vista', 'success');
                })
                .catch(function(err) {
                    showToast('âŒ Errore aggiornamento episodio: ' + err.message, 'error');
                });
        };

        // ðŸ”¢ Imposta a mano gli episodi visti (stesso schema di
        // modificaVistiEpisodi negli anime: aumenti sequenziali, diminuzioni
        // libere, rifiuto oltre il totale).
        window.modificaVistiStagioneSerieTv = function(titolo, numero, vistiAttuali, totaleAttuale) {
            const totali = parseInt(totaleAttuale) || 0;
            const intervallo = totali > 0 ? ' (0â€“' + totali + ')' : '';
            const nuovoVistiStr = prompt(`Episodi visti per Stagione ${numero}${intervallo}:`, vistiAttuali);
            if (nuovoVistiStr === null) return; // annullato
            const nuovoVisti = parseInt(nuovoVistiStr);
            if (isNaN(nuovoVisti) || nuovoVisti < 0) {
                showToast('âŒ Inserisci un numero valido', 'error');
                return;
            }
            if (totali > 0 && nuovoVisti > totali) {
                showToast('âŒ Il massimo per Stagione ' + numero + ' Ã¨ ' + totali + ' episodi.', 'error');
                return;
            }
            const visti = parseInt(vistiAttuali) || 0;
            if (nuovoVisti === visti) {
                showToast('Nessuna modifica.', 'success');
                return;
            }
            updateStagioneVistiSerieTvSB_(titolo, numero, nuovoVisti - visti, true)
                .then(function(result) {
                    if (result && result.errore) {
                        showToast(result.errore, 'error');
                        return;
                    if (document.getElementById('homeProgressList')) {
                        renderWidgetInCorso();
                    }
                    }
                    serieTvList = result.serie || serieTvList;
                    episodiSerieTvList = result.episodiTutti || episodiSerieTvList;
                    renderStagioniSerieTvOverlay();
                    renderListSerieTv();
                    aggiornaLogStagioniSerieTvSeVisibile();
                    showToast('Episodi visti aggiornati', 'success');
                })
                .catch(function(err) {
                    showToast('âŒ Errore aggiornamento episodi visti: ' + err.message, 'error');
                });
        };

        // ==========================================================
        // ðŸ•˜ LOG EPISODI SERIE TV (linguetta dentro la vista)
        // ==========================================================
        function switchSerieTvSubview(subview) {
            const paneLista = document.getElementById('serietvPaneLista');
            const paneLog = document.getElementById('serietvPaneLog');
            const tabLista = document.getElementById('tabSerieTvLista');
            const tabLog = document.getElementById('tabSerieTvLog');
            if (!paneLista || !paneLog || !tabLista || !tabLog) return;

            if (subview === 'log') {
                paneLista.style.display = 'none';
                paneLog.style.display = 'block';
                tabLista.classList.remove('active');
                tabLog.classList.add('active');
                caricaLogStagioniSerieTv();
            } else {
                paneLog.style.display = 'none';
                paneLista.style.display = 'block';
                tabLog.classList.remove('active');
                tabLista.classList.add('active');
            }
        }

        function caricaLogStagioniSerieTv() {
            const loadingEl = document.getElementById('loadingStagioniLog');
            const tableEl = document.getElementById('stagioniLogTable');
            const btnRefresh = document.getElementById('btnRefreshStagioniLog');
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

            const inputTitolo = document.getElementById('filterStagioniLogTitolo');
            const selAzione = document.getElementById('filterStagioniLogAzione');
            const inputDal = document.getElementById('filterStagioniLogDal');
            const inputAl = document.getElementById('filterStagioniLogAl');
            const btnOrdine = document.getElementById('btnToggleStagioniLogOrdine');

            const filtroTitolo = inputTitolo ? inputTitolo.value.trim() : '';
            const filtroAzione = selAzione ? selAzione.value : 'all';
            const dataDal = inputDal ? inputDal.value : '';
            const dataAl = inputAl ? inputAl.value : '';
            const ordineAsc = btnOrdine ? (btnOrdine.getAttribute('data-asc') === 'true') : false;

            const filtriAttivi = (filtroTitolo !== '' || filtroAzione !== 'all' || dataDal !== '' || dataAl !== '');

            // Le serie TV scrivono solo righe di tipo 'Stagione': il filtro
            // per tipo Ã¨ fisso e non serve il selettore nella testata.
            ottieniLogEpisodiSB_(filtroTitolo, 'Stagione', filtroAzione, dataDal, dataAl, ordineAsc, 'SERIE_TV')
                .then(function(logs) {
                    if (loadingEl) loadingEl.style.display = 'none';
                    if (btnRefresh) {
                        btnRefresh.classList.remove('spinning');
                        btnRefresh.disabled = false;
                    }
                    tableEl.style.display = 'table';
                    renderLogStagioniSerieTv(logs || [], filtriAttivi);
                })
                .catch(function(err) {
                    console.error('Errore nel caricamento del Log Episodi Serie TV:', err);
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

        function renderLogStagioniSerieTv(logs, filtriAttivi) {
            const bodyEl = document.getElementById('stagioniLogTableBody');
            const emptyEl = document.getElementById('stagioniLogEmpty');
            const countEl = document.getElementById('countStagioniLog');
            if (!bodyEl) return;

            bodyEl.innerHTML = '';

            if (countEl) countEl.innerText = logs && logs.length ? (logs.length + ' risultati') : '';

            if (!logs || logs.length === 0) {
                document.getElementById('stagioniLogTable').style.display = 'none';
                if (emptyEl) {
                    emptyEl.style.display = 'block';
                    emptyEl.innerText = filtriAttivi
                        ? 'Nessun episodio trovato con i filtri selezionati. ðŸ”'
                        : 'Nessun episodio registrato finora. ðŸ“¡';
                }
                return;
            }
            if (emptyEl) emptyEl.style.display = 'none';

            logs.forEach(function(log) {
                const tr = document.createElement('tr');

                const isVisto = String(log.azione).toUpperCase() === 'VISTO';

                // Come negli anime: il "Visto" che chiude l'ultimo episodio della
                // stagione mostra la dicitura composta invece dell'esito grezzo
                // (COMPLETAMENTO -> Serie completata, altrimenti -> Stagione completata).
                const haCompletatoStagione = isVisto && (parseInt(log.episodiTotali) || 0) > 0 &&
                    (parseInt(log.episodioInteressato) || 0) === (parseInt(log.episodiTotali) || 0);

                let azioneBadge;
                if (haCompletatoStagione && String(log.esito).toUpperCase() === 'COMPLETAMENTO') {
                    azioneBadge = '<span class="ep-log-azione ep-log-azione-completato-serietv">âœ… Visto â€” ðŸ† Serie completata</span>';
                } else if (haCompletatoStagione) {
                    azioneBadge = '<span class="ep-log-azione ep-log-azione-completato-unita">âœ… Visto â€” ðŸŽžï¸ Stagione completata</span>';
                } else if (isVisto) {
                    azioneBadge = '<span class="log-badge" style="background:rgba(52,211,153,.15); color:#6ee7b7; border:1px solid rgba(52,211,153,.4);">âœ… Visto</span>';
                } else {
                    azioneBadge = '<span class="log-badge" style="background:rgba(248,113,113,.15); color:#fca5a5; border:1px solid rgba(248,113,113,.4);">â†©ï¸ Rimosso</span>';
                }

                tr.innerHTML =
                    '<td style="white-space:nowrap;">' + formatLogTimestamp(log.timestamp) + '</td>' +
                    '<td>' + escapeHtmlLog(log.titolo || '') + '</td>' +
                    '<td><span class="ep-log-badge-stagione">ðŸŽžï¸ Stagione ' + (parseInt(log.numero) || 0) + '</span></td>' +
                    '<td style="text-align:center;">Ep. ' + (parseInt(log.episodioInteressato) || 0) + '/' + (parseInt(log.episodiTotali) || 0) + '</td>' +
                    '<td style="text-align:center;">' + azioneBadge + '</td>';

                bodyEl.appendChild(tr);
            });
        }

        (function initStagioniLogFilters() {
            const inputTitolo = document.getElementById('filterStagioniLogTitolo');
            const selAzione = document.getElementById('filterStagioniLogAzione');
            const inputDal = document.getElementById('filterStagioniLogDal');
            const inputAl = document.getElementById('filterStagioniLogAl');
            if (inputTitolo) inputTitolo.addEventListener('input', caricaLogStagioniSerieTv);
            if (selAzione) selAzione.addEventListener('change', caricaLogStagioniSerieTv);
            if (inputDal) inputDal.addEventListener('change', caricaLogStagioniSerieTv);
            if (inputAl) inputAl.addEventListener('change', caricaLogStagioniSerieTv);

            const btnOrdine = document.getElementById('btnToggleStagioniLogOrdine');
            if (btnOrdine) btnOrdine.addEventListener('click', function() {
                const asc = btnOrdine.getAttribute('data-asc') === 'true';
                btnOrdine.setAttribute('data-asc', asc ? 'false' : 'true');
                btnOrdine.innerHTML = asc ? 'â¬‡ï¸ Recenti' : 'â¬†ï¸ Vecchi';
                caricaLogStagioniSerieTv();
            });
        })();

        (function initStagioniLogActions() {
            const btnReset = document.getElementById('btnResetStagioniLogFiltri');
            if (btnReset) btnReset.addEventListener('click', function() {
                document.getElementById('filterStagioniLogTitolo').value = '';
                document.getElementById('filterStagioniLogAzione').value = 'all';
                document.getElementById('filterStagioniLogDal').value = '';
                document.getElementById('filterStagioniLogAl').value = '';
                const btnOrdine = document.getElementById('btnToggleStagioniLogOrdine');
                if (btnOrdine) {
                    btnOrdine.setAttribute('data-asc', 'false');
                    btnOrdine.innerHTML = 'â¬‡ï¸ Recenti';
                }
                caricaLogStagioniSerieTv();
            });

            const btnRefresh = document.getElementById('btnRefreshStagioniLog');
            if (btnRefresh) btnRefresh.addEventListener('click', caricaLogStagioniSerieTv);
        })();

        function aggiornaLogStagioniSerieTvSeVisibile() {
            const paneLog = document.getElementById('serietvPaneLog');
            if (paneLog && paneLog.style.display !== 'none') {
                caricaLogStagioniSerieTv();
            }
        }

        // ==========================================
        //   TMDB SERIE TV (ricerca + dettaglio + stagioni)
        // ==========================================
        let ultimoDettaglioSerieTvTMDB = null;

        function cercaSerieTvTMDB() {
            const titolo = document.getElementById('inpTitoloSerieTv').value.trim();
            if (!titolo) {
                alert('Inserisci prima un titolo da cercare.');
                return;
            }

            const wrapper = document.getElementById('serieTvCandidatiWrapper');
            document.getElementById('serieTvStagioniWrapper').innerHTML = '';
            wrapper.innerHTML = `<p style="color: var(--warning); font-weight:600;">â³ Ricerca su TMDB in corso...</p>`;

            cercaCandidatiSerieTvTMDBSB_(titolo)
                .then(function(candidati) { renderCandidatiSerieTvTMDB_(candidati); })
                .catch(function(err) { renderErroreSerieTvTMDB_(err); });
        }

        function renderCandidatiSerieTvTMDB_(candidati) {
            const wrapper = document.getElementById('serieTvCandidatiWrapper');

            if (!candidati || candidati.length === 0) {
                wrapper.innerHTML = `<p style="color: var(--text-muted);">Nessun risultato trovato su TMDB per questo titolo. Puoi comunque salvare la serie inserendo i dati manualmente.</p>`;
                return;
            }

            let grid = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap:10px; margin-top:10px;">';
            candidati.forEach(function(c) {
                const safeImg = (c.immagine || '').replace(/'/g, "\\'");
                grid += `
                    <div class="cinema-candidato-card" style="cursor:pointer; border:1px solid var(--border-color); border-radius:8px; overflow:hidden; background: rgba(255,255,255,0.03);" onclick="selezionaCandidatoSerieTvTMDB_(${c.id}, '${(c.titolo || '').replace(/'/g, "\\'")}')">
                        <img src="${safeImg}" style="width:100%; height:150px; object-fit:cover; display:block; background:#222;">
                        <div style="padding:6px; font-size:11px; line-height:1.3; color: var(--text);">${c.titolo}${c.anno ? ' (' + c.anno + ')' : ''}</div>
                    </div>
                `;
            });
            grid += '</div>';
            wrapper.innerHTML = grid;
        }

        function selezionaCandidatoSerieTvTMDB_(id) {
            const wrapper = document.getElementById('serieTvCandidatiWrapper');
            wrapper.innerHTML = `<p style="color: var(--warning); font-weight:600;">â³ Recupero dettagli da TMDB...</p>`;

            getDettaglioSerieTvTMDBSB_(id)
                .then(function(dettaglio) { renderDettaglioSerieTvTMDB_(dettaglio); })
                .catch(function(err) { renderErroreSerieTvTMDB_(err); });
        }

        function renderDettaglioSerieTvTMDB_(dettaglio) {
            ultimoDettaglioSerieTvTMDB = dettaglio;
            const wrapper = document.getElementById('serieTvCandidatiWrapper');
            const stagioniWrap = document.getElementById('serieTvStagioniWrapper');

            const safeImg = (dettaglio.immagine || '').replace(/'/g, "\\'");
            const tramaAnteprima = dettaglio.trama && dettaglio.trama.length > 160
                ? dettaglio.trama.substring(0, 160) + 'â€¦'
                : (dettaglio.trama || 'â€”');

            wrapper.innerHTML = `
                <div style="display:flex; gap:12px; margin-top:10px; padding:10px; border:1px solid var(--border-color); border-radius:8px; background: rgba(255,255,255,0.03);">
                    ${safeImg ? `<img src="${safeImg}" style="width:90px; border-radius:6px; object-fit:cover;">` : ''}
                    <div style="flex:1; font-size:13px; line-height:1.5;">
                        <div style="font-weight:700; font-size:14px;">${dettaglio.titolo || ''}</div>
                        <div style="color:var(--text-muted);">Stato: ${dettaglio.stato || 'In corso'}</div>
                        ${dettaglio.generi ? `<div>ðŸ·ï¸ ${dettaglio.generi}</div>` : ''}
                        <div style="font-style:italic; color:var(--text-muted); margin-top:4px;">${tramaAnteprima}</div>
                        <button type="button" class="btn btn-serietv" style="margin-top:8px;" onclick="confermaDatiSerieTvTMDB_()">âœ… Usa questi dati</button>
                    </div>
                </div>
            `;

            const stagioni = dettaglio.stagioni || [];
            if (stagioni.length === 0) {
                stagioniWrap.innerHTML = `<p style="color:var(--text-muted); font-size:13px;">TMDB non elenca stagioni per questa serie: inserisci il numero a mano.</p>`;
                return;
            }

            let checkHtml = '<div style="margin-top:10px; padding:10px; border:1px dashed var(--border-color); border-radius:8px;">'
                + '<div style="font-weight:700; font-size:13px; margin-bottom:6px;">ðŸ“¡ Stagioni trovate su TMDB (spunta quelle da caricare)</div>';
            stagioni.forEach(function(s) {
                checkHtml += `<label style="display:flex; align-items:center; gap:8px; font-size:13px; padding:3px 0;">`
                    + `<input type="checkbox" class="serietv-tmdb-stagione-cb" data-numero="${s.numero}" data-episodi="${s.episodi || 0}" data-anno="${s.anno || ''}" checked>`
                    + `<span>Stagione ${s.numero} â€” ${s.episodi || 0} episodi${s.anno ? ' (' + s.anno + ')' : ''}</span>`
                    + `</label>`;
            });
            checkHtml += '<button type="button" class="btn btn-serietv" style="margin-top:8px;" onclick="applicaStagioniSerieTvTMDB_()">âœ… Applica stagioni spuntate</button></div>';
            stagioniWrap.innerHTML = checkHtml;
        }

        function renderErroreSerieTvTMDB_(err) {
            const wrapper = document.getElementById('serieTvCandidatiWrapper');
            wrapper.innerHTML = `<p style="color:#f87171;">âŒ ${((err && err.message) ? err.message : err)}</p>`;
        }

        // Scrive titolo/stato/immagine/generi/trama nel modale (le stagioni
        // restano da applicare a parte, come le relazioni AniList).
        function confermaDatiSerieTvTMDB_() {
            const dettaglio = ultimoDettaglioSerieTvTMDB;
            if (!dettaglio) return;
            document.getElementById('inpTitoloSerieTv').value = dettaglio.titolo || '';
            const statoSel = document.getElementById('inpStatoSerieTv');
            if (['In corso', 'Concluso', 'In arrivo'].includes(dettaglio.stato)) statoSel.value = dettaglio.stato;
            document.getElementById('inpImmagineSerieTv').value = dettaglio.immagine || '';
            generiSelezionatiSerieTv = dettaglio.generi || '';
            document.getElementById('inpGeneriSerieTv').value = generiSelezionatiSerieTv;
            sinossiPendenteSerieTv = dettaglio.trama || null;
            tmdbIdSelezionatoSerieTv = dettaglio.id || null;
            showToast('Dati TMDB importati: ora spunta le stagioni e premi Applica', 'success');
        }

        function applicaStagioniSerieTvTMDB_() {
            const checked = Array.from(document.querySelectorAll('.serietv-tmdb-stagione-cb:checked'));
            if (checked.length === 0) {
                showToast('âŒ Spunta almeno una stagione.', 'error');
                return;
            }
            const mappa = {};
            const mappaAnni = {};
            checked.forEach(function(cb) {
                const numStagione = parseInt(cb.getAttribute('data-numero')) || 0;
                mappa[numStagione] = parseInt(cb.getAttribute('data-episodi')) || 0;
                const annoStagione = parseInt(cb.getAttribute('data-anno')) || 0;
                if (annoStagione > 0) mappaAnni[numStagione] = annoStagione;
            });
            episodiPerStagionePendenteSerieTv = mappa;
            anniPerStagionePendenteSerieTv = mappaAnni;
            document.getElementById('inpStagioniTotaliSerieTv').value = checked.length;
            showToast(checked.length + ' stagioni pronte al salvataggio', 'success');
        }

        // ðŸ”„ Rilegge la serie da TMDB e aggiunge solo le stagioni nuove
        // (numero maggiore del massimo giÃ  salvato). Non cancella e non
        // sovrascrive mai nulla: le correzioni restano manuali.
        window.aggiornaStagioniSerieTvDaTMDB = function(titolo) {
            const item = serieTvList.find(s => s.titolo === titolo);
            if (!item) return;
            if (!item.tmdbId) {
                showToast('âŒ Nessun collegamento TMDB per questa serie (aggiunta a mano).', 'error');
                return;
            }

            showToast('â³ Rileggo la serie da TMDB...', 'success');
            getDettaglioSerieTvTMDBSB_(item.tmdbId)
                .then(function(dettaglio) {
                    const stagioniTMDB = dettaglio.stagioni || [];
                    if (stagioniTMDB.length === 0) {
                        showToast('TMDB non elenca stagioni per questa serie.', 'error');
                        return;
                    }
                    const maxSalvata = parseInt(item.stagioniTotali) || 0;
                    const nuove = stagioniTMDB.filter(s => (parseInt(s.numero) || 0) > maxSalvata);
                    if (nuove.length === 0) {
                        showToast('âœ… Serie giÃ  aggiornata: nessuna nuova stagione su TMDB.', 'success');
                        return;
                    }
                    const mappa = {};
                    const mappaAnni = {};
                    nuove.forEach(function(s) {
                        const numStagione = parseInt(s.numero) || 0;
                        mappa[numStagione] = parseInt(s.episodi) || 0;
                        const annoStagione = parseInt(s.anno) || 0;
                        if (annoStagione > 0) mappaAnni[numStagione] = annoStagione;
                    });
                    const maxNuovo = Math.max.apply(null, stagioniTMDB.map(s => parseInt(s.numero) || 0));

                    const dati = {
                        titolo: item.titolo, stato: item.stato, note: (item.note || '').replace(/<[^>]*>/g, ''),
                        stagioniTotali: Math.max(maxSalvata, maxNuovo),
                        generi: item.generi || '', immagine: item.immagine || '',
                        tmdbId: item.tmdbId, episodiPerStagione: mappa, anniPerStagione: mappaAnni, segnaComeVista: false
                    };
                    return updateSerieTvSB_(item.titolo, dati).then(function(data) {
                        serieTvList = data || [];
                        return getTuttiEpisodiSerieTvSB_();
                    }).then(function(epData) {
                        episodiSerieTvList = epData || [];
                        renderListSerieTv();
                        return registraLogSB_(item.titolo, 'SERIE_TV', 'AVANZAMENTO', 'N/D', 'Nuove stagioni da TMDB: ' + nuove.map(s => s.numero).join(', '));
                    }).then(function() {
                        showToast('ðŸ“¡ Aggiunte ' + nuove.length + ' nuove stagioni da TMDB', 'success');
                    });
                })
                .catch(function(err) {
                    console.error('Errore aggiornamento TMDB serie TV:', err);
                    showToast('âŒ Errore aggiornamento da TMDB: ' + (err && err.message ? err.message : err), 'error');
                });
        };

        function resetFiltriSerieTv() {
            currentSearchSerieTv = '';
            currentFilterStatoSerieTv = 'all';
            currentFilterVisioneSerieTv = 'all';
            currentFavFilterSerieTv = 'all';
            selectedGenresSerieTv = [];

            document.getElementById('searchInpSerieTv').value = '';
            document.getElementById('sortSelSerieTv').value = 'title-asc';

            ['filterGroupStatoSerieTv', 'filterGroupVisioneSerieTv', 'filterGroupPreferitiSerieTv'].forEach(function(groupId) {
                const group = document.getElementById(groupId);
                if (!group) return;
                group.querySelectorAll('.filter-btn').forEach(function(btn) { btn.classList.remove('active'); });
                const first = group.querySelector('.filter-btn');
                if (first) first.classList.add('active');
            });

            document.querySelectorAll('.serietv-filter-genre-cb:checked').forEach(function(cb) { cb.checked = false; });
            const badgeSerieTv = document.getElementById('badgeGenresSerieTvCount');
            if (badgeSerieTv) badgeSerieTv.innerText = '0';

            renderListSerieTv();
            showToast('Filtri Serie TV azzerati', 'success');
        }

        // Listener Real-Time per input e bottoni categoria Serie TV
        document.getElementById('searchInpSerieTv').oninput = function(e) { currentSearchSerieTv = e.target.value; renderListSerieTv(); };
        document.getElementById('sortSelSerieTv').onchange = renderListSerieTv;
        document.getElementById('btnResetFiltriSerieTv').onclick = resetFiltriSerieTv;

        document.querySelectorAll('#filterGroupStatoSerieTv .filter-btn').forEach(btn => {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupStatoSerieTv .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFilterStatoSerieTv = e.target.getAttribute('data-status');
                renderListSerieTv();
            };
        });
        document.querySelectorAll('#filterGroupVisioneSerieTv .filter-btn').forEach(btn => {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupVisioneSerieTv .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFilterVisioneSerieTv = e.target.getAttribute('data-vision');
                renderListSerieTv();
            };
        });
        document.querySelectorAll('#filterGroupPreferitiSerieTv .filter-btn').forEach(btn => {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupPreferitiSerieTv .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFavFilterSerieTv = e.target.getAttribute('data-fav');
                renderListSerieTv();
            };
        });

        // Finestra fluttuante generi Serie TV (stesso schema del Cinema)
        const btnToggleGenresSerieTvEl = document.getElementById('btnToggleGenresSerieTv');
        if (btnToggleGenresSerieTvEl) {
            btnToggleGenresSerieTvEl.onclick = function(e) {
                e.stopPropagation();
                document.getElementById('dropdownGenresSerieTv').classList.toggle('active');
            };
        }
        const dropdownGenresSerieTvEl = document.getElementById('dropdownGenresSerieTv');
        if (dropdownGenresSerieTvEl) {
            dropdownGenresSerieTvEl.addEventListener('change', function() {
                selectedGenresSerieTv = Array.from(document.querySelectorAll('.serietv-filter-genre-cb:checked')).map(cb => cb.value);
                document.getElementById('badgeGenresSerieTvCount').innerText = selectedGenresSerieTv.length;
                renderListSerieTv();
            });
        }

        // ==========================================
        //   BULK: nuove stagioni da TMDB per tutte le serie non concluse
        //   (abbandonate incluse: vengono scansionate e aggiornate come le
        //   altre, ma il riepilogo dichiara esplicitamente quali novitÃ 
        //   riguardano serie abbandonate).
        //   Equivale a premere il ðŸ”„ di riga su ogni serie, ma con un unico
        //   overlay di conferma: mostra titolo/stagione/episodi trovati, fa
        //   spuntare cosa aggiungere e salva solo le stagioni selezionate.
        // ==========================================
        let bulkSerieTvRisultati = []; // [{ titolo, nuove: [{ numero, episodi }] }]

        window.chiudiModaleBulkSerieTv = function() {
            document.getElementById('modalOverlayBulkSerieTv').classList.remove('active');
        };

        window.bulkSerieTvSelezionaTutto = function(seleziona) {
            document.querySelectorAll('.bulk-serietv-stagione-cb').forEach(function(cb) { cb.checked = !!seleziona; });
        };

        window.aggiornaTutteSerieTvDaTMDB = async function() {
            if (!serieTvList || serieTvList.length === 0) {
                showToast('Nessuna serie TV in lista.', 'error');
                return;
            }

            const candidate = serieTvList.filter(function(s) {
                if (!s || !s.tmdbId) return false;
                return String(s.stato || '').trim().toLowerCase() !== 'concluso';
            });
            const senzaLink = serieTvList.filter(function(s) { return !s || !s.tmdbId; }).length;

            const container = document.getElementById('bulkSerieTvListContainer');
            const btnSalva = document.getElementById('btnSalvaBulkSerieTv');
            container.innerHTML = `<p style="color: var(--warning); font-weight:600;">â³ Avvio scansione TMDB...</p>`;
            btnSalva.disabled = true;
            document.getElementById('modalOverlayBulkSerieTv').classList.add('active');

            bulkSerieTvRisultati = [];
            let giaAggiornate = 0;
            let errori = 0;

            for (let i = 0; i < candidate.length; i++) {
                const item = candidate[i];
                container.innerHTML = `<p style="color: var(--warning); font-weight:600;">â³ Leggo "${item.titolo}" da TMDB... (${i + 1}/${candidate.length})</p>`;
                try {
                    const dettaglio = await getDettaglioSerieTvTMDBSB_(item.tmdbId);
                    const maxSalvata = parseInt(item.stagioniTotali) || 0;
                    const nuove = (dettaglio.stagioni || [])
                        .filter(function(s) { return (parseInt(s.numero) || 0) > maxSalvata; })
                        .map(function(s) { return { numero: parseInt(s.numero) || 0, episodi: parseInt(s.episodi) || 0, anno: parseInt(s.anno) || null }; });
                    if (nuove.length > 0) {
                        bulkSerieTvRisultati.push({ titolo: item.titolo, nuove: nuove, abbandonata: !!item.abbandonata });
                    } else {
                        giaAggiornate++;
                    }
                } catch (err) {
                    console.error("Errore lettura TMDB per '" + item.titolo + "': " + err);
                    errori++;
                }
            }

            renderBulkSerieTvOverlay_(giaAggiornate, senzaLink, errori);
            btnSalva.disabled = bulkSerieTvRisultati.length === 0;
        };

        function renderBulkSerieTvOverlay_(giaAggiornate, senzaLink, errori) {
            const container = document.getElementById('bulkSerieTvListContainer');
            if (!container) return;

            let html = `<p style="color:var(--text-muted); font-size:13px;">Scansione completata: `
                + `${bulkSerieTvRisultati.length} serie con novitÃ , ${giaAggiornate} giÃ  aggiornate`
                + `${senzaLink > 0 ? `, ${senzaLink} senza collegamento TMDB (ignorate)` : ''}`
                + `${errori > 0 ? `, ${errori} errori di lettura` : ''}.</p>`;
            const nuoveSuAbbandonate = bulkSerieTvRisultati.filter(function(r) { return r.abbandonata; });
            if (nuoveSuAbbandonate.length > 0) {
                const stagioniAbb = nuoveSuAbbandonate.reduce(function(acc, r) { return acc + r.nuove.length; }, 0);
                html += `<p style="color:#f87171; font-size:13px; font-weight:600;">â›” Di cui ${stagioniAbb} nuove stagioni su ${nuoveSuAbbandonate.length} serie abbandonate: ${nuoveSuAbbandonate.map(function(r) { return r.titolo; }).join(', ')}.</p>`;
            }

            if (bulkSerieTvRisultati.length === 0) {
                html += `<p style="color:var(--text-muted); padding:12px 0;">Nessuna nuova stagione trovata su TMDB. ðŸŽ‰</p>`;
                container.innerHTML = html;
                return;
            }

            bulkSerieTvRisultati.forEach(function(r) {
                const safeTitle = String(r.titolo || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
                html += `<div style="margin:12px 0 4px 0; font-weight:700; font-size:14px;">ðŸ“¡ ${r.titolo}${r.abbandonata ? ' <span style="color:#f87171; font-size:12px;">â›” abbandonata</span>' : ''}</div>`;
                r.nuove.forEach(function(s) {
                    html += `<label style="display:flex; align-items:center; gap:8px; font-size:13px; padding:3px 0 3px 12px;">`
                        + `<input type="checkbox" class="bulk-serietv-stagione-cb" data-titolo="${safeTitle}" data-numero="${s.numero}" data-episodi="${s.episodi}" data-anno="${s.anno || ''}" checked>`
                        + `<span>Stagione ${s.numero} â€” ${s.episodi} episodi${s.anno ? ' (' + s.anno + ')' : ''}</span>`
                        + `</label>`;
                });
            });

            container.innerHTML = html;
        }

        window.salvaBulkSerieTvTMDB_ = async function() {
            const checked = Array.from(document.querySelectorAll('.bulk-serietv-stagione-cb:checked'));
            if (checked.length === 0) {
                showToast('âŒ Spunta almeno una stagione da aggiungere.', 'error');
                return;
            }

            const btnSalva = document.getElementById('btnSalvaBulkSerieTv');
            btnSalva.disabled = true;
            btnSalva.innerText = 'Salvataggio...';

            // Raggruppa le spunte per serie
            const perSerie = {};
            const perSerieAnni = {};
            checked.forEach(function(cb) {
                const t = cb.getAttribute('data-titolo');
                if (!perSerie[t]) { perSerie[t] = {}; perSerieAnni[t] = {}; }
                const numStagione = parseInt(cb.getAttribute('data-numero')) || 0;
                perSerie[t][numStagione] = parseInt(cb.getAttribute('data-episodi')) || 0;
                const annoStagione = parseInt(cb.getAttribute('data-anno')) || 0;
                if (annoStagione > 0) perSerieAnni[t][numStagione] = annoStagione;
            });

            let serieAggiornate = 0;
            let stagioniAggiunte = 0;
            try {
                for (const titolo of Object.keys(perSerie)) {
                    const titoloTrim = String(titolo).trim();
                    const mappa = perSerie[titolo];
                    const numeriSpuntati = Object.keys(mappa).map(Number);

                    // Rilegge le righe esistenti: aggiunge solo i numeri mancanti
                    const { data: righeEsistenti, error: errSel } = await supabaseClient
                        .from('episodi_serie_tv').select('numero').eq('serie_titolo', titoloTrim);
                    if (errSel) throw errSel;
                    const esistenti = new Set((righeEsistenti || []).map(function(r) { return r.numero; }));
                    const daAggiungere = numeriSpuntati.filter(function(n) { return !esistenti.has(n); });
                    if (daAggiungere.length === 0) continue;

                    for (const n of daAggiungere) {
                        const m = {};
                        m[n] = mappa[n];
                        await aggiungiRigheStagioniSerieTvSB_(titoloTrim, n, n, m, perSerieAnni[titolo] || null);
                    }

                    const item = (serieTvList || []).find(function(s) { return (s.titolo || '').trim() === titoloTrim; });
                    const nuovoTot = Math.max.apply(null, [parseInt(item ? item.stagioniTotali : 0) || 0].concat(daAggiungere));
                    await supabaseClient.from('serie_tv').update({ stagioni_totali: nuovoTot }).eq('titolo', titoloTrim);
                    await ricalcolaSincronizzaELoggaSerieTvSB_(titoloTrim);
                    await registraLogSB_(titoloTrim, 'SERIE_TV', 'AVANZAMENTO', 'N/D', 'Nuove stagioni da TMDB: ' + daAggiungere.sort(function(a, b) { return a - b; }).join(', '));

                    serieAggiornate++;
                    stagioniAggiunte += daAggiungere.length;
                }

                serieTvList = await getSerieTvDataSB_();
                episodiSerieTvList = await getTuttiEpisodiSerieTvSB_();
                renderListSerieTv();
                chiudiModaleBulkSerieTv();
                showToast(`ðŸ“¡ Aggiunte ${stagioniAggiunte} stagioni su ${serieAggiornate} serie`, 'success');
            } catch (err) {
                console.error('Errore salvataggio bulk serie TV:', err);
                showToast('âŒ Errore durante il salvataggio: ' + (err && err.message ? err.message : err), 'error');
            } finally {
                btnSalva.disabled = false;
                btnSalva.innerText = 'âœ… Aggiungi selezionate';
            }
        };




        // ---- FINE SERIE TV ----

