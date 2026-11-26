-- Reconcile only the reviewed Nehemiah enum question after the fair-grading migration.
-- Idempotent: regrades only attempts whose recorded earned_units are below their
-- verified new units. Pending essays receive NO credit until human review.
-- Completed attempts receive at most a bounded, uniquely sourced points delta.
do $regrade$
declare
 a record;
 q_spec jsonb;
 v_old integer;
 v_new integer;
 v_updated_review jsonb;
 v_score integer;
 v_rule record;
 v_desired integer;
 v_bonus integer;
 v_inserted uuid;
begin
 select answer_spec into q_spec from private.buklod_bible_v4_questions
 where id='v4_h_n05' and kind='enumeration' and reviewed;
 if q_spec is null then raise exception 'Reviewed Nehemiah bank required';end if;

 for a in
  select * from private.buklod_bible_v4_attempts
  where state in ('completed','pending_review')
    and submitted_answers ? 'v4_h_n05'
    and jsonb_typeof(submitted_answers->'v4_h_n05')='array'
  for update
 loop
  if jsonb_array_length(a.submitted_answers->'v4_h_n05')<>2 then continue;end if;
  select (r->>'earned_units')::integer into v_old
  from jsonb_array_elements(coalesce(a.review_items,'[]'::jsonb)) r
  where r->>'id'='v4_h_n05' and r->>'kind'='enumeration';
  if v_old is null or v_old not between 0 and 2 then continue;end if;

  select least(count(*)::integer,2) into v_new
  from jsonb_array_elements(q_spec->'groups') g(accepted_group)
  where exists (
   select 1
   from jsonb_array_elements_text(a.submitted_answers->'v4_h_n05') submitted(answer)
   cross join lateral private.buklod_bible_v4_enum_parts(submitted.answer) candidate(normalized)
   join lateral jsonb_array_elements_text(g.accepted_group) accepted(answer)
     on candidate.normalized=private.buklod_bible_v4_enum_normalize(accepted.answer)
  );
  if v_new<=v_old then continue;end if;

  select jsonb_agg(
    case when j.item->>'id'='v4_h_n05'
      then jsonb_set(j.item,'{earned_units}',to_jsonb(v_new))
      else j.item end order by j.ordinal)
  into v_updated_review
  from jsonb_array_elements(a.review_items) with ordinality j(item,ordinal);

  if a.state='pending_review' then
    update private.buklod_bible_v4_attempts
    set review_items=v_updated_review where id=a.id;
    continue;
  end if;

  if a.score_units is null or a.score_units not between 0 and 10 then
    raise exception 'Completed quiz has invalid score: %',a.id;
  end if;
  v_score:=least(a.score_units+v_new-v_old,10);
  v_bonus:=0;
  v_inserted:=null;

  -- Only compensate users with a verifiably linked original points credit.
  if a.ledger_id is not null and exists(
    select 1 from public.buklod_points_ledger l
    where l.id=a.ledger_id and l.user_id=a.user_id
      and l.direction='credit' and l.points=a.points_awarded
      and l.activity_type='bible_quiz_'||a.difficulty
  ) then
    v_desired:=private.buklod_bible_v4_points(a.difficulty,v_score);
    select r.base_points,r.max_points_per_event,r.is_active into v_rule
    from public.buklod_point_rules r
    where r.activity_type='bible_quiz_'||a.difficulty;
    if not found or coalesce(v_rule.is_active,false)=false then
      v_desired:=0;
    else
      v_desired:=least(v_desired,v_rule.base_points,
        coalesce(v_rule.max_points_per_event,12),12);
    end if;
    v_bonus:=greatest(v_desired-coalesce(a.points_awarded,0),0);
    if v_bonus>0 then
      insert into public.buklod_points_ledger
        (user_id,direction,points,activity_type,source_key,description,awarded_by)
      values (a.user_id,'credit',v_bonus,'bible_quiz_'||a.difficulty,
        'bible_quiz:v4:verified-grade-fix:20261118:'||a.id::text,
        'Verified correction to Bible Quiz V4 review',a.user_id)
      on conflict (user_id,source_key) do nothing returning id into v_inserted;
      if v_inserted is null then v_bonus:=0;end if;
    end if;
  end if;

  update private.buklod_bible_v4_attempts
  set review_items=v_updated_review,
      score_units=v_score,
      points_awarded=coalesce(a.points_awarded,0)+v_bonus
  where id=a.id;
 end loop;
end;
$regrade$;
