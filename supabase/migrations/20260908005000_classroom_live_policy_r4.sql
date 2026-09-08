create or replace function public.buklod_classroom_live_policy_v1(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_classroom_id uuid;
  v_config jsonb := '{}'::jsonb;
  v_response_ms integer := 12000;
  v_extension_ms integer := 5000;
  v_evidence_ms integer := 10000;
  v_text text;
begin
  select s.classroom_id, coalesce(c.adaptive_config, '{}'::jsonb)
    into v_classroom_id, v_config
  from public.buklod_education_classroom_live_sessions s
  join public.buklod_education_classrooms c on c.id = s.classroom_id
  where s.id = p_session_id;

  if v_classroom_id is null then
    raise exception 'Live classroom session not found.';
  end if;

  if not exists (
    select 1
    from public.buklod_education_classrooms c
    where c.id = v_classroom_id
      and c.faculty_user_id = auth.uid()
  ) and not exists (
    select 1
    from public.buklod_education_enrollments e
    where e.classroom_id = v_classroom_id
      and e.student_user_id = auth.uid()
      and e.status = 'ACTIVE'
  ) then
    raise exception 'Classroom access required.';
  end if;

  v_text := v_config->>'response_timeout_ms';
  if v_text ~ '^[0-9]+$' then
    v_response_ms := v_text::integer;
  else
    v_text := v_config->>'response_timeout_seconds';
    if v_text ~ '^[0-9]+$' then v_response_ms := v_text::integer * 1000; end if;
  end if;

  v_text := v_config->>'degraded_response_extension_ms';
  if v_text ~ '^[0-9]+$' then
    v_extension_ms := v_text::integer;
  else
    v_text := v_config->>'degraded_network_allowance_seconds';
    if v_text ~ '^[0-9]+$' then v_extension_ms := v_text::integer * 1000; end if;
  end if;

  v_text := v_config->>'network_evidence_window_ms';
  if v_text ~ '^[0-9]+$' then
    v_evidence_ms := v_text::integer;
  else
    v_text := v_config->>'network_evidence_window_seconds';
    if v_text ~ '^[0-9]+$' then v_evidence_ms := v_text::integer * 1000; end if;
  end if;

  v_response_ms := greatest(5000, least(30000, v_response_ms));
  v_extension_ms := greatest(0, least(15000, v_extension_ms));
  v_evidence_ms := greatest(5000, least(15000, v_evidence_ms));

  return jsonb_build_object(
    'response_window_ms', v_response_ms,
    'degraded_extension_ms', v_extension_ms,
    'evidence_window_ms', v_evidence_ms,
    'source', 'classroom_adaptive_config'
  );
end;
$function$;

revoke all on function public.buklod_classroom_live_policy_v1(uuid) from public;
revoke all on function public.buklod_classroom_live_policy_v1(uuid) from anon;
grant execute on function public.buklod_classroom_live_policy_v1(uuid) to authenticated;
