import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/config/env';

let browserClient = null;

export const getSupabaseBrowserClient = () => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase n est pas configure. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.');
  }

  if (!browserClient) {
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
