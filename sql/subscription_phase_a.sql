-- Phase A: prepaid SOL subscriptions (run in Supabase SQL editor)
-- Adjust prices/durations anytime.

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  duration_days int not null check (duration_days > 0),
  price_usd numeric(12, 2) not null check (price_usd >= 0),
  discount_percent int not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (slug, label, duration_days, price_usd, discount_percent, sort_order)
values
  ('monthly', 'Monthly', 30, 19.00, 0, 1),
  ('six_month', '6 months', 180, 99.00, 10, 2),
  ('annual', '12 months', 365, 179.00, 20, 3)
on conflict (slug) do update set
  label = excluded.label,
  duration_days = excluded.duration_days,
  price_usd = excluded.price_usd,
  discount_percent = excluded.discount_percent,
  sort_order = excluded.sort_order,
  active = true;

create table if not exists public.payment_invoices (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  plan_id uuid not null references public.subscription_plans (id),
  reference_pubkey text not null unique,
  treasury_pubkey text not null,
  lamports bigint not null check (lamports > 0),
  sol_usd numeric(18, 8),
  quote_expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  tx_signature text unique,
  payer_pubkey text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payment_invoices_discord_id_idx on public.payment_invoices (discord_id);
create index if not exists payment_invoices_status_expires_idx
  on public.payment_invoices (status, quote_expires_at);

create table if not exists public.subscriptions (
  discord_id text primary key,
  plan_id uuid references public.subscription_plans (id),
  current_period_end timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_period_end_idx on public.subscriptions (current_period_end);
