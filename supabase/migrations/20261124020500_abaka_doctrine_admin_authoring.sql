-- ABaKa Admin Studio: role-checked draft authoring and reviewed publication.
-- Staging-only until database, RLS, mobile and claim flow are verified.
-- Depends on 20261124005500_abaka_continuing_doctrine_rewards.sql.
alter table public.buklod_abc_doctrinal_lessons
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists review_note text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists content_version integer not null default 1;

create sequence if not exists private.buklod_abc_doctrine_id_seq start with 5;
revoke all on sequence private.buklod_abc_doctrine_id_seq from public, anon, authenticated;

create table if not exists private.buklod_abc_doctrine_publication_audit (
  id bigint generated always as identity primary key,
  lesson_id text not null references public.buklod_abc_doctrinal_lessons(lesson_id),
  action text not null check (action in ('publish','unpublish')),
  actor_id uuid not null references public.profiles(id),
  note text not null check (char_length(note) between 30 and 2000),
  at timestamptz not null default now()
);
revoke all on private.buklod_abc_doctrine_publication_audit from public, anon, authenticated;

-- Drafts and answer keys never become readable by a public SELECT/RLS policy.
create or replace function public.buklod_abc_doctrine_admin_list_v1()
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare result_rows jsonb;
begin
  if (select auth.uid()) is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin only' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(
      to_jsonb(d) || jsonb_build_object('correct_option',a.correct_option)
      order by d.updated_at desc, d.lesson_id desc
    ),'[]'::jsonb)
  into result_rows
  from (
    select lesson_id,series_key,series_title,position,code,title,difficulty,
           prerequisite_id,body_blocks,assessment_prompt,assessment_options,
           published,published_at,created_at,updated_at,review_note,content_version,
           (published or exists(select 1 from private.buklod_abc_doctrine_publication_audit a where a.lesson_id=l.lesson_id and a.action='publish')
             or exists(select 1 from public.buklod_abc_growth_progress p where p.lesson_id=l.lesson_id)) as content_locked
    from public.buklod_abc_doctrinal_lessons l order by updated_at desc limit 200
  ) d
  left join private.buklod_abc_doctrinal_answers a on a.lesson_id=d.lesson_id;
  return result_rows;
end;
$fn$;

