-- Commission hold window before pending → approved.

alter table public.affiliate_commissions
  add column if not exists eligible_at timestamptz,
  add column if not exists billing_interval text;

comment on column public.affiliate_commissions.eligible_at is
  'UTC timestamp when a pending commission may auto-approve (30d monthly / 90d annual rev share).';

comment on column public.affiliate_commissions.billing_interval is
  'Snapshot of referred member first_billing_interval at commission time (monthly | annual).';

create index if not exists affiliate_commissions_pending_eligible_idx
  on public.affiliate_commissions (eligible_at)
  where status = 'pending' and eligible_at is not null;

-- Backfill: monthly hold default for existing pending rows.
update public.affiliate_commissions c
set
  billing_interval = coalesce(
    a.first_billing_interval,
    case when c.kind = 'annual_signup_bonus' then 'annual' else 'monthly' end
  ),
  eligible_at = coalesce(
    c.eligible_at,
    c.created_at + case
      when coalesce(a.first_billing_interval, case when c.kind = 'annual_signup_bonus' then 'annual' else 'monthly' end) = 'annual'
        then interval '90 days'
      else interval '30 days'
    end
  )
from public.affiliate_attributions a
where c.status = 'pending'
  and c.referred_user_id is not null
  and a.referred_user_id = c.referred_user_id;

update public.affiliate_commissions
set
  eligible_at = coalesce(eligible_at, created_at + interval '30 days')
where status = 'pending'
  and eligible_at is null;
