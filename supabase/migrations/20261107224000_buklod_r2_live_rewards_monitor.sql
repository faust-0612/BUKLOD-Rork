-- Canonical 30-day analytics classification. Unmatched ledger events remain 'other'.
create or replace function private.buklod_r2_focus_classify_v1(p_type text)
returns text language sql immutable set search_path=''
as $$
 select case
 when p_type in (
   'community_post','community_comment','community_reaction','community_poll_vote',
   'community_dugtong','community_chain_resolve','community_challenge_complete',
   'community_helpful_dugtong','community_takeaway_share','prayer_response',
   'r36_publish_wall','r36_publish_reel','r36_engager_reaction',
   'r36_engager_comment','r36_engager_reply','r36_creator_impact',
   'r36_publish_reel','event_attendance','scope_attendance',
   'verified_cluster_attendance','weekly_consistency') then 'participation'
 when p_type in (
   'daily_bible','daily_bible_verification','devotional','abc_growth_lesson',
   'formation_lesson','formation_assessment','formation_module',
   'learning_progress_verification','stage_completion','reflection_quality_bonus',
   'daily_devotional_reflection','daily_bible_reading',
   'bible_quiz_easy','bible_quiz_medium','bible_quiz_hard',
   'bible_weekly_streak','consistency_30_day') then 'learning'
 when p_type in (
   'mentor_session','mentoring_release','ministry_activity',
   'verified_mentoring_session','verified_volunteer_service',
   'ministry_major_milestone','achievement_bible_scholar',
   'achievement_community_builder','achievement_faithful_mentor',
   'achievement_kingdom_champion') then 'impact'
 else 'other' end
$$;
revoke all on function private.buklod_r2_focus_classify_v1(text) from public,anon,authenticated;

-- Explicitly activated only for evidence-reviewed, admin-approved accomplishments.
-- User submissions NEVER mint points directly. One nomination per user/achievement.
update public.buklod_point_rules
set is_active=true,
    daily_cap_points=base_points,
    weekly_cap_points=base_points,
    notes='R2 evidence nomination, reviewed by System Admin, one-time source key',
    updated_at=now()
where activity_type in (
 'achievement_bible_scholar','achievement_community_builder',
 'achievement_faithful_mentor','achievement_kingdom_champion',
 'verified_volunteer_service','ministry_major_milestone',
 'game_tournament_champion');

-- R2 live monitoring and evidence-reviewed milestone nominations.
-- Monitor uses canonical ledger credits, not claimed balance or assumed percentages.
create table if not exists public.buklod_r2_achievement_nominations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 activity_type text not null,
 evidence_note text not null,
 status text not null default 'pending'
  check(status in ('pending','approved','rejected')),
 submitted_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.profiles(id),
 review_note text,
 ledger_id uuid references public.buklod_points_ledger(id),
 unique(user_id,activity_type)
);
create index if not exists buklod_r2_nomination_status_idx
on public.buklod_r2_achievement_nominations(status,submitted_at desc);
alter table public.buklod_r2_achievement_nominations enable row level security;
revoke all on public.buklod_r2_achievement_nominations from public,anon,authenticated;

create or replace function public.submit_my_buklod_r2_achievement_v1(
 p_activity_type text,p_evidence_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); kind text:=lower(trim(coalesce(p_activity_type,'')));
 proof text:=trim(coalesce(p_evidence_note,'')); record_id uuid; existing_status text;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if kind not in ('achievement_bible_scholar','achievement_community_builder',
 'achievement_faithful_mentor','achievement_kingdom_champion',
 'verified_volunteer_service','ministry_major_milestone',
 'game_tournament_champion') then
   raise exception 'Unknown milestone';
 end if;
 if length(proof)<60 or length(proof)>2000 then
   raise exception 'Describe evidence in 60-2000 characters';
 end if;
 insert into public.buklod_r2_achievement_nominations(user_id,activity_type,evidence_note)
 values(actor,kind,proof)
 on conflict(user_id,activity_type) do nothing returning id into record_id;
 if record_id is null then
   select n.id,n.status into record_id,existing_status
   from public.buklod_r2_achievement_nominations n
   where n.user_id=actor and n.activity_type=kind;
 end if;
 return jsonb_build_object('id',record_id,'status',coalesce(existing_status,'pending'));
end;
$$;
revoke all on function public.submit_my_buklod_r2_achievement_v1(text,text) from public,anon;
grant execute on function public.submit_my_buklod_r2_achievement_v1(text,text) to authenticated;

create or replace function public.admin_review_buklod_r2_achievement_v1(
 p_nomination_id uuid,p_approve boolean,p_note text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); row_rec record; award jsonb;
begin
 if actor is null or not public.is_system_admin() then
   raise exception 'System Admin required' using errcode='42501';
 end if;
 select * into row_rec from public.buklod_r2_achievement_nominations
 where id=p_nomination_id for update;
 if not found then raise exception 'Nomination not found'; end if;
 if row_rec.status<>'pending' then raise exception 'Already reviewed'; end if;
 if length(trim(coalesce(p_note,'')))<12 then
   raise exception 'Review reason required (12+ characters)';
 end if;
 if p_approve then
   award:=public.admin_award_buklod_r2_accomplishment_v1(
     row_rec.user_id,row_rec.activity_type,
     'lifetime',row_rec.evidence_note,'easy');
   update public.buklod_r2_achievement_nominations
   set status='approved',reviewed_by=actor,reviewed_at=now(),review_note=trim(p_note),
       ledger_id=(award->>'ledger_id')::uuid
   where id=p_nomination_id;
 else
   update public.buklod_r2_achievement_nominations
   set status='rejected',reviewed_by=actor,reviewed_at=now(),review_note=trim(p_note)
   where id=p_nomination_id;
 end if;
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,
   'ledger_id',award->>'ledger_id');
