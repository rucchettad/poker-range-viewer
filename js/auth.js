/**
 * POKER RANGE VIEWER — Auth module
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
'use strict';

import {
  getToken, setToken, clearToken, RateLimitError,
  apiFetch, apiLogin, apiCheckStatus,
  apiResetPasswordRequest, apiNuovaPassword,
  apiRegistrazione, apiCreaCheckout, apiDisdici,
  apiSendOtpRegistration, apiVerifyOtpRegistration,
} from './api.js';

const SESSION_KEY = 'poker_token';
const EMAIL_KEY   = 'poker_email';
const SESSION_TK  = 'poker_session';

function el(id) { return document.getElementById(id); }

function showScreen(id) {
  ['loginScreen','forgotScreen','resetScreen','trialScadutoScreen','registrazioneScreen','verificaOtpScreen','appScreen']
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

function saveSession(token, email, sessionToken) {
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(EMAIL_KEY, email);
  if (sessionToken) sessionStorage.setItem(SESSION_TK, sessionToken);
  setToken(token);
}
function clearSession() {
  clearToken();
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(SESSION_TK);
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

function toggleRakeback(cb) {
  const pct = document.querySelector(`.reg-room-pct[data-room="${cb.value}"]`);
  if (pct) { pct.style.display = cb.checked ? 'inline-block' : 'none'; if (!cb.checked) pct.value = ''; }
}

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
    showScreen('registrazioneScreen');
  });
  el('backToLoginFromReg').addEventListener('click', () => {
    setError('regError', '');
    showScreen('loginScreen');
  });
  el('regRoomAltreChk').addEventListener('change', function () {
    el('regRoomAltreText').style.display = this.checked ? 'block' : 'none';
  });
  document.querySelectorAll('.reg-room-cb').forEach(cb => {
    cb.addEventListener('change', () => toggleRakeback(cb));
  });

  // MODIFICA: usa apiSendOtpRegistration invece di apiRegistrazione + login + send-otp
  el('regBtn').addEventListener('click', async () => {
    const nome     = el('regNome').value.trim();
    const email    = el('regEmail').value.trim();
    const password = el('regPassword').value;
    const phone    = normalizzaTelefono(el('regPhone').value);
    setError('regError', '');
    if (!el('regGdprChk').checked) { setError('regError', 'Devi accettare i Termini di servizio e la Privacy per procedere.'); return; }
    if (!nome || !email || !password || !phone) { setError('regError', 'Compila tutti i campi obbligatori (incluso il telefono).'); return; }
    if (password.length < 6) { setError('regError', 'La password deve essere di almeno 6 caratteri.'); return; }
    const roomSelezionate = [];
    document.querySelectorAll('.reg-room-cb:checked').forEach(cb => {
      if (cb.value === 'Altre') {
        const altro = el('regRoomAltreText').value.trim();
        if (altro) roomSelezionate.push('Altre: ' + altro);
      } else {
        const pct    = document.querySelector(`.reg-room-pct[data-room="${cb.value}"]`);
        const pctVal = pct ? pct.value.trim() : '';
        roomSelezionate.push(pctVal ? `${cb.value} (${pctVal})` : cb.value);
      }
    });
    setLoading('regLoading', true);
    try {
      await apiSendOtpRegistration({
        nome_cognome: nome,
        email,
        password,
        phone_number: phone,
        room_principale: roomSelezionate.join(', ')
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
function mostraAccessoScaduto(email, prezzo) {
  window._TRIAL_EMAIL = email;
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
      const email    = window._TRIAL_EMAIL || el('loginEmail').value.trim();
      const password = el('loginPassword').value;
      const url      = await apiCreaCheckout(email, password);
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
    } else {
      setError('loginError', 'Email o password errati.');
    }
    return;
  }
  saveSession(loginData.access_token, loginData.user.email, loginData.session_token);
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

// ===== RIPRISTINO SESSIONE =====

export async function ripristinaSessione() {
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
        // L'email va letta prima di clearSession(), che la cancella.
        const email = sessionStorage.getItem(EMAIL_KEY) || '';
        clearSession();
        mostraAccessoScaduto(email, e.prezzo);
      }
    }
  }, 30_000);
}

// ===== INIT =====

export function initAuth() {
  initLogin();
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
