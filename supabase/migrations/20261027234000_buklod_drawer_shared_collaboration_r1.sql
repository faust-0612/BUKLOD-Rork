-- Smart Drawer collaboration R1. Private local Drawer rows and assets are
-- never synchronized implicitly; sharing creates an explicit separate copy.
create table if not exists public.buklod_drawer_shared_folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scope_id uuid references public.buklod_scopes(id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table if not exists public.buklod_drawer_shared_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_local_id text,
  scope_id uuid references public.buklod_scopes(id) on delete set null,
  folder_id uuid references public.buklod_drawer_shared_folders(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '',
  item_type text not null default 'TASK',
  list_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(list_items) = 'array'),
  due_at timestamptz,
  expires_at timestamptz,
  protected_from_expiry boolean not null default true,
  deleted_at timestamptz,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','DONE','ARCHIVED','RECENTLY_REMOVED')),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buklod_drawer_collaborators (
  item_id uuid not null references public.buklod_drawer_shared_items(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text not null check (access_role in ('VIEWER','EDITOR')),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id),
  check (owner_id <> user_id)
);

create index if not exists buklod_drawer_shared_owner_idx
  on public.buklod_drawer_shared_items(owner_id, updated_at desc);
create index if not exists buklod_drawer_shared_scope_idx
  on public.buklod_drawer_shared_items(scope_id, updated_at desc)
  where scope_id is not null;
create index if not exists buklod_drawer_shared_folder_idx
  on public.buklod_drawer_shared_items(folder_id, updated_at desc);
create index if not exists buklod_drawer_shared_assigned_idx
  on public.buklod_drawer_shared_items(assigned_to, due_at)
  where status = 'ACTIVE' and assigned_to is not null;
create index if not exists buklod_drawer_shared_expiry_idx
  on public.buklod_drawer_shared_items(expires_at, id)
  where status = 'ACTIVE' and protected_from_expiry = false;
create index if not exists buklod_drawer_shared_trash_idx
  on public.buklod_drawer_shared_items(deleted_at, id)
  where status = 'RECENTLY_REMOVED' and protected_from_expiry = false;
create index if not exists buklod_drawer_shared_due_idx
  on public.buklod_drawer_shared_items(due_at, id)
  where status = 'ACTIVE' and due_at is not null;
create index if not exists buklod_drawer_collaborator_user_idx
  on public.buklod_drawer_collaborators(user_id, item_id);

alter table public.buklod_drawer_shared_items enable row level security;
alter table public.buklod_drawer_shared_folders enable row level security;
alter table public.buklod_drawer_collaborators enable row level security;

revoke all on public.buklod_drawer_shared_items from anon;
revoke all on public.buklod_drawer_shared_folders from anon;
revoke all on public.buklod_drawer_collaborators from anon;
grant select, insert, update, delete on public.buklod_drawer_shared_items to authenticated;
grant select, insert, update, delete on public.buklod_drawer_shared_folders to authenticated;
grant select, insert, delete on public.buklod_drawer_collaborators to authenticated;

create policy "drawer shared visible by explicit grant" on public.buklod_drawer_shared_items
for select to authenticated using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.buklod_drawer_collaborators c
    where c.item_id = id and c.user_id = (select auth.uid())
  )
  or (
    scope_id is not null and exists (
      select 1 from public.buklod_scope_memberships m
      where m.scope_id = buklod_drawer_shared_items.scope_id
        and m.user_id = (select auth.uid())
        and m.membership_status = 'ACTIVE'
    )
  )
);

create policy "drawer project folder visible only to collaborators" on public.buklod_drawer_shared_folders
for select to authenticated using (
  owner_id = (select auth.uid())
  or (scope_id is not null and exists (
    select 1 from public.buklod_scope_memberships m
    where m.scope_id = buklod_drawer_shared_folders.scope_id
      and m.user_id = (select auth.uid()) and m.membership_status = 'ACTIVE'
  ))
  or exists (
    select 1 from public.buklod_drawer_shared_items i
    where i.folder_id = buklod_drawer_shared_folders.id
  )
);

