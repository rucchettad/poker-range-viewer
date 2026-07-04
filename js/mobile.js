/**
 * POKER RANGE VIEWER — Mobile module
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
'use strict';

function el(id) { return document.getElementById(id); }

export function inizializzaMobile({ aggiornaUI }) {
  const mc = el('mobileControls');
  if (mc) mc.style.display = 'flex';

  const mAzione           = el('mobileAzione');
  const mOpener           = el('mobileOpener');
  const mResponder        = el('mobileResponder');
  const mFlat             = el('mobileFlat');
  const mStack            = el('mobileStack');
  const mFlatControl      = el('mobileFlatControl');
  const mResponderControl = el('mobileResponderControl');
  const mOpenerLabel      = el('mobileOpenerLabel');
  const mResponderLabel   = el('mobileResponderLabel');

  function aggiornaMobileUI() {
    try {
      const azione = mAzione.value;
      const LABELS = {
        'RFI/OSHOVE':        { opener: 'RFI',          responder: 'Hero' },
        'Vs 3Bet NAI':       { opener: 'Hero',         responder: '3bettor' },
        'Vs 3Bet AI':        { opener: 'Hero',         responder: '3bettor' },
        'Vs 4Bet':           { opener: 'Hero/3Bettor', responder: '4Bettor' },
        'Call Shove':        { opener: 'Shove',        responder: 'Hero' },
        'SB Limp vs BB ISO': { opener: 'Hero',         responder: 'Villain' },
        'BB vs SB Limp':     { opener: 'Villain',      responder: 'Hero' },
      };
      const lbl = LABELS[azione] || { opener: 'RFI', responder: 'Hero' };
      mOpenerLabel.textContent   = lbl.opener;
      mResponderLabel.textContent = lbl.responder;

      mResponderControl.style.display = azione === 'RFI/OSHOVE' ? 'none' : 'flex';

      if (['SB Limp vs BB ISO', 'BB vs SB Limp'].includes(azione)) {
        mOpener.value = 'SB'; mResponder.value = 'BB';
        mOpener.disabled = true; mResponder.disabled = true;
      } else {
        mOpener.disabled = false; mResponder.disabled = false;
      }

      mFlatControl.style.display = azione === 'Vs RFI e Flat' ? 'flex' : 'none';

      Array.from(mStack.options).forEach(opt => {
        const v = opt.value;
        let nascondi = false;
        if (azione === 'Call Shove' && !['5bb','7bb','10bb','13bb','15bb','17bb','20bb','23bb','25bb'].includes(v)) nascondi = true;
        if (['SB Limp vs BB ISO','BB vs SB Limp'].includes(azione) && v === '5bb') nascondi = true;
        if (['Vs RFI','Vs RFI e Flat','BB vs SB Limp'].includes(azione) && ['5bb','7bb'].includes(v)) nascondi = true;
        if (azione === 'Vs 3Bet NAI' && ['5bb','7bb','10bb','13bb','15bb'].includes(v)) nascondi = true;
        if (azione === 'Vs 3Bet AI' && !['10bb','13bb','15bb','17bb','20bb','23bb','25bb','32bb','36bb','40bb'].includes(v)) nascondi = true;
        if (azione === 'Vs 4Bet' && ['5bb','7bb','10bb','13bb','15bb','17bb'].includes(v)) nascondi = true;
        opt.disabled = nascondi;
      });

      const modeTabAttivo = document.querySelector('#modeTabs .tab.active');
      const modeCambiato  = !modeTabAttivo || modeTabAttivo.textContent !== azione;

      if (modeCambiato) {
        _clickTab('#modeTabs .tab', t => t.textContent === azione);

        // Il cambio modalità può auto-correggere stack e/o posizioni (es. da
        // RFI/OSHOVE a 80bb -> Call Shove, dove 80bb non esiste). Sincronizza
        // i controlli mobile con lo stato desktop risultante SOLO in questo
        // caso — altrimenti, se lo facessimo ad ogni interazione, i click
        // successivi userebbero i vecchi valori del dropdown e annullerebbero
        // silenziosamente la correzione appena applicata (il tab modalità
        // viene ri-cliccato ad ogni cambio di opener/responder/stack anche
        // se la modalità resta la stessa).
        _sincronizzaControlliDaDesktop();
      }

      _clickTab('#openerTabs .tab', t => t.textContent.trim() === mOpener.value);
      if (azione !== 'RFI/OSHOVE') _clickTab('#responderTabs .tab', t => t.getAttribute('data-pos') === mResponder.value);
      _clickBtn('#stackGrid .cellBtn', b => (b.getAttribute('data-orig') || b.textContent.trim()) === mStack.value);
      if (azione === 'Vs RFI e Flat') _clickTab('.flat-tab', t => t.getAttribute('data-flat-pos') === mFlat.value);
    } catch (err) {
      console.error('[aggiornaMobileUI]', err);
    }
  }

  function _sincronizzaControlliDaDesktop() {
    const openerAttivo = document.querySelector('#openerTabs .tab.active');
    if (openerAttivo) mOpener.value = openerAttivo.textContent.trim();
    const responderAttivo = document.querySelector('#responderTabs .tab.active');
    if (responderAttivo) mResponder.value = responderAttivo.getAttribute('data-pos');
    const stackAttivo = document.querySelector('#stackGrid .cellBtn.active');
    if (stackAttivo) mStack.value = stackAttivo.getAttribute('data-orig') || stackAttivo.textContent.trim();
    const flatAttivo = document.querySelector('.flat-tab.active');
    if (flatAttivo) mFlat.value = flatAttivo.getAttribute('data-flat-pos');
  }

  [mAzione, mOpener, mResponder, mFlat, mStack].forEach(sel => {
    sel.addEventListener('change', aggiornaMobileUI);
  });
  aggiornaMobileUI();
}

function _clickTab(selector, matchFn) {
  const tab = Array.from(document.querySelectorAll(selector)).find(matchFn);
  if (tab) tab.click();
}
function _clickBtn(selector, matchFn) {
  const btn = Array.from(document.querySelectorAll(selector)).find(matchFn);
  if (btn) btn.click();
}
