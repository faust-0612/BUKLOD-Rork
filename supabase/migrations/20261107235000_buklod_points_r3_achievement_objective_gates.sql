-- Evidence-first milestones: approved accomplishments require objective thresholds where possible.
-- Rejected nominations can be amended and resubmitted once; approved records never re-award.
create or replace function public.submit_my_buklod_r2_achievement_v1(
 p_activity_type text,p_evidence_note text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); kind text:=lower(trim(coalesce(p_activity_type,'')));
 proof text:=trim(coalesce(p_evidence_note,''));rec record;
begin
 if actor is null then raise exception 'Authentication required';end if;
 if kind not in ('achievement_bible_scholar','achievement_community_builder',
 'achievement_faithful_mentor','achievement_kingdom_champion',
 'verified_volunteer_service','ministry_major_milestone','game_tournament_champion') then
  raise exception 'Unknown milestone';
 end if;
 if length(proof)<60 or length(proof)>2000 then
  raise exception 'Describe verifiable evidence, date, venue and participants (60-2000 chars)';
 end if;
 insert into public.buklod_r2_achievement_nominations(user_id,activity_type,evidence_note)
 values(actor,kind,proof)
 on conflict(user_id,activity_type) do update
 set evidence_note=excluded.evidence_note,status='pending',submitted_at=now(),
 reviewed_at=null,reviewed_by=null,review_note=null,ledger_id=null
 where public.buklod_r2_achievement_nominations.status='rejected';
 select id,status into rec from public.buklod_r2_achievement_nominations
 where user_id=actor and activity_type=kind;
 return jsonb_build_object('id',rec.id,'status',rec.status);
end;
$$;
revoke all on function public.submit_my_buklod_r2_achievement_v1(text,text) from public,anon;
grant execute on function public.submit_my_buklod_r2_achievement_v1(text,text) to authenticated;

create or replace function public.admin_review_buklod_r2_achievement_v1(
 p_nomination_id uuid,p_approve boolean,p_note text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); row_rec record;awarded jsonb; evidence_count integer;
begin
 if actor is null or not public.is_system_admin() then
  raise exception 'System Admin required' using errcode='42501';end if;
 if length(trim(coalesce(p_note,'')))<12 then raise exception 'Verification reason (12+ chars) required';end if;
 select * into row_rec from public.buklod_r2_achievement_nominations
 where id=p_nomination_id for update;
 if not found then raise exception 'Nomination not found';end if;
 if row_rec.status<>'pending' then raise exception 'Already reviewed';end if;
 if p_approve then
  case row_rec.activity_type
   when 'achievement_bible_scholar' then
    select count(distinct p.lesson_id) into evidence_count
    from public.buklod_abc_growth_progress p
    where p.user_id=row_rec.user_id and p.completed_at is not null;
    if evidence_count<28 then raise exception 'Bible Scholar requires 28 completed ABC lessons (currently %)',evidence_count;end if;
   when 'achievement_faithful_mentor' then
    select count(*) into evidence_count
    from public.mentor_teaching_sessions s
    where s.mentor_id=row_rec.user_id and s.status='approved';
    if evidence_count<4 then raise exception 'Faithful Mentor requires 4 approved mentoring sessions (currently %)',evidence_count;end if;
   when 'achievement_kingdom_champion' then
    select count(*) into evidence_count
    from private.buklod_kingdom_level_progress_v1 g
    where g.user_id=row_rec.user_id and g.first_cleared_at is not null;
    if evidence_count<20 then raise exception 'Kingdom Champion requires 20 recorded level clears (currently %)',evidence_count;end if;
   else
    -- Service/ministries/tournament categories require manual independent verification.
    -- Admin notes and evidence remain stored permanently.
    null;
  end case;
  awarded:=public.admin_award_buklod_r2_accomplishment_v1(
   row_rec.user_id,row_rec.activity_type,'lifetime',row_rec.evidence_note,'easy');
  update public.buklod_r2_achievement_nominations
  set status='approved',reviewed_by=actor,reviewed_at=now(),review_note=trim(p_note),
   ledger_id=(awarded->>'ledger_id')::uuid where id=p_nomination_id;
 else
  update public.buklod_r2_achievement_nominations
  set status='rejected',reviewed_by=actor,reviewed_at=now(),review_note=trim(p_note)
  where id=p_nomination_id;
 end if;
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,
  'ledger_id',awarded->>'ledger_id');
end;
$$;
revoke all on function public.admin_review_buklod_r2_achievement_v1(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_buklod_r2_achievement_v1(uuid,boolean,text) to authenticated;
