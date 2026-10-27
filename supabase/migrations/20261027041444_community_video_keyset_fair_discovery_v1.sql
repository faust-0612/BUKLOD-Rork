-- Community Video Playview: one bounded, video-only keyset page. It is
-- independent from the Wall's mixed-post page and does not materialize or
-- download media. Existing media signing and RLS remain authoritative.
-- Public rows only; never expose private scope, author-only, blocked or
-- Marites Story media through this endpoint.

create or replace function public.get_buklod_public_community_video_page_v1(
  p_location_scope_id uuid default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 15
)
returns table(
  id uuid,
  user_id uuid,
  author_name text,
  audience text,
  body text,
  category text,
  created_at timestamptz,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint,
  media_duration_seconds numeric,
  reaction_counts jsonb,
  total_reactions bigint,
  comment_count bigint
)
language sql
stable
security definer
set search_path = ''
as $sql$
  with picked as materialized (
    select
      cp.id,
      cp.user_id as actual_author_id,
      coalesce(meta.privacy, 'public') as post_privacy,
      cp.audience,
      cp.body,
      cp.category,
      cp.created_at,
      cp.media_path,
      cp.media_mime_type,
      cp.media_size_bytes,
      cp.media_duration_seconds
    from public.community_posts cp
    join public.profiles viewer
      on viewer.id = (select auth.uid())
     and viewer.is_active = true
     and (
       p_location_scope_id is null
       or exists (
         select 1 from public.buklod_scopes s
         join public.buklod_scope_memberships vm
           on vm.scope_id = s.id
          and vm.user_id = viewer.id
          and vm.membership_status = 'ACTIVE'
         where s.id = p_location_scope_id
           and s.scope_type = 'LOCAL'
           and s.status in ('ACTIVE', 'RESTRICTED')
       )
       or (
         public.buklod_is_system_admin()
         and exists (
           select 1 from public.buklod_scopes s
           where s.id = p_location_scope_id
             and s.scope_type = 'LOCAL'
             and s.status in ('ACTIVE', 'RESTRICTED')
         )
       )
     )
    left join public.buklod_community_post_meta meta
      on meta.post_id = cp.id
    where cp.audience = 'public'
      and cp.scope_id is null
      and cp.deleted_at is null
      and cp.is_hidden = false
      and coalesce(cp.author_only, false) = false
      and coalesce(cp.is_reel, false) = false
      and coalesce(meta.moderation_state, 'approved') <> 'blocked'
      and (
        coalesce(meta.privacy, 'public') <> 'anonymous'
        or exists (
          select 1 from public.buklod_community_root_owners owner
          where owner.post_id = cp.id
        )
      )
      and (
        p_location_scope_id is null
        or (
          coalesce(meta.privacy, 'public') = 'anonymous'
          and exists (
            select 1 from public.buklod_community_root_owners owner
            where owner.post_id = cp.id
              and public.buklod_scope_user_is_member_v1(
                p_location_scope_id, owner.owner_id
              )
          )
        )
        or (
          coalesce(meta.privacy, 'public') <> 'anonymous'
          and exists (
            select 1 from public.buklod_scope_memberships lm
            where lm.scope_id = p_location_scope_id
              and lm.user_id = cp.user_id
              and lm.membership_status = 'ACTIVE'
          )
        )
      )
      and position(U&'\200B\200C\200D\2060' in coalesce(cp.body, '')) = 0
      and coalesce(cp.media_path, '') not ilike '%marites-%'
      and not exists (
        select 1 from public.community_post_media mm
        where mm.post_id = cp.id
          and mm.media_path ilike '%marites-%'
      )
      and (
        (
          cp.media_mime_type like 'video/%'
          and nullif(cp.media_path, '') is not null
        ) or exists (
          select 1 from public.community_post_media video
          where video.post_id = cp.id
            and video.media_mime_type like 'video/%'
            and (
              nullif(video.media_path, '') is not null
              or nullif(video.external_object_key, '') is not null
            )
        )
      )
      and (
        (p_cursor_created_at is null and p_cursor_id is null)
        or (cp.created_at, cp.id) < (p_cursor_created_at, p_cursor_id)
      )
    order by cp.created_at desc, cp.id desc
    limit least(greatest(coalesce(p_limit, 15), 1), 20)
  )
  select
    p.id,
    case when p.post_privacy = 'anonymous' then null::uuid
         else p.actual_author_id end as user_id,
    case when p.post_privacy = 'anonymous'
         then 'Anonymous BUKLOD Member'::text
         else coalesce(nullif(trim(author.full_name), ''), 'BUKLOD Member')::text
    end as author_name,
    p.audience,
    p.body,
    p.category,
    p.created_at,
    p.media_path,
    p.media_mime_type,
    p.media_size_bytes,
    p.media_duration_seconds,
    coalesce(rx.reaction_counts, '{}'::jsonb),
    coalesce(rx.total_reactions, 0)::bigint,
    coalesce(comments.comment_count, 0)::bigint
  from picked p
  left join public.profiles author on author.id = p.actual_author_id
  left join lateral (
    select
      jsonb_object_agg(grouped.reaction, grouped.cnt) as reaction_counts,
      sum(grouped.cnt)::bigint as total_reactions
    from (
      select r.reaction, count(*)::bigint as cnt
      from public.reactions r
      where r.post_id = p.id
      group by r.reaction
    ) grouped
  ) rx on true
  left join lateral (
    select count(*)::bigint as comment_count
    from public.comments c
    where c.post_id = p.id and c.is_hidden = false
  ) comments on true
  order by p.created_at desc, p.id desc;
$sql$;

revoke all on function public.get_buklod_public_community_video_page_v1(
  uuid, timestamptz, uuid, integer
) from public, anon;
grant execute on function public.get_buklod_public_community_video_page_v1(
  uuid, timestamptz, uuid, integer
) to authenticated;
