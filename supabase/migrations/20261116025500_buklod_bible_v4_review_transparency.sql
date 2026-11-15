-- Bible Quiz V4: optional review transparency endpoint.
-- Read-only: does not replace the daily-question selection RPC, grader, or points ledger.
-- Security: only the authenticated owner and only after submission may read a saved answer.
create or replace function public.get_my_buklod_bible_quiz_v4_review_details(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid();
 a record;
 v_review jsonb;
begin
 if actor is null then raise exception 'Authentication required' using errcode='28000';end if;
 select x.state,x.review_items,x.submitted_answers
 into a
 from private.buklod_bible_v4_attempts x
 where x.id=p_attempt_id and x.user_id=actor;
 if not found then raise exception 'Quiz attempt unavailable' using errcode='42501';end if;
 if a.state='started' then return jsonb_build_object('review',null);end if;
 select coalesce(jsonb_agg(
   j.review || jsonb_build_object(
    'question',coalesce(q.prompt,''),
    'submitted_answer',a.submitted_answers -> (j.review->>'id')
   ) order by j.ordinal),'[]'::jsonb)
 into v_review
 from jsonb_array_elements(coalesce(a.review_items,'[]'::jsonb))
  with ordinality as j(review,ordinal)
 left join private.buklod_bible_v4_questions q on q.id=j.review->>'id';
 return jsonb_build_object('review',v_review);
end;
$$;
revoke all on function public.get_my_buklod_bible_quiz_v4_review_details(uuid) from public,anon;
grant execute on function public.get_my_buklod_bible_quiz_v4_review_details(uuid) to authenticated;
