-- System Admin-only review queue; essays are not automatically graded or credited.
create or replace function public.admin_list_buklod_bible_v4_pending()
returns jsonb language plpgsql security definer set search_path='' as $$
declare entries jsonb;
begin
 if auth.uid() is null or not public.buklod_is_system_admin() then
  raise exception 'System Admin only' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'attempt_id',a.id,'date',a.local_date,'difficulty',a.difficulty,
   'essay_question',q.prompt,'reference',q.scripture_reference,
   'rubric',q.rationale,'essay_answer',a.submitted_answers->>q.id,
   'submitted_at',a.submitted_at) order by a.submitted_at asc),'[]'::jsonb)
 into entries
 from private.buklod_bible_v4_attempts a
 join private.buklod_bible_v4_questions q on q.id=any(a.question_keys) and q.kind='essay'
 where a.state='pending_review';
 return jsonb_build_object('pending',entries);
end;$$;
revoke all on function public.admin_list_buklod_bible_v4_pending() from public,anon;
grant execute on function public.admin_list_buklod_bible_v4_pending() to authenticated;
