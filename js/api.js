/**
 * API Client - PokerRange Viewer
 * Nuovo flusso OTP a 2 step
 * 1. apiSendOtpRegistration() - Manda OTP
 * 2. apiVerifyOtpRegistration() - Verifica OTP e crea account
 */

const API_BASE = 'https://poker-range-api.production.up.railway.app';

// ===== REGISTRAZIONE STEP 1: SEND OTP =====
async function apiSendOtpRegistration(email, password, nome_cognome, username_poker, room_principale, stack_medio, phone_number) {
  try {
    const response = await fetch(`${API_BASE}/auth/send-otp-registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        nome_cognome,
        username_poker,
        room_principale,
        stack_medio,
        phone_number
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore nell\'invio del codice OTP');
    }

    return {
      success: true,
      message: data.message,
      phone_number: phone_number
    };
  } catch (error) {
    console.error('apiSendOtpRegistration error:', error);
    throw error;
  }
}

// ===== REGISTRAZIONE STEP 2: VERIFY OTP =====
async function apiVerifyOtpRegistration(phone_number, otp_code) {
  try {
    const response = await fetch(`${API_BASE}/auth/verify-otp-registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number,
        otp_code
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore nella verifica del codice OTP');
    }

    return {
      success: true,
      message: data.message
    };
  } catch (error) {
    console.error('apiVerifyOtpRegistration error:', error);
    throw error;
  }
}

// ===== LOGIN =====
async function apiLogin(email, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore durante il login');
    }

    // Salva token in localStorage
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user_id', data.user.id);
    localStorage.setItem('user_email', data.user.email);

    return data;
  } catch (error) {
    console.error('apiLogin error:', error);
    throw error;
  }
}

// ===== CHECK STATUS =====
async function apiCheckStatus() {
  try {
    const access_token = localStorage.getItem('access_token');
    const session_token = localStorage.getItem('session_token');

    if (!access_token) {
      throw new Error('Token non trovato');
    }

    const response = await fetch(`${API_BASE}/auth/check-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token, session_token })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore nel check dello status');
    }

    return data;
  } catch (error) {
    console.error('apiCheckStatus error:', error);
    throw error;
  }
}

// ===== RESET PASSWORD =====
async function apiResetPassword(email) {
  try {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore nell\'invio email reset');
    }

    return data;
  } catch (error) {
    console.error('apiResetPassword error:', error);
    throw error;
  }
}

// ===== NUOVA PASSWORD =====
async function apiNuovaPassword(token, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/nuova-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore nell\'aggiornamento password');
    }

    return data;
  } catch (error) {
    console.error('apiNuovaPassword error:', error);
    throw error;
  }
}

// ===== SEND OTP (PER VERIFICA NUMERO DURANTE LOGIN) =====
async function apiSendOtp(access_token, phone_number) {
  try {
    const response = await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token, phone_number })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore nell\'invio OTP');
    }

    return data;
  } catch (error) {
    console.error('apiSendOtp error:', error);
    throw error;
  }
}

// ===== VERIFY OTP (PER VERIFICA NUMERO DURANTE LOGIN) =====
async function apiVerifyOtp(access_token, phone_number, otp_code) {
  try {
    const response = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token, phone_number, otp_code })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Errore nella verifica OTP');
    }

    return data;
  } catch (error) {
    console.error('apiVerifyOtp error:', error);
    throw error;
  }
}

// ===== LOGOUT =====
function apiLogout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_email');
  localStorage.removeItem('session_token');
}
