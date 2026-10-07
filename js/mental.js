/**
 * POKER RANGE VIEWER — Mental Game Check
 * © 2026 pokerrange.online - Danilo Rucchetta
 * Domande, calcolo e consigli arrivano dal backend (/api/mentale/...).
 * Nel browser restano solo tavoli, regole personali e tetto di oggi (localStorage):
 * nulla viene salvato sul server.
 */
(function() {
'use strict';

const API_URL    = 'https://poker-range-api-production.up.railway.app';
const KEY_TAVOLI = 'mgc_tavoli_max';
const KEY_REGOLE = 'mgc_regole';      // regole personali della scheda In sessione
const KEY_TETTO  = 'mgc_tetto_oggi';  // limite di tavoli e % dell'ultima Pre-sessione, con la data
const KEY_DIARIO = 'mgc_diario';      // voci del diario (sessioni), solo in questo browser

const risposte = {};
let domandeIds = [];
const rispostePausa = {};
let controlloFatto = false; // controllo in pausa eseguito in questa apertura del tool
let domandePausaIds = [];

function el(id) { return document.getElementById(id); }

function getToken() {
  return sessionStorage.getItem('poker_token') || sessionStorage.getItem('access_token') || '';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function chiamaApi(endpoint, corpo) {
  const token = getToken();
  if (!token) throw new Error('Sessione scaduta. Effettua nuovamente il login.');
  let resp, json;
  try {
    resp = await fetch(API_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token, ...corpo }),
    });
    json = await resp.json();
  } catch (e) {
    throw new Error('Errore di connessione. Verifica la tua connessione e riprova.');
  }
  if (!resp.ok) throw new Error((json && json.error) || 'Errore server.');
  return json;
}

