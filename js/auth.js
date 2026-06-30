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
} from './api.js';

const SESSION_KEY = 'poker_token';
const EMAIL_KEY   = 'poker_email';
const SESSION_TK  = 'poker_session';

function el(id) { return document.getElementById(id); }

function showScreen(id) {
  ['loginScreen','forgotScreen','resetScreen','trialScadutoScreen','registrazioneScreen','appScreen']
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
    msgEl.textContent = '⚠ ' + (e.message || 'Errore. Contatta rucchettad@gmail.com');
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

export function mostraBannerRateLimitAlCaricamento() {
  const MSG = "⚠️ Rallenta!\nHai effettuato troppe richieste in poco tempo.\nAttendi che il monitoraggio si concluda — potrebbe richiedere fino a 10 minuti.\nL'accesso anomalo ai dati è monitorato e può comportare la sospensione permanente dell'account.";
  el('errorBannerText').textContent = MSG;
  el('retryBtn').style.display = 'none';
  el('errorBanner').style.display = 'block';
  document.querySelectorAll('.tab, .flat-tab, .cellBtn').forEach(e => {
    e.style.pointerEvents = 'none';
    e.style.opacity = '0.4';
  });
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
  // Privacy modal
  el('privacyOpenBtn')?.addEventListener('click', () => { el('privacyModal').style.display = 'flex'; });
  el('privacyCloseBtn')?.addEventListener('click', () => { el('privacyModal').style.display = 'none'; });

  el('regBtn').addEventListener('click', async () => {
    const nome     = el('regNome').value.trim();
    const email    = el('regEmail').value.trim();
    const password = el('regPassword').value;
    setError('regError', '');
    if (!el('regGdprChk').checked) { setError('regError', 'Devi accettare la Privacy Policy per procedere.'); return; }
    if (!nome || !email || !password) { setError('regError', 'Compila tutti i campi obbligatori.'); return; }
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
      await apiRegistrazione({ nome_cognome: nome, email, password, room_principale: roomSelezionate.join(', ') });
      setError('regError', '✓ Registrazione completata! Controlla la tua email (anche nella cartella spam). Reindirizzamento...', true);
      el('regBtn').disabled = true; el('regBtn').style.opacity = '0.6';
      setTimeout(() => {
        el('loginEmail').value = email;
        setError('loginError', '✓ Account creato! Inserisci la password per accedere.', true);
        showScreen('loginScreen');
      }, 3000);
    } catch (e) {
      setError('regError', e.message || 'Errore durante la registrazione.');
    } finally {
      setLoading('regLoading', false);
    }
  });
}

// ===== TRIAL SCADUTO =====

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
    if (e.message === 'TRIAL_EXPIRED') {
      window._TRIAL_EMAIL = email;
      showScreen('trialScadutoScreen');
      return;
    }
    if (e.message && (e.message.includes('sospeso') || e.message.includes('coach') || e.message.includes('scaduto'))) {
      const errEl = el('loginError');
      errEl.innerHTML = '🚫 Accesso negato.<br>Per assistenza: <a href="mailto:rucchettad@gmail.com" style="color:var(--btn);">rucchettad@gmail.com</a>';
      errEl.style.display = 'block';
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
      errEl.innerHTML = '🚫 Il tuo account è stato sospeso per uso anomalo.<br>Contatta: <a href="mailto:rucchettad@gmail.com" style="color:var(--btn);">rucchettad@gmail.com</a>';
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
        mostraBannerRateLimitAlCaricamento();
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
    showScreen('loginScreen');
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
      } else if (e.message === 'TRIAL_EXPIRED') {
        clearSession();
        window._TRIAL_EMAIL = sessionStorage.getItem(EMAIL_KEY) || '';
        showScreen('trialScadutoScreen');
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
