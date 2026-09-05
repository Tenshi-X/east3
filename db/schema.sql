-- ============================================================
-- east3 — Personal Life OS
-- Neon PostgreSQL Schema
-- ============================================================
-- Run this in the Neon SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;    -- for pgvector

-- ============================================================
-- USERS (replaces Supabase auth.users + profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT UNIQUE NOT NULL,
  password_hash      TEXT NOT NULL,
  salt               TEXT NOT NULL,
  display_name       TEXT,
  timezone           TEXT DEFAULT 'Asia/Jakarta',
  morning_brief_time TIME DEFAULT '07:00:00',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENTS (Smart Calendar)
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_events_user_start ON events(user_id, start_time);

-- ============================================================
-- PRIORITIES (Today Dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS priorities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  title        TEXT NOT NULL,
  is_done      BOOLEAN DEFAULT FALSE,
  order_index  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_priorities_user_date ON priorities(user_id, date);

-- ============================================================
-- TRANSACTIONS (Finance Copilot)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category     TEXT NOT NULL,
  note         TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source       TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, occurred_at);

-- ============================================================
-- BUDGETS (Finance Copilot)
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  monthly_limit  NUMERIC(15,2) NOT NULL CHECK (monthly_limit > 0),
  month          TEXT NOT NULL,   -- Format: 'YYYY-MM'
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, month)
);

-- ============================================================
-- WORKOUT PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  split_type   TEXT DEFAULT 'custom' CHECK (split_type IN ('push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'custom')),
  day_of_week  INTEGER[],   -- 0=Sunday ... 6=Saturday
  exercises    JSONB DEFAULT '[]',  -- [{name, defaultSets, defaultReps}]
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORKOUT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_logs (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id  UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
  date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes    TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_logs_user_date ON workout_logs(user_id, date);

-- ============================================================
-- WORKOUT SETS
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_sets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_name  TEXT NOT NULL,
  weight         NUMERIC(7,2),   -- kg
  reps           INTEGER,
  set_number     INTEGER NOT NULL,
  rpe            NUMERIC(3,1),   -- Rate of Perceived Exertion (1-10)
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HABITS
-- ============================================================
CREATE TABLE IF NOT EXISTS habits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- ============================================================
-- HABIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS habit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id     UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  value        NUMERIC(10,2) DEFAULT 1,
  is_completed BOOLEAN DEFAULT FALSE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, date)
);

-- ============================================================
-- NOTES (Second Brain)
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT DEFAULT 'idea' CHECK (type IN ('meeting', 'idea', 'sop', 'journal', 'bookmark')),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  tags       TEXT[] DEFAULT '{}',
  embedding  vector(768),   -- Gemini text-embedding-004 produces 768-dim vectors
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AI MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content          TEXT NOT NULL,
  tool_call_id     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI ACTION LOGS (Audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_action_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool_name   TEXT NOT NULL,
  params      JSONB,
  result      JSONB,
  model_used  TEXT,
  is_undone   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_action_logs_user ON ai_action_logs(user_id, created_at DESC);

-- ============================================================
-- MORNING BRIEF CACHE
-- ============================================================
CREATE TABLE IF NOT EXISTS morning_briefs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ============================================================
-- HELPER FUNCTION: Semantic note search
-- ============================================================
CREATE OR REPLACE FUNCTION search_notes(
  query_embedding  vector(768),
  match_threshold  FLOAT DEFAULT 0.7,
  match_count      INT   DEFAULT 5,
  p_user_id        UUID
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
    n.user_id = p_user_id
    AND n.embedding IS NOT NULL
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;