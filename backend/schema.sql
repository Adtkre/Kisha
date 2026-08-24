-- Kisha database schema (PostgreSQL)
-- Run this once against your database before starting the server:
--   psql -d kisha -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  age             INTEGER,
  height          NUMERIC,
  weight          NUMERIC,
  avg_cycle_length   INTEGER DEFAULT 28,
  avg_period_length  INTEGER DEFAULT 5,
  exercise_frequency TEXT,
  conditions      TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS period_days (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date     DATE NOT NULL,
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS period_end_dates (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date     DATE NOT NULL,
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      DATE NOT NULL,
  mood      TEXT,
  flow      TEXT,
  pain      NUMERIC,
  sleep     NUMERIC,
  water     NUMERIC,
  exercise  TEXT,
  stress    TEXT,
  symptoms  JSONB DEFAULT '[]'::jsonb,
  notes     TEXT,
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_period_days_user ON period_days(user_id);
CREATE INDEX IF NOT EXISTS idx_period_end_dates_user ON period_end_dates(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs(user_id, date);
