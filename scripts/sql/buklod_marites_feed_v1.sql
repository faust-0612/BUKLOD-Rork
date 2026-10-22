-- Dedicated Marites reader. Review/fixture-test before migration deployment.
-- Filters BEFORE paging; the Community ranking window is never consulted.
create or replace function public.get_buklod_marites_feed_v1(
  p_location_scope_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  id uuid, user_id uuid, author_name text, avatar_url text, body text,
  created_at timestamptz, media_path text, media_mime_type text,
  media_items jsonb, author_only boolean, reaction_counts jsonb,
  my_reaction text, mentions jsonb
)
language plpgsql stable security definer
set search_path=''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles v where v.id=actor and v.is_active=true) then
    return;
  end if;
  if p_location_scope_id is not null then
    if not exists(
      select 1 from public.buklod_scopes s
      where s.id=p_location_scope_id and s.scope_type='LOCAL'
        and s.status in ('ACTIVE','RESTRICTED')
    ) then raise exception 'Invalid Public Community location filter'; end if;
    if not public.buklod_is_system_admin() and not exists(
      select 1 from public.buklod_scope_memberships m
      where m.scope_id=p_location_scope_id and m.user_id=actor and m.membership_status='ACTIVE'
    ) then raise exception 'Location filter is not available for this account'; end if;
  end if;

  return query
  select p.id,
    case when coalesce(meta.privacy,'public')='anonymous' and owner.id is distinct from actor then null::uuid else owner.id end,
    case when coalesce(meta.privacy,'public')='anonymous' and owner.id is distinct from actor
      then 'Anonymous BUKLOD Member'::text else coalesce(nullif(trim(profile.full_name),''),'BUKLOD Member') end,
    case when coalesce(meta.privacy,'public')='anonymous' and owner.id is distinct from actor
      then null::text else profile.avatar_url end,
    p.body,p.created_at,
    case when coalesce(meta.privacy,'public')='anonymous' and owner.id is distinct from actor
      then null::text else p.media_path end,
    p.media_mime_type,
    case when coalesce(meta.privacy,'public')='anonymous' and owner.id is distinct from actor
      then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'media_path',m.media_path,'media_mime_type',m.media_mime_type,
        'media_position',m.media_position
      ) order by m.media_position)
      from public.community_post_media m where m.post_id=p.id
    ),'[]'::jsonb) end,
    coalesce(p.author_only,false),
    coalesce((
      select jsonb_object_agg(counts.reaction,counts.total)
      from (select r.reaction,count(*) as total from public.reactions r
        where r.post_id=p.id group by r.reaction) counts
    ),'{}'::jsonb),
    (select mine.reaction from public.reactions mine
      where mine.post_id=p.id and mine.user_id=actor limit 1),
    case when coalesce(meta.privacy,'public')='anonymous' and owner.id is distinct from actor then '[]'::jsonb
    else coalesce((
      select jsonb_agg(jsonb_build_object('user_id',mentioned.id,'full_name',mentioned.full_name))
      from public.post_mentions mention
      join public.profiles mentioned on mentioned.id=mention.mentioned_user_id
      where mention.post_id=p.id
    ),'[]'::jsonb) end
  from public.community_posts p
  left join public.buklod_community_post_meta meta on meta.post_id=p.id
  cross join lateral (select public.buklod_community_root_owner_v1(p.id) as id) owner
  left join public.profiles profile on profile.id=owner.id
  where p.audience='public' and p.scope_id is null
    and p.deleted_at is null and coalesce(p.is_hidden,false)=false
    and coalesce(meta.moderation_state,'approved')<>'blocked'
    and public.can_view_community_post_v2(p.id)
    and (p_location_scope_id is null or exists(
      select 1 from public.buklod_scope_memberships local_member
      where local_member.scope_id=p_location_scope_id and local_member.user_id=owner.id
        and local_member.membership_status='ACTIVE'
    ))
    and (
      strpos(coalesce(p.body,''),chr(8203)||chr(8204)||chr(8205)||chr(8288))>0
      or strpos(coalesce(p.media_path,''),'marites-')>0
      or exists(
        select 1 from public.community_post_media photo
        where photo.post_id=p.id and strpos(photo.media_path,'marites-')>0
      )
    )
  order by p.created_at desc,p.id desc
  limit greatest(1,least(coalesce(p_limit,20),100))
  offset greatest(0,coalesce(p_offset,0));
end
$$;
revoke all on function public.get_buklod_marites_feed_v1(uuid,integer,integer) from public,anon;
grant execute on function public.get_buklod_marites_feed_v1(uuid,integer,integer) to authenticated;
