alter table public.buklod_education_classroom_live_sessions
  add column if not exists attendance_session_id uuid references public.buklod_education_attendance_sessions(id) on delete set null;

create table if not exists public.buklod_education_classroom_live_state (
  session_id uuid primary key references public.buklod_education_classroom_live_sessions(id) on delete cascade,
  version bigint not null default 0,
  interaction_id uuid,
  mode text not null default 'LISTENING',
  active_user_id uuid,
  active_user_ids uuid[] not null default '{}',
  mute_all boolean not null default false,
  ended boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.buklod_education_classroom_live_interactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.buklod_education_classroom_live_sessions(id) on delete cascade,
  classroom_id uuid not null references public.buklod_education_classrooms(id) on delete cascade,
  version bigint not null,
  interaction_type text not null,
  target_user_id uuid,
  target_user_ids uuid[] not null default '{}',
  actor_user_id uuid,
  result text not null default 'ISSUED',
  network_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(session_id, version)
);

create index if not exists buklod_classroom_live_interactions_session_idx
  on public.buklod_education_classroom_live_interactions(session_id, version desc);

create table if not exists public.buklod_education_classroom_live_attendance_proposals (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.buklod_education_classroom_live_sessions(id) on delete cascade,
  attendance_session_id uuid not null references public.buklod_education_attendance_sessions(id) on delete cascade,
  classroom_id uuid not null references public.buklod_education_classrooms(id) on delete cascade,
  student_user_id uuid not null,
  first_joined_at timestamptz,
  last_left_at timestamptz,
  connected_seconds integer not null default 0,
  rejoin_count integer not null default 0,
  proposed_status text not null default 'REVIEW',
  evidence jsonb not null default '{}'::jsonb,
  review_status text not null default 'PENDING',
  final_status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(live_session_id, student_user_id)
);

create index if not exists buklod_classroom_live_attendance_proposals_class_idx
  on public.buklod_education_classroom_live_attendance_proposals(classroom_id, created_at desc);

create table if not exists public.buklod_education_classroom_breakout_rooms (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.buklod_education_classroom_live_sessions(id) on delete cascade,
  classroom_id uuid not null references public.buklod_education_classrooms(id) on delete cascade,
  name text not null,
  call_id text not null unique,
  status text not null default 'OPEN',
  timer_ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.buklod_education_classroom_breakout_members (
  room_id uuid not null references public.buklod_education_classroom_breakout_rooms(id) on delete cascade,
  user_id uuid not null,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  primary key(room_id, user_id)
);

alter table public.buklod_education_classroom_live_state enable row level security;
alter table public.buklod_education_classroom_live_interactions enable row level security;
alter table public.buklod_education_classroom_live_attendance_proposals enable row level security;
alter table public.buklod_education_classroom_breakout_rooms enable row level security;
alter table public.buklod_education_classroom_breakout_members enable row level security;

create or replace function public.buklod_classroom_start_live_v1(p_classroom_id uuid, p_title text default 'Live Class'::text)
returns table(session_id uuid, call_id text, plan_key text, hard_stop_at timestamptz, free_limit_minutes integer)
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_limit integer;
  v_id uuid := gen_random_uuid();
  v_call text;
  v_stop timestamptz;
  v_attendance uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select c.classroom_plan,c.free_live_minutes into v_plan,v_limit
  from public.buklod_education_classrooms c
  where c.id=p_classroom_id and c.faculty_user_id=v_uid and c.status='ACTIVE';
  if not found then raise exception 'Faculty classroom access required'; end if;

  update public.buklod_education_classroom_live_sessions
  set status='ENDED',ended_at=coalesce(ended_at,now())
  where classroom_id=p_classroom_id and status='LIVE' and hard_stop_at is not null and hard_stop_at<=now();

  if exists(select 1 from public.buklod_education_classroom_live_sessions s where s.classroom_id=p_classroom_id and s.status='LIVE') then
    raise exception 'A live class is already active';
  end if;

  insert into public.buklod_education_attendance_sessions(classroom_id,opened_by,opened_at,late_after_minutes,policy)
  values(p_classroom_id,v_uid,now(),15,jsonb_build_object('source','LIVE_CLASSROOM','proposal_only',true))
  returning id into v_attendance;

  v_call := 'classroom-' || replace(p_classroom_id::text,'-','') || '-' || replace(v_id::text,'-','');
  v_stop := case when v_plan='PREMIUM' then null else now() + make_interval(mins=>v_limit) end;

  insert into public.buklod_education_classroom_live_sessions(id,classroom_id,created_by,title,call_id,status,plan_key,free_limit_minutes,started_at,hard_stop_at,attendance_session_id)
  values(v_id,p_classroom_id,v_uid,coalesce(nullif(trim(p_title),''),'Live Class'),v_call,'LIVE',v_plan,v_limit,now(),v_stop,v_attendance);

  insert into public.buklod_education_classroom_live_state(session_id,updated_by)
  values(v_id,v_uid)
  on conflict(session_id) do nothing;

  return query select v_id,v_call,v_plan,v_stop,v_limit;
end;
$$;

create or replace function public.buklod_classroom_end_live_v1(p_session_id uuid)
returns boolean
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_class uuid;
  v_attendance uuid;
  v_started timestamptz;
  v_ended timestamptz:=now();
  v_duration integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select s.classroom_id,s.attendance_session_id,s.started_at into v_class,v_attendance,v_started
  from public.buklod_education_classroom_live_sessions s
  join public.buklod_education_classrooms c on c.id=s.classroom_id
  where s.id=p_session_id and c.faculty_user_id=v_uid;
  if not found then raise exception 'Faculty access required'; end if;

  update public.buklod_education_classroom_live_sessions
  set status='ENDED',ended_at=coalesce(ended_at,v_ended)
  where id=p_session_id and status='LIVE';

  update public.buklod_education_classroom_live_state
  set version=version+1, interaction_id=gen_random_uuid(), mode='CLASS_ENDED',active_user_id=null,active_user_ids='{}',mute_all=true,ended=true,updated_by=v_uid,updated_at=v_ended
  where session_id=p_session_id;

  if v_attendance is not null then
    update public.buklod_education_attendance_sessions set closed_at=coalesce(closed_at,v_ended) where id=v_attendance;
    v_duration:=greatest(1,extract(epoch from (v_ended-coalesce(v_started,v_ended)))::integer);

    insert into public.buklod_education_classroom_live_attendance_proposals(
      live_session_id,attendance_session_id,classroom_id,student_user_id,first_joined_at,last_left_at,connected_seconds,rejoin_count,proposed_status,evidence
    )
    select
      p_session_id,v_attendance,v_class,e.student_user_id,
      min(lp.joined_at),max(coalesce(lp.left_at,v_ended)),
      coalesce(sum(case when lp.id is null then 0 when lp.left_at is null then greatest(0,extract(epoch from (v_ended-lp.joined_at))::integer) else greatest(lp.total_seconds,extract(epoch from (lp.left_at-lp.joined_at))::integer) end),0)::integer,
      greatest(count(lp.id)::integer-1,0),
      case
        when count(lp.id)=0 then 'REVIEW_ABSENT'
        when coalesce(sum(case when lp.id is null then 0 when lp.left_at is null then greatest(0,extract(epoch from (v_ended-lp.joined_at))::integer) else greatest(lp.total_seconds,extract(epoch from (lp.left_at-lp.joined_at))::integer) end),0) >= v_duration*0.70 then
          case when min(lp.joined_at)>coalesce(v_started,v_ended)+interval '15 minutes' then 'LATE' else 'PRESENT' end
        when coalesce(sum(case when lp.id is null then 0 when lp.left_at is null then greatest(0,extract(epoch from (v_ended-lp.joined_at))::integer) else greatest(lp.total_seconds,extract(epoch from (lp.left_at-lp.joined_at))::integer) end),0) >= v_duration*0.30 then 'REVIEW_INCOMPLETE'
        else 'REVIEW_ABSENT'
      end,
      jsonb_build_object('source','LIVE_CLASSROOM','session_duration_seconds',v_duration,'generated_at',v_ended,'requires_faculty_approval',true)
    from public.buklod_education_enrollments e
    left join public.buklod_education_classroom_live_participants lp on lp.session_id=p_session_id and lp.user_id=e.student_user_id and lp.participant_role='STUDENT'
    where e.classroom_id=v_class and e.status='ACTIVE'
    group by e.student_user_id
    on conflict(live_session_id,student_user_id) do update set
      first_joined_at=excluded.first_joined_at,last_left_at=excluded.last_left_at,connected_seconds=excluded.connected_seconds,rejoin_count=excluded.rejoin_count,
      proposed_status=excluded.proposed_status,evidence=excluded.evidence,updated_at=now();
  end if;
  return true;
end;
$$;

create or replace function public.buklod_classroom_live_attendance_proposals_v1(p_classroom_id uuid)
returns setof public.buklod_education_classroom_live_attendance_proposals
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.buklod_education_classrooms c where c.id=p_classroom_id and c.faculty_user_id=auth.uid()) then raise exception 'Faculty access required'; end if;
  return query select p.* from public.buklod_education_classroom_live_attendance_proposals p where p.classroom_id=p_classroom_id order by p.created_at desc;
