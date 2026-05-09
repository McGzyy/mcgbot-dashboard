-- Staff can suspend Discord users from making !call / dashboard calls until lifted or suspended_until passes.
-- Enforced in Discord bot (service role read) + dashboard mod APIs (service role).

CREATE TABLE IF NOT EXISTS public.user_call_suspensions (
  discord_id TEXT PRIMARY KEY,
  suspended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended_until TIMESTAMPTZ,
  suspended_by_discord_id TEXT NOT NULL,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_call_suspensions_until
  ON public.user_call_suspensions (suspended_until);

COMMENT ON TABLE public.user_call_suspensions IS
  'When active: row exists and (suspended_until IS NULL OR suspended_until > now()). NULL until = indefinite until lifted.';

ALTER TABLE public.user_call_suspensions ENABLE ROW LEVEL SECURITY;
