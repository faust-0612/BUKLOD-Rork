-- Correct recurring launch timing: do not snapshot or notify members until the next period opens.
create or replace function private.buklod_report_generate_recurring_collections_v2()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_def record;
  v_settings jsonb;
  v_anchor_local timestamp;
  v_today timestamp := now() at time zone 'Asia/Manila';
  v_next_local timestamp;
  v_base_month date;
  v_target_month date;
  v_days_in_month integer;
  v_anchor_day integer;
  v_month_index integer;
  v_i integer;
  v_due_at timestamptz;
  v_opens_at timestamptz;
  v_period_id uuid;
  v_period_key text;
  v_members integer;
  v_assignment_count integer;
  v_new_periods integer := 0;
  v_new_assignments integer := 0;
  v_new_notifications integer := 0;
begin
  -- Only one cron execution can create periods at a time.
  if not pg_catalog.pg_try_advisory_xact_lock(20261115,2) then
    return jsonb_build_object('ok',true,'locked',true);
  end if;
  for v_def in
    select d.id,d.scope_id,d.title,d.recurrence_kind,d.recurrence_config,
           d.created_by,s.name as scope_name,s.scope_type
    from public.buklod_report_definitions d
    join public.buklod_scopes s on s.id = d.scope_id
    where d.status='ACTIVE'
      and d.recurrence_kind in ('WEEKLY','MONTHLY')
      and d.recurrence_config #>> '{auto_collection,enabled}' = 'true'
      and upper(s.scope_type::text) in ('ORGANIZATION','CLUSTER')
      and coalesce(s.status::text,'ACTIVE') not in ('DELETED','ARCHIVED')
    order by d.id
    limit 100
  loop
    v_settings := v_def.recurrence_config -> 'auto_collection';
    if v_settings ->> 'cadence' is distinct from v_def.recurrence_kind
       or v_settings ->> 'timezone' is distinct from 'Asia/Manila'
       or v_settings ->> 'first_due_at' is null
    then continue; end if;
    begin
      v_anchor_local := (v_settings ->> 'first_due_at')::timestamptz
                        at time zone 'Asia/Manila';
    exception when others then continue;
    end;
    if v_anchor_local is null then continue; end if;
    v_next_local := null;
    if v_def.recurrence_kind = 'WEEKLY' then
      v_next_local := v_anchor_local +
        greatest(0,ceil(extract(epoch from (v_today-v_anchor_local))/604800.0)::integer)
          * interval '7 days';
      if v_next_local <= v_today then v_next_local := v_next_local + interval '7 days'; end if;
    else
      v_base_month := date_trunc('month',v_anchor_local)::date;
      v_anchor_day := extract(day from v_anchor_local)::integer;
      -- Preserve a deliberate end-of-month collection day.
      if v_anchor_day =
         extract(day from (date_trunc('month',v_anchor_local)+interval '1 month - 1 day'))::integer
      then v_anchor_day := 99; end if;
      v_month_index := greatest(0,
        (extract(year from v_today)::integer - extract(year from v_anchor_local)::integer)*12
        + extract(month from v_today)::integer - extract(month from v_anchor_local)::integer
      );
      for v_i in v_month_index..(v_month_index+2) loop
        v_target_month := (v_base_month + make_interval(months=>v_i))::date;
        v_days_in_month := extract(day from (
          date_trunc('month',v_target_month::timestamp)+interval '1 month - 1 day'
        ))::integer;
        v_next_local := (v_target_month + least(v_anchor_day,v_days_in_month)-1)
                           + v_anchor_local::time;
        exit when v_next_local > v_today and v_next_local > v_anchor_local;
      end loop;
    end if;
    if v_next_local is null or v_next_local <= v_today
       or v_next_local > v_today + interval '32 days' then continue; end if;
    v_due_at := v_next_local at time zone 'Asia/Manila';
    -- Manual publication for the identical deadline takes precedence.
    if exists(
      select 1 from public.buklod_report_periods p
      where p.report_definition_id=v_def.id and p.due_at=v_due_at
    ) then continue; end if;
    select count(distinct m.user_id)::integer into v_members
    from public.buklod_scope_memberships m
    where m.scope_id=v_def.scope_id and m.membership_status='ACTIVE'
      and m.left_at is null and m.user_id is not null;
    if v_members < 1 then continue; end if;
    v_opens_at := (v_next_local -
        case when v_def.recurrence_kind='WEEKLY' then interval '7 days'
             else interval '1 month' end) at time zone 'Asia/Manila';
    -- Don't pre-assign future collections or send notifications before they open.
    if v_opens_at > now() then continue; end if;
    v_period_key := 'AUTO_' || v_def.recurrence_kind || '_' ||
                    to_char(v_next_local,'YYYYMMDD_HH24MI');
    v_period_id := null;
    insert into public.buklod_report_periods(
      report_definition_id,scope_id,period_key,title,opens_at,due_at,
      closes_at,status,metadata
    ) values(
      v_def.id,v_def.scope_id,v_period_key,v_def.title,v_opens_at,
      v_due_at,null,case when v_opens_at>now() then 'SCHEDULED' else 'OPEN' end,
      jsonb_build_object('source','BUKLOD_REPORT_REAL_DEADLINE_R1',
        'auto_collection',true,'cadence',v_def.recurrence_kind,
        'timezone','Asia/Manila','membership_snapshot',true,
        'eligible_member_count',v_members,'published_at',now())
    ) on conflict (report_definition_id,period_key) do nothing
    returning id into v_period_id;
    if v_period_id is null then continue; end if;
    v_new_periods := v_new_periods+1;

    insert into public.buklod_report_assignments(
      report_definition_id,report_period_id,scope_id,assignee_user_id,
      assignment_status,deadline_at,original_deadline_at,metadata
    )
    select v_def.id,v_period_id,v_def.scope_id,m.user_id,
      'OPEN',v_due_at,v_due_at,
      jsonb_build_object('source','BUKLOD_REPORT_REAL_DEADLINE_R1',
        'auto_collection',true,'cadence',v_def.recurrence_kind,
        'scope_name',v_def.scope_name,'scope_type',v_def.scope_type,
        'membership_snapshot',jsonb_build_object(
          'membership_id',m.id,'membership_status',m.membership_status,
          'joined_at',m.joined_at))
    from public.buklod_scope_memberships m
    where m.scope_id=v_def.scope_id and m.membership_status='ACTIVE'
      and m.left_at is null and m.user_id is not null
    on conflict (report_definition_id,report_period_id,assignee_user_id)
      do nothing;
    get diagnostics v_assignment_count = row_count;
    v_new_assignments := v_new_assignments+v_assignment_count;

    insert into public.buklod_report_reminders(
      scope_id,assignment_id,assigned_user_id,created_by,
      reminder_kind,title,body,due_at,priority,status,metadata
    )
    select a.scope_id,a.id,a.assignee_user_id,
      coalesce((v_settings->>'configured_by')::uuid,v_def.created_by),
      'DEADLINE',v_def.title||' deadline',
      'Due '||to_char(v_due_at at time zone 'Asia/Manila','Mon DD, YYYY HH12:MI AM'),
      v_due_at,'NORMAL','ACTIVE',
      jsonb_build_object('source','BUKLOD_REPORT_REAL_DEADLINE_R1',
        'report_period_id',v_period_id,
        'reminder_offsets_minutes',jsonb_build_array(1440,180))
    from public.buklod_report_assignments a
    where a.report_period_id=v_period_id and a.assignee_user_id is not null
    on conflict (assignment_id,assigned_user_id,reminder_kind)
      where assignment_id is not null and reminder_kind='DEADLINE'
    do nothing;

    insert into public.notifications(user_id,title,body,kind,data)
    select a.assignee_user_id,'New '||lower(v_def.recurrence_kind)||' report assigned',
      v_def.title||' · due '||
      to_char(v_due_at at time zone 'Asia/Manila','Mon DD, YYYY HH12:MI AM'),
      'report_assigned',jsonb_build_object('route','/reports',
        'scope_id',a.scope_id,'report_definition_id',a.report_definition_id,
        'report_period_id',a.report_period_id,'report_assignment_id',a.id,
        'deadline_at',a.deadline_at,'event','report_assigned',
        'cadence',v_def.recurrence_kind)
    from public.buklod_report_assignments a
    where a.report_period_id=v_period_id and a.assignee_user_id is not null
      and not exists(
        select 1 from public.notifications n
        where n.user_id=a.assignee_user_id and n.kind='report_assigned'
          and n.data->>'report_assignment_id'=a.id::text
      );
    get diagnostics v_assignment_count = row_count;
    v_new_notifications := v_new_notifications+v_assignment_count;
  end loop;
  return jsonb_build_object('ok',true,'created_periods',v_new_periods,
    'assignments',v_new_assignments,'notifications',v_new_notifications);
end;
$$;
