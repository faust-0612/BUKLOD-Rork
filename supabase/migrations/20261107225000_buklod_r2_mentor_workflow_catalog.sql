-- Mentor-owned reportable lesson catalog; follows existing formation and mentor permission logic.
create or replace function public.get_my_mentor_reportable_lessons_r2()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); answer jsonb;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if not public.has_capability(actor,'mentor') then
   return '[]'::jsonb;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'title',l.title)
   order by l.title),'[]'::jsonb) into answer
 from public.learning_lessons l
 join public.learning_tracks t on t.id=l.track_id
 where t.formation_program in ('ccp','discipleship');
 return answer;
end;
$$;
revoke all on function public.get_my_mentor_reportable_lessons_r2() from public,anon;
grant execute on function public.get_my_mentor_reportable_lessons_r2() to authenticated;

-- Admin evidence monitor, separate read-only RPC with authorized photo path.
create or replace function public.admin_get_buklod_r2_mentor_evidence_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
   raise exception 'System Admin required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'session_id',s.id,'lesson',l.title,'status',s.status,'mentor_id',s.mentor_id,
   'session_date',s.session_date,'participant_count',s.participant_count,
   'photo_path',e.photo_path,'submitted_at',e.submitted_at)
   order by s.created_at desc),'[]'::jsonb) into result
 from (select * from public.mentor_teaching_sessions
       where created_at>=now()-interval '90 days'
       order by created_at desc limit 100) s
 join public.learning_lessons l on l.id=s.lesson_id
 left join private.buklod_r2_mentor_session_evidence e on e.session_id=s.id;
 return result;
end;
$$;
revoke all on function public.admin_get_buklod_r2_mentor_evidence_v1() from public,anon;
grant execute on function public.admin_get_buklod_r2_mentor_evidence_v1() to authenticated;
