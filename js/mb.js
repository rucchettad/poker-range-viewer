
(function() {
let tagliaMode = 'diretta';
const villainActive = { 2: false, 3: false };

function setTagliaMode(mode) {
  tagliaMode = mode;
  document.getElementById('mode-diretta').style.display   = mode === 'diretta'   ? '' : 'none';
  document.getElementById('mode-calcolata').style.display = mode === 'calcolata' ? '' : 'none';
  document.getElementById('btn-mode-diretta').classList.toggle('active', mode === 'diretta');
  document.getElementById('btn-mode-calcolata').classList.toggle('active', mode === 'calcolata');
}

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
  }
}

function setupBlindRadio() {
  document.getElementById('radioSB').addEventListener('change', function() {
    document.getElementById('blindSB').style.display = this.checked ? '' : 'none';
    document.getElementById('blindBB').style.display = 'none';
  });
  document.getElementById('radioBB').addEventListener('change', function() {
    document.getElementById('blindBB').style.display = this.checked ? '' : 'none';
    document.getElementById('blindSB').style.display = 'none';
  });
}

function getBlindHero() {
  if (document.getElementById('radioSB').checked) return parseFloat(document.getElementById('blindSB').value) || 0;
  if (document.getElementById('radioBB').checked) return parseFloat(document.getElementById('blindBB').value) || 0;
  return 0;
}

function v(id) { return parseFloat(document.getElementById(id).value); }
function fmt(n, dec=2) { return isNaN(n) ? '—' : n.toFixed(dec); }

function setError(id, show) { document.getElementById('f-'+id)?.classList.toggle('has-error', show); }
function clearErrors() { document.querySelectorAll('.field.has-error').forEach(f => f.classList.remove('has-error')); }

const API_URL = 'https://poker-range-api-production.up.railway.app';

function getToken() {
  return sessionStorage.getItem('poker_token') || sessionStorage.getItem('access_token') || '';
}

async function calcola() {
  clearErrors();
  let errors = false;

  const stack        = v('stack');
  const stackHero    = v('stackHero');
  const quotaMystery = v('quotaMystery');
  const risk         = isNaN(v('risk')) ? 0 : v('risk');

  if (isNaN(stack)        || stack <= 0)        { setError('stack', true); errors = true; }
  if (isNaN(stackHero)    || stackHero <= 0)    { setError('stackHero', true); errors = true; }
  if (isNaN(quotaMystery) || quotaMystery <= 0) { setError('quotaMystery', true); errors = true; }

  let totalBountiesCalc, playersLeftCalc;
  if (tagliaMode === 'diretta') {
    const bm = v('bounty-media');
    if (isNaN(bm) || bm <= 0) { setError('bounty-media', true); errors = true; }
    totalBountiesCalc = bm;
    playersLeftCalc = 1;
  } else {
    const bt = v('bounty-tot'), pl = v('players');
    if (isNaN(bt) || bt <= 0) { setError('bounty-tot', true); errors = true; }
    if (isNaN(pl) || pl < 1)  { setError('players',    true); errors = true; }
    totalBountiesCalc = bt;
    playersLeftCalc = pl;
  }

  const sv1 = v('sv1');
  if (isNaN(sv1) || sv1 <= 0) { alert('Inserisci lo stack di Villain 1.'); return; }

  const bbSbAnte   = parseFloat(document.getElementById('bbSbAnte').value) || 0;
  const altreChips = parseFloat(document.getElementById('altreChips').value) || 0;
  const blindHero  = getBlindHero();

  if (errors) return;

  const token = getToken();
  if (!token) { alert('Sessione scaduta. Effettua nuovamente il login.'); return; }

  // Costruisci array villain
  const villains = [{ stack: sv1, label: 'Villain 1' }];
  for (const n of [2, 3]) {
    if (villainActive[n]) {
      const sv = parseFloat(document.getElementById('sv' + n).value);
      if (isNaN(sv) || sv <= 0) { alert(`Compila lo stack di Villain ${n} o rimuovilo.`); return; }
      villains.push({ stack: sv, label: 'Villain ' + n });
    }
  }

  try {
    const resp = await fetch(`${API_URL}/api/mb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token,
        totalBounties: totalBountiesCalc,
        playersLeft: playersLeftCalc,
        startStack: stack,
        stackHero,
        quotaMystery,
        bbSbAnte,
        altreChips,
        blindHero,
        villains,
        riskPremium: risk / 100
      })
    });

    if (!resp.ok) {
      const err = await resp.json();
      alert(err.error || 'Errore server.');
      return;
    }

    const d = await resp.json();

    const poBase  = d.potOddsBase * 100;
    const poMod   = d.potOddsModified * 100;
    const delta   = d.bountyDiscount * 100;
    const equity  = d.finalEquity * 100;

    document.getElementById('header-equity').textContent = equity.toFixed(1) + '%';
    document.getElementById('header-sub').textContent    = risk > 0 ? 'incl. risk premium +' + risk.toFixed(1) + '%' : 'senza risk premium';
    document.getElementById('header-result').classList.add('visible');

    document.getElementById('out-po-base').textContent = poBase.toFixed(1) + '%';
    document.getElementById('out-po-mod').textContent  = poMod.toFixed(1) + '%';
    document.getElementById('out-delta').textContent   = '−' + delta.toFixed(1) + '%';
    document.getElementById('out-risk').textContent    = risk > 0 ? '+' + risk.toFixed(1) + '%' : '0% (non impostato)';
    document.getElementById('out-finale').textContent  = equity.toFixed(1) + '%';

    document.getElementById('verdict').style.display = 'none';
    document.getElementById('output').style.display = '';
    document.getElementById('empty-state').style.display = 'none';

  } catch (err) {
    console.error('[mb_calc] Errore fetch:', err);
    alert('Errore di connessione. Verifica la tua connessione e riprova.');
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Enter') calcola(); });

function toggleRpInfo() {
  const el = document.getElementById('rp-info');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function toggleQuotaInfo() {
  const el = document.getElementById('quotaMystery-info');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function toggleAltreInfo() {
  const el = document.getElementById('altre-info');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

// Expose
window.calcola = calcola;
window.toggleRpInfo = toggleRpInfo;
window.toggleQuotaInfo = toggleQuotaInfo;
window.toggleAltreInfo = toggleAltreInfo;
window.toggleVillain = toggleVillain;
window.setTagliaMode = setTagliaMode;
window.setupBlindRadio = setupBlindRadio;
})();

// ─── EVENT LISTENERS ─────────────────────────────────────
document.getElementById('btn-mode-diretta')?.addEventListener('click', () => setTagliaMode('diretta'));
document.getElementById('btn-mode-calcolata')?.addEventListener('click', () => setTagliaMode('calcolata'));
document.querySelector('.btn-calc')?.addEventListener('click', calcola);
document.getElementById('btn-quotaMystery-info')?.addEventListener('click', toggleQuotaInfo);
document.getElementById('btn-altre-info')?.addEventListener('click', toggleAltreInfo);
document.getElementById('toggle2')?.addEventListener('click', () => toggleVillain(2));
document.getElementById('toggle3')?.addEventListener('click', () => toggleVillain(3));
setupBlindRadio();
document.querySelectorAll(".section button").forEach(btn => {
  if (btn.textContent.trim() === "?" &&
      btn.id !== 'btn-quotaMystery-info' &&
      btn.id !== 'btn-altre-info') {
    btn.addEventListener("click", toggleRpInfo);
  }
});
