-- BUKLOD: fail closed when a published post becomes "Ako lang".
-- The existing permissive SELECT policies are OR-combined by Postgres;
-- both alternate audience policies must honor the canonical visibility gate.
alter policy "Group/church posts readable by audience"
  on public.community_posts
  using (
    is_hidden = false and deleted_at is null
    and public.can_view_community_post_v2(id)
    and (
      (group_id is not null and public.is_group_member(group_id))
      or (church_id is not null and church_id = public.my_church_id())
      or public.is_system_admin()
    )
  );

alter policy buklod_scope_social_posts_read
  on public.community_posts
  using (
    scope_id is not null and audience = 'scope'
    and public.buklod_scope_social_can_access(scope_id)
    and public.can_view_community_post_v2(id)
  );

-- SECURITY DEFINER feed RPCs bypass table RLS. Patch their specific
-- eligibility predicates, preserving signatures, ranking and ordering.
do $fix_author_only_feeds$
declare
  v_def text;
  v_match text;
  v_replacement text;
begin
  select pg_get_functiondef(
    'public.get_buklod_public_community_feed_v7_page_raw_r2(uuid,text,integer,integer)'::regprocedure
  ) into v_def;
  v_match := 'and cp.is_hidden=false';
  v_replacement := 'and cp.is_hidden=false and (coalesce(cp.author_only,false)=false or cp.user_id=actor)';
  if position(v_replacement in v_def) = 0 then
    if (length(v_def) - length(replace(v_def,v_match,''))) <> length(v_match) then
      raise exception 'Unexpected public feed definition; privacy patch not applied';
    end if;
    execute replace(v_def,v_match,v_replacement);
  end if;

  select pg_get_functiondef(
    'public.buklod_scope_social_feed_v1(uuid,integer)'::regprocedure
  ) into v_def;
  v_match := 'where coalesce(p.is_hidden, false) = false and p.deleted_at is null';
  v_replacement := v_match || E'\n    and public.can_view_community_post_v2(p.id)';
  if position(v_replacement in v_def) = 0 then
    if (length(v_def) - length(replace(v_def,v_match,''))) <> length(v_match) then
      raise exception 'Unexpected scoped feed definition; privacy patch not applied';
    end if;
    execute replace(v_def,v_match,v_replacement);
  end if;
end;
$fix_author_only_feeds$;

-- Broadcast IDs/status only (never bodies, media URLs or identity data).
-- Clients may evict a revoked post synchronously, then perform a
-- debounced re-fetch for eventual consistency.
create or replace function public.buklod_broadcast_public_community_post_change()
returns trigger language plpgsql security definer set search_path to ''
as $body$
declare
  v_post_id uuid;
  v_should_broadcast boolean := false;
  v_visibility_revoked boolean := false;
begin
  if tg_op = 'INSERT' then
    v_post_id := new.id;
    v_should_broadcast := new.audience = 'public' and new.scope_id is null;
  elsif tg_op = 'UPDATE' then
    v_post_id := new.id;
    v_should_broadcast :=
      (new.audience = 'public' and new.scope_id is null)
      or (old.audience = 'public' and old.scope_id is null);
    v_visibility_revoked :=
      coalesce(new.author_only,false)
      or coalesce(new.is_hidden,false)
      or new.deleted_at is not null
      or new.audience <> 'public'
      or new.scope_id is not null;
  elsif tg_op = 'DELETE' then
    v_post_id := old.id;
    v_should_broadcast := old.audience = 'public' and old.scope_id is null;
    v_visibility_revoked := true;
  end if;

  if v_should_broadcast then
    perform realtime.send(
      jsonb_build_object(
        'post_id', v_post_id,
        'operation', tg_op,
        'visibility_revoked', v_visibility_revoked
      ),
      'post_changed',
      'buklod:public-community:posts',
      false
    );
  end if;
  return null;
end;
$body$;
