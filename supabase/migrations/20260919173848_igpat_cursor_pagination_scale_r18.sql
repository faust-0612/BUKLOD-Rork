-- BUKLOD IGPAT R18
-- Cursor pagination + bounded per-page ranking for production-scale IGPAT.
-- Every request touches only one bounded chronological page, then ranks inside
-- that page. This avoids OFFSET growth and full-feed engagement scans.

create index if not exists community_posts_igpat_live_created_idx
on public.community_posts (created_at desc, id desc)
include (
  user_id,
  media_path,
  media_mime_type,
  media_duration_seconds,
  feed_priority
)
where is_reel = true
  and is_hidden = false
  and deleted_at is null;

create or replace function public.get_buklod_igpat_feed_v4(
  p_mode text default 'for-you',
  p_limit integer default 16,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
returns table(
  id uuid,
  user_id uuid,
  author_name text,
  audience text,
  category text,
  body text,
  created_at timestamptz,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint,
  media_duration_seconds numeric,
  reaction_counts jsonb,
  reaction_count bigint,
  comment_count bigint,
  my_reaction text,
  igpat_edit_meta jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  safe_mode text := lower(coalesce(nullif(trim(p_mode), ''), 'for-you'));
  safe_limit integer := least(greatest(coalesce(p_limit, 16), 1), 32);
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if safe_mode not in ('for-you', 'following', 'latest') then
    raise exception 'Invalid IGPAT feed mode';
  end if;

  return query
  with candidates as (
    select
      cp.id,
      cp.user_id,
      coalesce(nullif(trim(author.full_name), ''), 'BUKLOD Member')::text as author_name,
      cp.audience::text as audience,
      cp.category::text as category,
      cp.body,
      cp.created_at,
      cp.media_path,
      cp.media_mime_type,
      cp.media_size_bytes::bigint as media_size_bytes,
      cp.media_duration_seconds::numeric as media_duration_seconds,
      cp.igpat_edit_meta,
      coalesce(cp.feed_priority, 0)::numeric as feed_priority
    from public.community_posts cp
    join public.profiles author
      on author.id = cp.user_id
    where cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_path is not null
      and cp.media_mime_type like 'video/%'
      and (
        p_before_created_at is null
        or cp.created_at < p_before_created_at
        or (
          cp.created_at = p_before_created_at
          and p_before_id is not null
          and cp.id < p_before_id
        )
      )
      and public.can_view_community_post_v2(cp.id)
      and (
        safe_mode <> 'following'
        or cp.user_id = actor
        or exists (
          select 1
          from public.buklod_user_follows f
          where f.follower_id = actor
            and f.followed_user_id = cp.user_id
        )
      )
    order by cp.created_at desc, cp.id desc
    limit safe_limit
  ),
  reaction_grouped as (
    select
      r.post_id,
      r.reaction::text as reaction,
      count(*)::bigint as cnt
    from public.reactions r
    join candidates c on c.id = r.post_id
    group by r.post_id, r.reaction
  ),
  reaction_agg as (
    select
      rg.post_id,
      coalesce(sum(rg.cnt), 0)::bigint as total_reactions,
      jsonb_object_agg(rg.reaction, rg.cnt) as reaction_counts
    from reaction_grouped rg
    group by rg.post_id
  ),
  comment_agg as (
    select
      cm.post_id,
      count(*)::bigint as comment_count
    from public.comments cm
    join candidates c on c.id = cm.post_id
    where cm.is_hidden = false
    group by cm.post_id
  ),
  my_reaction as (
    select distinct on (r.post_id)
      r.post_id,
      r.reaction::text as reaction
    from public.reactions r
    join candidates c on c.id = r.post_id
    where r.user_id = actor
    order by r.post_id, r.created_at desc
  ),
  enriched as (
    select
      c.*,
      coalesce(ra.reaction_counts, '{}'::jsonb) as reaction_counts,
      coalesce(ra.total_reactions, 0)::bigint as total_reactions,
      coalesce(ca.comment_count, 0)::bigint as comment_count,
      mr.reaction as my_reaction,
      (
        coalesce(ra.total_reactions, 0)::numeric
        + coalesce(ca.comment_count, 0)::numeric * 2
        + greatest(
            0::numeric,
            7::numeric -
            (extract(epoch from (now() - c.created_at)) / 86400.0)::numeric
          )
        + greatest(0::numeric, least(10::numeric, c.feed_priority))
      ) as page_score
    from candidates c
    left join reaction_agg ra on ra.post_id = c.id
    left join comment_agg ca on ca.post_id = c.id
    left join my_reaction mr on mr.post_id = c.id
  )
  select
    e.id,
    e.user_id,
    e.author_name,
    e.audience,
    e.category,
    e.body,
    e.created_at,
    e.media_path,
    e.media_mime_type,
    e.media_size_bytes,
    e.media_duration_seconds,
    e.reaction_counts,
    e.total_reactions as reaction_count,
    e.comment_count,
    e.my_reaction,
    e.igpat_edit_meta
  from enriched e
  order by
    case when safe_mode = 'for-you' then e.page_score end desc nulls last,
    e.created_at desc,
    e.id desc;
end;
$function$;

revoke all on function public.get_buklod_igpat_feed_v4(text, integer, timestamptz, uuid)
from public, anon;

grant execute on function public.get_buklod_igpat_feed_v4(text, integer, timestamptz, uuid)
to authenticated, service_role;

comment on function public.get_buklod_igpat_feed_v4(text, integer, timestamptz, uuid)
is 'BUKLOD IGPAT R18 bounded cursor feed; page-local For You ranking, no growing OFFSET scan.';
