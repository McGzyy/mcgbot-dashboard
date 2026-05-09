-- Optional visibility window for global announcement (run once; mirrors Supabase migration).

ALTER TABLE public.dashboard_admin_settings
  ADD COLUMN IF NOT EXISTS announcement_visible_from TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS announcement_visible_until TIMESTAMPTZ NULL;
