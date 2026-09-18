-- BUKLOD Bahay E2E R2
-- Recurring/rotating chores, confirmation workflow, quiet notifications, overdue escalation.

alter table public.buklod_home_items
  add column if not exists recurrence text not null default 'NONE'
    check (recurrence in ('NONE','DAILY','WEEKLY','MONTHLY')),
  add column if not exists rotation_enabled boolean not null default false,
  add column if not exists requires_confirmation boolean not null default false,
  add column if not exists confirmation_status text not null default 'NONE'
    check (confirmation_status in ('NONE','PENDING','CONFIRMED','REJECTED')),
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists confirmed_at timestamptz;

create table if not exists public.buklod_home_member_preferences (
  home_id uuid not null references public.buklod_homes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quiet_enabled boolean not null default false,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  timezone text not null default 'Asia/Manila',
  notify_messages boolean not null default true,
  notify_tasks boolean not null default true,
  notify_due boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(home_id,user_id)
);

alter table public.buklod_home_member_preferences enable row level security;

drop policy if exists "Bahay members manage own preferences" on public.buklod_home_member_preferences;
create policy "Bahay members manage own preferences"
on public.buklod_home_member_preferences
for all to authenticated
using(user_id=(select auth.uid()) and public.buklod_home_is_member(home_id))
with check(user_id=(select auth.uid()) and public.buklod_home_is_member(home_id));

grant select,insert,update,delete on public.buklod_home_member_preferences to authenticated;

create or replace function public.buklod_home_notifications_allowed(
  p_home_id uuid,
  p_user_id uuid,
  p_kind text
) returns boolean
language plpgsql stable security definer
set search_path=''
as $$
declare
  v_pref public.buklod_home_member_preferences%rowtype;
  v_local time;
  v_quiet boolean := false;
begin
  select * into v_pref
  from public.buklod_home_member_preferences
  where home_id=p_home_id and user_id=p_user_id;

  if p_kind='MESSAGE' and coalesce(v_pref.notify_messages,true)=false then return false; end if;
  if p_kind='TASK' and coalesce(v_pref.notify_tasks,true)=false then return false; end if;
  if p_kind='DUE' and coalesce(v_pref.notify_due,true)=false then return false; end if;

  if coalesce(v_pref.quiet_enabled,false)=false then return true; end if;

  begin
    v_local := (timezone(coalesce(nullif(v_pref.timezone,''),'Asia/Manila'),now()))::time;
  exception when others then
    v_local := (timezone('Asia/Manila',now()))::time;
  end;

  if v_pref.quiet_start <= v_pref.quiet_end then
    v_quiet := v_local >= v_pref.quiet_start and v_local < v_pref.quiet_end;
  else
    v_quiet := v_local >= v_pref.quiet_start or v_local < v_pref.quiet_end;
  end if;

  return not v_quiet;
end $$;

revoke all on function public.buklod_home_notifications_allowed(uuid,uuid,text) from public,anon;
grant execute on function public.buklod_home_notifications_allowed(uuid,uuid,text) to authenticated;

create or replace function public.buklod_home_message_notify()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.notifications(user_id,title,body,kind,data)
  select m.user_id,'Bahay · Bagong Mensahe',left(new.body,180),'buklod_home_message',
         jsonb_build_object('route','/personal-home','home_id',new.home_id)
  from public.buklod_home_members m
  where m.home_id=new.home_id
    and m.status='ACTIVE'
    and m.user_id<>new.sender_id
    and (m.expires_at is null or m.expires_at>now())
    and public.buklod_home_notifications_allowed(new.home_id,m.user_id,'MESSAGE');
  return new;
end $$;

revoke all on function public.buklod_home_message_notify() from public,anon,authenticated;

