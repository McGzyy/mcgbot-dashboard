-- Ops control whether a denied applicant may submit again (and optional cooldown).

alter table public.affiliate_accounts
  add column if not exists application_denial_reapply_allowed boolean not null default false,
  add column if not exists application_reapply_after timestamptz;

comment on column public.affiliate_accounts.application_denial_reapply_allowed is
  'When false (default), denied applicants cannot resubmit. When true, they may resubmit after application_reapply_after (if set).';
comment on column public.affiliate_accounts.application_reapply_after is
  'Earliest time a denied applicant may resubmit when application_denial_reapply_allowed is true. Null = immediate.';
