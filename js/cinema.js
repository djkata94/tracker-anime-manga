        function formattaDataCinemaISO_(valoreGrezzo) {
            if (!valoreGrezzo && valoreGrezzo !== 0) return '';
            const testo = String(valoreGrezzo).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(testo)) return testo.substring(0, 10);
            const matchItaliano = testo.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
            if (matchItaliano) {
                const gg = matchItaliano[1].padStart(2, '0');
                const mm = matchItaliano[2].padStart(2, '0');
                const aaaa = matchItaliano[3];
                return aaaa + '-' + mm + '-' + gg;
            }
            const parsed = new Date(testo);
            if (!isNaN(parsed)) {
                const yyyy = parsed.getFullYear();
                const mm2 = String(parsed.getMonth() + 1).padStart(2, '0');
                const dd2 = String(parsed.getDate()).padStart(2, '0');
                return yyyy + '-' + mm2 + '-' + dd2;
            }
            return testo;
        }

        async function getCinemaDataSB_() {
            const { data, error } = await supabaseClient.from('cinema').select('*').order('titolo', { ascending: true });
            if (error) throw error;
            return (data || []).map(function(c) {
                return {
                    titolo: c.titolo, dataUscita: c.data_uscita || '', dataVisione: c.data_visione || '',
                    visione: c.visione ? 'SÃ¬' : 'No', immagine: c.immagine || '', streaming: !!c.streaming,
                    trama: c.trama || '', generi: c.generi || ''
                };
            });
        }

        async function addCinemaSB_(dati) {
            const isStreaming = !!dati.streaming;
            const { error } = await supabaseClient.from('cinema').insert([{
                titolo: dati.titolo || '', data_uscita: formattaDataCinemaISO_(dati.dataUscita || '') || null,
                data_visione: null, visione: false, immagine: dati.immagine || '', streaming: isStreaming,
                trama: dati.trama || '', generi: dati.generi || ''
            }]);
            if (error) throw error;
            await registraLogSB_(dati.titolo, 'CINEMA', 'CREAZIONE', 'N/D', isStreaming ? 'Da vedere (streaming)' : 'Da vedere');
            return getCinemaDataSB_();
        }

        async function toggleVisioneCinemaSB_(titolo, nuovoStato, dataVisioneISO) {
            const titoloTrim = String(titolo).trim();
            const { data: righe, error: errSel } = await supabaseClient
                .from('cinema').select('visione,data_visione,streaming').eq('titolo', titoloTrim);
            if (errSel) throw errSel;
            if (!righe || righe.length === 0) return false;

            const riga = righe[0];
            const vecchioStato = riga.visione ? 'SÃ¬' : 'No';

            if (nuovoStato) {
                const dataFinale = formattaDataCinemaISO_(dataVisioneISO || '') || null;
                const { error: errUpd } = await supabaseClient.from('cinema')
                    .update({ data_visione: dataFinale, visione: true }).eq('titolo', titoloTrim);
                if (errUpd) throw errUpd;
                await registraLogSB_(titolo, 'CINEMA', 'COMPLETAMENTO', vecchioStato, 'SÃ¬ (' + (dataFinale || '') + ')' + (riga.streaming ? ' [streaming]' : ''));
                return { visione: 'SÃ¬', dataVisione: dataFinale || '' };
            } else {
                const { error: errUpd } = await supabaseClient.from('cinema').update({ visione: false }).eq('titolo', titoloTrim);
                if (errUpd) throw errUpd;
                await registraLogSB_(titolo, 'CINEMA', 'CAMBIO_STATO', vecchioStato, 'No');
                return { visione: 'No', dataVisione: riga.data_visione || '' };
            }
        }

        async function trasformaCinemaInStreamingSB_(titolo) {
            const titoloTrim = String(titolo).trim();
            const { data: righe, error: errSel } = await supabaseClient.from('cinema').select('visione,streaming').eq('titolo', titoloTrim);
            if (errSel) throw errSel;
            if (!righe || righe.length === 0) return getCinemaDataSB_();

            const riga = righe[0];
            if (riga.visione) throw new Error('Questo film Ã¨ giÃ  stato segnato come visto, non puÃ² tornare in streaming.');
            if (riga.streaming) return getCinemaDataSB_();

            const { error: errUpd } = await supabaseClient.from('cinema').update({ streaming: true }).eq('titolo', titoloTrim);
            if (errUpd) throw errUpd;
            return getCinemaDataSB_();
        }

        async function modificaDataVisioneCinemaSB_(titolo, nuovaDataISO) {
            const titoloTrim = String(titolo).trim();
            const { data: righe, error: errSel } = await supabaseClient.from('cinema').select('titolo').eq('titolo', titoloTrim);
            if (errSel) throw errSel;
            if (!righe || righe.length === 0) return false;

            const dataFinale = formattaDataCinemaISO_(nuovaDataISO || '') || null;
            const { error: errUpd } = await supabaseClient.from('cinema').update({ data_visione: dataFinale }).eq('titolo', titoloTrim);
            if (errUpd) throw errUpd;
            return { dataVisione: dataFinale || '' };
        }

        async function eliminaCinemaSB_(titolo) {
            const titoloTrim = String(titolo).trim();
            const { data: righe, error: errSel } = await supabaseClient.from('cinema').select('visione,streaming').eq('titolo', titoloTrim);
            if (errSel) throw errSel;
            if (!righe || righe.length === 0) return getCinemaDataSB_();

            const riga = righe[0];
            if (riga.visione) throw new Error('Non puoi eliminare un film giÃ  segnato come visto.');

            const { error: errDel } = await supabaseClient.from('cinema').delete().eq('titolo', titoloTrim);
            if (errDel) throw errDel;

            await registraLogSB_(titolo, 'CINEMA', 'CAMBIO_STATO', 'Da vedere', 'ELIMINATO');

            return getCinemaDataSB_();
        }

        function caricaDatiCinema() {
            document.getElementById('loadingCinema').style.display = 'block';
            document.getElementById('cinemaContent').style.display = 'none';

            getCinemaDataSB_().then(function(data) {
                cinemaList = data || [];
                document.getElementById('loadingCinema').style.display = 'none';
                document.getElementById('cinemaContent').style.display = 'block';
                renderListCinema();
            }).catch(function(err) {
                console.error('Errore caricamento Cinema: ', err);
                document.getElementById('loadingCinema').innerText = 'âš ï¸ Errore durante il caricamento dei dati.';
            });
        }

        // Converte una data ISO "YYYY-MM-DD" nel formato italiano "GG/MM/AAAA" per la visualizzazione
        function formattaDataItalianaCinema_(isoDate) {
            if (!isoDate) return '-';
            const parti = String(isoDate).split('-');
            if (parti.length !== 3) return isoDate;
            return parti[2] + '/' + parti[1] + '/' + parti[0];
        }

        // Converte una data italiana "GG/MM/AAAA" (digitata dall'utente) in formato ISO "YYYY-MM-DD"
        // Restituisce null se il formato non Ã¨ valido.
        function parseDataItalianaCinema_(dataItaliana) {
            if (!dataItaliana) return null;
            const match = String(dataItaliana).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
            if (!match) return null;
            const gg = match[1].padStart(2, '0');
            const mm = match[2].padStart(2, '0');
            const aaaa = match[3];
            return aaaa + '-' + mm + '-' + gg;
        }

        // --- SUGGERIMENTI CINEMA (Richiesta 35) ---
        // Niente id salvato: search-first sul titolo, poi recommendations.
        // Stesso overlay delle serie (mostraSuggOverlay_), trama progressiva.
        async function getSuggCinema_(titolo) {
            const sres = await supabaseClient.functions.invoke('tmdb-proxy', {
                body: { action: 'search', query: titolo }
            });
            if (sres.error) throw new Error('Impossibile contattare TMDB. Riprova piÃ¹ tardi.');
            const cand = sres.data;
            if (cand && cand.error) throw new Error(cand.error);
            if (!Array.isArray(cand) || cand.length === 0 || !cand[0].id) {
                throw new Error('Film non trovato su TMDB.');
            }
            const rres = await supabaseClient.functions.invoke('tmdb-proxy', {
                body: { action: 'movie_recommendations', id: cand[0].id }
            });
            if (rres.error) throw new Error('Impossibile contattare TMDB. Riprova piÃ¹ tardi.');
            const data = rres.data;
            if (data && data.error) throw new Error(data.error);
            const lista = Array.isArray(data) ? data : [];
            // TMDB mischia film e serie: tieni solo film (se l'Edge non
            // passa ancora il tipo, non filtrare per non svuotare tutto).
            return lista.filter(function(m) { return !m.tipo || m.tipo === 'movie'; });
        }

        function arricchisciSuggCinema_(candidati) {
            const gen = suggGen_;
            candidati.slice(0, 5).forEach(function(c, i) {
                if (!c || !c.id) return;
                getDettaglioCinemaTMDBSB_(c.id).then(function(d) {
                    if (!d || gen !== suggGen_) return;
                    const tramaEl = document.getElementById('suggTrama' + i);
                    if (tramaEl && d.trama) tramaEl.textContent = d.trama;
                }).catch(function() {});
            });
        }

        async function suggCinema_(titolo) {
            showToast('Cerco suggerimentiâ€¦');
            try {
                const posseduti = {};
                cinemaList.forEach(function(x) { if (x && x.titolo) posseduti[normTitoloSugg_(x.titolo)] = true; });
                posseduti[normTitoloSugg_(titolo)] = true;
                const res = await getSuggCinema_(titolo);
                const top = res.filter(function(c) { return !posseduti[normTitoloSugg_(c.titolo)]; }).slice(0, 5);
                mostraSuggOverlay_(titolo, top, 'cinema');
                arricchisciSuggCinema_(top);
            } catch (err) {
                showToast(err.message || 'Suggerimenti non disponibili.', 'error');
            }
        }

        window.suggCinema_ = suggCinema_;

        function renderListCinema() {
            const tbodyDaVedere = document.getElementById('cinemaTableBodyDaVedere');
            const tbodyStreaming = document.getElementById('cinemaTableBodyStreaming');
            const tbodyVistiSala = document.getElementById('cinemaTableBodyVistiSala');
            const tbodyVistiStreaming = document.getElementById('cinemaTableBodyVistiStreaming');
            if (!tbodyDaVedere || !tbodyStreaming || !tbodyVistiSala || !tbodyVistiStreaming) return;
            tbodyDaVedere.innerHTML = '';
            tbodyStreaming.innerHTML = '';
            tbodyVistiSala.innerHTML = '';
            tbodyVistiStreaming.innerHTML = '';

            const termineRicerca = (currentSearchCinema || '').toLowerCase();
            let filtered = cinemaList.filter(item => item && (item.titolo || '').toLowerCase().includes(termineRicerca));

            // Filtro generi: un film passa se ha ALMENO UNO dei generi selezionati
            // (il campo "generi" Ã¨ una stringa tipo "Azione, Fantascienza").
            if (selectedGenresCinema.length > 0) {
                filtered = filtered.filter(item => {
                    if (!item.generi) return false;
                    const generiFilm = item.generi.split(',').map(g => g.trim());
                    return selectedGenresCinema.some(g => generiFilm.includes(g));
                });
            }

            // I film in streaming sono film veri: da visti restano archiviati
            const daVedereTutti = filtered.filter(item => item.visione !== 'SÃ¬');
            const vistiTutti = filtered.filter(item => item.visione === 'SÃ¬');

            const daVedereCinema = daVedereTutti.filter(item => !item.streaming);
            const daVedereStreaming = daVedereTutti.filter(item => item.streaming);
            const vistiSala = vistiTutti.filter(item => !item.streaming);
            const vistiStreaming = vistiTutti.filter(item => item.streaming);

            // Film al cinema: ordinati per data di uscita crescente (dalla piÃ¹ vicina
            // alla piÃ¹ lontana). Quelli senza data di uscita nota vanno in coda.
            daVedereCinema.sort((a, b) => {
                if (!a.dataUscita && !b.dataUscita) return (a.titolo || '').localeCompare(b.titolo || '');
                if (!a.dataUscita) return 1;
                if (!b.dataUscita) return -1;
                return a.dataUscita.localeCompare(b.dataUscita);
            });

            // Film in streaming: data di uscita piÃ¹ recente in alto, a scendere.
            // Quelli senza data di uscita nota vanno in coda.
            daVedereStreaming.sort((a, b) => {
                if (!a.dataUscita && !b.dataUscita) return (a.titolo || '').localeCompare(b.titolo || '');
                if (!a.dataUscita) return 1;
                if (!b.dataUscita) return -1;
                return b.dataUscita.localeCompare(a.dataUscita);
            });
			
            // "Visti" ordinati per data di visione decrescente (i piÃ¹ recenti in cima).
            // Stesso ordinamento per sala e streaming (pannelli separati).
            vistiSala.sort((a, b) => {
                if (!a.dataVisione && !b.dataVisione) return (a.titolo || '').localeCompare(b.titolo || '');
                if (!a.dataVisione) return 1;
                if (!b.dataVisione) return -1;
                return b.dataVisione.localeCompare(a.dataVisione);
            });
            vistiStreaming.sort((a, b) => {
                if (!a.dataVisione && !b.dataVisione) return (a.titolo || '').localeCompare(b.titolo || '');
                if (!a.dataVisione) return 1;
                if (!b.dataVisione) return -1;
                return b.dataVisione.localeCompare(a.dataVisione);
            });

            // Contatori del banner in alto: sempre indipendenti dallo switch
            // (danno il quadro completo a colpo d'occhio)
            document.getElementById('statCinemaDaVedere').innerText = daVedereCinema.length;
            document.getElementById('statCinemaStreaming').innerText = daVedereStreaming.length;
            document.getElementById('statCinemaVisti').innerText = vistiSala.length + vistiStreaming.length;

            // I pannelli degli slider vengono popolati tutti: gli switch si
            // limitano a far scorrere i track, senza ricostruire nulla.
            daVedereCinema.forEach(item => tbodyDaVedere.appendChild(costruisciRigaCinema_(item, false)));
            daVedereStreaming.forEach(item => tbodyStreaming.appendChild(costruisciRigaCinema_(item, false)));
            vistiSala.forEach(item => tbodyVistiSala.appendChild(costruisciRigaCinema_(item, true)));
            vistiStreaming.forEach(item => tbodyVistiStreaming.appendChild(costruisciRigaCinema_(item, true)));

            document.getElementById('cinemaEmptyDaVedere').style.display = daVedereCinema.length === 0 ? 'block' : 'none';
            document.getElementById('cinemaEmptyStreaming').style.display = daVedereStreaming.length === 0 ? 'block' : 'none';
            document.getElementById('cinemaEmptyVistiSala').style.display = vistiSala.length === 0 ? 'block' : 'none';
            document.getElementById('cinemaEmptyVistiStreaming').style.display = vistiStreaming.length === 0 ? 'block' : 'none';

            // Contatori nelle testate dei due widget (pannello attivo)
            const isStreamingMode = currentFilterModalitaCinema === 'streaming';
            const countDaVedereEl = document.getElementById('cinemaWidgetDaVedereCount');
            if (countDaVedereEl) {
                const n = isStreamingMode ? daVedereStreaming.length : daVedereCinema.length;
                countDaVedereEl.textContent = n + (n === 1 ? ' film' : ' film');
            }
            const isStreamingModeVisti = currentFilterModalitaCinemaVisti === 'streaming';
            const countVistiEl = document.getElementById('cinemaWidgetVistiCount');
            if (countVistiEl) {
                const n = isStreamingModeVisti ? vistiStreaming.length : vistiSala.length;
                countVistiEl.textContent = n + ' film';
            }

            const mostrati = (isStreamingMode ? daVedereStreaming.length : daVedereCinema.length)
                + (isStreamingModeVisti ? vistiStreaming.length : vistiSala.length);
            document.getElementById('countCinema').textContent = mostrati + ' di ' + cinemaList.length + ' film';

            aggiornaTestataWidgetDaVedere_();
            aggiornaTestataWidgetVisti_();

            // Altezza massima delle aree scorrevoli (5 righe, 15 storico) e altezze
            // degli slider: ricalcolate a ogni render perchÃ© dipendono dalle righe.
            applicaScrollCinema_(document.getElementById('cinemaScrollDaVedere'));
            applicaScrollCinema_(document.getElementById('cinemaScrollStreaming'));
            applicaScrollCinema_(document.getElementById('cinemaScrollVistiSala'), CINEMA_MAX_RIGHE_VISTI);
            applicaScrollCinema_(document.getElementById('cinemaScrollVistiStreaming'), CINEMA_MAX_RIGHE_VISTI);
            aggiornaAltezzaSliderCinema_();
            aggiornaAltezzaSliderCinemaVisti_();
        }

        // ----------------------------------------------------------
        //   Widget "Da Vedere": scorrimento a 5 righe e slider sala/streaming
        // ----------------------------------------------------------

        // Righe visibili senza scorrere: 5 nel widget "Da Vedere", 15 nello storico "Visti"
        const CINEMA_MAX_RIGHE_VISIBILI = 5;
        const CINEMA_MAX_RIGHE_VISTI = 15;

        // Limita l'area scorrevole all'altezza reale di intestazione + prime N righe.
        // Con N film o meno la tabella resta libera di occupare l'altezza che le serve.
        function applicaScrollCinema_(scrollEl, maxRighe) {
            if (!scrollEl) return;
            const limite = maxRighe || CINEMA_MAX_RIGHE_VISIBILI;
            const righe = scrollEl.querySelectorAll('tbody tr');
            if (righe.length <= limite) {
                scrollEl.style.maxHeight = '';
                return;
            }
            const thead = scrollEl.querySelector('thead');
            let altezza = thead ? thead.offsetHeight : 0;
            for (let i = 0; i < limite; i++) altezza += righe[i].offsetHeight;
            scrollEl.style.maxHeight = altezza + 'px';
        }

        // Allinea la pillola dello switch al segmento attivo. I due segmenti hanno
        // larghezze diverse, quindi posizione e larghezza vanno misurate: le passo
        // alla pseudo-classe ::before come variabili CSS.
        let pillolaSwitchCinemaInizializzata = false;
        function aggiornaPillolaSwitchCinema_() {
            const sw = document.getElementById('cinemaModeSwitch');
            if (!sw) return;
            const attivo = sw.querySelector('.cinema-mode-opt.active');
            if (!attivo) return;

            const rettSwitch = sw.getBoundingClientRect();
            const rettAttivo = attivo.getBoundingClientRect();
            // Se la view Cinema non Ã¨ a schermo le misure valgono 0: lascio l'ultima buona
            if (!rettAttivo.width) return;

            // `left: 0` su un elemento assoluto parte dal bordo interno (padding edge)
            // del contenitore, mentre le rect partono dal bordo esterno: tolgo il bordo.
            const bordoSx = parseFloat(getComputedStyle(sw).borderLeftWidth) || 0;

            if (!pillolaSwitchCinemaInizializzata) {
                pillolaSwitchCinemaInizializzata = true;
                sw.classList.add('senza-transizione');
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() { sw.classList.remove('senza-transizione'); });
                });
            }

            sw.style.setProperty('--pill-x', (rettAttivo.left - rettSwitch.left - bordoSx) + 'px');
            sw.style.setProperty('--pill-w', rettAttivo.width + 'px');
        }

        // Il track dello slider Ã¨ alto quanto il pannello piÃ¹ alto: fisso a mano
        // l'altezza della viewport su quella del pannello attivo, cosÃ¬ la
        // transizione di scorrimento accompagna anche il cambio di altezza.
        function aggiornaAltezzaSliderCinema_() {
            const viewport = document.getElementById('cinemaSliderViewport');
            if (!viewport) return;
            const paneAttivo = document.getElementById(
                currentFilterModalitaCinema === 'streaming' ? 'cinemaPaneStreaming' : 'cinemaPaneCinema'
            );
            if (!paneAttivo) return;
            const altezza = paneAttivo.offsetHeight;
            // Se la view Cinema non Ã¨ a schermo la misura vale 0: meglio lasciare
            // l'altezza automatica che congelare la viewport a zero.
            viewport.style.height = altezza > 0 ? altezza + 'px' : '';
        }

        // Titolo, sottotitolo e stato del pulsantino di switch nella testata
        function aggiornaTestataWidgetDaVedere_() {
            const isStreaming = currentFilterModalitaCinema === 'streaming';

            const titoloEl = document.getElementById('cinemaWidgetDaVedereTitolo');
            if (titoloEl) titoloEl.innerText = isStreaming ? 'ðŸ“º Da Vedere in Streaming' : 'ðŸŽ¯ Da Vedere al Cinema';

            const subEl = document.getElementById('cinemaWidgetDaVedereSub');
            if (subEl) {
                subEl.innerText = isStreaming
                    ? 'I film da recuperare in streaming, dal piÃ¹ recente.'
                    : "I film che ti aspettano in sala, dal piÃ¹ vicino all'uscita.";
            }

            const switchEl = document.getElementById('cinemaModeSwitch');
            if (switchEl) {
                switchEl.setAttribute('data-modalita', currentFilterModalitaCinema);
                switchEl.querySelectorAll('.cinema-mode-opt').forEach(function(btn) {
                    btn.classList.toggle('active', btn.getAttribute('data-modalita') === currentFilterModalitaCinema);
                });
                aggiornaPillolaSwitchCinema_();
            }

            const track = document.getElementById('cinemaSliderTrack');
            if (track) track.setAttribute('data-modalita', currentFilterModalitaCinema);

            const paneCinema = document.getElementById('cinemaPaneCinema');
            const paneStreaming = document.getElementById('cinemaPaneStreaming');
            if (paneCinema) paneCinema.inert = isStreaming;
            if (paneStreaming) paneStreaming.inert = !isStreaming;
        }

        function costruisciRigaCinema_(item, isVisto) {
            const tr = document.createElement('tr');
            const safeTitle = (item.titolo || '').replace(/'/g, "\\'").replace(/"/g, '\\"');
            const isStreaming = !!item.streaming;

            let posterHTML = '';
            if (item.immagine && item.immagine.trim() !== '') {
                const safeImgUrl = item.immagine.trim().replace(/'/g, "\\'");
                posterHTML = `<img src="${safeImgUrl}" class="cinema-poster" alt="Locandina" onclick="apriLightbox('${safeImgUrl}')">`;
            } else {
                posterHTML = `<div class="cinema-poster"></div>`;
            }

            // Marcatore "S" a inizio riga per riconoscere i film visti/da vedere in streaming
            const badgeStreaming = isStreaming
                ? `<span class="cinema-badge-streaming" title="Film in streaming">S</span>`
                : '';

            // Generi sotto al titolo, come nelle altre viste (l'overlay â„¹ï¸ resta per la trama)
            const generiCinemaHTML = (item.generi && item.generi.trim() !== '')
                ? `<div class="genre-tags-list" style="color: var(--primary);">ðŸŽ­ ${item.generi}</div>`
                : '';

            const titoloCol = `
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        ${badgeStreaming}
                        ${posterHTML}
                        <div style="display: flex; flex-direction: column; gap: 3px;">
                            <span class="media-title">${item.titolo || 'Senza Titolo'}</span>
                            ${generiCinemaHTML}
                        </div>
                    </div>
                </td>`;

            const dataUscitaCol = `<td style="color:var(--text-muted); font-size:13px; font-family:'Courier New', monospace;">${formattaDataItalianaCinema_(item.dataUscita)}</td>`;
            const dataVisioneCol = `<td><span class="cinema-data-visione" onclick="modificaDataVisioneCinemaLista('${safeTitle}')" title="Clicca per correggere la data">${formattaDataItalianaCinema_(item.dataVisione)}</span></td>`;

            let visioneBtn;
            visioneBtn = isVisto
                ? `<button class="cinema-visione-btn visto" onclick="toggleVisioneCinemaLista('${safeTitle}', false)" title="Segna come da vedere">âœ… Visto</button>`
                : `<button class="cinema-visione-btn da-vedere" onclick="toggleVisioneCinemaLista('${safeTitle}', true)" title="Segna come visto">â˜ Da vedere</button>`;

                        const streamingBtn = (!isStreaming && !isVisto)
                ? `<button class="action-icon-btn" onclick="trasformaCinemaInStreamingLista('${safeTitle}')" title="Sposta tra i film da vedere in streaming">ðŸ“º</button>`
                : '';

            const infoBtn = (item.trama || item.generi)
                ? `<button class="action-icon-btn" onclick="mostraDettaglioCinemaLista_('${safeTitle}')" title="Trama e generi">â„¹ï¸</button>`
                : '';

            const trashDisabled = isVisto ? 'disabled title="Non puoi eliminare un film giÃ  visto"' : `onclick="eliminaCinemaLista('${safeTitle}')" title="Elimina film"`;

            tr.innerHTML = `
                ${titoloCol}
                ${isVisto ? dataVisioneCol : dataUscitaCol}
                <td style="text-align:center;">${visioneBtn}</td>
                <td style="text-align:center;">
                    ${infoBtn}
                    ${streamingBtn}
                    <button class="action-icon-btn" onclick="suggCinema_('${safeTitle}')" title="Potrebbero piacerti anche">ðŸ’¡</button>
                    <button class="action-icon-btn" ${trashDisabled}>ðŸ—‘ï¸</button>
                </td>
            `;
            return tr;
        }

        // Mostra trama e generi di un film giÃ  salvato (dati letti da TMDB al
        // momento dell'aggiunta, nessuna chiamata di rete: sono giÃ  in cinemaList).
        function mostraDettaglioCinemaLista_(titolo) {
            const item = cinemaList.find(x => x.titolo === titolo);
            if (!item) return;

            let overlay = document.getElementById('cinemaInfoOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'cinemaInfoOverlay';
                overlay.style = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(5, 5, 7, 0.85); backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 10000; opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
                `;
                const content = document.createElement('div');
                content.id = 'cinemaInfoContent';
                content.style = `
                    background: var(--surface-solid, #14162a); border: 1px solid var(--border-color, #262a42);
                    border-radius: 12px; padding: 24px; max-width: 500px; width: 90%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3);
                    position: relative; transform: scale(0.9);
                    transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                `;
                content.innerHTML = `
                    <button id="closeCinemaInfoBtn" style="position: absolute; top: 14px; right: 16px; background: none; border: none; color: var(--text-muted, #8890ab); font-size: 20px; cursor: pointer;">âœ•</button>
                    <h3 id="cinemaInfoTitle" style="margin-top: 0; margin-bottom: 10px; color: var(--text, #f2f3fa); font-size: 18px; font-weight: 600; padding-right: 24px; border-bottom: 1px solid var(--border-color, #262a42); padding-bottom: 10px;"></h3>
                    <div id="cinemaInfoGeneri" style="color: var(--primary, #7c6cff); font-size: 13px; margin-bottom: 10px;"></div>
                    <div id="cinemaInfoBody" style="color: var(--text, #f2f3fa); font-size: 14px; line-height: 1.6; max-height: 250px; overflow-y: auto; white-space: pre-line; padding-right: 5px;"></div>
                `;
                overlay.appendChild(content);
                document.body.appendChild(overlay);
                document.getElementById('closeCinemaInfoBtn').onclick = chiudiDettaglioCinemaLista_;
                overlay.onclick = function(e) { if (e.target === overlay) chiudiDettaglioCinemaLista_(); };
            }

            document.getElementById('cinemaInfoTitle').innerText = item.titolo || '';
            document.getElementById('cinemaInfoGeneri').innerText = item.generi ? ('ðŸ·ï¸ ' + item.generi) : '';
            document.getElementById('cinemaInfoBody').innerText = item.trama || 'Nessuna trama disponibile per questo film.';

            overlay.style.pointerEvents = 'auto';
            overlay.style.opacity = '1';
            document.getElementById('cinemaInfoContent').style.transform = 'scale(1)';
        }

        function chiudiDettaglioCinemaLista_() {
            const overlay = document.getElementById('cinemaInfoOverlay');
            const content = document.getElementById('cinemaInfoContent');
            if (overlay && content) {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
                content.style.transform = 'scale(0.9)';
            }
        }

        // Attiva/disattiva il flag Visione direttamente dalla lista. Quando si segna un
        // film come visto, chiede la data di visione (quella riportata sul biglietto).
        function toggleVisioneCinemaLista(titolo, nuovoStato) {
            const item = cinemaList.find(x => x.titolo === titolo);
            if (!item) return;

            let dataVisioneISO = item.dataVisione || '';

            if (nuovoStato) {
                const domanda = item.streaming
                    ? 'Quando hai visto "' + titolo + '" in streaming? (GG/MM/AAAA):'
                    : 'Inserisci la data in cui hai visto "' + titolo + '" (dal biglietto), formato GG/MM/AAAA:';
                const inputData = prompt(domanda, formattaDataItalianaCinema_(item.dataVisione) !== '-' ? formattaDataItalianaCinema_(item.dataVisione) : '');
                if (inputData === null) return; // Annullato dall'utente
                const parsed = parseDataItalianaCinema_(inputData);
                if (!parsed) {
                    alert('âš ï¸ Formato data non valido. Usa il formato GG/MM/AAAA (es. 15/03/2024).');
                    return;
                }
                dataVisioneISO = parsed;
            }

            toggleVisioneCinemaSB_(titolo, nuovoStato, dataVisioneISO)
                .then(function(res) {
                    item.visione = nuovoStato ? 'SÃ¬' : 'No';
                    if (nuovoStato) item.dataVisione = dataVisioneISO;
                    renderListCinema();
                    showToast(nuovoStato ? (item.streaming ? 'ðŸ“º Film visto in streaming' : 'ðŸŽ¬ Film segnato come visto') : 'Film rimesso tra i "Da vedere"', 'success');
                })
                .catch(function(err) {
                    console.error('Errore aggiornamento visione Cinema: ', err);
                    alert('âŒ ' + (err && err.message ? err.message : 'Errore durante l\'aggiornamento dello stato di visione.'));
                });
        }

                // Sposta un film "da vedere al cinema" tra i film in streaming
        function trasformaCinemaInStreamingLista(titolo) {
            if (!confirm('Spostare "' + titolo + '" tra i film da vedere in streaming?\n\nUscirÃ  dalla lista "Al cinema" e finirÃ  nella lista streaming.')) return;

            trasformaCinemaInStreamingSB_(titolo)
                .then(function(data) {
                    cinemaList = data || [];
                    renderListCinema();
                    showToast('ðŸ“º Film spostato tra lo streaming', 'success');
                })
                .catch(function(err) {
                    console.error('Errore trasformazione in streaming Cinema: ', err);
                    alert('âŒ ' + (err && err.message ? err.message : 'Errore durante lo spostamento in streaming.'));
                });
        }

        // Imposta la modalitÃ  del widget "Da Vedere" (cinema / streaming).
        // Il cambio di data-modalita su track e switch fa partire da solo lo
        // scorrimento orizzontale: qui basta rigenerare le liste e le altezze.
        function impostaModalitaCinema_(valore, riRenderizza) {
            const modalita = valore === 'streaming' ? 'streaming' : 'cinema';
            if (modalita === currentFilterModalitaCinema && riRenderizza === false) return;
            currentFilterModalitaCinema = modalita;

            if (riRenderizza !== false) {
                renderListCinema(); // aggiorna anche testata, switch, track e altezze
            } else {
                aggiornaTestataWidgetDaVedere_();
                aggiornaAltezzaSliderCinema_();
            }

            // Se il widget era chiuso lo apro: cliccare lo switch senza vedere
            // il risultato sarebbe disorientante.
            const widget = document.getElementById('cinemaWidgetDaVedere');
            if (widget && widget.classList.contains('collapsed')) toggleStatsWidget('cinemaWidgetDaVedere');
        }

        // Imposta la modalitÃ  del widget "Visti" (cinema / streaming).
        // Stesso meccanismo dello slider "Da Vedere", con stato indipendente.
        function impostaModalitaCinemaVisti_(valore, riRenderizza) {
            const modalita = valore === 'streaming' ? 'streaming' : 'cinema';
            if (modalita === currentFilterModalitaCinemaVisti && riRenderizza === false) return;
            currentFilterModalitaCinemaVisti = modalita;

            if (riRenderizza !== false) {
                renderListCinema(); // aggiorna anche testata, switch, track e altezze
            } else {
                aggiornaTestataWidgetVisti_();
                aggiornaAltezzaSliderCinemaVisti_();
            }

            const widgetVisti = document.getElementById('cinemaWidgetVisti');
            if (widgetVisti && widgetVisti.classList.contains('collapsed')) toggleStatsWidget('cinemaWidgetVisti');
        }

        // Titolo, sottotitolo e stato del pulsantino di switch nella testata Visti
        function aggiornaTestataWidgetVisti_() {
            const isStreaming = currentFilterModalitaCinemaVisti === 'streaming';

            const subEl = document.getElementById('cinemaWidgetVistiSub');
            if (subEl) {
                subEl.innerText = isStreaming
                    ? 'Lo storico dei film giÃ  visti in streaming, dal piÃ¹ recente.'
                    : 'Lo storico dei film giÃ  visti in sala, dal piÃ¹ recente.';
            }

            const switchEl = document.getElementById('cinemaModeSwitchVisti');
            if (switchEl) {
                switchEl.setAttribute('data-modalita', currentFilterModalitaCinemaVisti);
                switchEl.querySelectorAll('.cinema-mode-opt').forEach(function(btn) {
                    btn.classList.toggle('active', btn.getAttribute('data-modalita') === currentFilterModalitaCinemaVisti);
                });
                aggiornaPillolaSwitchCinemaVisti_();
            }

            const track = document.getElementById('cinemaSliderTrackVisti');
            if (track) track.setAttribute('data-modalita', currentFilterModalitaCinemaVisti);

            const paneCinema = document.getElementById('cinemaPaneVistiSala');
            const paneStreaming = document.getElementById('cinemaPaneVistiStreaming');
            if (paneCinema) paneCinema.inert = isStreaming;
            if (paneStreaming) paneStreaming.inert = !isStreaming;
        }

        // Allinea la pillola dello switch Visti al segmento attivo (stessa
        // tecnica dello switch Da Vedere, con flag dedicato per il primo giro)
        let pillolaSwitchCinemaVistiInizializzata = false;
        function aggiornaPillolaSwitchCinemaVisti_() {
            const sw = document.getElementById('cinemaModeSwitchVisti');
            if (!sw) return;
            const attivo = sw.querySelector('.cinema-mode-opt.active');
            if (!attivo) return;

            const rettSwitch = sw.getBoundingClientRect();
            const rettAttivo = attivo.getBoundingClientRect();
            if (!rettAttivo.width) return;

            const bordoSx = parseFloat(getComputedStyle(sw).borderLeftWidth) || 0;

            if (!pillolaSwitchCinemaVistiInizializzata) {
                pillolaSwitchCinemaVistiInizializzata = true;
                sw.classList.add('senza-transizione');
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() { sw.classList.remove('senza-transizione'); });
                });
            }

            sw.style.setProperty('--pill-x', (rettAttivo.left - rettSwitch.left - bordoSx) + 'px');
            sw.style.setProperty('--pill-w', rettAttivo.width + 'px');
        }

        // Il track dello slider Visti Ã¨ alto quanto il pannello piÃ¹ alto
        function aggiornaAltezzaSliderCinemaVisti_() {
            const viewport = document.getElementById('cinemaSliderViewportVisti');
            if (!viewport) return;
            const paneAttivo = document.getElementById(
                currentFilterModalitaCinemaVisti === 'streaming' ? 'cinemaPaneVistiStreaming' : 'cinemaPaneVistiSala'
            );
            if (!paneAttivo) return;
            const altezza = paneAttivo.offsetHeight;
            viewport.style.height = altezza > 0 ? altezza + 'px' : '';
        }

        function resetFiltriCinema() {
            currentSearchCinema = '';
            const searchEl = document.getElementById('searchInpCinema');
            if (searchEl) searchEl.value = '';
            selectedGenresCinema = [];
            document.querySelectorAll('.cinema-filter-genre-cb:checked').forEach(cb => cb.checked = false);
            const badgeCinemaGeneri = document.getElementById('badgeGenresCinemaCount');
            if (badgeCinemaGeneri) badgeCinemaGeneri.innerText = '0';
            impostaModalitaCinema_('cinema');
            impostaModalitaCinemaVisti_('cinema');
            showToast('Filtri Cinema azzerati', 'success');
        }

        // Corregge la data di visione di un film giÃ  segnato come visto
        function modificaDataVisioneCinemaLista(titolo) {
            const item = cinemaList.find(x => x.titolo === titolo);
            if (!item || item.visione !== 'SÃ¬') return;

            const inputData = prompt('Correggi la data di visione di "' + titolo + '" (GG/MM/AAAA):', formattaDataItalianaCinema_(item.dataVisione) !== '-' ? formattaDataItalianaCinema_(item.dataVisione) : '');
            if (inputData === null) return;
            const parsed = parseDataItalianaCinema_(inputData);
            if (!parsed) {
                alert('âš ï¸ Formato data non valido. Usa il formato GG/MM/AAAA (es. 15/03/2024).');
                return;
            }

            modificaDataVisioneCinemaSB_(titolo, parsed)
                .then(function(res) {
                    item.dataVisione = parsed;
                    renderListCinema();
                    showToast('Data di visione aggiornata', 'success');
                })
                .catch(function(err) {
                    console.error('Errore modifica data visione Cinema: ', err);
                    alert('âŒ Errore durante la modifica della data di visione.');
                });
        }

        // Elimina un film "da vedere" (il pulsante cestino Ã¨ disabilitato per i film giÃ  visti)
        function eliminaCinemaLista(titolo) {
            if (!confirm("Eliminare definitivamente '" + titolo + "' dalla lista?")) return;

            eliminaCinemaSB_(titolo)
                .then(function(data) {
                    cinemaList = data || [];
                    renderListCinema();
                    showToast('Film eliminato', 'success');
                })
                .catch(function(err) {
                    console.error('Errore eliminazione Cinema: ', err);
                    alert('âŒ ' + (err && err.message ? err.message : 'Errore durante l\'eliminazione del film.'));
                });
        }

        // Gestore ricerca testuale e filtri nella view Cinema
        document.addEventListener('DOMContentLoaded', function() {
            // ðŸ“ Bottoncino "Apri Foglio Google" nella Home: recupera l'URL
            // reale del foglio collegato allo script e lo imposta come href.
            const driveBtnEl = document.getElementById('driveShortcutBtn');
            if (driveBtnEl) {
                const matchProgetto = SUPABASE_URL.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
                const projectRef = matchProgetto ? matchProgetto[1] : '';
                if (projectRef) driveBtnEl.href = 'https://supabase.com/dashboard/project/' + projectRef + '/editor';
                driveBtnEl.classList.remove('is-loading');
            }

            const searchCinemaEl = document.getElementById('searchInpCinema');
            if (searchCinemaEl) {
                searchCinemaEl.addEventListener('input', function() {
                    currentSearchCinema = this.value;
                    renderListCinema();
                });
            }

            const btnNuovoCinemaEl = document.getElementById('btnNuovoCinema');
            if (btnNuovoCinemaEl) {
                btnNuovoCinemaEl.onclick = function() { apriModaleNuovoCinema(); };
            }

            // Pulsantino di switch Sala / Streaming nella testata del widget "Da Vedere"
            document.querySelectorAll('#cinemaModeSwitch .cinema-mode-opt').forEach(function(btn) {
                btn.onclick = function(e) {
                    e.stopPropagation(); // non deve aprire/chiudere il widget
                    impostaModalitaCinema_(btn.getAttribute('data-modalita'));
                };
            });

            // Pulsantino di switch Sala / Streaming nella testata del widget "Visti"
            document.querySelectorAll('#cinemaModeSwitchVisti .cinema-mode-opt').forEach(function(btn) {
                btn.onclick = function(e) {
                    e.stopPropagation(); // non deve aprire/chiudere il widget
                    impostaModalitaCinemaVisti_(btn.getAttribute('data-modalita'));
                };
            });

            // Le altezze delle aree scorrevoli dipendono dalla larghezza disponibile
            // (i titoli lunghi vanno a capo): al resize vanno ricalcolate.
            let timerResizeCinema = null;
            window.addEventListener('resize', function() {
                if (!document.getElementById('cinemaTableBodyDaVedere')) return;
                clearTimeout(timerResizeCinema);
                timerResizeCinema = setTimeout(function() {
                    applicaScrollCinema_(document.getElementById('cinemaScrollDaVedere'));
                    applicaScrollCinema_(document.getElementById('cinemaScrollStreaming'));
                    applicaScrollCinema_(document.getElementById('cinemaScrollVistiSala'), CINEMA_MAX_RIGHE_VISTI);
                    applicaScrollCinema_(document.getElementById('cinemaScrollVistiStreaming'), CINEMA_MAX_RIGHE_VISTI);
                    aggiornaPillolaSwitchCinema_();
                    aggiornaPillolaSwitchCinemaVisti_();
                    aggiornaAltezzaSliderCinema_();
                    aggiornaAltezzaSliderCinemaVisti_();
                }, 150);
            });

            const btnResetCinemaEl = document.getElementById('btnResetFiltriCinema');
            if (btnResetCinemaEl) btnResetCinemaEl.onclick = resetFiltriCinema;
        });

        // ==========================================================
        // ðŸ”Ž Modale "Nuovo Film" â€” ricerca su TMDB per titolo, locandina
        // e data di uscita nelle sale italiane
        // ==========================================================
        let ultimoDettaglioCinemaTMDB = null;

        function apriModaleNuovoCinema() {
            document.getElementById('cinemaModalBody').innerHTML = `
                <div class="form-group">
                    <label>Titolo del film *</label>
                    <div style="display:flex; gap:6px;">
                        <input type="search" id="inpTitoloCinema" required style="flex:1;" placeholder="Es. Dune: Parte Due">
                        <button type="button" class="btn btn-cinema" style="padding:0 12px; white-space:nowrap;" onclick="cercaCandidatiCinema()">ðŸ”Ž Cerca su TMDB</button>
                    </div>
                    <small style="color: var(--text-muted); display:block; margin-top:4px;">
                        Cerca il film per recuperare automaticamente locandina e data di uscita nelle sale italiane, oppure inserisci il titolo e salva manualmente.
                    </small>
                </div>
                <div class="form-group">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:600;">
                        <input type="checkbox" id="chkStreamingCinema" style="width:auto; margin:0;">
                        <span>ðŸ“º Da vedere in streaming (non al cinema)</span>
                    </label>
                    <small style="color: var(--text-muted); display:block; margin-top:4px;">
                        I film in streaming sono film veri: restano archiviati tra i "Visti" con data e log, separati dalla sala con lo switch.
                    </small>
                </div>
                <div id="cinemaCandidatiWrapper"></div>
            `;
            document.getElementById('modalOverlayCinema').classList.add('active');
            setTimeout(function() {
                const inp = document.getElementById('inpTitoloCinema');
                if (inp) inp.focus();
            }, 50);
        }

        // ==========================================
        //   FASE 11/12 â€” GRUPPO TMDB (via Edge Function tmdb-proxy)
        //   La chiave segreta TMDB non tocca mai il browser: la funzione
        //   gira sui server Supabase e richiede un utente autenticato.
        // ==========================================

        async function cercaCandidatiCinemaTMDBSB_(query) {
            const { data, error } = await supabaseClient.functions.invoke('tmdb-proxy', {
                body: { action: 'search', query: query }
            });
            if (error) throw new Error('Impossibile contattare TMDB. Riprova piÃ¹ tardi.');
            if (data && data.error) throw new Error(data.error);
            return data || [];
        }

        async function getDettaglioCinemaTMDBSB_(id) {
            const { data, error } = await supabaseClient.functions.invoke('tmdb-proxy', {
                body: { action: 'detail', id: id }
            });
            if (error) throw new Error('Impossibile recuperare i dettagli da TMDB. Riprova piÃ¹ tardi.');
            if (data && data.error) throw new Error(data.error);
            return data;
        }

        function cercaCandidatiCinema() {
            const titolo = document.getElementById('inpTitoloCinema').value.trim();
            if (!titolo) {
                alert('Inserisci prima un titolo da cercare.');
                return;
            }

            const wrapper = document.getElementById('cinemaCandidatiWrapper');
            wrapper.innerHTML = `<p style="color: var(--warning); font-weight:600;">â³ Ricerca su TMDB in corso...</p>`;

            cercaCandidatiCinemaTMDBSB_(titolo)
                .then(function(candidati) { renderCandidatiCinema_(candidati); })
                .catch(function(err) { renderErroreCinema_(err); });
        }

        function renderCandidatiCinema_(candidati) {
            const wrapper = document.getElementById('cinemaCandidatiWrapper');

            if (!candidati || candidati.length === 0) {
                wrapper.innerHTML = `<p style="color: var(--text-muted);">Nessun risultato trovato su TMDB per questo titolo. Puoi comunque salvare il film inserendo i dati manualmente.</p>` + costruisciFooterCinemaManuale_();
                agganciaFooterCinemaManuale_();
                return;
            }

            let grid = '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap:10px; margin-top:10px;">';
            candidati.forEach(function(c) {
                const safeImg = (c.immagine || '').replace(/'/g, "\\'");
                grid += `
                    <div class="cinema-candidato-card" style="cursor:pointer; border:1px solid var(--border-color); border-radius:8px; overflow:hidden; background: rgba(255,255,255,0.03);" onclick="selezionaCandidatoCinema_(${c.id}, '${(c.titolo || '').replace(/'/g, "\\'")}')">
                        <img src="${safeImg}" style="width:100%; height:150px; object-fit:cover; display:block; background:#222;">
                        <div style="padding:6px; font-size:11px; line-height:1.3; color: var(--text);">${c.titolo}${c.anno ? ' (' + c.anno + ')' : ''}</div>
                    </div>
                `;
            });
            grid += '</div>';
            wrapper.innerHTML = grid + costruisciFooterCinemaManuale_();
            agganciaFooterCinemaManuale_();
        }

        function costruisciFooterCinemaManuale_() {
            return `<div id="cinemaDettaglioPreview" style="margin-top:14px;"></div>`;
        }

        function agganciaFooterCinemaManuale_() {
            // Nessun listener extra necessario al momento: il salvataggio manuale
            // avviene tramite il pulsante nel piÃ¨ di pagina del modale principale.
        }

        function selezionaCandidatoCinema_(id, titoloCandidato) {
            const preview = document.getElementById('cinemaDettaglioPreview');
            preview.innerHTML = `<p style="color: var(--warning); font-weight:600;">â³ Recupero data di uscita nelle sale italiane...</p>`;

            getDettaglioCinemaTMDBSB_(id)
                .then(function(dettaglio) { renderDettaglioCinema_(dettaglio); })
                .catch(function(err) { renderErroreCinema_(err); });
        }

        function renderDettaglioCinema_(dettaglio) {
            ultimoDettaglioCinemaTMDB = dettaglio;
            document.getElementById('inpTitoloCinema').value = dettaglio.titolo || document.getElementById('inpTitoloCinema').value;

            const preview = document.getElementById('cinemaDettaglioPreview');
            const safeImg = (dettaglio.immagine || '').replace(/'/g, "\\'");
            const trama = dettaglio.trama || '';
            const tramaAnteprima = trama.length > 160 ? trama.substring(0, 160) + 'â€¦' : trama;
            preview.innerHTML = `
                <div style="display:flex; gap:14px; align-items:flex-start; border-top:1px solid var(--border-color); padding-top:14px;">
                    <img src="${safeImg}" style="width:90px; border-radius:8px; flex-shrink:0; background:#222;">
                    <div style="flex:1;">
                        <div style="font-weight:700; margin-bottom:6px;">${dettaglio.titolo || ''}</div>
                        <div style="font-size:13px; color: var(--text-muted); margin-bottom:6px;">
                            Uscita nelle sale italiane: <strong style="font-family:'Courier New', monospace;">${formattaDataItalianaCinema_(dettaglio.dataUscita)}</strong>
                        </div>
                        ${dettaglio.generi ? `<div style="font-size:12px; color: var(--text-muted); margin-bottom:6px;">ðŸ·ï¸ ${dettaglio.generi}</div>` : ''}
                        ${tramaAnteprima ? `<div style="font-size:12px; color: var(--text-muted); margin-bottom:12px; font-style:italic;">${tramaAnteprima}</div>` : ''}
                        <button type="button" class="btn btn-cinema" onclick="confermaSalvataggioCinema_()">âœ… Salva questo film</button>
                    </div>
                </div>
            `;
        }

        function renderErroreCinema_(err) {
            console.error('Errore TMDB: ', err);
            const wrapper = document.getElementById('cinemaCandidatiWrapper');
            wrapper.innerHTML = `<p style="color: #ff6b6b;">${(err && err.message) ? err.message : 'Si Ã¨ verificato un errore durante la comunicazione con TMDB.'}</p>`;
        }

        // Restituisce true se nella modale Ã¨ spuntata l'opzione "streaming"
        function isStreamingCinemaSelezionato_() {
            const cb = document.getElementById('chkStreamingCinema');
            return !!(cb && cb.checked);
        }

        // Salvataggio a partire dal candidato TMDB confermato
        function confermaSalvataggioCinema_() {
            const titolo = document.getElementById('inpTitoloCinema').value.trim();
            if (!titolo) {
                alert('Il titolo non puÃ² essere vuoto.');
                return;
            }
            const dati = {
                titolo: titolo,
                dataUscita: (ultimoDettaglioCinemaTMDB && ultimoDettaglioCinemaTMDB.dataUscita) || '',
                immagine: (ultimoDettaglioCinemaTMDB && ultimoDettaglioCinemaTMDB.immagine) || '',
                trama: (ultimoDettaglioCinemaTMDB && ultimoDettaglioCinemaTMDB.trama) || '',
                generi: (ultimoDettaglioCinemaTMDB && ultimoDettaglioCinemaTMDB.generi) || '',
                streaming: isStreamingCinemaSelezionato_()
            };
            salvaNuovoCinema_(dati);
        }

        // Salvataggio manuale (senza passare da TMDB): usato se l'utente non trova
        // il film tra i candidati e vuole comunque aggiungerlo alla lista
        window.salvaCinemaManuale = function() {
            const titolo = document.getElementById('inpTitoloCinema').value.trim();
            if (!titolo) {
                alert('Inserisci un titolo prima di salvare.');
                return;
            }
            salvaNuovoCinema_({ titolo: titolo, dataUscita: '', immagine: '', streaming: isStreamingCinemaSelezionato_() });
        };

        function salvaNuovoCinema_(dati) {
            const eraStreaming = !!dati.streaming;
            addCinemaSB_(dati)
                .then(function(data) {
                    cinemaList = data || [];
                    ultimoDettaglioCinemaTMDB = null;
                    document.getElementById('modalOverlayCinema').classList.remove('active');
                    // Se ho appena salvato un film in streaming attivo il pannello
                    // corrispondente, altrimenti risulterebbe invisibile.
                    if (eraStreaming && currentFilterModalitaCinema === 'cinema') {
                        impostaModalitaCinema_('streaming');
                    } else {
                        renderListCinema();
                    }
                    showToast(eraStreaming ? 'ðŸ“º Film in streaming aggiunto' : 'ðŸŽ¬ Film aggiunto alla lista', 'success');
                })
                .catch(function(err) {
                    console.error('Errore salvataggio Cinema: ', err);
                    alert('âŒ Errore durante il salvataggio del film.');
                });
        }
