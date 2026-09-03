-- ============================================================
-- east3 — Personal Life OS
-- Supabase PostgreSQL Schema + RLS Policies
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT,
  timezone        TEXT DEFAULT 'Asia/Jakarta',
  morning_brief_time TIME DEFAULT '07:00:00',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles: user owns their own" ON profiles
  USING (user_id = auth.uid());
CREATE POLICY "profiles: insert own" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles: update own" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- EVENTS (Smart Calendar)
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  recurrence_rule  TEXT,        -- RRULE string (RFC 5545)
  location         TEXT,
  google_event_id  TEXT,
  color            TEXT DEFAULT '#088395',
  source           TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'google_sync')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events: user owns" ON events USING (user_id = auth.uid());
CREATE POLICY "events: insert" ON events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "events: update" ON events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "events: delete" ON events FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_events_user_start ON events(user_id, start_time);

-- ============================================================
-- PRIORITIES (Today Dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS priorities (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  title        TEXT NOT NULL,
  is_done      BOOLEAN DEFAULT FALSE,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "priorities: user owns" ON priorities USING (user_id = auth.uid());
CREATE POLICY "priorities: insert" ON priorities FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "priorities: update" ON priorities FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "priorities: delete" ON priorities FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_priorities_user_date ON priorities(user_id, date);

-- ============================================================
-- TRANSACTIONS (Finance Copilot)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount       NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category     TEXT NOT NULL,
  note         TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source       TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions: user owns" ON transactions USING (user_id = auth.uid());
CREATE POLICY "transactions: insert" ON transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "transactions: update" ON transactions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "transactions: delete" ON transactions FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_transactions_user_date ON transactions(user_id, occurred_at);

-- ============================================================
-- BUDGETS (Finance Copilot)
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  monthly_limit  NUMERIC(15,2) NOT NULL CHECK (monthly_limit > 0),
  month          TEXT NOT NULL,   -- Format: 'YYYY-MM'
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, month)
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets: user owns" ON budgets USING (user_id = auth.uid());
CREATE POLICY "budgets: insert" ON budgets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "budgets: update" ON budgets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "budgets: delete" ON budgets FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- WORKOUT PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_plans (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  split_type   TEXT DEFAULT 'custom' CHECK (split_type IN ('push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom')),
  day_of_week  INTEGER[],   -- 0=Sunday ... 6=Saturday
  exercises    JSONB DEFAULT '[]',  -- [{name, defaultSets, defaultReps}]
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_plans: user owns" ON workout_plans USING (user_id = auth.uid());
CREATE POLICY "workout_plans: insert" ON workout_plans FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "workout_plans: update" ON workout_plans FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "workout_plans: delete" ON workout_plans FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- WORKOUT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_logs (
  id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id  UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
  date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes    TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_logs: user owns" ON workout_logs USING (user_id = auth.uid());
CREATE POLICY "workout_logs: insert" ON workout_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "workout_logs: update" ON workout_logs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "workout_logs: delete" ON workout_logs FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_workout_logs_user_date ON workout_logs(user_id, date);

-- ============================================================
-- WORKOUT SETS
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_sets (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_name  TEXT NOT NULL,
  weight         NUMERIC(7,2),   -- kg
  reps           INTEGER,
  set_number     INTEGER NOT NULL,
  rpe            NUMERIC(3,1),   -- Rate of Perceived Exertion (1-10)
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
-- RLS via join to workout_logs
CREATE POLICY "workout_sets: user owns via log" ON workout_sets
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = workout_log_id AND wl.user_id = auth.uid()
    )
  );
CREATE POLICY "workout_sets: insert" ON workout_sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = workout_log_id AND wl.user_id = auth.uid()
    )
  );
CREATE POLICY "workout_sets: update" ON workout_sets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = workout_log_id AND wl.user_id = auth.uid()
    )
  );
CREATE POLICY "workout_sets: delete" ON workout_sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = workout_log_id AND wl.user_id = auth.uid()
    )
  );

