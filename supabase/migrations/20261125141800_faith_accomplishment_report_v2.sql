-- Additive report only: v1 remains authoritative for scope authorization and daily habit metrics.
-- No writes to completion, rewards, or private learner content.
create or replace function public.buklod_scope_faith_monitoring_period_v2(
 p_scope_id uuid,p_period text,p_anchor_date date default null
) returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare
 v_report jsonb;
 v_start date;
 v_end date;
 v_start_ts timestamptz;
 v_end_ts timestamptz;
 v_scopes uuid[];
 v_members jsonb;
 v_saliksik jsonb;
 v_has_saliksik boolean;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Reuse the exact-scope, leadership-only authorization and period bounds.
 v_report := public.buklod_scope_faith_monitoring_period_v1(p_scope_id,p_period,p_anchor_date);
 v_start := (v_report->>'start_date')::date;
 v_end := (v_report->>'as_of_date')::date;
 v_start_ts := v_start::timestamp at time zone 'Asia/Manila';
 v_end_ts := (v_end+1)::timestamp at time zone 'Asia/Manila';
 select array_agg(s.id) into v_scopes from public.buklod_scopes s
 where s.id=p_scope_id or (s.scope_type='CLUSTER'
 and s.status not in ('SUSPENDED','DELETED')
 and coalesce(s.organization_id,s.parent_scope_id)=p_scope_id
 and exists(select 1 from public.buklod_scopes parent where parent.id=p_scope_id and parent.scope_type='ORGANIZATION'));
 -- Global personal activities are labeled as member accomplishments during membership,
 -- not falsely described as scope-attributed submissions.
 with members as (
  select item,(item->>'user_id')::uuid uid
  from jsonb_array_elements(v_report->'members') item
 ), membership as (
  select m.user_id,m.scope_id,coalesce(m.joined_at,m.created_at) joined_at
  from public.buklod_scope_memberships m
  join members u on u.uid=m.user_id
  where m.scope_id=any(v_scopes) and m.membership_status='ACTIVE'
 ), abc as (
  select p.user_id,count(distinct p.lesson_id) n from public.buklod_abc_growth_progress p
  where p.completed_at>=v_start_ts and p.completed_at<v_end_ts
  and exists(select 1 from membership m where m.user_id=p.user_id and p.completed_at>=m.joined_at)
  group by p.user_id
 ), bible as (
  select p.user_id,count(distinct (p.book_no,p.chapter_no)) n from public.bible_reading_sessions p
  where p.completed_at>=v_start_ts and p.completed_at<v_end_ts and p.source in ('free_reading','search_reading')
  and exists(select 1 from membership m where m.user_id=p.user_id and p.completed_at>=m.joined_at)
  group by p.user_id
 ), mentoring as (
  -- Require an approved session and a roster member sharing an authorized scope.
  -- One group session counts once; only in-scope distinct mentees are counted.
  select distinct s.id,s.mentor_id,a.user_id mentee_id
  from public.mentor_teaching_sessions s join public.mentor_session_attendees a on a.session_id=s.id
  where lower(s.status)='approved' and s.session_date between v_start and v_end
  and a.user_id<>s.mentor_id
  and exists(select 1 from membership m join membership t on t.scope_id=m.scope_id
    where m.user_id=s.mentor_id and t.user_id=a.user_id
    and s.session_date >= (m.joined_at at time zone 'Asia/Manila')::date
    and s.session_date >= (t.joined_at at time zone 'Asia/Manila')::date)
 ), mentors as (
  select mentor_id,count(distinct id) n,count(distinct mentee_id) reached from mentoring group by mentor_id
 ), mentees as (
  select mentee_id,count(distinct id) n from mentoring group by mentee_id
 )
 select coalesce(jsonb_agg(u.item || jsonb_build_object(
 'abaka_completed_count',coalesce(a.n,0),
 'bible_chapter_count',coalesce(b.n,0),
 'mentor_session_count',coalesce(m.n,0),
 'mentee_session_count',coalesce(t.n,0),
 'mentees_reached_count',coalesce(m.reached,0),
 'children_story_count',null,'children_teaching_count',null,'saliksik_completed_count',null
 ) order by lower(u.item->>'member_name'),u.uid),'[]'::jsonb)
 into v_members from members u left join abc a on a.user_id=u.uid
 left join bible b on b.user_id=u.uid left join mentors m on m.mentor_id=u.uid
 left join mentees t on t.mentee_id=u.uid;
 -- SALIKSIK can be rolled out independently. Never turn a missing source into zero.
 v_has_saliksik := to_regclass('public.saliksik_mastery') is not null
 and to_regclass('public.saliksik_attempts') is not null
 and to_regclass('public.saliksik_master_submissions') is not null;
 if v_has_saliksik then
  execute $q$
   select coalesce(jsonb_object_agg(user_id,n),'{}'::jsonb)
   from (
    select m.user_id,count(distinct (m.investigation_id,m.version)) n
    from public.saliksik_mastery m
    where m.passed_at >= $1 and m.passed_at < $2
    and exists(select 1 from public.buklod_scope_memberships sm
      where sm.user_id=m.user_id and sm.scope_id=any($3) and sm.membership_status='ACTIVE'
      and m.passed_at>=coalesce(sm.joined_at,sm.created_at)
      and (exists(select 1 from public.saliksik_attempts a where a.user_id=m.user_id
        and a.investigation_id=m.investigation_id and a.scope_id=sm.scope_id
        and a.passed=true and a.submitted_at=m.passed_at)
       or exists(select 1 from public.saliksik_master_submissions a where a.user_id=m.user_id
        and a.investigation_id=m.investigation_id and a.version=m.version
        and a.scope_id=sm.scope_id and a.status='approved' and a.reviewed_at=m.passed_at)))
    group by m.user_id
   ) counts
  $q$ into v_saliksik using v_start_ts,v_end_ts,v_scopes;
  select coalesce(jsonb_agg(item || jsonb_build_object('saliksik_completed_count',
    coalesce((v_saliksik->>(item->>'user_id'))::bigint,0)) order by lower(item->>'member_name'),item->>'user_id'),'[]'::jsonb)
  into v_members from jsonb_array_elements(v_members) item;
 end if;
 return v_report || jsonb_build_object('members',v_members,'accomplishment_report_version',2);
end;
$fn$;
revoke all on function public.buklod_scope_faith_monitoring_period_v2(uuid,text,date) from public,anon;
grant execute on function public.buklod_scope_faith_monitoring_period_v2(uuid,text,date) to authenticated;
notify pgrst,'reload schema';
