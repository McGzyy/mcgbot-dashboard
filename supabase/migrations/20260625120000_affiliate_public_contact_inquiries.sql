-- Pre-signup / public affiliate portal contact form (not logged-in support tickets).

create table if not exists public.affiliate_public_contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  category text not null,
  subject text not null,
  message text not null,
  page_path text,
  user_agent text,
  ip_hash text
);

create index if not exists affiliate_public_contact_inquiries_created_at_idx
  on public.affiliate_public_contact_inquiries (created_at desc);

comment on table public.affiliate_public_contact_inquiries is
  'Contact form submissions from the public affiliate marketing site (prospects). Distinct from in-dashboard affiliate support tickets.';

-- Simple rate limit by hashed IP (no PII stored beyond hash).
create table if not exists public.affiliate_public_contact_throttle (
  ip_hash text primary key,
  attempts int not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.affiliate_public_contact_inquiries enable row level security;
alter table public.affiliate_public_contact_throttle enable row level security;
