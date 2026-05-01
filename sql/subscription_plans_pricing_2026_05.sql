-- Run once in Supabase SQL editor (or via migration).
-- Aligns plans with: $24.99/mo base, 3 months = 10% off list (3× monthly), 12 months = 15% off list (12× monthly).
-- List prices use discount_percent so /api/subscription/plans shows correct struck-through math.
--
-- After this runs: set subscription_plans.stripe_price_id for each slug to the matching Stripe recurring Price (price_...).
--
-- If you had vouchers tied to slug `six_month`, update those rows/rules to use `quarterly` instead.

begin;

update public.subscription_plans
set
  label = 'Monthly',
  duration_days = 30,
  price_usd = 24.99,
  discount_percent = 0,
  sort_order = 1
where slug = 'monthly';

-- Was 6 months; now 3 months (slug renamed for clarity).
update public.subscription_plans
set
  slug = 'quarterly',
  label = '3 months',
  duration_days = 90,
  price_usd = 74.97, -- 3 × 24.99
  discount_percent = 10,
  sort_order = 2
where slug = 'six_month';

update public.subscription_plans
set
  label = '12 months',
  duration_days = 365,
  price_usd = 299.88, -- 12 × 24.99
  discount_percent = 15,
  sort_order = 3
where slug = 'annual';

commit;
