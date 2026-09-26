// js/guida.js — Guida "Come funziona" dentro l'app Poker Range
// Modulo autonomo: crea da solo pulsante, pannello e stili. Non tocca gli altri file.
// Si include in index.html con: <script type="module" src="js/guida.js"></script>
//
// - Schermate di accesso/registrazione: pillola "Come funziona?" in basso al centro
// - Dentro l'app: pulsante "?" in basso a destra
// - Computer: pannello laterale a destra (l'app resta usabile a sinistra)
// - Telefono: pannello a tutto schermo
// - Da qualsiasi punto dell'app: window.apriGuida('icm') oppure un elemento con data-guida="icm"

const LANDING = 'https://mindsetdisciplinelab.com/';

// ============ TESTI (modificabili qui) ============
const SEZIONI = [
  {
    id: 'inizio',
    tab: 'Primi passi',
    titolo: 'Primi passi',
    html: `
      <ol class="gd-passi">
        <li><b>Registrati</b> con email, password e un cellulare italiano. Ti arriva un codice via SMS per confermare il numero.</li>
        <li><b>Parte la prova gratuita</b>, con tutti gli strumenti inclusi.</li>
        <li><b>Apri i range</b>: scegli lo scenario, la posizione e lo stack effettivo. La matrice ti mostra cosa fare con ogni mano.</li>
        <li><b>Usa i calcolatori</b> quando ti serve un conto preciso su bounty (PKO, Mystery) o sul tavolo finale (ICM).</li>
      </ol>
      <p class="gd-nota">Puoi tenere questa guida aperta mentre usi l'app: sul computer resta di lato, sul telefono la chiudi e la riapri dal pulsante <b>?</b></p>`
  },
  {
    id: 'range',
    tab: 'Range',
    titolo: 'Range preflop',
    pagina: 'poker-range-preflop.html',
    html: `
      <p>Scegli lo scenario, la posizione di Hero (e di chi ha agito prima, quando serve) e lo stack effettivo in big blind. La matrice 13×13 mostra l'azione per ogni mano: i colori corrispondono alle azioni indicate accanto alla matrice.</p>
      <dl class="gd-scenari">
        <dt>RFI</dt>
        <dd>Sei il primo a entrare nel piatto: il range di apertura per ogni posizione, da EP a SB.</dd>
        <dt>Vs RFI</dt>
        <dd>Qualcuno ha aperto prima di te: fold, flat o 3bet. Scegli chi apre e la posizione di Hero si adatta.</dd>
        <dt>Vs 3Bet</dt>
        <dd>Hai aperto e ricevi una 3bet. <b>NAI</b>: la 3bet non ti mette all-in. <b>AI</b>: sei all-in.</dd>
        <dt>BB vs SB Limp</dt>
        <dd>SB limpa e tu, da BB, decidi come rispondere. Da qui passi a Vs Limp 3Bet NAI o AI.</dd>
        <dt>SB Limp vs BB ISO</dt>
        <dd>Limpi da SB e BB rilancia per isolarti. Da qui passi a Vs BB 4Bet NAI o AI.</dd>
      </dl>
      <p class="gd-nota">Gli scenari sono collegati: con i pulsanti "Passa a…" segui la mano da un'azione alla successiva. Gli stack non disponibili per uno scenario sono disattivati.</p>`
  },
  {
    id: 'pko',
    tab: 'PKO',
    titolo: 'Calcolatore PKO',
    pagina: 'pko-calculator.html',
    html: `
      <p>Ti dice se un call è profittevole quando puoi eliminare un avversario e prenderne la taglia, nei tornei progressive knockout.</p>
      <ol class="gd-passi">
        <li>Inserisci piatto, puntata da chiamare e il tuo stack.</li>
        <li>Aggiungi fino a 3 avversari, ognuno con stack e bounty.</li>
        <li>Il calcolatore converte il bounty in chip e ti dà l'equity minima per chiamare.</li>
      </ol>
      <p class="gd-nota">Un avversario conta come "coperto" solo se ha uno stack uguale o più piccolo del tuo. Se ha più chip di te, eliminarlo non è garantito e il suo bounty non abbassa l'equity richiesta.</p>`
  },
  {
    id: 'mystery',
    tab: 'Mystery',
    titolo: 'Calcolatore Mystery Bounty',
    pagina: 'mystery-calculator.html',
    html: `
      <p>Per i tornei Mystery Bounty, dove la taglia si scopre solo dopo l'eliminazione. Il calcolatore usa il valore medio dei bounty per stimare quanto vale eliminare un avversario e quanta equity ti serve per chiamare.</p>
      <ol class="gd-passi">
        <li>Inserisci piatto, puntata da chiamare, il tuo stack e il valore medio dei bounty.</li>
        <li>Aggiungi gli avversari coinvolti con il loro stack.</li>
        <li>Leggi l'equity minima per chiamare.</li>
      </ol>
      <p class="gd-nota">La sezione "ICM / Risk Premium" è facoltativa e parte chiusa: aprila se vuoi tenere conto anche della pressione del montepremi.</p>`
  },
  {
    id: 'icm',
    tab: 'ICM',
    titolo: 'Calcolatore ICM',
    pagina: 'icm-calculator.html',
    html: `
      <p>Trasforma gli stack in valore in denaro, in base ai premi ancora da pagare. Serve al tavolo finale e vicino alla bolla.</p>
      <ol class="gd-passi">
        <li>Inserisci i giocatori con i loro stack e la struttura dei premi.</li>
        <li>Leggi l'equity di ciascuno: quanto vale oggi il suo stack in denaro.</li>
        <li>Simula un all-in: vedi quanto guadagni se vinci, quanto perdi se perdi e l'equity minima per chiamare.</li>
      </ol>
      <p class="gd-nota">Ti propongono un accordo? Confronta ICM Deal, Chip Chop ed Equal Chop prima di accettare.</p>`
  },
  {
    id: 'account',
    tab: 'Account',
    titolo: 'Account e assistenza',
    html: `
      <dl class="gd-scenari">
        <dt>Abbonamento</dt>
        <dd>9,99 € al mese, un solo abbonamento per tutti gli strumenti. Con un codice partner paghi 8,99 €.</dd>
        <dt>Accesso sospeso per 10 minuti</dt>
        <dd>Succede se apri molti range in pochissimo tempo. Dopo 10 minuti l'accesso torna da solo.</dd>
        <dt>Password dimenticata</dt>
        <dd>Clicca "Hai dimenticato la password?" sotto il pulsante Accedi: ti arriva un'email per sceglierne una nuova.</dd>
        <dt>Assistenza</dt>
        <dd>Scrivi a <a href="mailto:assistenza@pokerrange.online">assistenza@pokerrange.online</a></dd>
      </dl>`
  }
];

