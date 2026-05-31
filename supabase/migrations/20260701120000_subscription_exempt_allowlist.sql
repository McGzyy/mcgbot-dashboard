-- Comp subscription bypass list (admin-managed timed or permanent exemptions).

create table if not exists public.subscription_exempt_allowlist (
  discord_id text primary key,
  note text,
  created_at timestamptz not null default now(),
  created_by_discord_id text,
  exempt_until timestamptz
);

create index if not exists subscription_exempt_allowlist_exempt_until_idx
  on public.subscription_exempt_allowlist (exempt_until)
  where exempt_until is not null;

comment on table public.subscription_exempt_allowlist is
  'Discord user IDs granted dashboard access without active Stripe/SOL subscription; admin-managed with optional expiry.';

notify pgrst, 'reload schema';
