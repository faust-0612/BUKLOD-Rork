-- BUKLOD Community Living Chains R1
-- Signature DUGTONG graph, typed wall posts, privacy, resources, polls,
-- challenges, discovery and bounded rewards using the existing BUKLOD Points ledger.
-- Existing comments/replies/reactions remain unchanged.

begin;

insert into public.buklod_point_rules (
  activity_type,label,base_points,max_points_per_event,daily_cap_points,weekly_cap_points,
  is_active,notes,updated_by,updated_at
)
values
  ('community_dugtong','Community Dugtong',1,1,8,40,true,
   'First meaningful Dugtong by a user on a root post. Existing BUKLOD Points only; never cash.',null,now()),
  ('community_resource_used','Community Resource Used',1,1,5,25,true,
   'First Used-this signal per Resource. Existing BUKLOD Points only; never cash.',null,now()),
  ('community_poll_vote','Community Poll Vote',1,1,5,25,true,
   'First vote per Community poll. Existing BUKLOD Points only; never cash.',null,now()),
  ('community_challenge_complete','Community Challenge Complete',2,2,6,30,true,
   'First completion per Community challenge. Existing BUKLOD Points only; never cash.',null,now())
on conflict (activity_type) do nothing;

create table if not exists public.buklod_community_post_meta (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  kind text not null default 'open_discussion',
  privacy text not null default 'public',
  chain_status text not null default 'open',
  quiet_mode boolean not null default false,
  title text,
  topic text,
  poll_options jsonb,
  challenge_config jsonb,
  context_config jsonb not null default '{}'::jsonb,
  resolved_dugtong_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buklod_community_post_meta_kind_check check (kind = any(array[
    'question','need_advice','challenge','poll','idea','encouragement','help_needed',
    'share_a_win','decision','resource','story','open_discussion','moment'
  ]::text[])),
  constraint buklod_community_post_meta_privacy_check check (privacy = any(array['public','anonymous']::text[])),
  constraint buklod_community_post_meta_status_check check (chain_status = any(array['open','growing','resolved']::text[])),
  constraint buklod_community_post_meta_poll_options_check check (poll_options is null or jsonb_typeof(poll_options)='array')
);

create index if not exists idx_buklod_community_post_meta_kind_status
on public.buklod_community_post_meta(kind,chain_status,updated_at desc);

create table if not exists public.buklod_community_dugtongs (
  id uuid primary key default gen_random_uuid(),
  root_post_id uuid not null references public.community_posts(id) on delete cascade,
  parent_id uuid references public.buklod_community_dugtongs(id) on delete cascade,
  branch_id uuid,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  dugtong_type text not null default 'continuation',
  privacy text not null default 'public',
  depth smallint not null default 1,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint,
  is_helpful boolean not null default false,
  moderation_state text not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint buklod_community_dugtongs_type_check check (dugtong_type = any(array[
    'advice','experience','alternative','encouragement','question_back','resource',
    'challenge_response','moment','continuation'
  ]::text[])),
  constraint buklod_community_dugtongs_privacy_check check (privacy = any(array['public','anonymous','private_poster']::text[])),
  constraint buklod_community_dugtongs_depth_check check (depth between 1 and 24),
  constraint buklod_community_dugtongs_body_check check (char_length(trim(body)) between 1 and 4000),
  constraint buklod_community_dugtongs_media_mime_check check (
    media_mime_type is null or media_mime_type = any(array['image/jpeg','image/png','image/webp']::text[])
  ),
  constraint buklod_community_dugtongs_media_size_check check (
    media_size_bytes is null or (media_size_bytes between 1 and 5242880)
  )
);

create index if not exists idx_buklod_community_dugtongs_root_created
on public.buklod_community_dugtongs(root_post_id,created_at asc) where deleted_at is null;
create index if not exists idx_buklod_community_dugtongs_parent
on public.buklod_community_dugtongs(parent_id,created_at asc) where deleted_at is null;

create table if not exists public.buklod_community_resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.community_posts(id) on delete set null,
  title text not null,
  description text,
  topic text,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  storage_path text not null,
  visibility text not null default 'public',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buklod_community_resources_size_check check (size_bytes between 1 and 20971520),
  constraint buklod_community_resources_mime_check check (mime_type = any(array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv','image/jpeg','image/png','image/webp'
  ]::text[])),
  constraint buklod_community_resources_visibility_check check (visibility = any(array[
    'public','circle','organization','private_link','private_poster'
  ]::text[]))
);

