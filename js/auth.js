/**
 * POKER RANGE VIEWER — Auth module
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
'use strict';

import {
  getToken, setToken, setRefreshToken, clearToken, impostaGestioneRinnovo, RateLimitError,
  apiFetch, apiLogin, apiLoginGoogle, apiCheckStatus,
  apiResetPasswordRequest, apiNuovaPassword,
  apiRegistrazione, apiCreaCheckout, apiDisdici,
  apiSendOtpRegistration, apiVerifyOtpRegistration,
  apiGoogleSendOtp, apiGoogleVerifyOtp,
} from './api.js';
// Libreria Supabase ospitata sul nostro sito (js/vendor/supabase.js, caricata in
// index.html prima dei moduli): nessuna richiesta a CDN esterni come jsDelivr.
const { createClient } = window.supabase;

const SESSION_KEY = 'poker_token';
const EMAIL_KEY   = 'poker_email';
const SESSION_TK  = 'poker_session';
const REFRESH_KEY = 'poker_refresh';

// Client Supabase usato SOLO per il flusso "Accedi con Google" (signInWithOAuth).
// Il resto dell'app continua a gestire la sessione a modo suo (sessionStorage +
// backend custom): dopo aver letto i token da qui, la sessione Supabase locale
// viene chiusa con scope 'local' (vedi gestisciRitornoGoogle), senza invalidare
// il refresh token lato server, che resta valido per /api/refresh.
const SUPABASE_URL = 'https://abnsmqheydlpoffxjhsx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibnNtcWhleWRscG9mZnhqaHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMDE3ODYsImV4cCI6MjA5NzU3Nzc4Nn0.Rs6XIs_54FrvAXWkLGSYK1rIfKYwaMn-bV1sFC3WoKc';
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Client ID OAuth di Google (pubblico, non è un segreto). Usato dal bottone
// Google Identity Services: il login avviene direttamente su pokerrange.online,
// così la schermata Google mostra "Poker Range" e non il dominio Supabase.
const GOOGLE_CLIENT_ID = '910317094229-ills67lnkrbht26gkmfdnvolmqnm02ga.apps.googleusercontent.com';

function el(id) { return document.getElementById(id); }

function showScreen(id) {
  ['loginScreen','forgotScreen','resetScreen','trialScadutoScreen','registrazioneScreen','verificaOtpScreen','telefonoGoogleScreen','appScreen']
    .forEach(s => { const e = el(s); if (e) e.style.display = 'none'; });
  const target = el(id);
  if (target) target.style.display = ['appScreen'].includes(id) ? 'block' : 'flex';
}

function setError(elId, msg, isSuccess = false) {
  const e = el(elId);
  if (!e) return;
  e.textContent  = msg;
  e.style.color  = isSuccess ? 'var(--success)' : 'var(--error)';
  e.style.display = msg ? 'block' : 'none';
}
function setLoading(elId, visible) {
  const e = el(elId);
  if (e) e.style.display = visible ? 'block' : 'none';
}

function saveSession(token, email, sessionToken, refreshToken) {
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(EMAIL_KEY, email);
  if (sessionToken) sessionStorage.setItem(SESSION_TK, sessionToken);
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  setToken(token);
  setRefreshToken(refreshToken);
}
function clearSession() {
  clearToken();
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(SESSION_TK);
  sessionStorage.removeItem(REFRESH_KEY);
  window.APP_AVVIATA       = false;
  window.DISCLAIMER_CHIUSO = false;
}

// ===== ACCOUNT PANEL =====

function aggiornaAccountPanel(user) {
  const emailEl  = el('accountEmail');
  const statusEl = el('accountStatus');
  if (emailEl) emailEl.textContent = user.email || '';
  if (!statusEl) return;
  const status = user.subscription_status || 'trial';
  const MAP = {
    active:    { text: '✅ Attivo',   color: '#4bc8a0' },
    trial:     { text: '🟡 Trial',   color: '#f59e0b' },
    cancelled: { text: '🔴 Disdetto', color: '#dc2626' },
  };
  const info = MAP[status] || { text: status, color: '#7a8099' };
  statusEl.textContent = info.text;
  statusEl.style.color = info.color;
  if (status === 'cancelled') { const btn = el('disdiciBtn'); if (btn) btn.style.display = 'none'; }
}

function toggleAccountPanel() {
  const panel = el('accountPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function disdiciAbbonamento() {
  const msgEl = el('disdiciMsg');
  const btn   = el('disdiciBtn');
  if (!confirm("Sei sicuro di voler disdire l'abbonamento? Manterrai l'accesso fino alla scadenza del periodo già pagato.")) return;
  btn.disabled = true; btn.textContent = 'Attendere...';
  try {
    await apiDisdici(sessionStorage.getItem(SESSION_KEY));
    msgEl.textContent = '✅ Abbonamento disdetto. Accesso attivo fino alla scadenza.';
    msgEl.style.display = 'block';
    btn.style.display = 'none';
    const s = el('accountStatus');
    if (s) { s.textContent = '🔴 Disdetto'; s.style.color = '#dc2626'; }
  } catch (e) {
    msgEl.textContent = '⚠ ' + (e.message || 'Errore. Contatta assistenza@pokerrange.online');
    msgEl.style.color = '#dc2626'; msgEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Disdici abbonamento';
  }
}

// ===== LOGOUT =====

function logout() {
  clearSession();
  el('assistenzaFooter').style.display = 'none';
  showScreen('loginScreen');
}

// ===== DISCLAIMER =====

function mostraDisclaimerPoiApp(user) {
  const overlay     = el('disclaimerOverlay');
  const countdownEl = el('countdownSeconds');
  countdownEl.textContent = '5';
  overlay.style.display = 'flex';
  overlay.style.animation = 'fadeIn 0.3s ease-out';
  let countdown = 5;
  const intervalId = setInterval(() => {
    countdown--;
    countdownEl.textContent = countdown;
    if (countdown <= 0) { clearInterval(intervalId); chiudi(); }
  }, 1000);
  function chiudi() {
    overlay.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => {
      overlay.style.display = 'none';
      window.DISCLAIMER_CHIUSO = true;
      mostraApp(user);
    }, 300);
  }
  el('disclaimerButton').onclick = () => { clearInterval(intervalId); chiudi(); };
}

function mostraApp(user) {
  if (!window.DISCLAIMER_CHIUSO) return;
  showScreen('appScreen');
  el('assistenzaFooter').style.display = 'block';
  const emailEl = el('userEmail');
  if (emailEl) emailEl.textContent = user.email;
  aggiornaAccountPanel(user);
  if (!window.APP_AVVIATA) window.avviaApp();
}

// ===== SESSIONE SCADUTA =====

export function mostraSessioneScaduta() {
  clearSession();
  el('sessioneScadutaOverlay').style.display = 'flex';
}

function chiudiSessioneScaduta() {
  el('sessioneScadutaOverlay').style.display = 'none';
  el('appScreen').style.display = 'none';
  showScreen('loginScreen');
}

// ===== BANNER RATE LIMIT =====

// Testi del blocco per troppe richieste (uguali a quelli di app.js)
const MSG_BLOCCO_TEMP = "⚠️ Rallenta! Hai aperto troppi range in poco tempo. L'accesso è sospeso per 10 minuti, poi potrai continuare normalmente. L'uso anomalo è monitorato e, se si ripete, può portare alla sospensione dell'account.";
const MSG_BLOCCO_PERM = "🚫 Il tuo account è stato sospeso per uso anomalo. Se pensi sia un errore, scrivi ad assistenza@pokerrange.online.";
const HTML_LOGIN_BLOCCO_TEMP = '⚠️ Accesso sospeso per 10 minuti per troppe richieste. Riprova tra poco.';
const HTML_LOGIN_BLOCCO_PERM = '🚫 Il tuo account è stato sospeso per uso anomalo.<br>Se pensi sia un errore, scrivi ad <a href="mailto:assistenza@pokerrange.online" style="color:var(--btn);">assistenza@pokerrange.online</a>.';

export function mostraBannerRateLimitAlCaricamento(permanente = false) {
  el('errorBannerText').textContent = permanente ? MSG_BLOCCO_PERM : MSG_BLOCCO_TEMP;
  el('retryBtn').style.display = 'none';
  el('errorBanner').style.display = 'block';
  document.querySelectorAll('.tab, .flat-tab, .cellBtn').forEach(e => {
    e.style.pointerEvents = 'none';
    e.style.opacity = '0.4';
  });
  // Blocco temporaneo: dopo 10 minuti la pagina si ricarica e l'app riparte normalmente
  if (!permanente) setTimeout(() => location.reload(), 10 * 60 * 1000 + 15 * 1000);
}

// Pulizia del numero di telefono prima dell'invio: toglie spazi, punti e trattini,
// trasforma 0039 in +39 e aggiunge +39 se manca (es. 3451234567 -> +393451234567)
function normalizzaTelefono(valore) {
  let n = String(valore || '').replace(/[\s.\-()\/]/g, '');
  if (n.startsWith('0039')) n = '+39' + n.slice(4);
  else if (/^39\d{9,10}$/.test(n)) n = '+' + n;
  else if (/^3\d{8,9}$/.test(n)) n = '+39' + n;
  return n;
}

// ===== FORGOT PASSWORD =====

function initForgotPassword() {
  el('forgotPasswordLink').addEventListener('click', () => {
    el('forgotEmail').value = el('loginEmail').value || '';
    setError('forgotError', '');
    // Il bottone viene disattivato dopo un invio riuscito: va riattivato ogni volta
    // che si riapre la schermata, altrimenti resta bloccato fino al ricaricamento.
    el('forgotBtn').disabled = false; el('forgotBtn').style.opacity = '';
    showScreen('forgotScreen');
  });
  el('backToLoginLink').addEventListener('click', () => {
    setError('forgotError', '');
    showScreen('loginScreen');
  });
  el('forgotBtn').addEventListener('click', async () => {
    const email = el('forgotEmail').value.trim();
    setError('forgotError', '');
    if (!email) { setError('forgotError', 'Inserisci la tua email.'); return; }
    setLoading('forgotLoading', true);
    try {
      await apiResetPasswordRequest(email);
      setError('forgotError', '✓ Link inviato! Controlla la tua email (anche spam).', true);
      el('forgotBtn').disabled = true; el('forgotBtn').style.opacity = '0.6';
    } catch (e) {
      setError('forgotError', 'Errore: ' + e.message);
    } finally {
      setLoading('forgotLoading', false);
    }
  });
  el('forgotEmail').addEventListener('keydown', e => { if (e.key === 'Enter') el('forgotBtn').click(); });
}

// ===== RESET PASSWORD =====

function initResetPassword() {
  el('resetBtn').addEventListener('click', async () => {
    const pwd  = el('resetPassword').value;
    const pwd2 = el('resetPasswordConfirm').value;
    setError('resetError', '');
    if (pwd.length < 6) { setError('resetError', 'La password deve essere di almeno 6 caratteri.'); return; }
    if (pwd !== pwd2)   { setError('resetError', 'Le password non coincidono.'); return; }
    setLoading('resetLoading', true);
    try {
      await apiNuovaPassword(getToken(), pwd);
      clearSession();
      setError('loginError', 'Password aggiornata! Accedi con la nuova password.', true);
      showScreen('loginScreen');
    } catch (e) {
      setError('resetError', 'Errore: ' + e.message);
    } finally {
      setLoading('resetLoading', false);
    }
  });
}

// ===== REGISTRAZIONE =====

// ===== VERIFICA OTP =====
// MODIFICA: usa apiVerifyOtpRegistration invece di /api/verify-otp
function initVerificaOtp() {
  el('verifyOtpBtn')?.addEventListener('click', async () => {
    const otpCode = el('otpCode').value.trim();
    const phone = window._TEMP_PHONE;

    if (!otpCode || otpCode.length !== 6) { setError('otpError', 'Inserisci il codice di 6 cifre ricevuto via SMS.'); return; }
    if (!phone) { setError('otpError', 'Errore interno. Riprova.'); return; }

    setError('otpError', '');
    setLoading('otpLoading', true);

    try {
      await apiVerifyOtpRegistration({ phone_number: phone, otp_code: otpCode });

      setError('otpError', '✓ Registrazione completata! Reindirizzamento al login...', true);
      el('verifyOtpBtn').disabled = true; el('verifyOtpBtn').style.opacity = '0.6';

      setTimeout(() => {
        el('loginEmail').value = window._TEMP_EMAIL || '';
        setError('loginError', '✓ Registrazione completata! Accedi ora.', true);
        showScreen('loginScreen');
        // Pulisci i dati temporanei
        window._TEMP_PHONE = null;
        window._TEMP_EMAIL = null;
      }, 2000);
    } catch (e) {
      setError('otpError', e.message || 'Errore nella verifica del codice. Riprova.');
    } finally {
      setLoading('otpLoading', false);
    }
  });
}



function initRegistrazione() {
  el('registrazioneLink').addEventListener('click', () => {
    setError('regError', '');
    if (el('regGoogleInfo')) el('regGoogleInfo').style.display = 'none';
    showScreen('registrazioneScreen');
  });
  el('backToLoginFromReg').addEventListener('click', () => {
    setError('regError', '');
    showScreen('loginScreen');
  });

  // MODIFICA: usa apiSendOtpRegistration invece di apiRegistrazione + login + send-otp
  el('regBtn').addEventListener('click', async () => {
    const nome     = el('regNome').value.trim();
    const email    = el('regEmail').value.trim();
    const password = el('regPassword').value;
    const phone    = normalizzaTelefono(el('regPhone').value);
    setError('regError', '');
    if (!el('regGdprChk').checked) { setError('regError', 'Dichiara di essere maggiorenne e di accettare i Termini di servizio e la Privacy.'); return; }
    if (!nome || !email || !password || !phone) { setError('regError', 'Compila tutti i campi obbligatori (incluso il telefono).'); return; }
    if (password.length < 6) { setError('regError', 'La password deve essere di almeno 6 caratteri.'); return; }
    // Room più usata: facoltativa, testo libero (max 60 caratteri)
    setLoading('regLoading', true);
    try {
      await apiSendOtpRegistration({
        nome_cognome: nome,
        email,
        password,
        phone_number: phone
      });

      // Salva dati temporanei per la verifica OTP
      window._TEMP_PHONE = phone;
      window._TEMP_EMAIL = email;

      setError('regError', '✓ Codice inviato via SMS. Inseriscilo per completare la registrazione.', true);
      el('regBtn').disabled = true; el('regBtn').style.opacity = '0.6';

      setTimeout(() => {
        showScreen('verificaOtpScreen');
        el('otpCode').value = '';
        el('otpCode').focus();
      }, 1500);
    } catch (e) {
      setError('regError', e.message || 'Errore durante la registrazione.');
    } finally {
      setLoading('regLoading', false);
    }
  });
}

// ===== TRIAL SCADUTO =====

// Mostra la schermata "Accesso scaduto" con il prezzo di questo utente (arriva dal backend).
// Se il prezzo non arriva, resta quello scritto in index.html.
// accessToken (opzionale): quando disponibile (utenti Google al ritorno dal redirect,
// o chiunque abbia ancora un token valido al momento della scadenza), permette di
// pagare senza richiedere una password — fondamentale per gli utenti Google, che non
// ne hanno mai impostata una.
function mostraAccessoScaduto(email, prezzo, accessToken) {
  window._TRIAL_EMAIL = email;
  window._TRIAL_ACCESS_TOKEN = accessToken || null;
  if (prezzo) {
    const p1 = el('trialPrezzo'), p2 = el('trialPrezzoBtn');
    if (p1) p1.textContent = prezzo;
    if (p2) p2.textContent = prezzo;
  }
  showScreen('trialScadutoScreen');
}

function initTrialScaduto() {
  el('trialCheckoutBtn').addEventListener('click', async () => {
    setLoading('trialLoading', true);
    setError('trialError', '');
    try {
      const token = window._TRIAL_ACCESS_TOKEN || null;
      let url;
      if (token) {
        url = await apiCreaCheckout({ accessToken: token });
      } else {
        const email    = window._TRIAL_EMAIL || el('loginEmail').value.trim();
        const password = el('loginPassword').value;
        url = await apiCreaCheckout({ email, password });
      }
      window.location.href = url;
    } catch (e) {
      setError('trialError', e.message);
    } finally {
      setLoading('trialLoading', false);
    }
  });
  el('trialLogoutLink').addEventListener('click', () => showScreen('loginScreen'));
}

// ===== LOGIN =====

async function doLogin(email, password) {
  setError('loginError', '');
  setLoading('loginLoading', true);
  let loginData;
  try {
    loginData = await apiLogin(email, password);
  } catch (e) {
    setLoading('loginLoading', false);
    if (e.message === 'TRIAL_EXPIRED' || e.message === 'SUBSCRIPTION_EXPIRED') {
      // Sia trial scaduto sia abbonamento pagante scaduto: offri il rinnovo, non un ban.
      mostraAccessoScaduto(email, e.prezzo);
      return;
    }
    if (e.message === 'ACCOUNT_BLOCKED' || e instanceof RateLimitError) {
      const errEl = el('loginError');
      errEl.innerHTML = e.permanent ? HTML_LOGIN_BLOCCO_PERM : HTML_LOGIN_BLOCCO_TEMP;
      errEl.style.display = 'block';
    } else if (e.message === 'ACCOUNT_PENDING') {
      setError('loginError', 'Account in attesa di approvazione.');
    } else if (/^Troppi tentativi/i.test(e.message || '')) {
      // Troppe password errate: il backend dice tra quanti minuti riprovare
      setError('loginError', e.message);
    } else if (/^Errore di rete/i.test(e.message || '')) {
      // Il server non risponde o manca la connessione: non è colpa della password
      setError('loginError', 'Connessione non riuscita. Controlla la connessione a internet e riprova.');
    } else if (e.message === 'Email o password errati.' || e.message === 'Email e password obbligatorie.') {
      setError('loginError', e.message);
    } else {
      setError('loginError', 'Accesso non riuscito per un problema temporaneo. Riprova tra qualche minuto.');
    }
    return;
  }
  saveSession(loginData.access_token, loginData.user.email, loginData.session_token, loginData.refresh_token);
  setLoading('loginLoading', false);
  try {
    const sessionToken = sessionStorage.getItem(SESSION_TK);
    await apiCheckStatus(loginData.access_token, sessionToken);
  } catch (e) {
    if (e instanceof RateLimitError) {
      clearSession();
      const errEl = el('loginError');
      errEl.innerHTML = e.permanent ? HTML_LOGIN_BLOCCO_PERM : HTML_LOGIN_BLOCCO_TEMP;
      errEl.style.display = 'block';
      showScreen('loginScreen');
      return;
    }
    if (e.message === 'SESSION_DUPLICATE') {
      clearSession();
      setError('loginError', "⚠️ Sessione non valida. Un altro dispositivo ha effettuato l'accesso con questo account.");
      showScreen('loginScreen');
      return;
    }
    if (e.message === 'TRIAL_EXPIRED' || e.message === 'SUBSCRIPTION_EXPIRED') {
      clearSession();
      mostraAccessoScaduto(loginData.user.email, e.prezzo);
      return;
    }
  }
  mostraDisclaimerPoiApp({ email: loginData.user.email });
}

function initLogin() {
  el('loginBtn').addEventListener('click', () => {
    doLogin(el('loginEmail').value.trim(), el('loginPassword').value);
  });
  el('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') el('loginBtn').click(); });
}

// ===== LOGIN / REGISTRAZIONE CON GOOGLE =====
// Un solo bottone serve sia per il login che per la prima registrazione: il
// backend (/api/login-google) crea il profilo al primo accesso se non esiste
// già, senza chiedere verifica telefono (chi passa da Google ha già
// un'identità verificata da Google stessa).
const GOOGLE_MODO_KEY = 'poker_google_modo';
// Schermata da cui è partito il clic su "Continua con Google":
// 'login' = solo account esistenti, 'registrazione' = può creare l'account
let googleModo = 'login';

async function handleGoogleLogin(modo = 'login') {
  googleModo = modo;
  try { sessionStorage.setItem(GOOGLE_MODO_KEY, modo); } catch (e) { /* storage non disponibile */ }
  setError('loginError', '');
  const { error } = await supabaseAuth.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  // In caso di successo il browser viene reindirizzato a Google: il codice
  // riprende al ritorno sul sito, gestito da gestisciRitornoGoogle().
  if (error) setError('loginError', 'Errore avvio accesso Google: ' + error.message);
}

