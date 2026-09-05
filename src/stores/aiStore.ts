import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Note, AIConversation, AIMessage, AIActionLog } from '../lib/types';

interface AIState {
  conversations: AIConversation[];
  activeConversation: AIConversation | null;
  messages: AIMessage[];
  actionLogs: AIActionLog[];
  streaming: boolean;
  loading: boolean;
  error: string | null;

  fetchConversations: () => Promise<void>;
  startConversation: (title?: string) => Promise<{ id: string | null; error: string | null }>;
  loadConversation: (id: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    userMessage?: string
  ) => Promise<{ error: string | null }>;
  deleteConversation: (id: string) => Promise<void>;
  fetchActionLogs: (limit?: number) => Promise<void>;
  undoLastAction: () => Promise<{ error: string | null }>;
}

// Notes store
interface NotesState {
  notes: Note[];
  loading: boolean;

  fetchNotes: (type?: Note['type']) => Promise<void>;
  createNote: (note: Partial<Note>) => Promise<{ id: string | null; error: string | null }>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<{ error: string | null }>;
  deleteNote: (id: string) => Promise<{ error: string | null }>;
  searchNotes: (query: string) => Promise<Note[]>;
}

export const useNotesStore = create<NotesState>((set) => ({
  notes: [],
  loading: false,

  fetchNotes: async (type) => {
    set({ loading: true });
    let query = supabase.from('notes').select('*').order('created_at', { ascending: false });
    if (type) query = query.eq('type', type);
    const { data } = await query;
    set({ notes: data ?? [], loading: false });
  },

  createNote: async (note) => {
    const { data, error } = await supabase
      .from('notes')
      .insert(note)
      .select()
      .single();

    if (data) set(state => ({ notes: [data, ...state.notes] }));
    return { id: data?.id ?? null, error: error?.message ?? null };
  },

  updateNote: async (id, updates) => {
    const { error } = await supabase.from('notes').update(updates).eq('id', id);
    if (!error) {
      set(state => ({
        notes: state.notes.map(n => n.id === id ? { ...n, ...updates } : n),
      }));
    }
    return { error: error?.message ?? null };
  },

  deleteNote: async (id) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (!error) set(state => ({ notes: state.notes.filter(n => n.id !== id) }));
    return { error: error?.message ?? null };
  },

  searchNotes: async (query) => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .ilike('title', query)
      .order('created_at', { ascending: false })
      .limit(10);
    return data ?? [];
  },
}));

export const useAIStore = create<AIState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  actionLogs: [],
  streaming: false,
  loading: false,
  error: null,

  fetchConversations: async () => {
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(20);
    set({ conversations: data ?? [] });
  },

  startConversation: async (title = 'New Conversation') => {
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ title })
      .select()
      .single();

    if (data) {
      set(state => ({
        conversations: [data, ...state.conversations],
        activeConversation: data,
        messages: [],
      }));
    }
    return { id: data?.id ?? null, error: error?.message ?? null };
  },

  loadConversation: async (id) => {
    set({ loading: true });
    const conv = get().conversations.find(c => c.id === id);
    const { data: messages } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at');

    set({ activeConversation: conv ?? null, messages: messages ?? [], loading: false });
  },

  sendMessage: async (conversationId, content) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { error: 'Not authenticated' };
    const token = session?.access_token ?? '';

    // Save user message to DB
    const { data: userMsg } = await supabase
      .from('ai_messages')
      .insert({ conversation_id: conversationId, role: 'user', content })
      .select()
      .single();

    if (userMsg) {
      set(state => ({ messages: [...state.messages, userMsg] }));
    }

    set({ streaming: true, error: null });

    try {
      // Call AI proxy (Vercel serverless function)
      const proxyUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
      const response = await fetch(`${proxyUrl}/api/ai-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: content,
        }),
      });

      if (!response.ok) throw new Error(`AI proxy error: ${response.status}`);

      const result = await response.json();

      // Save assistant response
      const { data: assistantMsg } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: result.message,
        })
        .select()
        .single();

      if (assistantMsg) {
        set(state => ({ messages: [...state.messages, assistantMsg] }));
      }

      // Update conversation title if first message
      const { messages } = get();
      if (messages.length <= 2) {
        const title = content.length > 50 ? content.slice(0, 50) + '...' : content;
        await supabase
          .from('ai_conversations')
          .update({ title })
          .eq('id', conversationId);
      }

      return { error: null };
    } catch (err: any) {
      set({ error: err.message });
      return { error: err.message };
    } finally {
      set({ streaming: false });
    }
  },

  deleteConversation: async (id) => {
    await supabase.from('ai_conversations').delete().eq('id', id);
    set(state => ({
      conversations: state.conversations.filter(c => c.id !== id),
      activeConversation: state.activeConversation?.id === id ? null : state.activeConversation,
      messages: state.activeConversation?.id === id ? [] : state.messages,
    }));
  },

  fetchActionLogs: async (limit = 20) => {
    const { data } = await supabase
      .from('ai_action_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    set({ actionLogs: data ?? [] });
  },

  undoLastAction: async () => {
    const { actionLogs } = get();
    const lastAction = actionLogs.find(l => !l.is_undone);
    if (!lastAction) return { error: 'No action to undo' };

    // Mark as undone
    await supabase
      .from('ai_action_logs')
      .update({ is_undone: true })
      .eq('id', lastAction.id);

    // Attempt to reverse the action based on tool_name + result
    const { tool_name, result } = lastAction;
    try {
      if (result?.id) {
        const tableMap: Record<string, string> = {
          create_event: 'events',
          create_priority: 'priorities',
          log_transaction: 'transactions',
          create_note: 'notes',
          create_habit: 'habits',
        };
        const table = tableMap[tool_name];
        if (table) {
          await (supabase.from(table as any).delete().eq('id', result.id) as any);
        }
      }

      set(state => ({
        actionLogs: state.actionLogs.map(l =>
          l.id === lastAction.id ? { ...l, is_undone: true } : l
        ),
      }));

      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    }
  },
}));