/**
 * POKER RANGE VIEWER — Sfondo delle schermate di accesso e registrazione
 * © 2026 pokerrange.online - Danilo Rucchetta
 *
 * Solo decorazione: semi del poker neon (a sinistra), pile di fiches in salita
 * con le tappe del percorso, frase in alto a destra, foto in basso a destra.
 * Visibile solo quando è aperta la schermata di accesso o di registrazione;
 * altrimenti l'animazione si ferma. Con "riduci animazioni" resta tutto fermo.
 */
'use strict';

const SCHERMATE = ['loginScreen', 'registrazioneScreen'];
const COLORI    = ['80,200,255', '150,110,255'];        // azzurro, viola
const SEMI      = ['\u2660', '\u2665', '\u2666', '\u2663'];
const TAPPE     = ['Decisione', 'Disciplina', 'Costanza', 'Risultati', 'Identità', 'Libertà'];
const ALTEZZE   = [3, 5, 7, 10, 13, 17];                // fiches per pila
const FERMO     = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const rnd = (a, b) => a + Math.random() * (b - a);

// ===== STRUTTURA =====
function creaSfondo() {
  const bg = document.createElement('div');
  bg.id = 'authBg';
  bg.className = 'auth-bg';
  bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = `
    <div class="auth-left">
      <canvas class="auth-canvas"></canvas>
      <div class="auth-stacks">${svgPile()}</div>
    </div>
    <img class="auth-photo" src="img/sala-poker.webp" alt="" decoding="async" loading="lazy">
    <p class="auth-quote">
      <span class="q1">Il flop, il turn e il river sono i capitoli.</span>
      <span class="q2">Il <b>preflop</b> è la trama che li tiene insieme.</span>
    </p>`;
  document.body.prepend(bg);

  const brand = document.createElement('a');
  brand.id = 'authBrand';
  brand.className = 'auth-brand';
  brand.href = 'https://mindsetdisciplinelab.com/';
  brand.target = '_blank';
  brand.rel = 'noopener';
  brand.innerHTML = 'Mindset <span class="amp">&amp;</span> Discipline Lab';
  document.body.prepend(brand);

  return { bg, brand, canvas: bg.querySelector('.auth-canvas') };
}

// Pile di fiches a contorno (SVG), con il nome della tappa sopra ognuna
function svgPile() {
  const GAP = 56, X0 = 30, BASE = 210, PASSO = 8, RX = 21, RY = 7, SP = 6;
  let out = '';
  ALTEZZE.forEach((n, i) => {
    const cx = X0 + i * GAP;
    const colGruppo = `pila${i}`;
    let chips = '';
    for (let j = 0; j < n; j++) {
      const c = COLORI[(i + j) % 2];
      const cy = BASE - j * PASSO;
      const a = (0.30 + 0.25 * (j / Math.max(1, n - 1))).toFixed(2);
      const ritardo = (i * 0.35 + j * 0.05).toFixed(2);
      chips += `<g class="chip" style="animation-delay:${ritardo}s" stroke="rgba(${c},${a})">
        <path d="M${cx - RX},${cy} v${SP} a${RX},${RY} 0 0 0 ${2 * RX},0 v-${SP}"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${RX}" ry="${RY}"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${RX * 0.72}" ry="${RY * 0.72}" stroke-dasharray="4 4"/>
      </g>`;
    }
    const top = BASE - (n - 1) * PASSO - 16;
    const cl = COLORI[i % 2];
    const ritLabel = (i * 0.35 + n * 0.05 + 0.2).toFixed(2);
    out += `<g class="${colGruppo}">${chips}
      <text class="tappa" x="${cx}" y="${top}" fill="rgba(${cl},${(0.45 + i * 0.07).toFixed(2)})" style="animation-delay:${ritLabel}s">${TAPPE[i]}</text>
    </g>`;
  });
  return `<svg viewBox="0 0 350 230" fill="none" stroke-width="1.4">${out}</svg>`;
}

// ===== SEMI NEON (canvas) =====
function avviaSemi(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, semi = [], bolle = [], raf = 0, attivo = false;

  function dimensiona() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(190, Math.round((W * H) / 11000));
    semi = Array.from({ length: n }, () => ({
      x: rnd(0, W), y: rnd(0, H), s: rnd(10, 46), c: COLORI[Math.random() < 0.5 ? 0 : 1],
      t: SEMI[Math.floor(rnd(0, 4))], a: rnd(0.18, 0.47), v: rnd(6, 14), rot: rnd(-0.3, 0.3),
      vr: rnd(-0.08, 0.08), p: rnd(0, 6.28), vp: rnd(0.6, 1.4),
    }));
    bolle = Array.from({ length: 16 }, () => ({
      x: rnd(0, W), y: rnd(0, H), r: rnd(30, 90), c: COLORI[Math.random() < 0.5 ? 0 : 1], a: rnd(0.05, 0.12),
    }));
    if (FERMO) disegna(0);
  }

  let ultimo = 0;
  function disegna(dt) {
    ctx.clearRect(0, 0, W, H);
    for (const b of bolle) {
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(${b.c},${b.a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3); ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of semi) {
      if (!FERMO) {
        s.y -= s.v * dt; s.rot += s.vr * dt; s.p += s.vp * dt;
        if (s.y < -50) { s.y = H + 50; s.x = rnd(0, W); }
      }
      const alpha = s.a * (0.75 + 0.25 * Math.sin(s.p));
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.font = `${s.s}px sans-serif`;
      ctx.lineWidth = Math.max(1, s.s / 18);
      ctx.strokeStyle = `rgba(${s.c},${alpha.toFixed(3)})`;
      ctx.shadowColor = `rgba(${s.c},${(alpha * 0.9).toFixed(3)})`;
      ctx.shadowBlur = 8;
      ctx.strokeText(s.t, 0, 0);
      ctx.restore();
    }
  }

  function ciclo(t) {
    const dt = ultimo ? Math.min(0.05, (t - ultimo) / 1000) : 0;
    ultimo = t;
    disegna(dt);
    raf = requestAnimationFrame(ciclo);
  }

  window.addEventListener('resize', () => { if (attivo) dimensiona(); });

  return {
    avvia() {
      if (attivo) return;
      attivo = true; dimensiona();
      if (!FERMO) { ultimo = 0; raf = requestAnimationFrame(ciclo); }
    },
    ferma() { attivo = false; cancelAnimationFrame(raf); },
  };
}

// ===== VISIBILITÀ =====
function init() {
  const { bg, brand, canvas } = creaSfondo();
  const semi = avviaSemi(canvas);
  const schermate = SCHERMATE.map(id => document.getElementById(id)).filter(Boolean);

  function aggiorna() {
    const visibile = schermate.some(s => s.style.display && s.style.display !== 'none');
    bg.style.display = visibile ? 'block' : 'none';
    brand.style.display = visibile ? 'block' : 'none';
    if (visibile) semi.avvia(); else semi.ferma();
  }

  const osserva = new MutationObserver(aggiorna);
  schermate.forEach(s => osserva.observe(s, { attributes: true, attributeFilter: ['style'] }));
  aggiorna();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
