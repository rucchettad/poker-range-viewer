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
const KEY_CREDENZE = 'mgc_credenze';  // diario delle credenze, solo in questo browser
const KEY_SESSIONE = 'mgc_sessione';  // sessione in corso: Pre-sessione, controlli e bozza della Post-sessione
const ORE_SESSIONE = 24;              // senza attività per 24 ore la sessione è considerata "di ieri"

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
  if (dati.postSessione) {
    const s = leggiSessione();
    disegnaPost(dati.postSessione, { bozza: s?.bozza || null });
  }
  ripristinaSessione();
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

function mostraRisultato(r, { scorri = true } = {}) {
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
  if (scorri) el('preRisultati').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const r = await chiamaApi('/api/mentale/pre', { risposte, tavoliMax });
    // Sessione ancora aperta: aggiorna la Pre-sessione e tiene controlli e bozza.
    // Sessione vecchia o assente: ne inizia una nuova.
    const nuova = !sessioneAttiva(leggiSessione());
    aggiornaSessione(s => { s.pre = { risposte: { ...risposte }, tavoliMax, risultato: r }; }, { nuova });
    mostraAvvisoSessione();
    mostraRisultato(r);
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

// ===== SESSIONE IN CORSO =====
// Resta salvata finché il giocatore non la chiude con "Salva nel diario".
// Se una sessione resta aperta oltre ORE_SESSIONE senza attività, è "di ieri": il tool riparte pulito
// e un avviso chiede di completare la Post-sessione per salvarla nel diario.
function leggiSessione() { return leggiJson(KEY_SESSIONE); }

function sessioneAttiva(s) {
  return !!s && (Date.now() - (s.ultima || 0)) < ORE_SESSIONE * 60 * 60 * 1000;
}

function sessioneDaChiudere(s) {
  return !!s && !sessioneAttiva(s) && (!!s.pre || (s.controlli || []).length > 0);
}

// Modifica la sessione in corso (la crea se non c'è o se quella salvata è vecchia e da scartare)
function aggiornaSessione(modifica, { nuova = false } = {}) {
  let s = leggiSessione();
  if (!s || nuova) s = { inizio: Date.now(), data: oggi(), controlli: [], bozza: null, pre: null };
  modifica(s);
  s.ultima = Date.now();
  scriviJson(KEY_SESSIONE, s);
  return s;
}

function chiudiSessione() {
  try { localStorage.removeItem(KEY_SESSIONE); } catch (e) { /* non bloccante */ }
}

function mostraAvvisoSessione() {
  const vecchia = sessioneDaChiudere(leggiSessione());
  ['preAvviso', 'postAvviso'].forEach(id => { if (el(id)) el(id).hidden = !vecchia; });
}

function salvaTettoOggi(messaggio, percentuale) {
  scriviJson(KEY_TETTO, { data: oggi(), messaggio, percentuale });
  mostraTettoOggi();
}

function mostraTettoOggi() {
  // Prima la Pre-sessione della sessione in corso (vale anche dopo la mezzanotte), poi quella di oggi
  const s = leggiSessione();
  if (sessioneAttiva(s) && s.pre?.risultato?.messaggioTavoli) { el('regTavoli').textContent = s.pre.risultato.messaggioTavoli; return; }
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
    const ora = new Date().toTimeString().slice(0, 5);
    const nuova = !sessioneAttiva(leggiSessione());
    aggiornaSessione(s => {
      s.controlli = [...(s.controlli || []), { ora, colore: r.colore }];
      s.ultimoControllo = { ora, risposte: { ...rispostePausa }, risultato: r };
    }, { nuova });
    mostraAvvisoSessione();
    mostraControllo(r, ora);
    el('pausaRisultato').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    alert(e.message);
  }
}

function mostraControllo(r, ora) {
  el('pausaRisultato').innerHTML =
    `<p class="mgc-hint" style="margin:0;">Ultimo controllo: ${esc(ora)}</p>` +
    `<div class="mgc-sem ${esc(r.colore)}">${PALLINO[r.colore] || ''} ${esc(r.messaggio)}</div>` +
    r.consigli.map(c => `<div class="mgc-card"><h3>${esc(c.titolo)}</h3><p>${esc(c.testo)}</p></div>`).join('');
  controlloFatto = true;
  el('ftPromemoria').hidden = true;
}

