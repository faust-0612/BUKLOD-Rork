-- Execute in QA database only, after the children stories migration.
begin;
do $children_stories_rls$
declare enabled boolean;
begin
 select relrowsecurity into enabled from pg_class where oid='public.buklod_children_stories'::regclass;
 if not enabled then raise exception 'Children stories RLS missing'; end if;
 if has_table_privilege('anon','public.buklod_children_stories','select')
    or has_table_privilege('anon','public.buklod_children_stories','insert')
    or has_table_privilege('anon','public.buklod_children_stories','update') then
   raise exception 'Anonymous account must not access children story CMS';
 end if;
 if not exists (select 1 from pg_policies
   where schemaname='public' and tablename='buklod_children_stories'
     and policyname='Children stories published read' and cmd='SELECT'
     and qual like '%is_published%' and qual like '%publish_at%') then
   raise exception 'Published schedule read gate missing';
 end if;
 if not exists (select 1 from pg_policies
   where schemaname='public' and tablename='buklod_children_stories'
     and policyname='Children stories system admin insert' and cmd='INSERT'
     and with_check like '%is_system_admin%') then
   raise exception 'System-admin insert gate missing';
 end if;
 if not exists (select 1 from pg_policies
   where schemaname='public' and tablename='buklod_children_stories'
     and policyname='Children stories system admin update' and cmd='UPDATE'
     and with_check like '%is_system_admin%') then
   raise exception 'System-admin update gate missing';
 end if;
end
$children_stories_rls$;
rollback;
