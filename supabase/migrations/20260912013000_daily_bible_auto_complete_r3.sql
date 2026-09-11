create or replace function public.complete_my_daily_bible_reading_v3(
  p_assignment_id uuid,
  p_bible_text text default null,
  p_reflection_text text default null,
  p_language text default 'fil',
  p_bible_photo_path text default null,
  p_reflection_photo_path text default null,
  p_question_answers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_submission_id uuid;
  v_submission_status text;
  v_approval_status text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  v_submission_id := public.submit_daily_bible_evidence_v2(
    p_assignment_id,
    p_bible_text,
    p_reflection_text,
    p_language,
    p_bible_photo_path,
    p_reflection_photo_path,
    p_question_answers
  );

  select s.status::text
    into v_submission_status
  from public.daily_bible_submissions s
  where s.id = v_submission_id
    and s.user_id = v_actor;

  select a.status::text
    into v_approval_status
  from public.buklod_scope_formation_approvals_v2 a
  where a.item_kind = 'DAILY_READING'
    and a.item_id = v_submission_id
    and a.learner_id = v_actor
  order by a.created_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'submission_id', v_submission_id,
    'status', coalesce(v_submission_status, 'pending_admin'),
    'automatic_check_status', coalesce(v_approval_status, 'EVALUATING'),
    'automatic', true,
    'human_approval_required', false
  );
end;
$$;

revoke all on function public.complete_my_daily_bible_reading_v3(uuid,text,text,text,text,text,jsonb) from public;
revoke all on function public.complete_my_daily_bible_reading_v3(uuid,text,text,text,text,text,jsonb) from anon;
grant execute on function public.complete_my_daily_bible_reading_v3(uuid,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.complete_my_daily_bible_reading_v3(uuid,text,text,text,text,text,jsonb) to service_role;