end;
$$;
revoke all on function public.admin_review_buklod_r2_achievement_v1(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_buklod_r2_achievement_v1(uuid,boolean,text) to authenticated;

-- Read-only member report: actual earned credits in the last 30 Manila days.
-- 40/35/25 are TARGETS for monitoring, never inferred from actual totals.
create or replace function public.get_my_buklod_r2_focus_monitor_v1()
returns jsonb language sql stable security definer set search_path=''
as $$
with labels as (
 select l.points,l.claim_state,
 private.buklod_r2_focus_classify_v1(l.activity_type) as focus
 from public.buklod_points_ledger l
 where l.user_id=(select auth.uid()) and l.direction='credit'
 and l.created_at>=now()-interval '30 days'
), sums as (
 select coalesce(sum(points),0) total,
 coalesce(sum(points) filter(where focus='participation'),0) participation,
 coalesce(sum(points) filter(where focus='learning'),0) learning,
 coalesce(sum(points) filter(where focus='impact'),0) impact,
 coalesce(sum(points) filter(where focus='other'),0) other,
 coalesce(sum(points) filter(where claim_state='pending'),0) pending
 from labels
)
select jsonb_build_object(
 'period','last_30_days','basis','actual points credited in canonical ledger',
 'total',s.total,'pending',s.pending,
 'target',jsonb_build_object('participation',40,'learning',35,'impact',25),
 'actual_points',jsonb_build_object('participation',s.participation,
  'learning',s.learning,'impact',s.impact,'other',s.other),
 'actual_percent',jsonb_build_object(
  'participation',case when s.total>0 then round(s.participation*100.0/s.total,1) else 0 end,
  'learning',case when s.total>0 then round(s.learning*100.0/s.total,1) else 0 end,
  'impact',case when s.total>0 then round(s.impact*100.0/s.total,1) else 0 end,
  'other',case when s.total>0 then round(s.other*100.0/s.total,1) else 0 end),
 'my_milestones',(select coalesce(jsonb_agg(jsonb_build_object(
   'type',activity_type,'status',status,'submitted_at',submitted_at,'reviewed_at',reviewed_at,
   'review_note',review_note)
  order by submitted_at desc),'[]'::jsonb)
  from public.buklod_r2_achievement_nominations n
  where n.user_id=(select auth.uid()))
) from sums s where (select auth.uid()) is not null;
$$;
revoke all on function public.get_my_buklod_r2_focus_monitor_v1() from public,anon;
grant execute on function public.get_my_buklod_r2_focus_monitor_v1() to authenticated;

create or replace function public.admin_get_buklod_r2_rewards_monitor_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
   raise exception 'System Admin required' using errcode='42501';
 end if;
 select jsonb_build_object(
 'window','last_30_days','as_of',now(),
 'activities',(select coalesce(jsonb_agg(jsonb_build_object(
  'type',coalesce(r.activity_type,e.activity_type),
  'label',coalesce(r.label,replace(e.activity_type,'_',' ')),
  'configured_points',r.base_points,
  'active',r.is_active,'earned_count',coalesce(e.n,0),
  'earned_points',coalesce(e.total,0),
  'source',case when r.activity_type is null then 'ledger_without_current_rule' else 'rule_catalog' end
  ) order by coalesce(r.activity_type,e.activity_type)),'[]'::jsonb)
 from public.buklod_point_rules r
 full outer join (select activity_type,count(*) n,sum(points) total
   from public.buklod_points_ledger where direction='credit'
   and created_at>=now()-interval '30 days' group by activity_type) e
 on e.activity_type=r.activity_type),
 'focus',(select jsonb_build_object(
    'total',coalesce(sum(l.points),0),
    'participation',coalesce(sum(l.points) filter(where private.buklod_r2_focus_classify_v1(l.activity_type)='participation'),0),
    'learning',coalesce(sum(l.points) filter(where private.buklod_r2_focus_classify_v1(l.activity_type)='learning'),0),
    'impact',coalesce(sum(l.points) filter(where private.buklod_r2_focus_classify_v1(l.activity_type)='impact'),0),
    'unclassified',coalesce(sum(l.points) filter(where private.buklod_r2_focus_classify_v1(l.activity_type)='other'),0))
    from public.buklod_points_ledger l where l.direction='credit'
    and l.created_at>=now()-interval '30 days'),
 'nominations',(select jsonb_build_object(
   'pending',count(*) filter(where status='pending'),
   'approved',count(*) filter(where status='approved'),
   'rejected',count(*) filter(where status='rejected'))
   from public.buklod_r2_achievement_nominations),
 'recent_nominations',(select coalesce(jsonb_agg(jsonb_build_object(
   'id',id,'user_id',user_id,'type',activity_type,'status',status,
   'evidence_note',evidence_note,'submitted_at',submitted_at)
    order by submitted_at desc),'[]'::jsonb)
  from (select * from public.buklod_r2_achievement_nominations
   order by submitted_at desc limit 50) n),
 'mentor_photos',(select count(*) from private.buklod_r2_mentor_session_evidence),
 'pending_mentoring_photos',(select count(*) from public.mentor_teaching_sessions s
   where s.status not in ('approved','rejected')
   and s.created_at>=(select effective_at from private.buklod_r2_reward_rollout where key='mentor_photo_required')
   and not exists(select 1 from private.buklod_r2_mentor_session_evidence e
     where e.session_id=s.id))
 ) into result;
 return result;
end;
$$;
revoke all on function public.admin_get_buklod_r2_rewards_monitor_v1() from public,anon;
grant execute on function public.admin_get_buklod_r2_rewards_monitor_v1() to authenticated;
