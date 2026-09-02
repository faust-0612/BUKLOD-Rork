-- ============================================================================
-- BUKLOD DAILY BIBLE - WEEKLY UI SUPPORT
-- Migration 141
-- ============================================================================

create or replace function public.admin_upsert_daily_bible_assignment(
  p_reading_date date,
  p_bible_reference text,
  p_instruction_fil text default null,
  p_instruction_en text default null,
  p_question_fil text default null,
  p_question_en text default null,
  p_reward_amount numeric default 2,
  p_is_published boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  generated jsonb;
  question_fil text;
  question_en text;
  assignment_id uuid;
  existing_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_system_admin() then
    raise exception 'System administrator access required';
  end if;

  if p_reading_date is null then
    raise exception 'Reading date is required';
  end if;

  if nullif(trim(coalesce(p_bible_reference,'')),'') is null then
    raise exception 'Bible chapter/reference is required';
  end if;

  if p_reward_amount is null or p_reward_amount < 0 then
    raise exception 'Reward amount must be zero or greater';
  end if;

  select id into existing_id
  from public.daily_bible_assignments
  where reading_date = p_reading_date
  limit 1;

  if existing_id is not null and exists (
    select 1
    from public.daily_bible_submissions s
    where s.assignment_id = existing_id
  ) then
    raise exception 'This reading can no longer be edited because submissions already exist';
  end if;

  generated := public.generate_bible_reflection_questions(p_bible_reference);

  question_fil := coalesce(
    nullif(trim(coalesce(p_question_fil,'')),''),
    generated ->> 'fil'
  );

  question_en := coalesce(
    nullif(trim(coalesce(p_question_en,'')),''),
    generated ->> 'en'
  );

  insert into public.daily_bible_assignments (
    reading_date,
    bible_reference,
    instruction_fil,
    instruction_en,
    reflection_question_fil,
    reflection_question_en,
    reward_amount,
    is_published,
    created_by
  )
  values (
    p_reading_date,
    trim(p_bible_reference),
    nullif(trim(coalesce(p_instruction_fil,'')),''),
    nullif(trim(coalesce(p_instruction_en,'')),''),
    question_fil,
    question_en,
    p_reward_amount,
    coalesce(p_is_published,true),
    actor
  )
  on conflict (reading_date)
  do update set
    bible_reference = excluded.bible_reference,
    instruction_fil = excluded.instruction_fil,
    instruction_en = excluded.instruction_en,
    reflection_question_fil = excluded.reflection_question_fil,
    reflection_question_en = excluded.reflection_question_en,
    reward_amount = excluded.reward_amount,
    is_published = excluded.is_published,
    updated_at = now()
  returning id into assignment_id;

  insert into public.daily_bible_assignment_members (assignment_id, user_id)
  select assignment_id, p.id
  from public.profiles p
  where p.is_active = true
  on conflict do nothing;

  return assignment_id;
end;
$$;

revoke all on function public.admin_upsert_daily_bible_assignment(
  date,text,text,text,text,text,numeric,boolean
) from public;

grant execute on function public.admin_upsert_daily_bible_assignment(
  date,text,text,text,text,text,numeric,boolean
) to authenticated;
