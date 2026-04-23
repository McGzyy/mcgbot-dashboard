-- Extend dashboard_admin_settings (run after dashboard_admin_settings.sql).

alter table public.dashboard_admin_settings
  add column if not exists announcement_enabled boolean not null default false;

alter table public.dashboard_admin_settings
  add column if not exists announcement_message text;

alter table public.dashboard_admin_settings
  add column if not exists announcement_cta_label text;

alter table public.dashboard_admin_settings
  add column if not exists announcement_cta_url text;

alter table public.dashboard_admin_settings
  add column if not exists paywall_title text;

alter table public.dashboard_admin_settings
  add column if not exists subscribe_button_label text;

alter table public.dashboard_admin_settings
  add column if not exists discord_invite_url text;

alter table public.dashboard_admin_settings
  add column if not exists stats_cutover_at timestamptz;

alter table public.dashboard_admin_settings
  add column if not exists session_invalidation_epoch bigint not null default 0;
