-- BUKLOD Community R2 anonymous identity hardening.
-- Anonymous is a presentation privacy mode: BUKLOD retains the owner privately,
-- while ordinary authenticated users cannot recover the owner from user_id,
-- feed RPCs, direct community_posts reads, or media object paths.

begin;

create table if not exists public.buklod_community_root_owners (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_buklod_community_root_owners_owner
  on public.buklod_community_root_owners(owner_id,created_at desc);
alter table public.buklod_community_root_owners enable row level security;
revoke all on table public.buklod_community_root_owners from public,anon,authenticated;

alter table public.community_posts alter column user_id drop not null;

create or replace function public.buklod_community_root_owner_v1(p_post_id uuid)
returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    (select o.owner_id from public.buklod_community_root_owners o where o.post_id=p_post_id),
    (select p.user_id from public.community_posts p where p.id=p_post_id)
  )
$$;
revoke all on function public.buklod_community_root_owner_v1(uuid) from public,anon,authenticated;

-- The renamed raw feed is an implementation detail. Never expose it through PostgREST.
revoke all on function public.get_buklod_public_community_feed_v7_page_raw_r2(uuid,text,integer,integer)
  from public,anon,authenticated;

create or replace function public.can_view_community_post_v2(p_post_id uuid)
returns boolean
language sql
stable security definer
set search_path='public'
as $$
  select exists (
    select 1
    from public.community_posts cp
    join public.profiles viewer on viewer.id=auth.uid()
    where cp.id=p_post_id
      and viewer.is_active=true
      and cp.is_hidden=false
      and cp.deleted_at is null
      and (
        coalesce(cp.author_only,false)=false
        or public.buklod_community_root_owner_v1(cp.id)=auth.uid()
        or public.is_system_admin()
      )
      and (
        public.buklod_community_root_owner_v1(cp.id)=auth.uid()
        or public.is_system_admin()
        or cp.audience='public'
        or (cp.audience='local' and cp.church_id is not null and viewer.church_id=cp.church_id)
        or (
          cp.audience='group' and cp.group_id is not null
          and exists(select 1 from public.group_members gm where gm.group_id=cp.group_id and gm.user_id=auth.uid() and gm.is_active=true)
        )
        or (cp.audience='scope' and cp.scope_id is not null and public.buklod_scope_can_access_v1(cp.scope_id))
      )
  )
$$;

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
  select public.buklod_community_root_owner_v1(p_post_id) into v_owner;
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

