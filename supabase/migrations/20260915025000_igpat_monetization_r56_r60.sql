-- BUKLOD IGPAT R56-R60 — Monetization telemetry / healthy-session analytics
-- Provider eCPM/CTR/revenue remain provider-authoritative; BUKLOD records only
-- its own feed exposure/retention signals and never synthesizes revenue.

create or replace function public.igpat_track_event_v2(
  p_event_name text,
  p_post_id uuid default null,
  p_creator_id uuid default null,
  p_feed_source text default null,
  p_watch_ms integer default 0,
  p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_event text := lower(trim(coalesce(p_event_name, '')));
  safe_feed text := left(lower(trim(coalesce(p_feed_source, ''))), 40);
  safe_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  post_creator uuid;
begin
  if actor is null then return; end if;

  if safe_event not in (
    'impression','watch','qualified_watch','share','save','unsave',
    'follow','comment_open','relay_open','skip','feedback','report',
    'ad_page_view','ad_page_leave'
  ) then return; end if;

  if jsonb_typeof(safe_meta) <> 'object' or length(safe_meta::text) > 2000 then
    safe_meta := '{}'::jsonb;
  end if;

  if safe_event in ('ad_page_view','ad_page_leave') then
    if p_post_id is not null or p_creator_id is not null then return; end if;
    if coalesce(safe_meta->>'placement', '') <> 'reels_inline' then return; end if;
  elsif p_post_id is not null then
    select cp.user_id into post_creator
    from public.community_posts cp
    where cp.id = p_post_id
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and public.can_view_community_post_v2(cp.id);
    if post_creator is null then return; end if;
    if p_creator_id is not null and p_creator_id is distinct from post_creator then return; end if;
  elsif p_creator_id is not null and not exists (
    select 1 from public.profiles p where p.id = p_creator_id
  ) then return;
  end if;

  insert into public.igpat_events(user_id,event_name,post_id,creator_id,feed_source,watch_ms,meta)
  values(
    actor,
    safe_event,
    p_post_id,
    coalesce(p_creator_id, post_creator),
    safe_feed,
    least(greatest(coalesce(p_watch_ms, 0), 0), 120000),
    safe_meta
  );
end;
$$;

create or replace function public.igpat_track_event_v1(
  p_event_name text,
  p_post_id uuid default null,
  p_creator_id uuid default null,
  p_feed_source text default null,
  p_watch_ms integer default 0,
  p_meta jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.igpat_track_event_v2(
    p_event_name,p_post_id,p_creator_id,p_feed_source,p_watch_ms,p_meta
  );
$$;

create or replace function public.get_my_buklod_igpat_ad_health_v1(
  p_days integer default 30
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
  since_at timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
  ad_views bigint;
  ad_leaves bigint;
  ad_dwell_ms bigint;
  organic_views bigint;
  organic_watch_ms bigint;
  fast_exits bigint;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select
    count(*) filter (where ev.event_name = 'ad_page_view')::bigint,
    count(*) filter (where ev.event_name = 'ad_page_leave')::bigint,
    coalesce(sum(ev.watch_ms) filter (where ev.event_name = 'ad_page_leave'), 0)::bigint,
    count(*) filter (where ev.event_name = 'impression')::bigint,
    coalesce(sum(ev.watch_ms) filter (where ev.event_name in ('watch','qualified_watch','skip')), 0)::bigint,
    count(*) filter (where ev.event_name = 'ad_page_leave' and ev.watch_ms < 900)::bigint
  into ad_views, ad_leaves, ad_dwell_ms, organic_views, organic_watch_ms, fast_exits
  from public.igpat_events ev
  where ev.user_id = actor
    and ev.created_at >= since_at;

  return jsonb_build_object(
    'days', safe_days,
    'ad_page_views', coalesce(ad_views, 0),
    'ad_page_leaves', coalesce(ad_leaves, 0),
    'ad_dwell_ms', coalesce(ad_dwell_ms, 0),
    'fast_ad_exits', coalesce(fast_exits, 0),
    'organic_impressions', coalesce(organic_views, 0),
    'organic_watch_ms', coalesce(organic_watch_ms, 0),
    'ads_per_100_organic_views', case
      when coalesce(organic_views, 0) > 0
      then round((coalesce(ad_views, 0)::numeric / organic_views::numeric) * 100, 2)
      else 0
    end,
    'note', 'Provider eCPM, CTR and revenue remain authoritative in AdMob/AdSense; BUKLOD does not synthesize them.'
  );
end;
$$;

revoke all on function public.igpat_track_event_v2(text,uuid,uuid,text,integer,jsonb) from public;
revoke all on function public.igpat_track_event_v2(text,uuid,uuid,text,integer,jsonb) from anon;
grant execute on function public.igpat_track_event_v2(text,uuid,uuid,text,integer,jsonb) to authenticated, service_role;

revoke all on function public.igpat_track_event_v1(text,uuid,uuid,text,integer,jsonb) from public;
revoke all on function public.igpat_track_event_v1(text,uuid,uuid,text,integer,jsonb) from anon;
grant execute on function public.igpat_track_event_v1(text,uuid,uuid,text,integer,jsonb) to authenticated, service_role;

revoke all on function public.get_my_buklod_igpat_ad_health_v1(integer) from public;
revoke all on function public.get_my_buklod_igpat_ad_health_v1(integer) from anon;
grant execute on function public.get_my_buklod_igpat_ad_health_v1(integer) to authenticated, service_role;