create or replace function public.buklod_home_task_notify()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.assigned_to is not null
     and new.assigned_to<>new.created_by
     and new.item_type in ('TASK','MAINTENANCE','REMINDER','EVENT')
     and public.buklod_home_notifications_allowed(new.home_id,new.assigned_to,'TASK') then
    insert into public.notifications(user_id,title,body,kind,data)
    values(new.assigned_to,'Bahay · Bagong Gawain',new.title,'buklod_home_task',
      jsonb_build_object('route','/personal-home','home_id',new.home_id,'item_id',new.id));
  end if;
  return new;
end $$;

revoke all on function public.buklod_home_task_notify() from public,anon,authenticated;

create or replace function public.buklod_home_next_due(p_due timestamptz,p_recurrence text)
returns timestamptz
language sql immutable
set search_path=''
as $$
  select case upper(coalesce(p_recurrence,'NONE'))
    when 'DAILY' then coalesce(p_due,now()) + interval '1 day'
    when 'WEEKLY' then coalesce(p_due,now()) + interval '7 days'
    when 'MONTHLY' then coalesce(p_due,now()) + interval '1 month'
    else null
  end;
$$;

revoke all on function public.buklod_home_next_due(timestamptz,text) from public,anon;
grant execute on function public.buklod_home_next_due(timestamptz,text) to authenticated;

create or replace function public.buklod_home_next_assignee(
  p_home_id uuid,
  p_current uuid
) returns uuid
language plpgsql stable security definer
set search_path=''
as $$
declare v_joined timestamptz; v_next uuid;
begin
  select joined_at into v_joined
  from public.buklod_home_members
  where home_id=p_home_id and user_id=p_current and status='ACTIVE';

  select m.user_id into v_next
  from public.buklod_home_members m
  where m.home_id=p_home_id and m.status='ACTIVE'
    and m.role<>'GUEST'
    and (m.expires_at is null or m.expires_at>now())
    and (
      v_joined is null
      or m.joined_at>v_joined
      or (m.joined_at=v_joined and m.user_id>coalesce(p_current,'00000000-0000-0000-0000-000000000000'::uuid))
    )
  order by m.joined_at,m.user_id
  limit 1;

  if v_next is null then
    select m.user_id into v_next
    from public.buklod_home_members m
    where m.home_id=p_home_id and m.status='ACTIVE'
      and m.role<>'GUEST'
      and (m.expires_at is null or m.expires_at>now())
    order by m.joined_at,m.user_id
    limit 1;
  end if;

  return v_next;
end $$;

revoke all on function public.buklod_home_next_assignee(uuid,uuid) from public,anon;
grant execute on function public.buklod_home_next_assignee(uuid,uuid) to authenticated;

create or replace function public.buklod_home_spawn_recurrence(p_item_id uuid)
returns uuid
language plpgsql security definer
set search_path=''
as $$
declare
  v_item public.buklod_home_items%rowtype;
  v_id uuid;
  v_assignee uuid;
  v_due timestamptz;
begin
  select * into v_item from public.buklod_home_items where id=p_item_id;
  if v_item.id is null or v_item.recurrence='NONE' then return null; end if;

  v_due := public.buklod_home_next_due(v_item.due_at,v_item.recurrence);
  v_assignee := case
    when v_item.rotation_enabled then public.buklod_home_next_assignee(v_item.home_id,v_item.assigned_to)
    else v_item.assigned_to
  end;

  insert into public.buklod_home_items(
    home_id,room,item_type,title,body,assigned_to,due_at,amount,visibility,reminder_enabled,
    created_by,metadata,recurrence,rotation_enabled,requires_confirmation,confirmation_status
  ) values(
    v_item.home_id,v_item.room,v_item.item_type,v_item.title,v_item.body,v_assignee,v_due,v_item.amount,
    v_item.visibility,v_item.reminder_enabled,v_item.created_by,v_item.metadata,v_item.recurrence,
    v_item.rotation_enabled,v_item.requires_confirmation,'NONE'
  )
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.buklod_home_spawn_recurrence(uuid) from public,anon,authenticated;

