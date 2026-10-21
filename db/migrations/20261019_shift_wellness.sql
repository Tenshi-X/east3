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
