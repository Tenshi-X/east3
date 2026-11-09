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
CREATE TABLE IF NOT EXISTS wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  type            TEXT NOT NULL DEFAULT 'ewallet' CHECK (type IN ('bank', 'ewallet', 'cash', 'other')),
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id    UUID REFERENCES wallets(id),
  amount       NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category     TEXT NOT NULL,
  note         TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source       TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON transactions(user_id, occurred_at);
CREATE INDEX idx_transactions_wallet ON transactions(wallet_id);

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
  step_value    NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (step_value > 0),
  settings      JSONB NOT NULL DEFAULT '{}',
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
  p_user_id        UUID DEFAULT NULL
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

-- Shift-aware health and planning
-- Shift-aware planning and conversational health records. No personal data is seeded.
CREATE TABLE IF NOT EXISTS health_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  height_cm NUMERIC CHECK (height_cm BETWEEN 50 AND 250),
  weight_kg NUMERIC CHECK (weight_kg BETWEEN 20 AND 350),
  target_weight_kg NUMERIC CHECK (target_weight_kg BETWEEN 20 AND 350),
  age INTEGER CHECK (age BETWEEN 1 AND 120),
  calorie_target INTEGER CHECK (calorie_target BETWEEN 500 AND 6000),
  protein_target NUMERIC CHECK (protein_target BETWEEN 10 AND 300),
  meals_target INTEGER NOT NULL DEFAULT 3 CHECK (meals_target BETWEEN 2 AND 6),
  sleep_hours NUMERIC NOT NULL DEFAULT 8 CHECK (sleep_hours BETWEEN 6 AND 10),
  wake_time TEXT NOT NULL DEFAULT '07:00',
  bed_time TEXT NOT NULL DEFAULT '23:00',
  commute_minutes INTEGER NOT NULL DEFAULT 30 CHECK (commute_minutes BETWEEN 0 AND 180),
  handover_minutes INTEGER NOT NULL DEFAULT 30 CHECK (handover_minutes BETWEEN 0 AND 120),
  workout_weekly INTEGER NOT NULL DEFAULT 2 CHECK (workout_weekly BETWEEN 1 AND 5),
  workout_minutes INTEGER NOT NULL DEFAULT 30 CHECK (workout_minutes BETWEEN 10 AND 90),
  preferences TEXT NOT NULL DEFAULT '',
  reminders_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  code TEXT NOT NULL CHECK (code IN ('1', '2', '3', '1&2', '2&3', 'L')),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date),
  CHECK ((code = 'L' AND start_time IS NULL AND end_time IS NULL) OR
    (code <> 'L' AND start_time IS NOT NULL AND end_time > start_time))
);
CREATE INDEX IF NOT EXISTS shift_assignments_user_time ON shift_assignments(user_id, start_time, end_time);

CREATE TABLE IF NOT EXISTS wellness_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('meal', 'weight', 'sleep', 'energy')),
  date DATE NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL DEFAULT '',
  calories NUMERIC CHECK (calories BETWEEN 0 AND 10000),
  protein_g NUMERIC CHECK (protein_g BETWEEN 0 AND 500),
  weight_kg NUMERIC CHECK (weight_kg BETWEEN 20 AND 350),
  sleep_hours NUMERIC CHECK (sleep_hours BETWEEN 0 AND 24),
  energy INTEGER CHECK (energy BETWEEN 1 AND 5),
  is_estimate BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((kind = 'meal' AND length(trim(description)) > 0) OR
    (kind = 'weight' AND weight_kg IS NOT NULL) OR
    (kind = 'sleep' AND sleep_hours IS NOT NULL) OR
    (kind = 'energy' AND energy IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS wellness_logs_user_date ON wellness_logs(user_id, date, logged_at);

CREATE TABLE IF NOT EXISTS daily_plan_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  item_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'snoozed')),
  snoozed_until TIMESTAMPTZ,
  item JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date, item_key)
);

ALTER TABLE priorities ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 15 CHECK (duration_minutes BETWEEN 5 AND 240);
ALTER TABLE priorities ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE priorities ADD COLUMN IF NOT EXISTS energy TEXT NOT NULL DEFAULT 'low' CHECK (energy IN ('low', 'medium', 'high'));
ALTER TABLE priorities ADD COLUMN IF NOT EXISTS is_fixed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'weekly' CHECK (schedule_mode IN ('weekly', 'flexible'));
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS actions JSONB NOT NULL DEFAULT '[]';

ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS activity_type TEXT NOT NULL DEFAULT 'workout' CHECK (activity_type IN ('workout', 'jogging'));
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS duration_seconds INTEGER CHECK (duration_seconds BETWEEN 1 AND 86400);
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS distance_meters NUMERIC CHECK (distance_meters BETWEEN 0 AND 200000);
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS distance_source TEXT NOT NULL DEFAULT 'none' CHECK (distance_source IN ('none', 'gps', 'manual'));
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS exercise_progress JSONB NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX IF NOT EXISTS workout_logs_client_id ON workout_logs(user_id, client_id);
CREATE TABLE IF NOT EXISTS workout_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS atlas_owner (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id)
);
INSERT INTO atlas_owner (user_id)
SELECT id FROM users WHERE (SELECT COUNT(*) FROM users) = 1
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS personal_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS personal_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('preference','decision','goal','context')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  share_with_ai BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS personal_memories_owner ON personal_memories(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS personal_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  goal TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 240),
  energy TEXT NOT NULL DEFAULT 'medium' CHECK (energy IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE priorities ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES personal_projects(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS personal_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  category TEXT NOT NULL DEFAULT 'utilities',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS personal_bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES personal_bills(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bill_id, period)
);
CREATE TABLE IF NOT EXISTS personal_overtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  kind TEXT NOT NULL CHECK (kind IN ('regular','holiday')),
  estimated_amount NUMERIC(15,2) NOT NULL CHECK (estimated_amount >= 0),
  formula JSONB NOT NULL,
  received_amount NUMERIC(15,2) CHECK (received_amount >= 0),
  paid_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS personal_captures (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
