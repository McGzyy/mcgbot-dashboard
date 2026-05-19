-- Model A loyalty rev-share: default account bps = 15% base tier (1500 bps).

alter table public.affiliate_accounts
  alter column commission_rate_bps set default 1500;
