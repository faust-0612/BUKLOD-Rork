-- BUKLOD Community Living Chains details R1
-- Normalizes Resource object reuse so duplicate bytes are stored once while
-- each Community post keeps its own title/description/topic/reference.

begin;

create table if not exists public.buklod_community_resource_refs (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  resource_id uuid not null references public.buklod_community_resources(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  topic text,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buklod_community_resource_refs_visibility_check check (
    visibility = any(array['public','circle','organization','private_link','private_poster']::text[])
  )
);

create index if not exists idx_buklod_community_resource_refs_resource
on public.buklod_community_resource_refs(resource_id,created_at desc);
create index if not exists idx_buklod_community_resource_refs_owner
on public.buklod_community_resource_refs(owner_id,created_at desc);

alter table public.buklod_community_resource_refs enable row level security;
revoke all on table public.buklod_community_resource_refs from public,anon,authenticated;

create or replace function public.find_buklod_community_resource_object_v1(
  p_sha256 text,
  p_visibility text default 'public'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_hash text := lower(trim(coalesce(p_sha256,'')));
  v_visibility text := lower(trim(coalesce(p_visibility,'public')));
  v_row public.buklod_community_resources%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if v_hash='' then return null; end if;

  if v_visibility='public' then
    select * into v_row
    from public.buklod_community_resources r
    where r.sha256=v_hash and r.visibility='public' and r.is_archived=false
    order by r.created_at asc limit 1;
  else
    select * into v_row
    from public.buklod_community_resources r
    where r.sha256=v_hash and r.owner_id=v_actor and r.visibility=v_visibility and r.is_archived=false
    order by r.created_at asc limit 1;
  end if;

  if not found then return null; end if;
  return jsonb_build_object(
    'resource_id',v_row.id,
    'storage_path',v_row.storage_path,
    'mime_type',v_row.mime_type,
    'size_bytes',v_row.size_bytes,
    'sha256',v_row.sha256
  );
end
$$;
revoke all on function public.find_buklod_community_resource_object_v1(text,text) from public,anon;
grant execute on function public.find_buklod_community_resource_object_v1(text,text) to authenticated;

create or replace function public.register_buklod_community_resource_v2(
  p_post_id uuid,
  p_title text,
  p_description text,
  p_topic text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256 text,
  p_storage_path text,
  p_visibility text default 'public'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_visibility text := lower(trim(coalesce(p_visibility,'public')));
  v_hash text := lower(trim(coalesce(p_sha256,'')));
  v_resource public.buklod_community_resources%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select p.user_id into v_owner from public.community_posts p
  where p.id=p_post_id and p.deleted_at is null;
  if v_owner is distinct from v_actor then raise exception 'Only the post author may attach a Resource'; end if;

  if v_visibility='public' then
    select * into v_resource
    from public.buklod_community_resources r
    where r.sha256=v_hash and r.visibility='public' and r.is_archived=false
    order by r.created_at asc limit 1;
  else
    select * into v_resource
    from public.buklod_community_resources r
    where r.sha256=v_hash and r.owner_id=v_actor and r.visibility=v_visibility and r.is_archived=false
    order by r.created_at asc limit 1;
  end if;

  if not found then
    if (storage.foldername(p_storage_path))[1] is distinct from v_actor::text then
      raise exception 'Invalid Resource storage path';
    end if;

    insert into public.buklod_community_resources(
      owner_id,post_id,title,description,topic,original_name,mime_type,size_bytes,sha256,storage_path,visibility
    ) values(
      v_actor,p_post_id,trim(p_title),nullif(trim(coalesce(p_description,'')),''),nullif(trim(coalesce(p_topic,'')),''),
      trim(p_original_name),lower(trim(p_mime_type)),p_size_bytes,v_hash,trim(p_storage_path),v_visibility
    ) returning * into v_resource;
  end if;

  insert into public.buklod_community_resource_refs(
    post_id,resource_id,owner_id,title,description,topic,visibility,updated_at
  ) values(
    p_post_id,v_resource.id,v_actor,trim(p_title),nullif(trim(coalesce(p_description,'')),''),
    nullif(trim(coalesce(p_topic,'')),''),v_visibility,now()
  ) on conflict(post_id) do update set
    resource_id=excluded.resource_id,
    title=excluded.title,
    description=excluded.description,
    topic=excluded.topic,
    visibility=excluded.visibility,
    updated_at=now();

  insert into public.buklod_community_post_meta(post_id,kind,privacy,title,topic,updated_at)
  values(p_post_id,'resource','public',trim(p_title),nullif(trim(coalesce(p_topic,'')),''),now())
  on conflict(post_id) do update set
    kind='resource',title=excluded.title,topic=excluded.topic,updated_at=now();

  return jsonb_build_object(
    'resource_id',v_resource.id,
    'post_id',p_post_id,
    'deduplicated',v_resource.post_id is distinct from p_post_id,
    'storage_path',v_resource.storage_path
  );
end
$$;
revoke all on function public.register_buklod_community_resource_v2(uuid,text,text,text,text,text,bigint,text,text,text) from public,anon;
grant execute on function public.register_buklod_community_resource_v2(uuid,text,text,text,text,text,bigint,text,text,text) to authenticated;

create or replace function public.get_buklod_community_resource_v1(p_post_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'resource_id',o.id,
    'post_id',r.post_id,
    'title',r.title,
    'description',r.description,
    'topic',r.topic,
    'visibility',r.visibility,
    'original_name',o.original_name,
    'mime_type',o.mime_type,
    'size_bytes',o.size_bytes,
    'storage_path',o.storage_path,
    'save_count',(select count(*) from public.buklod_community_resource_signals s where s.resource_id=o.id and s.signal='save'),
    'used_count',(select count(*) from public.buklod_community_resource_signals s where s.resource_id=o.id and s.signal='used'),
    'open_count',(select count(*) from public.buklod_community_resource_signals s where s.resource_id=o.id and s.signal='open'),
    'my_saved',exists(select 1 from public.buklod_community_resource_signals s where s.resource_id=o.id and s.user_id=(select auth.uid()) and s.signal='save'),
    'my_used',exists(select 1 from public.buklod_community_resource_signals s where s.resource_id=o.id and s.user_id=(select auth.uid()) and s.signal='used')
  )
  from public.buklod_community_resource_refs r
  join public.buklod_community_resources o on o.id=r.resource_id and o.is_archived=false
  where r.post_id=p_post_id
    and (
      r.visibility='public'
      or r.owner_id=(select auth.uid())
    )
$$;
revoke all on function public.get_buklod_community_resource_v1(uuid) from public,anon;
grant execute on function public.get_buklod_community_resource_v1(uuid) to authenticated;

create or replace function public.get_buklod_community_poll_v1(p_post_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'post_id',m.post_id,
    'options',m.poll_options,
    'counts',(
      select jsonb_agg(count_value order by option_index)
      from (
        select i as option_index,count(v.user_id)::integer as count_value
        from generate_series(0,jsonb_array_length(m.poll_options)-1) i
        left join public.buklod_community_poll_votes v
          on v.post_id=m.post_id and v.option_index=i
        group by i
      ) q
    ),
    'my_vote',(select v.option_index from public.buklod_community_poll_votes v where v.post_id=m.post_id and v.user_id=(select auth.uid()) limit 1)
  )
  from public.buklod_community_post_meta m
  where m.post_id=p_post_id and m.kind in ('poll','decision') and m.poll_options is not null
$$;
revoke all on function public.get_buklod_community_poll_v1(uuid) from public,anon;
grant execute on function public.get_buklod_community_poll_v1(uuid) to authenticated;

create or replace function public.get_buklod_community_challenge_v1(p_post_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'post_id',m.post_id,
    'config',coalesce(m.challenge_config,'{}'::jsonb),
    'joined_count',(select count(*) from public.buklod_community_challenge_members c where c.post_id=m.post_id and c.status in ('joined','completed')),
    'completed_count',(select count(*) from public.buklod_community_challenge_members c where c.post_id=m.post_id and c.status='completed'),
    'my_status',(select c.status from public.buklod_community_challenge_members c where c.post_id=m.post_id and c.user_id=(select auth.uid()) limit 1)
  )
  from public.buklod_community_post_meta m
  where m.post_id=p_post_id and m.kind='challenge'
$$;
revoke all on function public.get_buklod_community_challenge_v1(uuid) from public,anon;
grant execute on function public.get_buklod_community_challenge_v1(uuid) to authenticated;

commit;
