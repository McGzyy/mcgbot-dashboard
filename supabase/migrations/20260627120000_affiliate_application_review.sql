-- Application review states: denied, needs_contact; partner-visible denial reason; structured contact.

alter table public.affiliate_accounts
  drop constraint if exists affiliate_accounts_status_check;

alter table public.affiliate_accounts
  add constraint affiliate_accounts_status_check
  check (status in ('pending', 'active', 'suspended', 'denied', 'needs_contact'));

alter table public.affiliate_accounts
  add column if not exists application_denial_reason text,
  add column if not exists application_contact_email text,
  add column if not exists application_contact_discord text,
  add column if not exists application_contact_x text,
  add column if not exists application_contact_other text;

comment on column public.affiliate_accounts.application_denial_reason is
  'Shown to the applicant when status is denied.';
comment on column public.affiliate_accounts.application_contact_email is
  'Preferred contact email if different from login email.';
comment on column public.affiliate_accounts.application_contact_discord is
  'Discord username or invite/profile URL for ops outreach.';
comment on column public.affiliate_accounts.application_contact_x is
  'X (Twitter) handle or profile URL for ops outreach.';
