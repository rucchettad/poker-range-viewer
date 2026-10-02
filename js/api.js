/**
 * POKER RANGE VIEWER — API layer
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
'use strict';

const API_URL = 'https://poker-range-api-production.up.railway.app';

let _authToken    = null;
let _refreshToken = null;
export function getToken()        { return _authToken; }
export function setToken(t)       { _authToken = t; }
export function setRefreshToken(t){ _refreshToken = t || null; }
export function clearToken()      { _authToken = null; _refreshToken = null; }

// ===== RINNOVO AUTOMATICO DEL TOKEN =====
// Il token di Supabase dura 1 ora: prima che scada (o se il server lo rifiuta)
// l'app ne chiede uno nuovo a /api/refresh con il refresh token.
// Il backend rinnova SOLO se l'abbonamento o la prova sono ancora validi.
let _gestione = { sessionToken: () => null, salva: () => {} };
export function impostaGestioneRinnovo(g) { _gestione = { ..._gestione, ...g }; }

const ENDPOINT_SENZA_RINNOVO = ['/api/login', '/api/login-google', '/api/refresh'];
const ERRORI_DA_PROPAGARE    = ['SESSION_DUPLICATE', 'TRIAL_EXPIRED', 'SUBSCRIPTION_EXPIRED'];

// Scadenza del token (millisecondi), letta dal token stesso; 0 se non leggibile
function scadenzaToken(t) {
  try {
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (payload.exp || 0) * 1000;
  } catch (e) { return 0; }
}

// Un solo rinnovo alla volta: le richieste contemporanee aspettano lo stesso rinnovo
let _rinnovoInCorso = null;
function rinnovaToken() {
  if (!_refreshToken) return Promise.resolve(false);
  if (_rinnovoInCorso) return _rinnovoInCorso;
  _rinnovoInCorso = (async () => {
    try {
      let res, json;
      try {
        res  = await fetch(API_URL + '/api/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: _refreshToken, session_token: _gestione.sessionToken() }),
        });
        json = await res.json();
      } catch (e) {
        return false; // rete: si riprova alla richiesta successiva
      }
      if (json && json.error === 'RATE_LIMIT_BLOCKED') throw new RateLimitError(json.permanent);
      if (!res.ok || !json || !json.access_token) {
        const err = new Error((json && json.error) || 'REFRESH_FAILED');
        if (json && json.prezzo) err.prezzo = json.prezzo;
        throw err;
      }
      _authToken    = json.access_token;
      _refreshToken = json.refresh_token || _refreshToken;
      _gestione.salva(_authToken, _refreshToken);
      return true;
    } finally {
      _rinnovoInCorso = null;
    }
  })();
  return _rinnovoInCorso;
}

// Alcune richieste portano il token anche nel corpo: dopo un rinnovo va aggiornato
function aggiornaTokenNelCorpo(opts) {
  if (!_authToken || typeof opts.body !== 'string') return opts;
  try {
    const corpo = JSON.parse(opts.body);
    if (corpo && corpo.access_token && corpo.access_token !== _authToken) {
      corpo.access_token = _authToken;
      return { ...opts, body: JSON.stringify(corpo) };
    }
  } catch (e) { /* corpo non JSON: si lascia com'è */ }
  return opts;
}

// Blocco per troppe richieste deciso dal backend.
// permanent = false: sospensione di 10 minuti che scade da sola; true: account sospeso.
export class RateLimitError extends Error {
  constructor(permanent = false) {
    super('Account temporaneamente sospeso per troppe richieste.');
    this.name = 'RateLimitError';
    this.permanent = !!permanent;
  }
}

export async function apiFetch(endpoint, opts = {}, _giaRiprovato = false) {
  const rinnovabile = !ENDPOINT_SENZA_RINNOVO.includes(endpoint);

  // Rinnovo preventivo: se il token scade entro 2 minuti, rinnovalo prima della richiesta
  if (rinnovabile && _refreshToken && _authToken && scadenzaToken(_authToken) - Date.now() < 2 * 60 * 1000) {
    try { await rinnovaToken(); } catch (e) { /* ci pensa la richiesta: il server risponde con l'errore giusto */ }
  }
  opts = aggiornaTokenNelCorpo(opts);

  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (_authToken) headers['Authorization'] = 'Bearer ' + _authToken;
  let res, json;
  try {
    res  = await fetch(API_URL + endpoint, { ...opts, headers });
    json = await res.json();
  } catch (e) {
    throw new Error('Errore di rete: ' + e.message);
  }
  // Solo il vero blocco dell'account è un RateLimitError. Gli altri "troppe richieste"
  // (codici SMS, tentativi di login, account per connessione) mostrano il messaggio del backend.
  if (json && json.error === 'RATE_LIMIT_BLOCKED') throw new RateLimitError(json.permanent);
  // Token rifiutato (per esempio scaduto mentre la scheda era in background):
  // un solo tentativo di rinnovo, poi la stessa richiesta viene ripetuta
  if (res.status === 401 && rinnovabile && !_giaRiprovato && _refreshToken && !(json && json.error === 'SESSION_DUPLICATE')) {
    let rinnovato = false;
    try {
      rinnovato = await rinnovaToken();
    } catch (e) {
      if (e instanceof RateLimitError || ERRORI_DA_PROPAGARE.includes(e.message)) throw e;
    }
    if (rinnovato) return apiFetch(endpoint, opts, true);
  }
  if (!res.ok) {
    const err = new Error((json && json.error) || 'Errore server');
    // Blocco al login: il backend dice se è temporaneo o permanente
    if (json && json.permanent !== undefined) err.permanent = !!json.permanent;
    // Accesso scaduto: il backend manda anche il prezzo da mostrare (lib/prezzo.js)
    if (json && json.prezzo) err.prezzo = json.prezzo;
    throw err;
  }
  return json;
}