create or replace function public.create_buklod_community_living_post_v2(
  p_kind text,
  p_privacy text default 'public',
  p_body text default '',
  p_title text default null,
  p_topic text default null,
  p_quiet_mode boolean default false,
  p_poll_options jsonb default null,
  p_challenge_config jsonb default null,
  p_context_config jsonb default '{}'::jsonb,
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_kind text := lower(trim(coalesce(p_kind,'open_discussion')));
  v_privacy text := lower(trim(coalesce(p_privacy,'public')));
  v_body text := trim(coalesce(p_body,''));
  v_post_id uuid;
  v_media_path text := nullif(trim(coalesce(p_media_path,'')),'');
  v_mime text := lower(trim(coalesce(p_media_mime_type,'')));
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active=true) then raise exception 'Active BUKLOD account required'; end if;
  if v_kind <> all(array['question','need_advice','challenge','poll','idea','encouragement','help_needed','share_a_win','decision','resource','story','open_discussion','moment']::text[]) then raise exception 'Invalid Community post type'; end if;
  if v_privacy not in ('public','anonymous') then raise exception 'Invalid Community privacy'; end if;
  if v_kind='resource' and v_privacy='anonymous' then raise exception 'Resource posts show the sharer name so file ownership stays clear'; end if;
  if char_length(v_body)>12000 then raise exception 'Community post is too long'; end if;
  if public.buklod_community_hard_block_v1(v_body) then raise exception 'This content cannot be posted'; end if;
  if v_privacy='anonymous' and (
    v_body ~* '\m(?:\+?63|0)?9[0-9]{9}\M'
    or v_body ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
  ) then raise exception 'Remove identifying contact details from an anonymous post'; end if;
  if v_kind='poll' and (p_poll_options is null or jsonb_typeof(p_poll_options)<>'array' or jsonb_array_length(p_poll_options)<2) then raise exception 'A poll needs at least two choices'; end if;

  if v_privacy='anonymous' then
    if v_media_path is not null then
      if (storage.foldername(v_media_path))[1] is distinct from 'anonymous-media' then raise exception 'Anonymous media must use an opaque BUKLOD path'; end if;
      if v_mime<>'image/jpeg' then raise exception 'Anonymous Community media must be a JPEG photo'; end if;
      if coalesce(p_media_size_bytes,0)<1 or p_media_size_bytes>5242880 then raise exception 'Anonymous photos are limited to 5 MB'; end if;
      if not exists(select 1 from storage.objects o where o.bucket_id='community-media' and o.name=v_media_path) then raise exception 'Anonymous Community photo was not found'; end if;
    end if;

    insert into public.community_posts(
      user_id,group_id,church_id,audience,category,body,media_path,media_mime_type,media_size_bytes,
      media_duration_seconds,is_reel,author_only
    ) values(
      null,null,null,'public','reflection',coalesce(nullif(v_body,''),'Shared a photo.'),v_media_path,
      nullif(v_mime,''),p_media_size_bytes,null,false,false
    ) returning id into v_post_id;

    insert into public.buklod_community_root_owners(post_id,owner_id)
    values(v_post_id,v_actor);
  else
    select public.create_buklod_community_post_v3(
      'public',null,'reflection',v_body,p_media_path,p_media_mime_type,p_media_size_bytes,'{}'::uuid[],null,false
    ) into v_post_id;
  end if;

  perform public.set_buklod_community_post_meta_v1(
    v_post_id,v_kind,v_privacy,p_title,p_topic,coalesce(p_quiet_mode,false),
    p_poll_options,p_challenge_config,coalesce(p_context_config,'{}'::jsonb)
  );
  update public.buklod_community_post_meta set moderation_state='pending',updated_at=now() where post_id=v_post_id;
  return v_post_id;
end
$$;
revoke all on function public.create_buklod_community_living_post_v2(text,text,text,text,text,boolean,jsonb,jsonb,jsonb,text,text,bigint) from public,anon;
grant execute on function public.create_buklod_community_living_post_v2(text,text,text,text,text,boolean,jsonb,jsonb,jsonb,text,text,bigint) to authenticated;

create or replace function public.buklod_community_can_access_root_v1(p_post_id uuid,p_actor uuid)
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
    where p.id=p_post_id and p.deleted_at is null and coalesce(p.is_hidden,false)=false
      and (
        public.buklod_community_root_owner_v1(p.id)=p_actor
        or (
          coalesce(p.author_only,false)=false and coalesce(p.audience,'public')='public'
          and coalesce(m.privacy,'public') in ('public','anonymous')
          and coalesce(m.moderation_state,'approved')<>'blocked'
        )
      )
  )
$$;
revoke all on function public.buklod_community_can_access_root_v1(uuid,uuid) from public,anon,authenticated;

