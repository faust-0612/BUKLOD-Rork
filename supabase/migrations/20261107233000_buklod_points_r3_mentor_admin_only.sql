-- R3 mentoring: System Admin alone validates teaching session (no pastoral gate).
-- Preserve old approved sessions and legacy Pastor controls for historical records.
alter table public.mentor_teaching_sessions
 add column if not exists session_location text;

create or replace function public.report_my_mentor_teaching_with_details_r3(
 p_lesson_id uuid,p_attendee_ids uuid[],p_location text,p_notes text,p_request_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); location_text text:=trim(coalesce(p_location,''));
 result jsonb; v_session_id uuid;
begin
 if actor is null then raise exception 'Authentication required';end if;
 if length(location_text)<4 or length(location_text)>180 then
  raise exception 'Session location of 4-180 characters required';end if;
 result:=public.report_my_mentor_teaching_with_roster_r2(
  p_lesson_id,p_attendee_ids,p_notes,p_request_key);
 v_session_id:=(result->>'session_id')::uuid;
 update public.mentor_teaching_sessions
 set session_location=location_text
 where id=v_session_id and mentor_id=actor and status='reported'
   and session_location is null;
 return result;
end;
$$;
revoke all on function public.report_my_mentor_teaching_with_details_r3(uuid,uuid[],text,text,text) from public,anon;
grant execute on function public.report_my_mentor_teaching_with_details_r3(uuid,uuid[],text,text,text) to authenticated;

create or replace function public.admin_review_mentor_session_r3(
 p_session_id uuid,p_approve boolean,p_admin_note text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); rec record; desc_text text; award_id uuid; award_bp integer;
begin
 if actor is null or not public.is_system_admin() then
  raise exception 'System Admin required' using errcode='42501'; end if;
 if length(trim(coalesce(p_admin_note,'')))<8 then raise exception 'Admin validation note required';end if;
 select s.*,l.title lesson_title,t.formation_program into rec
 from public.mentor_teaching_sessions s
 join public.learning_lessons l on l.id=s.lesson_id
 join public.learning_tracks t on t.id=l.track_id
 where s.id=p_session_id for update of s;
 if not found then raise exception 'Mentor teaching session missing';end if;
 if rec.status not in ('reported','pending_admin') then
  raise exception 'Session already finalized';end if;
 if p_approve then
  if length(trim(coalesce(rec.session_location,'')))<4 then
    raise exception 'Session venue required';end if;
  if rec.participant_count<1 or not exists(
    select 1 from public.mentor_session_attendees a where a.session_id=rec.id
  ) then raise exception 'Registered learners required';end if;
  -- Existing R2 photo guard validates uploaded private image on this status transition.
  update public.mentor_teaching_sessions set status='approved',
   admin_id=actor,admin_reviewed_at=now(),admin_note=trim(p_admin_note)
   where id=p_session_id;
  desc_text:='Mentor teaching verified: '||rec.lesson_title||' at '||rec.session_location;
  perform public.buklod_award_rule_mapped_points_v1(
    rec.mentor_id,'mentor_session','mentor_session:'||rec.id::text,
    rec.id,desc_text,actor);
  select id,points into award_id,award_bp from public.buklod_points_ledger
   where user_id=rec.mentor_id and source_key='mentor_session:'||rec.id::text
   limit 1;
 else
  update public.mentor_teaching_sessions set status='rejected',
   admin_id=actor,admin_reviewed_at=now(),admin_note=trim(p_admin_note)
   where id=p_session_id;
 end if;
 return jsonb_build_object('status',case when p_approve then 'approved' else 'rejected' end,
  'points',coalesce(award_bp,0),'ledger_id',award_id);
end;
$$;
revoke all on function public.admin_review_mentor_session_r3(uuid,boolean,text) from public,anon;
grant execute on function public.admin_review_mentor_session_r3(uuid,boolean,text) to authenticated;
