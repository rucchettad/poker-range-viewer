/**
 * POKER RANGE VIEWER — App logic
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
'use strict';

import { fetchRange, fetchNota, svuotaCache, RateLimitError } from './api.js';
import { mostraSessioneScaduta, avviaPollingSessione } from './auth.js';
import { inizializzaMobile } from './mobile.js';

const MANI = [
  ['AA','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s'],
  ['AKo','KK','KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','K3s','K2s'],
  ['AQo','KQo','QQ','QJs','QTs','Q9s','Q8s','Q7s','Q6s','Q5s','Q4s','Q3s','Q2s'],
  ['AJo','KJo','QJo','JJ','JTs','J9s','J8s','J7s','J6s','J5s','J4s','J3s','J2s'],
  ['ATo','KTo','QTo','JTo','TT','T9s','T8s','T7s','T6s','T5s','T4s','T3s','T2s'],
  ['A9o','K9o','Q9o','J9o','T9o','99','98s','97s','96s','95s','94s','93s','92s'],
  ['A8o','K8o','Q8o','J8o','T8o','98o','88','87s','86s','85s','84s','83s','82s'],
  ['A7o','K7o','Q7o','J7o','T7o','97o','87o','77','76s','75s','74s','73s','72s'],
  ['A6o','K6o','Q6o','J6o','T6o','96o','86o','76o','66','65s','64s','63s','62s'],
  ['A5o','K5o','Q5o','J5o','T5o','95o','85o','75o','65o','55','54s','53s','52s'],
  ['A4o','K4o','Q4o','J4o','T4o','94o','84o','74o','64o','54o','44','43s','42s'],
  ['A3o','K3o','Q3o','J3o','T3o','93o','83o','73o','63o','53o','43o','33','32s'],
  ['A2o','K2o','Q2o','J2o','T2o','92o','82o','72o','62o','52o','42o','32o','22'],
];

const COLORI = {
  fold:'#87ceeb', flat:'#16a34a', threebfold:'#ffe57f', threebbroke:'#ff6600',
  threebshove:'#dc2626', open:'#ffb347', limpflat:'#9333ea', limpthreebet:'#ffc0cb',
  isotobrokefold:'#ffa500', checkback:'#16a34a', bbshovebase:'#dc2626',
  shove:'#dc2626', callnai:'#16a34a', '4betbrokenai':'#ffa500', '4betnaitofold':'#ffe57f', foldnai:'#87ceeb',
  callai:'#16a34a', foldai:'#87ceeb',
  raisevsiso:'#ffb347', foldvsiso:'#87ceeb', shovevsiso:'#dc2626', callvsiso:'#16a34a',
  shovevsbbiso:'#dc2626', callvsbbiso:'#16a34a', foldvsbbiso:'#87ceeb',
  callvsbbisoai:'#16a34a', foldvsbbisoai:'#87ceeb',
};

const ORDINE_AZIONI = [
  'threebshove','threebbroke','threebfold','open','flat','limpthreebet','limpflat',
  'isotobrokefold','checkback','bbshovebase','shove','callnai','4betbrokenai',
  '4betnaitofold','foldnai','callai','foldai','raisevsiso','shovevsiso','callvsiso',
  'foldvsiso','shovevsbbiso','callvsbbiso','foldvsbbiso','callvsbbisoai','foldvsbbisoai','fold',
];

const ETICHETTE = {
  fold:'Fold', flat:'Flat/Call', threebfold:'3Bet/4Bet Fold', threebbroke:'3Bet/4Bet Broke',
  threebshove:'3Bet Shove', open:'Open', limpflat:'Limp/Flat', limpthreebet:'Limp/3Bet',
  isotobrokefold:'ISO to Broke/Fold', checkback:'Check Back', bbshovebase:'Shove (base)',
  shove:'Shove (NAI)', callnai:'Call (NAI)', '4betbrokenai':'4Bet Broke NAI',
  '4betnaitofold':'4Bet NAI to Fold', foldnai:'Fold (NAI)', callai:'Call (AI)', foldai:'Fold (AI)',
  raisevsiso:'Limp 3Bet', foldvsiso:'Fold vs ISO', shovevsiso:'Shove vs ISO', callvsiso:'Call vs ISO',
  shovevsbbiso:'Shove vs BB ISO', callvsbbiso:'Call vs BB ISO', foldvsbbiso:'Fold vs BB ISO',
  callvsbbisoai:'Call vs BB ISO AI', foldvsbbisoai:'Fold vs BB ISO AI',
};

const ORDINE_POS = ['EP','EP1','EP2','MP1','MP2','CO','BTN','SB','BB'];

let stackSelezionato     = '25bb';
let apritoreSelezionato  = 'EP';
let responderSelezionato = 'BB';
let azioneSelezionata    = 'RFI/OSHOVE';
let flatPosizioneSelezionata = 'SB';
let bbLimpSubMode        = 'base';
let sbIsoSubMode         = 'base';
let percentualiMani      = {};
let matrixContainer      = null;
let richiestaInCorsoId   = 0;
let _RATE_LIMITED        = false;

function el(id) { return document.getElementById(id); }

function normalizzaNome(nome) {
  return nome.replace(/\//g, '-').replace(/\s+/g, '_').replace(/\|/g, '_');
}

function generaChiaveRange() {
  const m = normalizzaNome(azioneSelezionata);
  if (azioneSelezionata === 'RFI/OSHOVE')
    return responderSelezionato === 'NO' ? `${m}_${apritoreSelezionato}_${stackSelezionato}` : `${m}_${apritoreSelezionato}_${responderSelezionato}_${stackSelezionato}`;
  if (azioneSelezionata === 'Vs RFI e Flat')
    return `${m}_${apritoreSelezionato}_${responderSelezionato}_${flatPosizioneSelezionata}_${stackSelezionato}`;
  if (azioneSelezionata === 'BB vs SB Limp') {
    const s = bbLimpSubMode === 'nai' ? '_NAI' : bbLimpSubMode === 'ai' ? '_AI' : '';
    return `${m}${s}_${apritoreSelezionato}_${responderSelezionato}_${stackSelezionato}`;
  }
  if (azioneSelezionata === 'SB Limp vs BB ISO') {
    const s = sbIsoSubMode === 'nai' ? '_NAI' : sbIsoSubMode === 'ai' ? '_AI' : '';
    return `${m}${s}_${apritoreSelezionato}_${responderSelezionato}_${stackSelezionato}`;
  }
  return `${m}_${apritoreSelezionato}_${responderSelezionato}_${stackSelezionato}`;
}

function creaMatrice() {
  matrixContainer = el('matrix');
  matrixContainer.innerHTML = '';
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const mano = MANI[r][c];
      const cell = document.createElement('div');
      cell.className = 'hand-cell';
      cell.setAttribute('data-hand', mano);
      const txt = document.createElement('div');
      txt.className = 'hand-text';
      txt.textContent = mano;
      cell.appendChild(txt);
      matrixContainer.appendChild(cell);
    }
  }
}

function aggiornaVisualizzazioneMatrice() {
  document.querySelectorAll('.hand-cell').forEach(cell => {
    const mano = cell.getAttribute('data-hand');
    cell.querySelectorAll('.color-bar, .action-percentage').forEach(n => n.remove());
    if (!percentualiMani[mano]) return;
    const tutte    = Object.keys(percentualiMani[mano]);
    const ordinate = ORDINE_AZIONI.filter(a => tutte.includes(a));
    tutte.forEach(a => { if (!ordinate.includes(a)) ordinate.push(a); });
    let pctAcc = 0;
    const azioniUsate = [];
    ordinate.forEach(az => {
      const pct = percentualiMani[mano][az];
      if (pct <= 0) return;
      azioniUsate.push(az);
      const bar = document.createElement('div');
      bar.className = 'color-bar';
      bar.style.backgroundColor = COLORI[az] || '#888';
      bar.style.left  = `${pctAcc}%`;
      bar.style.width = `${pct}%`;
      cell.appendChild(bar);
      pctAcc += pct;
    });
    const n = azioniUsate.length;
    if (n >= 3) {
      const el_ = document.createElement('div');
      el_.className   = 'action-percentage';
      el_.textContent = azioniUsate.map(az => percentualiMani[mano][az]).join('/');
      cell.appendChild(el_);
    } else {
      azioniUsate.forEach((az, idx) => {
        const el_ = document.createElement('div');
        el_.className   = 'action-percentage';
        el_.textContent = `${percentualiMani[mano][az]}%`;
        el_.style.left  = `${((idx + 1) / (n + 1)) * 100}%`;
        cell.appendChild(el_);
      });
    }
  });
}

function aggiornaStatistiche() {
  const contatori = {};
  Object.keys(COLORI).forEach(k => { contatori[k] = 0; });
  Object.keys(percentualiMani).forEach(mano => {
    const combo = mano.includes('s') ? 4 : mano.includes('o') ? 12 : 6;
    Object.keys(contatori).forEach(az => {
      if (percentualiMani[mano]?.[az] > 0) contatori[az] += combo * (percentualiMani[mano][az] / 100);
    });
  });
  const senzaFold = Object.keys(contatori).filter(k => k !== 'fold');
  const tot = senzaFold.reduce((s, k) => s + contatori[k], 0);
  let html = `<div class="stat"><div class="stat-color" style="background:linear-gradient(45deg,#16a34a,#ffe57f,#ff6600,#dc2626,#ffb347)"></div><div class="stat-content"><div class="stat-label">Range Totale (senza Fold)</div><div class="stat-value">${Math.round(tot)} (${((tot / 1326) * 100).toFixed(1)}%)</div></div></div>`;
  Object.keys(contatori).forEach(az => {
    if (contatori[az] <= 0) return;
    html += `<div class="stat"><div class="stat-color" style="background:${COLORI[az]}"></div><div class="stat-content"><div class="stat-label">${ETICHETTE[az] || az}</div><div class="stat-value">${Math.round(contatori[az])} (${((contatori[az] / 1326) * 100).toFixed(1)}%)</div></div></div>`;
  });
  el('rangeStats').innerHTML = html;
}

const MSG_RATE_LIMIT = "⚠️ Rallenta!\nHai effettuato troppe richieste in poco tempo. Se stavi semplicemente navigando, ricorda di effettuare meno richieste consecutive in rapida successione.\nAttendi che il monitoraggio si concluda — potrebbe richiedere fino a 10 minuti — dopodiché potrai accedere nuovamente.\nL'accesso anomalo ai dati è monitorato e può comportare la sospensione permanente dell'account.";

function mostraBannerRateLimit() {
  _RATE_LIMITED = true;
  svuotaCache();
  el('errorBannerText').textContent = MSG_RATE_LIMIT;
  el('retryBtn').style.display      = 'none';
  el('errorBanner').style.display   = 'block';
  el('noteContent').textContent     = 'Account sospeso per uso anomalo.';
  percentualiMani = {};
  aggiornaStatistiche();
  aggiornaVisualizzazioneMatrice();
}

async function caricaRangeCorrente() {
  const chiave      = generaChiaveRange();
  const idRichiesta = ++richiestaInCorsoId;
  el('noteContent').textContent = 'Caricamento...';
  let hands, nota;
  try {
    [hands, nota] = await Promise.all([fetchRange(chiave), fetchNota(chiave)]);
  } catch (e) {
    if (idRichiesta !== richiestaInCorsoId) return;
    if (e instanceof RateLimitError) {
      mostraBannerRateLimit();
    } else if (e.message && /token|jwt|non valido|unauthorized|scadut/i.test(e.message)) {
      mostraSessioneScaduta();
    } else {
      percentualiMani = {};
      el('noteContent').textContent     = 'Errore: ' + e.message;
      el('errorBannerText').textContent = 'Errore caricamento: ' + e.message;
      el('retryBtn').style.display      = 'inline-block';
      el('errorBanner').style.display   = 'block';
      aggiornaStatistiche();
      aggiornaVisualizzazioneMatrice();
    }
    return;
  }
  if (idRichiesta !== richiestaInCorsoId) return;
  percentualiMani = hands || {};
  el('noteContent').textContent = nota || 'Nessuna nota per questa configurazione.';
  aggiornaStatistiche();
  aggiornaVisualizzazioneMatrice();
}

function _setActiveTab(selector, matchFn) {
  document.querySelectorAll(selector).forEach(t => t.classList.toggle('active', matchFn(t)));
}

function aggiornaUI() {
  if (_RATE_LIMITED) return;
  const responderTabs = el('responderTabs');
  const flatSection   = el('flatSection');
  const stackButtons  = document.querySelectorAll('#stackGrid .cellBtn');
  const openerLabel   = el('openerLabel');
  const responderLabel = el('responderLabel');

  stackButtons.forEach(btn => { if (!btn.getAttribute('data-orig')) btn.setAttribute('data-orig', btn.textContent.trim()); });

  const LABELS = {
    'RFI/OSHOVE':        { opener: 'RFI:',          responder: 'Hero:' },
    'Vs 3Bet NAI':       { opener: 'Hero:',          responder: '3bettor:' },
    'Vs 3Bet AI':        { opener: 'Hero:',          responder: '3bettor:' },
    'Vs 4Bet':           { opener: 'Hero/3Bettor:',  responder: '4Bettor:' },
    'Call Shove':        { opener: 'Shove:',         responder: 'Hero:' },
    'SB Limp vs BB ISO': { opener: 'Hero:',          responder: 'Villain:' },
    'BB vs SB Limp':     { opener: 'Villain:',       responder: 'Hero:' },
  };
  const lbl = LABELS[azioneSelezionata] || { opener: 'RFI:', responder: 'Hero:' };
  openerLabel.textContent   = lbl.opener;
  responderLabel.textContent = lbl.responder;

  if (azioneSelezionata === 'RFI/OSHOVE') {
    responderTabs.style.display = 'none';
    responderSelezionato = 'NO';
  } else {
    responderTabs.style.display = 'flex';
    if (responderSelezionato === 'NO') responderSelezionato = 'BB';
  }

  if (['SB Limp vs BB ISO', 'BB vs SB Limp'].includes(azioneSelezionata)) {
    document.querySelectorAll('#openerTabs .tab').forEach(t => { t.style.display = t.textContent.trim() === 'SB' ? 'inline-block' : 'none'; });
    document.querySelectorAll('#responderTabs .tab').forEach(t => { t.style.display = t.getAttribute('data-pos') === 'BB' ? 'inline-block' : 'none'; });
    apritoreSelezionato = 'SB'; responderSelezionato = 'BB';
    _setActiveTab('#openerTabs .tab', t => t.textContent.trim() === 'SB');
    _setActiveTab('#responderTabs .tab', t => t.getAttribute('data-pos') === 'BB');
  } else {
    document.querySelectorAll('#openerTabs .tab').forEach(t => {
      const pos = t.textContent.trim();
      const nascondi = (azioneSelezionata !== 'Vs 4Bet' && pos === 'BB') || (azioneSelezionata === 'Vs RFI e Flat' && (pos === 'SB' || pos === 'BB'));
      t.style.display = nascondi ? 'none' : 'inline-block';
    });
    document.querySelectorAll('#responderTabs .tab').forEach(t => { t.style.display = t.getAttribute('data-pos') ? 'inline-block' : 'none'; });
    if (apritoreSelezionato === 'BB' && azioneSelezionata !== 'Vs 4Bet') {
      apritoreSelezionato = 'BTN';
      _setActiveTab('#openerTabs .tab', t => t.textContent.trim() === 'BTN');
    }
  }

  stackButtons.forEach(btn => {
    const orig = btn.getAttribute('data-orig') || btn.textContent.trim();
    let nascondi = false;
    if (azioneSelezionata === 'Call Shove' && !['5bb','7bb','10bb','13bb','15bb','17bb','20bb','23bb','25bb'].includes(orig)) nascondi = true;
    if (['SB Limp vs BB ISO','BB vs SB Limp'].includes(azioneSelezionata) && orig === '5bb') nascondi = true;
    if (['Vs 3Bet NAI','Vs RFI','Vs RFI e Flat'].includes(azioneSelezionata) && ['5bb','7bb'].includes(orig)) nascondi = true;
    if (azioneSelezionata === 'Vs 3Bet AI' && !['10bb','13bb','15bb','17bb','20bb','23bb','25bb','32bb','36bb','40bb','50bb','60bb'].includes(orig)) nascondi = true;
    if (azioneSelezionata === 'Vs 4Bet' && ['5bb','7bb','10bb','13bb','15bb','17bb'].includes(orig)) nascondi = true;
    btn.style.display = nascondi ? 'none' : 'inline-block';
    btn.textContent = orig;
  });

  if (azioneSelezionata === 'Vs RFI e Flat') {
    flatSection.classList.add('show');
    document.querySelectorAll('.flat-tab').forEach(t => { t.style.display = t.getAttribute('data-flat-pos') === 'BB' ? 'none' : 'inline-block'; });
  } else {
    flatSection.classList.remove('show');
  }

  if (['Vs RFI', 'Call Shove'].includes(azioneSelezionata)) {
    const idxO = ORDINE_POS.indexOf(apritoreSelezionato);
    document.querySelectorAll('#responderTabs .tab').forEach(t => {
      const pos = t.getAttribute('data-pos');
      if (pos) t.style.display = ORDINE_POS.indexOf(pos) <= idxO ? 'none' : 'inline-block';
    });
    if (responderSelezionato === 'NO' || ORDINE_POS.indexOf(responderSelezionato) <= idxO) {
      responderSelezionato = ORDINE_POS.slice(idxO + 1)[0] || 'BB';
      _setActiveTab('#responderTabs .tab', t => t.getAttribute('data-pos') === responderSelezionato);
    }
  }

  if (['Vs 3Bet NAI', 'Vs 3Bet AI'].includes(azioneSelezionata)) {
    const idxO = ORDINE_POS.indexOf(apritoreSelezionato);
    document.querySelectorAll('#responderTabs .tab').forEach(t => {
      const pos = t.getAttribute('data-pos');
      if (pos) t.style.display = ORDINE_POS.indexOf(pos) <= idxO ? 'none' : 'inline-block';
    });
    if (ORDINE_POS.indexOf(responderSelezionato) <= idxO) {
      responderSelezionato = ORDINE_POS.slice(idxO + 1)[0] || 'BB';
    }
    // Evidenzia sempre il bottone corrispondente a responderSelezionato,
    // non solo quando il valore precedente era invalido — altrimenti il
    // bottone evidenziato resta "congelato" su una posizione vecchia anche
    // quando il dato/matrice caricati sono già corretti (bug: lucina disallineata).
    _setActiveTab('#responderTabs .tab', t => t.getAttribute('data-pos') === responderSelezionato);
  }

  if (azioneSelezionata === 'Vs 4Bet') {
    document.querySelectorAll('#openerTabs .tab').forEach(t => {
      const match = t.textContent.trim() === apritoreSelezionato;
      t.style.display = match ? 'inline-block' : 'none';
    });
    document.querySelectorAll('#responderTabs .tab').forEach(t => {
      const pos = t.getAttribute('data-pos');
      t.style.display = pos === responderSelezionato ? 'inline-block' : 'none';
    });
  }

  if (azioneSelezionata === 'Vs RFI e Flat') {
    const idxRFI = ORDINE_POS.indexOf(apritoreSelezionato);
    document.querySelectorAll('.flat-tab').forEach(t => {
      const pos = t.getAttribute('data-flat-pos');
      if (pos) t.style.display = ORDINE_POS.indexOf(pos) <= idxRFI ? 'none' : 'inline-block';
    });
    const idxFlat = ORDINE_POS.indexOf(flatPosizioneSelezionata);
    if (idxFlat <= idxRFI) {
      flatPosizioneSelezionata = ORDINE_POS.slice(idxRFI + 1)[0] || 'BB';
      _setActiveTab('.flat-tab', t => t.getAttribute('data-flat-pos') === flatPosizioneSelezionata);
    }
    const nuovoIdxFlat = ORDINE_POS.indexOf(flatPosizioneSelezionata);
    document.querySelectorAll('#responderTabs .tab').forEach(t => {
      const pos = t.getAttribute('data-pos');
      if (pos) t.style.display = ORDINE_POS.indexOf(pos) <= nuovoIdxFlat ? 'none' : 'inline-block';
    });
    if (responderSelezionato === 'NO' || ORDINE_POS.indexOf(responderSelezionato) <= nuovoIdxFlat) {
      responderSelezionato = ORDINE_POS.slice(nuovoIdxFlat + 1)[0] || 'BB';
      _setActiveTab('#responderTabs .tab', t => t.getAttribute('data-pos') === responderSelezionato);
    }
  }

  // Sincronizzazione universale dell'evidenziazione: eseguita sempre, dopo che
  // tutti i rami sopra hanno già deciso i valori finali di apritoreSelezionato/
  // responderSelezionato/flatPosizioneSelezionata. Elimina i bug "lucina" residui
  // (evidenziazione congelata su un valore vecchio anche quando il dato è già corretto).
  _setActiveTab('#openerTabs .tab', t => t.textContent.trim() === apritoreSelezionato);
  _setActiveTab('#responderTabs .tab', t => t.getAttribute('data-pos') === responderSelezionato);
  _setActiveTab('.flat-tab', t => t.getAttribute('data-flat-pos') === flatPosizioneSelezionata);

  let titolo;
  if (azioneSelezionata === 'RFI/OSHOVE')
    titolo = responderSelezionato === 'NO' ? `${azioneSelezionata} - ${apritoreSelezionato} - ${stackSelezionato}` : `${azioneSelezionata} - ${apritoreSelezionato} vs ${responderSelezionato} - ${stackSelezionato}`;
  else if (azioneSelezionata === 'Vs RFI e Flat')
    titolo = `${azioneSelezionata} - ${responderSelezionato} vs ${apritoreSelezionato} - Flat: ${flatPosizioneSelezionata} - ${stackSelezionato}`;
  else if (['Vs 3Bet NAI','Vs 3Bet AI','Vs 4Bet'].includes(azioneSelezionata))
    titolo = `${azioneSelezionata} - ${apritoreSelezionato} vs ${responderSelezionato} - ${stackSelezionato}`;
  else if (azioneSelezionata === 'SB Limp vs BB ISO') {
    const s = sbIsoSubMode === 'nai' ? ' - vs BB 4Bet NAI' : sbIsoSubMode === 'ai' ? ' - vs BB 4Bet AI' : '';
    titolo = `${azioneSelezionata}${s} - SB vs BB - ${stackSelezionato}`;
  } else if (azioneSelezionata === 'BB vs SB Limp') {
    const s = bbLimpSubMode === 'nai' ? ' - VS Limp 3Bet NAI' : bbLimpSubMode === 'ai' ? ' - VS Limp 3Bet AI' : '';
    titolo = `${azioneSelezionata}${s} - BB vs SB - ${stackSelezionato}`;
  } else {
    titolo = `${azioneSelezionata} - ${responderSelezionato} vs ${apritoreSelezionato} - ${stackSelezionato}`;
  }
  el('headline').textContent = titolo;

  _aggiornaSwitchButtons();
  caricaRangeCorrente();
}

const SWITCH_IDS = [
  'switchTo3BetNAI','switchTo3BetAI','switchToIso','switchTo4Bet','switchToVsRFIFlat',
  'switchToBBvsSBLimp','switchToVSLimp3BetNAI','switchToVSLimp3BetAI','switchToVsBBIsoNAI',
  'switchToVsBBIsoAI','switchBackToBaseLimp','switchBackToBaseIso','switchBackToVsRFI',
  'switchBackToRFI','switchBackToVsRFIFrom4Bet',
];

function _aggiornaSwitchButtons() {
  const sc = el('switchButtonsContainer');
  SWITCH_IDS.forEach(id => { el(id).style.display = 'none'; });
  sc.classList.remove('show');
  function show(id) { el(id).style.display = 'inline-block'; sc.classList.add('show'); }
  if (azioneSelezionata === 'RFI/OSHOVE') {
    if (!['5bb','7bb'].includes(stackSelezionato))                        show('switchTo3BetNAI');
    if (!['5bb','7bb','80bb','100bb'].includes(stackSelezionato))         show('switchTo3BetAI');
    if (apritoreSelezionato === 'SB' && stackSelezionato !== '5bb')       show('switchToIso');
  } else if (azioneSelezionata === 'Vs RFI') {
    show('switchTo4Bet'); show('switchToVsRFIFlat');
    if (apritoreSelezionato === 'SB' && responderSelezionato === 'BB') show('switchToBBvsSBLimp');
  } else if (azioneSelezionata === 'Vs RFI e Flat') { show('switchBackToVsRFI'); }
  else if (['Vs 3Bet NAI','Vs 3Bet AI'].includes(azioneSelezionata)) { show('switchBackToRFI'); }
  else if (azioneSelezionata === 'Vs 4Bet') { show('switchBackToVsRFIFrom4Bet'); }
  else if (azioneSelezionata === 'BB vs SB Limp') {
    if (bbLimpSubMode !== 'base') { show('switchBackToBaseLimp'); }
    else {
      if (!['5bb','7bb','10bb','13bb','15bb'].includes(stackSelezionato)) show('switchToVSLimp3BetNAI');
      if (!['5bb','80bb','100bb'].includes(stackSelezionato))             show('switchToVSLimp3BetAI');
    }
  } else if (azioneSelezionata === 'SB Limp vs BB ISO') {
    if (sbIsoSubMode !== 'base') { show('switchBackToBaseIso'); }
    else {
      if (!['5bb','7bb','10bb','13bb','15bb','17bb','20bb','23bb','25bb','28bb','30bb','32bb'].includes(stackSelezionato)) show('switchToVsBBIsoNAI');
      if (!['5bb','7bb','10bb','13bb','15bb','80bb','100bb'].includes(stackSelezionato))                                   show('switchToVsBBIsoAI');
    }
  }
}

function _switchAzione(nuovaAzione) {
  azioneSelezionata = nuovaAzione;
  _setActiveTab('#modeTabs .tab', t => t.textContent === nuovaAzione);
  aggiornaUI();
}

function impostaEventListener() {
  document.querySelectorAll('#openerTabs .tab').forEach(tab => {
    tab.onclick = () => { apritoreSelezionato = tab.textContent.trim(); _setActiveTab('#openerTabs .tab', t => t === tab); aggiornaUI(); };
  });
  document.querySelectorAll('#responderTabs .tab').forEach(tab => {
    tab.onclick = () => { responderSelezionato = tab.getAttribute('data-pos'); _setActiveTab('#responderTabs .tab', t => t === tab); aggiornaUI(); };
  });
  document.querySelectorAll('#modeTabs .tab').forEach(tab => {
    tab.onclick = () => {
      azioneSelezionata = tab.textContent;
      if (azioneSelezionata === 'BB vs SB Limp') bbLimpSubMode = 'base';
      if (azioneSelezionata === 'SB Limp vs BB ISO') sbIsoSubMode = 'base';
      _setActiveTab('#modeTabs .tab', t => t === tab);
      aggiornaUI();
    };
  });
  document.querySelectorAll('.flat-tab').forEach(tab => {
    tab.onclick = () => { flatPosizioneSelezionata = tab.getAttribute('data-flat-pos'); _setActiveTab('.flat-tab', t => t === tab); aggiornaUI(); };
  });
  document.querySelectorAll('.cellBtn').forEach(btn => {
    btn.onclick = () => { stackSelezionato = btn.getAttribute('data-orig') || btn.textContent.trim(); _setActiveTab('.cellBtn', b => b === btn); aggiornaUI(); };
  });

  const sw = {
    switchTo3BetNAI: () => { const idx = ORDINE_POS.indexOf(apritoreSelezionato); responderSelezionato = ORDINE_POS.slice(idx + 1)[0] || 'BB'; _switchAzione('Vs 3Bet NAI'); },
    switchTo3BetAI:  () => { const idx = ORDINE_POS.indexOf(apritoreSelezionato); responderSelezionato = ORDINE_POS.slice(idx + 1)[0] || 'BB'; _switchAzione('Vs 3Bet AI'); },
    switchToIso:     () => { sbIsoSubMode = 'base'; _switchAzione('SB Limp vs BB ISO'); },
    switchTo4Bet:    () => { const h = apritoreSelezionato, o = responderSelezionato; apritoreSelezionato = o; responderSelezionato = h; _switchAzione('Vs 4Bet'); },
    switchToVsRFIFlat: () => { const idxO = ORDINE_POS.indexOf(apritoreSelezionato), idxH = ORDINE_POS.indexOf(responderSelezionato), tra = ORDINE_POS.slice(idxO + 1, idxH); flatPosizioneSelezionata = tra.length > 0 ? tra[tra.length - 1] : ORDINE_POS[idxO + 1]; _switchAzione('Vs RFI e Flat'); },
    switchToBBvsSBLimp:     () => { bbLimpSubMode = 'base'; _switchAzione('BB vs SB Limp'); },
    switchToVSLimp3BetNAI:  () => { bbLimpSubMode = 'nai'; aggiornaUI(); },
    switchToVSLimp3BetAI:   () => { bbLimpSubMode = 'ai';  aggiornaUI(); },
    switchBackToBaseLimp:   () => { bbLimpSubMode = 'base'; aggiornaUI(); },
    switchToVsBBIsoNAI:     () => { sbIsoSubMode  = 'nai'; aggiornaUI(); },
    switchToVsBBIsoAI:      () => { sbIsoSubMode  = 'ai';  aggiornaUI(); },
    switchBackToBaseIso:    () => { sbIsoSubMode  = 'base'; aggiornaUI(); },
    switchBackToVsRFI:      () => _switchAzione('Vs RFI'),
    switchBackToRFI:        () => _switchAzione('RFI/OSHOVE'),
    switchBackToVsRFIFrom4Bet: () => { const h = apritoreSelezionato, o = responderSelezionato; apritoreSelezionato = o; responderSelezionato = h; _switchAzione('Vs RFI'); },
  };
  Object.entries(sw).forEach(([id, fn]) => { const btn = el(id); if (btn) btn.onclick = fn; });

  el('retryBtn')?.addEventListener('click', () => { el('errorBanner').style.display = 'none'; aggiornaUI(); });

  el('noteMobileToggle')?.addEventListener('click', () => {
    if (window.innerWidth >= 1024) return;
    const content = el('noteContentMobile');
    const arrow   = el('noteArrow');
    content.classList.toggle('aperto');
    arrow.textContent = content.classList.contains('aperto') ? '▲' : '▼';
  });

  el('hamburgerBtn')?.addEventListener('click', () => {
    const menu = el('hamburgerMenu');
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
  });
}

function adattaSchermo() {
  const wrap = document.querySelector('.wrap');
  if (!wrap) return;
  if (window.innerWidth >= 1024) {
    const scala = Math.min(1, window.innerWidth / 1440);
    wrap.style.transform = `scale(${scala})`;
    wrap.style.width     = '1440px';
    document.body.style.height   = wrap.offsetHeight * scala + 'px';
    document.body.style.overflow = 'hidden auto';
  } else {
    wrap.style.transform = '';
    wrap.style.width     = '';
    document.body.style.height   = '';
    document.body.style.overflow = '';
  }
}

export function avviaApp() {
  window.APP_AVVIATA = true;
  el('loadingMsg').style.display  = 'none';
  el('errorBanner').style.display = 'none';
  el('appContainer').style.display = 'block';
  creaMatrice();
  impostaEventListener();
  aggiornaUI();
  avviaPollingSessione();
  if (window.innerWidth < 1024) {
    inizializzaMobile({ aggiornaUI, stackSelezionatoRef: () => stackSelezionato });
  }
}

export function initApp() {
  window.APP_AVVIATA       = false;
  window.DISCLAIMER_CHIUSO = false;
  window.avviaApp          = avviaApp;
  window.addEventListener('resize', adattaSchermo);
  window.addEventListener('load',   adattaSchermo);
}
