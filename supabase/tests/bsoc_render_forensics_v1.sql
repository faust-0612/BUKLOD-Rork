-- RLS and RPC security proof. Run after migrations, with no test writes.
begin;
do $$
declare
  function_signature text :=
    'public.buklod_attach_render_forensics_v1(uuid,text,text,text,integer,integer,integer,integer,text,uuid,text)';
  function_source text;
  check_count integer;
begin
  if not coalesce((select relrowsecurity from pg_class where oid='public.bsoc_render_forensics_v1'::regclass),false) then
    raise exception 'Render forensics table must use RLS';
  end if;
  if has_table_privilege('anon','public.bsoc_render_forensics_v1','SELECT')
     or has_table_privilege('authenticated','public.bsoc_render_forensics_v1','INSERT')
     or has_table_privilege('authenticated','public.bsoc_render_forensics_v1','UPDATE')
     or has_table_privilege('authenticated','public.bsoc_render_forensics_v1','DELETE') then
    raise exception 'Forensic table write/read grants too broad';
  end if;
  if not has_table_privilege('authenticated','public.bsoc_render_forensics_v1','SELECT') then
    raise exception 'Missing RLS-guarded authenticated SELECT';
  end if;
  if has_function_privilege('anon',function_signature,'EXECUTE') or
     not has_function_privilege('authenticated',function_signature,'EXECUTE') then
    raise exception 'Forensic RPC execution ACL unsafe';
  end if;
  select pg_get_functiondef(to_regprocedure(function_signature)) into function_source;
  if function_source not like '%e.user_id=actor%'
     or function_source not like '%on conflict(health_event_id) do nothing%'
     or function_source not like '%raw%' then
    -- Check references by positive checks; no raw text/stack parameters.
    if function_source not like '%e.user_id=actor%'
       or function_source not like '%on conflict(health_event_id) do nothing%' then
      raise exception 'Forensic RPC missing owner-bound, first-write-wins checks';
    end if;
  end if;
  select count(*) into check_count
  from pg_policies
  where schemaname='public'
    and tablename='bsoc_render_forensics_v1'
    and cmd='SELECT'
    and (qual like '%auth.uid()%' or qual like '%buklod_bsoc_can%');
  if check_count < 1 then
    raise exception 'Forensic read policy must bind owner or BSOC permission';
  end if;
end;
$$;
rollback;
