import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { WorkoutPlan, WorkoutLog, WorkoutSet } from '../lib/types';

interface WorkoutState {
  plans: WorkoutPlan[];
  logs: (WorkoutLog & { sets: WorkoutSet[] })[];
  loading: boolean;

  fetchPlans: () => Promise<void>;
  fetchLogs: (limit?: number) => Promise<void>;
  createPlan: (plan: Partial<WorkoutPlan>) => Promise<{ id: string | null; error: string | null }>;
  updatePlan: (id: string, updates: Partial<WorkoutPlan>) => Promise<{ error: string | null }>;
  deletePlan: (id: string) => Promise<{ error: string | null }>;
  startWorkoutLog: (planId: string | null, date?: string) => Promise<{ id: string | null; error: string | null }>;
  addSet: (set: Partial<WorkoutSet>) => Promise<{ error: string | null }>;
  getExerciseHistory: (exerciseName: string, limit?: number) => Promise<{
    date: string;
    maxWeight: number;
    totalVolume: number;
    sets: WorkoutSet[];
  }[]>;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  plans: [],
  logs: [],
  loading: false,

  fetchPlans: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from('workout_plans')
      .select('*')
      .order('created_at');
    set({ plans: data ?? [], loading: false });
  },

  fetchLogs: async (limit = 30) => {
    const { data } = await supabase
      .from('workout_logs')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);
    set({ logs: (data as any) ?? [] });
  },

  createPlan: async (plan) => {
    const { data, error } = await supabase
      .from('workout_plans')
      .insert(plan)
      .select()
      .single();

    if (data) set(state => ({ plans: [...state.plans, data] }));
    return { id: data?.id ?? null, error: error?.message ?? null };
  },

  updatePlan: async (id, updates) => {
    const { error } = await supabase.from('workout_plans').update(updates).eq('id', id);
    if (!error) {
      set(state => ({
        plans: state.plans.map(p => p.id === id ? { ...p, ...updates } : p),
      }));
    }
    return { error: error?.message ?? null };
  },

  deletePlan: async (id) => {
    const { error } = await supabase.from('workout_plans').delete().eq('id', id);
    if (!error) set(state => ({ plans: state.plans.filter(p => p.id !== id) }));
    return { error: error?.message ?? null };
  },

  startWorkoutLog: async (planId, date) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { id: null, error: 'Not authenticated' };

    const { data, error } = await supabase
      .from('workout_logs')
      .insert({
        plan_id: planId,
        date: date ?? new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    return { id: data?.id ?? null, error: error?.message ?? null };
  },

  addSet: async (workoutSet) => {
    const { data, error } = await supabase
      .from('workout_sets')
      .insert(workoutSet)
      .select()
      .single();

    if (data) {
      set(state => ({
        logs: state.logs.map(log =>
          log.id === workoutSet.workout_log_id
            ? { ...log, sets: [...(log.sets ?? []), data] }
            : log
        ),
      }));
    }
    return { error: error?.message ?? null };
  },

  getExerciseHistory: async (exerciseName, limit = 12) => {
    const { data } = await supabase
      .from('workout_sets')
      .select('*')
      .eq('exercise_name', exerciseName)
      .order('created_at', { ascending: false })
      .limit(limit * 10);

    if (!data) return [];

    // Group by date (approximate: use created_at date)
    const byDate: Record<string, { date: string; sets: any[] }> = {};
    for (const set of data) {
      const date = (set.created_at ?? '').split('T')[0];
      if (!byDate[date]) byDate[date] = { date, sets: [] };
      byDate[date].sets.push(set);
    }

    return Object.values(byDate)
      .slice(0, limit)
      .map(({ date, sets }) => ({
        date,
        maxWeight: Math.max(...sets.map(s => Number(s.weight ?? 0))),
        totalVolume: sets.reduce((sum, s) => sum + (Number(s.weight ?? 0) * (s.reps ?? 0)), 0),
        sets,
      }));
  },
}));