-- ============================================================
-- HABITS
-- ============================================================
CREATE TABLE IF NOT EXISTS habits (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  target_value  NUMERIC(10,2) DEFAULT 1,
  unit          TEXT DEFAULT 'times',   -- e.g. 'times', 'ml', 'minutes', 'km'
  frequency     TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  icon          TEXT DEFAULT '✅',
  color         TEXT DEFAULT '#088395',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habits: user owns" ON habits USING (user_id = auth.uid());
CREATE POLICY "habits: insert" ON habits FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "habits: update" ON habits FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "habits: delete" ON habits FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- HABIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS habit_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  habit_id     UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  value        NUMERIC(10,2) DEFAULT 1,
  is_completed BOOLEAN DEFAULT FALSE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, date)
);

ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habit_logs: user owns via habit" ON habit_logs
  USING (
    EXISTS (
      SELECT 1 FROM habits h
      WHERE h.id = habit_id AND h.user_id = auth.uid()
    )
  );
CREATE POLICY "habit_logs: insert" ON habit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits h
      WHERE h.id = habit_id AND h.user_id = auth.uid()
    )
  );
CREATE POLICY "habit_logs: update" ON habit_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM habits h
      WHERE h.id = habit_id AND h.user_id = auth.uid()
    )
  );
CREATE POLICY "habit_logs: delete" ON habit_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM habits h
      WHERE h.id = habit_id AND h.user_id = auth.uid()
    )
  );

-- ============================================================
-- NOTES (Second Brain)
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT DEFAULT 'idea' CHECK (type IN ('meeting', 'idea', 'sop', 'journal', 'bookmark')),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  tags       TEXT[] DEFAULT '{}',
  embedding  vector(768),   -- Gemini text-embedding-004 produces 768-dim vectors
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes: user owns" ON notes USING (user_id = auth.uid());
CREATE POLICY "notes: insert" ON notes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "notes: update" ON notes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notes: delete" ON notes FOR DELETE USING (user_id = auth.uid());

-- Index for semantic search
CREATE INDEX idx_notes_embedding ON notes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_conversations: user owns" ON ai_conversations USING (user_id = auth.uid());
CREATE POLICY "ai_conversations: insert" ON ai_conversations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_conversations: update" ON ai_conversations FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "ai_conversations: delete" ON ai_conversations FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AI MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content          TEXT NOT NULL,
  tool_call_id     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_messages: user owns via conversation" ON ai_messages
  USING (
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "ai_messages: insert" ON ai_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

-- ============================================================
-- AI ACTION LOGS (Audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_action_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name   TEXT NOT NULL,
  params      JSONB,
  result      JSONB,
  model_used  TEXT,
  is_undone   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_action_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_action_logs: user owns" ON ai_action_logs USING (user_id = auth.uid());
CREATE POLICY "ai_action_logs: insert" ON ai_action_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_action_logs: update" ON ai_action_logs FOR UPDATE USING (user_id = auth.uid());

CREATE INDEX idx_ai_action_logs_user ON ai_action_logs(user_id, created_at DESC);

-- ============================================================
-- MORNING BRIEF CACHE
-- ============================================================
CREATE TABLE IF NOT EXISTS morning_briefs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE morning_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "morning_briefs: user owns" ON morning_briefs USING (user_id = auth.uid());
CREATE POLICY "morning_briefs: insert" ON morning_briefs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "morning_briefs: update" ON morning_briefs FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- HELPER FUNCTION: Semantic note search
-- ============================================================
CREATE OR REPLACE FUNCTION search_notes(
  query_embedding  vector(768),
  match_threshold  FLOAT DEFAULT 0.7,
  match_count      INT   DEFAULT 5,
  p_user_id        UUID  DEFAULT NULL
)
RETURNS TABLE (
  id         UUID,
  title      TEXT,
  content    TEXT,
  type       TEXT,
  tags       TEXT[],
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.content,
    n.type,
    n.tags,
    1 - (n.embedding <=> query_embedding) AS similarity,
    n.created_at
  FROM notes n
  WHERE
    n.user_id = COALESCE(p_user_id, auth.uid())
    AND n.embedding IS NOT NULL
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
