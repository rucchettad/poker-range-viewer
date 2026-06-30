
(function() {
const BF_TABLE = [
  {bf:0.3,d:1.0},{bf:0.4,d:1.7},{bf:0.5,d:3.0},{bf:0.75,d:4.2},
  {bf:1.0,d:5.4},{bf:1.25,d:6.2},{bf:1.5,d:7.4},{bf:1.75,d:8.5},
  {bf:2.0,d:9.4},{bf:2.5,d:11.1},{bf:3.0,d:12.7},{bf:4.0,d:15.5},
  {bf:5.0,d:17.5},{bf:10.0,d:25.0},{bf:20.0,d:32.0},{bf:50.0,d:40.0},{bf:100.0,d:50.0}
];

const villainActive = { 2: false, 3: false };

function toggleVillain(n) {
  villainActive[n] = !villainActive[n];
  const fields = document.getElementById('fields' + n);
  const btn = document.getElementById('toggle' + n);
  if (villainActive[n]) {
    fields.classList.add('show');
    btn.textContent = '− Rimuovi';
    btn.classList.add('active');
  } else {
    fields.classList.remove('show');
    btn.textContent = '+ Aggiungi';
    btn.classList.remove('active');
    document.getElementById('sv' + n).value = '';
    document.getElementById('bv' + n).value = '';
  }
}

function getClosest(bf) {
  let c = BF_TABLE[0], min = Math.abs(bf - BF_TABLE[0].bf);
  for (const r of BF_TABLE) { const d = Math.abs(bf - r.bf); if (d < min) { min = d; c = r; } }
  return c;
}

function fmt(n) { return n.toLocaleString('it-IT'); }

const API_URL = 'https://poker-range-api-production.up.railway.app';

function getToken() {
  return sessionStorage.getItem('poker_token') || sessionStorage.getItem('access_token') || '';
}

async function calcola() {
  const buyin         = parseFloat(document.getElementById('buyin').value);
  const taglia        = parseFloat(document.getElementById('taglia').value);
  const stackIniziale = parseFloat(document.getElementById('stackIniziale').value);
  const stackHero     = parseFloat(document.getElementById('stackHero').value);
  const bbSbAnte      = parseFloat(document.getElementById('bbSbAnte').value) || 0;
  const altreChips    = parseFloat(document.getElementById('altreChips').value) || 0;
  const potAttuale    = bbSbAnte + altreChips;
  const sv1           = parseFloat(document.getElementById('sv1').value);
  const bv1           = parseFloat(document.getElementById('bv1').value);

  if ([buyin, taglia, stackIniziale, stackHero, sv1, bv1].some(isNaN)) {
    alert('Compila tutti i campi obbligatori.'); return;
  }
  if (bbSbAnte === 0 && altreChips === 0) {
    alert('Inserisci almeno BB+SB+ANTE.'); return;
  }

  const villains = [{ stack: sv1, bounty: bv1, label: 'Villain 1' }];
  for (const n of [2, 3]) {
    if (villainActive[n]) {
      const sv = parseFloat(document.getElementById('sv' + n).value);
      const bv = parseFloat(document.getElementById('bv' + n).value);
      if (isNaN(sv) || isNaN(bv)) { alert(`Compila i dati di Villain ${n} o rimuovilo.`); return; }
      villains.push({ stack: sv, bounty: bv, label: 'Villain ' + n });
    }
  }

  const token = getToken();
  if (!token) {
    alert('Sessione scaduta. Effettua nuovamente il login.');
    return;
  }

  try {
    const resp = await fetch(`${API_URL}/api/pko`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token, buyin, taglia, stackIniziale, stackHero, potAttuale, villains })
    });

    if (!resp.ok) {
      const err = await resp.json();
      alert(err.error || 'Errore server.');
      return;
    }

    const d = await resp.json();

    // Coverage info
    let covHtml = '';
    for (const v of d.coperti)    covHtml += `<span class="ok">✓</span> ${v.label}: ${fmt(v.stack)} chips — bounty ${v.bounty.toFixed(2)}€ <span class="ok">(coperto)</span><br>`;
    for (const v of d.nonCoperti) covHtml += `<span class="no">✗</span> ${v.label}: ${fmt(v.stack)} chips — bounty ${v.bounty.toFixed(2)}€ <span class="no">(non coperto, escluso dal calcolo)</span><br>`;
    document.getElementById('coverageInfo').innerHTML = covHtml;

    // Risultati
    document.getElementById('rCallEff').textContent   = fmt(d.callEff) + ' chips';
    document.getElementById('rPotTot').textContent    = fmt(d.potTot) + ' chips';
    document.getElementById('rBountyTot').textContent = d.bountyTot.toFixed(2) + '€';
    document.getElementById('rNTaglie').textContent   = d.nTaglie.toFixed(2);
    document.getElementById('rNStack').textContent    = d.nStack.toFixed(2);
    document.getElementById('rBF').textContent        = d.bFactor.toFixed(2);
    document.getElementById('rPO').textContent        = d.potOdds.toFixed(1) + '%';
    document.getElementById('rDiscount').textContent  = '-' + d.closest.d.toFixed(1) + '%';
    document.getElementById('rPOAdj').textContent     = d.potOddsAdj.toFixed(1) + '%';

    // Tabella completa
    const tbody = document.getElementById('bfBody');
    tbody.innerHTML = '';
    for (const row of d.bfTableOut) {
      const tr = document.createElement('tr');
      if (row.isActive) tr.className = 'active-row';
      tr.innerHTML = `
        <td>${row.bf.toString().replace('.', ',')}${row.isActive ? '<span class="tag-bf">↑ tu</span>' : ''}</td>
        <td>${row.d.toString().replace('.', ',')}%</td>
        <td>${row.potOddsAdj.toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    }

    document.getElementById('risultati').classList.add('show');

  } catch (err) {
    console.error('[pko_calc] Errore fetch:', err);
    alert('Errore di connessione. Verifica la tua connessione e riprova.');
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') calcola(); });

// Expose public functions
window.toggleVillain = toggleVillain;
window.calcola = calcola;
})();


// ─── EVENT LISTENERS ─────────────────────────────────────
document.getElementById('toggle2')?.addEventListener('click', () => toggleVillain(2));
document.getElementById('toggle3')?.addEventListener('click', () => toggleVillain(3));
document.querySelector('.calc-btn')?.addEventListener('click', calcola);
