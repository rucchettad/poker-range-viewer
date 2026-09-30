/**
 * POKER RANGE VIEWER — Sfondo delle schermate di accesso e registrazione
 * © 2026 pokerrange.online - Danilo Rucchetta
 *
 * Solo decorazione: semi del poker neon (a sinistra), pile di fiches in salita
 * con le tappe del percorso, frase in alto a destra, foto in basso a destra.
 * Le pile si formano in sequenza da sinistra, una fiche alla volta; a pila completa
 * compare la sua tappa. Finita l'ultima, pausa di 2 secondi e l'animazione riparte.
 * Visibile solo quando è aperta la schermata di accesso o di registrazione;
 * altrimenti l'animazione si ferma. Con "riduci animazioni" resta tutto fermo.
 */
'use strict';

const SCHERMATE = ['loginScreen', 'registrazioneScreen'];
const COLORI    = ['80,200,255', '150,110,255'];        // azzurro, viola
// Semi disegnati come forme (non come caratteri): su telefoni e tablet i caratteri
// ♠♥♦♣ diventano emoji rosse e nere, piene e più grandi, ignorando i nostri colori.
const SEMI = (() => {
  const cuori = new Path2D();
  cuori.moveTo(0, 0.38);
  cuori.bezierCurveTo(-0.55, 0.02, -0.45, -0.48, 0, -0.18);
  cuori.bezierCurveTo(0.45, -0.48, 0.55, 0.02, 0, 0.38);
  const quadri = new Path2D();
  quadri.moveTo(0, -0.48); quadri.lineTo(0.34, 0); quadri.lineTo(0, 0.48); quadri.lineTo(-0.34, 0); quadri.closePath();
  const picche = new Path2D();
  picche.moveTo(0, -0.46);
  picche.bezierCurveTo(-0.55, -0.08, -0.42, 0.34, 0, 0.14);
  picche.bezierCurveTo(0.42, 0.34, 0.55, -0.08, 0, -0.46);
  picche.moveTo(0, 0.14); picche.lineTo(-0.13, 0.46); picche.lineTo(0.13, 0.46); picche.closePath();
  const fiori = new Path2D();
  [[0, -0.22], [-0.21, 0.07], [0.21, 0.07]].forEach(([x, y]) => { fiori.moveTo(x + 0.18, y); fiori.arc(x, y, 0.18, 0, Math.PI * 2); });
  fiori.moveTo(0, 0.07); fiori.lineTo(-0.12, 0.46); fiori.lineTo(0.12, 0.46); fiori.closePath();
  return [picche, cuori, quadri, fiori];
})();
const TAPPE     = ['Decisione', 'Disciplina', 'Costanza', 'Risultati', 'Identità', 'Libertà'];
const ALTEZZE   = [3, 5, 7, 10, 13, 17];                // fiches per pila
const FERMO     = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tempi della sequenza delle pile (secondi)
const T_CHIP   = 0.09;   // tra una fiche e la successiva
const T_PRIMA  = 0.15;   // tra l'ultima fiche di una pila e la sua scritta
const T_DOPO   = 0.35;   // tra la scritta e la prima fiche della pila successiva
const T_FERMA  = 2;      // pausa a pile complete prima di ricominciare
const T_SVUOTA = 0.4;    // dissolvenza prima di ricominciare

// Animazioni delle pile (qui e non in style.css, così basta questo file)
function aggiungiStilePile() {
  if (document.getElementById('authPileStile')) return;
  const st = document.createElement('style');
  st.id = 'authPileStile';
  st.textContent =
    '@keyframes authChipCade{from{opacity:0;transform:translateY(-28px)}to{opacity:1;transform:none}}' +
    '@keyframes authTappaSale{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '.auth-stacks svg{transition:opacity ' + T_SVUOTA + 's ease}' +
    '.auth-stacks svg.svuota{opacity:0}' +
    // Telefono e tablet: stessa intensità dei simboli del desktop (style.css li rendeva più tenui)
    '@media (max-width:1023px){.auth-left{opacity:1 !important}}';
  document.head.appendChild(st);
}

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
      <div class="auth-stacks"></div>
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

  return { bg, brand, canvas: bg.querySelector('.auth-canvas'), pileBox: bg.querySelector('.auth-stacks') };
}