// Rimette nella pagina lo stato della sessione in corso (dopo il caricamento delle domande)
function selezionaBottoni(contenitore, store, valori) {
  Object.entries(valori || {}).forEach(([q, v]) => {
    store[q] = v;
    contenitore.querySelectorAll(`button[data-q="${q}"]`).forEach(b => b.classList.toggle('sel', Number(b.dataset.v) === v));
  });
}

function ripristinaSessione() {
  const s = leggiSessione();
  mostraAvvisoSessione();
  if (!sessioneAttiva(s)) return;
  if (s.pre) {
    selezionaBottoni(el('preDomande'), risposte, s.pre.risposte);
    if (s.pre.tavoliMax) el('tavoliMax').value = s.pre.tavoliMax;
    if (s.pre.risultato) mostraRisultato(s.pre.risultato, { scorri: false });
  }
  if (s.ultimoControllo) {
    selezionaBottoni(el('pausaDomande'), rispostePausa, s.ultimoControllo.risposte);
    mostraControllo(s.ultimoControllo.risultato, s.ultimoControllo.ora);
  }
  mostraTettoOggi();
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

let ripristinando = false; // durante il ripristino della bozza non si risalva
function salvaBozza() {
  if (!POST || ripristinando) return;
  const bozza = {
    tornei: el('pdTornei')?.value || '', buyin: el('pdBuyin')?.value || '',
    regole: { ...post.regole }, qualita: post.qualita, risultato: post.risultato, trigger: [...post.trigger],
    note: Object.fromEntries(POST.riflessione.map(r => [r.id, el('pn-' + r.id)?.value || ''])),
  };
  aggiornaSessione(s => { s.bozza = bozza; });
}

function disegnaPost(d, { bozza = null } = {}) {
  POST = d;
  nuovoPost();
  const sezione = (titolo, guida) =>
    `<p class="section-label mgc-block-title">${esc(titolo)}</p>${guida ? `<p class="mgc-hint">${esc(guida)}</p>` : ''}`;

  el('postContenuto').innerHTML = `
    <div class="mgc-alert" id="postAvviso" hidden style="margin-bottom:16px;">La sessione di ieri non è stata chiusa: compila la Post-sessione per salvarla nel diario.</div>
    ${sezione('Dati della sessione (facoltativi)')}
    <div class="mgc-rules mgc-num" style="margin-bottom:24px;">
      <div class="mgc-field" style="margin:0;"><label for="pdTornei">Tornei giocati</label><input type="number" id="pdTornei" min="0" step="1"/></div>
      <div class="mgc-field" style="margin:0;"><label for="pdBuyin">Buy-in pagati (€)</label><input type="number" id="pdBuyin" min="0" step="0.01"/></div>
    </div>

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

  // Ogni modifica finisce nella bozza della sessione in corso
  el('postContenuto').addEventListener('click', e => { if (e.target.closest('button') && e.target.id !== 'postSalva') salvaBozza(); });
  el('postContenuto').addEventListener('input', salvaBozza);

  if (bozza) ripristinaBozza(bozza);
  mostraAvvisoSessione();
}

function ripristinaBozza(b) {
  ripristinando = true;
  try {
  if (b.tornei) el('pdTornei').value = b.tornei;
  if (b.buyin) el('pdBuyin').value = b.buyin;
  Object.entries(b.regole || {}).forEach(([id, si]) => {
    el('postContenuto').querySelector(`.mgc-choice[data-regola="${id}"] button[data-v="${si ? 'si' : 'no'}"]`)?.click();
  });
  if (b.qualita) el('postQualita').querySelector(`button[data-v="${b.qualita}"]`)?.click();
  if (b.risultato) el('postRisultato').querySelector(`button[data-v="${b.risultato}"]`)?.click();
  (b.trigger || []).forEach(t => {
    [...el('postTrigger').querySelectorAll('button')].find(x => x.dataset.t === t)?.click();
  });
  Object.entries(b.note || {}).forEach(([id, testo]) => { if (el('pn-' + id)) el('pn-' + id).value = testo; });
  } finally {
    ripristinando = false;
  }
}

let letturaAttuale = null;
let letturaTipo = null;
async function aggiornaLettura() {
  if (!post.qualita || !post.risultato) return;
  try {
    const r = await chiamaApi('/api/mentale/post', { qualita: post.qualita, risultato: post.risultato });
    letturaAttuale = r.lettura;
    letturaTipo = r.tipo;
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

  // Dati della sessione in corso; senza sessione, la Pre-sessione di oggi (se c'è)
  const s = leggiSessione();
  const tetto = leggiJson(KEY_TETTO);
  const preOggi = tetto && tetto.data === oggi() ? tetto : null;
  const preSess = s?.pre?.risultato;
  const voce = {
    id: Date.now(),
    data: s?.data || oggi(),
    ora: new Date().toTimeString().slice(0, 5),
    preparazione: preSess ? preSess.percentuale : (preOggi ? preOggi.percentuale ?? null : null),
    limiteTavoli: preSess ? preSess.messaggioTavoli : (preOggi ? preOggi.messaggio : null),
    controlli: s?.controlli || [],
    regole: { ...post.regole },
    qualita: post.qualita,
    risultato: post.risultato,
    lettura: letturaAttuale,
    letturaTipo,
    tornei: numeroOppureNull(el('pdTornei').value),
    buyin: numeroOppureNull(el('pdBuyin').value),
    trigger: [...post.trigger],
    note: Object.fromEntries(POST.riflessione.map(r => [r.id, el('pn-' + r.id).value.trim()])),
  };
  const diario = leggiJson(KEY_DIARIO) || [];
  diario.push(voce);
  scriviJson(KEY_DIARIO, diario);

  // Sessione chiusa: tutto pulito per la prossima, conferma visibile
  chiudiSessione();
  pulisciSessioneInPagina();
  disegnaPost(POST);
  el('postSalvato').hidden = false;
  letturaAttuale = null; letturaTipo = null;
  mostraCorrezione();
  disegnaDiario();
  el('postSalvato').scrollIntoView({ behavior: 'smooth', block: 'center' });
}


function pulisciSessioneInPagina() {
  Object.keys(risposte).forEach(k => delete risposte[k]);
  Object.keys(rispostePausa).forEach(k => delete rispostePausa[k]);
  document.querySelectorAll('#preDomande .sel, #pausaDomande .sel').forEach(b => b.classList.remove('sel'));
  el('preRisultati').classList.remove('show');
  el('pausaRisultato').innerHTML = '';
  controlloFatto = false;
  mostraAvvisoSessione();
}

// ===== DIARIO =====
// Tutto calcolato nel browser: sessioni e credenze non lasciano mai il dispositivo.
const RISULTATO_TESTO = { positivo: 'positivo', pari: 'in pari', negativo: 'negativo' };

function numeroOppureNull(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function dataLeggibile(iso) {
  const [a, m, g] = iso.split('-').map(Number);
  return new Date(a, m - 1, g).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmt1(n) { return n.toFixed(1).replace('.', ','); }

// Banner "Da correggere oggi" in Pre-sessione, dall'ultima Post-sessione con la correzione scritta
function mostraCorrezione() {
  const diario = leggiJson(KEY_DIARIO) || [];
  const ultima = [...diario].sort((a, b) => b.id - a.id).find(v => v.note && v.note.correzione);
  const box = el('preCorrezione');
  if (!box) return;
  box.hidden = !ultima;
  if (ultima) box.textContent = 'Da correggere oggi: ' + ultima.note.correzione;
}

// Credenze scritte in sessione
function salvaCredenza() {
  const pensiero = el('crPensiero').value.trim();
  if (!pensiero) { alert('Scrivi almeno il pensiero automatico.'); el('crPensiero').focus(); return; }
  const credenze = leggiJson(KEY_CREDENZE) || [];
  credenze.push({ id: Date.now(), data: oggi(), ora: new Date().toTimeString().slice(0, 5),
    pensiero, prova: el('crProva').value.trim(), alternativa: el('crAlternativa').value.trim() });
  scriviJson(KEY_CREDENZE, credenze);
  ['crPensiero', 'crProva', 'crAlternativa'].forEach(id => { el(id).value = ''; });
  el('crSalvata').hidden = false;
  setTimeout(() => { el('crSalvata').hidden = true; }, 4000);
  disegnaDiario();
}

function rigaDettaglio(titolo, testo) {
  return testo ? `<div><dt>${esc(titolo)}</dt><dd>${esc(testo)}</dd></div>` : '';
}

function schedaSessione(v) {
  const r = v.regole || {};
  const segno = k => (r[k] === true ? '✓' : (r[k] === false ? '✗' : '–'));
  const parti = [];
  if (v.preparazione !== null && v.preparazione !== undefined) parti.push(`Preparazione ${v.preparazione}%`);
  parti.push(`Regole ${segno('orario')} ${segno('tavoli')} ${segno('spesa')}`);
  parti.push(`Gioco ${v.qualita}/5`);
  parti.push(`Risultato ${RISULTATO_TESTO[v.risultato] || v.risultato}`);
  const n = v.note || {};
  return `
    <details class="mgc-advice">
      <summary><span><span class="mgc-sub">Sessione delle ${esc(v.ora || '')}</span><small>${esc(parti.join(' · '))}</small></span></summary>
      <dl>
        ${rigaDettaglio('Lettura', v.lettura)}
        ${rigaDettaglio('Controlli in pausa', (v.controlli || []).map(c => `${PALLINO[c.colore] || ''} ${c.ora}`).join(' · '))}
        ${rigaDettaglio('Trigger', (v.trigger || []).join(', '))}
        ${rigaDettaglio('Tornei', v.tornei !== null && v.tornei !== undefined ? String(v.tornei) : '')}
        ${rigaDettaglio('Buy-in', v.buyin !== null && v.buyin !== undefined ? fmt1(v.buyin).replace(',0', '') + ' €' : '')}
        ${rigaDettaglio('Una decisione presa bene', n.decisioneBuona)}
        ${rigaDettaglio('Il momento in cui hai perso lucidità', n.momento)}
        ${rigaDettaglio('Note dei post-it', n.postit)}
        ${rigaDettaglio('Da correggere', n.correzione)}
        <button type="button" class="mgc-del" data-del-sessione="${v.id}">Elimina</button>
      </dl>
    </details>`;
}

function schedaCredenza(c) {
  return `
    <details class="mgc-advice">
      <summary><span><span class="mgc-sub">Credenza delle ${esc(c.ora || '')}</span><small>${esc(c.pensiero)}</small></span></summary>
      <dl>
        ${rigaDettaglio('Il pensiero automatico', c.pensiero)}
        ${rigaDettaglio('La prova contro', c.prova)}
        ${rigaDettaglio('Il pensiero alternativo', c.alternativa)}
        <button type="button" class="mgc-del" data-del-credenza="${c.id}">Elimina</button>
      </dl>
    </details>`;
}

function tendenze(sessioni) {
  const ult = [...sessioni].sort((a, b) => a.id - b.id).slice(-30);
  if (ult.length < 5) return ['Servono almeno 5 sessioni per vedere le tendenze.'];
  const righe = [];
  const conta = {};
  ult.forEach(v => (v.trigger || []).filter(t => t !== 'Nessuno').forEach(t => { conta[t] = (conta[t] || 0) + 1; }));
  const top = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
  if (top) righe.push(`Il trigger più frequente è "${top[0]}" (${top[1]} sessioni su ${ult.length}).`);
  const prep = ult.map(v => v.preparazione).filter(p => typeof p === 'number');
  if (prep.length) righe.push(`Preparazione media: ${Math.round(prep.reduce((a, b) => a + b, 0) / prep.length)}%.`);
  const tutte = ult.filter(v => v.regole && ['orario', 'tavoli', 'spesa'].every(k => v.regole[k] === true)).length;
  righe.push(`Regole tutte rispettate in ${tutte} sessioni su ${ult.length}.`);
  const ego = ult.filter(v => v.letturaTipo === 'scarsoPositivo' || (v.lettura || '').includes("l'ego ti inganna")).length;
  righe.push(`"L'ego ti inganna" è uscito ${ego} ${ego === 1 ? 'volta' : 'volte'}.`);

  // Volume dopo una sessione negativa (serve il numero di tornei)
  const dopoNeg = [], altri = [];
  for (let i = 1; i < ult.length; i++) {
    if (typeof ult[i].tornei !== 'number') continue;
    (ult[i - 1].risultato === 'negativo' ? dopoNeg : altri).push(ult[i].tornei);
  }
  if (dopoNeg.length >= 3 && altri.length >= 3) {
    const media = a => a.reduce((s, x) => s + x, 0) / a.length;
    const base = media(altri);
    if (base > 0) {
      const diff = Math.round((media(dopoNeg) / base - 1) * 100);
      if (diff > 10) righe.push(`Dopo una sessione negativa giochi in media il ${diff}% di tornei in più.`);
      else if (diff < -10) righe.push(`Dopo una sessione negativa giochi in media il ${-diff}% di tornei in meno.`);
      else righe.push('Dopo una sessione negativa il tuo volume resta stabile.');
    }
  }

  // Giudizio e risultato
  const q = ris => ult.filter(v => v.risultato === ris).map(v => v.qualita);
  const pos = q('positivo'), neg = q('negativo');
  if (pos.length >= 2 && neg.length >= 2) {
    const mp = pos.reduce((a, b) => a + b, 0) / pos.length;
    const mn = neg.reduce((a, b) => a + b, 0) / neg.length;
    righe.push(`Qualità che ti dai: ${fmt1(mp)} nelle sessioni positive, ${fmt1(mn)} in quelle negative.`);
    righe.push(mp - mn >= 1
      ? 'Il tuo giudizio segue il risultato: valuta le decisioni, non l\'esito.'
      : 'Giudichi le decisioni senza farti condizionare dal risultato.');
  }
  return righe;
}

function disegnaDiario() {
  const sessioni = leggiJson(KEY_DIARIO) || [];
  const credenze = leggiJson(KEY_CREDENZE) || [];

  el('diTendenze').innerHTML = tendenze(sessioni).map(t => `<div class="mgc-card"><p>${esc(t)}</p></div>`).join('');

  const giorni = {};
  sessioni.forEach(v => { (giorni[v.data] = giorni[v.data] || { s: [], c: [] }).s.push(v); });
  credenze.forEach(c => { (giorni[c.data] = giorni[c.data] || { s: [], c: [] }).c.push(c); });
  const date = Object.keys(giorni).sort().reverse();

  if (!date.length) {
    el('diGiorni').innerHTML = '<p class="mgc-soon" style="padding:8px 0;">Nessuna sessione salvata. Compila la Post-sessione a fine gioco: la ritrovi qui.</p>';
  } else {
    el('diGiorni').innerHTML = date.map(d => {
      const g = giorni[d];
      return `<p class="mgc-day">${esc(dataLeggibile(d))}</p>` +
        g.s.sort((a, b) => b.id - a.id).map(schedaSessione).join('') +
        g.c.sort((a, b) => b.id - a.id).map(schedaCredenza).join('');
    }).join('');
  }

  el('diGiorni').querySelectorAll('[data-del-sessione]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Eliminare questa sessione dal diario?')) return;
    scriviJson(KEY_DIARIO, (leggiJson(KEY_DIARIO) || []).filter(v => String(v.id) !== b.dataset.delSessione));
    disegnaDiario(); mostraCorrezione();
  }));
  el('diGiorni').querySelectorAll('[data-del-credenza]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Eliminare questa credenza dal diario?')) return;
    scriviJson(KEY_CREDENZE, (leggiJson(KEY_CREDENZE) || []).filter(c => String(c.id) !== b.dataset.delCredenza));
    disegnaDiario();
  }));
}

// ===== COPIA DI SICUREZZA =====
function scaricaFile(nome, contenuto, tipo) {
  const url = URL.createObjectURL(new Blob([contenuto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function scaricaCopia() {
  const copia = {
    app: 'mental-game-check', versione: 1, creata: new Date().toISOString(),
    dati: {
      tavoliMax: (() => { try { return localStorage.getItem(KEY_TAVOLI); } catch (e) { return null; } })(),
      regole: leggiJson(KEY_REGOLE), tettoOggi: leggiJson(KEY_TETTO),
      diario: leggiJson(KEY_DIARIO) || [], credenze: leggiJson(KEY_CREDENZE) || [],
    },
  };
  scaricaFile(`mental-game-check-${oggi()}.json`, JSON.stringify(copia, null, 2), 'application/json');
}

// CSV con ";" e BOM: Excel in italiano lo apre già diviso in colonne
function scaricaExcel() {
  const sessioni = [...(leggiJson(KEY_DIARIO) || [])].sort((a, b) => a.id - b.id);
  const credenze = leggiJson(KEY_CREDENZE) || [];
  const siNo = b => (b === true ? 'Sì' : (b === false ? 'No' : ''));
  const cella = v => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
  const intest = ['Data', 'Ora', 'Preparazione %', 'Limite tavoli', 'Orario rispettato', 'Limite tavoli rispettato',
    'Limite di spesa rispettato', 'Tornei giocati', 'Buy-in pagati (€)', 'Qualità del gioco (1-5)', 'Risultato', 'Lettura',
    'Trigger', 'Una decisione presa bene', 'Il momento in cui hai perso lucidità', 'Note dei post-it', 'Da correggere',
    'Credenze annotate quel giorno', 'Controlli in pausa'];
  const righe = sessioni.map(v => {
    const n = v.note || {}, r = v.regole || {};
    const cr = credenze.filter(c => c.data === v.data).map(c => c.pensiero).join(' | ');
    return [v.data, v.ora, v.preparazione, v.limiteTavoli, siNo(r.orario), siNo(r.tavoli), siNo(r.spesa),
      v.tornei, v.buyin !== null && v.buyin !== undefined ? String(v.buyin).replace('.', ',') : '', v.qualita,
      RISULTATO_TESTO[v.risultato] || v.risultato, v.lettura, (v.trigger || []).join(', '),
      n.decisioneBuona, n.momento, n.postit, n.correzione, cr,
      (v.controlli || []).map(c => `${c.ora} ${c.colore}`).join(', ')].map(cella).join(';');
  });
  scaricaFile(`mental-game-check-${oggi()}.csv`, '\uFEFF' + [intest.map(cella).join(';'), ...righe].join('\r\n'), 'text/csv;charset=utf-8');
}

function caricaCopia(file) {
  const lettore = new FileReader();
  lettore.onload = () => {
    let copia;
    try { copia = JSON.parse(lettore.result); } catch (e) { copia = null; }
    if (!copia || copia.app !== 'mental-game-check' || !copia.dati || !Array.isArray(copia.dati.diario)) {
      alert('Questo file non è una copia valida del Mental Game Check.');
      return;
    }
    if (!confirm('Caricare questa copia? Sostituirà i dati attuali di questo browser.')) return;
    const d = copia.dati;
    try { if (d.tavoliMax) localStorage.setItem(KEY_TAVOLI, d.tavoliMax); } catch (e) { /* non bloccante */ }
    if (d.regole) scriviJson(KEY_REGOLE, d.regole);
    if (d.tettoOggi) scriviJson(KEY_TETTO, d.tettoOggi);
    scriviJson(KEY_DIARIO, d.diario);
    scriviJson(KEY_CREDENZE, Array.isArray(d.credenze) ? d.credenze : []);
    el('diCaricata').hidden = false;
    disegnaDiario(); mostraCorrezione(); caricaTavoli(); mostraTettoOggi();
    // Aggiorna i campi delle regole con i valori della copia
    const r = leggiJson(KEY_REGOLE) || {};
    const campi = { orario: 'regOrario', spesa: 'regSpesa', dopoElim: 'regDopoElim', frase: 'regFrase' };
    for (const [k, id] of Object.entries(campi)) if (r[k] !== undefined && el(id)) el(id).value = r[k];
  };
  lettore.readAsText(file);
}

function setupDiario() {
  el('crSalva')?.addEventListener('click', salvaCredenza);
  el('diScarica')?.addEventListener('click', scaricaCopia);
  el('diExcel')?.addEventListener('click', scaricaExcel);
  el('diCarica')?.addEventListener('click', () => el('diFile').click());
  el('diFile')?.addEventListener('change', e => { if (e.target.files[0]) caricaCopia(e.target.files[0]); e.target.value = ''; });
  disegnaDiario();
  mostraCorrezione();
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
  setupDiario();
}, 100);
})();
