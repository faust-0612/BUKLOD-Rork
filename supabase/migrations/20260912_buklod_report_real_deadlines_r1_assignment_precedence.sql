-- Real published report deadlines take precedence over legacy Quick Weekly
-- rows inside the same scope. Legacy remains a compatibility fallback only
-- while that user has no open real-deadline assignment in the scope.

create or replace function public.buklod_report_my_assignments_v1(
  p_scope_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'assignments', coalesce(jsonb_agg(to_jsonb(q) order by q.deadline_at asc), '[]'::jsonb)
  )
  from (
    select
      a.id as report_assignment_id,
      a.report_definition_id,
      a.report_period_id,
      a.scope_id,
      sc.name as scope_label,
      d.title as report_title,
      coalesce(p.title, p.period_key) as period_label,
      a.deadline_at,
      a.assignment_status,
      s.submission_status,
      case
        when a.assignment_status = 'SUBMITTED' then 'SUBMITTED'
        when a.deadline_at < now() then 'EXPIRED'
        when a.deadline_at <= now() + interval '24 hours' then 'DUE_SOON'
        else 'DUE'
      end as home_status,
      s.id as submission_id,
      false as has_unread_remarks
    from public.buklod_report_assignments a
    join public.buklod_report_definitions d on d.id = a.report_definition_id
    join public.buklod_report_periods p on p.id = a.report_period_id
    join public.buklod_scopes sc on sc.id = a.scope_id
    left join public.buklod_report_submissions s on s.assignment_id = a.id
    where a.assignee_user_id = auth.uid()
      and (p_scope_id is null or a.scope_id = p_scope_id)
      and a.assignment_status in ('OPEN', 'DUE', 'DUE_SOON', 'EXPIRED', 'SUBMITTED')
      and (
        a.metadata->>'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1'
        or not exists (
          select 1
          from public.buklod_report_assignments real_a
          where real_a.assignee_user_id = a.assignee_user_id
            and real_a.scope_id = a.scope_id
            and real_a.assignment_status <> 'SUBMITTED'
            and real_a.metadata->>'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1'
        )
      )
    order by
      case when a.metadata->>'source' = 'BUKLOD_REPORT_REAL_DEADLINE_R1' then 0 else 1 end,
      a.deadline_at asc
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  ) q;
$function$;

grant execute on function public.buklod_report_my_assignments_v1(uuid, integer) to authenticated;
