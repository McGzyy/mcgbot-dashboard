-- Staff notes on queue items + escalations to admin.

create extension if not exists pgcrypto;

create table if not exists public.mod_item_notes (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id text not null,
  author_discord_id text not null,
  note text not null check (char_length(btrim(note)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mod_item_notes_subject_created_idx
  on public.mod_item_notes (subject_type, subject_id, created_at desc);

comment on table public.mod_item_notes is
  'Internal staff notes on moderation queue items — not visible to members.';

create table if not exists public.mod_escalations (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id text not null,
  raised_by_discord_id text not null,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  reason text not null check (char_length(btrim(reason)) > 0),
  detail jsonb not null default '{}'::jsonb,
  admin_notes text,
  resolved_at timestamptz,
  resolved_by_discord_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mod_escalations_status_created_idx
  on public.mod_escalations (status, created_at desc);

create index if not exists mod_escalations_subject_idx
  on public.mod_escalations (subject_type, subject_id);

comment on table public.mod_escalations is
  'Moderator escalations to admin — edge cases, policy questions, or high-risk items.';

alter table public.mod_item_notes enable row level security;
alter table public.mod_escalations enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mod_item_notes'
  ) then
    execute 'grant select, insert, update, delete on table public.mod_item_notes to service_role';
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mod_escalations'
  ) then
    execute 'grant select, insert, update, delete on table public.mod_escalations to service_role';
  end if;
end
$$;

notify pgrst, 'reload schema';
