alter table public.dashboard_admin_settings
  add column if not exists tutorial_auto_start_enabled boolean not null default true;
