-- Same as supabase/migrations/20260502140000_stripe_subscription_columns.sql (run in Supabase SQL editor if not using migrations).
alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_status text;

create unique index if not exists subscriptions_stripe_subscription_id_uidx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.subscription_plans
  add column if not exists stripe_price_id text;
