/**
 * POKER RANGE VIEWER — Tools overlay module
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
'use strict';

function el(id) { return document.getElementById(id); }

export function apriTool(url, titolo) {
  const overlay = el('toolOverlay');
  const content = el('toolContent');
  const title   = el('toolOverlayTitle');
  title.textContent  = titolo;
  content.innerHTML  = '';
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Spinner mostrato finché l'iframe non ha finito di caricare
  const spinner = document.createElement('div');
  spinner.setAttribute('data-tool-spinner', '');
  spinner.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0d0f14;';
  spinner.innerHTML = '<div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.15);border-top-color:#4a9eff;border-radius:50%;animation:toolSpinRotate 0.8s linear infinite;"></div>';
  if (!document.getElementById('toolSpinnerStyle')) {
    const style = document.createElement('style');
    style.id = 'toolSpinnerStyle';
    style.textContent = '@keyframes toolSpinRotate{to{transform:rotate(360deg);}}';
    document.head.appendChild(style);
  }
  content.style.position = 'relative';
  content.appendChild(spinner);

  const iframe = document.createElement('iframe');
  iframe.src = url + '?v=' + Date.now();
  iframe.style.width  = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  iframe.style.background = '#0d0f14';
  iframe.addEventListener('load', () => spinner.remove());
  content.appendChild(iframe);
}

export function chiudiTool() {
  el('toolOverlay').style.display = 'none';
  el('toolContent').innerHTML     = '';
  document.body.style.overflow    = '';
}

export function initTools() {
  const TOOLS = [
    { id: 'toolPko',           url: 'pko_calc.html',  title: 'PKO Calculator' },
    { id: 'toolMystery',       url: 'mb_calc.html',   title: 'Mystery Bounty' },
    { id: 'toolIcm',           url: 'icm_calc.html',  title: 'ICM Final Table' },
    { id: 'toolPkoMobile',     url: 'pko_calc.html',  title: 'PKO Calculator' },
    { id: 'toolMysteryMobile', url: 'mb_calc.html',   title: 'Mystery Bounty' },
    { id: 'toolIcmMobile',     url: 'icm_calc.html',  title: 'ICM Final Table' },
    { id: 'toolMentale',       url: 'mental_calc.html', title: '🧠 Mental Game Check' },
    { id: 'toolMentaleMobile', url: 'mental_calc.html', title: '🧠 Mental Game Check' },
  ];

  TOOLS.forEach(({ id, url, title }) => {
    el(id)?.addEventListener('click', () => {
      const menu = el('hamburgerMenu');
      if (menu) menu.style.display = 'none';
      apriTool(url, title);
    });
  });
  el('toolOverlayBack')?.addEventListener('click', chiudiTool);
  initAnteprimaMentale();
}

// ===== MENTAL GAME CHECK: ANTEPRIMA =====
// Finché il tool è in prova, i bottoni compaiono solo per gli account di Danilo.
// Si legge l'email mostrata nell'header (#userEmail) e si ricontrolla a ogni cambio
// (login, logout, cambio account). Per aprirlo a tutti: ANTEPRIMA_MENTALE = false.
const ANTEPRIMA_MENTALE = true;
const EMAIL_ANTEPRIMA   = ['rucchettad@gmail.com', 'danilo.rucchetta@yahoo.it'];

function initAnteprimaMentale() {
  const emailEl = el('userEmail');
  const aggiorna = () => {
    const email = (emailEl?.textContent || '').trim().toLowerCase();
    const visibile = !ANTEPRIMA_MENTALE || EMAIL_ANTEPRIMA.some(e => email.includes(e));
    ['toolMentale', 'toolMentaleMobile'].forEach(id => {
      const b = el(id);
      if (b) b.style.display = visibile ? '' : 'none';
    });
  };
  aggiorna();
  if (emailEl) new MutationObserver(aggiorna).observe(emailEl, { childList: true, characterData: true, subtree: true });
}