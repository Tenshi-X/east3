// Re-export from the new API client (Neon/Vercel)
export { supabase as default, supabase, auth, from, setAccessToken } from './api';
export type { Database } from './types';