-- X automation columns + safe bootstrap when dashboard_admin_settings was never created.
-- Idempotent: safe to run in Supabase SQL editor on a fresh or partial database.

create table if not exists public.dashboard_admin_settings (
  id int primary key check (id = 1),
  maintenance_enabled boolean not null default false,
  maintenance_message text,
  paywall_subtitle text,
  public_signups_paused boolean not null default false,
  announcement_enabled boolean not null default false,
  announcement_global boolean not null default false,
  announcement_message text,
  announcement_cta_label text,
  announcement_cta_url text,
  announcement_message_mobile text,
  announcement_hide_on_mobile boolean not null default false,
  announcement_allow_user_dismiss boolean not null default false,
  announcement_visible_from timestamptz,
  announcement_visible_until timestamptz,
  paywall_title text,
  subscribe_button_label text,
  discord_invite_url text,
  stats_cutover_at timestamptz,
  trusted_pro_apply_min_total_calls int not null default 0,
  trusted_pro_apply_min_avg_x double precision not null default 0,
  trusted_pro_apply_min_win_rate double precision not null default 0,
  trusted_pro_apply_min_best_x_30d double precision not null default 0,
  session_invalidation_epoch int not null default 0,
  referral_credit_divisor int not null default 5,
  stripe_test_checkout_enabled boolean not null default false,
  stripe_test_price_id text,
  stripe_test_plan_id text,
  tutorial_auto_start_enabled boolean not null default true,
  x_leaderboard_digest_format jsonb,
  social_feed_enabled boolean not null default false,
  outside_calls_enabled boolean not null default true,
  outside_x_polling_enabled boolean not null default true,
  outside_block_phrases jsonb not null default '["scam","stay away","stay out","rug","rug pull","rugpull","honeypot","exit liquidity","don''t buy","do not buy","ponzi","dev sold","fake project","serial rug"]'::jsonb,
  outside_source_cooldown_max int not null default 5,
  outside_source_cooldown_minutes int not null default 60,
  announcement_inbox_broadcast_version text,
  updated_at timestamptz not null default now(),
  updated_by_discord_id text
);

alter table public.dashboard_admin_settings
  add column if not exists x_automation_paused boolean not null default false;

alter table public.dashboard_admin_settings
  add column if not exists x_scheduled_digests_enabled boolean not null default false;

insert into public.dashboard_admin_settings (id)
values (1)
on conflict (id) do nothing;

comment on column public.dashboard_admin_settings.x_automation_paused is
  'When true, bot skips all automated X reads (outside poll, mention poll) and writes (milestones, digests).';

comment on column public.dashboard_admin_settings.x_scheduled_digests_enabled is
  'When true and x_automation_paused is false, bot posts daily / 7d / monthly leaderboard digests on schedule.';
