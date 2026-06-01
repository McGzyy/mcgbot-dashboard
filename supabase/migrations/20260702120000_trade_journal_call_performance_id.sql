-- Optional link from a trade journal entry to a credited call_performance row.

ALTER TABLE public.trade_journal_entries
  ADD COLUMN IF NOT EXISTS call_performance_id bigint REFERENCES public.call_performance(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trade_journal_entries_call_performance_id_idx
  ON public.trade_journal_entries (call_performance_id)
  WHERE call_performance_id IS NOT NULL;

COMMENT ON COLUMN public.trade_journal_entries.call_performance_id IS
  'Optional FK to call_performance — links journal entry to a McGBot call row.';

notify pgrst, 'reload schema';