const T = {
  pulsanteApp: 'Guida',
  pulsanteAccesso: 'Come funziona?',
  titoloPannello: 'Come funziona',
  chiudi: 'Chiudi la guida',
  approfondisci: 'Esempi e schermate sul sito',
  piede: 'Tutti gli strumenti spiegati con esempi su',
};
// ==================================================

const STILE = `
.gd-btn{position:fixed;z-index:10000;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));
  width:52px;height:52px;border-radius:50%;border:1px solid rgba(80,200,255,.55);background:rgba(11,13,18,.88);
  color:rgb(140,220,255);font:600 25px/1 Georgia,serif;cursor:pointer;display:none;align-items:center;justify-content:center;
  box-shadow:0 0 0 1px rgba(0,0,0,.4),0 0 14px rgba(80,200,255,.25);backdrop-filter:blur(4px)}
.gd-btn:hover{border-color:rgb(80,200,255);box-shadow:0 0 18px rgba(80,200,255,.45)}
.gd-btn.gd-pill{width:auto;height:auto;padding:12px 26px;border-radius:999px;right:auto;left:50%;transform:translateX(-50%);
  font-size:16px;font-weight:500;line-height:1.2;font-family:inherit;letter-spacing:.01em;border-color:rgba(150,110,255,.6);color:#e6e2ff;
  box-shadow:0 0 14px rgba(150,110,255,.25)}
.gd-btn.gd-pill:hover{border-color:rgb(150,110,255);box-shadow:0 0 18px rgba(150,110,255,.45)}
.gd-btn.gd-visibile{display:inline-flex}
.gd-btn:focus-visible,.gd-panel :focus-visible{outline:2px solid rgb(80,200,255);outline-offset:2px}

.gd-velo{position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity .2s}
.gd-panel{position:fixed;z-index:10002;top:0;right:0;height:100%;width:min(420px,100%);display:flex;flex-direction:column;
  background:#0e1118;color:#e3e7ef;border-left:1px solid rgba(80,200,255,.22);box-shadow:-12px 0 40px rgba(0,0,0,.5);
  transform:translateX(100%);transition:transform .25s ease;font-size:15px;line-height:1.55;visibility:hidden}
.gd-aperta .gd-panel{transform:none;visibility:visible}
.gd-aperta .gd-velo{opacity:1;pointer-events:auto}
@media (min-width:1024px){.gd-velo{display:none}}  /* sul computer l'app resta cliccabile */

.gd-testa{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:max(18px,env(safe-area-inset-top)) 20px 12px}
.gd-testa h2{margin:0;font:400 24px/1.2 'DM Serif Display',Georgia,serif;color:#f2f4f8}
.gd-x{background:none;border:0;color:#9aa3b5;font-size:26px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:6px}
.gd-x:hover{color:#fff;background:rgba(255,255,255,.06)}

.gd-tabs{display:flex;flex-wrap:wrap;gap:6px;padding:0 20px 12px;border-bottom:1px solid rgba(255,255,255,.07)}
.gd-tab{flex:0 0 auto;background:transparent;border:1px solid rgba(255,255,255,.12);color:#b8c0cf;border-radius:999px;
  padding:6px 13px;font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
.gd-tab:hover{color:#fff;border-color:rgba(255,255,255,.25)}
.gd-tab[aria-selected="true"]{color:#0e1118;background:rgb(120,210,255);border-color:rgb(120,210,255);font-weight:600}

.gd-corpo{flex:1;overflow-y:auto;padding:18px 20px 8px;overscroll-behavior:contain}
.gd-corpo h3{margin:0 0 10px;font:400 21px/1.25 'DM Serif Display',Georgia,serif;color:#f2f4f8}
.gd-corpo p{margin:0 0 14px}
.gd-corpo b{color:#fff;font-weight:600}
.gd-corpo a{color:rgb(120,210,255)}
.gd-passi{margin:0 0 16px;padding-left:1.3em}
.gd-passi li{margin-bottom:9px;padding-left:4px}
.gd-passi li::marker{color:rgb(150,110,255);font-weight:600}
.gd-scenari{margin:0 0 16px}
.gd-scenari dt{color:rgb(140,220,255);font-weight:600;margin-top:12px}
.gd-scenari dt:first-child{margin-top:0}
.gd-scenari dd{margin:2px 0 0}
.gd-nota{border-left:2px solid rgba(150,110,255,.6);padding:2px 0 2px 12px;color:#c3c9d6;font-size:14px}
.gd-link{display:inline-block;margin:4px 0 14px;font-size:14px}

.gd-piede{padding:12px 20px max(14px,env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.07);
  font-size:13px;color:#8c93a3}
.gd-piede a{color:#b8c0cf}

@media (max-width:1023px){
  .gd-panel{width:100%;border-left:0}
  body.gd-blocca{overflow:hidden}
}
@media (prefers-reduced-motion:reduce){.gd-panel,.gd-velo{transition:none}}
`;

