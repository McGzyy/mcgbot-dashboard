-- Optional deep link for bell inbox rows (dashboard path or external URL).

alter table public.user_inbox_notifications
  add column if not exists action_href text;

comment on column public.user_inbox_notifications.action_href is
  'Optional CTA target for the bell inbox row — internal path (/help) or external https URL.';

notify pgrst, 'reload schema';
