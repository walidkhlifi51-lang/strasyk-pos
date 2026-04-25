import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/config/env';

let browserClient = null;
const RECOVERY_HINT_KEY = 'strasyk_recovery_pending';
const RECOVERY_DATA_KEY = 'strasyk_recovery_payload';

const persistRecoveryHint = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  const search = new URLSearchParams(window.location.search || '');
  const hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const raw = `${window.location.search || ''} ${window.location.hash || ''}`.toLowerCase();
  const hasRecoveryHint = raw.includes('type=recovery')
    || raw.includes('token_hash=')
    || raw.includes('code=')
    || raw.includes('access_token=');

  if (hasRecoveryHint) {
    window.sessionStorage.setItem(RECOVERY_HINT_KEY, '1');
    const payload = {
      code: search.get('code') || hash.get('code') || '',
      tokenHash: search.get('token_hash') || hash.get('token_hash') || '',
      type: search.get('type') || hash.get('type') || '',
      accessToken: search.get('access_token') || hash.get('access_token') || '',
      refreshToken: search.get('refresh_token') || hash.get('refresh_token') || '',
    };
    window.sessionStorage.setItem(RECOVERY_DATA_KEY, JSON.stringify(payload));
  }
};

export const hasRecoveryHint = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  return window.sessionStorage.getItem(RECOVERY_HINT_KEY) === '1';
};

export const clearRecoveryHint = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  window.sessionStorage.removeItem(RECOVERY_HINT_KEY);
  window.sessionStorage.removeItem(RECOVERY_DATA_KEY);
};

export const getRecoveryHintData = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  const raw = window.sessionStorage.getItem(RECOVERY_DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getSupabaseBrowserClient = () => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase n est pas configure. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.');
  }

  if (!browserClient) {
    persistRecoveryHint();
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
};