create or replace function public.buklod_home_complete_item_v1(p_item_id uuid,p_done boolean)
returns void
language plpgsql security definer
set search_path=''
as $$
declare
  v_item public.buklod_home_items%rowtype;
  v_was_done boolean;
  v_user uuid := (select auth.uid());
begin
  select * into v_item from public.buklod_home_items where id=p_item_id for update;

  if v_item.id is null or not public.buklod_home_is_member(v_item.home_id) then
    raise exception 'Item not available';
  end if;
  if v_item.visibility='PRIVATE' and v_item.created_by<>v_user then raise exception 'Private item'; end if;
  if v_item.visibility='ADULTS' and not public.buklod_home_is_adult(v_item.home_id) then raise exception 'Adults only'; end if;

  if p_done=false then
    update public.buklod_home_items
    set is_done=false,completed_at=null,completed_by=null,confirmed_by=null,confirmed_at=null,
        confirmation_status='NONE',updated_at=now()
    where id=p_item_id;
    return;
  end if;

  if v_item.is_done then return; end if;

  if v_item.requires_confirmation then
    if v_item.confirmation_status='PENDING' then return; end if;

    update public.buklod_home_items
    set is_done=false,completed_at=now(),completed_by=v_user,confirmation_status='PENDING',updated_at=now()
    where id=p_item_id;

    insert into public.notifications(user_id,title,body,kind,data)
    select m.user_id,'Bahay · Kailangan ng Confirmation',v_item.title,'buklod_home_confirmation',
      jsonb_build_object('route','/personal-home','home_id',v_item.home_id,'item_id',v_item.id)
    from public.buklod_home_members m
    where m.home_id=v_item.home_id and m.status='ACTIVE' and m.role in ('OWNER','ADMIN','ADULT')
      and m.user_id<>v_user and (m.expires_at is null or m.expires_at>now())
      and public.buklod_home_notifications_allowed(v_item.home_id,m.user_id,'TASK');

    return;
  end if;

  v_was_done:=v_item.is_done;

  update public.buklod_home_items
  set is_done=true,completed_at=now(),completed_by=v_user,confirmation_status='NONE',updated_at=now()
  where id=p_item_id;

  if not v_was_done and v_item.item_type in ('TASK','MAINTENANCE') and v_item.visibility<>'PRIVATE' then
    update public.buklod_homes
    set garden_energy=garden_energy+1,updated_at=now()
    where id=v_item.home_id;
  end if;

  if v_item.recurrence<>'NONE' then
    perform public.buklod_home_spawn_recurrence(v_item.id);
  end if;
end $$;

create or replace function public.buklod_home_confirm_item_v1(p_item_id uuid,p_approve boolean)
returns void
language plpgsql security definer
set search_path=''
as $$
declare
  v_item public.buklod_home_items%rowtype;
  v_user uuid := (select auth.uid());
begin
  select * into v_item from public.buklod_home_items where id=p_item_id for update;

  if v_item.id is null or not public.buklod_home_is_adult(v_item.home_id) then
    raise exception 'Adult confirmation access required';
  end if;
  if v_item.confirmation_status<>'PENDING' then
    raise exception 'Item is not awaiting confirmation';
  end if;
  if v_item.completed_by=v_user then
    raise exception 'Another adult must confirm this task';
  end if;

  if p_approve then
    update public.buklod_home_items
    set is_done=true,confirmation_status='CONFIRMED',confirmed_by=v_user,confirmed_at=now(),updated_at=now()
    where id=p_item_id;

    if v_item.item_type in ('TASK','MAINTENANCE') and v_item.visibility<>'PRIVATE' then
      update public.buklod_homes
      set garden_energy=garden_energy+1,updated_at=now()
      where id=v_item.home_id;
    end if;

    if v_item.recurrence<>'NONE' then
      perform public.buklod_home_spawn_recurrence(v_item.id);
    end if;

    if v_item.completed_by is not null
       and public.buklod_home_notifications_allowed(v_item.home_id,v_item.completed_by,'TASK') then
      insert into public.notifications(user_id,title,body,kind,data)
      values(
        v_item.completed_by,'Bahay · Confirmed',v_item.title,'buklod_home_confirmation',
        jsonb_build_object('route','/personal-home','home_id',v_item.home_id,'item_id',v_item.id)
      );
    end if;
  else
    update public.buklod_home_items
    set is_done=false,confirmation_status='REJECTED',confirmed_by=v_user,confirmed_at=now(),
        completed_by=null,completed_at=null,updated_at=now()
    where id=p_item_id;
  end if;
