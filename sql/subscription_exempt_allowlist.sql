-- Dashboard-managed subscription bypass (Discord user snowflakes).
-- Run in Supabase SQL editor after phase A. Server uses service role (bypasses RLS).

create table if not exists public.subscription_exempt_allowlist (
  discord_id text primary key,
  note text,
  created_at timestamptz not null default now(),
  created_by_discord_id text
);

create index if not exists subscription_exempt_allowlist_created_idx
  on public.subscription_exempt_allowlist (created_at desc);

alter table public.subscription_exempt_allowlist enable row level security;
