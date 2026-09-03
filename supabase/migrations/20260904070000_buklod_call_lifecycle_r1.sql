-- BUKLOD CALL LIFECYCLE R1
-- Durable call history, outcomes, duration, and Connect call records.

create table if not exists public.buklod_call_logs (
  id uuid primary key default gen_random_uuid(),
  stream_call_cid text not null unique,
  call_kind text not null check (call_kind in ('PERSONAL','SCOPE')),
  thread_id uuid null references public.buklod_connect_direct_threads(id) on delete set null,
  scope_id uuid null references public.buklod_scopes(id) on delete set null,
  mode text not null default 'audio' check (mode in ('audio','video')),
  title text null,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ringing' check (
    status in (
      'ringing','connected','ended','missed','no_answer',
      'declined','busy','cancelled','failed'
    )
  ),
  started_at timestamptz null,
  ended_at timestamptz null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  final_message_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (call_kind = 'PERSONAL' and thread_id is not null and scope_id is null)
    or
    (call_kind = 'SCOPE' and scope_id is not null and thread_id is null)
  )
);

create table if not exists public.buklod_call_participants (
  call_log_id uuid not null references public.buklod_call_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null default 'callee' check (participant_role in ('caller','callee')),
  response_status text not null default 'ringing' check (
    response_status in (
      'ringing','accepted','rejected','missed','busy','timeout','cancelled'
    )
  ),
  response_reason text null,
  responded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (call_log_id, user_id)
);

create index if not exists buklod_call_logs_created_by_created_at_idx
  on public.buklod_call_logs(created_by, created_at desc);
create index if not exists buklod_call_logs_thread_created_at_idx
  on public.buklod_call_logs(thread_id, created_at desc)
  where thread_id is not null;
create index if not exists buklod_call_logs_scope_created_at_idx
  on public.buklod_call_logs(scope_id, created_at desc)
  where scope_id is not null;
create index if not exists buklod_call_participants_user_created_idx
  on public.buklod_call_participants(user_id, created_at desc);

alter table public.buklod_call_logs enable row level security;
alter table public.buklod_call_participants enable row level security;

drop policy if exists buklod_call_logs_select_participant on public.buklod_call_logs;
create policy buklod_call_logs_select_participant
on public.buklod_call_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.buklod_call_participants p
    where p.call_log_id = buklod_call_logs.id
      and p.user_id = (select auth.uid())
  )
  or public.buklod_is_system_admin()
);

drop policy if exists buklod_call_participants_select_self on public.buklod_call_participants;
create policy buklod_call_participants_select_self
on public.buklod_call_participants
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.buklod_is_system_admin()
);

revoke insert, update, delete on public.buklod_call_logs from anon, authenticated;
revoke insert, update, delete on public.buklod_call_participants from anon, authenticated;
grant select on public.buklod_call_logs to authenticated;
grant select on public.buklod_call_participants to authenticated;

