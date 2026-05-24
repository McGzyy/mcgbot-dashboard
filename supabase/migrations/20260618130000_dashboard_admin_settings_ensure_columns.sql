-- Idempotent columns for dashboard_admin_settings (safe to re-run on prod).

alter table public.dashboard_admin_settings
  add column if not exists announcement_global boolean not null default false;

alter table public.dashboard_admin_settings
  add column if not exists social_feed_enabled boolean not null default false;

alter table public.dashboard_admin_settings
  add column if not exists outside_calls_enabled boolean not null default true;

alter table public.dashboard_admin_settings
  add column if not exists outside_x_polling_enabled boolean not null default true;

comment on column public.dashboard_admin_settings.announcement_global is
  'If true, show the announcement bar on bare pages (e.g. /join/verify, /auth).';

comment on column public.dashboard_admin_settings.social_feed_enabled is
  'When true, home Social Feed panel and X timeline ingest are enabled.';

comment on column public.dashboard_admin_settings.outside_calls_enabled is
  'When true, Pro Outside Calls tape and submissions are live. When false, Pro users see coming soon.';

comment on column public.dashboard_admin_settings.outside_x_polling_enabled is
  'When true (and outside_calls_enabled), bot polls outside_x_sources on X. When false, X reads stop to save credits.';

alter table public.dashboard_admin_settings
  add column if not exists outside_block_phrases jsonb not null default '["scam","stay away","stay out","rug","rug pull","rugpull","honeypot","exit liquidity","don''t buy","do not buy","ponzi","dev sold","fake project","serial rug"]'::jsonb;

alter table public.dashboard_admin_settings
  add column if not exists outside_source_cooldown_max int not null default 5;

alter table public.dashboard_admin_settings
  add column if not exists outside_source_cooldown_minutes int not null default 60;

alter table public.outside_calls
  add column if not exists post_text text;

alter table public.outside_calls
  add column if not exists post_media_urls jsonb not null default '[]'::jsonb;