create or replace function public.get_buklod_public_community_feed_v7_page(
  p_location_scope_id uuid default null,
  p_mode text default 'for_you',
  p_limit integer default 40,
  p_offset integer default 0
)
returns table(
  id uuid,user_id uuid,author_name text,group_id uuid,church_id uuid,audience text,body text,category text,created_at timestamptz,
  media_path text,media_mime_type text,media_size_bytes bigint,reaction_counts jsonb,total_reactions bigint,comment_count bigint,mentions jsonb,
  score_total numeric,score_recency numeric,score_scope_relevance numeric,score_interaction_affinity numeric,score_content_preference numeric,
  score_engagement numeric,score_priority numeric,is_following_author boolean,shares_active_scope boolean
)
language sql
stable
security definer
set search_path=''
as $$
  with normal as (
    select r.*
    from public.get_buklod_public_community_feed_v7_page_raw_r2(
      p_location_scope_id,p_mode,least(100,greatest(1,coalesce(p_limit,40)+coalesce(p_offset,0)+30)),0
    ) r
    left join public.buklod_community_post_meta m on m.post_id=r.id
    where coalesce(m.privacy,'public')<>'anonymous' and coalesce(m.moderation_state,'approved')<>'blocked'
  ), anon_base as (
    select p.*,m.kind,m.moderation_state,o.owner_id,
      extract(epoch from (now()-p.created_at))/3600.0 age_hours,
      coalesce((select count(*) from public.reactions rr where rr.post_id=p.id),0)::bigint total_rx,
      coalesce((select count(*) from public.comments cc where cc.post_id=p.id and coalesce(cc.is_hidden,false)=false),0)::bigint total_comments
    from public.community_posts p
    join public.buklod_community_post_meta m on m.post_id=p.id and m.privacy='anonymous'
    join public.buklod_community_root_owners o on o.post_id=p.id
    where p.deleted_at is null and coalesce(p.is_hidden,false)=false and coalesce(p.author_only,false)=false
      and p.audience='public' and p.scope_id is null and coalesce(m.moderation_state,'approved')<>'blocked'
      and (
        p_location_scope_id is null
        or public.buklod_scope_user_is_member_v1(p_location_scope_id,o.owner_id)
      )
      and (lower(trim(coalesce(p_mode,'for_you'))) <> 'following' or o.owner_id=(select auth.uid()))
  ), anon as (
    select
      a.id,null::uuid user_id,'Anonymous BUKLOD Member'::text author_name,a.group_id,a.church_id,a.audience,a.body,a.category,a.created_at,
      a.media_path,a.media_mime_type,a.media_size_bytes,
      coalesce((select jsonb_object_agg(x.reaction,x.cnt) from (select r.reaction,count(*)::bigint cnt from public.reactions r where r.post_id=a.id group by r.reaction) x),'{}'::jsonb) reaction_counts,
      a.total_rx total_reactions,a.total_comments comment_count,'[]'::jsonb mentions,
      (greatest(0,40*exp(-a.age_hours/72.0)) + 7 + case when a.owner_id=(select auth.uid()) then 13.5 else 1.5 end + 2.5 + least(10,ln(1+a.total_rx+a.total_comments*2)/ln(21)*10) + greatest(0,least(5,coalesce(a.feed_priority,0)::numeric/2)))::numeric score_total,
      greatest(0,40*exp(-a.age_hours/72.0))::numeric score_recency,
      7::numeric score_scope_relevance,
      (case when a.owner_id=(select auth.uid()) then 13.5 else 1.5 end)::numeric score_interaction_affinity,
      2.5::numeric score_content_preference,
      least(10,ln(1+a.total_rx+a.total_comments*2)/ln(21)*10)::numeric score_engagement,
      greatest(0,least(5,coalesce(a.feed_priority,0)::numeric/2))::numeric score_priority,
      false is_following_author,false shares_active_scope
    from anon_base a
  ), combined as (
    select * from normal
    union all
    select * from anon
  )
  select c.* from combined c
  order by
    case when lower(trim(coalesce(p_mode,'for_you')))='for_you' then c.score_total end desc nulls last,
    c.created_at desc
  limit greatest(1,least(coalesce(p_limit,40),100))
  offset greatest(0,coalesce(p_offset,0))
$$;
revoke all on function public.get_buklod_public_community_feed_v7_page(uuid,text,integer,integer) from public,anon;
grant execute on function public.get_buklod_public_community_feed_v7_page(uuid,text,integer,integer) to authenticated;

