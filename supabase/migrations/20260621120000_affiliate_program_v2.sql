-- Affiliate program v2: payment-index rev share, milestones, referral lifecycle.

alter table public.affiliate_attributions
  add column if not exists first_paid_at timestamptz,
  add column if not exists last_paid_at timestamptz,
  add column if not exists payment_count integer not null default 0,
  add column if not exists first_plan_product_tier text,
  add column if not exists first_billing_interval text;

comment on column public.affiliate_attributions.payment_count is
  'Successful subscription payments attributed to this referral (1–12 earn rev share).';

alter table public.affiliate_commissions
  add column if not exists payment_index integer,
  add column if not exists commission_rate_bps integer,
  add column if not exists kind text not null default 'revshare';

alter table public.affiliate_commissions
  drop constraint if exists affiliate_commissions_kind_check;

alter table public.affiliate_commissions
  add constraint affiliate_commissions_kind_check
  check (kind in ('revshare', 'annual_signup_bonus', 'milestone'));

create index if not exists affiliate_commissions_affiliate_kind_idx
  on public.affiliate_commissions (affiliate_id, kind, created_at desc);

create table if not exists public.affiliate_milestone_grants (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_accounts (id) on delete cascade,
  tier integer not null check (tier in (10, 25, 50)),
  amount_cents integer not null check (amount_cents > 0),
  qualified_active_count integer not null default 0,
  status text not null default 'pending_approval'
    check (status in ('auto_paid', 'pending_approval', 'approved', 'paid', 'rejected')),
  commission_id uuid references public.affiliate_commissions (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_discord_id text,
  paid_at timestamptz
);

create unique index if not exists affiliate_milestone_grants_affiliate_tier_uidx
  on public.affiliate_milestone_grants (affiliate_id, tier);

comment on table public.affiliate_milestone_grants is
  'One-time partner milestones: 10 ($60 auto), 25 ($150 manual), 50 ($300 manual).';

alter table public.affiliate_milestone_grants enable row level security;

do $$
begin
  execute 'grant select, insert, update, delete on table public.affiliate_milestone_grants to service_role';
end
$$;

alter table public.affiliate_accounts
  add column if not exists agreement_version text,
  add column if not exists agreement_signed_at timestamptz,
  add column if not exists slug_changed_at timestamptz,
  add column if not exists slug_change_pending text;
