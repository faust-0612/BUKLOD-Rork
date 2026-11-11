-- All public Dugtong are accessible through bounded pages, never via unrestricted table SELECT.
create or replace function public.list_buklod_today_dugtongs_v2(
 p_cycle_id bigint,p_offset integer default 0,p_limit integer default 30)
returns jsonb language sql stable security definer set search_path='' as $func$
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'display_name',case when e.user_id=(select auth.uid()) then 'Ikaw'
    else coalesce(nullif(pg_catalog.btrim(p.first_name),''),
      nullif(pg_catalog.btrim(p.full_name),''),'BUKLOD member') end,
   'dugtong',e.dugtong,'created_at',e.dugtong_at,
   'is_mine',e.user_id=(select auth.uid())
 ) order by e.dugtong_at desc),'[]'::jsonb)
 from (
  select user_id,dugtong,dugtong_at
  from public.buklod_today_tip_engagement_v2
  where cycle_id=p_cycle_id and visibility='public' and dugtong is not null
  order by dugtong_at desc,user_id
  limit least(greatest(coalesce(p_limit,30),1),30)
  offset greatest(coalesce(p_offset,0),0)
 ) e
 left join public.profiles p on p.id=e.user_id;
$func$;
revoke all on function public.list_buklod_today_dugtongs_v2(bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.list_buklod_today_dugtongs_v2(bigint,integer,integer) to anon,authenticated;