create or replace function public.create_buklod_dugtong_v1(
  p_post_id uuid,p_parent_id uuid default null,p_body text default '',p_type text default 'continuation',p_privacy text default 'public',
  p_media_path text default null,p_media_mime_type text default null,p_media_size_bytes bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_root_owner uuid;
  v_body text := trim(coalesce(p_body,''));
  v_parent public.buklod_community_dugtongs%rowtype;
  v_depth smallint := 1;
  v_id uuid := gen_random_uuid();
  v_branch uuid;
  v_count integer := 0;
  v_privacy text := lower(trim(coalesce(p_privacy,'public')));
  v_media_path text := nullif(trim(coalesce(p_media_path,'')),'');
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_community_can_access_root_v1(p_post_id,v_actor) then raise exception 'Post is not available for Dugtong'; end if;
  select public.buklod_community_root_owner_v1(p_post_id) into v_root_owner;
  if char_length(v_body)<1 or char_length(v_body)>4000 then raise exception 'Dugtong must be 1 to 4000 characters'; end if;
  if public.buklod_community_hard_block_v1(v_body) then raise exception 'This content cannot be posted'; end if;
  if v_privacy not in ('public','anonymous','private_poster') then raise exception 'Invalid Dugtong privacy'; end if;
  if v_privacy='anonymous' and (v_body ~* '\m(?:\+?63|0)?9[0-9]{9}\M' or v_body ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}') then raise exception 'Remove identifying contact details from an anonymous Dugtong'; end if;

  if p_parent_id is not null then
    select * into v_parent from public.buklod_community_dugtongs d where d.id=p_parent_id and d.root_post_id=p_post_id and d.deleted_at is null;
    if not found then raise exception 'Parent Dugtong was not found in this chain'; end if;
    if v_parent.privacy='private_poster' and v_actor not in (v_parent.user_id,v_root_owner) then raise exception 'This private Dugtong can only be continued by its author or the original poster'; end if;
    v_depth := (v_parent.depth+1)::smallint;
    if v_depth>24 then raise exception 'This branch is already deep. Start from the original post.'; end if;
    v_branch := coalesce(v_parent.branch_id,v_parent.id);
  else v_branch := v_id; end if;

  if v_media_path is not null then
    if v_privacy='anonymous' then
      if (storage.foldername(v_media_path))[1] is distinct from 'anonymous-media' then raise exception 'Anonymous Dugtong media must use an opaque BUKLOD path'; end if;
      if lower(trim(coalesce(p_media_mime_type,'')))<>'image/jpeg' or coalesce(p_media_size_bytes,0)<1 or p_media_size_bytes>5242880 then raise exception 'Anonymous Dugtong photos must be JPEG and 5 MB or smaller'; end if;
      if not exists(select 1 from storage.objects o where o.bucket_id='community-media' and o.name=v_media_path) then raise exception 'Anonymous Dugtong photo was not found'; end if;
    elsif (storage.foldername(v_media_path))[1] is distinct from v_actor::text then
      raise exception 'Invalid Dugtong media path';
    end if;
  end if;

  insert into public.buklod_community_dugtongs(
    id,root_post_id,parent_id,branch_id,user_id,body,dugtong_type,privacy,depth,media_path,media_mime_type,media_size_bytes,moderation_state
  ) values(
    v_id,p_post_id,p_parent_id,v_branch,v_actor,v_body,lower(trim(coalesce(p_type,'continuation'))),v_privacy,v_depth,
    v_media_path,nullif(lower(trim(coalesce(p_media_mime_type,''))),''),p_media_size_bytes,'approved'
  );
  select count(*)::integer into v_count from public.buklod_community_dugtongs d where d.root_post_id=p_post_id and d.user_id=v_actor and d.deleted_at is null;
  if v_count=1 then perform public.buklod_community_award_small_v1(v_actor,'community_dugtong','community_dugtong:'||p_post_id::text,1,'Meaningful Dugtong added to a Community chain'); end if;
  update public.buklod_community_post_meta set chain_status=case when chain_status='resolved' then 'resolved' else 'growing' end,updated_at=now() where post_id=p_post_id;
  return jsonb_build_object('id',v_id,'root_post_id',p_post_id,'parent_id',p_parent_id,'depth',v_depth,'branch_id',v_branch);
end
$$;
revoke all on function public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint) from public,anon;
grant execute on function public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint) to authenticated;

