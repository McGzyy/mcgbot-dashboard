-- Single-row app-wide settings for the Next.js dashboard (admin-editable).
-- Run in Supabase SQL editor. Service role bypasses RLS.

create table if not exists public.dashboard_admin_settings (
  id int primary key check (id = 1),
  maintenance_enabled boolean not null default false,
  maintenance_message text,
  paywall_subtitle text,
  public_signups_paused boolean not null default false,
  announcement_enabled boolean not null default false,
  announcement_message text,
  paywall_title text,
  subscribe_button_label text,
  discord_invite_url text,
  updated_at timestamptz not null default now(),
  updated_by_discord_id text
);

insert into public.dashboard_admin_settings (id) values (1)
on conflict (id) do nothing;

alter table public.dashboard_admin_settings enable row level security;