// ----- Bottone Google Identity Services (GIS) -----
// Flusso principale: Google restituisce un ID token direttamente sulla pagina,
// che passiamo a Supabase con signInWithIdToken. Se lo script di Google non si
// carica (rete, blocco estensioni, ecc.) restano visibili i bottoni classici
// googleLoginBtn/googleRegisterBtn, che usano il vecchio redirect OAuth.

let googleNonce = null; // nonce in chiaro: a Google va l'hash, a Supabase il valore in chiaro

async function sha256Hex(testo) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleGoogleCredential(response) {
  setError('loginError', '');
  const { data, error } = await supabaseAuth.auth.signInWithIdToken({
    provider: 'google',
    token: response.credential,
    nonce: googleNonce,
  });
  if (error || !data?.session) {
    showScreen('loginScreen');
    setError('loginError', 'Accesso con Google non riuscito' + (error?.message ? ': ' + error.message : '.'));
    return;
  }
  await completaLoginGoogle(data.session, googleModo);
}

// ===== GOOGLE CARICATO SOLO DOPO IL CLIC (privacy) =====
// Lo script di Google NON viene caricato all'apertura della pagina: finché
// l'utente non clicca il nostro bottone "Continua con Google", Google non
// riceve nulla (né IP né cookie). Al clic carichiamo lo script e mostriamo il
// bottone ufficiale di Google al posto del nostro; il secondo clic apre la
// scelta dell'account. Se lo script non si carica, si usa il vecchio redirect.
const GOOGLE_GIS_URL = 'https://accounts.google.com/gsi/client';
let googlePronto = null; // Promise: script caricato e inizializzato

