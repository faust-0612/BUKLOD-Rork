-- BUKLOD IGPAT R61 — privacy-safe creator analytics.
-- Aggregate only: no viewer identity lists are returned to creators.

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
  retention jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  since_at := now() - make_interval(days => safe_days);

  with own_posts as (
    select cp.id, cp.created_at,
      greatest(coalesce(cp.media_duration_seconds, 0), 0)::numeric as duration_seconds
    from public.community_posts cp
    where cp.user_id = actor
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and cp.created_at >= since_at
  ), event_base as (
    select ev.*, op.duration_seconds
    from public.igpat_events ev
    join own_posts op on op.id = ev.post_id
    where ev.created_at >= since_at
  ), watch_stats as (
    select
      count(*) filter (where event_name = 'impression')::bigint as views,
      count(distinct user_id) filter (where event_name = 'impression')::bigint as unique_viewers,
      count(*) filter (where event_name in ('watch','qualified_watch','skip'))::bigint as watch_sessions,
      coalesce(sum(watch_ms) filter (where event_name in ('watch','qualified_watch','skip')), 0)::bigint as watch_ms,
      count(*) filter (
        where event_name in ('watch','qualified_watch','skip')
          and duration_seconds > 0
          and watch_ms >= duration_seconds * 1000 * 0.80
      )::bigint as completions,
      count(*) filter (where event_name = 'share')::bigint as shares
    from event_base
  ), replay_stats as (
    select coalesce(sum(greatest(impressions - 1, 0)), 0)::bigint as replays
    from (
      select post_id, user_id, count(*)::bigint as impressions
      from event_base
      where event_name = 'impression'
      group by post_id, user_id
    ) grouped
  ), latest_save as (
    select distinct on (post_id, user_id) post_id, user_id, event_name
    from event_base
    where event_name in ('save','unsave')
    order by post_id, user_id, created_at desc, id desc
  ), save_stats as (
    select count(*) filter (where event_name = 'save')::bigint as saves
    from latest_save
  ), social_stats as (
    select
      coalesce((select count(*)::bigint from public.reactions rx join own_posts op on op.id = rx.post_id), 0) as reactions,
      coalesce((select count(*)::bigint from public.comments cm join own_posts op on op.id = cm.post_id where cm.is_hidden = false and cm.deleted_at is null), 0) as comments
  ), follow_stats as (
    select count(*)::bigint as follows_gained
    from public.igpat_events ev
    where ev.creator_id = actor and ev.event_name = 'follow' and ev.created_at >= since_at
  ), challenge_stats as (
    select count(*)::bigint as challenge_participation
    from public.igpat_arena_results ar
    where ar.submitted_by = actor
      and ar.created_at >= since_at
      and coalesce(ar.verified, false) = true
  ), relay_stats as (
    select count(*)::bigint as relay_participation
    from own_posts op
    join public.buklod_community_post_meta meta on meta.post_id = op.id
    where nullif(meta.context_config #>> '{igpat_relay,parent_post_id}', '') is not null
  ), post_count as (
    select count(*)::bigint as posts from own_posts
  )
  select jsonb_build_object(
    'days', safe_days,
    'posts', pc.posts,
    'views', ws.views,
    'unique_viewers', ws.unique_viewers,
    'watch_ms', ws.watch_ms,
    'watch_hours', round(ws.watch_ms::numeric / 3600000.0, 2),
    'average_watch_seconds', case when ws.watch_sessions > 0 then round((ws.watch_ms::numeric / ws.watch_sessions::numeric) / 1000.0, 1) else 0 end,
    'completions', ws.completions,
    'completion_rate', case when ws.views > 0 then round((ws.completions::numeric / ws.views::numeric) * 100, 1) else 0 end,
    'replays', rs.replays,
    'reactions', ss.reactions,
    'comments', ss.comments,
    'shares', ws.shares,
    'saves', sv.saves,
    'follows_gained', fs.follows_gained,
    'challenge_participation', cs.challenge_participation,
    'relay_participation', rel.relay_participation
  )
  into overview
  from watch_stats ws, replay_stats rs, save_stats sv, social_stats ss, follow_stats fs,
       challenge_stats cs, relay_stats rel, post_count pc;

  with own_posts as (
    select cp.id, greatest(coalesce(cp.media_duration_seconds, 0), 0)::numeric as duration_seconds
    from public.community_posts cp
    where cp.user_id = actor
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and cp.created_at >= since_at
  ), watch_events as (
    select ev.watch_ms, op.duration_seconds
    from public.igpat_events ev
    join own_posts op on op.id = ev.post_id
    where ev.created_at >= since_at
      and ev.event_name in ('watch','qualified_watch','skip')
      and op.duration_seconds > 0
  ), totals as (
    select
      count(*)::bigint as sessions,
      count(*) filter (where watch_ms >= duration_seconds * 1000 * 0.25)::bigint as p25,
      count(*) filter (where watch_ms >= duration_seconds * 1000 * 0.50)::bigint as p50,
      count(*) filter (where watch_ms >= duration_seconds * 1000 * 0.75)::bigint as p75,
      count(*) filter (where watch_ms >= duration_seconds * 1000 * 0.95)::bigint as p100
    from watch_events
  )
  select jsonb_build_object(
    'sessions', sessions,
    'p25', case when sessions > 0 then round(p25::numeric / sessions::numeric * 100, 1) else 0 end,
    'p50', case when sessions > 0 then round(p50::numeric / sessions::numeric * 100, 1) else 0 end,
    'p75', case when sessions > 0 then round(p75::numeric / sessions::numeric * 100, 1) else 0 end,
    'p100', case when sessions > 0 then round(p100::numeric / sessions::numeric * 100, 1) else 0 end
  ) into retention from totals;

  with own_posts as (
    select cp.id, cp.body, cp.created_at,
      greatest(coalesce(cp.media_duration_seconds, 0), 0)::numeric as duration_seconds
    from public.community_posts cp
    where cp.user_id = actor
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and cp.created_at >= since_at
  ), event_agg as (
    select
      op.id as post_id,
      count(*) filter (where ev.event_name = 'impression')::bigint as views,
      count(distinct ev.user_id) filter (where ev.event_name = 'impression')::bigint as unique_viewers,
      count(*) filter (where ev.event_name in ('watch','qualified_watch','skip'))::bigint as watch_sessions,
      coalesce(sum(ev.watch_ms) filter (where ev.event_name in ('watch','qualified_watch','skip')), 0)::bigint as watch_ms,
      count(*) filter (where ev.event_name = 'share')::bigint as shares,
      count(*) filter (
        where ev.event_name in ('watch','qualified_watch','skip')
          and op.duration_seconds > 0
          and ev.watch_ms >= op.duration_seconds * 1000 * 0.80
      )::bigint as completions
    from own_posts op
    left join public.igpat_events ev on ev.post_id = op.id and ev.created_at >= since_at
    group by op.id
  ), replay_agg as (
    select post_id, coalesce(sum(greatest(impressions - 1, 0)), 0)::bigint as replays
    from (
      select ev.post_id, ev.user_id, count(*)::bigint as impressions
      from public.igpat_events ev
      join own_posts op on op.id = ev.post_id
      where ev.created_at >= since_at and ev.event_name = 'impression'
      group by ev.post_id, ev.user_id
    ) grouped
    group by post_id
  ), latest_save as (
    select distinct on (ev.post_id, ev.user_id) ev.post_id, ev.user_id, ev.event_name
    from public.igpat_events ev
    join own_posts op on op.id = ev.post_id
    where ev.created_at >= since_at and ev.event_name in ('save','unsave')
    order by ev.post_id, ev.user_id, ev.created_at desc, ev.id desc
  ), save_agg as (
    select post_id, count(*) filter (where event_name = 'save')::bigint as saves
    from latest_save group by post_id
  ), reaction_agg as (
    select rx.post_id, count(*)::bigint as reactions
    from public.reactions rx join own_posts op on op.id = rx.post_id
    group by rx.post_id
  ), comment_agg as (
    select cm.post_id, count(*)::bigint as comments
    from public.comments cm join own_posts op on op.id = cm.post_id
    where cm.is_hidden = false and cm.deleted_at is null
    group by cm.post_id
  ), ranked as (
    select
      op.id,
      left(coalesce(nullif(trim(op.body), ''), 'Untitled IGPAT'), 120) as title,
      op.created_at,
      coalesce(ea.views, 0) as views,
      coalesce(ea.unique_viewers, 0) as unique_viewers,
      coalesce(ea.watch_ms, 0) as watch_ms,
      case when coalesce(ea.watch_sessions, 0) > 0 then round((ea.watch_ms::numeric / ea.watch_sessions::numeric) / 1000.0, 1) else 0 end as average_watch_seconds,
      coalesce(ra.reactions, 0) as reactions,
      coalesce(ca.comments, 0) as comments,
      coalesce(ea.shares, 0) as shares,
      coalesce(sa.saves, 0) as saves,
      coalesce(rpa.replays, 0) as replays,
      coalesce(ea.completions, 0) as completions,
      case when coalesce(ea.views, 0) > 0 then round((ea.completions::numeric / ea.views::numeric) * 100, 1) else 0 end as completion_rate
    from own_posts op
    left join event_agg ea on ea.post_id = op.id
    left join replay_agg rpa on rpa.post_id = op.id
    left join save_agg sa on sa.post_id = op.id
    left join reaction_agg ra on ra.post_id = op.id
    left join comment_agg ca on ca.post_id = op.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'post_id', id,
    'title', title,
    'created_at', created_at,
    'views', views,
    'unique_viewers', unique_viewers,
    'watch_ms', watch_ms,
    'average_watch_seconds', average_watch_seconds,
    'reactions', reactions,
    'comments', comments,
    'shares', shares,
    'saves', saves,
    'replays', replays,
    'completions', completions,
    'completion_rate', completion_rate
  ) order by (views + reactions * 2 + comments * 3 + shares * 4 + saves * 4) desc, created_at desc), '[]'::jsonb)
  into top_posts
  from (
    select * from ranked
    order by (views + reactions * 2 + comments * 3 + shares * 4 + saves * 4) desc, created_at desc
    limit safe_limit
  ) chosen;

  return jsonb_build_object(
    'overview', overview,
    'retention', retention,
    'top_posts', top_posts,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) from public;
revoke all on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) from anon;
grant execute on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) to authenticated, service_role;
