-- Cluster join requests and invitations notify the right person.
-- Approval and decline stay on the existing review and invite RPCs.
-- Cancelling your own request closes the admin notification and does not
-- tell you the request was declined.

create or replace function public.buklod_cluster_membership_decision_notify()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_cluster_name text;
  v_requester_name text;
  v_resolved text;
begin
  if not exists (
    select 1
    from public.buklod_scopes s
    where s.id = new.scope_id
      and s.scope_type = 'CLUSTER'
  ) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.membership_status is not distinct from new.membership_status then
    return new;
  end if;

  select coalesce(nullif(btrim(s.name), ''), 'a Cluster')
    into v_cluster_name
  from public.buklod_scopes s
  where s.id = new.scope_id;

  if new.membership_status = 'PENDING'
     and upper(coalesce(new.membership_source, 'SELF')) <> 'INVITE' then
    select coalesce(
      nullif(btrim(p.full_name), ''),
      nullif(btrim(p.username), ''),
      'Someone'
    )
      into v_requester_name
    from public.profiles p
    where p.id = new.user_id;

    v_requester_name := coalesce(v_requester_name, 'Someone');

    insert into public.notifications (user_id, title, body, kind, data)
    select
      ra.user_id,
      'Cluster join request',
      v_requester_name || ' wants to join ' || v_cluster_name || '.',
      'cluster_join_request',
      jsonb_build_object(
        'scope_id', new.scope_id,
        'requester_user_id', new.user_id,
        'requester_name', v_requester_name,
        'cluster_name', v_cluster_name,
        'route', '/clusters/join-requests?cluster=' || new.scope_id::text
      )
    from public.buklod_scope_role_assignments ra
    where ra.scope_id = new.scope_id
      and ra.status = 'ACTIVE'
      and ra.user_id <> new.user_id
      and upper(ra.role_key) in (
        'ADMIN',
        'CLUSTER_ADMIN',
        'ORG_ADMIN',
        'CHURCH_ADMIN'
      )
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = ra.user_id
          and n.kind = 'cluster_join_request'
          and coalesce(n.data ->> 'resolved', '') = ''
          and n.data ->> 'scope_id' = new.scope_id::text
          and n.data ->> 'requester_user_id' = new.user_id::text
      );
  end if;

  if new.membership_status = 'INVITED' then
    insert into public.notifications (user_id, title, body, kind, data)
    select
      new.user_id,
      'Cluster invitation',
      'You are invited to join ' || v_cluster_name || '.',
      'cluster_invite',
      jsonb_build_object(
        'scope_id', new.scope_id,
        'cluster_name', v_cluster_name,
        'route', '/clusters/' || new.scope_id::text || '?fromInvite=1'
      )
    where not exists (
      select 1
      from public.notifications n
      where n.user_id = new.user_id
        and n.kind = 'cluster_invite'
        and coalesce(n.data ->> 'resolved', '') = ''
        and n.data ->> 'scope_id' = new.scope_id::text
    );
  end if;

  if tg_op = 'UPDATE'
     and old.membership_status = 'PENDING'
     and new.membership_status is distinct from 'PENDING' then
    v_resolved := case
      when new.membership_status = 'ACTIVE' then 'APPROVED'
      else 'CLOSED'
    end;

    update public.notifications
    set
      data = coalesce(data, '{}'::jsonb) || jsonb_build_object('resolved', v_resolved),
      read_at = coalesce(read_at, pg_catalog.now())
    where kind = 'cluster_join_request'
      and coalesce(data ->> 'resolved', '') = ''
      and data ->> 'scope_id' = new.scope_id::text
      and data ->> 'requester_user_id' = new.user_id::text;
  end if;

  if tg_op = 'UPDATE'
     and old.membership_status = 'INVITED'
     and new.membership_status is distinct from 'INVITED' then
    v_resolved := case
      when new.membership_status = 'ACTIVE' then 'ACCEPTED'
      else 'DECLINED'
    end;

    update public.notifications
    set
      data = coalesce(data, '{}'::jsonb) || jsonb_build_object('resolved', v_resolved),
      read_at = coalesce(read_at, pg_catalog.now())
    where user_id = new.user_id
      and kind = 'cluster_invite'
      and coalesce(data ->> 'resolved', '') = ''
      and data ->> 'scope_id' = new.scope_id::text;
  end if;

  return new;
end;
$function$;

revoke all on function public.buklod_cluster_membership_decision_notify() from public;
grant execute on function public.buklod_cluster_membership_decision_notify() to authenticated, service_role;

drop trigger if exists buklod_cluster_membership_decision_notify
  on public.buklod_scope_memberships;

create trigger buklod_cluster_membership_decision_notify
after insert or update of membership_status
on public.buklod_scope_memberships
for each row
execute function public.buklod_cluster_membership_decision_notify();

create or replace function public.buklod_review_cluster_request(
  _scope_id uuid,
  _user_id uuid,
  _approve boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid;
  v_cluster_name text;
begin
  v_actor := (select auth.uid());

  if v_actor is null then
    raise exception 'authentication required';
  end if;

  if not public.buklod_is_scope_admin(_scope_id) then
    raise exception 'cluster admin required';
  end if;

  if not exists (
    select 1
    from public.buklod_scope_memberships m
    join public.buklod_scopes s
      on s.id = m.scope_id
    where m.scope_id = _scope_id
      and m.user_id = _user_id
      and m.membership_status = 'PENDING'
      and s.scope_type = 'CLUSTER'
  ) then
    raise exception 'pending request not found';
  end if;

  if _approve then
    update public.buklod_scope_memberships
    set
      membership_status = 'ACTIVE',
      membership_source = 'APPROVAL',
      joined_at = pg_catalog.now(),
      left_at = null
    where scope_id = _scope_id
      and user_id = _user_id;

    insert into public.buklod_scope_role_assignments (
      scope_id,
      user_id,
      role_key,
      status,
      assigned_by,
      revoked_at
    )
    values (
      _scope_id,
      _user_id,
      'MEMBER',
      'ACTIVE',
      v_actor,
      null
    )
    on conflict (scope_id, user_id, role_key)
    do update set
      status = 'ACTIVE',
      assigned_by = v_actor,
      revoked_at = null;
  else
    update public.buklod_scope_memberships
    set
      membership_status = 'LEFT',
      left_at = pg_catalog.now()
    where scope_id = _scope_id
      and user_id = _user_id;
  end if;

  select coalesce(nullif(btrim(s.name), ''), 'the Cluster')
    into v_cluster_name
  from public.buklod_scopes s
  where s.id = _scope_id;

  v_cluster_name := coalesce(v_cluster_name, 'the Cluster');

  insert into public.notifications (user_id, title, body, kind, data)
  values (
    _user_id,
    case
      when _approve then 'You joined a Cluster'
      else 'Cluster request update'
    end,
    case
      when _approve then
        'Your request was approved. You can open ' || v_cluster_name || '.'
      else
        'Your request to join ' || v_cluster_name || ' was not approved.'
    end,
    'cluster_join_result',
    jsonb_build_object(
      'scope_id', _scope_id,
      'cluster_name', v_cluster_name,
      'resolved', case when _approve then 'APPROVED' else 'DECLINED' end,
      'route', '/clusters/' || _scope_id::text
    )
  );
end;
$function$;