const _CACHE = {};
const _CACHE_TTL = 5 * 60 * 1000;

function cacheGet(key) {
  const e = _CACHE[key];
  if (!e) return undefined;
  if (Date.now() - e.ts > _CACHE_TTL) { delete _CACHE[key]; return undefined; }
  return e.val;
}
function cacheSet(key, val) { _CACHE[key] = { val, ts: Date.now() }; }
export function svuotaCache() { Object.keys(_CACHE).forEach(k => delete _CACHE[k]); }

export function apiLogin(email, password) {
  return apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}
// Login/registrazione con Google: access_token e refresh_token arrivano da Supabase
// dopo che il frontend ha completato il flusso OAuth (vedi auth.js, gestisciRitornoGoogle).
export function apiLoginGoogle(accessToken, refreshToken) {
  return apiFetch('/api/login-google', { method: 'POST', body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }) });
}
export function apiCheckStatus(accessToken, sessionToken) {
  return apiFetch('/api/check-status', { method: 'POST', body: JSON.stringify({ access_token: accessToken, session_token: sessionToken }) });
}
export function apiResetPasswordRequest(email) {
  return apiFetch('/api/reset-password', { method: 'POST', body: JSON.stringify({ email }) });
}
export function apiNuovaPassword(token, password) {
  return apiFetch('/api/nuova-password', { method: 'POST', body: JSON.stringify({ token, password }) });
}
export function apiRegistrazione({ nome_cognome, email, password, phone_number, room_principale }) {
  return apiFetch('/api/registrazione', { method: 'POST', body: JSON.stringify({ nome_cognome, email, password, phone_number, room_principale }) });
}

// ===== NUOVE FUNZIONI: FLUSSO OTP A 2 STEP =====
export function apiSendOtpRegistration({ nome_cognome, email, password, phone_number, username_poker, room_principale, stack_medio }) {
  return apiFetch('/api/send-otp-registration', { method: 'POST', body: JSON.stringify({ nome_cognome, email, password, phone_number, username_poker, room_principale, stack_medio }) });
}

export function apiVerifyOtpRegistration({ phone_number, otp_code }) {
  return apiFetch('/api/verify-otp-registration', { method: 'POST', body: JSON.stringify({ phone_number, otp_code }) });
}

// Il backend accetta sia { access_token } sia { email, password } per identificare
// l'utente prima di creare la sessione di checkout Stripe. Il token viene usato
// quando disponibile (es. utenti Google, che non hanno mai impostato una password).
export async function apiCreaCheckout({ email, password, accessToken } = {}) {
  const body = accessToken ? { access_token: accessToken } : { email, password };
  let res, data;
  try {
    res  = await fetch(API_URL + '/api/crea-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    data = await res.json();
  } catch (e) {
    throw new Error('Errore di rete: ' + e.message);
  }
  if (!res.ok || !data.checkout_url) throw new Error(data.error || 'Errore pagamento');
  return data.checkout_url;
}
export function apiDisdici(accessToken) {
  return apiFetch('/api/disdici', { method: 'POST', body: JSON.stringify({ access_token: accessToken }) });
}
export async function fetchRange(chiave) {
  const cached = cacheGet('r:' + chiave);
  if (cached !== undefined) return cached;
  const data = await apiFetch('/api/range', { method: 'POST', body: JSON.stringify({ access_token: _authToken, range_key: chiave }) });
  if (data && data.error === 'RATE_LIMIT_BLOCKED') throw new RateLimitError(data.permanent);
  const result = data.hands || null;
  cacheSet('r:' + chiave, result);
  return result;
}
export async function fetchNota(chiave) {
  const cached = cacheGet('n:' + chiave);
  if (cached !== undefined) return cached;
  const data = await apiFetch('/api/nota', { method: 'POST', body: JSON.stringify({ access_token: _authToken, range_key: chiave }) });
  const result = data.note || null;
  cacheSet('n:' + chiave, result);
  return result;
}
