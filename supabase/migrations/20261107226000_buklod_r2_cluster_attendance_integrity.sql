-- R2 Cluster Verified Attendance integrity: only real records qualify.
-- Preserve existing ledger, event source-key, claim flow, and organization attendance.
-- The AFTER attendance trigger is owned by postgres and still calls these internal helpers.
create or replace function public.buklod_award_scope_attendance_points_v1(
 p_user_id uuid,p_event_id uuid,p_record_id uuid,p_status text,
 p_operator_id uuid default null
) returns void language plpgsql security definer set search_path=''
as $$
declare
 rule_points integer := 0;
 event_scope uuid;
 event_scope_type text;
 status_text text := lower(coalesce(p_status,''));
begin
 if p_user_id is null or p_event_id is null or p_record_id is null then return; end if;
 if status_text not in ('present','late') then return; end if;
 -- A real, persisted attendance record must exist. Never award from arbitrary RPC args.
 if not exists (
   select 1 from public.attendance_records r
   where r.id=p_record_id and r.user_id=p_user_id and r.event_id=p_event_id
   and r.status=status_text
 ) then return; end if;
 if not public.buklod_scope_attendance_member_eligible_v1(p_user_id)
    or not public.buklod_scope_attendance_event_open_v1(p_event_id) then return; end if;
 select e.scope_id,s.scope_type into event_scope,event_scope_type
 from public.attendance_events e join public.buklod_scopes s on s.id=e.scope_id
 where e.id=p_event_id;
 if event_scope is null then return; end if;
 if upper(coalesce(event_scope_type,''))='CLUSTER' and not exists (
   select 1 from public.buklod_scope_memberships m
   where m.scope_id=event_scope and m.user_id=p_user_id
    and m.membership_status='ACTIVE' and m.left_at is null
 ) then return; end if;
 rule_points:=public.buklod_scope_attendance_rule_points_v1();
 if rule_points<=0 then return;end if;
 insert into public.buklod_points_ledger
 (user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
 values(p_user_id,'credit',rule_points,'scope_attendance',
  'scope_attendance:'||p_event_id::text||':'||p_user_id::text,
  p_event_id,
  case
   when upper(coalesce(event_scope_type,''))='CLUSTER' and status_text='late'
      then 'Cluster Verified Attendance - Late'
   when upper(coalesce(event_scope_type,''))='CLUSTER'
      then 'Cluster Verified Attendance - Present'
   when status_text='late' then 'Scope attendance - Late'
   else 'Scope attendance - Present'
  end,p_operator_id)
 on conflict(user_id,source_key) do nothing;
end;
$$;
-- Sensitive internal award/debit helpers are trigger-only. Do not grant direct RPC execute.
revoke all on function public.buklod_award_scope_attendance_points_v1(uuid,uuid,uuid,text,uuid)
 from public,anon,authenticated;
revoke all on function public.buklod_reverse_scope_attendance_points_v1(uuid,uuid,timestamptz,uuid)
 from public,anon,authenticated;
-- Retain service-role or owner permissions, so the existing SECURITY DEFINER AFTER trigger works.
comment on function public.buklod_award_scope_attendance_points_v1(uuid,uuid,uuid,text,uuid)
is 'Internal verified attendance credit; real row + active Cluster membership; trigger-only execution';
