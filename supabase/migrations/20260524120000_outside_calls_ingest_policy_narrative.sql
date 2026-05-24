-- Outside Calls: admin block phrases, per-source cooldown, post narrative + media.

alter table public.dashboard_admin_settings
  add column if not exists outside_block_phrases jsonb not null default '["scam","stay away","stay out","rug","rug pull","rugpull","honeypot","exit liquidity","don''t buy","do not buy","ponzi","dev sold","fake project","serial rug"]'::jsonb;

alter table public.dashboard_admin_settings
  add column if not exists outside_source_cooldown_max int not null default 5;

alter table public.dashboard_admin_settings
  add column if not exists outside_source_cooldown_minutes int not null default 60;

alter table public.outside_calls
  add column if not exists post_text text;

alter table public.outside_calls
  add column if not exists post_media_urls jsonb not null default '[]'::jsonb;

comment on column public.dashboard_admin_settings.outside_block_phrases is
  'Lowercase substring blocklist; tweets containing any phrase are skipped before Telegram/FaSol.';

comment on column public.dashboard_admin_settings.outside_source_cooldown_max is
  'Max outside_calls rows per source within the cooldown window (0 = unlimited).';

comment on column public.dashboard_admin_settings.outside_source_cooldown_minutes is
  'Rolling window for per-source call cap.';

comment on column public.outside_calls.post_text is
  'Full X post text that contained the CA (narrative / context for the tape).';

comment on column public.outside_calls.post_media_urls is
  'Image URLs from the X post attachments (photos / video previews).';
