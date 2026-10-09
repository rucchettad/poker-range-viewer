/**
 * POKER RANGE VIEWER — Bankroll Calculator
 * © 2026 pokerrange.online - Danilo Rucchetta
 * Qui c'è solo l'interfaccia: tutti i calcoli arrivano dal backend (/api/bankroll/...).
 * Il file dei tornei viene letto nel browser: al server vanno solo numeri, con account e nomi
 * dei tornei sostituiti da codici. I nomi restano su questo dispositivo.
 */
(function () {
'use strict';

const API_URL = 'https://poker-range-api-production.up.railway.app';
const TIPI = { freezeout: 'Freezeout', pko: 'PKO / KO', mystery: 'Mystery Bounty', turbo: 'Turbo / Hyper', sat: 'Satellite' };

const el = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function getToken() {
  return sessionStorage.getItem('poker_token') || sessionStorage.getItem('access_token') || '';
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
  if (!resp.ok) { const e = new Error((json && json.error) || 'Errore server.'); e.status = resp.status; throw e; }
  return json;
}

// Solo presentazione dei numeri arrivati dal server
function euro(n) {
  const dec = Math.abs(n) < 100 ? 2 : 0;
  let [int, fr] = (Math.round(n * 10 ** dec) / 10 ** dec).toFixed(dec).split('.');
  const segno = int.startsWith('-') ? '-' : '';
  int = int.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (fr && /^0+$/.test(fr)) fr = '';
  return segno + int + (fr ? ',' + fr : '') + ' €';
}
const migliaia = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const conSegno = v => `<span class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : ''}${euro(v)}</span>`;
const dataIt = ms => { const d = new Date(ms); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };
const dataIso = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
const ritardo = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ===== Stato della pagina =====
const rbValori = {};            // room -> % di rakeback
const alias = {};               // account del file -> nome scelto dall'utente (per esempio la skin)
let importi = {};               // room -> rakeback in euro (dall'ultimo calcolo del server)
let file = null;                // { tornei: [...], account: [...], primo, ultimo }
const nomeRoom = s => String(s || '').trim() || 'Senza room';
const vis = a => alias[a] || a;

// Elenco delle room: quelle del programma più gli account del file. Al server va solo la posizione.
function etichette() {
  const lista = [];
  const aggiungi = n => { if (!lista.includes(n)) lista.push(n); };
  [...el('righe').children].forEach(r => aggiungi(nomeRoom(r.querySelector('.room').value)));
  if (file) file.account.forEach(a => aggiungi(vis(a)));
  return lista;
}

// ===== Righe del programma =====
function aggiungiRiga(v = {}) {
  const r = document.createElement('div');
  r.className = 'riga';
  r.innerHTML = `
    <div><label>Tipo</label><select class="f">${Object.entries(TIPI).map(([k, nome]) =>
      `<option value="${k}"${v.f === k ? ' selected' : ''}>${nome}</option>`).join('')}</select></div>
    <div><label>Room</label><input class="room" type="text" maxlength="50" placeholder="Es. iPoker" value="${esc(v.room ?? '')}"/></div>
    <div><label>Buy-in (€)</label><input class="b" type="number" min="0" step="0.01" value="${v.b ?? ''}"/></div>
    <div><label>Di cui fee (€)</label><input class="fee" type="number" min="0" step="0.01" placeholder="10%" value="${v.fee ?? ''}"/></div>
    <div><label>Tornei a settimana</label><input class="t" type="number" min="0" step="0.1" value="${v.t ?? ''}"/></div>
    <div><label>Re-entry medi</label><input class="e" type="number" min="1" step="0.1" value="${v.e ?? 1}"/></div>
    <div><label>Iscritti medi</label><input class="n" type="number" min="2" step="1" value="${v.n ?? ''}"/></div>
    <button class="del" type="button" aria-label="Elimina riga">×</button>`;
  if (v.dalFile) { r.dataset.file = '1'; r.dataset.etichetta = v.room; }
  r.querySelector('.del').addEventListener('click', () => { if (el('righe').children.length > 1) { r.remove(); importi = {}; aggiornaRoom(); } });
  r.querySelector('.room').addEventListener('input', () => {
    // Riga nata dal file: il nuovo nome vale per tutte le righe e per tutto l'account
    if (r.dataset.file && file) {
      const vecchio = r.dataset.etichetta, nuovo = nomeRoom(r.querySelector('.room').value);
      file.account.forEach(a => { if (vis(a) === vecchio) alias[a] = nuovo; });
      [...el('righe').children].forEach(x => {
        if (x.dataset.etichetta === vecchio) { x.dataset.etichetta = nuovo; if (x !== r) x.querySelector('.room').value = nuovo; }
      });
      if (rbValori[vecchio] !== undefined && rbValori[nuovo] === undefined) rbValori[nuovo] = rbValori[vecchio];
      if (importi[vecchio]) { importi[nuovo] = importi[vecchio]; delete importi[vecchio]; }
      aggiornaFileRitardato();
    }
    aggiornaRoom();
  });
  r.addEventListener('input', e => {
    if (e.target.classList.contains('room')) return;
    importi = {}; disegnaImporti();   // il programma è cambiato: gli importi si aggiornano al prossimo calcolo
  });
  el('righe').appendChild(r);
  aggiornaRoom();
}

// Righe complete, con la room come numero
function righeDaInviare(labs) {
  return [...el('righe').children].map(r => {
    const valore = s => r.querySelector(s).value;
    return {
      f: valore('.f'), lab: labs.indexOf(nomeRoom(valore('.room'))),
      b: parseFloat(valore('.b')), fee: valore('.fee') === '' ? null : parseFloat(valore('.fee')),
      t: parseFloat(valore('.t')), e: parseFloat(valore('.e')) || 1, n: parseFloat(valore('.n')),
    };
  }).filter(x => x.b > 0 && x.t > 0 && x.n > 1);
}

// ===== Rakeback per room =====
function aggiornaRoom() {
  const box = el('rbRoom'); if (!box) return;
  const rooms = [...new Set([...el('righe').children].map(r => nomeRoom(r.querySelector('.room').value)))];
  box.innerHTML = rooms.map(n => `<div class="rb-riga"><span>${esc(n)}</span>
    <input type="number" min="0" max="100" step="1" data-room="${esc(n)}" value="${rbValori[n] ?? 0}" aria-label="Rakeback ${esc(n)}"/>
    <span class="rb-euro" data-importo="${esc(n)}"></span></div>`).join('');
  box.querySelectorAll('input').forEach(i => i.addEventListener('input', () => {
    rbValori[i.dataset.room] = parseFloat(i.value) || 0;
    if (file) aggiornaFileRitardato(); else { delete importi[i.dataset.room]; disegnaImporti(); }
  }));
  disegnaImporti();
}

function disegnaImporti() {
  el('rbRoom')?.querySelectorAll('[data-importo]').forEach(span => {
    const o = importi[span.dataset.importo];
    if (!o || !o.feeMese) { span.textContent = ''; return; }
    if (!o.incassatoMese) { span.textContent = `fee: ${euro(o.feeMese)} al mese`; return; }
    span.innerHTML = `<strong>≈ ${euro(o.incassatoMese)} al mese</strong> (su ${euro(o.feeMese)} di fee)`
      + (o.feeFile ? `<br>nei tuoi tornei: ${euro(o.incassatoFile)} su ${euro(o.feeFile)} di fee` : '');
  });
}
function salvaImporti(perLab, labs) {
  importi = {};
  Object.entries(perLab || {}).forEach(([lab, o]) => { if (labs[lab] !== undefined) importi[labs[lab]] = o; });
  disegnaImporti();
}

// ===== I tuoi soldi (bankroll al netto della riserva, calcolato dal server) =====
async function aggiornaFondi() {
  const pro = el('profilo').value === 'pro';
  document.querySelectorAll('.solo-pro').forEach(d => { d.style.display = pro ? '' : 'none'; });
  try {
    const f = await chiamaApi('/api/bankroll/fondi', { profilo: el('profilo').value, fondi: el('bankroll').value, spese: el('spese').value });
    el('vRiserva').textContent = f.riserva; el('vUtile').textContent = f.bankroll;
    el('vConto').textContent = f.conto; el('bankrollHint').textContent = f.nota;
  } catch (e) {
    if (e.status !== 429) { el('vUtile').textContent = '—'; el('bankrollHint').textContent = e.message; }
  }
}
const aggiornaFondiRitardato = ritardo(aggiornaFondi, 300);

// ===== Lettura del file dei tornei (solo nel browser) =====
function leggiCsv(testo) {
  const righe = []; let riga = [], campo = '', virg = false;
  for (let i = 0; i < testo.length; i++) {
    const ch = testo[i];
    if (virg) {
      if (ch === '"') { if (testo[i + 1] === '"') { campo += '"'; i++; } else virg = false; }
      else campo += ch;
    } else if (ch === '"') virg = true;
    else if (ch === ',') { riga.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && testo[i + 1] === '\n') i++;
      riga.push(campo); righe.push(riga); riga = []; campo = '';
    } else campo += ch;
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga); }
  return righe.filter(r => r.some(c => c.trim()));
}

