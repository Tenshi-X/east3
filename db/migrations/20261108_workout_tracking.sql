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
