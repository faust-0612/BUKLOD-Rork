-- BUKLOD Community Living Wall R1 hardening
-- Manual/static QA patch: scope-safe RPC access, rule-driven bounded Points,
-- and deduplicated Resource lifecycle protection.

begin;

-- A public Resource object may be reused by multiple Community posts. Do not
-- delete the shared object just because the profile that first uploaded it is
-- later removed; references owned by other users must remain valid.
alter table public.buklod_community_resources
  drop constraint if exists buklod_community_resources_owner_id_fkey;
alter table public.buklod_community_resources
  alter column owner_id drop not null;
alter table public.buklod_community_resources
  add constraint buklod_community_resources_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete set null;

-- Living Wall R1 is a PUBLIC Community feature. Owners may always inspect
-- their own root post; other authenticated users may access only a live,
-- non-author-only public root whose Living metadata is public.
create or replace function public.buklod_community_can_access_root_v1(
  p_post_id uuid,
  p_actor uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.community_posts p
    left join public.buklod_community_post_meta m on m.post_id=p.id
    where p.id=p_post_id
      and p.deleted_at is null
      and (
        p.user_id=p_actor
        or (
          coalesce(p.author_only,false)=false
          and coalesce(p.audience,'public')='public'
          and coalesce(m.privacy,'public')='public'
        )
      )
  )
$$;
revoke all on function public.buklod_community_can_access_root_v1(uuid,uuid) from public,anon,authenticated;

