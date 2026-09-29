
create or replace function private.buklod_pf_guard_finalized_value_write_v3()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_enabled boolean := false;
begin
  select coalesce(c.economics_enabled,false)
  into v_enabled
  from private.buklod_pf_config c
  where c.singleton=true;

  if not coalesce(v_enabled,false) then
    raise exception 'Canonical finance economics is disabled. Finalized value writes are blocked.';
  end if;

  return new;
end;
$function$;

revoke all on function private.buklod_pf_guard_finalized_value_write_v3()
from public, anon, authenticated, service_role;

drop trigger if exists buklod_pf_finalized_value_economics_guard_v3
on private.buklod_pf_finalized_value_ledger;

create trigger buklod_pf_finalized_value_economics_guard_v3
before insert or update of
  gross_value_centavos,
  qualification_value_centavos,
  post_qualification_value_centavos
on private.buklod_pf_finalized_value_ledger
for each row
execute function private.buklod_pf_guard_finalized_value_write_v3();

revoke execute on function public.buklod_qualify_referral_v1(uuid)
from public, anon, authenticated, service_role;

revoke execute on function public.buklod_record_referral_v1(text)
from public, anon, authenticated, service_role;

comment on function private.buklod_pf_guard_finalized_value_write_v3() is
'P0 containment guard: canonical finalized-value writes are impossible while economics_enabled is false.';

comment on trigger buklod_pf_finalized_value_economics_guard_v3
on private.buklod_pf_finalized_value_ledger is
'P0 containment: blocks finalized-value insertion/allocation while canonical finance economics is disabled.';