create policy "drawer project folder created by owner" on public.buklod_drawer_shared_folders
for insert to authenticated with check (
  owner_id = (select auth.uid()) and
  (scope_id is null or exists (
    select 1 from public.buklod_scope_memberships m
    where m.scope_id = buklod_drawer_shared_folders.scope_id
      and m.user_id = (select auth.uid()) and m.membership_status = 'ACTIVE'
  ))
);
create policy "drawer project folder owner renames" on public.buklod_drawer_shared_folders
for update to authenticated using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create policy "drawer project folder owner removes" on public.buklod_drawer_shared_folders
for delete to authenticated using (owner_id = (select auth.uid()));

-- Unfile in the same transaction before deleting a folder so the normal
-- revision trigger can preserve optimistic concurrency on every note.
create or replace function public.buklod_drawer_unfile_deleted_project()
returns trigger language plpgsql security invoker
set search_path = pg_catalog as $$
begin
  update public.buklod_drawer_shared_items i
  set folder_id = null, revision = i.revision + 1
  where i.folder_id = old.id;
  return old;
end;
$$;
create trigger buklod_drawer_unfile_deleted_project_trg
before delete on public.buklod_drawer_shared_folders
for each row execute function public.buklod_drawer_unfile_deleted_project();

create policy "drawer owner explicitly publishes shared copy" on public.buklod_drawer_shared_items
for insert to authenticated with check (
  owner_id = (select auth.uid())
  and (
    scope_id is null or exists (
      select 1 from public.buklod_scope_memberships m
      where m.scope_id = buklod_drawer_shared_items.scope_id
        and m.user_id = (select auth.uid())
        and m.membership_status = 'ACTIVE'
    )
  )
);

create policy "drawer owner or explicitly invited editor updates" on public.buklod_drawer_shared_items
for update to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.buklod_drawer_collaborators c
    where c.item_id = id and c.user_id = (select auth.uid())
      and c.access_role = 'EDITOR'
  )
)
with check (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.buklod_drawer_collaborators c
    where c.item_id = id and c.user_id = (select auth.uid())
      and c.access_role = 'EDITOR'
  )
);

create policy "drawer shared owner removes copy" on public.buklod_drawer_shared_items
for delete to authenticated using (owner_id = (select auth.uid()));

create policy "drawer grants visible to owner and recipient" on public.buklod_drawer_collaborators
for select to authenticated
using (owner_id = (select auth.uid()) or user_id = (select auth.uid()));

create policy "drawer owner grants only own item" on public.buklod_drawer_collaborators
for insert to authenticated with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.buklod_drawer_shared_items i
    where i.id = item_id and i.owner_id = (select auth.uid())
  )
);

create policy "drawer grant removable by owner or recipient" on public.buklod_drawer_collaborators
for delete to authenticated
using (owner_id = (select auth.uid()) or user_id = (select auth.uid()));

-- Editors may change content but never take ownership, repoint scope, or
-- rewrite revision history. The client updates with WHERE revision=<old>.
create or replace function public.buklod_drawer_shared_folder_guard()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and (
    new.owner_id is distinct from old.owner_id or
    (new.scope_id is distinct from old.scope_id and not (
      old.scope_id is not null and new.scope_id is null and pg_trigger_depth() > 1
    )) or
    new.id is distinct from old.id
  ) then
    raise exception 'Project folder ownership is immutable';
  end if;
  return new;
end;
$$;
create trigger buklod_drawer_shared_folder_guard_trg
before update on public.buklod_drawer_shared_folders
for each row execute function public.buklod_drawer_shared_folder_guard();