-- Respect the canonical Points rule row instead of a hard-coded Community cap.
create or replace function public.buklod_community_award_small_v1(
  p_user_id uuid,p_activity_type text,p_source_key text,p_points integer,p_description text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_ledger_id uuid;
  v_max_event integer;
  v_daily_cap integer;
  v_weekly_cap integer;
  v_today integer := 0;
  v_week integer := 0;
  v_award integer;
begin
  if p_user_id is null or p_points < 1 or p_points > 2 then return null; end if;

  select r.max_points_per_event,r.daily_cap_points,r.weekly_cap_points
    into v_max_event,v_daily_cap,v_weekly_cap
  from public.buklod_point_rules r
  where r.activity_type=p_activity_type
    and coalesce(r.is_active,false)=true
  limit 1;

  if not found
     or coalesce(v_max_event,0)<1
     or coalesce(v_daily_cap,0)<1
     or coalesce(v_weekly_cap,0)<1 then
    return null;
  end if;

  if exists(
    select 1 from public.buklod_points_ledger l
    where l.user_id=p_user_id and l.source_key=p_source_key
  ) then
    return null;
  end if;

  select coalesce(sum(l.points),0)::integer into v_today
  from public.buklod_points_ledger l
  where l.user_id=p_user_id
    and l.direction='credit'
    and l.activity_type=p_activity_type
    and l.created_at>=date_trunc('day',now());

  select coalesce(sum(l.points),0)::integer into v_week
  from public.buklod_points_ledger l
  where l.user_id=p_user_id
    and l.direction='credit'
    and l.activity_type=p_activity_type
    and l.created_at>=date_trunc('week',now());

  v_award := least(
    p_points,
    v_max_event,
    greatest(v_daily_cap-v_today,0),
    greatest(v_weekly_cap-v_week,0)
  );
  if v_award<1 then return null; end if;

  insert into public.buklod_points_ledger(
    user_id,direction,points,activity_type,source_key,source_id,description,awarded_by
  ) values(
    p_user_id,'credit',v_award,p_activity_type,p_source_key,null,p_description,p_user_id
  )
  on conflict(user_id,source_key) do nothing
  returning id into v_ledger_id;

  return v_ledger_id;
end
$$;
revoke all on function public.buklod_community_award_small_v1(uuid,text,text,integer,text) from public,anon,authenticated;

create or replace function public.create_buklod_dugtong_v1(
  p_post_id uuid,
  p_parent_id uuid default null,
  p_body text default '',
  p_type text default 'continuation',
  p_privacy text default 'public',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_body text := trim(coalesce(p_body,''));
  v_parent public.buklod_community_dugtongs%rowtype;
  v_depth smallint := 1;
  v_id uuid := gen_random_uuid();
  v_branch uuid;
  v_count integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_community_can_access_root_v1(p_post_id,v_actor) then
    raise exception 'Post is not available for Dugtong';
  end if;
  if char_length(v_body)<1 or char_length(v_body)>4000 then raise exception 'Dugtong must be 1 to 4000 characters'; end if;
  if (length(lower(v_body))-length(replace(lower(v_body),'http','')))/4 > 5 then raise exception 'Too many links in one Dugtong'; end if;

  if p_parent_id is not null then
    select * into v_parent from public.buklod_community_dugtongs d
    where d.id=p_parent_id and d.root_post_id=p_post_id and d.deleted_at is null;
    if not found then raise exception 'Parent Dugtong was not found in this chain'; end if;
    v_depth := (v_parent.depth+1)::smallint;
    if v_depth>24 then raise exception 'This branch is already deep. Start from the original post.'; end if;
    v_branch := coalesce(v_parent.branch_id,v_parent.id);
  else
    v_branch := v_id;
  end if;

  if nullif(trim(coalesce(p_media_path,'')),'') is not null and
     (storage.foldername(p_media_path))[1] is distinct from v_actor::text then
    raise exception 'Invalid Dugtong media path';
  end if;

  insert into public.buklod_community_dugtongs(
    id,root_post_id,parent_id,branch_id,user_id,body,dugtong_type,privacy,depth,
    media_path,media_mime_type,media_size_bytes
  ) values(
    v_id,p_post_id,p_parent_id,v_branch,v_actor,v_body,
    lower(trim(coalesce(p_type,'continuation'))),lower(trim(coalesce(p_privacy,'public'))),v_depth,
    nullif(trim(coalesce(p_media_path,'')),''),nullif(lower(trim(coalesce(p_media_mime_type,''))),''),p_media_size_bytes
  );

  select count(*)::integer into v_count from public.buklod_community_dugtongs d
  where d.root_post_id=p_post_id and d.user_id=v_actor and d.deleted_at is null;
  if v_count=1 then
    perform public.buklod_community_award_small_v1(
      v_actor,'community_dugtong','community_dugtong:'||p_post_id::text,1,
      'Meaningful Dugtong added to a Community chain'
    );
  end if;

  insert into public.buklod_community_post_meta(post_id,kind,chain_status,updated_at)
  values(p_post_id,'open_discussion','growing',now())
  on conflict(post_id) do update set
    chain_status=case when public.buklod_community_post_meta.chain_status='resolved' then 'resolved' else 'growing' end,
    updated_at=now();

  return jsonb_build_object('id',v_id,'root_post_id',p_post_id,'parent_id',p_parent_id,'depth',v_depth,'branch_id',v_branch);
end
$$;
revoke all on function public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint) from public,anon;
grant execute on function public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint) to authenticated;

create or replace function public.get_buklod_dugtong_chain_v1(p_post_id uuid)
returns table(
  id uuid,parent_id uuid,branch_id uuid,depth smallint,body text,dugtong_type text,privacy text,
  user_id uuid,display_name text,media_path text,media_mime_type text,media_size_bytes bigint,
  is_helpful boolean,created_at timestamptz
)
language sql
security definer
set search_path=''
as $$
  select
    d.id,d.parent_id,d.branch_id,d.depth,d.body,d.dugtong_type,d.privacy,
    case when d.privacy='anonymous' and d.user_id<>(select auth.uid()) then null else d.user_id end,
    case
      when d.privacy='anonymous' and d.user_id<>(select auth.uid()) then 'Anonymous BUKLOD Member'
      else coalesce(nullif(trim(p.full_name),''),'BUKLOD Member')
    end,
    d.media_path,d.media_mime_type,d.media_size_bytes,d.is_helpful,d.created_at
  from public.buklod_community_dugtongs d
  join public.community_posts root on root.id=d.root_post_id
  left join public.profiles p on p.id=d.user_id
  where d.root_post_id=p_post_id
    and public.buklod_community_can_access_root_v1(p_post_id,(select auth.uid()))
    and d.deleted_at is null
    and d.moderation_state='approved'
    and (
      d.privacy in ('public','anonymous')
      or d.user_id=(select auth.uid())
      or root.user_id=(select auth.uid())
    )
  order by d.created_at asc
