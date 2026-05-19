-- Default partner commission rate: 20% (2000 bps), aligned with primary rev-share tier.

alter table public.affiliate_accounts
  alter column commission_rate_bps set default 2000;
