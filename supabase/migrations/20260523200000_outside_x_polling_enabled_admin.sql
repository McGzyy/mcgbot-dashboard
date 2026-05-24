-- Separate admin gate for bot X timeline reads (save API credits while Outside Calls tape stays live).

alter table public.dashboard_admin_settings
  add column if not exists outside_x_polling_enabled boolean not null default true;

comment on column public.dashboard_admin_settings.outside_x_polling_enabled is
  'When true (and outside_calls_enabled), the Discord bot polls active outside_x_sources on X. When false, tape/submissions stay live but X reads stop.';
