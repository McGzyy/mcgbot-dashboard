-- Rev-share basis = net after Stripe fees (gross stored separately).

alter table public.affiliate_commissions
  add column if not exists stripe_fee_cents integer,
  add column if not exists commission_basis_cents integer;

comment on column public.affiliate_commissions.stripe_fee_cents is
  'Stripe processing fee (cents) deducted from payment_amount_cents for rev-share rows.';
comment on column public.affiliate_commissions.commission_basis_cents is
  'Amount rev-share % applies to (net after Stripe fees). Null on legacy rows and fixed bonuses.';
