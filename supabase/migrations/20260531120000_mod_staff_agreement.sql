-- Mod staff roster + server-side action audit (dashboard service role only).

create table if not exists public.mod_staff (
  discord_id text primary key,
  display_name text,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'terminated')),
  role_tier text not null default 'mod'
    check (role_tier in ('mod', 'head_mod')),
  agreement_version text,
  agreement_signed_at timestamptz,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  stipend_cents integer,
  payout_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mod_staff_status_idx on public.mod_staff (status);

comment on table public.mod_staff is
  'Dashboard mod staff roster — agreement gate, stipend fields for future payout ops. Admin-managed roster; rows may be provisioned on first staff login.';

create table if not exists public.mod_action_audit (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  action text not null check (action in ('approved', 'denied', 'excluded', 'other')),
  subject_type text,
  subject_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mod_action_audit_discord_created_idx
  on public.mod_action_audit (discord_id, created_at desc);

comment on table public.mod_action_audit is
  'Server-side audit trail for mod decisions (complements client mod activity log).';

alter table public.mod_staff enable row level security;
alter table public.mod_action_audit enable row level security;

do $$
begin
  execute 'grant select, insert, update, delete on table public.mod_staff to service_role';
  execute 'grant select, insert, update, delete on table public.mod_action_audit to service_role';
end
$$;
