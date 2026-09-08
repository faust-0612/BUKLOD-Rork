create or replace function public.buklod_classroom_finalize_live_attendance_v1(p_live_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_attendance_session_id uuid;
  v_classroom_id uuid;
  v_total integer;
  v_pending integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select s.attendance_session_id,s.classroom_id
    into v_attendance_session_id,v_classroom_id
  from public.buklod_education_classroom_live_sessions s
  join public.buklod_education_classrooms c on c.id=s.classroom_id
  where s.id=p_live_session_id and c.faculty_user_id=v_uid;

  if not found then raise exception 'Faculty access required'; end if;
  if v_attendance_session_id is null then raise exception 'This live class has no linked attendance session'; end if;

  select count(*), count(*) filter (where p.review_status <> 'APPROVED')
    into v_total,v_pending
  from public.buklod_education_classroom_live_attendance_proposals p
  where p.live_session_id=p_live_session_id;

  if v_total=0 then raise exception 'No live attendance proposals exist for this session'; end if;
  if v_pending>0 then raise exception 'Review all attendance proposals before finalizing'; end if;

  return public.buklod_education_sync_attendance_session_to_gradebook_v1(v_attendance_session_id);
end;
$$;

grant execute on function public.buklod_classroom_finalize_live_attendance_v1(uuid) to authenticated;
