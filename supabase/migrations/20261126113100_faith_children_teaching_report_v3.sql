-- Additive wrapper; preserve verified v2 report and authorization.
create or replace function public.buklod_scope_faith_monitoring_period_v3(p_scope_id uuid,p_period text,p_anchor_date date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare r jsonb; members jsonb; scopes uuid[]; d1 date; d2 date; v_enabled boolean; active_count bigint;
begin
 r:=public.buklod_scope_faith_monitoring_period_v2(p_scope_id,p_period,p_anchor_date);
 select exists(select 1 from private.buklod_children_teaching_rollout where id and enabled) into v_enabled;
 d1:=(r->>'start_date')::date; d2:=(r->>'as_of_date')::date;
 select array_agg(s.id) into scopes from public.buklod_scopes s where s.id=p_scope_id or
 (s.scope_type='CLUSTER' and s.status not in ('SUSPENDED','DELETED') and coalesce(s.organization_id,s.parent_scope_id)=p_scope_id
 and exists(select 1 from public.buklod_scopes parent where parent.id=p_scope_id and parent.scope_type='ORGANIZATION'));
 select coalesce(jsonb_agg(item||jsonb_build_object('children_teaching_count',(
 select case when count(distinct t.id)>0 or v_enabled then count(distinct t.id) else null end from private.buklod_children_teaching_sessions t
 where t.user_id=(item->>'user_id')::uuid and t.scope_id=any(scopes)
 and t.session_date between d1 and d2 and exists(select 1 from public.buklod_scope_memberships m
 where m.user_id=t.user_id and m.scope_id=t.scope_id and m.membership_status='ACTIVE'
 and (coalesce(m.joined_at,m.created_at) at time zone 'Asia/Manila')::date<=t.session_date)
 )) order by lower(item->>'member_name'),item->>'user_id'),'[]'::jsonb)
 into members from jsonb_array_elements(r->'members') item;
 select count(*) filter(where coalesce((item->>'reading_submitted_days')::integer,0)>0
   or coalesce((item->>'devotion_submitted_days')::integer,0)>0
   or coalesce((item->>'lesson_approved_count')::integer,0)>0
   or coalesce((item->>'lesson_pending_count')::integer,0)>0
   or coalesce((item->>'abaka_completed_count')::integer,0)>0
   or coalesce((item->>'saliksik_completed_count')::integer,0)>0
   or coalesce((item->>'children_story_count')::integer,0)>0
   or coalesce((item->>'bible_chapter_count')::integer,0)>0
   or coalesce((item->>'kl_chapter_count')::integer,0)>0
   or coalesce((item->>'mentor_session_count')::integer,0)>0
   or coalesce((item->>'mentee_session_count')::integer,0)>0
   or coalesce((item->>'children_teaching_count')::integer,0)>0)
 into active_count from jsonb_array_elements(members) item;
 return r||jsonb_build_object('members',members,'totals',(r->'totals')||jsonb_build_object('members_with_activity',active_count),'accomplishment_report_version',3);
end;
$fn$;
revoke all on function public.buklod_scope_faith_monitoring_period_v3(uuid,text,date) from public,anon;
grant execute on function public.buklod_scope_faith_monitoring_period_v3(uuid,text,date) to authenticated;
notify pgrst,'reload schema';
