-- Read-only release contract: run after applying author-only privacy migrations.
-- This test modifies neither accounts nor published posts.
begin;
do $privacy_contract$
declare
  v_policies integer;
  v_raw_feed text;
  v_scope_feed text;
  v_public_signal text;
  v_scope_signal text;
begin
  select count(*) into v_policies
  from pg_policies
  where schemaname='public' and tablename='community_posts'
    and policyname in ('Group/church posts readable by audience','buklod_scope_social_posts_read')
    and qual ilike '%can_view_community_post_v2%';
  if v_policies<>2 then raise exception 'Other audience SELECT policies bypass author-only privacy'; end if;

  select pg_get_functiondef('public.get_buklod_public_community_feed_v7_page_raw_r2(uuid,text,integer,integer)'::regprocedure)
    into v_raw_feed;
  if v_raw_feed not ilike '%cp.author_only,false)%' or v_raw_feed not ilike '%cp.user_id=actor%' then
    raise exception 'Public feed still returns non-owner author-only posts';
  end if;
  if has_function_privilege('authenticated',
       'public.get_buklod_public_community_feed_v7_page_raw_r2(uuid,text,integer,integer)'::regprocedure,
       'EXECUTE') then
    raise exception 'Internal raw public feed unexpectedly exposed';
  end if;

  select pg_get_functiondef('public.buklod_scope_social_feed_v1(uuid,integer)'::regprocedure)
    into v_scope_feed;
  if v_scope_feed not ilike '%can_view_community_post_v2(p.id)%' then
    raise exception 'Scoped feed still bypasses canonical post ACL';
  end if;

  select pg_get_functiondef('public.buklod_broadcast_public_community_post_change()'::regprocedure)
    into v_public_signal;
  if v_public_signal not ilike '%visibility_revoked%' then
    raise exception 'Public revocation broadcast metadata missing';
  end if;
  select pg_get_functiondef('private.buklod_scope_post_privacy_broadcast_v1()'::regprocedure)
    into v_scope_signal;
  if v_scope_signal not ilike '%realtime.send%' then
    raise exception 'Scoped revocation not broadcast';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='realtime' and tablename='messages'
      and policyname='buklod_scope_post_privacy_receive_v1'
      and qual ilike '%buklod_scope_social_can_access%'
  ) then raise exception 'Private scope broadcast lacks member authorization'; end if;
end
$privacy_contract$;
rollback;