create or replace function public.buklod_drawer_shared_revision_guard()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
declare v_fk_cleanup boolean;
begin
  v_fk_cleanup := pg_trigger_depth() > 1 and (
    (new.folder_id is null and old.folder_id is not null)
    or (new.assigned_to is null and old.assigned_to is not null)
    or (new.scope_id is null and old.scope_id is not null)
  );
  if new.id is distinct from old.id
    or new.owner_id is distinct from old.owner_id
    or (new.scope_id is distinct from old.scope_id and not (
      v_fk_cleanup and new.scope_id is null
    ))
    or new.source_local_id is distinct from old.source_local_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Shared Drawer ownership and scope cannot be changed';
  end if;
  if new.revision <> old.revision + 1 then
    if v_fk_cleanup and new.revision = old.revision then
      new.revision := old.revision + 1;
    else
      raise exception 'Shared Drawer revision conflict';
    end if;
  end if;
  if new.folder_id is not null and not exists (
    select 1 from public.buklod_drawer_shared_folders f
    where f.id = new.folder_id and f.owner_id = new.owner_id
      and f.scope_id is not distinct from new.scope_id
  ) then
    raise exception 'Project folder must belong to the shared item owner and scope';
  end if;
  if (new.protected_from_expiry is distinct from old.protected_from_expiry
    or new.expires_at is distinct from old.expires_at)
    and auth.uid() is distinct from new.owner_id then
    raise exception 'Only the owner may change expiry protection';
  end if;
  if new.assigned_to is not null and new.assigned_to <> new.owner_id
    and not exists (
      select 1 from public.buklod_drawer_collaborators c
      where c.item_id = new.id and c.user_id = new.assigned_to
        and c.access_role = 'EDITOR'
    ) then
    raise exception 'Assign only to explicitly invited collaborators';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Validate initial INSERT as well as subsequent edits; anonymous clients
-- cannot point to someone else's folder or assign a stranger.
create or replace function public.buklod_drawer_shared_insert_guard()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
begin
  if new.folder_id is not null and not exists (
    select 1 from public.buklod_drawer_shared_folders f
    where f.id = new.folder_id and f.owner_id = new.owner_id
      and f.scope_id is not distinct from new.scope_id
  ) then
    raise exception 'Invalid shared project folder';
  end if;
  if new.assigned_to is not null and new.assigned_to <> new.owner_id then
    raise exception 'Assign collaborators only after they accept an item invitation';
  end if;
  return new;
end;
$$;
create trigger buklod_drawer_shared_insert_guard_trg
before insert on public.buklod_drawer_shared_items
for each row execute function public.buklod_drawer_shared_insert_guard();

create trigger buklod_drawer_shared_revision_guard_trg
before update on public.buklod_drawer_shared_items
for each row execute function public.buklod_drawer_shared_revision_guard();

-- Individual invite notifications are triggered once by the unique grant.
-- Cluster sharing is shown to members in Drawer; never fan out 1M pushes.
create schema if not exists buklod_private;
revoke all on schema buklod_private from public;
create or replace function buklod_private.buklod_drawer_invite_notify()
returns trigger language plpgsql security definer
set search_path = pg_catalog as $$
declare v_title text;
begin
  select i.title into v_title
    from public.buklod_drawer_shared_items i
    where i.id = new.item_id;
  insert into public.notifications(user_id,title,body,kind,data)
  values (
    new.user_id,
    'Shared Drawer invitation',
    left(coalesce(v_title, 'Shared item'), 120),
    'smart_drawer_shared',
    jsonb_build_object(
      'route', '/drawer/shared-item/' || new.item_id::text,
      'item_id', new.item_id,
      'source', 'smart-drawer-shared'
    )
  );
  return new;
end;
$$;
revoke all on function buklod_private.buklod_drawer_invite_notify() from public;
create trigger buklod_drawer_invite_notify_trg
after insert on public.buklod_drawer_collaborators
for each row execute function buklod_private.buklod_drawer_invite_notify();

-- Due/advance notifications are server-owned so invited collaborators can
-- receive them even if BUKLOD is closed. The unique claim is written in the
-- same transaction as the notification row; retries cannot double-send.
create table if not exists buklod_private.buklod_drawer_reminder_claims (
  item_id uuid not null references public.buklod_drawer_shared_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('ADVANCE','DUE')),
  due_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  primary key (item_id,user_id,stage,due_at)
);
revoke all on buklod_private.buklod_drawer_reminder_claims from public, anon, authenticated;

