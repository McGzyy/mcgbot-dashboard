-- Dedupe table for dashboard alert evaluation (inbox delivery v1).

create table if not exists public.dashboard_alert_fires (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  rule_id text null,
  fire_key text not null,
  fired_at timestamptz not null default now(),
  unique (user_id, fire_key)
);

create index if not exists dashboard_alert_fires_user_fired_idx
  on public.dashboard_alert_fires (user_id, fired_at desc);

comment on table public.dashboard_alert_fires is
  'One row per fired dashboard alert; unique (user_id, fire_key) prevents inbox spam from cron re-runs.';

notify pgrst, 'reload schema';
