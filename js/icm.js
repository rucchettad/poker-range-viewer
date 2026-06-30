/**
 * ICM FINAL TABLE CALCULATOR — Logic
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
(function () {
'use strict';

// ─── STATE ───────────────────────────────────────────────
let icmEquities = [];
let playerNames = [];
let playerStacks = [];
let prizes = [];

// ─── BUILD UI ────────────────────────────────────────────
const PRELOADED = {
  names:   ['', '', '', '', '', '', '', '', ''],
  stacks:  ['', '', '', '', '', '', '', '', ''],
  heroIdx: 8,
  prizes:  ['', '', '', '', '', '', '', '', ''],
};

// ─── LEGENDA DINAMICA ────────────────────────────────────
function aggiornaLegenda(n) {
  const positions = getPositions(n);
  const el = document.getElementById('legendaPositioni');
  if (!el) return;
  el.innerHTML = positions
    .map((pos, i) => `<span style="color:var(--accent);font-weight:700;">${i}</span> ${pos}`)
    .join(' &nbsp;·&nbsp; ');
}

// ─── IMPORTA HAND HISTORY ────────────────────────────────
function apriImportaHH() {
  document.getElementById('hhOverlay').style.display = 'flex';
  document.getElementById('hhInput').value = '';
  document.getElementById('hhError').style.display = 'none';
}

function chiudiImportaHH() {
  document.getElementById('hhOverlay').style.display = 'none';
}

function rilevaTipoHH(testo) {
  if (/Seat \d+: \S+ \(€/.test(testo)) return 'ipoker';
  if (!testo.includes('in chips)') && testo.match(/Seat \d+: .+ \( [\d,]+ \)/)) return '888';
  if (testo.includes('in chips)')) return 'pokerstars';
  return null;
}

function trovaBtnSeat(testo, tipo) {
  if (tipo === 'ipoker') {
    const m = testo.match(/Seat (\d+): .+DEALER/);
    return m ? parseInt(m[1]) : null;
  }
  if (tipo === 'pokerstars') {
    const m = testo.match(/Seat #(\d+) is the button/i) || testo.match(/Seat (\d+) is the button/i);
    return m ? parseInt(m[1]) : null;
  }
  if (tipo === '888') {
    const m = testo.match(/Seat (\d+) is the button/i);
    return m ? parseInt(m[1]) : null;
  }
  return null;
}

function estraiBlindsAnte(testo, tipo) {
  let sb = 0, bb = 0, ante = 0;
  if (tipo === 'ipoker') {
    const mB = testo.match(/Blinds:\s*(\d+)\/(\d+)/);
    if (mB) { sb = parseInt(mB[1]); bb = parseInt(mB[2]); }
    const mA = testo.match(/Ante:\s*(\d+)/);
    if (mA) ante = parseInt(mA[1]);
  } else if (tipo === 'pokerstars') {
    const mSB = testo.match(/posts small blind (\d+)/);
    const mBB = testo.match(/posts big blind (\d+)/);
    if (mSB) sb = parseInt(mSB[1]);
    if (mBB) bb = parseInt(mBB[1]);
    const mA = testo.match(/posts the ante (\d+)/);
    if (mA) ante = parseInt(mA[1]);
  } else if (tipo === '888') {
    const mB = testo.match(/([\d,]+)\/([\d,]+)\s+Blinds/);
    if (mB) { sb = parseInt(mB[1].replace(/,/g, '')); bb = parseInt(mB[2].replace(/,/g, '')); }
    const mA = testo.match(/posts ante \[([0-9,]+)\]/);
    if (mA) ante = parseInt(mA[1].replace(/,/g, ''));
  }
  return { sb, bb, ante };
}

function estraiGiocatori(testo, tipo) {
  const giocatori = [];
  let regex;
  if (tipo === 'ipoker')      regex = /Seat (\d+): (\S+) \(€([\.\d,]+) in chips\)/g;
  else if (tipo === 'pokerstars') regex = /Seat (\d+): (.+?) \((\d+) in chips\)/g;
  else if (tipo === '888')    regex = /Seat (\d+): (.+?) \( ([\d,]+) \)/g;

  let sbNick = null, bbNick = null;
  if (tipo === 'pokerstars') {
    const mSB = testo.match(/(\S+): posts small blind/);
    const mBB = testo.match(/(\S+): posts big blind/);
    if (mSB) sbNick = mSB[1];
    if (mBB) bbNick = mBB[1];
  } else if (tipo === '888') {
    const mSB = testo.match(/(\S+) posts small blind/);
    const mBB = testo.match(/(\S+) posts big blind/);
    if (mSB) sbNick = mSB[1];
    if (mBB) bbNick = mBB[1];
  } else if (tipo === 'ipoker') {
    const mSB = testo.match(/(\S+): Post SB/);
    const mBB = testo.match(/(\S+): Post BB/);
    if (mSB) sbNick = mSB[1];
    if (mBB) bbNick = mBB[1];
  }

  let m;
  while ((m = regex.exec(testo)) !== null) {
    const seat = parseInt(m[1]);
    const nick = m[2].trim();
    const stackStr = m[3].replace(/[€,]/g, '').replace(/\.00$/, '');
    const stack = parseInt(stackStr);
    if (!isNaN(stack) && stack > 0) {
      giocatori.push({ seat, nick, stack, isSB: nick === sbNick, isBB: nick === bbNick });
    }
  }
  return giocatori;
}

function importaHH() {
  const testo = document.getElementById('hhInput').value.trim();
  const errEl = document.getElementById('hhError');
  errEl.style.display = 'none';

  if (!testo) {
    errEl.textContent = '⚠ Incolla una hand history valida.';
    errEl.style.display = 'block';
    return;
  }

  const tipo = rilevaTipoHH(testo);
  if (!tipo) {
    errEl.textContent = '⚠ Formato non riconosciuto. Supportati: iPoker, PokerStars/Snai/Sisal, 888.';
    errEl.style.display = 'block';
    return;
  }

  const btnSeat = trovaBtnSeat(testo, tipo);
  if (btnSeat === null) {
    errEl.textContent = '⚠ Non riesco a trovare la posizione del dealer/button.';
    errEl.style.display = 'block';
    return;
  }

  const giocatori = estraiGiocatori(testo, tipo);
  if (giocatori.length < 2) {
    errEl.textContent = '⚠ Non riesco a trovare i giocatori. Controlla il formato.';
    errEl.style.display = 'block';
    return;
  }

  giocatori.sort((a, b) => a.seat - b.seat);
  const n = giocatori.length;

  let btnIdx = giocatori.findIndex(g => g.seat === btnSeat);
  if (btnIdx === -1) btnIdx = 0;

  const ordinati = [];
  for (let i = 0; i < n; i++) ordinati.push(giocatori[(btnIdx + i) % n]);

  document.getElementById('numPlayers').value = n;
  buildPlayersGrid();
  aggiornaLegenda(n);

  const { sb, bb, ante } = estraiBlindsAnte(testo, tipo);
  const potPreflop = sb + bb + (ante * n);

  const ordinatiConStack = ordinati.map(g => {
    let stack = g.stack;
    if (ante > 0) stack -= ante;
    if (g.isSB) stack -= sb;
    if (g.isBB) stack -= bb;
    return { ...g, stack: Math.max(0, stack) };
  });

  const nameInputs  = document.querySelectorAll('.p-name');
  const stackInputs = document.querySelectorAll('.p-stack');
  ordinatiConStack.forEach((g, i) => {
    if (nameInputs[i])  nameInputs[i].value  = g.nick;
    if (stackInputs[i]) stackInputs[i].value = g.stack;
  });

  if (potPreflop > 0) {
    const potEl = document.getElementById('potSBBBAnte');
    if (potEl) potEl.value = potPreflop;
    aggiornaPotTotale();
  }

  chiudiImportaHH();
}

// ─── PLAYERS GRID ────────────────────────────────────────
function buildPlayersGrid() {
  const n    = parseInt(document.getElementById('numPlayers').value);
  const grid = document.getElementById('playersGrid');

  const existingNames  = Array.from(grid.querySelectorAll('.p-name')).map(el => el.value);
  const existingStacks = Array.from(grid.querySelectorAll('.p-stack')).map(el => el.value);
  const currentHero    = parseInt(document.getElementById('heroSelect').value);

  const headers = Array.from(grid.children).slice(0, 4);
  grid.innerHTML = '';
  headers.forEach(h => grid.appendChild(h));

  const positions = getPositions(n);

  for (let i = 0; i < n; i++) {
    const isHero = i === currentHero;

    const seatEl = document.createElement('span');
    seatEl.className = 'player-num';
    seatEl.innerHTML = `${i}${isHero ? '<span class="hero-badge">HERO</span>' : ''}`;
    if (isHero) seatEl.style.color = 'var(--accent)';

    const posEl = document.createElement('span');
    posEl.style.cssText = 'font-size:11px;color:var(--accent);font-weight:700;cursor:pointer;';
    posEl.textContent = positions[i];

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'p-name';
    nameInput.placeholder = 'nick (opzionale)';
    nameInput.value = existingNames[i] !== undefined && existingNames[i] !== ''
      ? existingNames[i]
      : (PRELOADED.names[i] || '');
    nameInput.style.cssText = `background:${isHero ? 'rgba(200,168,75,0.08)' : 'var(--surface2)'};border:1px solid ${isHero ? 'var(--accent)' : 'var(--border)'};border-radius:6px;color:var(--text);font-size:14px;padding:7px 10px;width:100%;outline:none;`;

    const stackInput = document.createElement('input');
    stackInput.type = 'number';
    stackInput.className = 'p-stack';
    stackInput.placeholder = 'chips';
    stackInput.min = 0;
    stackInput.value = existingStacks[i] !== undefined && existingStacks[i] !== ''
      ? existingStacks[i]
      : (PRELOADED.stacks[i] || '');
    if (isHero) stackInput.style.cssText = 'background:rgba(200,168,75,0.08);border:1px solid var(--accent);border-radius:6px;';

    [seatEl, posEl].forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => setHero(i));
    });

    grid.appendChild(seatEl);
    grid.appendChild(posEl);
    grid.appendChild(nameInput);
    grid.appendChild(stackInput);
  }

  buildPrizesGrid();
  aggiornaLegenda(n);
}

function setHero(idx) {
  const names  = Array.from(document.querySelectorAll('.p-name')).map(el => el.value);
  const stacks = Array.from(document.querySelectorAll('.p-stack')).map(el => el.value);
  document.getElementById('heroSelect').value = idx;

  const n         = parseInt(document.getElementById('numPlayers').value);
  const grid      = document.getElementById('playersGrid');
  const positions = getPositions(n);
  const headers   = Array.from(grid.children).slice(0, 4);
  grid.innerHTML  = '';
  headers.forEach(h => grid.appendChild(h));

  for (let i = 0; i < n; i++) {
    const isHero = i === idx;

    const seatEl = document.createElement('span');
    seatEl.className = 'player-num';
    seatEl.innerHTML = `${i}${isHero ? '<span class="hero-badge">HERO</span>' : ''}`;
    if (isHero) seatEl.style.color = 'var(--accent)';

    const posEl = document.createElement('span');
    posEl.style.cssText = 'font-size:11px;color:var(--accent);font-weight:700;cursor:pointer;';
    posEl.textContent = positions[i];

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'p-name';
    nameInput.placeholder = 'nick (opzionale)';
    nameInput.value = names[i] || '';
    nameInput.style.cssText = `background:${isHero ? 'rgba(200,168,75,0.08)' : 'var(--surface2)'};border:1px solid ${isHero ? 'var(--accent)' : 'var(--border)'};border-radius:6px;color:var(--text);font-size:14px;padding:7px 10px;width:100%;outline:none;`;

    const stackInput = document.createElement('input');
    stackInput.type = 'number';
    stackInput.className = 'p-stack';
    stackInput.placeholder = 'chips';
    stackInput.min = 0;
    stackInput.value = stacks[i] || '';
    if (isHero) stackInput.style.cssText = 'background:rgba(200,168,75,0.08);border:1px solid var(--accent);border-radius:6px;';

    [seatEl, posEl].forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => setHero(i));
    });

    grid.appendChild(seatEl);
    grid.appendChild(posEl);
    grid.appendChild(nameInput);
    grid.appendChild(stackInput);
  }
}

function getPositions(n) {
  const all    = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'MP+1', 'HJ', 'CO'];
  if (n <= 3) return ['BTN', 'SB', 'BB'].slice(0, n);
  const middle = all.slice(3, 8);
  const needed = n - 3;
  const mid    = middle.slice(middle.length - (needed - 1));
  return ['BTN', 'SB', 'BB', ...mid, 'CO'].slice(0, n);
}

function buildHeroSelect() {}

function buildPrizesGrid() {
  const np   = parseInt(document.getElementById('numPrizes').value);
  const grid = document.getElementById('prizesGrid');

  const existingVals = [];
  grid.querySelectorAll('.p-prize').forEach(el => existingVals.push(el.value));

  const headers = Array.from(grid.children).slice(0, 3);
  grid.innerHTML = '';
  headers.forEach(h => grid.appendChild(h));

  for (let i = 0; i < np; i++) {
    const pos = document.createElement('span');
    pos.className   = 'prize-pos';
    pos.textContent = i + 1;

    const inp = document.createElement('input');
    inp.type      = 'number';
    inp.className = 'p-prize';
    inp.placeholder = '€';
    inp.min = 0;
    inp.value = existingVals[i] !== undefined && existingVals[i] !== ''
      ? existingVals[i]
      : (PRELOADED.prizes[i] || '');

    const spacer = document.createElement('span');

    grid.appendChild(pos);
    grid.appendChild(inp);
    grid.appendChild(spacer);
  }
}

// ─── CONFIG ──────────────────────────────────────────────
const API_URL = 'https://poker-range-api-production.up.railway.app';

function getToken() {
  return sessionStorage.getItem('poker_token') || sessionStorage.getItem('access_token') || '';
}

// ─── CALCULATE ───────────────────────────────────────────
async function calculate() {
  const n          = parseInt(document.getElementById('numPlayers').value);
  const stacks     = Array.from(document.querySelectorAll('.p-stack')).map(el => parseFloat(el.value) || 0);
  const prizeVals  = Array.from(document.querySelectorAll('.p-prize')).map(el => parseFloat(el.value) || 0);
  const names      = Array.from(document.querySelectorAll('.p-name')).map(el => el.value.trim() || '');
  const errEl      = document.getElementById('errorMsg');

  if (stacks.some(s => s <= 0) || prizeVals.some(p => p <= 0)) {
    errEl.textContent = '⚠ Inserisci stack e premi validi (> 0).';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const token = getToken();
  if (!token) {
    errEl.textContent = '⚠ Sessione scaduta. Effettua nuovamente il login.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const resp = await fetch(`${API_URL}/api/icm`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ access_token: token, stacks, prizes: prizeVals }),
    });

    if (!resp.ok) {
      const err = await resp.json();
      errEl.textContent = '⚠ ' + (err.error || 'Errore server.');
      errEl.style.display = 'block';
      return;
    }

    const d = await resp.json();
    playerNames  = names;
    playerStacks = stacks;
    prizes       = prizeVals;
    icmEquities  = d.equities;

    renderEquityTable();
    renderDealTable();
    buildSimSelects();

    document.getElementById('results').style.display = 'block';
    document.getElementById('simResults').style.display = 'none';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    errEl.textContent = '⚠ Errore di connessione. Riprova.';
    errEl.style.display = 'block';
  }
}

// ─── SIMULATE CALL ───────────────────────────────────────
async function simulateCall() {
  const heroIdx    = parseInt(document.getElementById('simHero').value);
  const villainIdx = parseInt(document.getElementById('simVillain').value);
  const callAmt    = parseFloat(document.getElementById('callAmount').value) || 0;
  const potAmt     = parseFloat(document.getElementById('potBetVillain').value) || 0;

  if (callAmt <= 0) { alert('Inserisci un importo di call valido.'); return; }

  const token = getToken();
  if (!token) { alert('Sessione scaduta. Effettua nuovamente il login.'); return; }

  try {
    const resp = await fetch(`${API_URL}/api/icm`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        access_token: token,
        stacks: playerStacks,
        prizes,
        simulate: { heroIdx, villainIdx, callAmt, potAmt },
      }),
    });

    if (!resp.ok) { const err = await resp.json(); alert(err.error || 'Errore server.'); return; }

    const d = await resp.json();
    const s = d.simulation;

    document.getElementById('simWinEq').textContent    = `€ ${s.eqWin.toFixed(2)}`;
    document.getElementById('simWinDelta').textContent  = `+€ ${s.gainIfWin.toFixed(2)} vs ora`;
    document.getElementById('simLoseEq').textContent   = `€ ${s.eqLose.toFixed(2)}`;
    document.getElementById('simLoseDelta').textContent = `-€ ${s.lossIfLose.toFixed(2)} vs ora`;

    document.getElementById('metricChipOdds').textContent = (s.chipOdds * 100).toFixed(1) + '%';
    document.getElementById('metricBF').textContent       = s.BF.toFixed(2) + 'x';
    document.getElementById('metricMinEq').textContent    = (s.minEqICM * 100).toFixed(1) + '%';
    document.getElementById('metricRP').textContent       = (s.riskPremium >= 0 ? '+' : '') + (s.riskPremium * 100).toFixed(1) + '%';

    document.getElementById('simResults').style.display = 'block';

  } catch (err) {
    alert('Errore di connessione. Riprova.');
  }
}

// ─── RENDER ──────────────────────────────────────────────
function playerLabel(i, name, positions, isHero) {
  const pos     = `<span style="color:var(--muted);font-size:11px;">${i}·${positions[i]}</span>`;
  const nameStr = name ? ` ${name}` : '';
  const heroTag = isHero ? '<span class="tag">HERO</span>' : '';
  return `${pos}${nameStr}${heroTag}`;
}

function renderEquityTable() {
  const heroIdx   = parseInt(document.getElementById('heroSelect').value);
  const totalChips = playerStacks.reduce((a, b) => a + b, 0);
  const positions  = getPositions(playerNames.length);

  let html = `<tr>
    <th style="text-align:left">Seat · Pos</th>
    <th>Chips</th>
    <th>% chips</th>
    <th>Equity ICM</th>
  </tr>`;

  playerNames.forEach((name, i) => {
    const chipPct = (playerStacks[i] / totalChips * 100).toFixed(1);
    const eq      = icmEquities[i].toFixed(2);
    const isHero  = i === heroIdx;
    html += `<tr class="${isHero ? 'hero-row' : ''}">
      <td>${playerLabel(i, name, positions, isHero)}</td>
      <td>${playerStacks[i].toLocaleString('it-IT')}</td>
      <td>${chipPct}%</td>
      <td class="equity-val">€ ${eq}</td>
    </tr>`;
  });

  document.getElementById('equityTable').innerHTML = html;
}

function renderDealTable() {
  const heroIdx    = parseInt(document.getElementById('heroSelect').value);
  const totalPrize = prizes.reduce((a, b) => a + b, 0);
  const totalChips = playerStacks.reduce((a, b) => a + b, 0);
  const n          = playerNames.length;
  const equalChop  = totalPrize / n;
  const positions  = getPositions(n);
  const minPrize   = prizes[prizes.length - 1];
  const prizePool  = totalPrize - minPrize * n;

  let html = `<tr>
    <th style="text-align:left">Seat · Pos</th>
    <th style="color:var(--accent)">ICM Deal</th>
    <th style="color:var(--accent2)">Chip Chop</th>
    <th style="color:#a084e8">Equal Chop</th>
  </tr>`;

  playerNames.forEach((name, i) => {
    const icmEq   = icmEquities[i];
    const chipChop = minPrize + (playerStacks[i] / totalChips) * prizePool;
    const isHero  = i === heroIdx;

    const diffChip      = chipChop - icmEq;
    const diffChipStr   = (diffChip >= 0 ? '+' : '') + '€' + diffChip.toFixed(0);
    const diffChipColor = diffChip >= 0 ? 'var(--accent2)' : 'var(--danger)';

    const diffEqual      = equalChop - icmEq;
    const diffEqualStr   = (diffEqual >= 0 ? '+' : '') + '€' + diffEqual.toFixed(0);
    const diffEqualColor = diffEqual >= 0 ? 'var(--accent2)' : 'var(--danger)';

    html += `<tr class="${isHero ? 'hero-row' : ''}">
      <td>${playerLabel(i, name, positions, isHero)}</td>
      <td class="equity-val" style="color:var(--accent)">€ ${icmEq.toFixed(2)}</td>
      <td>€ ${chipChop.toFixed(2)} <span style="font-size:10px;color:${diffChipColor}">${diffChipStr}</span></td>
      <td>€ ${equalChop.toFixed(2)} <span style="font-size:10px;color:${diffEqualColor}">${diffEqualStr}</span></td>
    </tr>`;
  });

  html += `<tr style="border-top:1px solid var(--border);">
    <td style="color:var(--muted);font-size:11px;">Totale</td>
    <td style="color:var(--muted);">€ ${totalPrize.toFixed(2)}</td>
    <td style="color:var(--muted);">€ ${totalPrize.toFixed(2)}</td>
    <td style="color:var(--muted);">€ ${totalPrize.toFixed(2)}</td>
  </tr>`;

  document.getElementById('dealTable').innerHTML = html;
}

// ─── HELPERS ─────────────────────────────────────────────
function bloccaPuntoVirgola(e) {
  if (e.key === '.' || e.key === ',') return false;
  return true;
}

function aggiornaPotTotale() {
  const heroIdx    = parseInt(document.getElementById('simHero').value);
  const villainIdx = parseInt(document.getElementById('simVillain').value);
  if (isNaN(heroIdx) || isNaN(villainIdx)) return;
  if (!playerStacks[heroIdx] || !playerStacks[villainIdx]) return;
  const minStack = Math.min(playerStacks[heroIdx], playerStacks[villainIdx]);
  document.getElementById('callAmount').value = minStack;
  const sbbbante = parseFloat(document.getElementById('potSBBBAnte').value) || 0;
  document.getElementById('potBetVillain').value = (minStack * 2) + sbbbante;
}

function onHeroChange() {
  updateSimVillain();
  aggiornaPotTotale();
}

function buildSimSelects() {
  const heroSel   = document.getElementById('simHero');
  const heroIdx   = parseInt(document.getElementById('heroSelect').value);
  const positions = getPositions(playerNames.length);

  heroSel.innerHTML = '';
  playerNames.forEach((name, i) => {
    const stack = playerStacks[i] ? ` [${playerStacks[i].toLocaleString('it-IT')}]` : '';
    const opt   = document.createElement('option');
    opt.value       = i;
    opt.textContent = name
      ? `${i}·${positions[i]} · ${name}${stack}`
      : `${i}·${positions[i]}${stack}`;
    heroSel.appendChild(opt);
  });
  heroSel.value = heroIdx;

  updateSimVillain();
  aggiornaPotTotale();
}

function updateSimVillain() {
  const heroSel    = document.getElementById('simHero');
  const villainSel = document.getElementById('simVillain');
  const heroIdx    = parseInt(heroSel.value);
  const positions  = getPositions(playerNames.length);

  villainSel.innerHTML = '';
  playerNames.forEach((name, i) => {
    if (i === heroIdx) return;
    const stack = playerStacks[i] ? ` [${playerStacks[i].toLocaleString('it-IT')}]` : '';
    const opt   = document.createElement('option');
    opt.value       = i;
    opt.textContent = name
      ? `${i}·${positions[i]} · ${name}${stack}`
      : `${i}·${positions[i]}${stack}`;
    villainSel.appendChild(opt);
  });
}

// ─── RESET ───────────────────────────────────────────────
function resetAll() {
  document.querySelectorAll('.p-name').forEach(el  => (el.value  = ''));
  document.querySelectorAll('.p-stack').forEach(el => (el.value = ''));
  document.querySelectorAll('.p-prize').forEach(el => (el.value = ''));
  document.getElementById('callAmount').value    = '';
  document.getElementById('potSBBBAnte').value   = '';
  document.getElementById('potBetVillain').value = '';
  document.getElementById('results').style.display    = 'none';
  document.getElementById('simResults').style.display = 'none';
  document.getElementById('errorMsg').style.display   = 'none';
}

// ─── INIT ─────────────────────────────────────────────────
setTimeout(() => { buildPlayersGrid(); aggiornaLegenda(9); }, 100);

// ─── EXPOSE PUBLIC FUNCTIONS ──────────────────────────────
window.buildPlayersGrid  = buildPlayersGrid;
window.apriImportaHH    = apriImportaHH;
window.chiudiImportaHH  = chiudiImportaHH;
window.importaHH        = importaHH;
window.setHero          = setHero;
window.buildHeroSelect  = buildHeroSelect;
window.buildPrizesGrid  = buildPrizesGrid;
window.calculate        = calculate;
window.simulateCall     = simulateCall;
window.updateSimVillain = updateSimVillain;
window.onHeroChange     = onHeroChange;
window.aggiornaPotTotale = aggiornaPotTotale;
window.bloccaPuntoVirgola = bloccaPuntoVirgola;
window.buildSimSelects  = buildSimSelects;
window.resetAll         = resetAll;


// ─── EVENT LISTENERS ─────────────────────────────────────
document.getElementById('numPlayers')?.addEventListener('change', buildPlayersGrid);
document.getElementById('numPrizes')?.addEventListener('change', buildPrizesGrid);
document.getElementById('simHero')?.addEventListener('change', onHeroChange);
document.getElementById('simVillain')?.addEventListener('change', aggiornaPotTotale);
document.getElementById('callAmount')?.addEventListener('input', aggiornaPotTotale);
document.getElementById('callAmount')?.addEventListener('keydown', e => { bloccaPuntoVirgola(e); });
document.getElementById('potSBBBAnte')?.addEventListener('input', aggiornaPotTotale);
document.getElementById('potSBBBAnte')?.addEventListener('keydown', e => { bloccaPuntoVirgola(e); });
document.getElementById('potBetVillain')?.addEventListener('input', aggiornaPotTotale);
document.getElementById('potBetVillain')?.addEventListener('keydown', e => { bloccaPuntoVirgola(e); });

document.querySelector('button[class="btn btn-primary"]')?.addEventListener('click', calculate);
document.querySelector('button[class="btn btn-secondary"]')?.addEventListener('click', resetAll);

// Bottoni con testo specifico
document.querySelectorAll('button').forEach(btn => {
  if (btn.textContent.trim() === '📋 Importa Hand History') btn.addEventListener('click', apriImportaHH);
  if (btn.textContent.trim() === 'Importa') btn.addEventListener('click', importaHH);
  if (btn.textContent.trim() === 'Annulla') btn.addEventListener('click', chiudiImportaHH);
  if (btn.textContent.trim() === 'Simula Call') btn.addEventListener('click', simulateCall);
});

})();
