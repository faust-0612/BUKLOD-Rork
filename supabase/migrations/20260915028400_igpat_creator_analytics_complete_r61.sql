-- BUKLOD IGPAT R61 — final aggregate-only creator analytics contract.
-- Supersedes the compatibility wrapper with the full UI/canonical metric set.

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
  safe_days integer := least(greatest(coalesce(p_days,30),1),365);
  safe_limit integer := least(greatest(coalesce(p_limit,10),1),30);
  since_at timestamptz;
  overview jsonb;
  retention jsonb;
  top_posts jsonb;
  challenge_participation bigint := 0;
  relay_participation bigint := 0;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  since_at := now() - make_interval(days => safe_days);

  with own_posts as (
    select cp.id,cp.body,cp.created_at,greatest(coalesce(cp.media_duration_seconds,0),0)::numeric duration_seconds
    from public.community_posts cp
    where cp.user_id=actor and cp.is_reel=true and cp.is_hidden=false and cp.deleted_at is null
      and cp.media_mime_type like 'video/%' and cp.created_at>=since_at
  ), own_events as (
    select ev.*,op.duration_seconds from public.igpat_events ev join own_posts op on op.id=ev.post_id where ev.created_at>=since_at
  ), latest_save_state as (
    select distinct on (ev.user_id,ev.post_id) ev.user_id,ev.post_id,ev.event_name
    from own_events ev where ev.event_name in ('save','unsave')
    order by ev.user_id,ev.post_id,ev.created_at desc,ev.id desc
  ), event_stats as (
    select
      count(*) filter(where event_name='impression')::bigint views,
      count(distinct user_id) filter(where event_name='impression')::bigint unique_viewers,
      coalesce(sum(watch_ms) filter(where event_name in ('watch','qualified_watch','skip')),0)::bigint watch_ms,
      count(*) filter(where event_name in ('watch','qualified_watch','skip'))::bigint watch_samples,
      count(*) filter(where event_name in ('watch','qualified_watch','skip') and duration_seconds>0 and watch_ms>=duration_seconds*1000*0.80)::bigint completions,
      count(*) filter(where event_name in ('watch','qualified_watch') and duration_seconds>0 and watch_ms>=duration_seconds*1000*1.10)::bigint replay_signals,
      count(*) filter(where event_name='share')::bigint shares
    from own_events
  ), social_stats as (
    select
      coalesce((select count(*)::bigint from public.reactions rx join own_posts op on op.id=rx.post_id),0) pulses,
      coalesce((select count(*)::bigint from public.reactions rx join own_posts op on op.id=rx.post_id where rx.reaction='love'),0) likes,
      coalesce((select count(*)::bigint from public.comments cm join own_posts op on op.id=cm.post_id where cm.is_hidden=false and cm.deleted_at is null),0) comments
  ), save_stats as (
    select count(*)::bigint saves from latest_save_state where event_name='save'
  ), follow_stats as (
    select count(distinct ev.user_id)::bigint follows_gained from public.igpat_events ev
    where ev.creator_id=actor and ev.event_name='follow' and ev.created_at>=since_at
  ), post_count as (select count(*)::bigint posts from own_posts)
  select jsonb_build_object(
    'days',safe_days,'posts',pc.posts,'views',es.views,'unique_viewers',es.unique_viewers,
    'watch_ms',es.watch_ms,'watch_hours',round(es.watch_ms::numeric/3600000.0,2),
    'average_watch_seconds',case when es.watch_samples>0 then round((es.watch_ms::numeric/es.watch_samples::numeric)/1000.0,1) else 0 end,
    'completions',es.completions,'completion_rate',case when es.views>0 then round(es.completions::numeric/es.views::numeric*100,1) else 0 end,
    'replay_signals',es.replay_signals,'likes',ss.likes,'pulses',ss.pulses,'comments',ss.comments,'shares',es.shares,'saves',sv.saves,'follows_gained',fs.follows_gained
  ) into overview from event_stats es,social_stats ss,save_stats sv,follow_stats fs,post_count pc;

  with own_posts as (
    select cp.id,greatest(coalesce(cp.media_duration_seconds,0),0)::numeric duration_seconds
    from public.community_posts cp where cp.user_id=actor and cp.is_reel=true and cp.is_hidden=false and cp.deleted_at is null and cp.media_mime_type like 'video/%' and cp.created_at>=since_at
  ), watches as (
    select ev.watch_ms::numeric watch_ms,op.duration_seconds from public.igpat_events ev join own_posts op on op.id=ev.post_id
    where ev.created_at>=since_at and ev.event_name in ('watch','qualified_watch','skip') and op.duration_seconds>0
  )
  select jsonb_build_object(
    'sample_count',count(*)::bigint,
    'p25',case when count(*)>0 then round((count(*) filter(where watch_ms>=duration_seconds*1000*0.25))::numeric/count(*)::numeric*100,1) else 0 end,
    'p50',case when count(*)>0 then round((count(*) filter(where watch_ms>=duration_seconds*1000*0.50))::numeric/count(*)::numeric*100,1) else 0 end,
    'p75',case when count(*)>0 then round((count(*) filter(where watch_ms>=duration_seconds*1000*0.75))::numeric/count(*)::numeric*100,1) else 0 end,
    'p100',case when count(*)>0 then round((count(*) filter(where watch_ms>=duration_seconds*1000*0.98))::numeric/count(*)::numeric*100,1) else 0 end
  ) into retention from watches;

  select (
    coalesce((select count(*) from public.igpat_arena_challenges c where (c.creator_user_id=actor or c.opponent_user_id=actor) and c.created_at>=since_at and c.status in ('ACCEPTED','ACTIVE','COMPLETED')),0)
    + coalesce((select count(distinct mm.match_id) from public.igpat_arena_squad_match_members mm join public.igpat_arena_squad_matches sm on sm.id=mm.match_id where mm.user_id=actor and sm.created_at>=since_at and sm.status in ('ACCEPTED','ACTIVE','COMPLETED')),0)
    + coalesce((select count(distinct p.event_id) from public.igpat_arena_lms_participants p join public.igpat_arena_lms_events e on e.id=p.event_id where p.user_id=actor and e.created_at>=since_at and e.status in ('ACTIVE','COMPLETED')),0)
  )::bigint into challenge_participation;

  select count(*)::bigint into relay_participation
  from public.buklod_community_post_meta meta
  join public.community_posts child on child.id=meta.post_id
  join public.community_posts parent on parent.id::text=(meta.context_config #>> '{igpat_relay,parent_post_id}')
  where parent.user_id=actor and child.user_id<>actor and child.is_reel=true and child.is_hidden=false and child.deleted_at is null and child.created_at>=since_at;

  overview := overview || jsonb_build_object('challenge_participation',challenge_participation,'relay_participation',relay_participation);

  with own_posts as (
    select cp.id,cp.body,cp.created_at,greatest(coalesce(cp.media_duration_seconds,0),0)::numeric duration_seconds
    from public.community_posts cp where cp.user_id=actor and cp.is_reel=true and cp.is_hidden=false and cp.deleted_at is null and cp.media_mime_type like 'video/%' and cp.created_at>=since_at
  ), latest_save_state as (
    select distinct on (ev.user_id,ev.post_id) ev.user_id,ev.post_id,ev.event_name
    from public.igpat_events ev join own_posts op on op.id=ev.post_id
    where ev.created_at>=since_at and ev.event_name in ('save','unsave')
    order by ev.user_id,ev.post_id,ev.created_at desc,ev.id desc
  ), ranked as (
    select op.id,left(coalesce(nullif(trim(op.body),''),'Untitled IGPAT'),120) title,op.created_at,
      coalesce((select count(*) from public.igpat_events ev where ev.post_id=op.id and ev.event_name='impression' and ev.created_at>=since_at),0)::bigint views,
      coalesce((select count(distinct ev.user_id) from public.igpat_events ev where ev.post_id=op.id and ev.event_name='impression' and ev.created_at>=since_at),0)::bigint unique_viewers,
      coalesce((select sum(ev.watch_ms) from public.igpat_events ev where ev.post_id=op.id and ev.event_name in ('watch','qualified_watch','skip') and ev.created_at>=since_at),0)::bigint watch_ms,
      coalesce((select count(*) from public.igpat_events ev where ev.post_id=op.id and ev.event_name in ('watch','qualified_watch','skip') and ev.created_at>=since_at),0)::bigint watch_samples,
      coalesce((select count(*) from public.reactions rx where rx.post_id=op.id),0)::bigint pulses,
      coalesce((select count(*) from public.reactions rx where rx.post_id=op.id and rx.reaction='love'),0)::bigint likes,
      coalesce((select count(*) from public.comments cm where cm.post_id=op.id and cm.is_hidden=false and cm.deleted_at is null),0)::bigint comments,
      coalesce((select count(*) from public.igpat_events ev where ev.post_id=op.id and ev.event_name='share' and ev.created_at>=since_at),0)::bigint shares,
      coalesce((select count(*) from latest_save_state ss where ss.post_id=op.id and ss.event_name='save'),0)::bigint save_events,
      coalesce((select count(*) from public.igpat_events ev where ev.post_id=op.id and ev.event_name in ('watch','qualified_watch','skip') and ev.created_at>=since_at and op.duration_seconds>0 and ev.watch_ms>=op.duration_seconds*1000*0.80),0)::bigint completions,
      coalesce((select count(*) from public.igpat_events ev where ev.post_id=op.id and ev.event_name in ('watch','qualified_watch') and ev.created_at>=since_at and op.duration_seconds>0 and ev.watch_ms>=op.duration_seconds*1000*1.10),0)::bigint replay_signals
    from own_posts op
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'post_id',id,'title',title,'created_at',created_at,'views',views,'unique_viewers',unique_viewers,'watch_ms',watch_ms,
    'average_watch_seconds',case when watch_samples>0 then round((watch_ms::numeric/watch_samples::numeric)/1000.0,1) else 0 end,
    'likes',likes,'pulses',pulses,'comments',comments,'shares',shares,'save_events',save_events,'completions',completions,'replay_signals',replay_signals,
    'completion_rate',case when views>0 then round(completions::numeric/views::numeric*100,1) else 0 end
  ) order by (views+pulses*2+comments*3+shares*4+save_events*3) desc,created_at desc),'[]'::jsonb)
  into top_posts
  from (select * from ranked order by (views+pulses*2+comments*3+shares*4+save_events*3) desc,created_at desc limit safe_limit) chosen;

  return jsonb_build_object('overview',overview,'retention',retention,'top_posts',top_posts,'generated_at',now());
end;
$$;

-- Remove the temporary core wrapper surface from the earlier migration. The
-- final client RPC above is the only creator-analytics surface clients need.
drop function if exists public.get_my_buklod_igpat_creator_analytics_core_v1(integer,integer);

revoke all on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) from public,anon;
grant execute on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) to authenticated,service_role;
