-- Payout requests, slug aliases (after vanity change), and slug request metadata.

create table if not exists public.affiliate_slug_aliases (
  slug text primary key,
  affiliate_id uuid not null references public.affiliate_accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint affiliate_slug_aliases_slug_len check (char_length(btrim(slug)) >= 3)
);

create index if not exists affiliate_slug_aliases_affiliate_idx
  on public.affiliate_slug_aliases (affiliate_id);

comment on table public.affiliate_slug_aliases is
  'Previous vanity slugs that still resolve to /affiliate/r/{slug} after an approved change.';

create table if not exists public.affiliate_payout_requests (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_accounts (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'rejected')),
  partner_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_discord_id text,
  paid_at timestamptz
);

create index if not exists affiliate_payout_requests_affiliate_created_idx
  on public.affiliate_payout_requests (affiliate_id, created_at desc);

create index if not exists affiliate_payout_requests_status_idx
  on public.affiliate_payout_requests (status, created_at desc);

comment on table public.affiliate_payout_requests is
  'Partner-initiated payout requests against approved commission balance.';

alter table public.affiliate_slug_aliases enable row level security;
alter table public.affiliate_payout_requests enable row level security;

do $$
begin
  execute 'grant select, insert, update, delete on table public.affiliate_slug_aliases to service_role';
  execute 'grant select, insert, update, delete on table public.affiliate_payout_requests to service_role';
end
$$;
