import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import type { Habit, HabitLog } from '../lib/types';

interface HabitState {
  habits: Habit[];
  todayLogs: HabitLog[];
  loading: boolean;

  fetchHabits: () => Promise<void>;
  fetchTodayLogs: (date?: string) => Promise<void>;
  createHabit: (habit: Partial<Habit>) => Promise<{ error: string | null }>;
  updateHabit: (id: string, updates: Partial<Habit>) => Promise<{ error: string | null }>;
  deleteHabit: (id: string) => Promise<{ error: string | null }>;
  logHabit: (habitId: string, value: number, date?: string) => Promise<{ error: string | null }>;
  getStreak: (habitId: string) => Promise<number>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  todayLogs: [],
  loading: false,

  fetchHabits: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('is_active', true)
      .order('created_at');
    set({ habits: data ?? [], loading: false });
  },

  fetchTodayLogs: async (date) => {
    const { habits } = get();
    if (!habits.length) return;
    const today = date ?? format(new Date(), 'yyyy-MM-dd');
    const habitIds = habits.map(h => h.id);

    const { data } = await supabase
      .from('habit_logs')
      .select('*')
      .in('habit_id', habitIds)
      .eq('date', today);

    set({ todayLogs: data ?? [] });
  },

  createHabit: async (habit) => {
    const { data, error } = await supabase
      .from('habits')
      .insert(habit)
      .select()
      .single();

    if (data) set(state => ({ habits: [...state.habits, data] }));
    return { error: error?.message ?? null };
  },

  updateHabit: async (id, updates) => {
    const { error } = await supabase.from('habits').update(updates).eq('id', id);
    if (!error) {
      set(state => ({
        habits: state.habits.map(h => h.id === id ? { ...h, ...updates } : h),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteHabit: async (id) => {
    const { error } = await supabase.from('habits').update({ is_active: false }).eq('id', id);
    if (!error) {
      set(state => ({ habits: state.habits.filter(h => h.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  logHabit: async (habitId, value, date) => {
    const { habits } = get();
    const habit = habits.find(h => h.id === habitId);
    const today = date ?? format(new Date(), 'yyyy-MM-dd');
    const isCompleted = value >= (habit?.target_value ?? 1);

    const { data, error } = await supabase
      .from('habit_logs')
      .upsert({ habit_id: habitId, date: today, value, is_completed: isCompleted }, {
        onConflict: 'habit_id,date',
      })
      .select()
      .single();

    if (data) {
      set(state => ({
        todayLogs: [
          ...state.todayLogs.filter(l => l.habit_id !== habitId),
          data,
        ],
      }));
    }
    return { error: error?.message ?? null };
  },

  getStreak: async (habitId) => {
    const { data } = await supabase
      .from('habit_logs')
      .select('date, is_completed')
      .eq('habit_id', habitId)
      .eq('is_completed', true)
      .order('date', { ascending: false })
      .limit(365);

    if (!data || data.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < data.length; i++) {
      const logDate = new Date(data[i].date);
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);

      if (logDate.toDateString() !== expectedDate.toDateString()) break;
      streak++;
    }

    return streak;
  },
}));