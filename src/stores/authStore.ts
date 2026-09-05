import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

interface AuthState {
  session: any | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, loading: false, initialized: true });

    if (session?.user) {
      await get().refreshProfile();
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
      if (session?.user) {
        await get().refreshProfile();
      } else {
        set({ profile: null });
      }
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      await get().refreshProfile();
    }
    return { error: error?.message ?? null };
  },

  signUp: async (email, password, displayName) => {
    const { data } = await supabase.auth.signUp(email, password, displayName);
    set({ session: data?.session ?? null });
    await get().refreshProfile();
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  updateProfile: async (updates) => {
    const { session } = get();
    if (!session?.user) return { error: 'Not authenticated' };

    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json();
        return { error: data.error ?? 'Failed to update profile' };
      }
      const { user: updated } = await res.json();
      set(state => ({
        profile: state.profile ? { ...state.profile, ...updated } : updated,
      }));
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  refreshProfile: async () => {
    const { session } = get();
    if (!session?.user) return;

    try {
      const res = await supabase.auth.getUser();
      const user = res.data?.user;
      if (user) set({ profile: user });
    } catch {
      // Decoded from token, use it
      const res = await supabase.auth.getSession();
      const user = res.data?.session?.user;
      set({ profile: user });
    }
  },
}));