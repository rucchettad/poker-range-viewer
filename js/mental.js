/**
 * POKER RANGE VIEWER — Mental Game Check
 * © 2026 pokerrange.online - Danilo Rucchetta
 * Domande, calcolo e consigli arrivano dal backend (/api/mentale/...).
 * Nel browser resta solo il numero massimo di tavoli (localStorage).
 */
(function() {
'use strict';

const API_URL    = 'https://poker-range-api-production.up.railway.app';
const KEY_TAVOLI = 'mgc_tavoli_max';

const risposte = {};
let domandeIds = [];

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
function disegnaDomande(dati) {
  domandeIds = dati.domande.map(d => d.id);
  const html = dati.domande.map(d => {
    const e = d.etichette || {};
    const tutteLeEtichette = [1, 2, 3, 4, 5].every(v => e[v]);
    const bottoni = [1, 2, 3, 4, 5].map(v =>
      `<button type="button" data-q="${esc(d.id)}" data-v="${v}" aria-label="${v}${e[v] ? ' — ' + esc(e[v]) : ''}">${v}${tutteLeEtichette ? `<small>${esc(e[v])}</small>` : ''}</button>`
    ).join('');
    const estremi = tutteLeEtichette ? '' : `<div class="mgc-ends"><span>1 = ${esc(e[1] || '')}</span><span>5 = ${esc(e[5] || '')}</span></div>`;
    return `<div class="mgc-q" id="q-${esc(d.id)}"><div class="mgc-q-text">${esc(d.testo)}</div><div class="mgc-scale">${bottoni}</div>${estremi}</div>`;
  }).join('');
  el('preDomande').innerHTML = html;

  el('preDomande').querySelectorAll('.mgc-scale button').forEach(b => b.addEventListener('click', () => {
    const q = b.dataset.q;
    risposte[q] = Number(b.dataset.v);
    b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
    el('q-' + q)?.classList.remove('missing');
  }));

  if (dati.campoTavoli?.testo) el('tavoliLabel').textContent = dati.campoTavoli.testo;
  if (dati.disclaimer) el('rDisclaimer').textContent = dati.disclaimer;
}

async function caricaDomande() {
  try {
    disegnaDomande(await chiamaApi('/api/mentale/domande', {}));
  } catch (e) {
    el('preDomande').innerHTML = `<p class="mgc-soon">${esc(e.message)}</p>`;
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
  if (!Number.isInteger(tavoliMax) || tavoliMax < 1 || tavoliMax > 60) {
    alert('Inserisci un numero di tavoli da 1 a 60.');
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

// ─── INIT ─────────────────────────────────────────────────
// Stesso piccolo ritardo usato in pko.js e icm.js
setTimeout(() => {
  setupSchede();
  caricaTavoli();
  caricaDomande();
  el('preCalcola')?.addEventListener('click', calcolaPre);
}, 100);
})();
