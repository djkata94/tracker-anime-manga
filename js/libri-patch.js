function statoBadgeLibro_(stato) {
            const s = String(stato || 'Da leggere');
            if (s === 'Letto') return 'status-concluso';
            if (s === 'Abbandonato') return 'status-altro-anime';
            return 'status-in-arrivo';
        }

        async function getLibriDataSB_() {
            const { data, error } = await supabaseClient.from('libri').select('*').order('titolo', { ascending: true });
            if (error) throw error;
            return (data || []).map(function(l) {
                let notaTesto = l.note || '';
                if (typeof notaTesto === 'string' && !notaTesto.includes('<a ') && notaTesto.match(/https?:\/\/[^\s]+/i)) {
                    notaTesto = notaTesto.replace(/(https?:\/\/[^\s]+)/gi, '<a href="$1" target="_blank" style="color: #00ffcc; text-decoration: underline; font-weight: 500;">$1</a>');
                }
                let sagaNumero = null;
                if (l.saga_numero !== null && l.saga_numero !== undefined && String(l.saga_numero).trim() !== '') {
                    const n = parseFloat(String(l.saga_numero).replace(',', '.'));
                    sagaNumero = isNaN(n) ? null : n;
                }
                return {
                    titolo: l.titolo, autore: l.autore || '', anno: l.anno_pubblicazione || '',
                    generi: l.generi || '', sagaNome: l.saga_nome || '', sagaNumero: sagaNumero,
                    stato: l.stato || 'Da leggere', preferito: !!l.preferito,
                    immagine: l.immagine || '', note: notaTesto, priorita: !!l.priorita
                };
            });
        }

        async function addLibroSB_(dati) {
            const titoloTrim = String(dati.titolo || '').trim();
            if (!titoloTrim) throw new Error('Titolo mancante.');
            const statoNuovo = dati.stato || 'Da leggere';
            let annoVal = null;
            if (dati.anno !== '' && dati.anno !== null && dati.anno !== undefined) {
                const a = parseInt(dati.anno);
                if (!isNaN(a) && a > 0) annoVal = a;
            }
            let sagaNumVal = null;
            if (dati.sagaNumero !== '' && dati.sagaNumero !== null && dati.sagaNumero !== undefined) {
                const n = parseFloat(String(dati.sagaNumero).replace(',', '.'));
                if (!isNaN(n)) sagaNumVal = n;
            }
            const { error: errIns } = await supabaseClient.from('libri').insert([{
                titolo: titoloTrim, autore: String(dati.autore || '').trim(), anno_pubblicazione: annoVal,
                generi: dati.generi || '', saga_nome: String(dati.sagaNome || '').trim(), saga_numero: sagaNumVal,
                stato: statoNuovo, note: dati.note || '', preferito: false,
                immagine: dati.immagine || '', priorita: false
            }]);
            if (errIns) throw errIns;

            await supabaseClient.from('sinossi_libri').insert([{ libro_titolo: titoloTrim, sinossi: '' }]);
            await registraLogSB_(titoloTrim, 'LIBRO', 'CREAZIONE', 'N/D', statoNuovo);
            if (statoNuovo === 'Letto') await registraLogSB_(titoloTrim, 'LIBRO', 'COMPLETAMENTO', 'Da leggere', 'Letto');
            if (statoNuovo === 'Abbandonato') await registraLogSB_(titoloTrim, 'LIBRO', 'ABBANDONO', 'Da leggere', 'Abbandonato');

            return getLibriDataSB_();
        }

        async function updateLibroSB_(vecchioTitolo, dati) {
            const vecchioTitoloTrim = String(vecchioTitolo).trim();
            const { data: righeVecchie, error: errSel } = await supabaseClient.from('libri').select('*').eq('titolo', vecchioTitoloTrim);
            if (errSel) throw errSel;
            if (!righeVecchie || righeVecchie.length === 0) return getLibriDataSB_();
            const vecchiaRiga = righeVecchie[0];
            const vecchioStato = vecchiaRiga.stato || 'Da leggere';

            const titoloTrim = String(dati.titolo || '').trim() || vecchioTitoloTrim;
            const statoNuovo = dati.stato || 'Da leggere';
            let annoVal = null;
            if (dati.anno !== '' && dati.anno !== null && dati.anno !== undefined) {
                const a = parseInt(dati.anno);
                if (!isNaN(a) && a > 0) annoVal = a;
            }
            let sagaNumVal = null;
            if (dati.sagaNumero !== '' && dati.sagaNumero !== null && dati.sagaNumero !== undefined) {
                const n = parseFloat(String(dati.sagaNumero).replace(',', '.'));
                if (!isNaN(n)) sagaNumVal = n;
            }

            const { error: errUpd } = await supabaseClient.from('libri').update({
                titolo: titoloTrim, autore: String(dati.autore || '').trim(), anno_pubblicazione: annoVal,
                generi: dati.generi || '', saga_nome: String(dati.sagaNome || '').trim(), saga_numero: sagaNumVal,
                stato: statoNuovo, note: dati.note || '', immagine: dati.immagine || ''
            }).eq('titolo', vecchioTitoloTrim);
            if (errUpd) throw errUpd;

            try {
                if (String(statoNuovo).trim() !== String(vecchioStato).trim()) {
                    if (statoNuovo === 'Letto') {
                        await registraLogSB_(titoloTrim, 'LIBRO', 'COMPLETAMENTO', vecchioStato, statoNuovo);
                    } else if (statoNuovo === 'Abbandonato') {
                        await registraLogSB_(titoloTrim, 'LIBRO', 'ABBANDONO', vecchioStato, statoNuovo);
                    } else if (String(vecchioStato).trim() === 'Abbandonato') {
                        await registraLogSB_(titoloTrim, 'LIBRO', 'RIPRESA', vecchioStato, statoNuovo);
                    } else {
                        await registraLogSB_(titoloTrim, 'LIBRO', 'CAMBIO_STATO', vecchioStato, statoNuovo);
                    }
                }
            } catch (logErr) {
                console.error("Errore durante la valutazione degli eventi di log per updateLibro: " + logErr);
            }

            return getLibriDataSB_();
        }

        async function deleteLibroSB_(titolo) {
            const { error } = await supabaseClient.from('libri').delete().eq('titolo', String(titolo).trim());
            if (error) throw error;
            return getLibriDataSB_();
        }

        async function toggleLibroPreferitoSB_(titolo, preferitoStato) {
            const { error } = await supabaseClient.from('libri').update({ preferito: !!preferitoStato }).eq('titolo', String(titolo).trim());
            if (error) throw error;
        }

        async function toggleLibroPrioritaSB_(titolo, prioritaStato) {
            const { error } = await supabaseClient.from('libri').update({ priorita: !!prioritaStato }).eq('titolo', String(titolo).trim());
            if (error) throw error;
        }

        function caricaDatiLibri() {
            document.getElementById('loadingLibri').style.display = 'block';
            document.getElementById('libriTable').style.display = 'none';

            getLibriDataSB_().then(function(data) {
                libriList = data || [];
                document.getElementById('loadingLibri').style.display = 'none';
                document.getElementById('libriTable').style.display = 'table';
                renderListLibri();
            }).catch(function(err) {
                console.error('Errore caricamento dati Libri da Supabase:', err);
                document.getElementById('loadingLibri').style.display = 'none';
                alert('❌ Errore nel caricamento dei libri. Controlla la console per i dettagli.');
            });
        }

        function renderListLibri() {
            const tbody = document.getElementById('libriTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';

            let lettiCount = 0;
            let daLeggereCount = 0;
            (libriList || []).forEach(function(item) {
                if (!item) return;
                if (item.stato === 'Letto') lettiCount++;
                if (item.stato === 'Da leggere') daLeggereCount++;
            });
            document.getElementById('statLibriTotali').innerText = String((libriList || []).length);
            document.getElementById('statLibriLetti').innerText = String(lettiCount);
            document.getElementById('statLibriDaLeggere').innerText = String(daLeggereCount);

            let filtered = (libriList || []).filter(function(item) {
                if (!item) return false;
                const termine = (currentSearchLibri || '').toLowerCase();
                let notaTesto = '';
                if (item.note && typeof item.note === 'string') notaTesto = item.note.toLowerCase();
                else if (item.note) notaTesto = String(item.note).toLowerCase();
                const matchesSearch = !termine ||
                    (item.titolo || '').toLowerCase().includes(termine) ||
                    (item.autore || '').toLowerCase().includes(termine) ||
                    notaTesto.includes(termine);

                let matchesStato = (currentFilterStatoLibri === 'all' || item.stato === currentFilterStatoLibri);

                const termineSaga = (currentSearchSagaLibri || '').toLowerCase();
                let matchesSaga = !termineSaga || (item.sagaNome || '').toLowerCase().includes(termineSaga);

                let matchesGenres = true;
                if (selectedGenresLibri.length > 0) {
                    const itemGenres = item.generi ? item.generi.split(',').map(function(g) { return g.trim(); }) : [];
                    matchesGenres = selectedGenresLibri.every(function(g) { return itemGenres.includes(g); });
                }

                let matchesPreferito = true;
                if (currentFavFilterLibri === 'yes') matchesPreferito = (item.preferito === true);

                return matchesSearch && matchesStato && matchesSaga && matchesGenres && matchesPreferito;
            });

            const sortVal = document.getElementById('sortSelLibri').value;
            filtered.sort(function(a, b) {
                const pA = a.priorita ? 1 : 0;
                const pB = b.priorita ? 1 : 0;
                if (pA !== pB) return pB - pA;
                if (sortVal === 'title-desc') return (b.titolo || '').localeCompare(a.titolo || '');
                if (sortVal === 'autore-asc') {
                    const c = (a.autore || '').localeCompare(b.autore || '');
                    return c !== 0 ? c : (a.titolo || '').localeCompare(b.titolo || '');
                }
                if (sortVal === 'anno-desc') return (parseInt(b.anno) || 0) - (parseInt(a.anno) || 0);
                if (sortVal === 'anno-asc') return (parseInt(a.anno) || 0) - (parseInt(b.anno) || 0);
                if (sortVal === 'saga-asc') {
                    const sA = (a.sagaNome || '').toLowerCase();
                    const sB = (b.sagaNome || '').toLowerCase();
                    if (sA !== sB) {
                        if (!sA) return 1;
                        if (!sB) return -1;
                        return sA.localeCompare(sB);
                    }
                    const nA = (a.sagaNumero === null || a.sagaNumero === undefined) ? 9999 : a.sagaNumero;
                    const nB = (b.sagaNumero === null || b.sagaNumero === undefined) ? 9999 : b.sagaNumero;
                    if (nA !== nB) return nA - nB;
                    return (a.titolo || '').localeCompare(b.titolo || '');
                }
                return (a.titolo || '').localeCompare(b.titolo || '');
            });

            const countEl = document.getElementById('countLibri');
            if (countEl) countEl.textContent = filtered.length + ' di ' + (libriList || []).length + ' libri';

            filtered.forEach(function(item) {
                const tr = document.createElement('tr');
                const badgeClass = statoBadgeLibro_(item.stato);
                const safeTitle = (item.titolo || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

                let genresHTML = '';
                if (item.generi && item.generi.trim() !== '') {
                    genresHTML = `<div class="genre-tags-list" style="color: var(--accent);">🎭 ${item.generi}</div>`;
                }
                let sagaHTML = '';
                if (item.sagaNome && item.sagaNome.trim() !== '') {
                    const numTxt = (item.sagaNumero !== null && item.sagaNumero !== undefined) ? ' #' + item.sagaNumero : '';
                    sagaHTML = `<div class="genre-tags-list" style="color: var(--success);">📚 ${item.sagaNome}${numTxt}</div>`;
                }
                let autoreHTML = '';
                if (item.autore && item.autore.trim() !== '') {
                    autoreHTML = `<div style="font-size:12px; color:var(--text-muted);">✍️ ${item.autore}</div>`;
                }

                let starClass = item.preferito ? 'star-btn is-favorite' : 'star-btn';
                let starIcon = item.preferito ? '★' : '☆';
                let pinClass = item.priorita ? 'pin-btn is-priority' : 'pin-btn';
                let pinTitle = item.priorita ? 'Rimuovi dalle priorità' : 'Contrassegna come prioritario';

                let avatarHTML = '';
                if (item.immagine && item.immagine.trim() !== '') {
                    const safeImgUrl = item.immagine.trim().replace(/'/g, "\\'");
                    avatarHTML = `<img src="${safeImgUrl}" style="width: 45px; height: 65px; border-radius: 6px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border-color); cursor: zoom-in; background:#10111d;" alt="Copertina" loading="lazy" onclick="apriLightbox('${safeImgUrl}')">`;
                } else {
                    avatarHTML = `<div style="width: 45px; height: 65px; flex-shrink: 0;"></div>`;
                }

                tr.innerHTML = `
                    <td class="media-title">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <button class="${starClass}" style="flex-shrink: 0;" onclick="toggleFavoriteLibri('${safeTitle}', this)">${starIcon}</button>
                            <button class="${pinClass}" onclick="togglePinLibri('${safeTitle}', this, event)" title="${pinTitle}">📌</button>
                            ${avatarHTML}
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                    <span>${item.titolo || 'Senza Titolo'}</span>
                                    <button class="action-icon-btn" style="font-size: 13px; padding: 0; background: none; border: none; cursor: pointer;" onclick="mostraSinossi('${safeTitle}', 'libri')" title="Visualizza Trama">ℹ️</button>
                                </div>
                                ${autoreHTML}
                                ${sagaHTML}
                                ${genresHTML}
                            </div>
                        </div>
                    </td>
                    <td style="white-space:nowrap;">${item.anno || '-'}</td>
                    <td><span class="status-badge ${badgeClass}">${item.stato || 'Da leggere'}</span></td>
                    <td style="color: var(--text-muted); font-size: 13px;">${item.note || '-'}</td>
                    <td style="text-align: center; white-space:nowrap;">
                        <button class="action-icon-btn" onclick="apriModificaLibro('${safeTitle}')">✏️</button>
                        <button class="action-icon-btn" onclick="rimuoviLibro('${safeTitle}')">🗑️</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function resetFiltriLibri() {
            currentSearchLibri = '';
            currentSearchSagaLibri = '';
            currentFilterStatoLibri = 'all';
            currentFavFilterLibri = 'all';
            selectedGenresLibri = [];

            document.getElementById('searchInpLibri').value = '';
            document.getElementById('searchSagaLibri').value = '';
            document.getElementById('sortSelLibri').value = 'title-asc';

            ['filterGroupStatoLibri', 'filterGroupPreferitiLibri'].forEach(function(groupId) {
                const group = document.getElementById(groupId);
                if (!group) return;
                group.querySelectorAll('.filter-btn').forEach(function(btn) { btn.classList.remove('active'); });
                const first = group.querySelector('.filter-btn');
                if (first) first.classList.add('active');
            });

            document.querySelectorAll('.libri-filter-genre-cb:checked').forEach(function(cb) { cb.checked = false; });
            const badge = document.getElementById('badgeGenresLibriCount');
            if (badge) badge.innerText = '0';

            renderListLibri();
            showToast('Filtri Libri azzerati', 'success');
        }

        document.getElementById('searchInpLibri').oninput = function(e) { currentSearchLibri = e.target.value; renderListLibri(); };
        document.getElementById('searchSagaLibri').oninput = function(e) { currentSearchSagaLibri = e.target.value; renderListLibri(); };
        document.getElementById('sortSelLibri').onchange = renderListLibri;
        document.getElementById('btnResetFiltriLibri').onclick = resetFiltriLibri;

        document.querySelectorAll('#filterGroupStatoLibri .filter-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                document.querySelector('#filterGroupStatoLibri .filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                currentFilterStatoLibri = e.target.getAttribute('data-stato');
                renderListLibri();
            };
        });
        document.querySelectorAll('#filterGroupPreferitiLibri .filter-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                document.querySelectorAll('#filterGroupPreferitiLibri .filter-btn').forEach(function(b) { b.classList.remove('active'); });
                e.target.classList.add('active');
                currentFavFilterLibri = e.target.getAttribute('data-fav');
                renderListLibri();
            };
        });

        document.getElementById('btnNuovoLibro').onclick = function() {
            targetEditTitleLibri = null;
            sinossiPendenteLibri = null;
            ultimoDettaglioHardcover = null;
            document.getElementById('modalTitleLibri').innerText = 'Aggiungi Nuovo Libro';
            document.getElementById('libriForm').reset();
            document.getElementById('inpStatoLibri').value = 'Da leggere';
            document.getElementById('inpImmagineLibri').value = '';
            document.getElementById('libriCandidatiWrapper').innerHTML = '';
            document.querySelectorAll('input[name="libri_genres_cb"]').forEach(function(cb) { cb.checked = false; });
            document.getElementById('modalOverlayLibri').classList.add('active');
        };

        window.apriModificaLibro = function(titolo) {
            const item = (libriList || []).find(function(l) { return l.titolo === titolo; });
            if (!item) return;

            targetEditTitleLibri = titolo;
            sinossiPendenteLibri = null;
            ultimoDettaglioHardcover = null;
            document.getElementById('modalTitleLibri').innerText = 'Modifica Libro';
            document.getElementById('inpTitoloLibri').value = item.titolo || '';
            document.getElementById('inpAutoreLibri').value = item.autore || '';
            document.getElementById('inpAnnoLibri').value = item.anno || '';
            document.getElementById('inpStatoLibri').value = item.stato || 'Da leggere';
            document.getElementById('inpSagaNomeLibri').value = item.sagaNome || '';
            document.getElementById('inpSagaNumeroLibri').value = (item.sagaNumero !== null && item.sagaNumero !== undefined) ? item.sagaNumero : '';
            document.getElementById('inpNoteLibri').value = (function() {
                const tmp = document.createElement('div');
                tmp.innerHTML = item.note || '';
                return tmp.textContent || '';
            })();
            document.getElementById('inpImmagineLibri').value = item.immagine || '';
            document.getElementById('libriCandidatiWrapper').innerHTML = '';

            document.querySelectorAll('input[name="libri_genres_cb"]').forEach(function(cb) {
                cb.checked = false;
                if (item.generi) {
                    const splitGeneri = item.generi.split(',').map(function(g) { return g.trim(); });
                    if (splitGeneri.includes(cb.value)) cb.checked = true;
                }
            });

            document.getElementById('modalOverlayLibri').classList.add('active');
        };

        document.getElementById('libriForm').onsubmit = function(e) {
            e.preventDefault();
            document.getElementById('btnSalvaLibri').innerText = 'Salvataggio...';

            const selectedGenres = Array.from(document.querySelectorAll('input[name="libri_genres_cb"]:checked'))
                .map(function(cb) { return cb.value; })
                .join(', ');

            const dati = {
                titolo: document.getElementById('inpTitoloLibri').value.trim(),
                autore: document.getElementById('inpAutoreLibri').value,
                anno: document.getElementById('inpAnnoLibri').value,
                stato: document.getElementById('inpStatoLibri').value,
                sagaNome: document.getElementById('inpSagaNomeLibri').value,
                sagaNumero: document.getElementById('inpSagaNumeroLibri').value,
                generi: selectedGenres,
                note: document.getElementById('inpNoteLibri').value,
                immagine: document.getElementById('inpImmagineLibri').value
            };
            if (!dati.titolo) {
                showToast('Inserisci almeno il titolo.', 'error');
                document.getElementById('btnSalvaLibri').innerText = 'Salva';
                return;
            }
            const isEdit = !!targetEditTitleLibri;
            const cb = function(data) {
                libriList = data || [];
                if (sinossiPendenteLibri) {
                    impostaSinossiSB_(dati.titolo, 'libri', sinossiPendenteLibri)
                        .catch(function(err) {
                            console.error('Errore salvataggio trama Hardcover: ' + err);
                            showToast('Libro salvato, ma la trama non è stata scritta. Riprova dal pulsante 🔎.', 'error');
                        });
                    sinossiPendenteLibri = null;
                }
                // La ricerca globale usa una cache: va invalidata o il nuovo
                // libro non comparirebbe tra i risultati fino al reload.
                ricercaGlobaleIndice = null;
                document.getElementById('btnSalvaLibri').innerText = 'Salva';
                chiudiModale('Libri');
                renderListLibri();
                showToast(isEdit ? 'Libro aggiornato con successo' : 'Libro aggiunto con successo', 'success');
            };
            const errorCb = function(err) {
                alert('❌ Errore durante il salvataggio: ' + (err && err.message ? err.message : err));
                document.getElementById('btnSalvaLibri').innerText = 'Salva';
            };

            if (targetEditTitleLibri) {
                updateLibroSB_(targetEditTitleLibri, dati).then(cb).catch(errorCb);
            } else {
                addLibroSB_(dati).then(cb).catch(errorCb);
            }
        };

        window.rimuoviLibro = function(titolo) {
            if (confirm("Eliminare definitivamente '" + titolo + "'?")) {
                deleteLibroSB_(titolo).then(function(data) {
                    libriList = data || [];
                    ricercaGlobaleIndice = null;
                    renderListLibri();
                    showToast('Libro eliminato', 'success');
                }).catch(function(err) {
                    console.error('Errore eliminazione libro:', err);
                    alert("❌ Errore durante l'eliminazione.");
                });
            }
        };

        function toggleFavoriteLibri(titolo, btn) {
            const item = (libriList || []).find(function(l) { return l.titolo === titolo; });
            if (!item) return;
            const nuovoStato = !item.preferito;
            item.preferito = nuovoStato;
            if (btn) {
                btn.classList.toggle('is-favorite', nuovoStato);
                btn.innerText = nuovoStato ? '★' : '☆';
            }
            if (currentFavFilterLibri === 'yes' && !nuovoStato) renderListLibri();
            toggleLibroPreferitoSB_(titolo, nuovoStato).catch(function(err) {
                console.error('Errore toggle preferito libro:', err);
                item.preferito = !nuovoStato;
                renderListLibri();
            });
        }
        window.toggleFavoriteLibri = toggleFavoriteLibri;

        function togglePinLibri(titolo, btn, event) {
            if (event) event.stopPropagation();
            const item = (libriList || []).find(function(l) { return l.titolo === titolo; });
            if (!item) return;
            const nuovoStato = !item.priorita;
            item.priorita = nuovoStato;
            if (btn) {
                btn.classList.toggle('is-priority', nuovoStato);
                btn.title = nuovoStato ? 'Rimuovi dalle priorità' : 'Contrassegna come prioritario';
            }
            renderListLibri();
            toggleLibroPrioritaSB_(titolo, nuovoStato).catch(function(err) {
                console.error('Errore toggle priorità libro:', err);
                item.priorita = !nuovoStato;
                renderListLibri();
            });
        }
        window.togglePinLibri = togglePinLibri;

        // ------------------------------------------
        // 🔎 GOOGLE BOOKS (chiamata diretta, nessuna chiave)
        // ------------------------------------------

        // Euristica lingua trama (Richiesta 38): Hardcover non dichiara la
        // lingua della descrizione. Se il testo contiene parole tipicamente
        // italiane lo tengo così com'è, altrimenti traduco EN→IT (stesso
        // traduttore di AniList; se fallisce resta l'originale).
        function sembraItaliano_(testo) {
            const paroleIT = ['che', 'della', 'nella', 'delle', 'degli', 'sono', 'come', 'quando', 'questo', 'questa', 'questi', 'queste', 'libro', 'storia', 'mondo', 'vita', 'tempo', 'uomo', 'donna', 'grande', 'nuovo', 'vecchio', 'giorno', 'notte', 'casa', 'famiglia', 'amore', 'guerra', 'regno', 'magia', 'potere', 'ragazzo', 'anni', 'dopo', 'prima', 'ancora', 'sempre', 'molto'];
            const tn = String(testo || '').toLowerCase();
            let trovate = 0;
            paroleIT.forEach(function(w) {
                if (new RegExp('\\b' + w + '\\b').test(tn)) trovate++;
            });
            return trovate >= 3;
        }

        // Ricerca libri via Hardcover (Richiesta 38): il browser chiama solo
        // la Edge Function `hardcover-proxy` (stesso schema di `tmdb-proxy`
        // per TMDB) — il token resta secret lato server. Un'unica chiamata dà
        // già tutto (trama, generi, copertina, saga): niente secondo dettaglio.
        async function cercaCandidatiLibriHC_(query) {
            const q = String(query || '').trim();
            if (!q) throw new Error('Inserisci prima un titolo da cercare.');
            let data, error;
            try {
                const res = await supabaseClient.functions.invoke('hardcover-proxy', {
                    body: { action: 'search', query: q }
                });
                data = res.data; error = res.error;
            } catch (networkErr) {
                throw new Error('Rete: impossibile raggiungere il server (' + networkErr.message + ').');
            }
            if (error) {
                const corpo = (data && data.error) ? String(data.error) : '';
                if (corpo) throw new Error(corpo);
                const msg = String((error && error.message) || '');
                if (/failed to fetch|not found|404/i.test(msg)) {
                    throw new Error('Funzione hardcover-proxy non trovata: creala in Supabase (vedi guida).');
                }
                throw new Error('Hardcover: ' + (msg || 'errore imprevisto.'));
            }
            if (data && data.error) throw new Error(String(data.error));
            const risultati = (data && data.risultati) || [];
            return risultati.map(function(r) {
                return {
                    id: r.id || '', titolo: r.titolo || 'Senza titolo',
                    sottotitolo: r.sottotitolo || '', autori: r.autori || '',
                    anno: r.anno || '', immagine: r.immagine || '',
                    descrizione: r.descrizione || '', categorie: r.categorie || [],
                    pagine: r.pagine || null,
                    sagaNome: r.sagaNome || '',
                    sagaNumero: (r.sagaNumero !== null && r.sagaNumero !== undefined) ? r.sagaNumero : null,
                    fonte: 'HC'
                };
            }).filter(function(c) { return !!c.id; });
        }

        function apriRicercaHardcover() {
            const titolo = document.getElementById('inpTitoloLibri').value.trim();
            if (!titolo) {
                alert('Inserisci prima un titolo da cercare.');
                return;
            }
            const wrap = document.getElementById('libriCandidatiWrapper');
            wrap.innerHTML = `<div style="color:var(--success); font-weight:600; font-size:13px; margin-bottom:12px;">⏳ Ricerca su Hardcover in corso...</div>`;
            cercaCandidatiLibriHC_(titolo)
                .then(function(candidati) { renderCandidatiLibriHC_(candidati, titolo); })
                .catch(function(err) {
                    wrap.innerHTML = `<div style="color:var(--danger); font-size:13px; margin-bottom:12px;">❌ ${String(err && err.message ? err.message : err)}</div>`;
                });
        }
        window.apriRicercaHardcover = apriRicercaHardcover;

        // ------------------------------------------
        // 📚 DETTAGLIO LIBRO: nessun secondo giro di rete (Richiesta 38).
        // La search Hardcover restituisce già trama/generi/saga per ogni
        // candidato: la selezione li prende dai dati in memoria
        // (ultimiCandidatiLibri_), traduce la trama se serve e apre
        // direttamente l'anteprima. Euristica titolo solo se Hardcover non
        // conosce la saga.
        // ------------------------------------------

        // Euristica sul titolo: becca "(Dune, #2)", "Dune #2", "Vol. 3".
        // Ritorna { nome, numero } o null. Meglio un suggerimento da
        // correggere che due campi sempre vuoti.
        function suggerisciSagaDaTitolo_(titolo, sottotitolo) {
            const testi = [String(titolo || ''), String(sottotitolo || '')].filter(function(t) { return t; });
            const patterns = [
                /\(([^()]{2,60}),?\s*#(\d+(?:[.,]\d+)?)\)/,
                /^(.{2,60}?)\s+#(\d+(?:[.,]\d+)?)\s*$/,
                /^(.{2,60}?)\s+[Vv]ol\.?\s*(\d+(?:[.,]\d+)?)\s*$/,
                /^(.{2,60}?)\s*-\s*[Ll]ibro\s*(\d+(?:[.,]\d+)?)\s*$/
            ];
            for (let i = 0; i < testi.length; i++) {
                for (let p = 0; p < patterns.length; p++) {
                    const m = testi[i].match(patterns[p]);
                    if (m) {
                        const n = parseFloat(String(m[2]).replace(',', '.'));
                        return { nome: m[1].trim(), numero: isNaN(n) ? null : n };
                    }
                }
            }
            return null;
        }

        // Ultimi candidati mostrati nel picker (Richiesta 38): la search
        // Hardcover restituisce già i dati completi, la selezione li riusa
        // da qui senza altre chiamate di rete.
        let ultimiCandidatiLibri_ = [];
        // Ultima query digitata (Richiesta 39): se è un titolo intero in
        // italiano la riuso come titolo proposto, così la biblioteca non si
        // riempie di titoli inglesi da correggere a mano.
        let ultimaQueryLibri_ = '';

        // Titolo da proporre nella scheda (Richiesta 39): query lunga (3+
        // parole = hai scritto il titolo intero con parole tue) → mi fido di
        // te con capitalizzazione leggera; query corta (frammento tipo
        // "dune") → il titolo ufficiale è più completo, tengo quello.
        function scegliTitoloDaProporre_(query, titoloHC) {
            const q = String(query || '').trim();
            const t = String(titoloHC || '').trim();
            if (!q) return t;
            const paroleQ = q.split(/\s+/).filter(function(w) { return w; });
            if (paroleQ.length < 3) return t;
            return maiuscolaTitolo_(q);
        }

        // Capitalizza ogni parola tranne articoli/preposizioni/congiunzioni
        // (vale per italiano e inglese): "harry potter e la pietra
        // filosofale" → "Harry Potter e la Pietra Filosofale".
        function maiuscolaTitolo_(s) {
            const minuscole = ['e', 'ed', 'o', 'od', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'del', 'dello', 'della', 'nel', 'nello', 'nella', 'nei', 'negli', 'nelle', 'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'and', 'the', 'of', 'a', 'an', 'on', 'at', 'to', 'for', 'with'];
            return String(s || '').toLowerCase().split(/\s+/).filter(function(w) { return w; }).map(function(w, i) {
                if (i > 0 && minuscole.indexOf(w) !== -1) return w;
                return w.charAt(0).toUpperCase() + w.slice(1);
            }).join(' ');
        }

        function selezionaCandidatoLibroHC_(idLibro, titoloCandidato) {
            const wrap = document.getElementById('libriCandidatiWrapper');
            const cand = (ultimiCandidatiLibri_ || []).find(function(x) { return x.id === idLibro; });
            if (!cand) {
                wrap.innerHTML = `<div style="color:var(--danger); font-size:13px; margin-bottom:12px;">❌ Candidato non più disponibile: cerca di nuovo il libro.</div>`;
                return;
            }
            const sinossiPulita = String(cand.descrizione || '').replace(/\n{3,}/g, '\n\n').trim();
            const completaAnteprima = function(testoFinale) {
                const sagaEur = (!cand.sagaNome) ? suggerisciSagaDaTitolo_(cand.titolo, cand.sottotitolo) : null;
                renderDettaglioLibriHC_({
                    id: cand.id, titolo: cand.titolo, sottotitolo: cand.sottotitolo,
                    titoloProposto: scegliTitoloDaProporre_(ultimaQueryLibri_, cand.titolo),
                    autori: cand.autori, anno: cand.anno,
                    sinossi: testoFinale || 'Nessuna trama disponibile per questo libro.',
                    immagine: cand.immagine, categorie: cand.categorie || [],
                    sagaNome: cand.sagaNome || ((sagaEur && sagaEur.nome) ? sagaEur.nome : ''),
                    sagaNumero: (cand.sagaNumero !== null && cand.sagaNumero !== undefined)
                        ? cand.sagaNumero
                        : ((sagaEur && sagaEur.numero !== null) ? sagaEur.numero : null),
                    sagaFonte: cand.sagaNome ? 'hardcover' : ((sagaEur && sagaEur.nome) ? 'euristica' : 'nessuna')
                });
            };
            // Trama non italiana → traduzione automatica (stesso di AniList).
            if (sinossiPulita && !sembraItaliano_(sinossiPulita)) {
                wrap.innerHTML = `<div style="color:var(--success); font-weight:600; font-size:13px; margin-bottom:12px;">⏳ Traduzione della trama in corso...</div>`;
                tradurreTestoGoogleFree_(sinossiPulita, 'en', 'it').then(completaAnteprima);
            } else {
                completaAnteprima(sinossiPulita);
            }
        }
        window.selezionaCandidatoLibroHC_ = selezionaCandidatoLibroHC_;

        // Pertinenza client-side (Richiesta 37, tenuta anche con Hardcover):
        // Typesense ordina già bene, ma qui vince comunque chi contiene tutta
        // la query, poi chi inizia con essa, poi chi condivide più parole
        // (il titolo pesa doppio dell'autore). Rete di sicurezza a costo zero.
        function ordinaCandidatiPerPertinenza_(candidati, query) {
            const normalizza = function(s) {
                return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            };
            const qn = normalizza(query);
            const parole = qn.split(/[^a-z0-9]+/).filter(function(w) { return w.length > 2; });
            (candidati || []).forEach(function(c) {
                const tn = normalizza(c.titolo);
                const an = normalizza(c.autori);
                let punti = 0;
                if (tn && qn && tn.indexOf(qn) !== -1) punti += 10;
                if (tn && qn && tn.indexOf(qn) === 0) punti += 5;
                parole.forEach(function(w) {
                    if (tn.indexOf(w) !== -1) punti += 2;
                    if (an.indexOf(w) !== -1) punti += 1;
                });
                c._pertinenza = punti;
            });
            (candidati || []).sort(function(a, b) { return (b._pertinenza || 0) - (a._pertinenza || 0); });
            return candidati;
        }

        function renderCandidatiLibriHC_(candidati, queryTitolo) {
            ultimiCandidatiLibri_ = candidati || [];
            ultimaQueryLibri_ = queryTitolo || '';
            ordinaCandidatiPerPertinenza_(ultimiCandidatiLibri_, queryTitolo || '');
            const wrap = document.getElementById('libriCandidatiWrapper');
            if (!candidati || candidati.length === 0) {
                wrap.innerHTML = `<div style="color:var(--text-muted); font-size:13px; margin-bottom:12px;">Nessun risultato su Hardcover: procedi pure a mano.</div>`;
                return;
            }
            wrap.innerHTML = '';
            const label = document.createElement('div');
            label.style = 'font-size:12px; color:var(--text-muted); font-weight:600; margin-bottom:8px;';
            label.innerText = '🔎 Scegli il libro corretto (' + candidati.length + ' risultati — via Hardcover):';
            wrap.appendChild(label);

            const grid = document.createElement('div');
            grid.style = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:10px; margin-bottom:12px;';
            candidati.forEach(function(c) {
                const card = document.createElement('div');
                card.style = 'cursor:pointer; border:1px solid var(--border-color); border-radius:8px; overflow:hidden; background:rgba(255,255,255,0.03); transition: transform 0.15s, border-color 0.15s;';
                card.onmouseover = function() { card.style.transform = 'translateY(-2px)'; card.style.borderColor = 'var(--success)'; };
                card.onmouseout = function() { card.style.transform = 'translateY(0)'; card.style.borderColor = 'var(--border-color)'; };
                const imgHtml = c.immagine
                    ? `<img src="${c.immagine}" style="width:100%; height:170px; object-fit:cover; display:block; background:#222;">`
                    : `<div style="width:100%; height:170px; display:flex; align-items:center; justify-content:center; background:#222; font-size:28px;">📗</div>`;
                const sub = (c.autori ? c.autori : '') + (c.anno ? ' (' + c.anno + ')' : '');
                card.innerHTML = imgHtml + `<div style="padding:6px; font-size:11px; line-height:1.3;"><div style="font-weight:700;">${c.titolo}</div><div style="color:var(--text-muted); margin-top:2px;">${sub}</div></div>`;
                card.onclick = function() { selezionaCandidatoLibroHC_(c.id, c.titolo); };
                grid.appendChild(card);
            });
            wrap.appendChild(grid);
        }

        function renderDettaglioLibriHC_(dettaglio) {
            ultimoDettaglioHardcover = dettaglio;
            const wrap = document.getElementById('libriCandidatiWrapper');
            wrap.innerHTML = '';

            const box = document.createElement('div');
            box.style = 'display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap; background:rgba(52,211,153,0.06); border:1px solid var(--border-color); border-radius:10px; padding:12px; margin-bottom:12px;';
            const imgHtml = dettaglio.immagine
                ? `<img src="${dettaglio.immagine}" style="width:110px; border-radius:8px; flex-shrink:0; background:#222;">`
                : `<div style="width:110px; height:160px; border-radius:8px; flex-shrink:0; background:#222; display:flex; align-items:center; justify-content:center; font-size:32px;">📗</div>`;
            box.innerHTML = imgHtml + `
                <div style="flex:1; min-width:220px; display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:12px; color:var(--text-muted); font-weight:600;">Titolo (modificabile — verrà riportato nella scheda)</label>
                    <input type="text" id="hcTitoloInput" style="width:100%; background:rgba(255,255,255,0.04); border:1px solid var(--border-color); border-radius:8px; color:var(--text); padding:8px; font-size:13px;">
                    <label style="font-size:12px; color:var(--text-muted); font-weight:600;">Trama (modificabile prima di confermare)</label>
                    <textarea id="hcSinossiTextarea" rows="6" style="width:100%; background:rgba(255,255,255,0.04); border:1px solid var(--border-color); border-radius:8px; color:var(--text); padding:8px; font-size:13px; line-height:1.5; resize:vertical;"></textarea>
                    <div style="font-size:12.5px; color:var(--text);">✍️ <b>Autore:</b> ${dettaglio.autori || 'sconosciuto'} &nbsp;·&nbsp; 📅 <b>Anno:</b> ${dettaglio.anno || 'sconosciuto'}</div>
                    <div style="font-size:12.5px; color:var(--text);">📚 <b>Saga suggerita:</b> ${(dettaglio.sagaNome || '—') + ((dettaglio.sagaNumero !== null && dettaglio.sagaNumero !== undefined) ? ' #' + dettaglio.sagaNumero : '')}
                        <span style="color:var(--text-muted);">${dettaglio.sagaFonte === 'nessuna' ? '(non rilevata: compila a mano)' : '(da verificare, resta modificabile)'}</span>
                    </div>
                </div>`;
            wrap.appendChild(box);
            document.getElementById('hcTitoloInput').value = dettaglio.titoloProposto || dettaglio.titolo || '';
            document.getElementById('hcSinossiTextarea').value = dettaglio.sinossi || '';

            const suggeritiLower = (dettaglio.categorie || []).map(function(g) { return String(g).trim().toLowerCase(); });
            const generiCorrispondenti = MASTER_GENRES_LIST.filter(function(g) {
                const gl = g.toLowerCase();
                return suggeritiLower.some(function(s) { return s === gl || s.includes(gl) || gl.includes(s); });
            });
            const genreSection = document.createElement('div');
            genreSection.style = 'margin-bottom:12px;';
            if (generiCorrispondenti.length > 0) {
                genreSection.innerHTML = `
                    <label style="display:block; margin-bottom:6px; font-weight:600; color:var(--text-muted); font-size:12px;">
                        Generi rilevati (deseleziona quelli da scartare — aggiunti ai tuoi senza toglierne)
                    </label>
                    <div id="hcGenresPicker" class="genres-grid-container">
                        ${generiCorrispondenti.map(function(g) {
                            return `<label><input type="checkbox" class="hc_genre_cb" value="${g}" checked> ${g}</label>`;
                        }).join('')}
                    </div>`;
            } else {
                genreSection.innerHTML = `<div style="color:var(--text-muted); font-size:12px;">Nessun genere della tua lista tra quelli di Hardcover (${(dettaglio.categorie || []).join(', ') || 'nessuno'}).</div>`;
            }
            wrap.appendChild(genreSection);

            const footer = document.createElement('div');
            footer.style = 'display:flex; justify-content:flex-end; gap:8px; margin-bottom:12px;';
            footer.innerHTML = `
                <button type="button" class="btn btn-danger" id="hcAnnullaBtn">Annulla</button>
                <button type="button" class="btn btn-libri" id="hcConfermaBtn">✅ Usa questi dati</button>`;
            wrap.appendChild(footer);
            document.getElementById('hcAnnullaBtn').onclick = function() {
                document.getElementById('libriCandidatiWrapper').innerHTML = '';
                ultimoDettaglioHardcover = null;
            };
            document.getElementById('hcConfermaBtn').onclick = confermaDatiHardcover_;
        }

        function applicaDatiPrincipaliLibriHC_() {
            if (!ultimoDettaglioHardcover) return false;
            const d = ultimoDettaglioHardcover;
            const titoloInput = document.getElementById('hcTitoloInput');
            const titoloFinale = titoloInput ? titoloInput.value.trim() : d.titolo;
            const sinossiEl = document.getElementById('hcSinossiTextarea');
            const sinossiFinale = sinossiEl ? sinossiEl.value : d.sinossi;

            if (titoloFinale) document.getElementById('inpTitoloLibri').value = titoloFinale;
            // Autore/anno: li porto dentro solo se il campo scheda è vuoto,
            // mai sovrascrivere ciò che hai già scritto a mano.
            if (d.autori && !document.getElementById('inpAutoreLibri').value.trim()) {
                document.getElementById('inpAutoreLibri').value = d.autori;
            }
            if (d.anno && !String(document.getElementById('inpAnnoLibri').value).trim()) {
                document.getElementById('inpAnnoLibri').value = d.anno;
            }
            document.getElementById('inpImmagineLibri').value = d.immagine || '';

            // Saga: stesso principio, non sovrascrivere il manuale.
            if (d.sagaNome && !document.getElementById('inpSagaNomeLibri').value.trim()) {
                document.getElementById('inpSagaNomeLibri').value = d.sagaNome;
            }
            if ((d.sagaNumero !== null && d.sagaNumero !== undefined) && !String(document.getElementById('inpSagaNumeroLibri').value).trim()) {
                document.getElementById('inpSagaNumeroLibri').value = d.sagaNumero;
            }
            if (!d.sagaNome && (d.sagaNumero === null || d.sagaNumero === undefined)) {
                showToast('Hardcover non conosce la saga: compilala a mano se fa parte di una serie.', 'error');
            } else {
                showToast('Saga suggerita da verificare: correggila pure a mano.', 'success');
            }

            sinossiPendenteLibri = sinossiFinale;

            const picker = document.getElementById('hcGenresPicker');
            if (picker) {
                const daAggiungere = Array.from(picker.querySelectorAll('.hc_genre_cb:checked')).map(function(cb) { return cb.value; });
                document.querySelectorAll('input[name="libri_genres_cb"]').forEach(function(cb) {
                    if (daAggiungere.indexOf(cb.value) !== -1) cb.checked = true;
                });
            }
            return true;
        }

        function confermaDatiHardcover_() {
            if (!applicaDatiPrincipaliLibriHC_()) return;
            document.getElementById('libriCandidatiWrapper').innerHTML = '';
            showToast('Titolo, copertina, trama e generi applicati: premi "Salva" per confermare', 'success');
        }
        window.confermaDatiHardcover_ = confermaDatiHardcover_;

        // ==========================================
        //   📝 PATCH NOTES (note di versione)
        //   Voci user-facing delle modifiche, dalla più recente alla più
        //   vecchia. Versione v1.0.N = Richiesta N della guida_migrazione.md
        //   (il diario tecnico resta lì, qui solo i riassunti brevi).
        //   Nuove voci: aggiungere in CIMA all'array.
        // ==========================================
        const PATCH_NOTES = [
            { v: '1.0.47', titolo: 'Home più compatta su telefono', data: '23/10/2026', punti: [
                'Su telefono la Home parte subito con ricerca e widget: i 5 bottoni dei cataloghi si aprono ora dal menu ☰.',
                'Titolo più piccolo e descrizione nascosta per guadagnare spazio. Da PC non cambia nulla.'
            ] },
            { v: '1.0.46', titolo: 'Bottone Apri Database', data: '23/10/2026', punti: [
                'Il bottone "Apri Database" in Home ha la nuova icona 🗄️: apre le tabelle su Supabase, non più il vecchio foglio Google.',
                'Piccola pulizia del codice, senza cambiamenti visibili.'
            ] },
            { v: '1.0.45', titolo: 'Menu ☰ su smartphone', data: '22/10/2026', punti: [
                'Su telefono la navbar non occupa più mezzo schermo: resta solo il bottone ☰ accanto al logo, in tutte le viste.',
                'Il ☰ apre una barra laterale con Home, viste, Patch notes ed Esci; pallino rosso se ci sono patch da leggere. Da PC non cambia nulla.'
            ] },
            { v: '1.0.44', titolo: 'Suggerimenti manga', data: '14/10/2026', punti: [
                'Bottone 💡 in fondo alla riga manga: top 5 da AniList, esclusi i già in lista (controllo su entrambi i titoli).',
                'Trama tradotta a pezzi, ＋ apre Nuovo Manga col titolo pronto.'
            ] },
            { v: '1.0.43', titolo: 'Suggerimenti anime', data: '14/10/2026', punti: [
                'Bottone 💡 in fondo alla riga anime: top 5 da AniList (search + recommendations), esclusi i già in lista.',
                'Trama, anno, voto e generi subito visibili, niente Edge né chiavi.'
            ] },
            { v: '1.0.42', titolo: 'Suggerimenti cinema', data: '12/10/2026', punti: [
                'Bottone 💡 in fondo alla riga film: top 5 da TMDB (search sul titolo + recommendations), esclusi i già in lista.',
                'Trama progressiva cliccabile. Richiede la action movie_recommendations nella Edge Function.'
            ] },
            { v: '1.0.41', titolo: 'Suggerimenti serie TV', data: '12/10/2026', punti: [
                'Bottone 💡 in fondo alla riga (solo serie con ID TMDB): top 5 da TMDB, esclusi i titoli che hai già.',
                'Richiede la action tv_recommendations nella Edge Function tmdb-proxy (vedi guida).'
            ] },
            { v: '1.0.40', titolo: 'Semi nel giardino per anime e manga', data: '12/10/2026', punti: [
                'Bottone 🌱 in ogni riga anime/manga (solo proprietario): overlay di scrittura che crea/aggiorna la nota nel giardino.',
                'Una nota per titolo (mai duplicati), tags tipo + generi, precarica il testo precedente.'
            ] },
            { v: '1.0.39', titolo: 'Titolo libro in italiano', data: '11/10/2026', punti: [
                'Se cerchi il titolo intero in italiano, te lo ripropone così nella scheda (niente più titoli inglesi).',
                'Con ricerche corte resta il titolo ufficiale completo.'
            ] },
            { v: '1.0.38', titolo: 'Ricerca libri via Hardcover', data: '11/10/2026', punti: [
                'Nuova fonte unica Hardcover: copertina, trama, generi, autore, anno e saga automatica.',
                'Addio errori di Google Books: il token resta al sicuro sul server.'
            ] },
            { v: '1.0.37', titolo: 'Ricerca libri più precisa', data: '11/10/2026', punti: [
                'Trame in inglese tradotte in automatico.',
                'Risultati riordinati per somiglianza al titolo cercato.',
                'Supporto chiave API Google Books gratuita (alza la quota e riduce gli errori).'
            ] },
            { v: '1.0.36', titolo: 'Home compatta + Open Library', data: '11/10/2026', punti: [
                'I 5 bottoni della Home stanno in una riga su desktop, più bassi e compatti.',
                'Se Google Books non risponde (limite richieste) la ricerca passa da sola a Open Library.'
            ] },
            { v: '1.0.35', titolo: 'Biblioteca Libri', data: '11/10/2026', punti: [
                'Nuova vista Libri con ricerca Google Books (copertina, trama, generi, autore, anno).',
                'Saga di livello 1: nome + numero suggeriti quando noti, sempre modificabili a mano.',
                'Stati Da leggere / Letto / Abbandonato con log nel widget di Home e ricerca globale.'
            ] },
            { v: '1.0.32', titolo: 'Streaming vero + badge patch', data: '06/10/2026 · 09:11', punti: [
                'Film in streaming archiviati tra i Visti con data e log, separati col pill Sala/Streaming.',
                'Pallino rosso sulle patch notes con le versioni ancora da leggere (per utente).'
            ] },
            { v: '1.0.30', titolo: 'App installabile', data: '28/09/2026 · 09:25', punti: [
                'Installa il sito come app da mobile: icona joystick, niente barra indirizzi.',
                'Su Android prompt automatico, su iPhone da Condividi > Aggiungi a Home.'
            ] },
            { v: '1.0.29', titolo: 'Voto con overlay', data: '22/09/2026 · 15:08', punti: [
                'Griglia voto 0.5-10 con overlay dedicato e pill Vota in lista.',
                'Auto-apertura al + che completa un anime Concluso mai votato, con Salta per rimandare.'
            ] },
            { v: '1.0.28', titolo: 'Recap rimosso', data: '21/09/2026 · 14:53', punti: [
                'Funzione recap Serie TV rimossa temporaneamente: presentava troppi bug, verrà riprogettata.'
            ] },
            { v: '1.0.24', titolo: 'Tema Aurora Pill', data: '17/09/2026 · 13:00', punti: [
                'Forme morbide su colori invariati: tutto stondato, font Trebuchet, titoli non maiuscoli.'
            ] },
            { v: '1.0.23', titolo: 'Volumi manga da AniList', data: '16/09/2026 · 14:56', punti: [
                'La ricerca AniList nel modale manga compila anche il Numero Volumi, se li conosce.',
                'Il tuo numero scritto a mano viene sempre rispettato.',
                'Importa anche lo stato editoriale giapponese (solo manga, modificabile dopo).'
            ] },
            { v: '1.0.22', titolo: 'Voti Series Graph', data: '16/09/2026 · 11:40', punti: [
                'Nuovo bottone 📊 nelle azioni delle Serie TV: apre i voti IMDb per episodio su Series Graph.',
                'Visibile solo sulle serie collegate a TMDB.'
            ] },
            { v: '1.0.21', titolo: 'Layout mobile', data: '15/09/2026 · 18:26', punti: [
                'Navbar su telefono: mail nascosta, Patch notes ed Esci allineati; icona Esci di nuovo visibile.',
                'Contatori Anime/Serie TV in griglia 2x2 e filtri con scorrimento interno: la pagina non sfora più.'
            ] },
            { v: '1.0.20', titolo: 'Ricerca nel widget In Corso', data: '15/09/2026 · 14:26', punti: [
                'Casella di ricerca nella testata del widget: trova anime, manga e serie TV e apre subito l\u2019overlay di avanzamento.',
                'Al primo episodio/volume segnato l\u2019opera entra da sola nel widget, senza passare dalla vista.'
            ] },
            { v: '1.0.19', titolo: '✅ e 🔢 silenziosi nel log', data: '13/09/2026 · 16:07', punti: [
                '✅ (tutta vista) e 🔢 (visti manuali) non scrivono più righe nel log episodi: ideali per popolare l\u2019archivio.',
                'I pulsanti +/− continuano a registrare ogni episodio come prima.'
            ] },
            { v: '1.0.18', titolo: 'Anime abbandonati', data: '13/09/2026 · 15:50', punti: [
                'Il flag ⛔ arriva anche negli Anime: pulsante riga e checkbox nel modale, mutua esclusione con "già visto".',
                'Flag visione rosso, fuori dal widget "In Corso", overlay congelato (solo totali modificabili).'
            ] },
            { v: '1.0.17', titolo: 'Patch notes nel sito', data: '13/09/2026 · 15:41', punti: [
                'Nuovo bottone 📝 Patch notes nella navbar: tendina con lo storico versioni e overlay col dettaglio.',
                'Ogni voce riporta la data di deploy.'
            ] },
            { v: '1.0.16', titolo: 'Serie TV abbandonate', data: '13/09/2026 · 09:15', punti: [
                'Pulsante ⛔ e flag nel modale per le serie mollate a metà: escono dal widget "In Corso" e il flag visione diventa rosso.',
                'Il progresso resta congelato e si può riprendere quando vuoi; "Aggiorna tutte" le segnala a parte.'
            ] },
            { v: '1.0.15', titolo: '✅ e 🔢 anche nelle Serie TV', data: '12/09/2026 · 22:40', punti: [
                '✅ segna una stagione come tutta vista in un colpo solo.',
                '🔢 imposta a mano gli episodi visti (es. 450 su 800).'
            ] },
            { v: '1.0.14', titolo: 'Fix freccia-su e overlay pronti subito', data: '12/09/2026 · 21:05', punti: [
                'La freccia ↑ torna davvero in alto ed è più piccola su mobile.',
                "Dopo aver aggiunto un anime, l'overlay stagioni si apre subito senza ricaricare la pagina."
            ] },
            { v: '1.0.13', titolo: 'Flag "già visto" negli Anime', data: '12/09/2026 · 18:20', punti: [
                'Nuovo flag nel modale per segnare un anime come tutto visto.',
                "✅ e 🔢 riga per riga nell'overlay episodi; l'icona stagioni delle Serie TV è ora 📺."
            ] },
            { v: '1.0.12', titolo: 'Icona joystick', punti: [
                'Icona joystick nelle schede del browser e nei preferiti.',
                'Su iPhone il collegamento Home usa il file apple-touch-icon.png caricato nella repo.'
            ] },
            { v: '1.0.11', titolo: 'Anni stagioni esistenti', punti: [
                "Le stagioni aggiunte in passato mostrano ora l'anno di uscita (riempimento automatico da TMDB)."
            ] },
            { v: '1.0.10', titolo: 'Anno stagione + pulsanti', punti: [
                'Anno di uscita accanto a ogni stagione delle Serie TV.',
                'Pulsanti "Aggiorna tutte" e "Nuova Serie TV" invertiti.'
            ] },
            { v: '1.0.9', titolo: '"Aggiorna tutte" da TMDB', punti: [
                'Un solo pulsante cerca su TMDB le nuove stagioni di tutte le serie non concluse.'
            ] },
            { v: '1.0.8', titolo: 'Nuova sezione Serie TV', punti: [
                'Catalogo Serie TV con ricerca TMDB, overlay stagioni, widget e log dedicati.'
            ] },
            { v: '1.0.7', titolo: 'Stabilità su iPhone', punti: [
                'Tentativi automatici in caso di rete instabile durante i salvataggi.'
            ] },
            { v: '1.0.6', titolo: 'Manga già letti', punti: [
                'Flag "opera già letta per intero" nel modale manga; generi sistemati su iPhone.'
            ] },
            { v: '1.0.5', titolo: 'Copertine negli overlay', punti: [
                'La copertina si vede anche negli overlay aperti dal widget "In Corso".'
            ] },
            { v: '1.0.4', titolo: 'Anime a stagione unica', punti: [
                'La ricerca collegamenti importa anche le serie a stagione unica.'
            ] },
            { v: '1.0.3', titolo: 'Stagioni collegate (AniList)', punti: [
                'Pulsante per trovare stagioni e film collegati e importarne i numeri reali.'
            ] },
            { v: '1.0.2', titolo: 'Trama e generi dei film', punti: [
                'Trama e generi dai dati TMDB, con pulsante ℹ️ per rileggerli.'
            ] },
            { v: '1.0.1', titolo: 'Ordinamento streaming', punti: [
                '"Da vedere in streaming" ordinati per uscita più recente.'
            ] }
        ];

        function renderPatchNotesList() {
            const box = document.getElementById('patchNotesList');
            if (!box) return;
            box.innerHTML = '';
            PATCH_NOTES.forEach(function(p, idx) {
                const b = document.createElement('button');
                b.className = 'patch-item';
                b.onclick = function() { apriPatchDetail(idx); };
                b.innerHTML = '<span class="patch-ver">v' + p.v + '</span>'
                    + '<span class="patch-item-text"><span class="patch-item-title">' + p.titolo + '</span>'
                    + (p.data ? '<span class="patch-date">📅 ' + p.data + '</span>' : '') + '</span>';
                box.appendChild(b);
            });
        }

        window.apriPatchNotes = function() {
            renderPatchNotesList();
            segnaPatchComeLette_().then(function() { aggiornaBadgePatchNotes(); });
            document.getElementById('patchDrawerBackdrop').classList.add('active');
            document.getElementById('patchDrawer').classList.add('open');
        };
        window.chiudiPatchNotes = function() {
            document.getElementById('patchDrawerBackdrop').classList.remove('active');
            document.getElementById('patchDrawer').classList.remove('open');
        };

        // Badge patch non lette, per utente (tabella patch_lette).
        // Se la tabella non esiste ancora (SQL non eseguito) resta nascosto.
        async function versioniPatchNonLette_() {
            try {
                const res = await supabaseClient.from('patch_lette').select('versione');
                if (res.error) throw res.error;
                const lette = new Set((res.data || []).map(function(r) { return r.versione; }));
                return PATCH_NOTES.filter(function(p) { return !lette.has('v' + p.v); }).map(function(p) { return 'v' + p.v; });
            } catch (err) {
                console.warn('Badge patch notes disabilitato: ' + err);
                return [];
            }
        }

        async function aggiornaBadgePatchNotes() {
            const badge = document.getElementById('patchNotesBadge');
            if (!badge) return;
            const mancanti = await versioniPatchNonLette_();
            // Su mobile il bottone Patch notes sta nel menu ☰: il pallino sul ☰ avvisa che c'e' qualcosa da leggere
            const pallinoMenu = document.getElementById('menuMobileBadge');
            if (mancanti.length > 0) {
                badge.innerText = mancanti.length > 9 ? '9+' : String(mancanti.length);
                badge.style.display = '';
                if (pallinoMenu) pallinoMenu.style.display = '';
            } else {
                badge.style.display = 'none';
                if (pallinoMenu) pallinoMenu.style.display = 'none';
            }
        }

        async function segnaPatchComeLette_() {
            try {
                const righe = PATCH_NOTES.map(function(p) { return { versione: 'v' + p.v }; });
                const res = await supabaseClient.from('patch_lette').upsert(righe, { onConflict: 'user_id,versione' });
                if (res.error) throw res.error;
            } catch (err) {
                console.warn('Salvataggio patch lette fallito: ' + err);
            }
        }
        window.apriPatchDetail = function(idx) {
            const p = PATCH_NOTES[idx];
            if (!p) return;
            document.getElementById('patchDetailTitle').innerText = 'v' + p.v + ' — ' + p.titolo;
            document.getElementById('patchDetailBody').innerHTML =
                (p.data ? '<p class="patch-date" style="margin:0 0 10px 0; font-size:12px;">📅 Deploy: ' + p.data + '</p>' : '')
                + '<ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:6px;">'
                + p.punti.map(function(t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
            document.getElementById('modalOverlayPatchDetail').classList.add('active');
        };


        let cinemaList = [];
        let currentSearchCinema = '';
        // Pannello attivo nello slider del widget "Da Vedere":
        // 'cinema' (default, film in sala) oppure 'streaming'.
        let currentFilterModalitaCinema = 'cinema';
        // Pannello attivo nello slider del widget "Visti" (indipendente da sopra)
        let currentFilterModalitaCinemaVisti = 'cinema';

		        // ==========================================
        //   FASE 11 — GRUPPO CINEMA (Supabase diretto)
        // ==========================================