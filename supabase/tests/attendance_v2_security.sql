-- Read-only post-migration security assertions for Attendance V2.
begin;
do $audit$
declare v_count integer;
begin
 if to_regprocedure('public.buklod_scan_event_qr_v2(text)') is null
 or to_regprocedure('public.buklod_issue_event_qr_v2(uuid)') is null
 or to_regprocedure('public.buklod_review_event_rewards_v2(uuid,boolean,text)') is null
 or to_regprocedure('public.buklod_attendance_home_report_v2(uuid,date,date)') is null
 then raise exception 'Attendance V2 RPC missing'; end if;
 if has_function_privilege('anon','public.buklod_issue_event_qr_v2(uuid)','EXECUTE')
 or has_function_privilege('anon','public.buklod_scan_event_qr_v2(text)','EXECUTE')
 or has_function_privilege('anon','public.buklod_review_event_rewards_v2(uuid,boolean,text)','EXECUTE')
 or has_function_privilege('authenticated','public.buklod_award_scope_attendance_points_v1(uuid,uuid,uuid,text,uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.buklod_reverse_scope_attendance_points_v1(uuid,uuid,timestamptz,uuid)','EXECUTE')
 then raise exception 'Sensitive attendance RPC exposed to client'; end if;
 if not has_function_privilege('authenticated','public.buklod_scan_event_qr_v2(text)','EXECUTE')
 then raise exception 'Authenticated QR scanner lacks RPC access'; end if;
 select count(*) into v_count
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in
 ('buklod_attendance_event_qr_v2','buklod_attendance_scan_receipts_v2','buklod_attendance_event_review_v2','buklod_attendance_reward_caps_v2','buklod_attendance_review_audit_v2')
 and c.relrowsecurity=true;
 if v_count<>5 then raise exception 'Attendance V2 private tables require RLS'; end if;
 if not exists(select 1 from pg_indexes
   where schemaname='public' and tablename='attendance_records'
    and indexdef ilike '%unique%' and indexdef ilike '%event_id%' and indexdef ilike '%user_id%')
 then raise exception 'Attendance duplicate guard is missing'; end if;
 if not exists(select 1 from public.buklod_attendance_reward_caps_v2
   where singleton=true and per_event<=10 and per_day<=20 and per_week<=50)
 then raise exception 'Unexpected attendance reward caps'; end if;
 if exists(select 1 from public.buklod_attendance_qr_tokens q
   left join public.profiles p on p.id=q.user_id
   where q.is_active and p.id is null)
 then raise exception 'Orphan personal QR tokens'; end if;
end
$audit$;
rollback;
