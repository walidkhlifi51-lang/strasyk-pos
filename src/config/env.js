export const APP_BACKEND_MODE = import.meta.env.VITE_APP_BACKEND_MODE || 'local';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const APP_PUBLIC_URL = import.meta.env.VITE_APP_PUBLIC_URL || '';
export const ENABLE_TECHNICAL_ROUTES = import.meta.env.VITE_ENABLE_TECH_ROUTES === 'true';
export const STRASYK_API_BASE_URL = import.meta.env.VITE_STRASYK_API_BASE_URL || '';

export const isSupabaseMode = APP_BACKEND_MODE === 'supabase';
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
