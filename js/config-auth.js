// --- Configurazione connessione a Supabase --------------------------
        // Questi due valori NON sono segreti: sono pensati apposta per stare
        // in chiaro nel codice del frontend. La vera protezione dei dati la
        // fanno il login (Auth) + le regole RLS sul database, non la
        // segretezza di questi valori.
        const SUPABASE_URL = 'https://jcclzcyezqbhmxptlnoo.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_YsZNPRv7TVA39DoOi1P5cg_VJds36b5';

        // --- Ricerca libri via Hardcover (Richiesta 38) -------------------------
        // Il token Hardcover NON sta qui (loro lo vietano + repo pubblica):
        // vive come secret Supabase ed è la Edge Function `hardcover-proxy`
        // a usarlo — stesso schema di `tmdb-proxy` per TMDB.

        // Il tuo user_id (Supabase Auth): usato solo per decidere se mostrare
        // il pulsante "Apri Database" — nessuna implicazione di sicurezza,
        // la vera protezione dei dati resta la RLS, questo è solo estetico.
        const OWNER_USER_ID = 'c2fcedfa-a2ff-4112-a0e1-7ed9f2053e34';

        // --- Ritentativo automatico delle chiamate di rete -------------------
        // Su iPhone/iPad Safari chiude senza preavviso le connessioni che tiene
        // aperte verso Supabase (pagina rimasta in background, schermo spento,
        // passaggio Wi-Fi ↔ rete dati). La prima chiamata successiva muore sul
        // nascere con "TypeError: Load failed" — il messaggio Safari per "la
        // richiesta non è nemmeno partita" — mentre la seconda va a buon fine:
        // è il motivo per cui ricliccando subito "Salva" funzionava.
        // Qui la ripetiamo da soli, così l'errore non arriva più all'utente.
        const TENTATIVI_RETE = 3; // 1 tentativo + 2 ritentativi
        const ATTESE_RITENTATIVO_MS = [400, 1200];

        function attendi_(ms) {
            return new Promise(function(resolve) { setTimeout(resolve, ms); });
        }

        // Ritenta SOLO gli errori di rete veri e propri: `fetch` fallisce con un
        // TypeError quando la richiesta non arriva a destinazione. Se invece il
        // server ha risposto — anche con un errore — la risposta viene restituita
        // così com'è e la chiamata non viene ripetuta (potrebbe aver già scritto).
        async function fetchConRitentativi_(input, init) {
            let ultimoErrore;
            for (let tentativo = 0; tentativo < TENTATIVI_RETE; tentativo++) {
                try {
                    return await fetch(input, init);
                } catch (err) {
                    if (!(err instanceof TypeError)) throw err; // es. richiesta annullata: non si ritenta
                    ultimoErrore = err;
                    const attesa = ATTESE_RITENTATIVO_MS[tentativo];
                    if (attesa === undefined) break; // tentativi finiti
                    console.warn('Chiamata a Supabase fallita (' + err.message + '): ritento fra ' + attesa + ' ms');
                    await attendi_(attesa);
                }
            }
            throw ultimoErrore;
        }

        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { fetch: fetchConRitentativi_ }
        });

        const loginOverlayEl = document.getElementById('loginOverlay');
        const appRootEl = document.getElementById('appRoot');
        const loginFormEl = document.getElementById('loginForm');
        const loginErrorEl = document.getElementById('loginError');
        const loginSubmitBtnEl = document.getElementById('loginSubmitBtn');

        function mostraApp_(session) {
            loginOverlayEl.style.display = 'none';
            appRootEl.style.display = '';
            const emailEl = document.getElementById('loggedUserEmail');
            if (emailEl) {
                const email = (session && session.user && session.user.email) || '';
                emailEl.innerText = email ? ('👤 ' + email) : '';
            }
            const driveBtnEl = document.getElementById('driveShortcutBtn');
            if (driveBtnEl) {
                const isOwner = !!(session && session.user && session.user.id === OWNER_USER_ID);
                driveBtnEl.style.display = isOwner ? '' : 'none';
            }
            // Stesso criterio per il bottone giardino (solo proprietario).
            window.GIARDINO_IS_OWNER_ = !!(session && session.user && session.user.id === OWNER_USER_ID);
            // Ricarica il widget "In Corso" a ogni login: il caricamento
            // automatico all'avvio può essere partito senza sessione (la RLS
            // restituisce liste vuote senza errore) e non si riprenderebbe mai.
            // Stessa cosa per gli altri due widget della Home.
            caricaWidgetInCorso();
            caricaWidgetCinemaProssimi();
            caricaLogAttivita();
            aggiornaBadgePatchNotes();
        }
		
        function mostraLogin_() {
            appRootEl.style.display = 'none';
            loginOverlayEl.style.display = 'flex';
            const emailEl = document.getElementById('loggedUserEmail');
            if (emailEl) emailEl.innerText = '';
        }

        // Al caricamento della pagina: c'è già una sessione valida (es. non
        // hai mai fatto logout e il browser se la ricorda) o serve loggarsi?
        supabaseClient.auth.getSession().then(function(result) {
            const session = result.data.session;
            if (session) {
                mostraApp_(session);
            } else {
                mostraLogin_();
            }
        });

        // Se la sessione scade o l'utente fa logout da un'altra scheda,
        // reagiamo comunque mostrando il login.
        supabaseClient.auth.onAuthStateChange(function(event, session) {
            if (event === 'SIGNED_OUT') {
                mostraLogin_();
            }
        });

        loginFormEl.addEventListener('submit', function(e) {
            e.preventDefault();
            loginErrorEl.textContent = '';
            loginSubmitBtnEl.disabled = true;
            loginSubmitBtnEl.textContent = 'Accesso in corso...';

            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            supabaseClient.auth.signInWithPassword({ email: email, password: password })
                .then(function(result) {
                    loginSubmitBtnEl.disabled = false;
                    loginSubmitBtnEl.textContent = 'Accedi';
                    if (result.error) {
                        loginErrorEl.textContent = '❌ Email o password non corrette.';
                        return;
                    }
                    mostraApp_(result.data.session);
                });
        });

        function handleLogout() {
            supabaseClient.auth.signOut();
        }