// Ogni torneo diventa [minuti, account, segnalazioni, stake, fee, rientri, iscritti, risultato, nome, usd]:
// account e nome sono posizioni in elenchi che restano nel browser.
function preparaTornei(testo) {
  const righe = leggiCsv(testo.replace(/^﻿/, ''));
  if (righe.length < 2) throw new Error('Il file è vuoto.');
  const h = righe[0].map(x => x.trim().toLowerCase());
  const col = (...nomi) => h.findIndex(x => nomi.some(n => x.startsWith(n)));
  const C = {
    stake: col('stake'), rake: col('rake'), ris: col('result', 'risultato'), rientri: col('rientri', 're-entr', 'rebuy'),
    iscritti: col('concorrenti', 'entrants', 'players'), tipo: col('segnalazioni', 'flags'), valuta: col('valuta', 'currency'),
    nome: col('nome', 'name'), data: col('data di inizio', 'start'), room: col('rete', 'network', 'site'),
    nick: h.findIndex(x => x === 'giocatore' || x === 'player' || x === 'player name'),
  };
  if ([C.stake, C.rake, C.ris, C.iscritti].some(i => i < 0)) throw new Error('Il file non ha le colonne attese (stake, fee, risultato, iscritti).');
  const n = v => { const x = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0; };
  // Data e ora come orologio locale (nessun fuso orario)
  const minuti = s => {
    const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/) || String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})/);
    if (!m) return 0;
    return m[1].length === 4 ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 6e4 : Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) / 6e4;
  };
  // Nome "di base" del torneo (senza [Day 1] / [1H] / Day 2 / Final): serve solo a collegare i giorni dello stesso evento
  const base = s => String(s || '').replace(/ /g, ' ').replace(/\[[^\]]*\]/g, '').replace(/\b(day|giorno)\s*\w+/ig, '')
    .replace(/\b(final|finale|final table)\b/ig, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const account = [], nomi = new Map();
  const tornei = righe.slice(1).map(r => {
    const acc = nomeRoom([C.room >= 0 ? r[C.room] : '', C.nick >= 0 ? r[C.nick] : ''].map(x => String(x || '').trim()).filter(Boolean).join(' · '));
    if (!account.includes(acc)) account.push(acc);
    const b = C.nome >= 0 ? base(r[C.nome]) : '';
    if (b && !nomi.has(b)) nomi.set(b, nomi.size);
    const t = (C.tipo >= 0 ? r[C.tipo] : '').split(/\s+/);
    const fl = (t.includes('Mystery-Bounty') ? 1 : 0) | (t.includes('Progressive-Bounty') ? 2 : 0) | (t.includes('Bounty') ? 4 : 0) | (t.includes('Satellite') ? 8 : 0);
    return [C.data >= 0 ? minuti(r[C.data]) : 0, account.indexOf(acc), fl, n(r[C.stake]), n(r[C.rake]),
      C.rientri >= 0 ? n(r[C.rientri]) : 0, n(r[C.iscritti]), n(r[C.ris]), b ? nomi.get(b) : -1,
      C.valuta >= 0 && String(r[C.valuta]).trim().toUpperCase() === 'USD' ? 1 : 0];
  });
  return { tornei, account };
}

