-- BUKLOD Public Wall scope attribution – non-destructive contract assertions.
-- Run with local migration history. No existing public/scope posts are modified.
begin;
do $test$
declare
 v_rls boolean;
 v_public boolean;
 v_count integer;
begin
 select relrowsecurity into v_rls
 from pg_class where oid='public.buklod_public_wall_scope_identity'::regclass;
 if not coalesce(v_rls,false) then raise exception 'Scope identity table RLS disabled'; end if;

 if has_table_privilege('anon','public.buklod_public_wall_scope_identity','SELECT')
    or has_table_privilege('authenticated','public.buklod_public_wall_scope_identity','SELECT')
    or has_table_privilege('authenticated','public.buklod_public_wall_scope_identity','INSERT') then
   raise exception 'Scoped author attribution table must not be directly exposed';
 end if;

 if has_function_privilege('anon','public.create_buklod_public_wall_scope_post_v1(uuid,text,text,text,text,bigint,uuid[],numeric,boolean)','EXECUTE')
    or not has_function_privilege('authenticated','public.create_buklod_public_wall_scope_post_v1(uuid,text,text,text,text,bigint,uuid[],numeric,boolean)','EXECUTE')
    or has_function_privilege('anon','public.get_buklod_public_wall_scope_identities_v1(uuid[])','EXECUTE')
    or not has_function_privilege('authenticated','public.get_buklod_public_wall_scope_identities_v1(uuid[])','EXECUTE') then
   raise exception 'Scoped Public Wall RPC grants changed';
 end if;

 select count(*) into v_count from pg_policies
 where schemaname='public' and tablename='buklod_public_wall_scope_identity';
 if v_count<>0 then
   raise exception 'Direct RLS policies may expose attribution outside visibility-checked RPC';
 end if;

 select exists (
  select 1 from pg_proc where oid='public.create_buklod_public_wall_scope_post_v1(uuid,text,text,text,text,bigint,uuid[],numeric,boolean)'::regprocedure
 ) into v_public;
 if not v_public then raise exception 'Public Wall atomic post RPC missing'; end if;

 if position('public.create_buklod_community_post_v3(' in
    pg_get_functiondef('public.create_buklod_public_wall_scope_post_v1(uuid,text,text,text,text,bigint,uuid[],numeric,boolean)'::regprocedure))=0
 then raise exception 'Existing Public Wall create validation was bypassed'; end if;

 if position('m.membership_status = ''ACTIVE''' in
    pg_get_functiondef('public.create_buklod_public_wall_scope_post_v1(uuid,text,text,text,text,bigint,uuid[],numeric,boolean)'::regprocedure))=0
 then raise exception 'Membership guard removed'; end if;

 if position('public.buklod_is_scope_admin(p_scope_id)' in
    pg_get_functiondef('public.create_buklod_public_wall_scope_post_v1(uuid,text,text,text,text,bigint,uuid[],numeric,boolean)'::regprocedure))=0
 then raise exception 'Server-signed admin visibility missing'; end if;
end $test$;
rollback;
