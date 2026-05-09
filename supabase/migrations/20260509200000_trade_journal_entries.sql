-- Per-user trade journal (private ledger on dashboard). Access enforced in Next API via service role + session discord id.

CREATE TABLE IF NOT EXISTS public.trade_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  mint TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  has_edge BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_journal_entries_user_created
  ON public.trade_journal_entries (discord_user_id, created_at DESC);

COMMENT ON TABLE public.trade_journal_entries IS 'Dashboard trade journal rows; scoped by discord_user_id in application code.';

ALTER TABLE public.trade_journal_entries ENABLE ROW LEVEL SECURITY;
