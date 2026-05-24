-- Outside Calls product gate (dashboard tape + bot X poller).

alter table public.dashboard_admin_settings
  add column if not exists outside_calls_enabled boolean not null default true;

comment on column public.dashboard_admin_settings.outside_calls_enabled is
  'When true, Pro Outside Calls tape and bot outside_x_sources X polling are active. When false, Pro users see coming soon and poller skips reads.';
