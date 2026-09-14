-- BUKLOD IGPAT R61 — PENDING RELEASE SQL
-- This is intentionally NOT a migration filename. Fold/apply it through the
-- authorized release migration step after branch validation.
-- Aggregate-only creator insights: no viewer identity lists.

create or replace function public.get_my_buklod_igpat_creator_analytics_v1(
  p_days integer default 30,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  safe_limit integer := least(greatest(coalesce(p_limit, 10), 1), 30);
  since_at timestamptz;
  overview jsonb;
  top_posts jsonb;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  since_at := now() - make_interval(days => safe_days);

  with own_posts as (
    select
      cp.id,
      cp.body,
      cp.created_at,
      greatest(coalesce(cp.media_duration_seconds, 0), 0)::numeric as duration_seconds
    from public.community_posts cp
    where cp.user_id = actor
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and cp.created_at >= since_at
  ), event_stats as (
    select
      coalesce(count(*) filter (where ev.event_name = 'impression'), 0)::bigint as views,
      coalesce(sum(ev.watch_ms) filter (where ev.event_name in ('watch','qualified_watch','skip')), 0)::bigint as watch_ms,
      coalesce(count(*) filter (
        where ev.event_name in ('watch','qualified_watch','skip')
          and op.duration_seconds > 0
          and ev.watch_ms >= least(op.duration_seconds * 1000 * 0.80, op.duration_seconds * 1000)
      ), 0)::bigint as completions,
      coalesce(count(*) filter (where ev.event_name = 'share'), 0)::bigint as shares
    from own_posts op
    left join public.igpat_events ev
      on ev.post_id = op.id
      and ev.created_at >= since_at
  ), social_stats as (
    select
      coalesce((
        select count(*)::bigint
        from public.reactions rx
        join own_posts op on op.id = rx.post_id
      ), 0) as reactions,
      coalesce((
        select count(*)::bigint
        from public.comments cm
        join own_posts op on op.id = cm.post_id
        where cm.is_hidden = false and cm.deleted_at is null
      ), 0) as comments
  ), follow_stats as (
    select coalesce(count(*), 0)::bigint as follows_gained
    from public.igpat_events ev
    where ev.creator_id = actor
      and ev.event_name = 'follow'
      and ev.created_at >= since_at
  ), post_count as (
    select count(*)::bigint as posts from own_posts
  )
  select jsonb_build_object(
    'days', safe_days,
    'posts', pc.posts,
    'views', es.views,
    'watch_ms', es.watch_ms,
    'watch_hours', round((es.watch_ms::numeric / 3600000.0), 2),
    'completions', es.completions,
    'completion_rate', case when es.views > 0 then round((es.completions::numeric / es.views::numeric) * 100, 1) else 0 end,
    'reactions', ss.reactions,
    'comments', ss.comments,
    'shares', es.shares,
    'follows_gained', fs.follows_gained
  )
  into overview
  from event_stats es, social_stats ss, follow_stats fs, post_count pc;

  with own_posts as (
    select
      cp.id,
      cp.body,
      cp.created_at,
      greatest(coalesce(cp.media_duration_seconds, 0), 0)::numeric as duration_seconds
    from public.community_posts cp
    where cp.user_id = actor
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and cp.created_at >= since_at
  ), ranked as (
    select
      op.id,
      left(coalesce(nullif(trim(op.body), ''), 'Untitled IGPAT'), 120) as title,
      op.created_at,
      coalesce((select count(*) from public.igpat_events ev where ev.post_id = op.id and ev.event_name = 'impression' and ev.created_at >= since_at), 0)::bigint as views,
      coalesce((select sum(ev.watch_ms) from public.igpat_events ev where ev.post_id = op.id and ev.event_name in ('watch','qualified_watch','skip') and ev.created_at >= since_at), 0)::bigint as watch_ms,
      coalesce((select count(*) from public.reactions rx where rx.post_id = op.id), 0)::bigint as reactions,
      coalesce((select count(*) from public.comments cm where cm.post_id = op.id and cm.is_hidden = false and cm.deleted_at is null), 0)::bigint as comments,
      coalesce((select count(*) from public.igpat_events ev where ev.post_id = op.id and ev.event_name = 'share' and ev.created_at >= since_at), 0)::bigint as shares,
      coalesce((select count(*) from public.igpat_events ev where ev.post_id = op.id and ev.event_name in ('watch','qualified_watch','skip') and ev.created_at >= since_at and op.duration_seconds > 0 and ev.watch_ms >= op.duration_seconds * 1000 * 0.80), 0)::bigint as completions
    from own_posts op
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'post_id', id,
      'title', title,
      'created_at', created_at,
      'views', views,
      'watch_ms', watch_ms,
      'reactions', reactions,
      'comments', comments,
      'shares', shares,
      'completions', completions,
      'completion_rate', case when views > 0 then round((completions::numeric / views::numeric) * 100, 1) else 0 end
    ) order by (views + reactions * 2 + comments * 3 + shares * 4) desc, created_at desc
  ), '[]'::jsonb)
  into top_posts
  from (
    select * from ranked
    order by (views + reactions * 2 + comments * 3 + shares * 4) desc, created_at desc
    limit safe_limit
  ) chosen;

  return jsonb_build_object(
    'overview', overview,
    'top_posts', top_posts,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) from public;
revoke all on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) from anon;
grant execute on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) to authenticated;
grant execute on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) to service_role;
