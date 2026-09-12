create or replace function public.buklod_report_consolidated_data_v1(
  p_definition_id uuid,
  p_period_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_definition public.buklod_report_definitions%rowtype;
  v_period public.buklod_report_periods%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_definition
  from public.buklod_report_definitions
  where id = p_definition_id;

  if not found then
    raise exception 'Report definition not found';
  end if;

  perform public.buklod_report_assert_definition_admin_v1(v_definition.scope_id);

  if p_period_id is not null then
    select * into v_period
    from public.buklod_report_periods
    where id = p_period_id
      and report_definition_id = p_definition_id
      and scope_id = v_definition.scope_id;
    if not found then
      raise exception 'Report period not found for this definition';
    end if;
  end if;

  return jsonb_build_object(
    'definition', public.buklod_report_definition_to_json_v1(v_definition),
    'periods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'period_key', p.period_key,
        'opens_at', p.opens_at,
        'due_at', p.due_at,
        'closes_at', p.closes_at,
        'status', p.status,
        'assigned_count', (
          select count(*) from public.buklod_report_assignments a where a.report_period_id = p.id
        ),
        'submitted_count', (
          select count(*) from public.buklod_report_assignments a where a.report_period_id = p.id and a.assignment_status = 'SUBMITTED'
        )
      ) order by p.due_at desc)
      from public.buklod_report_periods p
      where p.report_definition_id = p_definition_id
        and (p_period_id is null or p.id = p_period_id)
    ), '[]'::jsonb),
    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'submission_id', s.id,
        'assignment_id', s.assignment_id,
        'period_id', s.report_period_id,
        'period_title', p.title,
        'period_key', p.period_key,
        'submitter_user_id', s.submitter_user_id,
        'submitter_name', coalesce(pr.full_name, pr.username, s.submitter_user_id::text),
        'submitter_username', pr.username,
        'submission_status', s.submission_status,
        'review_status', s.review_status,
        'submitted_at', s.submitted_at,
        'content', s.content,
        'extracted_metrics', s.extracted_metrics
      ) order by p.due_at desc, coalesce(pr.full_name, pr.username, s.submitter_user_id::text))
      from public.buklod_report_submissions s
      join public.buklod_report_periods p on p.id = s.report_period_id
      left join public.profiles pr on pr.id = s.submitter_user_id
      where s.report_definition_id = p_definition_id
        and (p_period_id is null or s.report_period_id = p_period_id)
        and s.submission_status <> 'DRAFT'
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.buklod_report_consolidated_data_v1(uuid, uuid) from public;
revoke all on function public.buklod_report_consolidated_data_v1(uuid, uuid) from anon;
grant execute on function public.buklod_report_consolidated_data_v1(uuid, uuid) to authenticated;