create unique index if not exists uq_buklod_community_resource_public_hash
on public.buklod_community_resources(sha256)
where visibility='public' and is_archived=false;
create unique index if not exists uq_buklod_community_resource_private_owner_hash
on public.buklod_community_resources(owner_id,sha256,visibility)
where visibility<>'public' and is_archived=false;
create index if not exists idx_buklod_community_resources_topic
on public.buklod_community_resources(topic,created_at desc) where is_archived=false;

create table if not exists public.buklod_community_resource_signals (
  resource_id uuid not null references public.buklod_community_resources(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  signal text not null,
  created_at timestamptz not null default now(),
  primary key(resource_id,user_id,signal),
  constraint buklod_community_resource_signal_check check (signal = any(array['save','open','used','reference','return']::text[]))
);

create table if not exists public.buklod_community_poll_votes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_index smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(post_id,user_id),
  constraint buklod_community_poll_vote_option_check check(option_index between 0 and 19)
);

create table if not exists public.buklod_community_challenge_members (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'joined',
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(post_id,user_id),
  constraint buklod_community_challenge_member_status_check check(status = any(array['joined','completed','left']::text[]))
);

alter table public.buklod_community_post_meta enable row level security;
alter table public.buklod_community_dugtongs enable row level security;
alter table public.buklod_community_resources enable row level security;
alter table public.buklod_community_resource_signals enable row level security;
alter table public.buklod_community_poll_votes enable row level security;
alter table public.buklod_community_challenge_members enable row level security;

revoke all on table public.buklod_community_post_meta from public,anon,authenticated;
revoke all on table public.buklod_community_dugtongs from public,anon,authenticated;
revoke all on table public.buklod_community_resources from public,anon,authenticated;
revoke all on table public.buklod_community_resource_signals from public,anon,authenticated;
revoke all on table public.buklod_community_poll_votes from public,anon,authenticated;
revoke all on table public.buklod_community_challenge_members from public,anon,authenticated;

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
  v_today integer := 0;
begin
  if p_points < 1 or p_points > 2 then return null; end if;

  select coalesce(sum(l.points),0)::integer into v_today
  from public.buklod_points_ledger l
  where l.user_id=p_user_id
    and l.direction='credit'
    and l.activity_type=p_activity_type
    and l.created_at>=date_trunc('day',now());

  if v_today>=8 then return null; end if;

  insert into public.buklod_points_ledger(
    user_id,direction,points,activity_type,source_key,source_id,description,awarded_by
  ) values(
    p_user_id,'credit',p_points,p_activity_type,p_source_key,null,p_description,p_user_id
  )
  on conflict(user_id,source_key) do nothing
  returning id into v_ledger_id;

  return v_ledger_id;
end
$$;
revoke all on function public.buklod_community_award_small_v1(uuid,text,text,integer,text) from public,anon,authenticated;

