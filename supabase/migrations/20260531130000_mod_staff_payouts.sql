-- Mod staff payout ledger (manual admin entries until automated pay ships).

create extension if not exists pgcrypto;

create table if not exists public.mod_staff_payouts (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null references public.mod_staff (discord_id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  period_label text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'voided')),
  tx_reference text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mod_staff_payouts_discord_created_idx
  on public.mod_staff_payouts (discord_id, created_at desc);

comment on table public.mod_staff_payouts is
  'Manual mod stipend payout history — admin recorded until automated pay ships.';

alter table public.mod_staff_payouts enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mod_staff_payouts'
  ) then
    execute 'grant select, insert, update, delete on table public.mod_staff_payouts to service_role';
  end if;
end
$$;

notify pgrst, 'reload schema';
