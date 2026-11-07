-- Run against an isolated DB AFTER the source-only weekly tips migration.
-- No test award/interaction is persisted; all checks are read-only.
begin;
do $assert$
declare v_count integer;
begin
 if to_regclass('public.buklod_weekly_tips_v1') is null
    or to_regclass('public.buklod_weekly_tip_interactions_v1') is null then
  raise exception 'BUKLOD weekly tips schema missing';
 end if;
 if not exists(select 1 from pg_class
   where oid='public.buklod_weekly_tip_interactions_v1'::regclass and relrowsecurity)
 then raise exception 'Weekly personal reflections RLS missing';end if;
 if has_table_privilege('anon','public.buklod_weekly_tip_interactions_v1','SELECT')
    or has_table_privilege('authenticated','public.buklod_weekly_tip_interactions_v1','INSERT')
    or has_table_privilege('authenticated','public.buklod_weekly_tip_interactions_v1','UPDATE')
 then raise exception 'Private weekly interaction exposed to clients';end if;
 if has_function_privilege('anon','public.react_to_buklod_weekly_tip_v1(text,text)','EXECUTE')
 then raise exception 'Anonymous weekly awards permitted';end if;
 if not has_function_privilege('authenticated','public.react_to_buklod_weekly_tip_v1(text,text)','EXECUTE')
 then raise exception 'Authenticated weekly interaction inaccessible';end if;
 select count(*) into v_count from public.buklod_weekly_tips_v1 where enabled=true;
 if v_count<>12 then raise exception 'Expected 12 curated weekly tips, got %',v_count;end if;
 if (select count(*) from public.buklod_point_rules
   where activity_type in ('weekly_tip_reaction','weekly_tip_dugtong')
   and is_active and base_points between 1 and 2)<>2
 then raise exception 'Weekly BP rules missing';end if;
 if not exists(select 1 from pg_policies
   where schemaname='public' and tablename='buklod_weekly_tip_interactions_v1'
   and cmd='SELECT' and qual like '%auth.uid()%')
 then raise exception 'Own-only reaction read policy missing';end if;
end;
$assert$;
rollback;