create or replace function public.set_buklod_community_post_meta_v1(
  p_post_id uuid,
  p_kind text,
  p_privacy text default 'public',
  p_title text default null,
  p_topic text default null,
  p_quiet_mode boolean default false,
  p_poll_options jsonb default null,
  p_challenge_config jsonb default null,
  p_context_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_kind text := lower(trim(coalesce(p_kind,'open_discussion')));
  v_privacy text := lower(trim(coalesce(p_privacy,'public')));
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select p.user_id into v_owner from public.community_posts p
  where p.id=p_post_id and p.deleted_at is null;
  if v_owner is null then raise exception 'Post not found'; end if;
  if v_owner<>v_actor then raise exception 'Only the post author may set Living Wall details'; end if;

  insert into public.buklod_community_post_meta(
    post_id,kind,privacy,title,topic,quiet_mode,poll_options,challenge_config,context_config,updated_at
  ) values(
    p_post_id,v_kind,v_privacy,nullif(trim(coalesce(p_title,'')),''),nullif(trim(coalesce(p_topic,'')),''),
    coalesce(p_quiet_mode,false),p_poll_options,p_challenge_config,coalesce(p_context_config,'{}'::jsonb),now()
  )
  on conflict(post_id) do update set
    kind=excluded.kind,privacy=excluded.privacy,title=excluded.title,topic=excluded.topic,
    quiet_mode=excluded.quiet_mode,poll_options=excluded.poll_options,
    challenge_config=excluded.challenge_config,context_config=excluded.context_config,updated_at=now();

  return jsonb_build_object('post_id',p_post_id,'kind',v_kind,'privacy',v_privacy);
end
$$;
revoke all on function public.set_buklod_community_post_meta_v1(uuid,text,text,text,text,boolean,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.set_buklod_community_post_meta_v1(uuid,text,text,text,text,boolean,jsonb,jsonb,jsonb) to authenticated;

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
  v_owner uuid;
  v_body text := trim(coalesce(p_body,''));
  v_parent public.buklod_community_dugtongs%rowtype;
  v_depth smallint := 1;
  v_id uuid := gen_random_uuid();
  v_branch uuid;
  v_count integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if char_length(v_body)<1 or char_length(v_body)>4000 then raise exception 'Dugtong must be 1 to 4000 characters'; end if;
  if (length(lower(v_body))-length(replace(lower(v_body),'http','')))/4 > 5 then raise exception 'Too many links in one Dugtong'; end if;

  select p.user_id into v_owner from public.community_posts p
  where p.id=p_post_id and p.deleted_at is null and coalesce(p.author_only,false)=false;
  if v_owner is null then raise exception 'Post is not available for Dugtong'; end if;

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
  where p.id=p_post_id and p.deleted_at is null
$$;
revoke all on function public.get_buklod_dugtong_summary_v1(uuid) from public,anon;
grant execute on function public.get_buklod_dugtong_summary_v1(uuid) to authenticated;

create or replace function public.resolve_buklod_community_chain_v1(
  p_post_id uuid,p_helpful_dugtong_id uuid default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select p.user_id into v_owner from public.community_posts p where p.id=p_post_id and p.deleted_at is null;
  if v_owner is distinct from v_actor then raise exception 'Only the original poster may resolve this chain'; end if;

  if p_helpful_dugtong_id is not null then
    update public.buklod_community_dugtongs set is_helpful=false where root_post_id=p_post_id;
    update public.buklod_community_dugtongs set is_helpful=true,updated_at=now()
    where id=p_helpful_dugtong_id and root_post_id=p_post_id and deleted_at is null;
  end if;

  insert into public.buklod_community_post_meta(post_id,kind,chain_status,resolved_dugtong_id,updated_at)
  values(p_post_id,'open_discussion','resolved',p_helpful_dugtong_id,now())
  on conflict(post_id) do update set
    chain_status='resolved',resolved_dugtong_id=p_helpful_dugtong_id,updated_at=now();
end
$$;
revoke all on function public.resolve_buklod_community_chain_v1(uuid,uuid) from public,anon;
grant execute on function public.resolve_buklod_community_chain_v1(uuid,uuid) to authenticated;

create or replace function public.get_buklod_community_discovery_v1(
  p_mode text default 'for_you',p_limit integer default 30
)
returns table(
  post_id uuid,body text,kind text,privacy text,chain_status text,quiet_mode boolean,
  dugtong_count bigint,branch_count bigint,created_at timestamptz
)
language sql
security definer
set search_path=''
as $$
  with candidates as (
    select
      p.id as post_id,p.body,
      coalesce(m.kind,case when coalesce(p.media_mime_type,'') like 'image/%' then 'moment' else 'open_discussion' end) as kind,
      coalesce(m.privacy,'public') as privacy,
      coalesce(m.chain_status,'open') as chain_status,
      coalesce(m.quiet_mode,false) as quiet_mode,
      coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.privacy in ('public','anonymous')),0) as dugtong_count,
      coalesce((select count(distinct d.branch_id) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.privacy in ('public','anonymous')),0) as branch_count,
      p.created_at,
      coalesce(m.updated_at,p.created_at) as activity_at
    from public.community_posts p
    left join public.buklod_community_post_meta m on m.post_id=p.id
    where p.deleted_at is null
      and coalesce(p.author_only,false)=false
      and coalesce(p.audience,'public')='public'
      and coalesce(m.privacy,'public')='public'
  )
  select c.post_id,c.body,c.kind,c.privacy,c.chain_status,c.quiet_mode,c.dugtong_count,c.branch_count,c.created_at
  from candidates c
  where case lower(trim(coalesce(p_mode,'for_you')))
    when 'needs_dugtong' then c.chain_status<>'resolved' and c.dugtong_count=0
    when 'growing' then c.chain_status='growing' or c.dugtong_count>=2
    when 'challenges' then c.kind='challenge'
    when 'polls' then c.kind in ('poll','decision')
    when 'resolved' then c.chain_status='resolved'
    when 'resources' then c.kind='resource'
    when 'moments' then c.kind='moment'
    else true end
  order by
    case when lower(trim(coalesce(p_mode,'for_you')))='needs_dugtong' then c.created_at end desc,
    c.activity_at desc
  limit greatest(1,least(coalesce(p_limit,30),60))
$$;
revoke all on function public.get_buklod_community_discovery_v1(text,integer) from public,anon;
grant execute on function public.get_buklod_community_discovery_v1(text,integer) to authenticated;

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

  insert into public.buklod_community_resource_signals(resource_id,user_id,signal)
  values(p_resource_id,v_actor,v_signal)
  on conflict do nothing;
  get diagnostics v_rows = row_count;

  if v_rows>0 and v_signal='used' then
    perform public.buklod_community_award_small_v1(
      v_actor,'community_resource_used','community_resource_used:'||p_resource_id::text,1,
      'Marked a Community Resource as used'
    );
  end if;
  return jsonb_build_object('recorded',v_rows>0,'signal',v_signal);
end
$$;
revoke all on function public.signal_buklod_community_resource_v1(uuid,text) from public,anon;
grant execute on function public.signal_buklod_community_resource_v1(uuid,text) to authenticated;

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
  select m.poll_options into v_options from public.buklod_community_post_meta m
  where m.post_id=p_post_id and m.kind in ('poll','decision');
  if v_options is null then raise exception 'Poll not found'; end if;
  if p_option_index<0 or p_option_index>=jsonb_array_length(v_options) then raise exception 'Invalid poll option'; end if;

  v_first := not exists(select 1 from public.buklod_community_poll_votes v where v.post_id=p_post_id and v.user_id=v_actor);
  insert into public.buklod_community_poll_votes(post_id,user_id,option_index)
  values(p_post_id,v_actor,p_option_index)
  on conflict(post_id,user_id) do update set option_index=excluded.option_index,updated_at=now();

  if v_first then
    perform public.buklod_community_award_small_v1(
      v_actor,'community_poll_vote','community_poll_vote:'||p_post_id::text,1,'Participated in a Community poll'
    );
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
  if v_status<>all(array['joined','completed','left']::text[]) then raise exception 'Unsupported challenge status'; end if;
  if not exists(select 1 from public.buklod_community_post_meta m where m.post_id=p_post_id and m.kind='challenge') then raise exception 'Challenge not found'; end if;

  select status into v_previous from public.buklod_community_challenge_members
  where post_id=p_post_id and user_id=v_actor;

  insert into public.buklod_community_challenge_members(post_id,user_id,status,completed_at,updated_at)
  values(p_post_id,v_actor,v_status,case when v_status='completed' then now() else null end,now())
  on conflict(post_id,user_id) do update set
    status=excluded.status,
    completed_at=case when excluded.status='completed' then coalesce(public.buklod_community_challenge_members.completed_at,now()) else public.buklod_community_challenge_members.completed_at end,
    updated_at=now();

  if v_status='completed' and coalesce(v_previous,'')<>'completed' then
    perform public.buklod_community_award_small_v1(
      v_actor,'community_challenge_complete','community_challenge_complete:'||p_post_id::text,2,
      'Completed a BUKLOD Community challenge'
    );
  end if;

  return jsonb_build_object('status',v_status);
end
$$;
revoke all on function public.set_buklod_community_challenge_status_v1(uuid,text) from public,anon;
grant execute on function public.set_buklod_community_challenge_status_v1(uuid,text) to authenticated;

commit;
