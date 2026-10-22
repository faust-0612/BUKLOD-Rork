-- A public Community Wall post also appears on every active Cluster and
-- Organization wall of the member who posted it. One post row is shared, so
-- comments, reactions, and points stay on that post.

create table if not exists public.buklod_community_public_scope_sync (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  scope_id uuid not null references public.buklod_scopes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, scope_id)
);

create index if not exists buklod_community_public_scope_sync_scope_idx
  on public.buklod_community_public_scope_sync (scope_id, post_id);

alter table public.buklod_community_public_scope_sync enable row level security;

revoke all on table public.buklod_community_public_scope_sync from public, anon, authenticated;

create or replace function public.buklod_sync_public_post_scopes_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null
     or coalesce(new.author_only, false)
     or coalesce(new.is_hidden, false)
     or new.deleted_at is not null
     or lower(coalesce(new.audience, '')) <> 'public'
  then
    delete from public.buklod_community_public_scope_sync
    where post_id = new.id;
    return new;
  end if;

  insert into public.buklod_community_public_scope_sync (post_id, scope_id)
  select new.id, m.scope_id
  from public.buklod_scope_memberships m
  join public.buklod_scopes s
    on s.id = m.scope_id
  where m.user_id = new.user_id
    and upper(coalesce(m.membership_status, '')) = 'ACTIVE'
    and upper(coalesce(s.scope_type, '')) in ('CLUSTER', 'ORGANIZATION')
    and upper(coalesce(s.status, 'ACTIVE')) = 'ACTIVE'
  on conflict (post_id, scope_id) do nothing;

  return new;
end;
$$;

drop trigger if exists buklod_sync_public_post_scopes_v1
  on public.community_posts;

create trigger buklod_sync_public_post_scopes_v1
  after insert or update of audience, user_id, author_only, is_hidden, deleted_at
  on public.community_posts
  for each row
  execute function public.buklod_sync_public_post_scopes_v1();

insert into public.buklod_community_public_scope_sync (post_id, scope_id)
select p.id, m.scope_id
from public.community_posts p
join public.buklod_scope_memberships m
  on m.user_id = p.user_id
join public.buklod_scopes s
  on s.id = m.scope_id
where lower(coalesce(p.audience, '')) = 'public'
  and p.user_id is not null
  and coalesce(p.author_only, false) = false
  and coalesce(p.is_hidden, false) = false
  and p.deleted_at is null
  and upper(coalesce(m.membership_status, '')) = 'ACTIVE'
  and upper(coalesce(s.scope_type, '')) in ('CLUSTER', 'ORGANIZATION')
  and upper(coalesce(s.status, 'ACTIVE')) = 'ACTIVE'
on conflict (post_id, scope_id) do nothing;

create or replace function public.buklod_scope_wall_has_post_v1(
  p_scope_id uuid,
  p_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_posts p
    where p.id = p_post_id
      and coalesce(p.is_hidden, false) = false
      and p.deleted_at is null
      and (
        (
          p.scope_id = p_scope_id
          and p.audience = 'scope'
        )
        or exists (
          select 1
          from public.buklod_community_public_scope_sync s
          where s.post_id = p.id
            and s.scope_id = p_scope_id
        )
      )
  );
$$;

revoke all on function public.buklod_scope_wall_has_post_v1(uuid, uuid) from public, anon;