function caricaScriptGoogle(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const tag = document.createElement('script');
    tag.src = GOOGLE_GIS_URL;
    tag.async = true;
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    tag.onload = () => { clearTimeout(timer); resolve(); };
    tag.onerror = () => { clearTimeout(timer); reject(new Error('script non caricato')); };
    document.head.appendChild(tag);
  });
}

async function preparaGoogle() {
  if (!window.crypto?.subtle) throw new Error('crypto non disponibile');
  await caricaScriptGoogle();
  googleNonce = crypto.randomUUID ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
  const nonceHash = await sha256Hex(googleNonce);
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    nonce: nonceHash,
    ux_mode: 'popup',
    auto_select: false,
  });
}

const BOTTONI_GOOGLE = {
  login:         { box: 'googleLoginGis',    nostro: 'googleLoginBtn',    nota: 'googleLoginNota' },
  registrazione: { box: 'googleRegisterGis', nostro: 'googleRegisterBtn', nota: 'googleRegisterNota' },
};

async function attivaGoogle(modo) {
  googleModo = modo;
  const ids = BOTTONI_GOOGLE[modo];
  const nostro = el(ids.nostro);
  const testoOriginale = nostro ? nostro.innerHTML : '';
  if (nostro) { nostro.disabled = true; nostro.textContent = 'Connessione a Google...'; }
  try {
    if (!googlePronto) googlePronto = preparaGoogle();
    await googlePronto;
    const box = el(ids.box);
    const larghezza = Math.max(200, Math.min(360, (box?.parentElement?.clientWidth || window.innerWidth) - 40));
    window.google.accounts.id.renderButton(box, {
      type: 'standard', theme: 'outline', size: 'large', text: 'continue_with',
      shape: 'rectangular', logo_alignment: 'center', width: larghezza, locale: 'it',
      click_listener: () => { googleModo = modo; },
    });
    box.style.display = 'flex';
    if (nostro) { nostro.style.display = 'none'; nostro.innerHTML = testoOriginale; nostro.disabled = false; }
    const nota = el(ids.nota);
    if (nota) nota.style.display = 'block';
  } catch (e) {
    console.warn('Google Identity Services non disponibile, uso il login Google classico.', e);
    googlePronto = null;
    if (nostro) { nostro.innerHTML = testoOriginale; nostro.disabled = false; }
    handleGoogleLogin(modo); // ripiego: redirect OAuth (contatta Google solo ora, dopo il clic)
  }
}