create or replace function buklod_private.queue_drawer_shared_reminders(
  p_batch integer default 500
) returns integer language plpgsql security definer
set search_path = pg_catalog as $$
declare v_count integer := 0;
begin
  with due_items as materialized (
    select i.id, i.owner_id, i.title, i.due_at,
      case when i.due_at <= now() then 'DUE'::text else 'ADVANCE'::text end as stage
    from public.buklod_drawer_shared_items i
    where i.status = 'ACTIVE'
      and i.due_at > now() - interval '24 hours'
      and i.due_at <= now() + interval '1 hour'
      and (
      not exists (
        select 1 from buklod_private.buklod_drawer_reminder_claims c
        where c.item_id = i.id and c.user_id = i.owner_id
          and c.due_at = i.due_at
          and c.stage = case when i.due_at <= now() then 'DUE' else 'ADVANCE' end
      )
      -- Also pick items where a collaborator was invited after the owner
      -- was notified; previous claims must not block their reminder.
      or exists (
        select 1 from public.buklod_drawer_collaborators c
        where c.item_id = i.id and not exists (
          select 1 from buklod_private.buklod_drawer_reminder_claims cl
          where cl.item_id=i.id and cl.user_id=c.user_id and cl.due_at=i.due_at
            and cl.stage=case when i.due_at <= now() then 'DUE' else 'ADVANCE' end
        )
      )
      )
    order by i.due_at asc, i.id
    limit greatest(1,least(p_batch,1000))
  ),
  recipients as (
    select d.id, d.owner_id as user_id, d.title, d.due_at, d.stage
      from due_items d
    union all
    select d.id, c.user_id, d.title, d.due_at, d.stage
      from due_items d
      join public.buklod_drawer_collaborators c on c.item_id = d.id
  ),
  claims as (
    insert into buklod_private.buklod_drawer_reminder_claims(
      item_id,user_id,stage,due_at
    )
    select r.id,r.user_id,r.stage,r.due_at from recipients r
    on conflict do nothing
    returning item_id,user_id,stage,due_at
  ),
  created as (
    insert into public.notifications(user_id,title,body,kind,data)
    select c.user_id,
      case when c.stage = 'DUE' then 'Shared Drawer due now' else 'Shared Drawer coming up' end,
      left(d.title,160),
      'smart_drawer_shared_reminder',
      jsonb_build_object(
        'route','/drawer/shared-item/' || c.item_id::text,
        'item_id',c.item_id,
        'source','smart-drawer-shared'
      )
    from claims c
    join due_items d on d.id = c.item_id
    returning id
  )
  select count(*) into v_count from created;
  return v_count;
end;
$$;
revoke all on function buklod_private.queue_drawer_shared_reminders(integer)
  from public, anon, authenticated;

-- Opt-in expiry of a shared copy first moves it into recoverable trash.
-- Significant work is protected by default. Expired unprotected copies
-- are physically purged only after 30 days, in bounded batches.
create or replace function buklod_private.cleanup_drawer_shared_expiry()
returns table(expired integer, purged integer) language plpgsql security definer
set search_path = pg_catalog as $$
declare v_expired integer := 0; v_purged integer := 0;
begin
  with due as (
    select id from public.buklod_drawer_shared_items
    where status = 'ACTIVE' and protected_from_expiry = false
      and expires_at is not null and expires_at <= now()
    order by expires_at, id limit 200 for update skip locked
  ), changed as (
    update public.buklod_drawer_shared_items i
    set status='RECENTLY_REMOVED', deleted_at=now(), revision=i.revision+1
    from due where i.id=due.id returning i.id
  ) select count(*) into v_expired from changed;

  with obsolete as (
    select id from public.buklod_drawer_shared_items
    where status='RECENTLY_REMOVED' and protected_from_expiry=false
      and deleted_at < now() - interval '30 days'
    order by deleted_at,id limit 100 for update skip locked
  ), erased as (
    delete from public.buklod_drawer_shared_items i
    using obsolete where i.id=obsolete.id returning i.id
  ) select count(*) into v_purged from erased;

  return query select v_expired,v_purged;
end;
$$;
revoke all on function buklod_private.cleanup_drawer_shared_expiry()
  from public, anon, authenticated;

-- Supabase pg_cron is already enabled on the canonical backend. In local
-- test databases without it, leave the function defined but skip the job.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'buklod-drawer-shared-reminders-r1',
      '* * * * *',
      'select buklod_private.queue_drawer_shared_reminders(500)'
    );
    perform cron.schedule(
      'buklod-drawer-shared-expiry-r1',
      '*/10 * * * *',
      'select * from buklod_private.cleanup_drawer_shared_expiry()'
    );
  end if;
end;
$$;
