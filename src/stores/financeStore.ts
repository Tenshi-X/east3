import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import type { Transaction, Budget } from '../lib/types';

interface FinanceState {
  transactions: Transaction[];
  budgets: Budget[];
  loading: boolean;
  error: string | null;

  fetchTransactions: (month?: string) => Promise<void>;
  fetchBudgets: (month?: string) => Promise<void>;
  addTransaction: (tx: Partial<Transaction>) => Promise<{ error: string | null }>;
  deleteTransaction: (id: string) => Promise<{ error: string | null }>;
  setBudget: (budget: Partial<Budget>) => Promise<{ error: string | null }>;

  // Computed getters
  getTotalIncome: (month?: string) => number;
  getTotalExpense: (month?: string) => number;
  getCategoryBreakdown: (month?: string) => { category: string; amount: number; budget?: number }[];
  getBudgetStatus: (category: string, month?: string) => { spent: number; limit: number; remaining: number };
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  transactions: [],
  budgets: [],
  loading: false,
  error: null,

  fetchTransactions: async (month) => {
    set({ loading: true, error: null });
    const targetMonth = month ?? format(new Date(), 'yyyy-MM');
    const startDate = `${targetMonth}-01`;
    const endDate = `${targetMonth}-31`;

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('occurred_at', startDate)
      .lte('occurred_at', `${endDate}T23:59:59`)
      .order('occurred_at', { ascending: false });

    set({ transactions: data ?? [], loading: false, error: error?.message ?? null });
  },

  fetchBudgets: async (month) => {
    const targetMonth = month ?? format(new Date(), 'yyyy-MM');
    const { data } = await supabase
      .from('budgets')
      .select('*')
      .eq('month', targetMonth);
    set({ budgets: data ?? [] });
  },

  addTransaction: async (tx) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert(tx)
      .select()
      .single();

    if (data) {
      set(state => ({ transactions: [data, ...state.transactions] }));
    }
    return { error: error?.message ?? null };
  },

  deleteTransaction: async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (!error) {
      set(state => ({ transactions: state.transactions.filter(t => t.id !== id) }));
    }
    return { error: error?.message ?? null };
  },

  setBudget: async (budget) => {
    const { data, error } = await supabase
      .from('budgets')
      .upsert(budget, { onConflict: 'user_id,category,month' })
      .select()
      .single();

    if (data) {
      set(state => ({
        budgets: [
          ...state.budgets.filter(b => b.category !== data.category),
          data,
        ],
      }));
    }
    return { error: error?.message ?? null };
  },

  getTotalIncome: (month) => {
    const { transactions } = get();
    const targetMonth = month ?? format(new Date(), 'yyyy-MM');
    return transactions
      .filter(t => t.type === 'income' && t.occurred_at.startsWith(targetMonth))
      .reduce((sum, t) => sum + Number(t.amount), 0);
  },

  getTotalExpense: (month) => {
    const { transactions } = get();
    const targetMonth = month ?? format(new Date(), 'yyyy-MM');
    return transactions
      .filter(t => t.type === 'expense' && t.occurred_at.startsWith(targetMonth))
      .reduce((sum, t) => sum + Number(t.amount), 0);
  },

  getCategoryBreakdown: (month) => {
    const { transactions, budgets } = get();
    const targetMonth = month ?? format(new Date(), 'yyyy-MM');
    const expenses = transactions.filter(
      t => t.type === 'expense' && t.occurred_at.startsWith(targetMonth)
    );

    const grouped: Record<string, number> = {};
    for (const tx of expenses) {
      grouped[tx.category] = (grouped[tx.category] ?? 0) + Number(tx.amount);
    }

    return Object.entries(grouped).map(([category, amount]) => ({
      category,
      amount,
      budget: budgets.find(b => b.category === category)?.monthly_limit,
    }));
  },

  getBudgetStatus: (category, month) => {
    const { transactions, budgets } = get();
    const targetMonth = month ?? format(new Date(), 'yyyy-MM');
    const spent = transactions
      .filter(t => t.type === 'expense' && t.category === category && t.occurred_at.startsWith(targetMonth))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const budget = budgets.find(b => b.category === category && b.month === targetMonth);
    const limit = Number(budget?.monthly_limit ?? 0);
    return { spent, limit, remaining: limit - spent };
  },
}));