create or replace function public.buklod_finalize_call_log_message(_call_log_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log public.buklod_call_logs%rowtype;
  v_body text;
  v_duration text;
  v_hours integer;
  v_minutes integer;
  v_seconds integer;
begin
  select l.*
  into v_log
  from public.buklod_call_logs l
  where l.id = _call_log_id
  for update;

  if not found
     or v_log.final_message_at is not null
     or v_log.status not in ('ended','missed','no_answer','declined','busy','cancelled','failed')
  then
    return;
  end if;

  v_hours := v_log.duration_seconds / 3600;
  v_minutes := (v_log.duration_seconds % 3600) / 60;
  v_seconds := v_log.duration_seconds % 60;

  if v_hours > 0 then
    v_duration := v_hours::text || 'h ' || v_minutes::text || 'm ' || v_seconds::text || 's';
  elsif v_minutes > 0 then
    v_duration := v_minutes::text || 'm ' || v_seconds::text || 's';
  else
    v_duration := v_seconds::text || 's';
  end if;

  v_body := case v_log.status
    when 'ended' then initcap(v_log.mode) || ' call - ' || v_duration
    when 'missed' then 'Missed ' || lower(v_log.mode) || ' call'
    when 'no_answer' then initcap(v_log.mode) || ' call - no answer'
    when 'declined' then initcap(v_log.mode) || ' call - declined'
    when 'busy' then initcap(v_log.mode) || ' call - busy'
    when 'cancelled' then initcap(v_log.mode) || ' call - cancelled'
    else initcap(v_log.mode) || ' call - failed'
  end;

  if v_log.call_kind = 'PERSONAL' and v_log.thread_id is not null then
    insert into public.buklod_connect_direct_messages(
      thread_id, sender_id, body, created_at
    ) values (
      v_log.thread_id,
      v_log.created_by,
      v_body,
      coalesce(v_log.ended_at, now())
    );
  elsif v_log.call_kind = 'SCOPE' and v_log.scope_id is not null then
    insert into public.buklod_connect_scope_messages(
      scope_id, sender_id, body, created_at
    ) values (
      v_log.scope_id,
      v_log.created_by,
      v_body,
      coalesce(v_log.ended_at, now())
    );
  end if;

  update public.buklod_call_logs
  set final_message_at = now(),
      updated_at = now()
  where id = _call_log_id;
end;
$$;

revoke all on function public.buklod_finalize_call_log_message(uuid)
from public, anon, authenticated;

create or replace function public.buklod_call_log_start(
  _stream_call_cid text,
  _call_kind text,
  _thread_id uuid default null,
  _scope_id uuid default null,
  _mode text default 'audio',
  _title text default null,
  _created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_kind text := upper(trim(coalesce(_call_kind, '')));
  v_mode text := lower(trim(coalesce(_mode, 'audio')));
  v_cid text := trim(coalesce(_stream_call_cid, ''));
  v_creator uuid;
  v_log_id uuid;
  v_user_one uuid;
  v_user_two uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if v_cid = '' then
    raise exception 'Stream call id required';
  end if;
  if v_kind not in ('PERSONAL','SCOPE') then
    raise exception 'Unsupported BUKLOD call kind';
  end if;
  if v_mode not in ('audio','video') then
    v_mode := 'audio';
  end if;

  v_creator := coalesce(_created_by, v_uid);

  if v_kind = 'PERSONAL' then
    if _thread_id is null or _scope_id is not null then
      raise exception 'Personal call requires a direct thread';
    end if;

    select t.user_one, t.user_two
    into v_user_one, v_user_two
    from public.buklod_connect_direct_threads t
    where t.id = _thread_id;

    if v_user_one is null or v_user_two is null then
      raise exception 'Direct thread not found';
    end if;
    if v_uid not in (v_user_one, v_user_two) then
      raise exception 'Direct thread access required';
    end if;
    if v_creator not in (v_user_one, v_user_two) then
      raise exception 'Invalid call creator';
    end if;
  else
    if _scope_id is null or _thread_id is not null then
      raise exception 'Scope call requires a scope';
    end if;
    perform 1
    from public.buklod_connect_scope_call_members(_scope_id)
    limit 1;
  end if;

  insert into public.buklod_call_logs(
    stream_call_cid, call_kind, thread_id, scope_id,
    mode, title, created_by, status
  ) values (
    v_cid,
    v_kind,
    case when v_kind = 'PERSONAL' then _thread_id else null end,
    case when v_kind = 'SCOPE' then _scope_id else null end,
    v_mode,
    nullif(trim(coalesce(_title, '')), ''),
    v_creator,
    'ringing'
  )
  on conflict (stream_call_cid) do nothing
  returning id into v_log_id;

  if v_log_id is null then
    select l.id
    into v_log_id
    from public.buklod_call_logs l
    where l.stream_call_cid = v_cid;
  end if;

  if v_kind = 'PERSONAL' then
    insert into public.buklod_call_participants(call_log_id,user_id,participant_role)
    values
      (v_log_id, v_user_one, case when v_user_one = v_creator then 'caller' else 'callee' end),
      (v_log_id, v_user_two, case when v_user_two = v_creator then 'caller' else 'callee' end)
    on conflict (call_log_id,user_id) do nothing;
  else
    insert into public.buklod_call_participants(call_log_id,user_id,participant_role)
    select
      v_log_id,
      m.user_id,
      case when m.user_id = v_creator then 'caller' else 'callee' end
    from public.buklod_connect_scope_call_members(_scope_id) m
    on conflict (call_log_id,user_id) do nothing;

    insert into public.buklod_call_participants(call_log_id,user_id,participant_role)
    values (v_log_id, v_creator, 'caller')
    on conflict (call_log_id,user_id) do update
      set participant_role = 'caller', updated_at = now();
  end if;

  if not public.buklod_is_system_admin()
     and not exists (
       select 1
       from public.buklod_call_participants p
       where p.call_log_id = v_log_id
         and p.user_id = v_uid
     )
  then
    raise exception 'Call participant access required';
  end if;

  return v_log_id;
end;
$$;

grant execute on function public.buklod_call_log_start(text,text,uuid,uuid,text,text,uuid)
to authenticated;
revoke execute on function public.buklod_call_log_start(text,text,uuid,uuid,text,text,uuid)
from anon;

create or replace function public.buklod_call_log_event(
  _stream_call_cid text,
  _event text,
  _reason text default null,
  _event_user_id uuid default null,
  _event_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_log public.buklod_call_logs%rowtype;
  v_log_id uuid;
  v_event text := lower(trim(coalesce(_event, '')));
  v_reason text := lower(trim(coalesce(_reason, '')));
  v_subject uuid;
  v_when timestamptz := coalesce(_event_at, now());
  v_callees integer := 0;
  v_pending integer := 0;
  v_busy integer := 0;
  v_rejected integer := 0;
  v_accepted integer := 0;
  v_terminal boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select l.*
  into v_log
  from public.buklod_call_logs l
  where l.stream_call_cid = trim(coalesce(_stream_call_cid, ''))
  for update;

  if not found then
    return;
  end if;

  v_log_id := v_log.id;

  if not public.buklod_is_system_admin()
     and not exists (
       select 1
       from public.buklod_call_participants p
       where p.call_log_id = v_log_id
         and p.user_id = v_uid
     )
  then
    raise exception 'Call participant access required';
  end if;

  v_subject := coalesce(_event_user_id, v_uid);
  if not exists (
    select 1
    from public.buklod_call_participants p
    where p.call_log_id = v_log_id
      and p.user_id = v_subject
  ) then
    v_subject := v_uid;
  end if;

  if v_event = 'call.accepted' then
    update public.buklod_call_participants
    set response_status = 'accepted',
        response_reason = nullif(v_reason,''),
        responded_at = coalesce(responded_at,v_when),
        updated_at = now()
    where call_log_id = v_log_id
      and user_id = v_subject;

    update public.buklod_call_logs
    set status = case when status = 'ended' then status else 'connected' end,
        started_at = coalesce(started_at,v_when),
        updated_at = now()
    where id = v_log_id;

  elsif v_event in ('call.session_started','call.session_participant_joined') then
    update public.buklod_call_logs
    set status = case when status = 'ended' then status else 'connected' end,
        started_at = coalesce(started_at,v_when),
        updated_at = now()
    where id = v_log_id;

  elsif v_event = 'call.rejected' then
    update public.buklod_call_participants
    set response_status = case
          when v_reason = 'busy' then 'busy'
          when v_reason in ('timeout','no_answer') then 'timeout'
          when v_reason in ('cancel','cancelled') then 'cancelled'
          else 'rejected'
        end,
        response_reason = nullif(v_reason,''),
        responded_at = v_when,
        updated_at = now()
    where call_log_id = v_log_id
      and user_id = v_subject;

    if v_subject = v_log.created_by
       and v_reason in ('cancel','cancelled')
    then
      update public.buklod_call_logs
      set status = 'cancelled',
          ended_at = coalesce(ended_at,v_when),
          updated_at = now()
      where id = v_log_id
        and status not in ('connected','ended');
      v_terminal := true;
    end if;

  elsif v_event = 'call.missed' then
    update public.buklod_call_participants
    set response_status = 'missed',
        response_reason = coalesce(nullif(v_reason,''),'timeout'),
        responded_at = v_when,
        updated_at = now()
    where call_log_id = v_log_id
      and user_id = v_subject;

  elsif v_event in ('call.session_ended','call.ended') then
    update public.buklod_call_logs
    set status = 'ended',
        ended_at = coalesce(ended_at,v_when),
        duration_seconds = greatest(
          0,
          floor(extract(epoch from (coalesce(ended_at,v_when) - coalesce(started_at,created_at))))::integer
        ),
        updated_at = now()
    where id = v_log_id;
    v_terminal := true;
  end if;

  select
    count(*) filter (where p.user_id <> v_log.created_by),
    count(*) filter (where p.user_id <> v_log.created_by and p.response_status = 'ringing'),
    count(*) filter (where p.user_id <> v_log.created_by and p.response_status = 'busy'),
    count(*) filter (where p.user_id <> v_log.created_by and p.response_status = 'rejected'),
    count(*) filter (where p.user_id <> v_log.created_by and p.response_status = 'accepted')
  into v_callees, v_pending, v_busy, v_rejected, v_accepted
  from public.buklod_call_participants p
  where p.call_log_id = v_log_id;

  select l.*
  into v_log
  from public.buklod_call_logs l
  where l.id = v_log_id;

  if not v_terminal
     and v_log.status = 'ringing'
     and v_accepted = 0
     and v_callees > 0
     and v_pending = 0
  then
    update public.buklod_call_logs
    set status = case
          when v_busy = v_callees then 'busy'
          when v_rejected = v_callees then 'declined'
          else 'no_answer'
        end,
        ended_at = coalesce(ended_at,v_when),
        updated_at = now()
    where id = v_log_id;
    v_terminal := true;
  end if;

  if v_terminal then
    perform public.buklod_finalize_call_log_message(v_log_id);
  end if;
end;
$$;

grant execute on function public.buklod_call_log_event(text,text,text,uuid,timestamptz)
to authenticated;
revoke execute on function public.buklod_call_log_event(text,text,text,uuid,timestamptz)
from anon;

-- Match the UI: Cluster, Organization, and Sub-organization scopes can place calls.
create or replace function public.buklod_connect_scope_call_members(_scope_id uuid)
returns table(user_id uuid, is_admin boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_scope_type text;
  v_scope_status text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select s.scope_type, s.status
  into v_scope_type, v_scope_status
  from public.buklod_scopes s
  where s.id = _scope_id;

  if v_scope_type is null then
    raise exception 'Scope not found';
  end if;
  if v_scope_type not in (
    'CLUSTER','ORGANIZATION','SUB_ORGANIZATION','SUB-ORGANIZATION',
    'SUBORGANIZATION','SUB_ORG','SUB-ORG'
  ) then
    raise exception 'Audio/video calls are unavailable for this scope type';
  end if;
  if v_scope_status in ('SUSPENDED','DELETED','ARCHIVED') then
    raise exception 'This scope is not available for calls';
  end if;

  if not public.buklod_is_system_admin()
     and not exists (
       select 1
       from public.buklod_scope_memberships m
       where m.scope_id = _scope_id
         and m.user_id = v_user_id
         and m.membership_status = 'ACTIVE'
     )
  then
    raise exception 'Active scope membership required';
  end if;

  return query
  select
    m.user_id,
    exists (
      select 1
      from public.buklod_scope_role_assignments ra
      where ra.scope_id = m.scope_id
        and ra.user_id = m.user_id
        and ra.status = 'ACTIVE'
        and ra.role_key in ('ADMIN','ORG_ADMIN')
    ) as is_admin
  from public.buklod_scope_memberships m
  where m.scope_id = _scope_id
    and m.membership_status = 'ACTIVE'
  order by m.joined_at nulls last, m.created_at, m.user_id;
end;
$$;

grant execute on function public.buklod_connect_scope_call_members(uuid)
to authenticated;
revoke execute on function public.buklod_connect_scope_call_members(uuid)
from anon;
