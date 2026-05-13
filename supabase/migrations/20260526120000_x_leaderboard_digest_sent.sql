-- Idempotency for /api/cron/x-leaderboard-digest (one post per closed period per kind).
CREATE TABLE IF NOT EXISTS x_leaderboard_digest_sent (
  id BIGSERIAL PRIMARY KEY,
  digest_kind TEXT NOT NULL CHECK (digest_kind IN ('daily', 'weekly', 'monthly')),
  period_start_ms BIGINT NOT NULL,
  tweet_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (digest_kind, period_start_ms)
);

COMMENT ON TABLE x_leaderboard_digest_sent IS 'Prevents duplicate X leaderboard digest posts for the same closed UTC period.';
