-- Read-only postdeployment privilege and QMP freshness checks.
do $preview$
declare v_writer oid:=to_regprocedure('public.buklod_write_admob_daily_preview_v2(text,numeric,date,numeric,text,text,timestamptz)');
        v_reader oid:=to_regprocedure('public.get_my_buklod_community_contribution_live_v1()');
        v_sql text;
begin
 if v_writer is null or v_reader is null then raise exception 'Daily AdMob RPC missing'; end if;
 if has_function_privilege('anon',v_writer,'EXECUTE')
    or has_function_privilege('authenticated',v_writer,'EXECUTE')
    or not has_function_privilege('service_role',v_writer,'EXECUTE') then
    raise exception 'Daily AdMob writer improperly exposed'; end if;
 if has_table_privilege('authenticated','private.buklod_admob_daily_preview_v1','SELECT')
    or has_table_privilege('anon','private.buklod_admob_daily_preview_v1','SELECT') then
    raise exception 'Private AdMob daily data exposed'; end if;
 v_sql:=pg_get_functiondef(v_reader);
 if position('today_estimated_share_minor' in v_sql)=0
    or position('36 hours' in v_sql)=0
    or position('v_qmp/v_total' in v_sql)=0 then
    raise exception 'Missing day/QMP/freshness contract'; end if;
end;
$preview$;