function initGoogleLogin() {
  el('googleLoginBtn')?.addEventListener('click', () => attivaGoogle('login'));
  el('googleRegisterBtn')?.addEventListener('click', () => attivaGoogle('registrazione'));
  initTelefonoGoogle();
}

// Parte comune ai due flussi Google (bottone GIS e vecchio redirect): riceve
// una sessione Supabase valida e la passa al backend (/api/login-google).
async function completaLoginGoogle(session, modo = 'login') {
  let loginData;
  try {
    loginData = await apiLoginGoogle(session.access_token, session.refresh_token, modo);
  } catch (e) {
    await supabaseAuth.auth.signOut({ scope: 'local' });
    if (e.message === 'NO_ACCOUNT') {
      // Dal login non si creano account: si passa alla registrazione
      showScreen('registrazioneScreen');
      setError('regError', '');
      const info = el('regGoogleInfo');
      if (info) {
        info.textContent = 'Non hai ancora un account Poker Range con questo account Google. Per registrarti clicca "Continua con Google" qui sotto.';
        info.style.display = 'block';
      }
      // Lo script di Google è già caricato (l'utente l'ha appena usato):
      // mostriamo subito il bottone ufficiale anche qui
      if (window.google?.accounts?.id) attivaGoogle('registrazione');
      return;
    }
    if (e.message === 'PHONE_REQUIRED') {
      // Il token resta valido (~1 ora) anche dopo signOut locale: serve per gli SMS
      mostraTelefonoGoogle(session, !!e.nuovo);
      return;
    }
    showScreen('loginScreen');
    if (e.message === 'TRIAL_EXPIRED' || e.message === 'SUBSCRIPTION_EXPIRED') {
      // Il token è ancora valido: signOut({scope:'local'}) pulisce solo lo storage
      // locale, non invalida il JWT lato server (dura comunque ~1 ora dall'emissione).
      mostraAccessoScaduto(session.user.email, e.prezzo, session.access_token);
    } else if (e.message === 'ACCOUNT_BLOCKED' || e instanceof RateLimitError) {
      const errEl = el('loginError');
      errEl.innerHTML = e.permanent ? HTML_LOGIN_BLOCCO_PERM : HTML_LOGIN_BLOCCO_TEMP;
      errEl.style.display = 'block';
    } else if (e.message === 'ACCOUNT_PENDING') {
      setError('loginError', 'Account in attesa di approvazione.');
    } else {
      setError('loginError', e.message || 'Accesso con Google non riuscito.');
    }
    return;
  }
  // Sessione Supabase locale non più necessaria: la chiudiamo solo in locale
  // (scope 'local'), così il refresh token resta valido lato server per
  // /api/refresh, che lo usa per rinnovare l'access_token dell'app.
  await supabaseAuth.auth.signOut({ scope: 'local' });
  saveSession(loginData.access_token, loginData.user.email, loginData.session_token, loginData.refresh_token);
  mostraDisclaimerPoiApp({ email: loginData.user.email });
}

