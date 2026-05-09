-- Mirror of repo-root supabase/migrations/20260510120000_announcement_schedule.sql

ALTER TABLE public.dashboard_admin_settings
  ADD COLUMN IF NOT EXISTS announcement_visible_from TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS announcement_visible_until TIMESTAMPTZ NULL;