create or replace function public.buklod_scope_social_feed_v1(
  p_scope_id uuid,
  p_limit integer default 80
)
returns table(
  id uuid,
  scope_id uuid,
  user_id uuid,
  category text,
  body text,
  created_at timestamp with time zone,
  author_name text,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint,
  media_duration_seconds numeric,
  is_reel boolean,
  reaction_counts jsonb,
  my_reaction text,
  comment_count bigint,
  is_owner boolean,
  can_manage boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_limit integer := greatest(1, least(coalesce(p_limit, 80), 200));
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if not public.buklod_scope_social_can_access(p_scope_id) then
    raise exception 'This Community is exclusive to active members of this exact scope';
  end if;

  return query
  select
    p.id,
    p_scope_id,
    p.user_id,
    p.category,
    p.body,
    p.created_at,
    coalesce(profile.full_name, 'BUKLOD Member')::text,
    p.media_path,
    p.media_mime_type,
    p.media_size_bytes,
    p.media_duration_seconds,
    p.is_reel,
    coalesce(
      (
        select jsonb_object_agg(r.reaction, cnt)
        from (
          select r.reaction, count(*)::bigint as cnt
          from public.reactions r
          where r.post_id = p.id
          group by r.reaction
        ) r
      ),
      '{}'::jsonb
    ),
    (
      select r.reaction
      from public.reactions r
      where r.post_id = p.id
        and r.user_id = v_user
      limit 1
    ),
    (
      select count(*)::bigint
      from public.comments c
      where c.post_id = p.id
        and c.is_hidden = false
    ),
    p.user_id = v_user,
    public.buklod_scope_social_can_manage(p_scope_id)
  from public.community_posts p
  left join public.profiles profile
    on profile.id = p.user_id
  where coalesce(p.is_hidden, false) = false
    and p.deleted_at is null
    and (
      (p.scope_id = p_scope_id and p.audience = 'scope')
      or exists (
        select 1
        from public.buklod_community_public_scope_sync s
        where s.post_id = p.id
          and s.scope_id = p_scope_id
      )
    )
  order by p.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.buklod_scope_social_feed_v1(uuid, integer) from public, anon;
grant execute on function public.buklod_scope_social_feed_v1(uuid, integer) to authenticated, service_role;

create or replace function public.buklod_scope_social_add_comment_v1(
  p_scope_id uuid,
  p_post_id uuid,
  p_body text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if v_body is null then
    raise exception 'Comment cannot be empty';
  end if;

  if not public.buklod_scope_social_can_access(p_scope_id) then
    raise exception 'Community membership required';
  end if;

  if not public.buklod_scope_wall_has_post_v1(p_scope_id, p_post_id) then
    raise exception 'Post not found in this exact Community';
  end if;

  if p_parent_id is not null and not exists (
    select 1
    from public.comments c
    where c.id = p_parent_id
      and c.post_id = p_post_id
      and c.is_hidden = false
  ) then
    raise exception 'Reply target does not belong to this post';
  end if;

  insert into public.comments (post_id, user_id, body, parent_id, is_hidden, created_at)
  values (p_post_id, v_user, v_body, p_parent_id, false, now())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.buklod_scope_social_comments_v1(
  p_scope_id uuid,
  p_post_id uuid
)
returns table(
  id uuid,
  post_id uuid,
  user_id uuid,
  body text,
  parent_id uuid,
  created_at timestamp with time zone,
  commenter_name text,
  is_owner boolean,
  can_manage boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if not public.buklod_scope_social_can_access(p_scope_id) then
    raise exception 'Community membership required';
  end if;

  if not public.buklod_scope_wall_has_post_v1(p_scope_id, p_post_id) then
    raise exception 'Post not found in this exact Community';
  end if;

  return query
  select
    c.id,
    c.post_id,
    c.user_id,
    c.body,
    c.parent_id,
    c.created_at,
    coalesce(profile.full_name, 'BUKLOD Member')::text,
    (c.user_id = v_user),
    public.buklod_scope_social_can_manage(p_scope_id)
  from public.comments c
  left join public.profiles profile
    on profile.id = c.user_id
  where c.post_id = p_post_id
    and c.is_hidden = false
  order by c.created_at asc;
end;
$$;

create or replace function public.buklod_scope_social_set_reaction_v1(
  p_scope_id uuid,
  p_post_id uuid,
  p_reaction text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_reaction text := lower(btrim(coalesce(p_reaction, '')));
  v_existing text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if v_reaction not in ('love', 'amen', 'haha', 'praying', 'with_you', 'sad', 'care') then
    raise exception 'Unsupported reaction';
  end if;

  if not public.buklod_scope_social_can_access(p_scope_id) then
    raise exception 'Community membership required';
  end if;

  if not public.buklod_scope_wall_has_post_v1(p_scope_id, p_post_id) then
    raise exception 'Post not found in this exact Community';
  end if;

  select r.reaction
  into v_existing
  from public.reactions r
  where r.post_id = p_post_id
    and r.user_id = v_user
  order by r.created_at desc
  limit 1;

  delete from public.reactions
  where post_id = p_post_id
    and user_id = v_user;

  if v_existing = v_reaction then
    return null;
  end if;

  insert into public.reactions (post_id, user_id, reaction, created_at)
  values (p_post_id, v_user, v_reaction, now());

  return v_reaction;
end;
$$;

create or replace function public.buklod_scope_social_delete_post_v1(
  p_scope_id uuid,
  p_post_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_owner uuid;
  v_audience text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select p.user_id, p.audience
  into v_owner, v_audience
  from public.community_posts p
  where p.id = p_post_id
    and public.buklod_scope_wall_has_post_v1(p_scope_id, p.id);

  if v_owner is null and v_audience is null then
    raise exception 'Post not found';
  end if;

  if v_owner is distinct from v_user
     and not public.buklod_scope_social_can_manage(p_scope_id)
  then
    raise exception 'Only the author or a Community admin can remove this post';
  end if;

  if v_audience = 'scope' or v_owner = v_user then
    update public.community_posts
    set is_hidden = true
    where id = p_post_id;
  else
    delete from public.buklod_community_public_scope_sync
    where post_id = p_post_id
      and scope_id = p_scope_id;
  end if;
end;
$$;