end;
$$;

create or replace function public.buklod_classroom_approve_live_attendance_v1(p_proposal_id uuid,p_status text,p_note text default null)
returns uuid
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_p public.buklod_education_classroom_live_attendance_proposals%rowtype;
  v_log uuid;
  v_status text:=upper(coalesce(p_status,''));
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_status not in ('PRESENT','LATE','INCOMPLETE','ABSENT','EXCUSED') then raise exception 'Unsupported attendance status'; end if;
  select p.* into v_p from public.buklod_education_classroom_live_attendance_proposals p
  join public.buklod_education_classrooms c on c.id=p.classroom_id
  where p.id=p_proposal_id and c.faculty_user_id=v_uid;
  if not found then raise exception 'Faculty access required'; end if;

  insert into public.buklod_education_attendance_log(session_id,student_user_id,time_in,time_out,status,verification)
  values(v_p.attendance_session_id,v_p.student_user_id,
    case when v_status='ABSENT' then null else v_p.first_joined_at end,
    case when v_status='ABSENT' then null else v_p.last_left_at end,
    v_status,
    v_p.evidence || jsonb_build_object('faculty_approved',true,'proposal_id',v_p.id,'connected_seconds',v_p.connected_seconds,'rejoin_count',v_p.rejoin_count,'note',p_note,'approved_by',v_uid,'approved_at',now())
  )
  on conflict(session_id,student_user_id) do update set
    time_in=excluded.time_in,time_out=excluded.time_out,status=excluded.status,verification=excluded.verification
  returning id into v_log;

  update public.buklod_education_classroom_live_attendance_proposals
  set review_status='APPROVED',final_status=v_status,reviewed_by=v_uid,reviewed_at=now(),updated_at=now()
  where id=v_p.id;
  return v_log;
end;
$$;

grant execute on function public.buklod_classroom_live_attendance_proposals_v1(uuid) to authenticated;
grant execute on function public.buklod_classroom_approve_live_attendance_v1(uuid,text,text) to authenticated;
