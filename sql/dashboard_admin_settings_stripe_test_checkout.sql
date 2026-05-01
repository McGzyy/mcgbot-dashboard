-- Run in Supabase SQL editor if you prefer not to use supabase migration CLI.
-- Optional Stripe test checkout row extensions (id = 1).

alter table public.dashboard_admin_settings
  add column if not exists stripe_test_checkout_enabled boolean not null default false;

alter table public.dashboard_admin_settings
  add column if not exists stripe_test_price_id text;

alter table public.dashboard_admin_settings
  add column if not exists stripe_test_plan_id uuid references public.subscription_plans (id);