$$;
revoke all on function public.get_buklod_dugtong_chain_v1(uuid) from public,anon;
grant execute on function public.get_buklod_dugtong_chain_v1(uuid) to authenticated;

create or replace function public.get_buklod_dugtong_summary_v1(p_post_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'post_id',p.id,
    'kind',coalesce(m.kind,case when coalesce(p.media_mime_type,'') like 'image/%' then 'moment' else 'open_discussion' end),
    'status',coalesce(m.chain_status,'open'),
    'quiet_mode',coalesce(m.quiet_mode,false),
    'is_owner',p.user_id=(select auth.uid()),
    'public_count',coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.privacy in ('public','anonymous')),0),
    'private_count',case when p.user_id=(select auth.uid()) then coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.privacy='private_poster'),0) else 0 end,
    'branch_count',coalesce((select count(distinct d.branch_id) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null),0)
  )
  from public.community_posts p
  left join public.buklod_community_post_meta m on m.post_id=p.id
  where p.id=p_post_id
    and p.deleted_at is null
    and public.buklod_community_can_access_root_v1(p_post_id,(select auth.uid()))
$$;
revoke all on function public.get_buklod_dugtong_summary_v1(uuid) from public,anon;
grant execute on function public.get_buklod_dugtong_summary_v1(uuid) to authenticated;

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
        left join public.buklod_community_poll_votes v on v.post_id=m.post_id and v.option_index=i
        group by i
      ) q
    ),
    'my_vote',(select v.option_index from public.buklod_community_poll_votes v where v.post_id=m.post_id and v.user_id=(select auth.uid()) limit 1)
  )
  from public.buklod_community_post_meta m
  where m.post_id=p_post_id
    and m.kind in ('poll','decision')
    and m.poll_options is not null
    and public.buklod_community_can_access_root_v1(p_post_id,(select auth.uid()))
$$;
revoke all on function public.get_buklod_community_poll_v1(uuid) from public,anon;
grant execute on function public.get_buklod_community_poll_v1(uuid) to authenticated;

