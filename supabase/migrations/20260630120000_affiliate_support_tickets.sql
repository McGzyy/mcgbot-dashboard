-- Logged-in affiliate support tickets (distinct from affiliate_public_contact_inquiries).

create table if not exists public.affiliate_support_tickets (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category text not null,
  subject text not null,
  status text not null default 'open',
  closed_at timestamptz,
  constraint affiliate_support_tickets_status_check check (status in ('open', 'closed'))
);

create table if not exists public.affiliate_support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.affiliate_support_tickets (id) on delete cascade,
  created_at timestamptz not null default now(),
  author_role text not null,
  body text not null,
  constraint affiliate_support_ticket_messages_author_role_check check (author_role in ('partner', 'ops'))
);

create index if not exists affiliate_support_tickets_affiliate_updated_idx
  on public.affiliate_support_tickets (affiliate_id, updated_at desc);

create index if not exists affiliate_support_tickets_status_updated_idx
  on public.affiliate_support_tickets (status, updated_at desc);

create index if not exists affiliate_support_ticket_messages_ticket_created_idx
  on public.affiliate_support_ticket_messages (ticket_id, created_at asc);

comment on table public.affiliate_support_tickets is
  'In-dashboard support tickets from logged-in affiliates (payouts, account, tracking).';
comment on table public.affiliate_support_ticket_messages is
  'Thread messages on affiliate support tickets.';

alter table public.affiliate_support_tickets enable row level security;
alter table public.affiliate_support_ticket_messages enable row level security;