create or replace function public.get_buklod_dugtong_chain_v1(p_post_id uuid)
returns table(
  id uuid,parent_id uuid,branch_id uuid,depth smallint,body text,dugtong_type text,privacy text,
  user_id uuid,display_name text,media_path text,media_mime_type text,media_size_bytes bigint,is_helpful boolean,created_at timestamptz
)
language sql
security definer
set search_path=''
as $$
  select d.id,d.parent_id,d.branch_id,d.depth,d.body,d.dugtong_type,d.privacy,
    case when d.privacy='anonymous' and d.user_id<>(select auth.uid()) then null else d.user_id end,
    case when d.privacy='anonymous' and d.user_id<>(select auth.uid()) then 'Anonymous BUKLOD Member' else coalesce(nullif(trim(p.full_name),''),'BUKLOD Member') end,
    d.media_path,d.media_mime_type,d.media_size_bytes,d.is_helpful,d.created_at
  from public.buklod_community_dugtongs d
  left join public.profiles p on p.id=d.user_id
  where d.root_post_id=p_post_id
    and public.buklod_community_can_access_root_v1(p_post_id,(select auth.uid()))
    and d.deleted_at is null and d.moderation_state='approved'
    and (
      d.privacy in ('public','anonymous') or d.user_id=(select auth.uid())
      or public.buklod_community_root_owner_v1(p_post_id)=(select auth.uid())
    )
  order by d.created_at asc
$$;
revoke all on function public.get_buklod_dugtong_chain_v1(uuid) from public,anon;
grant execute on function public.get_buklod_dugtong_chain_v1(uuid) to authenticated;

create or replace function public.set_buklod_dugtong_helpful_v1(p_dugtong_id uuid,p_helpful boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid()); v_row public.buklod_community_dugtongs%rowtype; v_root_owner uuid; v_helpful_count integer;
  v_budget integer:=0; v_spent integer:=0; v_award integer:=0; v_ledger uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_row from public.buklod_community_dugtongs d where d.id=p_dugtong_id and d.deleted_at is null;
  if not found then raise exception 'Dugtong not found'; end if;
  select public.buklod_community_root_owner_v1(v_row.root_post_id) into v_root_owner;
  if v_actor is distinct from v_root_owner then raise exception 'Only the original poster can mark a helpful Dugtong'; end if;
  if v_row.user_id=v_actor then raise exception 'Your own Dugtong cannot receive a helpful bonus'; end if;
  if coalesce(p_helpful,false) and not v_row.is_helpful then
    select count(*)::integer into v_helpful_count from public.buklod_community_dugtongs d where d.root_post_id=v_row.root_post_id and d.is_helpful=true and d.deleted_at is null;
    if v_helpful_count>=3 then raise exception 'Choose up to three most helpful Dugtongs'; end if;
  end if;
  update public.buklod_community_dugtongs set is_helpful=coalesce(p_helpful,false),updated_at=now() where id=p_dugtong_id;
  if coalesce(p_helpful,false) then
    select greatest(0,least(10,coalesce((m.context_config->>'reward_pot_points')::integer,0))) into v_budget from public.buklod_community_post_meta m where m.post_id=v_row.root_post_id;
    select coalesce(sum(a.points),0)::integer into v_spent from public.buklod_community_reward_pot_awards a where a.post_id=v_row.root_post_id;
    if v_budget>v_spent
       and not exists(select 1 from public.buklod_community_reward_pot_awards a where a.post_id=v_row.root_post_id and a.dugtong_id=p_dugtong_id)
       and not exists(select 1 from public.buklod_community_reward_pot_awards a where a.post_id=v_row.root_post_id and a.recipient_id=v_row.user_id) then
      v_award:=least(2,v_budget-v_spent);
      v_ledger:=public.buklod_community_award_small_v1(v_row.user_id,'community_helpful_dugtong','community_helpful_dugtong:'||v_row.root_post_id::text||':'||v_row.user_id::text,v_award,'A Dugtong was marked helpful by the original poster');
      if v_ledger is not null then insert into public.buklod_community_reward_pot_awards(post_id,dugtong_id,recipient_id,points) values(v_row.root_post_id,p_dugtong_id,v_row.user_id,v_award) on conflict(post_id,dugtong_id) do nothing; end if;
    end if;
  end if;
  return jsonb_build_object('dugtong_id',p_dugtong_id,'helpful',coalesce(p_helpful,false),'bonus_points',v_award);