create or replace function public.vote_buklod_community_poll_v1(
  p_post_id uuid,p_option_index smallint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_options jsonb;
  v_first boolean := false;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_community_can_access_root_v1(p_post_id,v_actor) then raise exception 'Poll not found'; end if;
  select m.poll_options into v_options from public.buklod_community_post_meta m
  where m.post_id=p_post_id and m.kind in ('poll','decision');
  if v_options is null then raise exception 'Poll not found'; end if;
  if p_option_index<0 or p_option_index>=jsonb_array_length(v_options) then raise exception 'Invalid poll option'; end if;

  v_first := not exists(select 1 from public.buklod_community_poll_votes v where v.post_id=p_post_id and v.user_id=v_actor);
  insert into public.buklod_community_poll_votes(post_id,user_id,option_index)
  values(p_post_id,v_actor,p_option_index)
  on conflict(post_id,user_id) do update set option_index=excluded.option_index,updated_at=now();

  if v_first then
    perform public.buklod_community_award_small_v1(v_actor,'community_poll_vote','community_poll_vote:'||p_post_id::text,1,'Participated in a Community poll');
  end if;

  return jsonb_build_object(
    'option_index',p_option_index,
    'counts',(select jsonb_agg(cnt order by idx) from (
      select i as idx,count(v.user_id)::integer as cnt
      from generate_series(0,jsonb_array_length(v_options)-1) i
      left join public.buklod_community_poll_votes v on v.post_id=p_post_id and v.option_index=i
      group by i
    ) q)
  );
end
$$;
revoke all on function public.vote_buklod_community_poll_v1(uuid,smallint) from public,anon;
grant execute on function public.vote_buklod_community_poll_v1(uuid,smallint) to authenticated;

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
  where m.post_id=p_post_id
    and m.kind='challenge'
    and public.buklod_community_can_access_root_v1(p_post_id,(select auth.uid()))
$$;
revoke all on function public.get_buklod_community_challenge_v1(uuid) from public,anon;
grant execute on function public.get_buklod_community_challenge_v1(uuid) to authenticated;

create or replace function public.set_buklod_community_challenge_status_v1(
  p_post_id uuid,p_status text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_status text := lower(trim(coalesce(p_status,'')));
  v_previous text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_community_can_access_root_v1(p_post_id,v_actor) then raise exception 'Challenge not found'; end if;
  if v_status<>all(array['joined','completed','left']::text[]) then raise exception 'Unsupported challenge status'; end if;
  if not exists(select 1 from public.buklod_community_post_meta m where m.post_id=p_post_id and m.kind='challenge') then raise exception 'Challenge not found'; end if;

  select status into v_previous from public.buklod_community_challenge_members where post_id=p_post_id and user_id=v_actor;
  insert into public.buklod_community_challenge_members(post_id,user_id,status,completed_at,updated_at)
  values(p_post_id,v_actor,v_status,case when v_status='completed' then now() else null end,now())
  on conflict(post_id,user_id) do update set
    status=excluded.status,
    completed_at=case when excluded.status='completed' then coalesce(public.buklod_community_challenge_members.completed_at,now()) else public.buklod_community_challenge_members.completed_at end,
    updated_at=now();

  if v_status='completed' and coalesce(v_previous,'')<>'completed' then
    perform public.buklod_community_award_small_v1(v_actor,'community_challenge_complete','community_challenge_complete:'||p_post_id::text,2,'Completed a BUKLOD Community challenge');
  end if;
  return jsonb_build_object('status',v_status);
end
$$;
revoke all on function public.set_buklod_community_challenge_status_v1(uuid,text) from public,anon;
grant execute on function public.set_buklod_community_challenge_status_v1(uuid,text) to authenticated;

create or replace function public.get_buklod_community_resource_v1(p_post_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'resource_id',o.id,'post_id',r.post_id,'title',r.title,'description',r.description,'topic',r.topic,
    'visibility',r.visibility,'original_name',o.original_name,'mime_type',o.mime_type,'size_bytes',o.size_bytes,
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
    and (r.visibility='public' or r.owner_id=(select auth.uid()))
    and public.buklod_community_can_access_root_v1(p_post_id,(select auth.uid()))
$$;
revoke all on function public.get_buklod_community_resource_v1(uuid) from public,anon;
grant execute on function public.get_buklod_community_resource_v1(uuid) to authenticated;

create or replace function public.signal_buklod_community_resource_v1(
  p_resource_id uuid,p_signal text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_signal text := lower(trim(coalesce(p_signal,'')));
  v_rows integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if v_signal<>all(array['save','open','used','reference','return']::text[]) then raise exception 'Unsupported Resource signal'; end if;
  if not exists(
    select 1
    from public.buklod_community_resource_refs r
    where r.resource_id=p_resource_id
      and (r.visibility='public' or r.owner_id=v_actor)
      and public.buklod_community_can_access_root_v1(r.post_id,v_actor)
  ) then
    raise exception 'Resource is not available';
  end if;

  insert into public.buklod_community_resource_signals(resource_id,user_id,signal)
  values(p_resource_id,v_actor,v_signal)
  on conflict do nothing;
  get diagnostics v_rows = row_count;

  if v_rows>0 and v_signal='used' then
    perform public.buklod_community_award_small_v1(v_actor,'community_resource_used','community_resource_used:'||p_resource_id::text,1,'Marked a Community Resource as used');
  end if;
  return jsonb_build_object('recorded',v_rows>0,'signal',v_signal);
end
$$;
revoke all on function public.signal_buklod_community_resource_v1(uuid,text) from public,anon;
grant execute on function public.signal_buklod_community_resource_v1(uuid,text) to authenticated;

commit;