// Controlla, al caricamento della pagina, se si arriva da un redirect di
// Google (flusso classico di riserva) con una sessione Supabase pronta.
// Restituisce true se l'ha gestita (il chiamante non deve proseguire).
async function gestisciRitornoGoogle() {
  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (!session) return false;
  let modo = 'login';
  try {
    modo = sessionStorage.getItem(GOOGLE_MODO_KEY) || 'login';
    sessionStorage.removeItem(GOOGLE_MODO_KEY);
  } catch (e) { /* storage non disponibile */ }
  await completaLoginGoogle(session, modo);
  return true;
}

// ===== GOOGLE: VERIFICA DEL NUMERO VIA SMS =====
// Utente nuovo con Google (nuovo = true) oppure utente Google già registrato
// senza numero (nuovo = false). Il profilo viene creato/completato dal backend
// solo dopo il codice corretto; poi l'accesso si completa con /login-google.
let googleInAttesa = null; // { session, phone }

function mostraTelefonoGoogle(session, nuovo) {
  googleInAttesa = { session, phone: null };
  el('telGoogleTitolo').textContent = nuovo ? 'Completa la registrazione' : 'Verifica il tuo numero';
  el('telGoogleTesto').textContent = nuovo
    ? 'Per attivare la prova gratuita di 15 giorni inserisci il tuo numero di cellulare: ti invieremo un codice via SMS. Il numero serve solo per la verifica.'
    : 'Per continuare a usare Poker Range è richiesta, una sola volta, la verifica del numero di cellulare. Il numero serve solo per questo.';
  el('telGoogleFaseNumero').style.display = 'block';
  el('telGoogleFaseCodice').style.display = 'none';
  el('telGooglePhone').value = '';
  el('telGoogleCode').value = '';
  setError('telGoogleError', '');
  showScreen('telefonoGoogleScreen');
}

