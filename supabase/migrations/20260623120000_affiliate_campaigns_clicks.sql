-- Partner campaigns (sub-links) and click analytics.

create table if not exists public.affiliate_campaigns (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_accounts (id) on delete cascade,
  slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint affiliate_campaigns_slug_len check (char_length(btrim(slug)) >= 2 and char_length(btrim(slug)) <= 30)
);

create unique index if not exists affiliate_campaigns_affiliate_slug_uidx
  on public.affiliate_campaigns (affiliate_id, lower(btrim(slug)));

create index if not exists affiliate_campaigns_affiliate_idx
  on public.affiliate_campaigns (affiliate_id, created_at desc);

comment on table public.affiliate_campaigns is
  'Named tracking links for partners: /affiliate/r/{affiliate_slug}?c={campaign_slug}';

create table if not exists public.affiliate_link_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_accounts (id) on delete cascade,
  campaign_id uuid references public.affiliate_campaigns (id) on delete set null,
  clicked_at bigint not null,
  referrer text,
  landing_path text
);

create index if not exists affiliate_link_clicks_affiliate_clicked_idx
  on public.affiliate_link_clicks (affiliate_id, clicked_at desc);

create index if not exists affiliate_link_clicks_campaign_idx
  on public.affiliate_link_clicks (campaign_id)
  where campaign_id is not null;

comment on table public.affiliate_link_clicks is
  'Landing-page views on /affiliate/r/* before Discord redirect.';

alter table public.affiliate_campaigns enable row level security;
alter table public.affiliate_link_clicks enable row level security;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'affiliate_campaigns') then
    execute 'grant select, insert, update, delete on table public.affiliate_campaigns to service_role';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'affiliate_link_clicks') then
    execute 'grant select, insert, update, delete on table public.affiliate_link_clicks to service_role';
  end if;
end
$$;