create or replace function public.buklod_abc_doctrine_admin_save_v1(
  p_lesson_id text,
  p_series_key text,
  p_series_title text,
  p_position integer,
  p_code text,
  p_title text,
  p_difficulty text,
  p_prerequisite_id text,
  p_body_blocks jsonb,
  p_assessment_prompt text,
  p_assessment_options text[],
  p_correct_option text
) returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  actor uuid := (select auth.uid());
  next_id text := nullif(lower(trim(coalesce(p_lesson_id,''))),'');
  saved public.buklod_abc_doctrinal_lessons%rowtype;
  newly_created boolean := false;
  option_count integer;
  options_unique integer;
  next_number text;
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin only' using errcode='42501';
  end if;
  -- Serialize draft/publication decisions, including dependent prerequisite checks.
  perform pg_catalog.pg_advisory_xact_lock(4204, 20261124);
  if trim(coalesce(p_series_key,'')) !~ '^[a-z][a-z0-9-]{2,79}$'
     or char_length(trim(coalesce(p_series_title,''))) not between 5 and 120
     or p_position is null or p_position not between 1 and 1000000
     or char_length(trim(coalesce(p_code,''))) not between 2 and 30
     or char_length(trim(coalesce(p_title,''))) not between 8 and 160
     or p_difficulty not in ('foundation','intermediate','advanced','deep') then
    raise exception 'Invalid doctrinal series metadata';
  end if;
  if p_prerequisite_id is null or
     (p_prerequisite_id <> 'lesson-26' and p_prerequisite_id !~ '^doctrine-[0-9]{4,}$') then
    raise exception 'A previous verified prerequisite is required';
  end if;
  if p_body_blocks is null or pg_catalog.jsonb_typeof(p_body_blocks) <> 'array' then
    raise exception 'Study blocks must be an array';
  end if;
  if pg_catalog.jsonb_array_length(p_body_blocks) not between 2 and 12 or
     pg_catalog.length(p_body_blocks::text) > 30000 then
    raise exception 'Use 2–12 bounded study blocks';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_body_blocks) x
    where pg_catalog.jsonb_typeof(x) <> 'object' or
       pg_catalog.length(trim(coalesce(x->>'text',''))) < 12 or
       pg_catalog.length(trim(coalesce(x->>'text',''))) > 5000 or
       coalesce(x->>'kind','') not in ('heading','body','notes','memory','homework')
  ) then raise exception 'Study blocks require original text and supported types'; end if;
  if char_length(trim(coalesce(p_assessment_prompt,''))) not between 20 and 600 then
    raise exception 'Assessment question must contain 20–600 characters';
  end if;
  option_count := pg_catalog.array_length(p_assessment_options,1);
  if option_count is distinct from 4 or
     upper(trim(coalesce(p_correct_option,''))) not in ('A','B','C','D') then
    raise exception 'Exactly four answers and a correct option are required';
  end if;
  if exists(select 1 from pg_catalog.unnest(p_assessment_options) o
       where char_length(trim(coalesce(o,''))) not between 5 and 250) then
    raise exception 'Answer options must be 5–250 characters';
  end if;
  select count(distinct lower(trim(o))) into options_unique
  from pg_catalog.unnest(p_assessment_options) o;
  if options_unique <> 4 then raise exception 'Answer options must be distinct'; end if;

  if next_id is null then
    newly_created := true;
    loop
      next_number := pg_catalog.nextval('private.buklod_abc_doctrine_id_seq'::regclass)::text;
      next_id := 'doctrine-'||pg_catalog.lpad(next_number,greatest(4,length(next_number)),'0');
      exit when not exists (
        select 1 from public.buklod_abc_doctrinal_lessons where lesson_id=next_id);
    end loop;
  else
    select * into saved from public.buklod_abc_doctrinal_lessons
     where lesson_id=next_id for update;
    if not found then raise exception 'Draft not found'; end if;
    if saved.published or exists(select 1 from private.buklod_abc_doctrine_publication_audit a
         where a.lesson_id=saved.lesson_id and a.action='publish') or exists(
         select 1 from public.buklod_abc_growth_progress p where p.lesson_id=saved.lesson_id) then
      raise exception 'Published lessons are immutable; create a new revision with a new ID';
    end if;
  end if;
  if next_id=p_prerequisite_id then raise exception 'Lesson cannot depend on itself'; end if;

  if newly_created then
    insert into public.buklod_abc_doctrinal_lessons
      (lesson_id,series_key,series_title,position,code,title,difficulty,prerequisite_id,
       body_blocks,assessment_prompt,assessment_options,created_by,updated_at)
    values
      (next_id,trim(p_series_key),trim(p_series_title),p_position,trim(p_code),
       trim(p_title),p_difficulty,p_prerequisite_id,p_body_blocks,
       trim(p_assessment_prompt),p_assessment_options,actor,now())
    on conflict (lesson_id) do nothing returning * into saved;
    if not found then raise exception 'Generated lesson ID collision; retry'; end if;
  else
    update public.buklod_abc_doctrinal_lessons set
      series_key=trim(p_series_key),
      series_title=trim(p_series_title),
      position=p_position,
      code=trim(p_code),
      title=trim(p_title),
      difficulty=p_difficulty,
      prerequisite_id=p_prerequisite_id,
      body_blocks=p_body_blocks,
      assessment_prompt=trim(p_assessment_prompt),
      assessment_options=p_assessment_options,
      content_version=content_version+1,
      updated_at=now()
    where lesson_id=next_id and published=false
    returning * into saved;
    if not found then raise exception 'Draft no longer editable'; end if;
  end if;

  insert into private.buklod_abc_doctrinal_answers(lesson_id,correct_option)
  values(next_id,upper(trim(p_correct_option)))
  on conflict(lesson_id) do update set correct_option=excluded.correct_option;
  return jsonb_build_object('lesson_id',next_id,'content_version',saved.content_version,
    'published',false);
end;
$fn$;

