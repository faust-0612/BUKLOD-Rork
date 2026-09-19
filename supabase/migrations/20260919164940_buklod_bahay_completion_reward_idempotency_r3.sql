create or replace function public.buklod_home_spawn_recurrence(p_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_item public.buklod_home_items%rowtype;
  v_id uuid;
  v_assignee uuid;
  v_due timestamptz;
  v_candidate uuid;
  v_child_metadata jsonb;
begin
  select * into v_item
  from public.buklod_home_items
  where id=p_item_id;

  if v_item.id is null or v_item.recurrence='NONE' then
    return null;
  end if;

  v_due := public.buklod_home_next_due(v_item.due_at,v_item.recurrence);

  if coalesce(v_item.metadata->>'_buklod_recurrence_spawned','false')='true' then
    begin
      v_id := nullif(v_item.metadata->>'_buklod_recurrence_successor_id','')::uuid;
    exception when invalid_text_representation then
      v_id := null;
    end;
    return v_id;
  end if;

  select i.id into v_candidate
  from public.buklod_home_items i
  where i.id<>v_item.id
    and i.home_id=v_item.home_id
    and i.room=v_item.room
    and i.item_type=v_item.item_type
    and i.title=v_item.title
    and i.created_by=v_item.created_by
    and i.visibility=v_item.visibility
    and i.recurrence=v_item.recurrence
    and i.due_at is not distinct from v_due
  order by i.created_at asc
  limit 1;

  if v_candidate is not null then
    update public.buklod_home_items
    set metadata=coalesce(metadata,'{}'::jsonb) ||
      jsonb_build_object(
        '_buklod_recurrence_spawned',true,
        '_buklod_recurrence_successor_id',v_candidate::text
      ),
      updated_at=now()
    where id=v_item.id;
    return v_candidate;
  end if;

  v_assignee := case
    when v_item.rotation_enabled then public.buklod_home_next_assignee(v_item.home_id,v_item.assigned_to)
    else v_item.assigned_to
  end;

  v_child_metadata :=
    coalesce(v_item.metadata,'{}'::jsonb)
    - '_buklod_garden_energy_granted'
    - '_buklod_recurrence_spawned'
    - '_buklod_recurrence_successor_id';

  insert into public.buklod_home_items(
    home_id,room,item_type,title,body,assigned_to,due_at,amount,visibility,reminder_enabled,
    created_by,metadata,recurrence,rotation_enabled,requires_confirmation,confirmation_status
  ) values(
    v_item.home_id,v_item.room,v_item.item_type,v_item.title,v_item.body,v_assignee,v_due,v_item.amount,
    v_item.visibility,v_item.reminder_enabled,v_item.created_by,v_child_metadata,v_item.recurrence,
    v_item.rotation_enabled,v_item.requires_confirmation,'NONE'
  )
  returning id into v_id;

  update public.buklod_home_items
  set metadata=coalesce(metadata,'{}'::jsonb) ||
    jsonb_build_object(
      '_buklod_recurrence_spawned',true,
      '_buklod_recurrence_successor_id',v_id::text
    ),
    updated_at=now()
  where id=v_item.id;

  return v_id;
end
$function$;

create or replace function public.buklod_home_complete_item_v1(p_item_id uuid,p_done boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_item public.buklod_home_items%rowtype;
  v_user uuid := (select auth.uid());
  v_energy_already_granted boolean;
begin
  select * into v_item
  from public.buklod_home_items
  where id=p_item_id
  for update;

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

  update public.buklod_home_items
  set is_done=true,completed_at=now(),completed_by=v_user,confirmation_status='NONE',updated_at=now()
  where id=p_item_id;

  v_energy_already_granted :=
    coalesce(v_item.metadata->>'_buklod_garden_energy_granted','false')='true';

  if not v_energy_already_granted
     and v_item.item_type in ('TASK','MAINTENANCE')
     and v_item.visibility<>'PRIVATE' then
    update public.buklod_homes
    set garden_energy=garden_energy+1,updated_at=now()
    where id=v_item.home_id;

    update public.buklod_home_items
    set metadata=coalesce(metadata,'{}'::jsonb) ||
      jsonb_build_object('_buklod_garden_energy_granted',true),
      updated_at=now()
    where id=p_item_id;
  end if;

  if v_item.recurrence<>'NONE' then
    perform public.buklod_home_spawn_recurrence(v_item.id);
  end if;
end
$function$;

create or replace function public.buklod_home_confirm_item_v1(p_item_id uuid,p_approve boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_item public.buklod_home_items%rowtype;
  v_user uuid := (select auth.uid());
  v_energy_already_granted boolean;
begin
  select * into v_item
  from public.buklod_home_items
  where id=p_item_id
  for update;

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

    v_energy_already_granted :=
      coalesce(v_item.metadata->>'_buklod_garden_energy_granted','false')='true';

    if not v_energy_already_granted
       and v_item.item_type in ('TASK','MAINTENANCE')
       and v_item.visibility<>'PRIVATE' then
      update public.buklod_homes
      set garden_energy=garden_energy+1,updated_at=now()
      where id=v_item.home_id;

      update public.buklod_home_items
      set metadata=coalesce(metadata,'{}'::jsonb) ||
        jsonb_build_object('_buklod_garden_energy_granted',true),
        updated_at=now()
      where id=p_item_id;
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
end
$function$;

update public.buklod_home_items
set metadata=coalesce(metadata,'{}'::jsonb) ||
  jsonb_build_object('_buklod_garden_energy_granted',true),
  updated_at=now()
where is_done=true
  and item_type in ('TASK','MAINTENANCE')
  and visibility<>'PRIVATE'
  and coalesce(metadata->>'_buklod_garden_energy_granted','false')<>'true';
