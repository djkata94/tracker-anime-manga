        function calcolaColoreLetturaManga_(volumiTotali, volumiLetti, stato) {
            const totali = parseInt(volumiTotali) || 0;
            const letti = parseInt(volumiLetti) || 0;
            const statoNorm = String(stato || '').trim().toLowerCase();
            if (totali <= 0 || letti <= 0) return 'bianco';
            if (letti < totali) return 'giallo';
            return (statoNorm === 'in corso') ? 'giallo' : 'verde';
        }

        async function getMangaDataSB_() {
            const { data, error } = await supabaseClient.from('manga').select('*').order('titolo', { ascending: true });
            if (error) throw error;
            return (data || []).map(function(m) {
                let notaTesto = m.note || '';
                if (typeof notaTesto === 'string' && !notaTesto.includes('<a ') && notaTesto.match(/https?:\/\/[^\s]+/i)) {
                    notaTesto = notaTesto.replace(/(https?:\/\/[^\s]+)/gi, '<a href="$1" target="_blank" style="color: #00ffcc; text-decoration: underline; font-weight: 500;">$1</a>');
                }
                const coloreLettura = calcolaColoreLetturaManga_(m.volumi, m.volumi_letti, m.stato);
                return {
                    titolo: m.titolo, tipologia: m.tipologia || 'Manga', volumi: m.volumi || 0,
                    stato: m.stato || 'In corso', acquistato: m.acquistato ? 'SÃ¬' : 'No', note: notaTesto,
                    coloreLettura: coloreLettura, generi: m.generi || '', preferito: !!m.preferito,
                    immagine: m.immagine || '', volumiLetti: m.volumi_letti || 0, priorita: !!m.priorita
                };
            });
        }

        async function addMangaSB_(dati) {
            const acquistatoBool = (dati.acquistato === 'SÃ¬');
            const volumiTotaliNuovaOpera = parseInt(dati.volumi) || 0;
            // Flag "opera giÃ  letta per intero" spuntato nel modale: l'opera nasce
            // direttamente completata invece di partire da 0 volumi letti.
            const volumiLettiIniziali = (dati.segnaComeLetto && volumiTotaliNuovaOpera > 0) ? volumiTotaliNuovaOpera : 0;
            const { error: errIns } = await supabaseClient.from('manga').insert([{
                titolo: dati.titolo || '', tipologia: dati.tipologia || 'Manga', volumi: volumiTotaliNuovaOpera,
                stato: dati.stato || 'In corso', acquistato: acquistatoBool, note: dati.note || '',
                generi: dati.generi || '', preferito: false, immagine: dati.immagine || '',
                volumi_letti: volumiLettiIniziali, priorita: false
            }]);
            if (errIns) throw errIns;

            await supabaseClient.from('sinossi_manga').insert([{ manga_titolo: dati.titolo, sinossi: '' }]);
            await registraLogSB_(dati.titolo, 'MANGA', 'CREAZIONE', 'N/D', dati.stato || 'In corso');
            if (acquistatoBool) await registraLogSB_(dati.titolo, 'MANGA', 'ACQUISTO', 'No', 'SÃ¬');

            return getMangaDataSB_();
        }

        async function updateMangaSB_(vecchioTitolo, dati) {
            const vecchioTitoloTrim = String(vecchioTitolo).trim();
            const { data: righeVecchie, error: errSel } = await supabaseClient.from('manga').select('*').eq('titolo', vecchioTitoloTrim);
            if (errSel) throw errSel;
            if (!righeVecchie || righeVecchie.length === 0) return getMangaDataSB_();
            const vecchiaRiga = righeVecchie[0];

            const volumiTotaliNuovi = parseInt(dati.volumi) || 0;
            const statoNuovo = dati.stato || 'In corso';
            const vecchioStatoLogManga = vecchiaRiga.stato || 'In corso';
            const vecchioAcquistatoLogManga = vecchiaRiga.acquistato ? 'SÃ¬' : 'No';

            let volumiLettiEsistenti = vecchiaRiga.volumi_letti || 0;
            if (volumiTotaliNuovi > 0 && volumiLettiEsistenti > volumiTotaliNuovi) {
                volumiLettiEsistenti = volumiTotaliNuovi;
            }
            // Flag "opera giÃ  letta per intero" spuntato nel modale: porta i volumi
            // letti al totale. Il valore precedente serve dopo per il log AVANZAMENTO.
            const volumiLettiPrimaModifica = vecchiaRiga.volumi_letti || 0;
            if (dati.segnaComeLetto && volumiTotaliNuovi > 0) {
                volumiLettiEsistenti = volumiTotaliNuovi;
            }

            const acquistatoNuovo = dati.acquistato || 'No';

            const { error: errUpd } = await supabaseClient.from('manga').update({
                titolo: dati.titolo || '', tipologia: dati.tipologia || 'Manga', volumi: volumiTotaliNuovi,
                stato: statoNuovo, acquistato: (acquistatoNuovo === 'SÃ¬'), note: dati.note || '',
                generi: dati.generi || '', immagine: dati.immagine || '', volumi_letti: volumiLettiEsistenti
            }).eq('titolo', vecchioTitoloTrim);
            if (errUpd) throw errUpd;

            try {
                const titoloLogManga = dati.titolo || vecchioTitolo;
                if (String(statoNuovo).trim() !== String(vecchioStatoLogManga).trim()) {
                    // Come negli anime: fine pubblicazione, non fine lettura.
                    await registraLogSB_(titoloLogManga, 'MANGA', 'CAMBIO_STATO', vecchioStatoLogManga, statoNuovo);
                }
                if (String(acquistatoNuovo).trim() !== String(vecchioAcquistatoLogManga).trim() && acquistatoNuovo === 'SÃ¬') {
                    await registraLogSB_(titoloLogManga, 'MANGA', 'ACQUISTO', vecchioAcquistatoLogManga, acquistatoNuovo);
                }
                // Avanzamento dovuto al flag "opera giÃ  letta per intero": stessi eventi
                // che registrerebbe il âž• dalla lista (vedi updateMangaVolumiLettiSB_).
                if (dati.segnaComeLetto && volumiLettiEsistenti !== volumiLettiPrimaModifica) {
                    await registraLogSB_(titoloLogManga, 'MANGA', 'AVANZAMENTO', volumiLettiPrimaModifica, volumiLettiEsistenti);
                    const coloreDopoModifica = calcolaColoreLetturaManga_(volumiTotaliNuovi, volumiLettiEsistenti, statoNuovo);
                    if (coloreDopoModifica === 'verde' && volumiTotaliNuovi > 0 && volumiLettiPrimaModifica < volumiTotaliNuovi) {
                        await registraLogSB_(titoloLogManga, 'MANGA', 'COMPLETAMENTO',
                            volumiLettiPrimaModifica + '/' + volumiTotaliNuovi, volumiLettiEsistenti + '/' + volumiTotaliNuovi);
                    }
                }
            } catch (logErr) {
                console.error("Errore durante la valutazione degli eventi di log per updateManga: " + logErr);
            }

            return getMangaDataSB_();
        }

        async function updateMangaVolumiLettiSB_(titolo, nuovoValore) {
            const titoloTrim = String(titolo).trim();
            const { data: righe, error: errSel } = await supabaseClient
                .from('manga').select('volumi,stato,volumi_letti').eq('titolo', titoloTrim);
            if (errSel) throw errSel;
            if (!righe || righe.length === 0) return false;

            const volumiTotali = righe[0].volumi || 0;
            const statoOpera = righe[0].stato || 'In corso';
            const volumiLettiPrecedenti = righe[0].volumi_letti || 0;

            let volumiLetti = parseInt(nuovoValore) || 0;
            if (volumiLetti < 0) volumiLetti = 0;
            if (volumiTotali > 0 && volumiLetti > volumiTotali) volumiLetti = volumiTotali;

            const coloreCalcolato = calcolaColoreLetturaManga_(volumiTotali, volumiLetti, statoOpera);

            const { error: errUpd } = await supabaseClient.from('manga').update({ volumi_letti: volumiLetti }).eq('titolo', titoloTrim);
            if (errUpd) throw errUpd;

            try {
                if (volumiLetti !== volumiLettiPrecedenti) {
                    await registraLogSB_(titolo, 'MANGA', 'AVANZAMENTO', volumiLettiPrecedenti, volumiLetti);
                    if (coloreCalcolato === 'verde' && volumiTotali > 0 && volumiLettiPrecedenti < volumiTotali) {
                        await registraLogSB_(titolo, 'MANGA', 'COMPLETAMENTO',
                            volumiLettiPrecedenti + '/' + volumiTotali, volumiLetti + '/' + volumiTotali);
                    }
                }
            } catch (logErr) {
                console.error("Errore durante la valutazione degli eventi di log per updateMangaVolumiLetti: " + logErr);
            }

            return { volumiLetti: volumiLetti, coloreLettura: coloreCalcolato };
        }

        async function deleteMangaSB_(titolo) {
            const { error } = await supabaseClient.from('manga').delete().eq('titolo', String(titolo).trim());
            if (error) throw error;
            return getMangaDataSB_();
        }

        async function toggleMangaPreferitoSB_(titolo, preferitoStato) {
            const { error } = await supabaseClient.from('manga').update({ preferito: !!preferitoStato }).eq('titolo', String(titolo).trim());
            if (error) throw error;
        }

        async function flagMangaAcquistatoSB_(titolo) {
            const titoloTrim = String(titolo).trim();
            const { data: righe, error: errSel } = await supabaseClient.from('manga').select('acquistato').eq('titolo', titoloTrim);
            if (errSel) throw errSel;
            if (!righe || righe.length === 0) return false;
            if (righe[0].acquistato === true) return { acquistato: 'SÃ¬' };

            const { error: errUpd } = await supabaseClient.from('manga').update({ acquistato: true }).eq('titolo', titoloTrim);
            if (errUpd) throw errUpd;

            try {
                await registraLogSB_(titolo, 'MANGA', 'ACQUISTO', 'No', 'SÃ¬');
            } catch (logErr) {
                console.error("Errore durante la registrazione del log per flagMangaAcquistato: " + logErr);
            }

            return { acquistato: 'SÃ¬' };
        }

        async function toggleMangaPrioritaSB_(titolo, prioritaStato) {
            const { error } = await supabaseClient.from('manga').update({ priorita: !!prioritaStato }).eq('titolo', String(titolo).trim());
            if (error) throw error;
        }
		
        function caricaDatiManga() {
            document.getElementById('loadingManga').style.display = 'block';
            document.getElementById('mangaTable').style.display = 'none';
            
                    getMangaDataSB_().then(function(data) {
                mangaList = data || [];
                document.getElementById('loadingManga').style.display = 'none';
                document.getElementById('mangaTable').style.display = 'table';
                renderListManga();
            }).catch(function(err) {
                console.error('Errore caricamento dati Manga da Supabase:', err);
                document.getElementById('loadingManga').style.display = 'none';
                alert('âŒ Errore nel caricamento dei manga. Controlla la console per i dettagli.');
            });
        }

        function renderListManga() {
            const tbody = document.getElementById('mangaTableBody');
            if (!tbody) return;
            tbody.innerHTML = '';
            
            let mangaLettiCount = 0;
            let mangaAcquistatiCount = 0; // <--- NUOVO: Inizializza il contatore delle opere acquistate
            let volumiLettiTotali = 0;
            let volumiAcquistatiTotali = 0;
            mangaList.forEach(item => {
                if (!item) return;
                const coloreLettura = item.coloreLettura || 'bianco';
                const volumi = parseInt(item.volumi) || 0;
                const volumiLetti = parseInt(item.volumiLetti) || 0;

                if (coloreLettura === 'verde') {
                    mangaLettiCount++;
                }
                // MODIFICATO: il contatore ora somma i volumi letti effettivi di TUTTE le opere
                // (non solo quelle con il flag Lettura verde attivo)
                volumiLettiTotali += volumiLetti;

                if (item.acquistato === 'SÃ¬') {
                    mangaAcquistatiCount++; // <--- NUOVO: Incrementa se l'opera ha acquistato su "SÃ¬"
                    volumiAcquistatiTotali += volumi;
                }
            });

            // MODIFICATO: Mostra il contatore nel formato Opere Lette / Opere Acquistate
            document.getElementById('statMangaLetti').innerText = `${mangaLettiCount} / ${mangaAcquistatiCount}`;
            document.getElementById('statVolumiLetti').innerText = `${volumiLettiTotali} / ${volumiAcquistatiTotali}`;
            
            const volumiMinVal = document.getElementById('numFilterMangaVolumiMin').value;
            const volumiMaxVal = document.getElementById('numFilterMangaVolumiMax').value;
            
            let filtered = mangaList.filter(item => {
                if (!item) return false;
                
                const titoloOriginale = item.titolo || '';
                // Cerca sia nel titolo che nelle note (gestendo eventuali note vuote)
                let notaTestoManga = "";
                if (item.note && typeof item.note === "string") {
                    notaTestoManga = item.note.toLowerCase();
                } else if (item.note) {
                    notaTestoManga = String(item.note).toLowerCase();
                }
                
                // Convertiamo in minuscolo anche il testo cercato dall'utente per renderlo case-insensitive
                const termineRicercaManga = (currentSearchManga || '').toLowerCase();
                const matchesSearch = (item.titolo || '').toLowerCase().includes(termineRicercaManga) || notaTestoManga.includes(termineRicercaManga);
                
                const tipologia = item.tipologia || 'Manga';
                let matchesType = currentFilterTipologiaManga === 'all' || tipologia === currentFilterTipologiaManga;
                
                const statoOriginale = item.stato || '';
                let matchesStato = currentFilterStatoManga === 'all' || statoOriginale.toLowerCase() === currentFilterStatoManga.toLowerCase();
                
                const acquistato = item.acquistato || 'No';
                let matchesBuy = currentFilterAcquistatoManga === 'all' || acquistato === currentFilterAcquistatoManga;
                
                const coloreLettura = item.coloreLettura || 'bianco';
                let matchesRead = currentFilterLetturaManga === 'all' || coloreLettura === currentFilterLetturaManga;
                
                const itemVolumi = parseInt(item.volumi) || 0;
                let matchesVolumiMin = true;
                if (volumiMinVal !== '') matchesVolumiMin = itemVolumi >= parseInt(volumiMinVal);
                
                let matchesVolumiMax = true;
                if (volumiMaxVal !== '') matchesVolumiMax = itemVolumi <= parseInt(volumiMaxVal);

                // COMBO DI FILTRAGGIO GENRE AVANZATO (Logica AND)
                let matchesGenres = true;
                if (selectedGenresManga.length > 0) {
                    const itemGenres = item.generi ? item.generi.split(',').map(g => g.trim()) : [];
                    matchesGenres = selectedGenresManga.every(g => itemGenres.includes(g));
                }
                
                // --- NUOVO FILTRO INTERRUTTORE PREFERITI ---
                let matchesPreferito = true;
                if (typeof currentFavFilterManga !== 'undefined' && currentFavFilterManga === 'yes') {
                    matchesPreferito = (item.preferito === true);
                }
                
                return matchesSearch && matchesType && matchesStato && matchesBuy && matchesRead && matchesVolumiMin && matchesVolumiMax && matchesGenres && matchesPreferito;
            });

            const countMangaEl = document.getElementById('countManga');
            if (countMangaEl) countMangaEl.textContent = filtered.length + ' di ' + mangaList.length + ' manga';

const sortVal = document.getElementById('sortSelManga').value;
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
    
    // Nuova opzione: Volumi crescenti (dal piÃ¹ piccolo al piÃ¹ grande)
    if (sortVal === 'volumes-asc') {
        const vA = parseInt(a.volumi) || 0;
        const vB = parseInt(b.volumi) || 0;
        return vA - vB; 
    }
    
    if (sortVal === 'volumes-desc') {
        const vA = parseInt(a.volumi) || 0;
        const vB = parseInt(b.volumi) || 0;
        return vB - vA;
    }
    return tA.localeCompare(tB); // Fallback: alfabetico
});
            filtered.forEach(item => {
                const tr = document.createElement('tr');
                const statoOriginale = item.stato || 'In corso';
                const statoClean = statoOriginale.toLowerCase();
                let badgeClass = 'status-in-arrivo';
                if (statoClean === 'in corso') badgeClass = 'status-in-corso';
                else if (statoClean === 'concluso') badgeClass = 'status-concluso';
                
                const safeTitle = (item.titolo || '').replace(/'/g, "\\'").replace(/"/g, '\\"');

                // Se non ancora acquistato, il badge diventa un pulsante cliccabile che permette
                // di flaggare l'acquisto direttamente dalla lista (senza aprire la modale).
                // Lo "spegnimento" del flag, invece, resta possibile solo dalla modale di modifica.
                let buyText = (item.acquistato === 'SÃ¬')
                    ? '<span style="color:var(--success); font-weight:700;">âœ… SÃ¬</span>'
                    : `<button class="action-icon-btn" style="font-size:12px; color:var(--text-muted); border:1px solid var(--border-color); border-radius:5px; padding:2px 7px; background:none; cursor:pointer;" title="Segna come acquistato" onclick="flagAcquistoManga('${safeTitle}', this)">âŒ No</button>`;
    
                const coloreLettura = item.coloreLettura || 'bianco';
                
                // Renderizzazione Generi sotto alle informazioni titolo del Manga
                let genresHTML = '';
                if (item.generi && item.generi.trim() !== '') {
                    genresHTML = `<div class="genre-tags-list" style="color: var(--accent);">ðŸŽ­ ${item.generi}</div>`;
                }

                // --- CONFIGURAZIONE INTERFACCIA STELLINA PREFERITI ---
                let starClass = item.preferito ? 'star-btn is-favorite' : 'star-btn';
                let starIcon = item.preferito ? 'â˜…' : 'â˜†';

                // NUOVO: Definizione dinamica di classe e titolo per il pin di prioritÃ  (ðŸ“Œ)
                let pinClass = item.priorita ? 'pin-btn is-priority' : 'pin-btn';
                let pinTitle = item.priorita ? 'Rimuovi dalle prioritÃ ' : 'Contrassegna come prioritario';

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
                            <button class="${starClass}" style="flex-shrink: 0;" onclick="toggleFavoriteManga('${safeTitle}', this)">${starIcon}</button>
                            <button class="${pinClass}" onclick="togglePinManga('${safeTitle}', this, event)" title="${pinTitle}">ðŸ“Œ</button>
                            
                            ${avatarHTML}
                            
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                <div style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                    <span>${item.titolo || 'Senza Titolo'}</span>
                                    <button class="action-icon-btn" style="font-size: 13px; padding: 0; background: none; border: none; cursor: pointer;" onclick="mostraSinossi('${safeTitle}', 'manga')" title="Visualizza Sinossi">â„¹ï¸</button>
                                    ${giardinoBtn_('manga', safeTitle)}
                                </div>
                                ${genresHTML}
                            </div>
                        </div>
                    </td>
                    <td><span class="type-badge">${item.tipologia || 'Manga'}</span></td>
                    <td style="text-align: center; font-weight: 700;">${parseInt(item.volumi) || 0}</td>
                    <td style="text-align: center; white-space: nowrap;">
                        <button class="action-icon-btn" style="font-size: 13px;" onclick="modificaVolumiLettiManga('${safeTitle}', -1)" title="Diminuisci volumi letti">âž–</button>
                        <span style="display: inline-block; min-width: 22px; font-weight: 700;">${parseInt(item.volumiLetti) || 0}</span>
                        <button class="action-icon-btn" style="font-size: 13px;" onclick="modificaVolumiLettiManga('${safeTitle}', 1)" title="Aumenta volumi letti">âž•</button>
                    </td>
                    <td><span class="status-badge ${badgeClass}">${item.stato || 'In corso'}</span></td>
                    <td style="text-align: center;">${buyText}</td>
                    <td style="color: var(--text-muted); font-size: 13px;">${item.note || '-'}</td>
                    <td style="text-align: center;"><span class="vision-box box-${coloreLettura}"></span></td>
                    <td style="text-align: center;">
                        <button class="action-icon-btn" onclick="apriModificaManga('${safeTitle}')">âœï¸</button>
                        <button class="action-icon-btn" onclick="suggManga_('${safeTitle}')" title="Potrebbero piacerti anche">ðŸ’¡</button>
                        <button class="action-icon-btn" onclick="rimuoviManga('${safeTitle}')">ðŸ—‘ï¸</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
		
// FUNZIONE DI SUPPORTO PER APRIRE IL LIGHTBOX (Puoi lasciarla subito sotto le funzioni di render)
function apriLightbox(url) {
    const overlay = document.getElementById('lightboxOverlay');
    const img = document.getElementById('lightboxImg');
    if (overlay && img) {
        img.src = url;
        overlay.style.display = 'flex';
    }
}
        document.getElementById('btnNuovoManga').onclick = function() {
            targetEditTitleManga = null;
            sinossiPendenteManga = null; // <--- NUOVO: azzera eventuale sinossi AniList in sospeso
            document.getElementById('modalTitleManga').innerText = "Aggiungi Nuovo Manga/LN";
            document.getElementById('mangaForm').reset();
            document.getElementById('inpImmagineManga').value = ''; // <--- NUOVO: Svuota campo immagine
            document.getElementById('inpGiaLettoManga').checked = false; // Flag "giÃ  letta per intero": sempre spento su una nuova opera
            // Uncheck tutti i checkbox generi manga
            document.querySelectorAll('input[name="manga_genres_cb"]').forEach(cb => cb.checked = false);
            document.getElementById('modalOverlayManga').classList.add('active');
        };

        window.apriModificaManga = function(titolo) {
            const item = mangaList.find(m => m.titolo === titolo);
            if (!item) return;
            
            targetEditTitleManga = titolo;
            sinossiPendenteManga = null; // <--- NUOVO: azzera eventuale sinossi AniList in sospeso
            document.getElementById('modalTitleManga').innerText = "Modifica Opera";
            document.getElementById('inpTitoloManga').value = item.titolo || '';
            document.getElementById('inpTipologiaManga').value = item.tipologia || 'Manga';
            document.getElementById('inpVolumiManga').value = item.volumi || 0;
            document.getElementById('inpStatoManga').value = item.stato || 'In corso';
            document.getElementById('inpAcquistatoManga').value = item.acquistato || 'No';
            document.getElementById('inpNoteManga').value = item.note || '';
            document.getElementById('inpLetturaManga').value = item.coloreLettura || 'bianco';
            document.getElementById('inpImmagineManga').value = item.immagine || ''; // <--- NUOVO: Carica l'immagine esistente
            // Flag "giÃ  letta per intero": nasce spuntato se l'opera Ã¨ di fatto giÃ  finita
            // (volumi letti = volumi totali), cosÃ¬ riflette la situazione reale.
            const volumiTotaliItem = parseInt(item.volumi) || 0;
            const volumiLettiItem = parseInt(item.volumiLetti) || 0;
            document.getElementById('inpGiaLettoManga').checked = (volumiTotaliItem > 0 && volumiLettiItem >= volumiTotaliItem);

            // Ripristina la selezione dei checkbox generi manga
            document.querySelectorAll('input[name="manga_genres_cb"]').forEach(cb => {
                cb.checked = false;
                if (item.generi) {
                    const splitGeneri = item.generi.split(',').map(g => g.trim());
                    if (splitGeneri.includes(cb.value)) cb.checked = true;
                }
            });

            document.getElementById('modalOverlayManga').classList.add('active');
        };

        document.getElementById('mangaForm').onsubmit = function(e) {
            e.preventDefault();

            // --- Flag "opera giÃ  letta per intero" (vedi checkbox sopra le Note) ---
            // Va valutato PRIMA di mettere il pulsante in "Salvataggio...", perchÃ© puÃ²
            // interrompere il salvataggio (volumi mancanti o conferma annullata).
            const giaLettoManga = document.getElementById('inpGiaLettoManga').checked;
            const volumiTotaliForm = parseInt(document.getElementById('inpVolumiManga').value) || 0;
            const titoloFormManga = document.getElementById('inpTitoloManga').value;

            if (giaLettoManga && volumiTotaliForm <= 0) {
                showToast('Per segnare l\'opera come giÃ  letta indica prima il Numero Volumi.', 'error');
                return;
            }

            // In modifica, se l'opera risulta giÃ  completata non c'Ã¨ nulla da cambiare:
            // niente richiesta di conferma a ogni salvataggio.
            let cambiaVolumiLettiManga = giaLettoManga;
            if (giaLettoManga && targetEditTitleManga) {
                const itemCorrenteManga = mangaList.find(m => m.titolo === targetEditTitleManga);
                if (itemCorrenteManga && (parseInt(itemCorrenteManga.volumiLetti) || 0) >= volumiTotaliForm) {
                    cambiaVolumiLettiManga = false;
                }
            }

            if (cambiaVolumiLettiManga) {
                const coloreRisultanteManga = calcolaColoreLetturaManga_(
                    volumiTotaliForm, volumiTotaliForm, document.getElementById('inpStatoManga').value);
                const messaggioConfermaManga =
                    'L\'opera "' + titoloFormManga + '" Ã¨ segnata come giÃ  letta per intero.\n\n' +
                    'Al salvataggio i volumi letti verranno impostati a ' + volumiTotaliForm + '/' + volumiTotaliForm +
                    (coloreRisultanteManga === 'verde'
                        ? ' e lo stato di lettura diventerÃ  "Letto completamente" (quadratino verde).'
                        : ' e lo stato di lettura resterÃ  "In lettura" (quadratino giallo), perchÃ© l\'opera Ã¨ ancora in corso di pubblicazione.') +
                    '\n\nConfermi?';
                if (!confirm(messaggioConfermaManga)) return;
            }

            document.getElementById('btnSalvaManga').innerText = "Salvataggio...";

            // Raccoglie i generi spuntati
            const selectedGenres = Array.from(document.querySelectorAll('input[name="manga_genres_cb"]:checked'))
                                        .map(cb => cb.value)
                                        .join(', ');

            const dati = {
                titolo: document.getElementById('inpTitoloManga').value,
                tipologia: document.getElementById('inpTipologiaManga').value,
                volumi: parseInt(document.getElementById('inpVolumiManga').value) || 0,
                stato: document.getElementById('inpStatoManga').value,
                acquistato: document.getElementById('inpAcquistatoManga').value,
                note: document.getElementById('inpNoteManga').value,
                coloreLettura: document.getElementById('inpLetturaManga').value,
                generi: selectedGenres,
                immagine: document.getElementById('inpImmagineManga').value, // <--- NUOVO: Salva l'URL dell'immagine nel foglio
                segnaComeLetto: cambiaVolumiLettiManga // Se true: volumi letti = volumi totali (vedi addMangaSB_/updateMangaSB_)
            };
            const isEditManga = !!targetEditTitleManga;
            const cb = function(data) {
                mangaList = data || [];
                // Se in questa sessione del modale Ã¨ stata scelta una sinossi da AniList,
                // la scriviamo ora sul foglio satellite (vedi commento analogo per l'anime).
                if (sinossiPendenteManga) {
                    impostaSinossiSB_(dati.titolo, 'manga', sinossiPendenteManga)
                        .catch(function(err) {
                            console.error('Errore salvataggio sinossi AniList: ' + err);
                            showToast('Opera salvata, ma la sinossi AniList non Ã¨ stata scritta. Riprova dal pulsante ðŸ”Ž.', 'error');
                        });
                    sinossiPendenteManga = null;
                }
                document.getElementById('btnSalvaManga').innerText = "Salva";
                chiudiModale('Manga');
                renderListManga();
                showToast(isEditManga ? 'Manga aggiornato con successo' : 'Manga aggiunto con successo', 'success');
            };
            const errorCb = function(err) {
                alert("âŒ Errore durante il salvataggio: " + err.message);
                document.getElementById('btnSalvaManga').innerText = "Salva";
            };
            
            if (targetEditTitleManga) {
                updateMangaSB_(targetEditTitleManga, dati).then(cb).catch(errorCb);
            } else {
                addMangaSB_(dati).then(cb).catch(errorCb);
            }
        };

        window.rimuoviManga = function(titolo) {
            if (confirm("Eliminare definitivamente '" + titolo + "'?")) {
                deleteMangaSB_(titolo).then(function(data) {
                    mangaList = data || [];
                    renderListManga();
                    showToast('Manga eliminato', 'success');
                }).catch(function(err) {
                    console.error('Errore eliminazione manga:', err);
                    alert("âŒ Errore durante l'eliminazione.");
                });
            }
        };
		
        window.chiudiModale = function(tipo) {
            document.getElementById('modalOverlay' + tipo).classList.remove('active');
        };

        // ==========================================
        //   ðŸ“— GRUPPO LIBRI (Supabase diretto, Richiesta 35)
        //   Schema semplificato come deciso: niente pagine/voto/acquistato,
        //   solo stati Da leggere / Letto / Abbandonato + saga Livello 1
        //   (saga_nome TEXT + saga_numero NUMERIC, sempre editabili a mano).
        //   Ricerca metadati via Hardcover (Edge Function `hardcover-proxy`,
        //   stesso schema di `tmdb-proxy`: il token resta secret server-side).
        // ==========================================
