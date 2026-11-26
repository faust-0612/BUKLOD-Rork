-- Additive wrapper; preserve verified v2 report and authorization.
create or replace function public.buklod_scope_faith_monitoring_period_v3(p_scope_id uuid,p_period text,p_anchor_date date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare r jsonb; members jsonb; scopes uuid[]; d1 date; d2 date;
begin
 r:=public.buklod_scope_faith_monitoring_period_v2(p_scope_id,p_period,p_anchor_date);
 d1:=(r->>'start_date')::date; d2:=(r->>'as_of_date')::date;
 select array_agg(s.id) into scopes from public.buklod_scopes s where s.id=p_scope_id or
 (s.scope_type='CLUSTER' and s.status not in ('SUSPENDED','DELETED') and coalesce(s.organization_id,s.parent_scope_id)=p_scope_id
 and exists(select 1 from public.buklod_scopes parent where parent.id=p_scope_id and parent.scope_type='ORGANIZATION'));
 select coalesce(jsonb_agg(item||jsonb_build_object('children_teaching_count',(
 select count(distinct t.id) from private.buklod_children_teaching_sessions t
 where t.user_id=(item->>'user_id')::uuid and t.scope_id=any(scopes)
 and t.session_date between d1 and d2 and exists(select 1 from public.buklod_scope_memberships m
 where m.user_id=t.user_id and m.scope_id=t.scope_id and m.membership_status='ACTIVE'
 and (coalesce(m.joined_at,m.created_at) at time zone 'Asia/Manila')::date<=t.session_date)
 )) order by lower(item->>'member_name'),item->>'user_id'),'[]'::jsonb)
 into members from jsonb_array_elements(r->'members') item;
 return r||jsonb_build_object('members',members,'accomplishment_report_version',3);
end;
$fn$;
revoke all on function public.buklod_scope_faith_monitoring_period_v3(uuid,text,date) from public,anon;
grant execute on function public.buklod_scope_faith_monitoring_period_v3(uuid,text,date) to authenticated;
notify pgrst,'reload schema';