// Tornei con la room al posto dell'account (stessa posizione dell'elenco delle room)
const torneiDaInviare = labs => file.tornei.map(t => { const c = t.slice(); c[1] = labs.indexOf(vis(file.account[t[1]])); return c; });

function periodoDaInviare() {
  const oggi = new Date();
  return {
    scelta: el('periodo')?.value || 'm3',
    dal: Date.parse(el('periodoDal')?.value || ''), al: Date.parse(el('periodoAl')?.value || ''),
    oggi: { y: oggi.getFullYear(), m: oggi.getMonth() },
  };
}

// Chiede al server l'analisi del periodo scelto; con "ricostruisci" il programma si ricompila dai tornei
async function aggiornaFile(ricostruisci = false) {
  if (!file) return;
  const esito = el('esitoPeriodo');
  el('periodoDate').hidden = el('periodo').value !== 'date';
  const labs = etichette();
  let a;
  try {
    a = await chiamaApi('/api/bankroll/file', { tornei: torneiDaInviare(labs), periodo: periodoDaInviare(), rb: labs.map(n => rbValori[n] || 0) });
  } catch (e) {
    if (e.status === 429) { aggiornaFileRitardato(ricostruisci); return; }
    esito.innerHTML = `<div class="avviso" style="margin-top:10px;">${esc(e.message)}</div>`; return;
  }
  el('lettura').innerHTML = `<strong>Letti ${migliaia(a.lettura.n)} tornei</strong>${a.lettura.primo ? `, dal ${dataIt(a.lettura.primo)} al ${dataIt(a.lettura.ultimo)}` : ''}`
    + (a.lettura.scartati ? (a.lettura.scartati === 1 ? ' (1 riga senza costo, non collegata a un Day 1, è stata esclusa)' : ` (${a.lettura.scartati} righe senza costo, non collegate a un Day 1, sono state escluse)`) : '') + '.';
  if (a.avviso) { esito.innerHTML = `<div class="avviso" style="margin-top:10px;">${esc(a.avviso)}</div>`; return; }

  if (ricostruisci) {
    el('righe').innerHTML = '';
    a.programma.forEach(x => aggiungiRiga({ ...x, room: labs[x.lab], dalFile: true }));
    el('roi').value = a.roi;
    el('campione').value = a.campione;
  }
  salvaImporti(a.rakeback, labs);

  const p = a.periodo;
  const nomeLab = lab => esc(labs[lab] ?? '');
  const riga = (g, classe = '') => `<details class="${classe}"><summary><span>${esc(g.titolo)}</span><span>${migliaia(g.n)}</span><span class="nasc">${euro(g.spesa)}</span><span>${conSegno(g.ris)}</span><span>${g.roi}</span><span class="nasc">${euro(g.rb)}</span></summary>
    <div class="scorri"><table><thead><tr><th>Room</th><th>Formato</th><th>Tornei</th><th>Spesa</th><th>Risultato</th><th>ROI totale</th><th>Rakeback</th></tr></thead><tbody>
    ${g.dett.map(d => `<tr><td>${nomeLab(d.lab)}</td><td>${esc(d.formato)}</td><td>${d.n}</td><td>${euro(d.spesa)}</td><td>${conSegno(d.ris)}</td><td>${d.roi}</td><td>${euro(d.rb)}</td></tr>`).join('')}
    </tbody></table></div></details>`;
  esito.innerHTML = `
    <p style="margin-top:10px;"><strong>Nel periodo scelto: ${migliaia(p.n)} tornei</strong>, circa ${migliaia(p.alMese)} al mese.<br>
    ROI totale: ${p.roi}. Oscillazione: ${p.ds} buy-in per torneo.</p>
    ${p.pochi ? '<div class="avviso" style="margin-top:8px;">Con meno di 500 tornei il ROI e la simulazione sono poco affidabili: per il calcolo del bankroll conviene un periodo più lungo.</div>' : ''}
    <p class="section-label" style="margin-top:16px;">Room e formato</p>
    <div class="scorri"><table><thead><tr><th>Room</th><th>Formato</th><th>Tornei</th><th>Costo per ingresso</th><th>Ingressi medi</th><th>Iscritti medi</th><th>ROI totale</th></tr></thead><tbody>
    ${a.gruppi.map(g => `<tr><td>${nomeLab(g.lab)}</td><td>${esc(g.formato)}</td><td>${g.n}</td><td>${euro(g.costoIngresso)}</td><td>${g.ingressi}</td><td>${g.iscritti}</td><td>${g.roi}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="hint" style="margin-top:8px;">Con pochi tornei in una riga, il suo ROI totale è solo indicativo. Il programma più in basso e il ROI sono stati compilati da questi tornei: puoi modificarli. Nella colonna «Room» del programma puoi scrivere il nome della skin al posto dell'account: vale per tutte le righe di quell'account.</p>
    <p class="section-label" style="margin-top:16px;">Mese per mese</p>
    <p class="hint" style="margin:0;">Tocca un mese per vedere il dettaglio per room e formato, con il ROI totale.</p>
    <div class="mesi"><div class="testa"><span>Mese</span><span>Tornei</span><span class="nasc">Spesa</span><span>Risultato</span><span>ROI totale</span><span class="nasc">Rakeback</span></div>
    ${a.mesi.map(m => riga(m)).join('')}${riga(a.totale, 'totale')}</div>`;
}
const aggiornaFileRitardato = ritardo(r => aggiornaFile(r), 500);

function caricaFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const lettore = new FileReader();
  lettore.onload = () => {
    const box = el('dalFile');
    box.hidden = false;
    try {
      const { tornei, account } = preparaTornei(lettore.result);
      const minuti = tornei.map(t => t[0]).filter(m => m > 0);
      file = { tornei, account, primo: minuti.length ? Math.min(...minuti) * 6e4 : 0, ultimo: minuti.length ? Math.max(...minuti) * 6e4 : 0 };
      box.className = 'dalfile';
      box.innerHTML = `<div id="lettura">Lettura del file…</div>
        <div class="periodo">
          <label for="periodo">Periodo da usare</label>
          <select id="periodo">
            <option value="corrente">Questo mese</option>
            <option value="precedente">Mese precedente</option>
            <option value="m1">Ultimi 30 giorni</option>
            <option value="m3" selected>Ultimi 3 mesi</option>
            <option value="m6">Ultimi 6 mesi</option>
            <option value="tutto">Tutto il file</option>
            <option value="date">Da data a data</option>
          </select>
          <span id="periodoDate" hidden>
            <label for="periodoDal">Dal</label><input type="date" id="periodoDal" value="${file.primo ? dataIso(file.primo) : ''}"/>
            <label for="periodoAl">Al</label><input type="date" id="periodoAl" value="${file.ultimo ? dataIso(file.ultimo) : ''}"/>
          </span>
        </div>
        <div id="esitoPeriodo"></div>`;
      ['periodo', 'periodoDal', 'periodoAl'].forEach(id => el(id).addEventListener('change', () => aggiornaFile(true)));
      aggiornaFile(true);
    } catch (err) {
      file = null;
      box.className = 'dalfile avviso';
      box.textContent = err.message;
    }
  };
  lettore.readAsText(f);
  e.target.value = '';
}

// ===== Calcolo (sul server) =====
async function calcola() {
  const labs = etichette();
  const righe = righeDaInviare(labs);
  if (!righe.length) { alert('Inserisci almeno una riga completa: buy-in, tornei a settimana e iscritti.'); return; }
  const btn = el('calcola');
  btn.disabled = true; btn.textContent = 'Calcolo in corso…';
  try {
    const corpo = {
      righe, roi: el('roi').value, profilo: el('profilo').value, campione: el('campione').value,
      fondi: el('bankroll').value, spese: el('spese').value, rb: labs.map(n => rbValori[n] || 0),
    };
    if (file) { corpo.tornei = torneiDaInviare(labs); corpo.periodo = periodoDaInviare(); }
    mostraRisultato(await chiamaApi('/api/bankroll/calcola', corpo), labs);
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Calcola';
  }
}

function mostraRisultato(r, labs) {
  el('res').classList.add('show');
  el('sem').className = 'sem ' + r.sem.classe;
  el('sem').innerHTML = r.sem.html;
  el('rAbi').textContent = r.abi.v; el('rAbiS').innerHTML = r.abi.s;
  salvaImporti(r.rakeback, labs);
  if (r.senzaVantaggio) {
    ['rBi', 'rBr', 'rMax', 'rMese'].forEach(id => { el(id).textContent = '—'; });
    ['rBiS', 'rBrS', 'rMaxS', 'rMeseS'].forEach(id => { el(id).textContent = ''; });
    el('avvisoPro').hidden = true; el('soglie').innerHTML = ''; el('note').innerHTML = '';
    return;
  }
  el('rBi').textContent = r.bi.v; el('rBiS').innerHTML = r.bi.s;
  el('rBr').textContent = r.br.v; el('rBrS').innerHTML = r.br.s;
  el('rMese').textContent = r.mese.v; el('rMeseS').innerHTML = r.mese.s;
  el('rMaxL').textContent = r.max.l; el('rMax').textContent = r.max.v; el('rMaxS').textContent = r.max.s;
  el('avvisoPro').hidden = !r.avviso; el('avvisoPro').textContent = r.avviso;
  el('soglie').innerHTML = r.soglie.map(([n, v, c]) => `<tr><td>${n}</td><td>${v}</td><td style="text-align:left;">${c}</td></tr>`).join('');
  el('note').innerHTML = r.note.map(t => `<div>${t}</div>`).join('');
  el('res').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── INIT ─────────────────────────────────────────────────
// Stesso piccolo ritardo usato negli altri tool
setTimeout(() => {
  aggiungiRiga({ f: 'pko', room: 'PokerStars', b: 11, t: 20, e: 1.2, n: 400 });
  aggiungiRiga({ f: 'freezeout', room: 'PokerStars', b: 22, t: 8, e: 1, n: 900 });
  aggiungiRiga({ f: 'mystery', room: 'iPoker', b: 55, t: 2, e: 1, n: 1500 });
  el('aggiungi')?.addEventListener('click', () => aggiungiRiga());
  el('calcola')?.addEventListener('click', calcola);
  el('fileTornei')?.addEventListener('change', caricaFile);
  ['bankroll', 'spese'].forEach(id => el(id)?.addEventListener('input', aggiornaFondiRitardato));
  el('profilo')?.addEventListener('change', aggiornaFondi);
  aggiornaFondi();
}, 100);
})();
