-- Run once before deploying the wallet and habit-template update.
-- Safe to run again; existing transactions remain unassigned to a wallet.
BEGIN;
CREATE TABLE IF NOT EXISTS wallets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  type            TEXT NOT NULL DEFAULT 'ewallet' CHECK (type IN ('bank', 'ewallet', 'cash', 'other')),
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES wallets(id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS step_value NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (step_value > 0);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
COMMIT;
