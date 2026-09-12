-- BUKLOD IGPAT R12
-- Resolve feed modes on the server so Following is complete instead of being
-- a client-side filter over the first Latest page.

create or replace function public.get_buklod_igpat_feed_v2(
  p_mode text default 'for-you',
  p_limit integer default 15
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
  my_reaction text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_mode text := lower(coalesce(nullif(trim(p_mode), ''), 'for-you'));
  safe_limit integer := least(greatest(coalesce(p_limit, 15), 1), 50);
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if safe_mode not in ('for-you', 'following', 'latest') then
    raise exception 'Invalid IGPAT feed mode';
  end if;

  return query
  select
    cp.id,
    cp.user_id,
    coalesce(author.full_name, 'BUKLOD Member')::text,
    cp.audience::text,
    cp.category::text,
    cp.body,
    cp.created_at,
    cp.media_path,
    cp.media_mime_type,
    cp.media_size_bytes::bigint,
    cp.media_duration_seconds::numeric,
    coalesce(
      (
        select jsonb_object_agg(z.reaction, z.cnt)
        from (
          select rx.reaction::text as reaction, count(*)::bigint as cnt
          from public.reactions rx
          where rx.post_id = cp.id
          group by rx.reaction
        ) z
      ),
      '{}'::jsonb
    ),
    (
      select count(*)::bigint
      from public.reactions rx
      where rx.post_id = cp.id
    ),
    (
      select count(*)::bigint
      from public.comments cm
      where cm.post_id = cp.id
        and cm.is_hidden = false
    ),
    (
      select rx.reaction::text
      from public.reactions rx
      where rx.post_id = cp.id
        and rx.user_id = actor
      order by rx.created_at desc
      limit 1
    )
  from public.community_posts cp
  join public.profiles author
    on author.id = cp.user_id
  where cp.is_hidden = false
    and cp.deleted_at is null
    and cp.is_reel = true
    and cp.media_mime_type like 'video/%'
    and public.can_view_community_post_v2(cp.id)
    and (
      safe_mode <> 'following'
      or exists (
        select 1
        from public.buklod_user_follows f
        where f.follower_id = actor
          and f.followed_user_id = cp.user_id
      )
    )
  order by
    case
      when safe_mode = 'for-you' then
        (
          select count(*)::numeric
          from public.reactions rx
          where rx.post_id = cp.id
        )
        + (
          select count(*)::numeric * 2
          from public.comments cm
          where cm.post_id = cp.id
            and cm.is_hidden = false
        )
        + greatest(
            0,
            7 - extract(epoch from (now() - cp.created_at)) / 86400
          )
      else 0
    end desc,
    cp.created_at desc,
    cp.id desc
  limit safe_limit;
end;
$$;

revoke all on function public.get_buklod_igpat_feed_v2(text,integer) from public;
revoke all on function public.get_buklod_igpat_feed_v2(text,integer) from anon;
grant execute on function public.get_buklod_igpat_feed_v2(text,integer) to authenticated;
grant execute on function public.get_buklod_igpat_feed_v2(text,integer) to service_role;