create or replace function public.buklod_abc_doctrine_admin_publication_v1(
  p_lesson_id text,p_publish boolean,p_review_note text
) returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  actor uuid := (select auth.uid());
  lesson_row public.buklod_abc_doctrinal_lessons%rowtype;
  existing_lesson text;
  review_text text := trim(coalesce(p_review_note,''));
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin only' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(4204, 20261124);
  if p_publish is null or char_length(review_text) not between 30 and 2000 then
    raise exception 'Publication requires an explicit decision and substantive review note';
  end if;
  select * into lesson_row from public.buklod_abc_doctrinal_lessons
    where lesson_id=lower(trim(coalesce(p_lesson_id,''))) for update;
  if not found then raise exception 'Draft not found'; end if;
  if lesson_row.published is not distinct from p_publish then
    return jsonb_build_object('lesson_id',lesson_row.lesson_id,'published',lesson_row.published,'unchanged',true);
  end if;

  if not p_publish and exists(
     select 1 from public.buklod_abc_doctrinal_lessons d
     where d.prerequisite_id=lesson_row.lesson_id and d.published=true
  ) then
    raise exception 'Unpublish dependent lessons before unpublishing this prerequisite';
  end if;

  if p_publish then
    if not exists(select 1 from private.buklod_abc_doctrinal_answers
         where lesson_id=lesson_row.lesson_id) then
      raise exception 'Missing private answer key';
    end if;
    -- The older foundation lesson is our sole legacy entry point; otherwise
    -- the dependency must have been reviewed and published first.
    if lesson_row.prerequisite_id <> 'lesson-26' then
      select d.lesson_id into existing_lesson
      from public.buklod_abc_doctrinal_lessons d
      where d.lesson_id=lesson_row.prerequisite_id
        and d.published=true
        and pg_catalog.split_part(d.lesson_id,'-',2)::numeric < pg_catalog.split_part(lesson_row.lesson_id,'-',2)::numeric;
      if existing_lesson is null then
        raise exception 'Prerequisite must be published first; no circular references';
      end if;
    end if;
  end if;

  update public.buklod_abc_doctrinal_lessons set
    published=p_publish,
    published_at=case when p_publish then now() else null end,
    reviewed_by=actor,review_note=review_text,updated_at=now()
  where lesson_id=lesson_row.lesson_id;

  insert into private.buklod_abc_doctrine_publication_audit(lesson_id,action,actor_id,note)
  values(lesson_row.lesson_id,case when p_publish then 'publish' else 'unpublish' end,
         actor,review_text);
  return jsonb_build_object('lesson_id',lesson_row.lesson_id,'published',p_publish);
end;
$fn$;

revoke all on function public.buklod_abc_doctrine_admin_list_v1() from public,anon;
revoke all on function public.buklod_abc_doctrine_admin_save_v1(
 text,text,text,integer,text,text,text,text,jsonb,text,text[],text) from public,anon;
revoke all on function public.buklod_abc_doctrine_admin_publication_v1(text,boolean,text) from public,anon;
grant execute on function public.buklod_abc_doctrine_admin_list_v1() to authenticated;
grant execute on function public.buklod_abc_doctrine_admin_save_v1(
 text,text,text,integer,text,text,text,text,jsonb,text,text[],text) to authenticated;
grant execute on function public.buklod_abc_doctrine_admin_publication_v1(text,boolean,text) to authenticated;

-- Bounded keyset pages for the editor; retain v1 for older clients.
create or replace function public.buklod_abc_doctrine_admin_list_v2(p_before_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare result_rows jsonb;
begin
 if (select auth.uid()) is null or not public.buklod_is_system_admin() then
   raise exception 'System Admin only' using errcode='42501';
 end if;
 if p_before_id is not null and p_before_id !~ '^doctrine-[0-9]{4,19}$' then raise exception 'Invalid page cursor'; end if;
 select coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('correct_option',a.correct_option)
   order by pg_catalog.split_part(d.lesson_id,'-',2)::numeric desc,d.lesson_id desc),'[]'::jsonb)
 into result_rows from (
  select l.lesson_id,l.series_key,l.series_title,l.position,l.code,l.title,l.difficulty,l.prerequisite_id,
    l.body_blocks,l.assessment_prompt,l.assessment_options,l.published,l.published_at,l.created_at,l.updated_at,l.review_note,l.content_version,
    (l.published or exists(select 1 from private.buklod_abc_doctrine_publication_audit a where a.lesson_id=l.lesson_id and a.action='publish')
     or exists(select 1 from public.buklod_abc_growth_progress p where p.lesson_id=l.lesson_id)) as content_locked
  from public.buklod_abc_doctrinal_lessons l
  where p_before_id is null or (pg_catalog.split_part(l.lesson_id,'-',2)::numeric,l.lesson_id) < (pg_catalog.split_part(p_before_id,'-',2)::numeric,p_before_id)
  order by pg_catalog.split_part(l.lesson_id,'-',2)::numeric desc,l.lesson_id desc limit 80
 ) d left join private.buklod_abc_doctrinal_answers a on a.lesson_id=d.lesson_id;
 return result_rows;
end;
$fn$;
revoke all on function public.buklod_abc_doctrine_admin_list_v2(text) from public,anon;
grant execute on function public.buklod_abc_doctrine_admin_list_v2(text) to authenticated;
