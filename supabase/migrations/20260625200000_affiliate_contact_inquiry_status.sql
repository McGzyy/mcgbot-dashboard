-- Ops workflow for public contact form inbox.

alter table public.affiliate_public_contact_inquiries
  add column if not exists status text not null default 'open',
  add column if not exists reviewed_at timestamptz;

alter table public.affiliate_public_contact_inquiries
  drop constraint if exists affiliate_public_contact_inquiries_status_check;

alter table public.affiliate_public_contact_inquiries
  add constraint affiliate_public_contact_inquiries_status_check
  check (status in ('open', 'closed'));

create index if not exists affiliate_public_contact_inquiries_status_created_idx
  on public.affiliate_public_contact_inquiries (status, created_at desc);