let radice, pannello, pulsante, corpo, tabs, ultimoFocus = null;
let sezioneCorrente = leggiSezione() || 'inizio';

function leggiSezione() { try { return sessionStorage.getItem('guida-sezione'); } catch { return null; } }
function salvaSezione(id) { try { sessionStorage.setItem('guida-sezione', id); } catch {} }

function crea() {
  const st = document.createElement('style');
  st.textContent = STILE;
  document.head.appendChild(st);

  pulsante = document.createElement('button');
  pulsante.type = 'button';
  pulsante.className = 'gd-btn';
  pulsante.setAttribute('aria-haspopup', 'dialog');
  pulsante.addEventListener('click', () => apri());
  document.body.appendChild(pulsante);

  radice = document.createElement('div');
  radice.className = 'gd-root';
  radice.innerHTML = `
    <div class="gd-velo"></div>
    <aside class="gd-panel" role="dialog" aria-modal="false" aria-labelledby="gd-titolo">
      <div class="gd-testa">
        <h2 id="gd-titolo">${T.titoloPannello}</h2>
        <button type="button" class="gd-x" aria-label="${T.chiudi}">×</button>
      </div>
      <div class="gd-tabs" role="tablist">
        ${SEZIONI.map(s => `<button type="button" class="gd-tab" role="tab" data-id="${s.id}" aria-selected="false">${s.tab}</button>`).join('')}
      </div>
      <div class="gd-corpo" role="tabpanel" tabindex="-1"></div>
      <div class="gd-piede">${T.piede} <a href="${LANDING}" target="_blank" rel="noopener">mindsetdisciplinelab.com</a></div>
    </aside>`;
  document.body.appendChild(radice);

  pannello = radice.querySelector('.gd-panel');
  corpo = radice.querySelector('.gd-corpo');
  tabs = radice.querySelector('.gd-tabs');

  radice.querySelector('.gd-x').addEventListener('click', chiudi);
  radice.querySelector('.gd-velo').addEventListener('click', chiudi);
  tabs.addEventListener('click', e => {
    const b = e.target.closest('.gd-tab');
    if (b) mostra(b.dataset.id);
  });
  tabs.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = SEZIONI.findIndex(s => s.id === sezioneCorrente);
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + SEZIONI.length) % SEZIONI.length;
    mostra(SEZIONI[n].id);
    tabs.querySelector(`[data-id="${SEZIONI[n].id}"]`).focus();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && aperta()) chiudi();
  });
  // Qualsiasi elemento con data-guida="icm" (ecc.) apre la guida su quella sezione
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-guida]');
    if (el && !radice.contains(el)) { e.preventDefault(); apri(el.dataset.guida); }
  });

  mostra(sezioneCorrente);
}

