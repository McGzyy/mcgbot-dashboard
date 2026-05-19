-- Short opaque public link codes for mcgbot.xyz/r/{code}

alter table public.affiliate_accounts
  add column if not exists referral_code text;

alter table public.affiliate_campaigns
  add column if not exists link_code text;

create unique index if not exists affiliate_accounts_referral_code_uidx
  on public.affiliate_accounts (referral_code)
  where referral_code is not null;

create unique index if not exists affiliate_campaigns_link_code_uidx
  on public.affiliate_campaigns (link_code)
  where link_code is not null;

comment on column public.affiliate_accounts.referral_code is
  'Short public code for default tracking link /r/{code} (e.g. H3K8Z).';
comment on column public.affiliate_campaigns.link_code is
  'Short public code for campaign tracking link /r/{code}, unique globally.';
