/**
 * POKER RANGE VIEWER — API layer
 * © 2026 pokerrange.online - Danilo Rucchetta
 */
'use strict';

const API_URL = 'https://poker-range-api-production.up.railway.app';

let _authToken = null;
export function getToken()      { return _authToken; }
export function setToken(t)     { _authToken = t; }
export function clearToken()    { _authToken = null; }

export class RateLimitError extends Error {
  constructor() {
    super('Account temporaneamente sospeso per troppe richieste.');
    this.name = 'RateLimitError';
  }
}

export async function apiFetch(endpoint, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (_authToken) headers['Authorization'] = 'Bearer ' + _authToken;
  let res, json;
  try {
    res  = await fetch(API_URL + endpoint, { ...opts, headers });
    json = await res.json();
  } catch (e) {
    throw new Error('Errore di rete: ' + e.message);
  }
  if (res.status === 429 || (json && json.error === 'RATE_LIMIT_BLOCKED')) throw new RateLimitError();
  if (!res.ok) throw new Error(json.error || 'Errore server');
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
export function apiCheckStatus(accessToken, sessionToken) {
  return apiFetch('/api/check-status', { method: 'POST', body: JSON.stringify({ access_token: accessToken, session_token: sessionToken }) });
}
export function apiResetPasswordRequest(email) {
  return apiFetch('/api/reset-password', { method: 'POST', body: JSON.stringify({ email }) });
}
export function apiNuovaPassword(token, password) {
  return apiFetch('/api/nuova-password', { method: 'POST', body: JSON.stringify({ token, password }) });
}
export function apiRegistrazione({ nome_cognome, email, password, room_principale }) {
  return apiFetch('/api/registrazione', { method: 'POST', body: JSON.stringify({ nome_cognome, email, password, room_principale }) });
}
export async function apiCreaCheckout(email, password) {
  let res, data;
  try {
    res  = await fetch(API_URL + '/api/crea-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
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
  if (data && data.error === 'RATE_LIMIT_BLOCKED') throw new RateLimitError();
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
