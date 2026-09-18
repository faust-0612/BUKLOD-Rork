-- BUKLOD Bahay live-sync + reminder hardening.
create or replace function public.buklod_home_next_due(p_due timestamptz,p_recurrence text)
returns timestamptz
language sql stable
set search_path=''
as $$
  select case upper(coalesce(p_recurrence,'NONE'))
    when 'DAILY' then coalesce(p_due,now()) + interval '1 day'
    when 'WEEKLY' then coalesce(p_due,now()) + interval '7 days'
    when 'MONTHLY' then coalesce(p_due,now()) + interval '1 month'
    else null
  end;
$$;

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
      and i.confirmation_status<>'PENDING'
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
      and i.confirmation_status<>'PENDING'
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

do $$
declare t text;
begin
  foreach t in array array[
    'buklod_home_files',
    'buklod_home_polls',
    'buklod_home_poll_options',
    'buklod_home_poll_votes'
  ] loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