// Pile di fiches a contorno (SVG), con il nome della tappa sopra ognuna.
// Restituisce l'SVG e la durata totale della sequenza (secondi).
function svgPile() {
  const GAP = 56, X0 = 30, BASE = 210, PASSO = 8, RX = 21, RY = 7, SP = 6;
  const anim = (nome, durata, curva, ritardo) =>
    FERMO ? '' : `animation:${nome} ${durata}s ${curva} ${ritardo.toFixed(2)}s both;`;
  let out = '', t = 0;
  ALTEZZE.forEach((n, i) => {
    const cx = X0 + i * GAP;
    let chips = '';
    for (let j = 0; j < n; j++) {
      const c = COLORI[(i + j) % 2];
      const cy = BASE - j * PASSO;
      const a = (0.30 + 0.25 * (j / Math.max(1, n - 1))).toFixed(2);
      chips += `<g class="chip" style="${anim('authChipCade', 0.38, 'cubic-bezier(.2,.9,.3,1.15)', t)}" stroke="rgba(${c},${a})">
        <path d="M${cx - RX},${cy} v${SP} a${RX},${RY} 0 0 0 ${2 * RX},0 v-${SP}"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${RX}" ry="${RY}"/>
        <ellipse cx="${cx}" cy="${cy}" rx="${RX * 0.72}" ry="${RY * 0.72}" stroke-dasharray="4 4"/>
      </g>`;
      t += T_CHIP;
    }
    t += T_PRIMA;
    const top = BASE - (n - 1) * PASSO - 16;
    const cl = COLORI[i % 2];
    out += `<g class="pila${i}">${chips}
      <text class="tappa" x="${cx}" y="${top}" fill="rgba(${cl},${(0.45 + i * 0.07).toFixed(2)})" style="${anim('authTappaSale', 0.55, 'ease-out', t)}">${TAPPE[i]}</text>
    </g>`;
    t += T_DOPO;
  });
  return { html: `<svg viewBox="0 0 350 230" fill="none" stroke-width="1.4">${out}</svg>`, durata: t };
}

// Ciclo delle pile: disegna, aspetta la fine + 2 secondi, dissolve e ricomincia.
// Gira solo mentre la schermata di accesso o registrazione è visibile.
function avviaPile(contenitore) {
  let timer = 0, attivo = false;

  function giro() {
    const { html, durata } = svgPile();
    contenitore.innerHTML = html;
    if (FERMO) return; // "riduci animazioni": pile ferme e complete, nessun ciclo
    timer = setTimeout(() => {
      contenitore.querySelector('svg')?.classList.add('svuota');
      timer = setTimeout(giro, T_SVUOTA * 1000);
    }, (durata + T_FERMA) * 1000);
  }

  return {
    avvia() { if (attivo) return; attivo = true; giro(); },
    ferma() { attivo = false; clearTimeout(timer); },
  };
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
    // Su schermi stretti (telefono, tablet) tutto in proporzione, così appare come su desktop
    const scala = Math.min(1, Math.max(0.5, W / 1280));
    const n = Math.min(190, Math.round((W * H) / (11000 * scala)));
    semi = Array.from({ length: n }, () => ({
      x: rnd(0, W), y: rnd(0, H), s: rnd(10, 46) * scala, c: COLORI[Math.random() < 0.5 ? 0 : 1],
      t: SEMI[Math.floor(rnd(0, 4))], a: rnd(0.18, 0.47), v: rnd(6, 14) * scala, rot: rnd(-0.3, 0.3),
      vr: rnd(-0.08, 0.08), p: rnd(0, 6.28), vp: rnd(0.6, 1.4),
    }));
    bolle = Array.from({ length: 16 }, () => ({
      x: rnd(0, W), y: rnd(0, H), r: rnd(30, 90) * scala, c: COLORI[Math.random() < 0.5 ? 0 : 1], a: rnd(0.05, 0.12),
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
    for (const s of semi) {
      if (!FERMO) {
        s.y -= s.v * dt; s.rot += s.vr * dt; s.p += s.vp * dt;
        if (s.y < -50) { s.y = H + 50; s.x = rnd(0, W); }
      }
      const alpha = s.a * (0.75 + 0.25 * Math.sin(s.p));
      ctx.save();
      ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      const lato = s.s * 0.75; // altezza del seme, come il carattere di prima
      ctx.scale(lato, lato);
      ctx.lineWidth = Math.max(1, s.s / 18) / lato;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgba(${s.c},${alpha.toFixed(3)})`;
      ctx.shadowColor = `rgba(${s.c},${(alpha * 0.9).toFixed(3)})`;
      ctx.shadowBlur = 8;
      ctx.stroke(s.t);
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
  aggiungiStilePile();
  const { bg, brand, canvas, pileBox } = creaSfondo();
  const semi = avviaSemi(canvas);
  const pile = avviaPile(pileBox);
  const schermate = SCHERMATE.map(id => document.getElementById(id)).filter(Boolean);

  function aggiorna() {
    const visibile = schermate.some(s => s.style.display && s.style.display !== 'none');
    bg.style.display = visibile ? 'block' : 'none';
    brand.style.display = visibile ? 'block' : 'none';
    if (visibile) { semi.avvia(); pile.avvia(); } else { semi.ferma(); pile.ferma(); }
  }

  const osserva = new MutationObserver(aggiorna);
  schermate.forEach(s => osserva.observe(s, { attributes: true, attributeFilter: ['style'] }));
  aggiorna();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
