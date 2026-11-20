-- Run only on an isolated test database AFTER applying the matching migration.
do $buklod_market_test$
declare
  v text;
  t text;
begin
  foreach t in array array['buklod_market_stores','buklod_market_listings','buklod_market_wall_shares','buklod_market_reports'] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t and c.relrowsecurity) then
      raise exception 'Market table lacks RLS: %',t;
    end if;
    if has_table_privilege('anon','public.'||t,'SELECT') or
       has_table_privilege('anon','public.'||t,'INSERT') or
       has_table_privilege('anon','public.'||t,'UPDATE') or
       has_table_privilege('anon','public.'||t,'DELETE') then
       raise exception 'Anonymous Market permissions detected: %',t;
    end if;
  end loop;
  if has_table_privilege('authenticated','public.buklod_market_reports','UPDATE')
     or has_table_privilege('authenticated','public.buklod_market_reports','DELETE') then
    raise exception 'Users must not moderate their own reports';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public'
    and tablename='buklod_market_reports' and policyname='buklod_market_reports_insert'
    and with_check like '%auth.uid()%') then
    raise exception 'Reports must be bound to authenticated reporter';
  end if;
  if has_table_privilege('authenticated','public.buklod_market_wall_shares','INSERT')
    or has_table_privilege('authenticated','public.buklod_market_wall_shares','DELETE') then
      raise exception 'Wall shares must be server-mediated';
  end if;
  if has_function_privilege('anon','public.buklod_market_share_wall_v1(uuid)','execute')
    or not has_function_privilege('authenticated','public.buklod_market_share_wall_v1(uuid)','execute') then
      raise exception 'Market Wall share RPC grants are incorrect';
  end if;
  select pg_get_functiondef('public.buklod_market_share_wall_v1(uuid)'::regprocedure)
    into v;
  if v is null or position('security definer' in lower(v))=0
    or position('10 minutes' in v)=0 or position('24 hours' in v)=0
    or position('create_buklod_community_post_v3' in v)=0
    or position('owner_id=v_actor' in v)=0 then
      raise exception 'Atomic canonical Wall sharing and abuse control missing';
  end if;
  -- Guard every direct post reward path before the promo Wall post is inserted.
  if (select count(*) from pg_proc p
      where p.oid = any(array[
        'public.community_post_points_trigger_v2()'::regprocedure,
        'private.buklod_community_qmp_after_post_v1()'::regprocedure,
        'private.buklod_engagement_r4_post_trigger_v1()'::regprocedure,
        'private.buklod_achievement_source_trigger_v2()'::regprocedure,
        'private.buklod_character_public_wall_metric_trigger_v3()'::regprocedure])
      and position('market_promo_guard_v1' in pg_get_functiondef(p.oid))>0) <> 5
  then raise exception 'Market promotional posts would mint regular rewards or character achievements'; end if;
  if not exists (select 1 from storage.buckets where id='buklod-market-media'
    and public=true and file_size_limit<=2097152) then
      raise exception 'Market photo bucket missing 2MB cap';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and policyname='buklod_market_photo_insert'
    and cmd='INSERT') then
      raise exception 'Market photo upload RLS missing';
  end if;
end
$buklod_market_test$;
