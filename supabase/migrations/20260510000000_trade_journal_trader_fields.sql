-- Same as repo-root supabase/migrations/20260510000000_trade_journal_trader_fields.sql (dashboard journal enrich).

ALTER TABLE public.trade_journal_entries
  ADD COLUMN IF NOT EXISTS entry_mcap_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS exit_mcap_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS exit_mcaps_note TEXT,
  ADD COLUMN IF NOT EXISTS profit_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS profit_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS thesis TEXT,
  ADD COLUMN IF NOT EXISTS narrative TEXT,
  ADD COLUMN IF NOT EXISTS entry_justification TEXT,
  ADD COLUMN IF NOT EXISTS planned_invalidation TEXT,
  ADD COLUMN IF NOT EXISTS lessons_learned TEXT,
  ADD COLUMN IF NOT EXISTS token_symbol TEXT,
  ADD COLUMN IF NOT EXISTS token_name TEXT,
  ADD COLUMN IF NOT EXISTS timeframe TEXT,
  ADD COLUMN IF NOT EXISTS position_size_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS entry_price_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS exit_price_usd NUMERIC;