function mostra(id) {
  const s = SEZIONI.find(x => x.id === id) || SEZIONI[0];
  sezioneCorrente = s.id;
  salvaSezione(s.id);
  tabs.querySelectorAll('.gd-tab').forEach(b => {
    const on = b.dataset.id === s.id;
    b.setAttribute('aria-selected', on);
    b.tabIndex = on ? 0 : -1;
  });
  const link = s.pagina
    ? `<a class="gd-link" href="${LANDING}${s.pagina}" target="_blank" rel="noopener">${T.approfondisci}</a>` : '';
  corpo.innerHTML = `<h3>${s.titolo}</h3>${s.html}${link}`;
  corpo.scrollTop = 0;
}

function aperta() { return radice.classList.contains('gd-aperta'); }

function apri(id) {
  if (id) mostra(id);
  ultimoFocus = document.activeElement;
  radice.classList.add('gd-aperta');
  if (window.innerWidth < 1024) document.body.classList.add('gd-blocca');
  pulsante.classList.remove('gd-visibile');
  radice.querySelector('.gd-x').focus();
}

function chiudi() {
  radice.classList.remove('gd-aperta');
  document.body.classList.remove('gd-blocca');
  aggiornaPulsante();
  if (ultimoFocus && document.contains(ultimoFocus)) ultimoFocus.focus();
}

// ---- Pulsante: pillola nelle schermate di accesso, "?" dentro l'app ----
function visibile(id) {
  const el = document.getElementById(id);
  return !!el && getComputedStyle(el).display !== 'none';
}

function aggiornaPulsante() {
  if (!pulsante || aperta()) return;
  const accesso = visibile('loginScreen') || visibile('registrazioneScreen');
  pulsante.classList.toggle('gd-pill', accesso);
  pulsante.textContent = accesso ? T.pulsanteAccesso : '?';
  pulsante.setAttribute('aria-label', accesso ? T.pulsanteAccesso : T.pulsanteApp);
  pulsante.title = accesso ? '' : T.pulsanteApp;
  pulsante.classList.add('gd-visibile');
  posiziona();
}

// ---- Pillola subito sotto il riquadro di accesso/registrazione ----
function schermataAccesso() {
  return ['registrazioneScreen', 'loginScreen'].map(id => document.getElementById(id))
    .find(el => el && getComputedStyle(el).display !== 'none') || null;
}

// Il riquadro è il contenitore più esterno dei campi che resta largo al massimo 640 px
function trovaRiquadro(schermata) {
  const campi = [...schermata.querySelectorAll('input, button')].filter(el => el.offsetParent !== null);
  if (!campi.length) return null;
  let el = campi[0], riquadro = null;
  while (el && el !== schermata) {
    const w = el.getBoundingClientRect().width;
    if (w > 640) break;
    if (w > 0) riquadro = el;
    el = el.parentElement;
  }
  return riquadro;
}

let rafPos = 0, riquadroOsservato = null;
const roRiquadro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => posiziona()) : null;

function posiziona() {
  cancelAnimationFrame(rafPos);
  rafPos = requestAnimationFrame(() => {
    if (!pulsante) return;
    const reset = () => { pulsante.style.top = ''; pulsante.style.bottom = ''; pulsante.style.left = ''; };
    if (!pulsante.classList.contains('gd-pill')) return reset();
    const schermata = schermataAccesso();
    const riquadro = schermata && trovaRiquadro(schermata);
    if (!riquadro) return reset();
    if (roRiquadro && riquadroOsservato !== riquadro) {
      if (riquadroOsservato) roRiquadro.unobserve(riquadroOsservato);
      roRiquadro.observe(riquadro);
      riquadroOsservato = riquadro;
    }
    const r = riquadro.getBoundingClientRect();
    const top = r.bottom + 18;
    if (top + 56 > window.innerHeight) return reset(); // non c'è spazio sotto: resta in basso
    pulsante.style.top = top + 'px';
    pulsante.style.bottom = 'auto';
    pulsante.style.left = (r.left + r.width / 2) + 'px';
  });
}

let tentativi = 0;
function osserva() {
  const obs = new MutationObserver(aggiornaPulsante);
  let collegati = 0;
  ['loginScreen', 'registrazioneScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      obs.observe(el, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
      new MutationObserver(posiziona).observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
      collegati++;
    }
  });
  if (collegati < 2 && ++tentativi < 20) { obs.disconnect(); setTimeout(osserva, 500); } // le schermate non ci sono ancora: riprova
  aggiornaPulsante();
}

function avvia() {
  crea();
  osserva();
  window.addEventListener('resize', posiziona);
  window.addEventListener('scroll', posiziona, true);
  window.apriGuida = apri;
  window.chiudiGuida = chiudi;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
else avvia();