end
$$;
revoke all on function public.set_buklod_dugtong_helpful_v1(uuid,boolean) from public,anon;
grant execute on function public.set_buklod_dugtong_helpful_v1(uuid,boolean) to authenticated;

create or replace function public.resolve_buklod_community_chain_v1(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_owner uuid; v_count integer; v_other_count integer; v_best uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select public.buklod_community_root_owner_v1(p_post_id) into v_owner;
  if v_owner is distinct from v_actor then raise exception 'Only the original poster can resolve this chain'; end if;
  select count(*)::integer,count(*) filter(where d.user_id<>v_actor)::integer into v_count,v_other_count from public.buklod_community_dugtongs d where d.root_post_id=p_post_id and d.deleted_at is null and d.moderation_state='approved';
  if v_count<1 then raise exception 'A chain needs at least one Dugtong before it can be resolved'; end if;
  select d.id into v_best from public.buklod_community_dugtongs d where d.root_post_id=p_post_id and d.deleted_at is null and d.moderation_state='approved' order by d.is_helpful desc,d.created_at asc limit 1;
  update public.buklod_community_post_meta set chain_status='resolved',resolved_dugtong_id=coalesce(resolved_dugtong_id,v_best),updated_at=now() where post_id=p_post_id;
  if v_other_count>0 then perform public.buklod_community_award_small_v1(v_actor,'community_chain_resolve','community_chain_resolve:'||p_post_id::text,1,'Closed the loop on a useful Community chain'); end if;
  return jsonb_build_object('post_id',p_post_id,'status','resolved','dugtong_count',v_count);
end
$$;
revoke all on function public.resolve_buklod_community_chain_v1(uuid) from public,anon;
grant execute on function public.resolve_buklod_community_chain_v1(uuid) to authenticated;

create or replace function public.set_buklod_community_takeaway_public_v1(p_post_id uuid,p_public boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_owner uuid; v_was_public boolean; v_public_summary text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select public.buklod_community_root_owner_v1(p_post_id) into v_owner;
  if v_owner is distinct from v_actor then raise exception 'Only the original poster can share this Takeaway'; end if;
  select t.is_public,t.public_summary into v_was_public,v_public_summary from public.buklod_community_takeaways t where t.post_id=p_post_id;
  if not found then raise exception 'Takeaway is not ready yet'; end if;
  if coalesce(p_public,false) and nullif(trim(coalesce(v_public_summary,'')),'') is null then raise exception 'A privacy-safe public Takeaway is not ready yet'; end if;
  update public.buklod_community_takeaways set is_public=coalesce(p_public,false),published_at=case when coalesce(p_public,false) then coalesce(published_at,now()) else null end,updated_at=now() where post_id=p_post_id;
  if coalesce(p_public,false) and not coalesce(v_was_public,false) then perform public.buklod_community_award_small_v1(v_actor,'community_takeaway_share','community_takeaway_share:'||p_post_id::text,1,'Shared an anonymized Community Takeaway'); end if;
  return jsonb_build_object('post_id',p_post_id,'is_public',coalesce(p_public,false));
end
$$;
revoke all on function public.set_buklod_community_takeaway_public_v1(uuid,boolean) from public,anon;
grant execute on function public.set_buklod_community_takeaway_public_v1(uuid,boolean) to authenticated;

create or replace function public.get_buklod_dugtong_summary_v1(p_post_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'post_id',p.id,'kind',coalesce(m.kind,case when coalesce(p.media_mime_type,'') like 'image/%' then 'moment' else 'open_discussion' end),
    'status',coalesce(m.chain_status,'open'),'quiet_mode',coalesce(m.quiet_mode,false),
    'is_owner',public.buklod_community_root_owner_v1(p.id)=(select auth.uid()),'context_config',coalesce(m.context_config,'{}'::jsonb),
    'reward_pot_points',greatest(0,least(10,coalesce((m.context_config->>'reward_pot_points')::integer,0))),'root_media_path',p.media_path,
    'public_count',coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy in ('public','anonymous')),0),
    'private_count',case when public.buklod_community_root_owner_v1(p.id)=(select auth.uid()) then coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy='private_poster'),0) else 0 end,
    'branch_count',coalesce((select count(distinct d.branch_id) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved'),0),
    'helpful_count',coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.is_helpful=true),0),
    'takeaway_summary',case when public.buklod_community_root_owner_v1(p.id)=(select auth.uid()) then t.summary when t.is_public then t.public_summary else null end,
    'takeaway_public',coalesce(t.is_public,false)
  )
  from public.community_posts p
  left join public.buklod_community_post_meta m on m.post_id=p.id
  left join public.buklod_community_takeaways t on t.post_id=p.id and t.moderation_state='approved'
  where p.id=p_post_id and p.deleted_at is null and public.buklod_community_can_access_root_v1(p_post_id,(select auth.uid()))
