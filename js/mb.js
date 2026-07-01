
(function() {
let tagliaMode = 'diretta';

function setTagliaMode(mode) {
  tagliaMode = mode;
  document.getElementById('mode-diretta').style.display   = mode === 'diretta'   ? '' : 'none';
  document.getElementById('mode-calcolata').style.display = mode === 'calcolata' ? '' : 'none';
  document.getElementById('btn-mode-diretta').classList.toggle('active', mode === 'diretta');
  document.getElementById('btn-mode-calcolata').classList.toggle('active', mode === 'calcolata');
}


function v(id) { return parseFloat(document.getElementById(id).value); }
function fmt(n, dec=2) { return isNaN(n) ? '—' : n.toFixed(dec); }
function fmtChips(n) {
  if (isNaN(n)) return '—';
  if (n >= 1000000) return (n/1000000).toFixed(3) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function setError(id, show) { document.getElementById('f-'+id)?.classList.toggle('has-error', show); }
function clearErrors() { document.querySelectorAll('.field.has-error').forEach(f => f.classList.remove('has-error')); }

const API_URL = 'https://poker-range-api-production.up.railway.app';

function getToken() {
  return sessionStorage.getItem('poker_token') || sessionStorage.getItem('access_token') || '';
}

async function calcola() {
  clearErrors();
  let errors = false;

  const stack = v('stack');
  const buyin = v('buyin');
  const risk  = isNaN(v('risk')) ? 0 : v('risk');

  if (isNaN(stack) || stack <= 0) { setError('stack', true); errors = true; }
  if (isNaN(buyin) || buyin <= 0) { setError('buyin', true); errors = true; }

  let totalBountiesCalc, playersLeftCalc;
  if (tagliaMode === 'diretta') {
    const bm = v('bounty-media');
    if (isNaN(bm) || bm <= 0) { setError('bounty-media', true); errors = true; }
    totalBountiesCalc = bm; // verrà passato come avgBounty direttamente
    playersLeftCalc = 1;    // avgBounty = totalBounties / playersLeft → se pl=1, avg=bm
  } else {
    const bt = v('bounty-tot'), pl = v('players');
    if (isNaN(bt) || bt <= 0) { setError('bounty-tot', true); errors = true; }
    if (isNaN(pl) || pl < 1)  { setError('players',    true); errors = true; }
    totalBountiesCalc = bt;
    playersLeftCalc = pl;
  }

  const potInput  = v('pot');
  const callInput = v('call');
  if (isNaN(potInput)  || potInput < 0)   { setError('pot',  true); errors = true; }
  if (isNaN(callInput) || callInput <= 0) { setError('call', true); errors = true; }

  if (errors) return;

  const token = getToken();
  if (!token) {
    alert('Sessione scaduta. Effettua nuovamente il login.');
    return;
  }

  try {
    const resp = await fetch(`${API_URL}/api/mb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: token,
        call: callInput,
        pot: potInput,
        totalBounties: totalBountiesCalc,
        playersLeft: playersLeftCalc,
        startStack: stack,
        buyIn: buyin,
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

function toggleBuyinInfo() {
  const el = document.getElementById('buyin-info');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function togglePotInfo() {
  const el = document.getElementById('pot-info');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function toggleCallInfo() {
  const el = document.getElementById('call-info');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

// Expose public functions
window.calcola = calcola;
window.toggleRpInfo = toggleRpInfo;
window.toggleBuyinInfo = toggleBuyinInfo;
window.togglePotInfo = togglePotInfo;
window.toggleCallInfo = toggleCallInfo;
window.setTagliaMode = setTagliaMode;
})();


// ─── EVENT LISTENERS ─────────────────────────────────────
document.getElementById('btn-mode-diretta')?.addEventListener('click', () => setTagliaMode('diretta'));
document.getElementById('btn-mode-calcolata')?.addEventListener('click', () => setTagliaMode('calcolata'));
document.querySelector('.btn-calc')?.addEventListener('click', calcola);
document.getElementById('btn-buyin-info')?.addEventListener('click', toggleBuyinInfo);
document.getElementById('btn-pot-info')?.addEventListener('click', togglePotInfo);
document.getElementById('btn-call-info')?.addEventListener('click', toggleCallInfo);
document.querySelectorAll(".section button").forEach(btn => {
  if (btn.textContent.trim() === "?" && btn.id !== 'btn-buyin-info') btn.addEventListener("click", toggleRpInfo);
});
