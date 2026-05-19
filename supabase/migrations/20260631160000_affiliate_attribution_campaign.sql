-- Attribute signups to a partner campaign when the user converted via a campaign short link.

alter table public.affiliate_attributions
  add column if not exists campaign_id uuid references public.affiliate_campaigns (id) on delete set null;

create index if not exists affiliate_attributions_campaign_idx
  on public.affiliate_attributions (campaign_id)
  where campaign_id is not null;

comment on column public.affiliate_attributions.campaign_id is
  'Campaign sub-link that drove this signup, when known (from last-click cookie at conversion).';
