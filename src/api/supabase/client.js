import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/config/env';

let browserClient = null;
const RECOVERY_HINT_KEY = 'strasyk_recovery_pending';

const persistRecoveryHint = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;

  const search = window.location.search || '';
  const hash = window.location.hash || '';
  const raw = `${search} ${hash}`.toLowerCase();
  const hasRecoveryHint = raw.includes('type=recovery')
    || raw.includes('token_hash=')
    || raw.includes('code=')
    || raw.includes('access_token=');

  if (hasRecoveryHint) {
    window.sessionStorage.setItem(RECOVERY_HINT_KEY, '1');
  }
};

export const hasRecoveryHint = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  return window.sessionStorage.getItem(RECOVERY_HINT_KEY) === '1';
};

export const clearRecoveryHint = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  window.sessionStorage.removeItem(RECOVERY_HINT_KEY);
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
