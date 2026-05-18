-- Partner application details + ops review notes.

alter table public.affiliate_accounts
  add column if not exists application_legal_name text,
  add column if not exists application_company_name text,
  add column if not exists application_country text,
  add column if not exists application_primary_channel text,
  add column if not exists application_audience_size text,
  add column if not exists application_promo_methods text,
  add column if not exists application_social_links text,
  add column if not exists application_website_url text,
  add column if not exists application_notes text,
  add column if not exists application_draft_terms_accepted_at timestamptz,
  add column if not exists application_submitted_at timestamptz,
  add column if not exists admin_review_notes text;

comment on column public.affiliate_accounts.application_submitted_at is
  'When the partner submitted the self-serve application form.';
