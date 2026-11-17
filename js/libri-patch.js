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

            // Richiesta 60: con il filtro saga attivo e l'ordine standard
            // (Titolo A-Z) i libri vanno in ordine di saga e numero crescente,
            // senza far salire prima i 📌 prioritari (romperebbero la sequenza).
            // Un ordine scelto a mano nel menu resta quello scelto.
            const sortScelto = document.getElementById('sortSelLibri').value;
            const ordinePerSaga = !!(currentSearchSagaLibri || '').trim() && sortScelto === 'title-asc';
            const sortVal = ordinePerSaga ? 'saga-asc' : sortScelto;
            filtered.sort(function(a, b) {
                const pA = a.priorita ? 1 : 0;
                const pB = b.priorita ? 1 : 0;
                if (!ordinePerSaga && pA !== pB) return pB - pA;
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

                // data-label e classi td-*: servono solo alle schede su telefono
                // (Richiesta 43, css "LISTE A SCHEDE"); su desktop non cambiano nulla.
                const noteVuoteClass = (item.note && String(item.note).trim() !== '') ? '' : ' td-vuota';
                tr.innerHTML = `
                    <td class="media-title td-titolo">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <button class="${starClass}" style="flex-shrink: 0;" onclick="toggleFavoriteLibri('${safeTitle}', this)">${starIcon}</button>
                            <button class="${pinClass}" onclick="togglePinLibri('${safeTitle}', this, event)" title="${pinTitle}">📌</button>
                            ${avatarHTML}
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                    <span>${item.titolo || 'Senza Titolo'}</span>
                                </div>
                                ${autoreHTML}
                                ${sagaHTML}
                                ${genresHTML}
                            </div>
                        </div>
                    </td>
                    <td style="white-space:nowrap;" data-label="Anno">${item.anno || '-'}</td>
                    <td data-label="Stato lettura"><span class="status-badge ${badgeClass}">${item.stato || 'Da leggere'}</span></td>
                    <td class="td-note${noteVuoteClass}" style="color: var(--text-muted); font-size: 13px;" data-label="Note personali">${item.note || '-'}</td>
                    <td class="td-azioni" style="text-align: center; white-space:nowrap;">
                        <button class="action-icon-btn info-azioni" onclick="mostraSinossi('${safeTitle}', 'libri')" title="Visualizza Trama">ℹ️</button>
                        <button class="action-icon-btn btn-modifica" onclick="apriModificaLibro('${safeTitle}')">✏️</button>
                        <button class="action-icon-btn btn-elimina" onclick="rimuoviLibro('${safeTitle}')">🗑️</button>
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
        // 🔎 RICERCA LIBRI IN ITALIANO (Richiesta 59)
        // Tre fonti gratuite, interrogate dal browser e unite:
        //  - Wikidata: trova il libro dal titolo italiano (anche a metà),
        //    dà titolo italiano e inglese, autore, anno e saga + numero;
        //  - Wikipedia italiana: l'inizio della sezione "Trama";
        //  - Hardcover (Edge Function `hardcover-proxy`, Richiesta 38):
        //    copertina, generi, saga e trama quando Wikidata non le ha.
        // Ogni fonte ha il suo tempo massimo: se una non risponde, le altre
        // bastano e la ricerca non si blocca.
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

        // Frase segnaposto delle versioni vecchie: salvata come trama per
        // errore, va trattata come "trama vuota" (Richiesta 59).
        const TRAMA_SEGNAPOSTO_LIBRI_ = ['Nessuna trama disponibile per questo libro.', 'Nessuna informazione su questa opera!'];
        function tramaVuota_(testo) {
            const t = String(testo || '').trim();
            return !t || TRAMA_SEGNAPOSTO_LIBRI_.indexOf(t) !== -1;
        }

        // fetch con tempo massimo: oltre i millisecondi indicati si arrende.
        async function fetchJsonConLimite_(url, ms) {
            const ctrl = new AbortController();
            const timer = setTimeout(function() { ctrl.abort(); }, ms || 6000);
            try {
                const resp = await fetch(url, { signal: ctrl.signal });
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return await resp.json();
            } finally {
                clearTimeout(timer);
            }
        }

        // Ricerca libri via Hardcover (Richiesta 38): il browser chiama solo
        // la Edge Function `hardcover-proxy` (stesso schema di `tmdb-proxy`
        // per TMDB) — il token resta secret lato server.
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

        // Wikidata (Richiesta 59): ricerca a testo libero limitata alle opere
        // con un autore (haswbstatement:P50 = libri, romanzi, fumetti; esclude
        // i film), poi i dettagli degli elementi trovati e, in una terza
        // chiamata, i nomi di autori e saghe in italiano.
        const WD_API_ = 'https://www.wikidata.org/w/api.php?format=json&formatversion=2&origin=*&';
        const WD_TIPI_SAGA_ = ['Q277759', 'Q1667921', 'Q7725310', 'Q13593966']; // serie di libri/romanzi: non sono un singolo libro

        async function cercaLibriWikidata_(query) {
            const q = String(query || '').trim();
            if (!q) return [];
            const ricerca = await fetchJsonConLimite_(WD_API_ + 'action=query&list=search&srprop=&srlimit=8&srsearch=' + encodeURIComponent(q + ' haswbstatement:P50'), 6000);
            const ids = ((ricerca.query && ricerca.query.search) || []).map(function(r) { return r.title; }).filter(function(id) { return /^Q\d+$/.test(id); });
            if (ids.length === 0) return [];
            const ent = await fetchJsonConLimite_(WD_API_ + 'action=wbgetentities&props=labels|claims|sitelinks&languages=it|en|mul&sitefilter=itwiki&ids=' + ids.join('|'), 6000);
            const valoreId = function(claim) {
                const dv = claim && claim.mainsnak && claim.mainsnak.datavalue;
                return (dv && dv.value && dv.value.id) ? dv.value.id : null;
            };
            const libri = [];
            ids.forEach(function(id) {
                const e = ent.entities && ent.entities[id];
                if (!e || !e.claims) return;
                const tipi = (e.claims.P31 || []).map(valoreId);
                if (tipi.some(function(t) { return WD_TIPI_SAGA_.indexOf(t) !== -1; })) return;
                // Edizioni e traduzioni (P629 "edizione di"): doppioni dell'opera
                if (e.claims.P629) return;
                // Senza titolo italiano né pagina su Wikipedia italiana non aggiunge
                // niente a Hardcover (e spesso è un articolo o un'edizione straniera)
                const haTitoloIt = !!(e.labels && e.labels.it);
                const haPaginaIt = !!(e.sitelinks && e.sitelinks.itwiki);
                if (!haTitoloIt && !haPaginaIt) return;
                const autoriIds = (e.claims.P50 || []).map(valoreId).filter(function(x) { return x; });
                // Anno: la data di pubblicazione più vecchia (prima edizione)
                let anno = '';
                (e.claims.P577 || []).forEach(function(c) {
                    const dv = c.mainsnak && c.mainsnak.datavalue;
                    const m = dv && dv.value && dv.value.time ? String(dv.value.time).match(/^[+-]?(\d{4})/) : null;
                    if (m && (!anno || m[1] < anno)) anno = m[1];
                });
                // Saga: preferisco quella che ha il numero (qualificatore P1545)
                const saghe = (e.claims.P179 || []).map(function(c) {
                    const num = c.qualifiers && c.qualifiers.P1545 && c.qualifiers.P1545[0].datavalue
                        ? parseFloat(String(c.qualifiers.P1545[0].datavalue.value).replace(',', '.')) : NaN;
                    return { id: valoreId(c), numero: isNaN(num) ? null : num };
                }).filter(function(s) { return s.id; });
                saghe.sort(function(a, b) { return (b.numero !== null ? 1 : 0) - (a.numero !== null ? 1 : 0); });
                libri.push({
                    qid: id,
                    titoloIt: (e.labels && e.labels.it) ? e.labels.it.value : '',
                    titoloEn: (e.labels && (e.labels.en || e.labels.mul)) ? (e.labels.en || e.labels.mul).value : '',
                    autoriIds: autoriIds, anno: anno,
                    sagaId: saghe.length ? saghe[0].id : null,
                    sagaNumero: saghe.length ? saghe[0].numero : null,
                    paginaWikipedia: (e.sitelinks && e.sitelinks.itwiki) ? e.sitelinks.itwiki.title : ''
                });
            });
            // Nomi di autori e saghe in una sola chiamata. Wikidata salva molti
            // nomi una volta sola nella lingua "mul" (uguale in tutte le lingue,
            // es. "Harry Potter"): se manca l'italiano si usa quella.
            const altri = [];
            libri.forEach(function(l) {
                l.autoriIds.forEach(function(a) { if (altri.indexOf(a) === -1) altri.push(a); });
                if (l.sagaId && altri.indexOf(l.sagaId) === -1) altri.push(l.sagaId);
            });
            let etichette = {};
            if (altri.length > 0) {
                try {
                    const lab = await fetchJsonConLimite_(WD_API_ + 'action=wbgetentities&props=labels&languages=it|en|mul&ids=' + altri.slice(0, 50).join('|'), 6000);
                    Object.keys(lab.entities || {}).forEach(function(k) {
                        const L = lab.entities[k].labels || {};
                        etichette[k] = { it: L.it ? L.it.value : (L.mul ? L.mul.value : ''), en: L.en ? L.en.value : (L.mul ? L.mul.value : '') };
                    });
                } catch (errLab) {
                    console.error('Wikidata: nomi di autori e saghe non disponibili: ' + errLab);
                }
            }
            return libri.map(function(l) {
                const sagaLab = l.sagaId ? (etichette[l.sagaId] || {}) : {};
                return {
                    qid: l.qid, titoloIt: l.titoloIt, titoloEn: l.titoloEn,
                    autori: l.autoriIds.map(function(a) { const x = etichette[a] || {}; return x.it || x.en || ''; }).filter(function(x) { return x; }).join(', '),
                    anno: l.anno,
                    sagaNomeIt: sagaLab.it || '', sagaNomeEn: sagaLab.en || '',
                    sagaNumero: l.sagaNumero,
                    paginaWikipedia: l.paginaWikipedia
                };
            });
        }

        // Taglia un testo ai primi paragrafi, fino a circa `max` caratteri e
        // sempre a fine frase (Richiesta 59: "solo l'inizio", niente finale).
        function tagliaTramaInizio_(testo, max) {
            const limite = max || 700;
            const paragrafi = String(testo || '').split(/\n+/).map(function(p) { return p.trim(); }).filter(function(p) { return p; });
            let out = '';
            for (let i = 0; i < paragrafi.length; i++) {
                const prossimo = out ? out + '\n\n' + paragrafi[i] : paragrafi[i];
                if (prossimo.length <= limite) { out = prossimo; continue; }
                // Il paragrafo non ci sta tutto: aggiungo le sue frasi intere
                // finché c'è posto (se il testo è ancora corto)
                if (out.length < limite * 0.65) {
                    const frasi = paragrafi[i].match(/[^.!?…]+[.!?…]+[»"”)]*\s*/g) || [];
                    let pezzo = '';
                    for (let f = 0; f < frasi.length; f++) {
                        const prova = pezzo + frasi[f];
                        if ((out ? out.length + 2 : 0) + prova.trim().length > limite) break;
                        pezzo = prova;
                    }
                    pezzo = pezzo.trim();
                    if (pezzo) out = out ? out + '\n\n' + pezzo : pezzo;
                    else if (!out) out = paragrafi[i].slice(0, limite).replace(/\s+\S*$/, '') + '…';
                }
                break;
            }
            return out;
        }

        // Wikipedia italiana (Richiesta 59): testo semplice della pagina
        // collegata all'elemento Wikidata (così mai la pagina del film).
        // Restituisce l'inizio della sezione "Trama" e l'introduzione.
        async function tramaDaWikipedia_(pagina) {
            if (!pagina) return { trama: '', intro: '' };
            const url = 'https://it.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=' + encodeURIComponent(pagina);
            const j = await fetchJsonConLimite_(url, 6000);
            const p = j.query && j.query.pages && j.query.pages[0];
            const testo = String((p && p.extract) || '');
            if (!testo) return { trama: '', intro: '' };
            const intro = testo.split(/\n==[^=]/)[0];
            // Sezioni di primo livello "== Titolo =="
            const blocchi = testo.split(/\n(?===[^=].*?==\s*\n)/);
            let trama = '';
            for (let i = 0; i < blocchi.length; i++) {
                const m = blocchi[i].match(/^==\s*([^=].*?)\s*==\s*\n/);
                if (m && /^trama\b/i.test(m[1])) {
                    trama = blocchi[i].slice(m[0].length)
                        .replace(/^=+.*=+\s*$/gm, '') // via i sottotitoli === ... ===
                        .trim();
                    break;
                }
            }
            return { trama: tagliaTramaInizio_(trama, 700), intro: tagliaTramaInizio_(intro, 700) };
        }

        function normalizzaTesto_(s) {
            return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        }

        // Un risultato Hardcover è lo stesso libro di Wikidata se il titolo
        // (italiano o inglese) coincide o è contenuto, e se almeno un
        // cognome dell'autore compare in entrambi.
        function stessoLibro_(wd, hc) {
            const th = normalizzaTesto_(hc.titolo);
            if (!th) return false;
            const titoli = [wd.titoloIt, wd.titoloEn].map(normalizzaTesto_).filter(function(t) { return t; });
            const titoloOk = titoli.some(function(t) { return t === th || (t.length > 4 && th.indexOf(t) === 0) || (th.length > 4 && t.indexOf(th) === 0); });
            if (!titoloOk) return false;
            const aw = normalizzaTesto_(wd.autori).split(' ').filter(function(w) { return w.length > 3; });
            const ah = normalizzaTesto_(hc.autori);
            if (aw.length === 0 || !ah) return true;
            return aw.some(function(w) { return ah.indexOf(w) !== -1; });
        }

        // Ricerca completa: Wikidata e Hardcover in parallelo; se Wikidata
        // trova il libro ma Hardcover no, Hardcover viene interrogato di nuovo
        // con il titolo inglese (+ autore) dei primi due libri di Wikidata.
        async function cercaLibriTutteLeFonti_(query) {
            const esiti = await Promise.allSettled([cercaLibriWikidata_(query), cercaCandidatiLibriHC_(query)]);
            const wd = esiti[0].status === 'fulfilled' ? esiti[0].value : [];
            let hc = esiti[1].status === 'fulfilled' ? esiti[1].value : [];
            if (esiti[0].status === 'rejected') console.error('Wikidata non disponibile: ' + esiti[0].reason);
            const erroreHC = esiti[1].status === 'rejected' ? esiti[1].reason : null;
            if (erroreHC) console.error('Hardcover non disponibile: ' + erroreHC);
            if (wd.length === 0 && erroreHC) throw erroreHC;

            const daRicercare = wd.slice(0, 2).filter(function(w) {
                return w.titoloEn && !hc.some(function(h) { return stessoLibro_(w, h); });
            });
            if (!erroreHC && daRicercare.length > 0) {
                const extra = await Promise.allSettled(daRicercare.map(function(w) {
                    const cognome = String(w.autori.split(',')[0] || '').trim().split(' ').pop();
                    return cercaCandidatiLibriHC_(w.titoloEn + (cognome ? ' ' + cognome : ''));
                }));
                extra.forEach(function(x) {
                    if (x.status !== 'fulfilled') return;
                    x.value.forEach(function(h) {
                        if (!hc.some(function(g) { return g.id === h.id; })) hc.push(h);
                    });
                });
            }

            // Unione: ogni libro di Wikidata prende il suo gemello Hardcover
            // (copertina, generi, trama di riserva); gli Hardcover rimasti
            // restano candidati da soli come prima.
            const usati = {};
            const candidati = wd.map(function(w) {
                const gemello = hc.find(function(h) { return !usati[h.id] && stessoLibro_(w, h); }) || null;
                if (gemello) usati[gemello.id] = true;
                return {
                    id: 'wd:' + w.qid, wd: w, hc: gemello,
                    titolo: w.titoloIt || w.titoloEn || (gemello ? gemello.titolo : ''),
                    autori: w.autori || (gemello ? gemello.autori : ''),
                    anno: w.anno || (gemello ? gemello.anno : ''),
                    immagine: gemello ? gemello.immagine : ''
                };
            });
            hc.forEach(function(h) {
                if (usati[h.id]) return;
                candidati.push({ id: 'hc:' + h.id, wd: null, hc: h, titolo: h.titolo, autori: h.autori, anno: h.anno, immagine: h.immagine });
            });
            return candidati;
        }

        function apriRicercaHardcover() {
            const titolo = document.getElementById('inpTitoloLibri').value.trim();
            if (!titolo) {
                alert('Inserisci prima un titolo da cercare.');
                return;
            }
            const wrap = document.getElementById('libriCandidatiWrapper');
            wrap.innerHTML = `<div style="color:var(--success); font-weight:600; font-size:13px; margin-bottom:12px;">⏳ Ricerca su Wikidata e Hardcover in corso...</div>`;
            cercaLibriTutteLeFonti_(titolo)
                .then(function(candidati) { renderCandidatiLibriHC_(candidati, titolo); })
                .catch(function(err) {
                    wrap.innerHTML = `<div style="color:var(--danger); font-size:13px; margin-bottom:12px;">❌ ${escapeHtmlLog(String(err && err.message ? err.message : err))}</div>`;
                });
        }
        window.apriRicercaHardcover = apriRicercaHardcover;

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

        // Ultimi candidati mostrati nel picker: la selezione li riusa da qui.
        let ultimiCandidatiLibri_ = [];
        // Ultima query digitata (Richiesta 39): se è un titolo intero in
        // italiano la riuso come titolo proposto quando Wikidata non dà il
        // titolo italiano.
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

        // Scelta di un candidato (Richiesta 59): ogni campo dalla fonte
        // migliore disponibile, con la fonte accanto.
        //  - titolo, autore, anno: Wikidata → Hardcover
        //  - trama: inizio Trama di Wikipedia → Hardcover (tradotta) →
        //    introduzione di Wikipedia → vuota
        //  - saga: Wikidata con nome italiano e numero → Hardcover (nome
        //    italiano di Wikidata se c'è) → solo nome → euristica sul titolo
        async function selezionaCandidatoLibroHC_(idLibro) {
            const wrap = document.getElementById('libriCandidatiWrapper');
            const cand = (ultimiCandidatiLibri_ || []).find(function(x) { return x.id === idLibro; });
            if (!cand) {
                wrap.innerHTML = `<div style="color:var(--danger); font-size:13px; margin-bottom:12px;">❌ Candidato non più disponibile: cerca di nuovo il libro.</div>`;
                return;
            }
            const wd = cand.wd, hc = cand.hc;
            wrap.innerHTML = `<div style="color:var(--success); font-weight:600; font-size:13px; margin-bottom:12px;">⏳ Raccolgo trama e saga...</div>`;

            // In modifica servono anche i valori attuali, trama compresa
            const libroAttuale = targetEditTitleLibri
                ? (libriList || []).find(function(l) { return l.titolo === targetEditTitleLibri; }) || null
                : null;
            const lavori = [
                (wd && wd.paginaWikipedia) ? tramaDaWikipedia_(wd.paginaWikipedia) : Promise.resolve({ trama: '', intro: '' }),
                libroAttuale ? getSinossiSB_(libroAttuale.titolo, 'libri') : Promise.resolve('')
            ];
            const esiti = await Promise.allSettled(lavori);
            const wp = esiti[0].status === 'fulfilled' ? esiti[0].value : { trama: '', intro: '' };
            if (esiti[0].status === 'rejected') console.error('Wikipedia non disponibile: ' + esiti[0].reason);
            const tramaAttuale = (esiti[1].status === 'fulfilled' && !tramaVuota_(esiti[1].value)) ? String(esiti[1].value) : '';

            // Trama
            let trama = '', fonteTrama = '';
            const descrHC = hc ? String(hc.descrizione || '').replace(/\n{3,}/g, '\n\n').trim() : '';
            if (wp.trama) { trama = wp.trama; fonteTrama = 'Wikipedia'; }
            else if (descrHC) {
                if (sembraItaliano_(descrHC)) { trama = descrHC; fonteTrama = 'Hardcover'; }
                else {
                    wrap.innerHTML = `<div style="color:var(--success); font-weight:600; font-size:13px; margin-bottom:12px;">⏳ Traduzione della trama in corso...</div>`;
                    trama = await tradurreTestoGoogleFree_(descrHC, 'en', 'it');
                    fonteTrama = 'Hardcover, tradotta';
                }
            } else if (wp.intro) { trama = wp.intro; fonteTrama = 'Wikipedia, introduzione'; }

            // Saga
            let sagaNome = '', sagaNumero = null, fonteSaga = '';
            const hcSagaNome = hc ? hc.sagaNome : '';
            const hcSagaNum = (hc && hc.sagaNumero !== null && hc.sagaNumero !== undefined) ? hc.sagaNumero : null;
            if (wd && wd.sagaNomeIt && wd.sagaNumero !== null) {
                sagaNome = wd.sagaNomeIt; sagaNumero = wd.sagaNumero; fonteSaga = 'Wikidata';
            } else if (hcSagaNome && hcSagaNum !== null) {
                sagaNome = (wd && wd.sagaNomeIt) ? wd.sagaNomeIt : hcSagaNome;
                sagaNumero = hcSagaNum;
                fonteSaga = (wd && wd.sagaNomeIt) ? 'Wikidata + Hardcover' : 'Hardcover';
            } else if (wd && (wd.sagaNomeIt || wd.sagaNomeEn)) {
                sagaNome = wd.sagaNomeIt || wd.sagaNomeEn; sagaNumero = wd.sagaNumero; fonteSaga = 'Wikidata';
            } else if (hcSagaNome) {
                sagaNome = hcSagaNome; sagaNumero = hcSagaNum; fonteSaga = 'Hardcover';
            } else {
                const eur = suggerisciSagaDaTitolo_(hc ? hc.titolo : cand.titolo, hc ? hc.sottotitolo : '');
                if (eur && eur.nome) { sagaNome = eur.nome; sagaNumero = eur.numero; fonteSaga = 'dal titolo'; }
            }

            const titolo = (wd && wd.titoloIt) ? wd.titoloIt : scegliTitoloDaProporre_(ultimaQueryLibri_, cand.titolo);
            renderDettaglioLibriHC_({
                titolo: titolo, fonteTitolo: (wd && wd.titoloIt) ? 'Wikidata' : (hc ? 'Hardcover' : ''),
                autori: (wd && wd.autori) ? wd.autori : (hc ? hc.autori : ''),
                fonteAutori: (wd && wd.autori) ? 'Wikidata' : (hc && hc.autori ? 'Hardcover' : ''),
                anno: (wd && wd.anno) ? wd.anno : (hc ? hc.anno : ''),
                fonteAnno: (wd && wd.anno) ? 'Wikidata' : (hc && hc.anno ? 'Hardcover' : ''),
                sinossi: trama, fonteTrama: fonteTrama,
                immagine: hc ? hc.immagine : '',
                categorie: hc ? (hc.categorie || []) : [],
                sagaNome: sagaNome, sagaNumero: sagaNumero, fonteSaga: fonteSaga,
                attuale: libroAttuale ? {
                    titolo: libroAttuale.titolo, autori: libroAttuale.autore || '', anno: libroAttuale.anno || '',
                    sagaNome: libroAttuale.sagaNome || '', sagaNumero: libroAttuale.sagaNumero,
                    sinossi: tramaAttuale, immagine: libroAttuale.immagine || ''
                } : null
            });
        }
        window.selezionaCandidatoLibroHC_ = selezionaCandidatoLibroHC_;

        // Pertinenza client-side (Richiesta 37): vince chi contiene tutta la
        // query, poi chi inizia con essa, poi chi condivide più parole (il
        // titolo pesa doppio dell'autore). Con Wikidata (Richiesta 59) i
        // libri riconosciuti da Wikidata hanno un piccolo vantaggio.
        function ordinaCandidatiPerPertinenza_(candidati, query) {
            const qn = normalizzaTesto_(query);
            const parole = qn.split(' ').filter(function(w) { return w.length > 2; });
            (candidati || []).forEach(function(c) {
                const tn = normalizzaTesto_(c.titolo);
                const an = normalizzaTesto_(c.autori);
                let punti = 0;
                if (tn && qn && tn.indexOf(qn) !== -1) punti += 10;
                if (tn && qn && tn.indexOf(qn) === 0) punti += 5;
                parole.forEach(function(w) {
                    if (tn.indexOf(w) !== -1) punti += 2;
                    if (an.indexOf(w) !== -1) punti += 1;
                });
                if (c.wd) punti += 1;
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
                wrap.innerHTML = `<div style="color:var(--text-muted); font-size:13px; margin-bottom:12px;">Nessun risultato su Wikidata e Hardcover: procedi pure a mano.</div>`;
                return;
            }
            wrap.innerHTML = '';
            const label = document.createElement('div');
            label.style = 'font-size:12px; color:var(--text-muted); font-weight:600; margin-bottom:8px;';
            label.innerText = '🔎 Scegli il libro corretto (' + candidati.length + ' risultati):';
            wrap.appendChild(label);

            const grid = document.createElement('div');
            grid.style = 'display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:10px; margin-bottom:12px;';
            ultimiCandidatiLibri_.slice(0, 12).forEach(function(c) {
                const card = document.createElement('div');
                card.style = 'cursor:pointer; border:1px solid var(--border-color); border-radius:8px; overflow:hidden; background:rgba(255,255,255,0.03); transition: transform 0.15s, border-color 0.15s;';
                card.onmouseover = function() { card.style.transform = 'translateY(-2px)'; card.style.borderColor = 'var(--success)'; };
                card.onmouseout = function() { card.style.transform = 'translateY(0)'; card.style.borderColor = 'var(--border-color)'; };
                const imgHtml = c.immagine
                    ? `<img src="${escapeHtmlLog(c.immagine)}" style="width:100%; height:170px; object-fit:cover; display:block; background:#222;">`
                    : `<div style="width:100%; height:170px; display:flex; align-items:center; justify-content:center; background:#222; font-size:28px;">📗</div>`;
                const sub = (c.autori ? c.autori : '') + (c.anno ? ' (' + c.anno + ')' : '');
                const fonti = (c.wd ? 'Wikidata' : '') + (c.wd && c.hc ? ' + ' : '') + (c.hc ? 'Hardcover' : '');
                card.innerHTML = imgHtml + `<div style="padding:6px; font-size:11px; line-height:1.3;"><div style="font-weight:700;">${escapeHtmlLog(c.titolo)}</div><div style="color:var(--text-muted); margin-top:2px;">${escapeHtmlLog(sub)}</div><div style="color:var(--text-muted); margin-top:2px; font-size:10px; opacity:.8;">${fonti}</div></div>`;
                card.onclick = function() { selezionaCandidatoLibroHC_(c.id); };
                grid.appendChild(card);
            });
            wrap.appendChild(grid);
        }

        // Anteprima del libro scelto (Richiesta 59). Per ogni campo: valore
        // trovato (modificabile per titolo e trama) e fonte. In modifica di un
        // libro già salvato c'è anche il valore attuale con la casella
        // "Sostituisci", già spuntata se il campo attuale è vuoto.
        function renderDettaglioLibriHC_(dettaglio) {
            ultimoDettaglioHardcover = dettaglio;
            const wrap = document.getElementById('libriCandidatiWrapper');
            wrap.innerHTML = '';
            const att = dettaglio.attuale;
            const esc = escapeHtmlLog;
            const fonte = function(f) { return f ? ` <span style="font-weight:400; color:var(--text-muted); font-size:11px;">(${esc(f)})</span>` : ''; };
            const sagaTesto = function(nome, numero) {
                return (nome || '—') + ((numero !== null && numero !== undefined && numero !== '') ? ' #' + numero : '');
            };
            // Riga "attuale" + casella, solo in modifica
            const confronto = function(campo, testoAttuale, vuoto, uguale) {
                if (!att) return '';
                if (uguale) return `<div style="font-size:11.5px; color:var(--text-muted);">Uguale a quello salvato.</div>`;
                return `<div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; font-size:11.5px; color:var(--text-muted);">
                        <span>${campo === 'immagine' ? 'Copertina attuale' : 'Attuale'}: ${vuoto ? '<i>' + (campo === 'immagine' ? 'nessuna' : 'vuoto') + '</i>' : esc(testoAttuale)}</span>
                        <label style="display:inline-flex; gap:4px; align-items:center; color:var(--text); cursor:pointer;"><input type="checkbox" class="hc_sostituisci" data-campo="${campo}"${vuoto ? ' checked' : ''}> Sostituisci</label>
                    </div>`;
            };
            const stessoTesto = function(a, b) { return normalizzaTesto_(a) === normalizzaTesto_(b); };

            const box = document.createElement('div');
            box.style = 'display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap; background:rgba(52,211,153,0.06); border:1px solid var(--border-color); border-radius:10px; padding:12px; margin-bottom:12px;';
            const imgHtml = dettaglio.immagine
                ? `<img src="${esc(dettaglio.immagine)}" style="width:110px; border-radius:8px; flex-shrink:0; background:#222;">`
                : `<div style="width:110px; height:160px; border-radius:8px; flex-shrink:0; background:#222; display:flex; align-items:center; justify-content:center; font-size:32px;">📗</div>`;
            const copertinaConfronto = (att && dettaglio.immagine)
                ? confronto('immagine', att.immagine ? 'già presente' : '', !att.immagine, att.immagine === dettaglio.immagine)
                : '';
            box.innerHTML = `<div style="display:flex; flex-direction:column; gap:6px; width:110px; flex-shrink:0;">${imgHtml}${copertinaConfronto}</div>
                <div style="flex:1; min-width:220px; display:flex; flex-direction:column; gap:8px;">
                    <div>
                        <label style="font-size:12px; color:var(--text-muted); font-weight:600;">Titolo${fonte(dettaglio.fonteTitolo)}</label>
                        <input type="text" id="hcTitoloInput" style="width:100%; font-family:inherit; background:rgba(255,255,255,0.04); border:1px solid var(--border-color); border-radius:8px; color:var(--text); padding:8px; font-size:13px;">
                        ${att ? confronto('titolo', att.titolo, false, stessoTesto(att.titolo, dettaglio.titolo)) : ''}
                    </div>
                    <div>
                        <label style="font-size:12px; color:var(--text-muted); font-weight:600;">Trama${fonte(dettaglio.fonteTrama)}</label>
                        <textarea id="hcSinossiTextarea" rows="6" placeholder="Nessuna trama trovata: scrivila tu se vuoi." style="width:100%; font-family:inherit; background:rgba(255,255,255,0.04); border:1px solid var(--border-color); border-radius:8px; color:var(--text); padding:8px; font-size:13px; line-height:1.5; resize:vertical;"></textarea>
                        ${(att && dettaglio.sinossi) ? confronto('sinossi', att.sinossi ? (att.sinossi.length > 90 ? att.sinossi.slice(0, 90) + '…' : att.sinossi) : '', !att.sinossi, stessoTesto(att.sinossi, dettaglio.sinossi)) : ''}
                    </div>
                    <div style="font-size:12.5px; color:var(--text);">✍️ <b>Autore:</b> ${esc(dettaglio.autori || 'sconosciuto')}${fonte(dettaglio.fonteAutori)}
                        ${(att && dettaglio.autori) ? confronto('autori', att.autori, !att.autori, stessoTesto(att.autori, dettaglio.autori)) : ''}
                    </div>
                    <div style="font-size:12.5px; color:var(--text);">📅 <b>Anno:</b> ${esc(dettaglio.anno || 'sconosciuto')}${fonte(dettaglio.fonteAnno)}
                        ${(att && dettaglio.anno) ? confronto('anno', att.anno, !att.anno, String(att.anno) === String(dettaglio.anno)) : ''}
                    </div>
                    <div style="font-size:12.5px; color:var(--text);">📚 <b>Saga:</b> ${esc(sagaTesto(dettaglio.sagaNome, dettaglio.sagaNumero))}${dettaglio.fonteSaga ? fonte(dettaglio.fonteSaga + ', da verificare') : ' <span style="color:var(--text-muted);">(non trovata: compila a mano se fa parte di una serie)</span>'}
                        ${(att && dettaglio.sagaNome) ? confronto('saga', sagaTesto(att.sagaNome, att.sagaNumero), !att.sagaNome, stessoTesto(att.sagaNome, dettaglio.sagaNome) && String(att.sagaNumero) === String(dettaglio.sagaNumero)) : ''}
                    </div>
                </div>`;
            wrap.appendChild(box);
            document.getElementById('hcTitoloInput').value = dettaglio.titolo || '';
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
                            return `<label><input type="checkbox" class="hc_genre_cb" value="${esc(g)}" checked> ${esc(g)}</label>`;
                        }).join('')}
                    </div>`;
            } else if ((dettaglio.categorie || []).length > 0) {
                genreSection.innerHTML = `<div style="color:var(--text-muted); font-size:12px;">Nessun genere della tua lista tra quelli di Hardcover (${esc(dettaglio.categorie.join(', '))}).</div>`;
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

        // Porta i dati dell'anteprima nel modulo. Libro nuovo: riempie i campi
        // ancora vuoti (mai sovrascrivere quello che hai scritto a mano).
        // Modifica: sostituisce solo i campi con la casella spuntata; i campi
        // uguali o senza casella restano come sono.
        function applicaDatiPrincipaliLibriHC_() {
            if (!ultimoDettaglioHardcover) return false;
            const d = ultimoDettaglioHardcover;
            const inModifica = !!d.attuale;
            const spuntati = {};
            document.querySelectorAll('#libriCandidatiWrapper .hc_sostituisci').forEach(function(cb) {
                spuntati[cb.getAttribute('data-campo')] = cb.checked;
            });
            const puoiScrivere = function(campo, idInput) {
                if (inModifica) return spuntati[campo] === true;
                return !String(document.getElementById(idInput).value).trim();
            };
            const titoloInput = document.getElementById('hcTitoloInput');
            const titoloFinale = titoloInput ? titoloInput.value.trim() : d.titolo;
            const sinossiEl = document.getElementById('hcSinossiTextarea');
            const sinossiFinale = sinossiEl ? sinossiEl.value.trim() : String(d.sinossi || '');

            // Titolo: libro nuovo sempre (è quello cercato); in modifica solo se spuntato
            if (titoloFinale && (!inModifica || spuntati.titolo === true)) {
                document.getElementById('inpTitoloLibri').value = titoloFinale;
            }
            if (d.autori && puoiScrivere('autori', 'inpAutoreLibri')) document.getElementById('inpAutoreLibri').value = d.autori;
            if (d.anno && puoiScrivere('anno', 'inpAnnoLibri')) document.getElementById('inpAnnoLibri').value = d.anno;
            if (d.immagine && (!inModifica || spuntati.immagine === true)) document.getElementById('inpImmagineLibri').value = d.immagine;

            if (d.sagaNome) {
                const scriviSaga = inModifica ? spuntati.saga === true
                    : !document.getElementById('inpSagaNomeLibri').value.trim();
                if (scriviSaga) {
                    document.getElementById('inpSagaNomeLibri').value = d.sagaNome;
                    document.getElementById('inpSagaNumeroLibri').value = (d.sagaNumero !== null && d.sagaNumero !== undefined) ? d.sagaNumero : '';
                }
            }

            // Trama: salvata insieme al libro (sinossiPendenteLibri)
            if (sinossiFinale && !tramaVuota_(sinossiFinale) && (!inModifica || spuntati.sinossi === true)) {
                sinossiPendenteLibri = sinossiFinale;
            }

            const picker = document.getElementById('hcGenresPicker');
            if (picker) {
                const daAggiungere = Array.from(picker.querySelectorAll('.hc_genre_cb:checked')).map(function(cb) { return cb.value; });
                document.querySelectorAll('input[name="libri_genres_cb"]').forEach(function(cb) {
                    if (daAggiungere.indexOf(cb.value) !== -1) cb.checked = true;
                });
            }
            if (!d.sagaNome) showToast('Saga non trovata: compilala a mano se il libro fa parte di una serie.', 'error');
            return true;
        }

        function confermaDatiHardcover_() {
            if (!applicaDatiPrincipaliLibriHC_()) return;
            document.getElementById('libriCandidatiWrapper').innerHTML = '';
            showToast('Dati applicati al modulo: premi "Salva" per confermare', 'success');
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
            { v: '1.1.9', titolo: 'Suggerimenti film migliori', data: '17/11/2026', punti: [
                'Il 💡 dei film parte dal film giusto anche quando ci sono remake con lo stesso titolo (es. Il re leone del 2019, non quello del 1994).',
                'Fino a 10 suggerimenti più gli altri da aprire, ordinati dal voto più alto, solo film dal 2000 in poi.',
                'I film che hai già non ricompaiono, ma un remake che non hai sì. La trama è sempre in italiano.'
            ] },
            { v: '1.1.8', titolo: 'Suggerimenti serie TV migliori', data: '17/11/2026', punti: [
                'Il 💡 delle serie TV ora ne propone fino a 10, più gli altri da aprire, ordinati dal voto più alto.',
                'Niente più serie vecchissime: solo quelle iniziate dal 2000 in poi. Le serie che hai già non ricompaiono, anche se le hai rinominate.',
                'La trama è sempre in italiano: se TMDB ce l\'ha solo in inglese, viene tradotta.'
            ] },
            { v: '1.1.7', titolo: 'Suggerimenti anime più precisi', data: '17/11/2026', punti: [
                'Il 💡 degli anime trova la serie giusta anche con titoli italiani, con "(Netflix)" o un anno tra parentesi. Se non è sicuro ti fa scegliere la copertina una volta sola.',
                'Propone sempre la prima stagione delle serie nuove e niente seconde stagioni, film o OVA di serie che hai già. Niente più spot e video musicali.',
                'Fino a 10 suggerimenti più gli altri da aprire; il ＋ apre la scheda già compilata con copertina, trama e generi, e puoi cercare subito le stagioni collegate.'
            ] },
            { v: '1.1.6', titolo: 'Suggerimenti manga che trovi in Italia', data: '17/11/2026', punti: [
                'Il 💡 dei manga ti propone prima quelli pubblicati in Italia, con titolo italiano, editore e volumi usciti. Gli altri sono nascosti in fondo, se vuoi guardarli.',
                'Trova il manga giusto anche dal titolo italiano. Se non è sicuro ti fa scegliere la copertina una volta sola e poi se lo ricorda.',
                'Non ti ripropone manga che hai già, anche se scritti in modo un po\' diverso. Il ＋ apre la scheda già compilata con copertina, trama, generi e volumi.'
            ] },
            { v: '1.1.5', titolo: 'Libri cercati in italiano', data: '16/11/2026', punti: [
                'Nella finestra del libro il bottone ora si chiama 🔎 Cerca e trova i libri anche dal titolo italiano, scritto pure a metà.',
                'Titolo, autore, anno e saga arrivano da Wikidata con il nome della saga in italiano (es. Cronache del Mondo Emerso #1); la trama è l\'inizio di quella di Wikipedia, senza finale. Hardcover resta per copertina, generi e quando le altre fonti non sanno nulla.',
                'Accanto a ogni campo vedi da dove arriva. Se modifichi un libro già salvato vedi il valore attuale e scegli tu cosa sostituire.'
            ] },
            { v: '1.1.4', titolo: 'Log senza doppioni quando correggi', data: '14/11/2026', punti: [
                'Se segni per sbaglio un volume, un episodio o una stagione in più e torni subito indietro (entro 10 minuti), la voce sbagliata sparisce dal log invece di restare con un doppione.',
                'Se torni indietro più tardi, nel log resta scritto chiaramente "↩️ Correzione: tornato al volume 4" invece di un finto "Letto il volume 4".',
                'Anche le vecchie voci di questo tipo ora si leggono come correzioni. Nei filtri del log c\'è la nuova azione ↩️ Correzione.'
            ] },
            { v: '1.1.3', titolo: 'Schermata di accesso in vetro', data: '11/11/2026', punti: [
                'La schermata di accesso ha lo stile del resto del sito: sfondo colorato e riquadro di vetro, con dietro le icone delle sezioni che galleggiano piano.',
                'Nel campo password c\'è il bottone 👁️ per vedere quello che scrivi; all\'invio la password torna nascosta.'
            ] },
            { v: '1.1.2', titolo: 'Effetto genio tra le sezioni', data: '11/11/2026', punti: [
                'Da PC, cambiando sezione, la pagina viene risucchiata a imbuto nella sua icona della barra e la nuova esce a imbuto dall\'icona cliccata, come le finestre nel Dock del Mac.',
                'Da telefono versione leggera: la sezione si rimpicciolisce dentro la sua icona e la nuova si allarga da quella cliccata.',
                'La sezione nuova esce quando i suoi dati sono pronti, così non si vede la scritta di caricamento. Sostituisce la dissolvenza della v1.1.1.'
            ] },
            { v: '1.1.1', titolo: 'Passaggi fluidi tra le sezioni', data: '11/11/2026', punti: [
                'Cambiando sezione la pagina vecchia svanisce e la nuova entra sfocata e si mette a fuoco, invece di comparire di colpo.',
                'Il riquadro di selezione della barra scivola dall\'icona di prima a quella nuova (in verticale da PC, in orizzontale da telefono).',
                'Da PC il riquadro Prossimi al cinema della Home parte aperto.'
            ] },
            { v: '1.1.0', titolo: 'Nuovo stile vetro', data: '11/11/2026', punti: [
                'Tutto il tracker ha un nuovo aspetto: pannelli di vetro semitrasparenti e sfocati su uno sfondo colorato.',
                'Da PC il menu è una barra verticale di icone a sinistra (il nome compare passandoci sopra); in basso patch notes, database, esporta, utente ed esci.',
                'Da telefono il menu è una barra fissa in basso con le sezioni; il bottone ⋯ apre gli strumenti.',
                'La Home è a riquadri: ricerca, i cinque cataloghi con il numero di titoli, In corso, Prossimi al cinema e il registro attività (aperto di default da PC).',
                'Contatori, filtri, tabelle, schede, finestre e messaggi sono tutti in vetro. Le funzioni sono le stesse di prima.'
            ] },
            { v: '1.0.55', titolo: 'Esporta i miei dati', data: '11/11/2026', punti: [
                'Nuovo bottone 💾 Esporta i miei dati: scarica un file con tutte le tue liste, episodi, trame e registri, da tenere come copia di sicurezza.',
                'Esporta solo i dati di chi lo preme. Da PC è in Home in alto a destra, da telefono nel menu ☰.'
            ] },
            { v: '1.0.54', titolo: 'Registri a schede su telefono', data: '10/11/2026', punti: [
                'Su telefono i registri degli episodi anime e delle stagioni delle serie TV sono a schede compatte: titolo e data in alto, sotto stagione, episodio e azione.',
                'Con questo tutte le liste del tracker si leggono su telefono senza scorrere di lato. Da PC non cambia nulla.'
            ] },
            { v: '1.0.53', titolo: 'Anime a schede su telefono', data: '10/11/2026', punti: [
                'Su telefono la lista Anime è a schede compatte: copertina e titolo in alto, una riga con stagioni, film e visione, una con stato e voto, note solo se ci sono.',
                'In fondo alla scheda ℹ️ 📺 💡 ⛔ a sinistra e ✏️ 🗑️ a destra.',
                'Da PC ℹ️ e 📺 passano dal titolo alla colonna Azioni, con i bottoni su due righe da tre.'
            ] },
            { v: '1.0.52', titolo: 'Film a schede su telefono', data: '10/11/2026', punti: [
                'Su telefono i film dei widget Da Vedere e Visti sono a schede: locandina e titolo in alto, una riga con data e bottone Visto, in fondo ℹ️ 📺 💡 a sinistra e 🗑️ a destra.',
                'Dentro i widget si vedono 3 film in Da Vedere e 5 in Visti, poi si scorre; lo switch Sala/Streaming funziona come prima.',
                'Da PC non cambia nulla.'
            ] },
            { v: '1.0.51', titolo: 'Serie TV a schede su telefono', data: '10/11/2026', punti: [
                'Su telefono la lista Serie TV è a schede compatte: copertina e titolo in alto, una riga con stagioni, stato e visione, note solo se ci sono.',
                'In fondo alla scheda ℹ️ 📺 📊 💡 🔄 ⛔ a sinistra e ✏️ 🗑️ a destra, tutti su una riga.',
                'Da PC ℹ️ e 📺 passano dal titolo alla colonna Azioni, con i bottoni a griglia su due righe come Anime e Manga.'
            ] },
            { v: '1.0.50', titolo: 'Manga a schede su telefono', data: '10/11/2026', punti: [
                'Su telefono anche la lista Manga è a schede compatte: copertina e titolo in alto, poi due righe con tipologia, volumi e volumi letti, stato, acquisto e lettura; note e bottoni in fondo (ℹ️ 💡 a sinistra, ✏️ 🗑️ a destra, come nei Libri).',
                'Da PC i bottoni dei Manga sono a quadrato come negli Anime, con la ℹ️ della trama tra le azioni.',
                'Su telefono il bottone ↑ non copre più i bottoni dell\'ultima scheda, anche nei Libri.'
            ] },
            { v: '1.0.49', titolo: 'Libri a schede su telefono', data: '10/11/2026', punti: [
                'Su telefono la lista Libri non è più una tabella da scorrere di lato: ogni libro è una scheda con copertina e titolo in alto, anno e stato sotto, note e bottoni in fondo (ℹ️ trama a sinistra, ✏️ 🗑️ a destra).',
                'Le note vuote non occupano spazio. Da PC non cambia nulla; le altre liste passeranno alle schede una alla volta.'
            ] },
            { v: '1.0.48', titolo: 'Tolto il giardino digitale', data: '06/11/2026', punti: [
                'Il giardino digitale è stato chiuso: dalle righe di anime e manga sparisce il bottone 🌱.',
                'Nessun altro cambiamento: liste, episodi e suggerimenti funzionano come prima.'
            ] },
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