$$;
revoke all on function public.get_buklod_dugtong_summary_v1(uuid) from public,anon;
grant execute on function public.get_buklod_dugtong_summary_v1(uuid) to authenticated;

create or replace function public.get_buklod_community_discovery_v2(p_mode text default 'for_you',p_limit integer default 30)
returns table(post_id uuid,body text,title text,topic text,kind text,privacy text,chain_status text,quiet_mode boolean,dugtong_count bigint,branch_count bigint,is_owner boolean,rescue_reason text,context_config jsonb,created_at timestamptz)
language sql
security definer
set search_path=''
as $$
  with candidates as (
    select p.id post_id,p.body,m.title,m.topic,coalesce(m.kind,case when coalesce(p.media_mime_type,'') like 'image/%' then 'moment' else 'open_discussion' end) kind,
      coalesce(m.privacy,'public') privacy,coalesce(m.chain_status,'open') chain_status,coalesce(m.quiet_mode,false) quiet_mode,
      coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy in ('public','anonymous')),0) dugtong_count,
      coalesce((select count(distinct d.branch_id) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy in ('public','anonymous')),0) branch_count,
      public.buklod_community_root_owner_v1(p.id)=(select auth.uid()) is_owner,coalesce(m.context_config,'{}'::jsonb) context_config,p.created_at,coalesce(m.updated_at,p.created_at) activity_at,
      case when coalesce(m.chain_status,'open')<>'resolved' and p.created_at<now()-interval '3 hours' and p.created_at>now()-interval '7 days' and coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved'),0)=0 then 'No one has answered yet'
        when coalesce(m.chain_status,'open')<>'resolved' and p.created_at<now()-interval '12 hours' and p.created_at>now()-interval '7 days' and coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved'),0)=1 then 'Could use another perspective' else null end rescue_reason
    from public.community_posts p left join public.buklod_community_post_meta m on m.post_id=p.id
    where p.deleted_at is null and coalesce(p.is_hidden,false)=false and coalesce(p.author_only,false)=false and coalesce(p.audience,'public')='public'
      and coalesce(m.privacy,'public') in ('public','anonymous') and coalesce(m.moderation_state,'approved')<>'blocked'
  )
  select c.post_id,c.body,c.title,c.topic,c.kind,c.privacy,c.chain_status,c.quiet_mode,c.dugtong_count,c.branch_count,c.is_owner,c.rescue_reason,c.context_config,c.created_at
  from candidates c
  where case lower(trim(coalesce(p_mode,'for_you'))) when 'help_someone' then c.rescue_reason is not null when 'growing' then c.chain_status='growing' or c.dugtong_count>=2 when 'challenges' then c.kind='challenge' when 'polls' then c.kind in ('poll','decision') when 'resolved' then c.chain_status='resolved' when 'resources' then c.kind='resource' when 'moments' then c.kind='moment' else true end
  order by case when lower(trim(coalesce(p_mode,'for_you')))='for_you' and c.rescue_reason is not null then 1 else 0 end desc,c.activity_at desc
  limit greatest(1,least(coalesce(p_limit,30),60))