function initTelefonoGoogle() {
  el('telGoogleInviaBtn')?.addEventListener('click', async () => {
    if (!googleInAttesa) { showScreen('loginScreen'); return; }
    const phone = normalizzaTelefono(el('telGooglePhone').value);
    if (!phone) { setError('telGoogleError', 'Inserisci il tuo numero di cellulare.'); return; }
    setError('telGoogleError', '');
    setLoading('telGoogleLoading', true);
    try {
      await apiGoogleSendOtp({ accessToken: googleInAttesa.session.access_token, phone_number: phone });
      googleInAttesa.phone = phone;
      el('telGoogleFaseNumero').style.display = 'none';
      el('telGoogleFaseCodice').style.display = 'block';
      el('telGoogleCode').focus();
    } catch (e) {
      setError('telGoogleError', e.message || 'Invio del codice non riuscito. Riprova.');
    } finally {
      setLoading('telGoogleLoading', false);
    }
  });

  el('telGoogleVerificaBtn')?.addEventListener('click', async () => {
    if (!googleInAttesa || !googleInAttesa.phone) { showScreen('loginScreen'); return; }
    const codice = el('telGoogleCode').value.trim();
    if (!/^\d{6}$/.test(codice)) { setError('telGoogleError', 'Inserisci il codice di 6 cifre ricevuto via SMS.'); return; }
    setError('telGoogleError', '');
    setLoading('telGoogleLoading', true);
    try {
      await apiGoogleVerifyOtp({ accessToken: googleInAttesa.session.access_token, phone_number: googleInAttesa.phone, otp_code: codice });
      const session = googleInAttesa.session;
      googleInAttesa = null;
      await completaLoginGoogle(session, 'registrazione');
    } catch (e) {
      setError('telGoogleError', e.message || 'Verifica del codice non riuscita. Riprova.');
    } finally {
      setLoading('telGoogleLoading', false);
    }
  });

  el('telGoogleCambiaNumero')?.addEventListener('click', () => {
    el('telGoogleFaseCodice').style.display = 'none';
    el('telGoogleFaseNumero').style.display = 'block';
    setError('telGoogleError', '');
  });

  el('telGoogleAnnulla')?.addEventListener('click', () => {
    googleInAttesa = null;
    setError('loginError', '');
    showScreen('loginScreen');
  });
}

