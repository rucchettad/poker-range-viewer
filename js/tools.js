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

  const iframe = document.createElement('iframe');
  iframe.src = url + '?v=' + Date.now();
  iframe.style.width  = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  iframe.style.background = '#0d0f14';
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
  ];

  TOOLS.forEach(({ id, url, title }) => {
    el(id)?.addEventListener('click', () => {
      const menu = el('hamburgerMenu');
      if (menu) menu.style.display = 'none';
      apriTool(url, title);
    });
  });
  el('toolOverlayBack')?.addEventListener('click', chiudiTool);
}