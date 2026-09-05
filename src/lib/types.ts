// ─────────────────────────────────────────────────────────────────────────────
// east3 Database Types — matching Neon PostgreSQL schema
// ─────────────────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  timezone: string;
  morning_brief_time: string;
  created_at: string;
};

export type Event = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  recurrence_rule: string | null;
  location: string | null;
  google_event_id: string | null;
  color: string;
  source: 'manual' | 'ai' | 'google_sync';
  created_at: string;
};

export type Priority = {
  id: string;
  user_id: string;
  date: string;
  title: string;
  is_done: boolean;
  order_index: number;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  note: string | null;
  occurred_at: string;
  source: 'manual' | 'ai';
  created_at: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  month: string;
  created_at: string;
};

export type WorkoutPlan = {
  id: string;
  user_id: string;
  name: string;
  split_type: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'custom';
  day_of_week: number[];
  exercises: any[];
  created_at: string;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  plan_id: string | null;
  date: string;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
};

export type WorkoutSet = {
  id: string;
  workout_log_id: string;
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  set_number: number;
  rpe: number | null;
  notes: string | null;
  created_at: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_value: number;
  unit: string;
  frequency: 'daily' | 'weekly';
  icon: string;
  color: string;
  is_active: boolean;
  created_at: string;
};

export type HabitLog = {
  id: string;
  habit_id: string;
  date: string;
  value: number;
  is_completed: boolean;
  notes: string | null;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  type: 'meeting' | 'idea' | 'sop' | 'journal' | 'bookmark';
  title: string;
  content: string;
  tags: string[];
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
};

export type AIConversation = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type AIMessage = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id: string | null;
  created_at: string;
};

export type AIActionLog = {
  id: string;
  user_id: string;
  tool_name: string;
  params: any;
  result: any;
  model_used: string | null;
  is_undone: boolean;
  created_at: string;
};

export type MorningBrief = {
  id: string;
  user_id: string;
  date: string;
  content: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      events: { Row: Event; Insert: Partial<Event>; Update: Partial<Event> };
      priorities: { Row: Priority; Insert: Partial<Priority>; Update: Partial<Priority> };
      transactions: { Row: Transaction; Insert: Partial<Transaction>; Update: Partial<Transaction> };
      budgets: { Row: Budget; Insert: Partial<Budget>; Update: Partial<Budget> };
      workout_plans: { Row: WorkoutPlan; Insert: Partial<WorkoutPlan>; Update: Partial<WorkoutPlan> };
      workout_logs: { Row: WorkoutLog; Insert: Partial<WorkoutLog>; Update: Partial<WorkoutLog> };
      workout_sets: { Row: WorkoutSet; Insert: Partial<WorkoutSet>; Update: Partial<WorkoutSet> };
      habits: { Row: Habit; Insert: Partial<Habit>; Update: Partial<Habit> };
      habit_logs: { Row: HabitLog; Insert: Partial<HabitLog>; Update: Partial<HabitLog> };
      notes: { Row: Note; Insert: Partial<Note>; Update: Partial<Note> };
      ai_conversations: { Row: AIConversation; Insert: Partial<AIConversation>; Update: Partial<AIConversation> };
      ai_messages: { Row: AIMessage; Insert: Partial<AIMessage>; Update: Partial<AIMessage> };
      ai_action_logs: { Row: AIActionLog; Insert: Partial<AIActionLog>; Update: Partial<AIActionLog> };
      morning_briefs: { Row: MorningBrief; Insert: Partial<MorningBrief>; Update: Partial<MorningBrief> };
    };
  };
};