// ===== LINK DI RECUPERO PASSWORD (token_hash) =====
// Il template "Reset password" di Supabase porta a
// https://pokerrange.online/?token_hash=...&type=recovery, così il link nell'email
// resta sul nostro dominio (niente supabase.co, meno sospetto per i filtri antispam).
// Il codice viene verificato con un client Supabase separato che NON salva la
// sessione nel browser: così gestisciRitornoGoogle() non la scambia per un ritorno
// da Google e non serve signOut (che chiuderebbe la sessione anche sul server,
// rendendo inutilizzabile il token per apiNuovaPassword).
const supabaseRecupero = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'poker-recupero' },
});

async function gestisciLinkRecupero() {
  const p = new URLSearchParams(window.location.search);
  const tokenHash = p.get('token_hash');
  if (!tokenHash || p.get('type') !== 'recovery') return false;
  history.replaceState(null, '', window.location.pathname);
  try {
    const { data, error } = await supabaseRecupero.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (error || !data || !data.session) throw error || new Error('Sessione non ricevuta');
    const accessToken = data.session.access_token;
    setToken(accessToken);
    showScreen('resetScreen');
  } catch (e) {
    setError('forgotError', 'Il link non è più valido o è già stato usato. Inserisci la tua email per riceverne uno nuovo.');
    showScreen('forgotScreen');
  }
  return true;
}

// ===== RIPRISTINO SESSIONE =====

