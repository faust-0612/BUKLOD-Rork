create or replace function public.buklod_education_time_out_session_v1(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log_id uuid;
begin
  select l.id into v_log_id
  from public.buklod_education_attendance_log l
  where l.session_id = p_session_id
    and l.student_user_id = auth.uid();

  if v_log_id is null then
    raise exception 'Attendance record not found for this session.';
  end if;

  return public.buklod_education_time_out_v1(v_log_id);
end;
$$;

revoke all on function public.buklod_education_time_out_session_v1(uuid) from public;
grant execute on function public.buklod_education_time_out_session_v1(uuid) to authenticated;