end $$;

revoke all on function public.buklod_home_confirm_item_v1(uuid,boolean) from public,anon;
grant execute on function public.buklod_home_confirm_item_v1(uuid,boolean) to authenticated;

create or replace function public.buklod_home_enqueue_due_reminders()
returns integer
language plpgsql security definer
set search_path=''
as $$
declare v_count integer := 0; v_added integer := 0;
begin
  with candidates as (
    select i.id,i.home_id,i.title,coalesce(i.assigned_to,m.user_id) target_user
    from public.buklod_home_items i
    left join public.buklod_home_members m
      on m.home_id=i.home_id
     and i.assigned_to is null
     and m.status='ACTIVE'
     and (m.expires_at is null or m.expires_at>now())
    where i.is_done=false
      and i.reminder_enabled=true
      and i.due_at is not null
      and i.due_at>now()
      and i.due_at<=now()+interval '1 hour'
      and i.item_type in ('TASK','MAINTENANCE','REMINDER','EVENT','BILL')
  ), allowed as (
    select * from candidates c
    where c.target_user is not null
      and public.buklod_home_notifications_allowed(c.home_id,c.target_user,'DUE')
  ), inserted as (
    insert into public.buklod_home_reminder_dispatches(item_id,user_id,reminder_key)
    select id,target_user,'DUE_1H' from allowed
    on conflict do nothing
    returning item_id,user_id
  )
  insert into public.notifications(user_id,title,body,kind,data)
  select ins.user_id,'Bahay · Paalala',a.title||' · due within 1 hour','buklod_home_due',
         jsonb_build_object('route','/personal-home','home_id',a.home_id,'item_id',a.id)
  from inserted ins
  join allowed a on a.id=ins.item_id and a.target_user=ins.user_id;

  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;

  with overdue as (
    select i.id,i.home_id,i.title,coalesce(i.assigned_to,m.user_id) target_user
    from public.buklod_home_items i
    left join public.buklod_home_members m
      on m.home_id=i.home_id
     and i.assigned_to is null
     and m.status='ACTIVE'
     and (m.expires_at is null or m.expires_at>now())
    where i.is_done=false
      and i.reminder_enabled=true
      and i.due_at is not null
      and i.due_at<=now()-interval '30 minutes'
      and i.due_at>now()-interval '6 hours'
      and i.item_type in ('TASK','MAINTENANCE','REMINDER','EVENT','BILL')
  ), allowed as (
    select * from overdue c
    where c.target_user is not null
      and public.buklod_home_notifications_allowed(c.home_id,c.target_user,'DUE')
  ), inserted as (
    insert into public.buklod_home_reminder_dispatches(item_id,user_id,reminder_key)
    select id,target_user,'OVERDUE_30M' from allowed
    on conflict do nothing
    returning item_id,user_id
  )
  insert into public.notifications(user_id,title,body,kind,data)
  select ins.user_id,'Bahay · Overdue',a.title||' · hindi pa tapos','buklod_home_overdue',
         jsonb_build_object('route','/personal-home','home_id',a.home_id,'item_id',a.id)
  from inserted ins
  join allowed a on a.id=ins.item_id and a.target_user=ins.user_id;

  get diagnostics v_added=row_count;
  v_count:=v_count+v_added;

  return v_count;
end $$;

revoke all on function public.buklod_home_enqueue_due_reminders() from public,anon,authenticated;