// ===== SCHEDE: linguette su desktop, menu a tendina sotto i 700 px =====
function mostraScheda(nome) {
  document.querySelectorAll('.mgc-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === nome));
  document.querySelectorAll('.mgc-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + nome));
  const sel = el('mgcSelect');
  if (sel && sel.value !== nome) sel.value = nome;
}

function setupSchede() {
  document.querySelectorAll('.mgc-tab').forEach(t => t.addEventListener('click', () => mostraScheda(t.dataset.panel)));
  el('mgcSelect')?.addEventListener('change', e => mostraScheda(e.target.value));
}

// ===== PRE-SESSIONE =====
// Disegna una serie di domande da 1 a 5 dentro "contenitore"; le risposte finiscono in "store"
function disegnaScala(contenitore, domande, store, prefisso) {
  const html = domande.map(d => {
    const e = d.etichette || {};
    const tutteLeEtichette = [1, 2, 3, 4, 5].every(v => e[v]);
    const bottoni = [1, 2, 3, 4, 5].map(v =>
      `<button type="button" data-q="${esc(d.id)}" data-v="${v}" aria-label="${v}${e[v] ? ' — ' + esc(e[v]) : ''}">${v}${tutteLeEtichette ? `<small>${esc(e[v])}</small>` : ''}</button>`
    ).join('');
    const estremi = tutteLeEtichette ? '' : `<div class="mgc-ends"><span>1 = ${esc(e[1] || '')}</span><span>5 = ${esc(e[5] || '')}</span></div>`;
    return `<div class="mgc-q" id="${prefisso}${esc(d.id)}"><div class="mgc-q-text">${esc(d.testo)}</div><div class="mgc-scale">${bottoni}</div>${estremi}</div>`;
  }).join('');
  contenitore.innerHTML = html;

  contenitore.querySelectorAll('.mgc-scale button').forEach(b => b.addEventListener('click', () => {
    const q = b.dataset.q;
    store[q] = Number(b.dataset.v);
    b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
    el(prefisso + q)?.classList.remove('missing');
  }));
}

function disegnaDomande(dati) {
  domandeIds = dati.domande.map(d => d.id);
  disegnaScala(el('preDomande'), dati.domande, risposte, 'q-');
  if (dati.campoTavoli?.testo) el('tavoliLabel').textContent = dati.campoTavoli.testo;
  if (dati.disclaimer) el('rDisclaimer').textContent = dati.disclaimer;
  if (dati.inSessione) disegnaInSessione(dati.inSessione);
  if (dati.postSessione) disegnaPost(dati.postSessione);
}

async function caricaDomande() {
  try {
    disegnaDomande(await chiamaApi('/api/mentale/domande', {}));
  } catch (e) {
    el('preDomande').innerHTML = `<p class="mgc-soon">${esc(e.message)}</p>`;
    el('pausaDomande').innerHTML = `<p class="mgc-soon">${esc(e.message)}</p>`;
    el('postContenuto').innerHTML = `<p class="mgc-soon">${esc(e.message)}</p>`;
  }
}

function caricaTavoli() {
  try {
    const v = localStorage.getItem(KEY_TAVOLI);
    if (v) el('tavoliMax').value = v;
  } catch (e) { /* storage non disponibile: il campo resta vuoto */ }
}

function salvaTavoli(n) {
  try { localStorage.setItem(KEY_TAVOLI, String(n)); } catch (e) { /* non bloccante */ }
}

function mostraRisultato(r) {
  el('rPerc').textContent   = r.percentuale + '%';
  el('rTavoli').textContent = r.messaggioTavoli;
  salvaTettoOggi(r.messaggioTavoli, r.percentuale);
  // Niente tavoli: riquadro arancione invece che verde
  el('boxTavoli').classList.toggle('good', r.tetto > 0);
  el('boxTavoli').classList.toggle('stop', r.tetto === 0);

  const camp = el('rCampanello');
  camp.style.display = r.messaggioCampanello ? '' : 'none';
  camp.textContent = r.messaggioCampanello ? '⚠️ ' + r.messaggioCampanello : '';

  const pronto = el('rPronto');
  pronto.style.display = r.messaggioPronto ? '' : 'none';
  pronto.textContent = r.messaggioPronto || '';

  const scheda = c => `
    <details class="mgc-advice"${c.aperto ? ' open' : ''}>
      <summary>${esc(c.titolo)}<span class="mgc-score">risposta ${c.punteggio}</span></summary>
      <dl>
        <div><dt>Perché conta</dt><dd>${esc(c.perche)}</dd></div>
        <div><dt>Prima di iniziare</dt><dd>${esc(c.prima)}</dd></div>
        <div><dt>Durante la sessione</dt><dd>${esc(c.durante)}</dd></div>
      </dl>
    </details>`;
  const aperti = r.consigli.filter(c => c.aperto);
  const altri  = r.consigli.filter(c => !c.aperto);
  el('rConsigli').innerHTML =
    aperti.map(scheda).join('') +
    (altri.length ? `<p class="mgc-more">Altri consigli</p>` + altri.map(scheda).join('') : '');

  if (r.disclaimer) el('rDisclaimer').textContent = r.disclaimer;
  el('preRisultati').classList.add('show');
  el('preRisultati').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function calcolaPre() {
  const mancanti = domandeIds.filter(id => !risposte[id]);
  if (!domandeIds.length) { alert('Le domande non sono ancora state caricate.'); return; }
  if (mancanti.length) {
    mancanti.forEach(id => el('q-' + id)?.classList.add('missing'));
    el('q-' + mancanti[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alert('Rispondi a tutte le domande.');
    return;
  }
  const tavoliMax = parseInt(el('tavoliMax').value, 10);
  if (!Number.isInteger(tavoliMax) || tavoliMax < 1 || tavoliMax > 30) {
    alert('Inserisci un numero di tavoli da 1 a 30.');
    el('tavoliMax').focus();
    return;
  }
  salvaTavoli(tavoliMax);

  try {
    mostraRisultato(await chiamaApi('/api/mentale/pre', { risposte, tavoliMax }));
  } catch (e) {
    alert(e.message);
  }
}


// ===== IN SESSIONE =====
function oggi() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function leggiJson(chiave) {
  try { return JSON.parse(localStorage.getItem(chiave) || 'null'); } catch (e) { return null; }
}
function scriviJson(chiave, valore) {
  try { localStorage.setItem(chiave, JSON.stringify(valore)); } catch (e) { /* non bloccante */ }
}

function salvaTettoOggi(messaggio, percentuale) {
  scriviJson(KEY_TETTO, { data: oggi(), messaggio, percentuale });
  mostraTettoOggi();
}

function mostraTettoOggi() {
  const t = leggiJson(KEY_TETTO);
  if (t && t.data === oggi() && t.messaggio) el('regTavoli').textContent = t.messaggio;
}

// Regole personali: valori iniziali dal backend, poi quelli scritti dal giocatore (solo nel suo browser)
function setupRegole(valoriIniziali) {
  const salvate = leggiJson(KEY_REGOLE) || {};
  const campi = { orario: 'regOrario', spesa: 'regSpesa', dopoElim: 'regDopoElim', frase: 'regFrase' };
  const iniziali = { orario: '', spesa: '', dopoElim: valoriIniziali.dopoEliminazione || '', frase: valoriIniziali.frase || '' };
  for (const [chiave, id] of Object.entries(campi)) {
    const campo = el(id);
    if (!campo) continue;
    campo.value = salvate[chiave] !== undefined ? salvate[chiave] : iniziali[chiave];
    campo.addEventListener('input', () => {
      const attuali = leggiJson(KEY_REGOLE) || {};
      attuali[chiave] = campo.value;
      scriviJson(KEY_REGOLE, attuali);
    });
  }
  if (valoriIniziali.notaSpesa) el('regNotaSpesa').textContent = valoriIniziali.notaSpesa;
}

function disegnaInSessione(dati) {
  domandePausaIds = dati.domande.map(d => d.id);
  disegnaScala(el('pausaDomande'), dati.domande, rispostePausa, 'p-');
  setupRegole(dati.regole || {});
  el('ftBox').innerHTML = (dati.tavoloFinale || []).map(c =>
    `<div class="mgc-card"><h3>${esc(c.titolo)}</h3><p>${esc(c.testo)}</p></div>`).join('');
}

const PALLINO = { verde: '🟢', giallo: '🟡', rosso: '🔴' };

async function controllaPausa() {
  if (!domandePausaIds.length) { alert('Le domande non sono ancora state caricate.'); return; }
  const mancanti = domandePausaIds.filter(id => !rispostePausa[id]);
  if (mancanti.length) {
    mancanti.forEach(id => el('p-' + id)?.classList.add('missing'));
    alert('Rispondi a tutte le domande.');
    return;
  }
  try {
    const r = await chiamaApi('/api/mentale/pausa', { risposte: rispostePausa });
    el('pausaRisultato').innerHTML =
      `<div class="mgc-sem ${esc(r.colore)}">${PALLINO[r.colore] || ''} ${esc(r.messaggio)}</div>` +
      r.consigli.map(c => `<div class="mgc-card"><h3>${esc(c.titolo)}</h3><p>${esc(c.testo)}</p></div>`).join('');
    el('pausaRisultato').scrollIntoView({ behavior: 'smooth', block: 'start' });
    controlloFatto = true;
    el('ftPromemoria').hidden = true;
  } catch (e) {
    alert(e.message);
  }
}

function setupTavoloFinale() {
  const btn = el('ftBtn');
  btn?.addEventListener('click', () => {
    const box = el('ftWrap');
    const apri = box.hidden;
    box.hidden = !apri;
    btn.setAttribute('aria-expanded', String(apri));
    // Promemoria solo se il controllo in pausa non è ancora stato fatto
    if (apri) el('ftPromemoria').hidden = controlloFatto;
  });
}


// ===== POST-SESSIONE =====
let POST = null;
let post = {};

function nuovoPost() { post = { regole: {}, qualita: null, risultato: null, trigger: [] }; }

function disegnaPost(d) {
  POST = d;
  nuovoPost();
  const sezione = (titolo, guida) =>
    `<p class="section-label mgc-block-title">${esc(titolo)}</p>${guida ? `<p class="mgc-hint">${esc(guida)}</p>` : ''}`;

  el('postContenuto').innerHTML = `
    ${sezione('Rispetto delle regole', d.guidaRegole)}
    <div class="mgc-rules" style="gap:0;margin-bottom:6px;">
      ${d.regole.map(r => `
        <div class="mgc-yn" id="pr-${esc(r.id)}">
          <span>${esc(r.testo)}</span>
          <div class="mgc-choice" data-regola="${esc(r.id)}">
            <button type="button" data-v="si">Sì</button><button type="button" data-v="no" class="no-btn">No</button>
          </div>
        </div>`).join('')}
    </div>
    <div class="mgc-alert" id="postRegolaSuperata" hidden style="margin-bottom:18px;">${esc(d.regolaSuperata)}</div>
    <div style="height:14px;"></div>

    ${sezione('Decisioni e risultato')}
    <div id="postQualita"></div>
    <div class="mgc-q" id="pq-risultato">
      <div class="mgc-q-text">${esc(d.risultato.testo)}</div>
      <div class="mgc-choice wide" id="postRisultato">
        ${d.risultato.opzioni.map(o => `<button type="button" data-v="${esc(o.id)}">${esc(o.testo)}</button>`).join('')}
      </div>
    </div>
    <div id="postLettura"></div>
    <div style="height:24px;"></div>

    ${sezione('Il trigger della sessione')}
    <div class="mgc-q">
      <div class="mgc-q-text">${esc(d.triggerTitolo)}</div>
      <div class="mgc-chips" id="postTrigger">
        ${d.trigger.map(t => `<button type="button" data-t="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </div>
    <div style="height:14px;"></div>

    ${sezione('Riflessione')}
    ${d.riflessione.map(r => `
      <div class="mgc-field">
        <label for="pn-${esc(r.id)}">${esc(r.testo)}</label>
        <textarea id="pn-${esc(r.id)}" rows="2"></textarea>
      </div>`).join('')}

    <button class="calc-btn" id="postSalva">${esc(d.salva)}</button>
    <div class="mgc-ok" id="postSalvato" hidden>${esc(d.salvato)}</div>
    <p class="mgc-hint" style="margin-top:12px;">${esc(d.chiusura)}</p>`;

  // Regole Sì/No
  el('postContenuto').querySelectorAll('.mgc-choice[data-regola]').forEach(gr => {
    gr.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      post.regole[gr.dataset.regola] = b.dataset.v === 'si';
      gr.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
      b.classList.toggle('no', b.dataset.v === 'no');
      el('pr-' + gr.dataset.regola)?.classList.remove('missing');
      el('postRegolaSuperata').hidden = !Object.values(post.regole).includes(false);
    }));
  });

  // Qualità del gioco (scala 1-5) e risultato
  const qualita = {};
  disegnaScala(el('postQualita'), [d.qualita], qualita, 'pq-');
  el('postQualita').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    post.qualita = qualita.qualita; aggiornaLettura();
  }));
  el('postRisultato').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    post.risultato = b.dataset.v;
    el('postRisultato').querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
    el('pq-risultato').classList.remove('missing');
    aggiornaLettura();
  }));

  // Trigger: più scelte; "Nessuno" esclude gli altri
  const nessuno = d.trigger[d.trigger.length - 1];
  el('postTrigger').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.t;
    if (t === nessuno) post.trigger = post.trigger.includes(t) ? [] : [t];
    else {
      post.trigger = post.trigger.filter(x => x !== nessuno);
      post.trigger = post.trigger.includes(t) ? post.trigger.filter(x => x !== t) : [...post.trigger, t];
    }
    el('postTrigger').querySelectorAll('button').forEach(x => x.classList.toggle('sel', post.trigger.includes(x.dataset.t)));
  }));

  el('postSalva').addEventListener('click', salvaPost);
}

let letturaAttuale = null;
async function aggiornaLettura() {
  if (!post.qualita || !post.risultato) return;
  try {
    const r = await chiamaApi('/api/mentale/post', { qualita: post.qualita, risultato: post.risultato });
    letturaAttuale = r.lettura;
    const classe = r.tipo === 'scarsoPositivo' ? ' ego' : (r.tipo === 'buonoNegativo' ? ' var' : '');
    el('postLettura').innerHTML = `<div class="mgc-reading${classe}">${esc(r.lettura)}</div>`;
  } catch (e) {
    el('postLettura').innerHTML = `<p class="mgc-hint">${esc(e.message)}</p>`;
  }
}

function salvaPost() {
  const mancaRegola = POST.regole.filter(r => post.regole[r.id] === undefined);
  mancaRegola.forEach(r => el('pr-' + r.id)?.classList.add('missing'));
  if (!post.qualita) el('pq-qualita')?.classList.add('missing');
  if (!post.risultato) el('pq-risultato')?.classList.add('missing');
  if (mancaRegola.length || !post.qualita || !post.risultato) { alert(POST.errore); return; }

  const pre = leggiJson(KEY_TETTO);
  const preOggi = pre && pre.data === oggi() ? pre : null;
  const voce = {
    id: Date.now(),
    data: oggi(),
    ora: new Date().toTimeString().slice(0, 5),
    preparazione: preOggi ? preOggi.percentuale ?? null : null,
    limiteTavoli: preOggi ? preOggi.messaggio : null,
    regole: { ...post.regole },
    qualita: post.qualita,
    risultato: post.risultato,
    lettura: letturaAttuale,
    trigger: [...post.trigger],
    note: Object.fromEntries(POST.riflessione.map(r => [r.id, el('pn-' + r.id).value.trim()])),
  };
  const diario = leggiJson(KEY_DIARIO) || [];
  diario.push(voce);
  scriviJson(KEY_DIARIO, diario);

  // Modulo pulito per la prossima sessione, conferma visibile
  disegnaPost(POST);
  el('postSalvato').hidden = false;
  el('postSalvato').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── INIT ─────────────────────────────────────────────────
// Stesso piccolo ritardo usato in pko.js e icm.js
setTimeout(() => {
  setupSchede();
  caricaTavoli();
  caricaDomande();
  el('preCalcola')?.addEventListener('click', calcolaPre);
  el('pausaControlla')?.addEventListener('click', controllaPausa);
  setupTavoloFinale();
  mostraTettoOggi();
}, 100);
})();
