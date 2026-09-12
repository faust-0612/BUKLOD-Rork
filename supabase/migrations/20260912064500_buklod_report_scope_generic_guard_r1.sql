begin;

create or replace function public.buklod_report_scope_entitled_v1(p_scope_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_entitlements jsonb;
    v_status text;
    v_scope_type text;
begin
    if p_scope_id is null then
        return false;
    end if;

    select upper(coalesce(s.scope_type::text, ''))
      into v_scope_type
    from public.buklod_scopes s
    where s.id = p_scope_id
      and coalesce(s.status::text, 'ACTIVE') not in ('DELETED', 'ARCHIVED');

    if v_scope_type not in ('ORGANIZATION', 'CLUSTER') then
        return false;
    end if;

    if public.buklod_scope_is_mzb_exempt_v1(p_scope_id) then
        return true;
    end if;

    v_entitlements := public.buklod_scope_entitlements_v1(p_scope_id, auth.uid());
    v_status := coalesce(v_entitlements ->> 'commercial_status', 'NONE');

    return v_status in ('MZB_EXEMPT', 'FREE', 'ACTIVE', 'GRACE_PERIOD');
end;
$function$;

create or replace function public.buklod_report_my_assignments_v1(
  p_scope_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path to ''
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
      and upper(coalesce(sc.scope_type::text, '')) in ('ORGANIZATION', 'CLUSTER')
      and coalesce(d.status::text, 'DRAFT') <> 'ARCHIVED'
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

create or replace function public.buklod_report_definition_scope_guard_v1()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_scope_type text;
begin
  select upper(coalesce(s.scope_type::text, ''))
    into v_scope_type
  from public.buklod_scopes s
  where s.id = new.scope_id;

  if v_scope_type not in ('ORGANIZATION', 'CLUSTER') then
    raise exception 'BUKLOD Report definitions are only allowed for Organization and Cluster scopes';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_buklod_report_definition_scope_guard_v1 on public.buklod_report_definitions;
create trigger trg_buklod_report_definition_scope_guard_v1
before insert or update of scope_id on public.buklod_report_definitions
for each row execute function public.buklod_report_definition_scope_guard_v1();

update public.buklod_report_definitions d
set content_requirements = coalesce(d.content_requirements, '{}'::jsonb)
    || jsonb_build_object(
      'template_key', 'MZB_MINISTERIAL_REPORT_V1',
      'template_label', 'MZB Ministerial Report'
    ),
    updated_at = now()
where d.code = 'QUICK_WEEKLY_REPORT'
  and (
    public.buklod_is_mzb_organization_scope_v1(d.scope_id)
    or exists (
      select 1
      from public.buklod_scopes s
      where s.id = d.scope_id
        and upper(coalesce(s.scope_type::text, '')) = 'CLUSTER'
        and public.buklod_is_mzb_organization_scope_v1(coalesce(s.organization_id, s.parent_scope_id))
    )
    or exists (
      select 1
      from public.buklod_scopes s
      where s.id = d.scope_id
        and upper(coalesce(s.scope_type::text, '')) = 'ORGANIZATION'
        and s.parent_scope_id is not null
        and public.buklod_is_mzb_organization_scope_v1(s.parent_scope_id)
    )
  );

update public.buklod_report_definitions d
set status = 'ARCHIVED', updated_at = now()
from public.buklod_scopes s
where s.id = d.scope_id
  and upper(coalesce(s.scope_type::text, '')) not in ('ORGANIZATION', 'CLUSTER')
  and d.code = 'QUICK_WEEKLY_REPORT'
  and not exists (
    select 1 from public.buklod_report_submissions sub
    where sub.report_definition_id = d.id
      and sub.submission_status = 'SUBMITTED'
  );

commit;