export async function ripristinaSessione() {
  // Se arriviamo da un redirect di Google, gestiscilo subito e non proseguire
  // con la logica normale (sessionStorage, link di registrazione, ecc.).
  // Link di recupero password dall'email: va gestito prima di tutto il resto.
  if (await gestisciLinkRecupero()) return;
  if (await gestisciRitornoGoogle()) return;

  const urlParams = new URLSearchParams(window.location.search);
  // Link "Registrati" della landing (https://pokerrange.online/?registrati):
  // se l'utente non è loggato apre direttamente la schermata di registrazione.
  // L'indirizzo viene ripulito subito, così un ricaricamento torna al login normale.
  const vuoleRegistrarsi = urlParams.has('registrati');
  if (vuoleRegistrarsi) history.replaceState(null, '', window.location.pathname);
  if (urlParams.get('payment') === 'success') {
    history.replaceState(null, '', window.location.pathname);
    setError('loginError', '✓ Pagamento completato! Accedi con le tue credenziali.', true);
    showScreen('loginScreen');
    return;
  }
  if (urlParams.get('payment') === 'cancel') {
    history.replaceState(null, '', window.location.pathname);
    showScreen('loginScreen');
    return;
  }
  const hash   = window.location.hash;
  const params = new URLSearchParams(hash.replace('#', '?'));
  if (params.get('type') === 'recovery' && params.get('access_token')) {
    history.replaceState(null, '', window.location.pathname);
    setToken(params.get('access_token'));
    showScreen('resetScreen');
    return;
  }
  const token        = sessionStorage.getItem(SESSION_KEY);
  const email        = sessionStorage.getItem(EMAIL_KEY);
  const sessionToken = sessionStorage.getItem(SESSION_TK);
  if (token && email) {
    setToken(token);
    setRefreshToken(sessionStorage.getItem(REFRESH_KEY));
    try {
      await apiCheckStatus(token, sessionToken);
    } catch (e) {
      if (e instanceof RateLimitError) {
        showScreen('appScreen');
        el('appContainer').style.display = 'block';
        el('loadingMsg').style.display   = 'none';
        mostraBannerRateLimitAlCaricamento(e.permanent);
        return;
      }
      if (e.message === 'SESSION_DUPLICATE') {
        clearSession();
        setError('loginError', "⚠️ Sessione non valida. Un altro dispositivo ha effettuato l'accesso con questo account.");
        showScreen('loginScreen');
        return;
      }
      if (e.message === 'TRIAL_EXPIRED' || e.message === 'SUBSCRIPTION_EXPIRED') {
        // Mancava questo ramo: un token salvato che risulta scaduto al semplice
        // ricaricamento della pagina veniva ignorato silenziosamente, aprendo l'app
        // invece di mostrare "Accesso scaduto". Il token letto sopra è ancora valido
        // (la scadenza del trial non invalida il JWT) e permette il checkout senza password.
        clearSession();
        mostraAccessoScaduto(email, e.prezzo, token);
        return;
      }
    }
    mostraDisclaimerPoiApp({ email });
  } else {
    showScreen(vuoleRegistrarsi ? 'registrazioneScreen' : 'loginScreen');
  }
}

// ===== POLLING SESSIONE =====

export function avviaPollingSessione() {
  setInterval(async () => {
    const token        = sessionStorage.getItem(SESSION_KEY);
    const sessionToken = sessionStorage.getItem(SESSION_TK);
    if (!token || !sessionToken) return;
    try {
      await apiCheckStatus(token, sessionToken);
    } catch (e) {
      if (e.message === 'SESSION_DUPLICATE') {
        clearSession();
        showScreen('loginScreen');
        setError('loginError', "⚠️ Sessione non valida. Un altro dispositivo ha effettuato l'accesso con questo account.");
      } else if (e.message === 'TRIAL_EXPIRED' || e.message === 'SUBSCRIPTION_EXPIRED') {
        // Prova o abbonamento terminati durante l'uso: schermata di rinnovo.
        // Email e token vanno letti prima di clearSession(), che li cancella.
        // Il token (ancora valido: la scadenza del trial non invalida il JWT)
        // permette il checkout senza password, utile anche per gli utenti Google.
        const email = sessionStorage.getItem(EMAIL_KEY) || '';
        clearSession();
        mostraAccessoScaduto(email, e.prezzo, token);
      }
    }
  }, 60_000);
}

// ===== INIT =====

export function initAuth() {
  // Rinnovo automatico del token: api.js chiede il session token e salva i token nuovi
  impostaGestioneRinnovo({
    sessionToken: () => sessionStorage.getItem(SESSION_TK),
    salva: (accessToken, refreshToken) => {
      sessionStorage.setItem(SESSION_KEY, accessToken);
      if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
    },
  });
  initLogin();
  initGoogleLogin();
  initForgotPassword();
  initResetPassword();
  initRegistrazione();
  initVerificaOtp();
  initTrialScaduto();

  el('accountBtn')?.addEventListener('click', toggleAccountPanel);
  el('accountBtnMobile')?.addEventListener('click', toggleAccountPanel);
  el('disdiciBtn')?.addEventListener('click', disdiciAbbonamento);
  el('logoutBtn')?.addEventListener('click', logout);

  document.addEventListener('click', (e) => {
    const panel = el('accountPanel');
    if (!panel) return;
    if (!panel.contains(e.target) && e.target !== el('accountBtn') && e.target !== el('accountBtnMobile')) {
      panel.style.display = 'none';
    }
  });

  el('sessioneScadutaBtn')?.addEventListener('click', chiudiSessioneScaduta);

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      clearSession();
      showScreen('loginScreen');
    }
  });
}