$$;
revoke all on function public.get_buklod_community_discovery_v2(text,integer) from public,anon;
grant execute on function public.get_buklod_community_discovery_v2(text,integer) to authenticated;

create or replace function public.update_buklod_community_post_v1(p_post_id uuid,p_body text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_owner uuid; v_body text:=trim(coalesce(p_body,''));
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select public.buklod_community_root_owner_v1(p_post_id) into v_owner;
  if v_owner is null then raise exception 'Post not found'; end if;
  if v_owner<>v_actor and not public.is_system_admin() then raise exception 'Only the author can edit this post'; end if;
  if char_length(v_body)<1 or char_length(v_body)>12000 or public.buklod_community_hard_block_v1(v_body) then raise exception 'This post cannot be saved'; end if;
  update public.community_posts set body=v_body,updated_at=now() where id=p_post_id and deleted_at is null;
  update public.buklod_community_post_meta set moderation_state='pending',moderation_reason=null,moderated_at=null,updated_at=now() where post_id=p_post_id;
end
$$;
revoke all on function public.update_buklod_community_post_v1(uuid,text) from public,anon;
grant execute on function public.update_buklod_community_post_v1(uuid,text) to authenticated;

create or replace function public.delete_buklod_community_post_v1(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select public.buklod_community_root_owner_v1(p_post_id) into v_owner;
  if v_owner is null then raise exception 'Post not found'; end if;
  if v_owner<>v_actor and not public.is_system_admin() then raise exception 'Only the author can delete this post'; end if;
  update public.community_posts set is_hidden=true,updated_at=now() where id=p_post_id and deleted_at is null;
end
$$;
revoke all on function public.delete_buklod_community_post_v1(uuid) from public,anon;
grant execute on function public.delete_buklod_community_post_v1(uuid) to authenticated;

create or replace function public.set_buklod_community_post_author_only_v1(p_post_id uuid,p_author_only boolean default true)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid:=(select auth.uid()); v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select public.buklod_community_root_owner_v1(p_post_id) into v_owner;
  if v_owner is null then raise exception 'Post not found'; end if;
  if v_owner<>v_actor and not public.is_system_admin() then raise exception 'Only the author can change visibility for this post'; end if;
  update public.community_posts set author_only=coalesce(p_author_only,true),updated_at=now() where id=p_post_id and deleted_at is null;
end
$$;
revoke all on function public.set_buklod_community_post_author_only_v1(uuid,boolean) from public,anon;
grant execute on function public.set_buklod_community_post_author_only_v1(uuid,boolean) to authenticated;

commit;
