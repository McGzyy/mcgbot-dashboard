-- Idempotent service_role grants for mod staff tables (safe to re-run in SQL editor).

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mod_staff'
  ) then
    execute 'grant select, insert, update, delete on table public.mod_staff to service_role';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'mod_action_audit'
  ) then
    execute 'grant select, insert, update, delete on table public.mod_action_audit to service_role';
  end if;
end
$$;
