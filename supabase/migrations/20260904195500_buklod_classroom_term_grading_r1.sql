-- BUKLOD Classroom R1 - term-aware, faculty-editable grading engine
-- Default template mirrors the faculty Excel workflow while remaining editable.
-- No attempt/score reset. Released/locked grades remain authoritative.

alter table public.buklod_education_grade_categories
  add column if not exists term_key text;

update public.buklod_education_grade_categories
set term_key = 'PRELIM'
where term_key is null or btrim(term_key) = '';

alter table public.buklod_education_grade_categories
  alter column term_key set default 'PRELIM';
alter table public.buklod_education_grade_categories
  alter column term_key set not null;

alter table public.buklod_education_grade_categories
  drop constraint if exists buklod_education_grade_categories_term_key_check;
alter table public.buklod_education_grade_categories
  add constraint buklod_education_grade_categories_term_key_check
  check (term_key in ('PRELIM','MIDTERM','SEMIFINALS','FINALS'));

alter table public.buklod_education_grade_categories
  drop constraint if exists buklod_education_grade_categories_classroom_id_name_key;
alter table public.buklod_education_grade_categories
  add constraint buklod_education_grade_categories_classroom_term_name_key
  unique (classroom_id, term_key, name);

create index if not exists idx_buklod_education_grade_categories_class_term
  on public.buklod_education_grade_categories(classroom_id, term_key);

update public.buklod_education_grade_items gi
set term_key = gc.term_key
from public.buklod_education_grade_categories gc
where gi.category_id = gc.id
  and gi.term_key is distinct from gc.term_key;

update public.buklod_education_grade_items
set term_key = 'PRELIM'
where term_key is null or btrim(term_key) = '';

alter table public.buklod_education_grade_items
  alter column term_key set default 'PRELIM';
alter table public.buklod_education_grade_items
  alter column term_key set not null;

alter table public.buklod_education_grade_items
  drop constraint if exists buklod_education_grade_items_term_key_check;
alter table public.buklod_education_grade_items
  add constraint buklod_education_grade_items_term_key_check
  check (term_key in ('PRELIM','MIDTERM','SEMIFINALS','FINALS'));

create index if not exists idx_buklod_education_grade_items_class_term
  on public.buklod_education_grade_items(classroom_id, term_key);

create or replace function public.buklod_education_sync_grade_item_term_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_term text;
begin
  if new.category_id is not null then
    select gc.term_key into v_term
    from public.buklod_education_grade_categories gc
    where gc.id = new.category_id
      and gc.classroom_id = new.classroom_id;

    if v_term is null then
      raise exception 'Grade category does not belong to this classroom.';
    end if;
    new.term_key := v_term;
  elsif new.term_key is null or btrim(new.term_key) = '' then
    new.term_key := 'PRELIM';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_buklod_education_sync_grade_item_term on public.buklod_education_grade_items;
create trigger trg_buklod_education_sync_grade_item_term
before insert or update of category_id, classroom_id, term_key
on public.buklod_education_grade_items
for each row execute function public.buklod_education_sync_grade_item_term_v1();

create or replace function public.buklod_education_default_grading_terms_v1()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_array(
    jsonb_build_object('key','PRELIM','label','Prelim','weight_percent',25),
    jsonb_build_object('key','MIDTERM','label','Midterm','weight_percent',25),
    jsonb_build_object('key','SEMIFINALS','label','Semifinals','weight_percent',25),
    jsonb_build_object('key','FINALS','label','Finals','weight_percent',25)
  );
$$;

create or replace function public.buklod_education_default_grading_policy_v1()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 2,
    'template', 'BUKLOD_EXCEL_4_TERM',
    'formula', 'TRANSMUTED_50_BASE',
    'formula_label', '50 + (Raw Score / Highest Possible Score) x 50',
    'category_mode', 'WEIGHTED_WITHIN_TERM',
    'manual_editable', true
  );
$$;

create or replace function public.buklod_education_apply_default_grading_template_v1(
  p_classroom_id uuid,
  p_replace boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_existing integer;
begin
  if not public.buklod_education_is_faculty_owner_v2(p_classroom_id) then
    raise exception 'Classroom not found or not authorized.';
  end if;

  if exists (
    select 1 from public.buklod_education_final_grades fg
    where fg.classroom_id = p_classroom_id
      and fg.status in ('RELEASED','LOCKED')
  ) then
    raise exception 'Reopen released or locked final grades before changing the grading setup.';
  end if;

  select count(*) into v_existing
  from public.buklod_education_grade_categories gc
  where gc.classroom_id = p_classroom_id;

  if v_existing > 0 and not p_replace then
    update public.buklod_education_classrooms
    set grading_terms = public.buklod_education_default_grading_terms_v1(),
        grading_policy = public.buklod_education_default_grading_policy_v1(),
        passing_percent = 75,
        updated_at = now()
    where id = p_classroom_id;
    return false;
  end if;

  if p_replace and exists (
    select 1 from public.buklod_education_grade_items gi
    where gi.classroom_id = p_classroom_id
  ) then
    raise exception 'Default reset is blocked because grade items already exist. Edit the existing setup instead.';
  end if;

  if p_replace then
    delete from public.buklod_education_grade_categories
    where classroom_id = p_classroom_id;
  end if;

  update public.buklod_education_classrooms
  set grading_terms = public.buklod_education_default_grading_terms_v1(),
      grading_policy = public.buklod_education_default_grading_policy_v1(),
      passing_percent = 75,
      updated_at = now()
  where id = p_classroom_id;

  insert into public.buklod_education_grade_categories(
    classroom_id, term_key, name, category_type, weight_percent, created_by
  )
  select p_classroom_id, t.term_key, c.name, c.category_type, c.weight_percent, v_uid
  from (values
    ('PRELIM'),('MIDTERM'),('SEMIFINALS'),('FINALS')
  ) as t(term_key)
  cross join (values
    ('Attendance','ATTENDANCE',10::numeric),
    ('Participation / Recitation','PARTICIPATION',10::numeric),
    ('Quizzes','QUIZ',20::numeric),
    ('Activity / Seatworks','ACTIVITY',10::numeric),
    ('Attitude','ATTITUDE',10::numeric),
    ('Major Exam','EXAM',40::numeric)
  ) as c(name, category_type, weight_percent)
  on conflict (classroom_id, term_key, name) do nothing;

  return true;
end;
$$;

revoke all on function public.buklod_education_apply_default_grading_template_v1(uuid,boolean) from public;
grant execute on function public.buklod_education_apply_default_grading_template_v1(uuid,boolean) to authenticated;

create or replace function public.buklod_education_save_grading_terms_v1(
  p_classroom_id uuid,
  p_terms jsonb,
  p_passing_percent numeric default 75
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
  v_count integer;
begin
  if not public.buklod_education_is_faculty_owner_v2(p_classroom_id) then
    raise exception 'Classroom not found or not authorized.';
  end if;
  if jsonb_typeof(p_terms) <> 'array' then
    raise exception 'Grading terms must be an array.';
  end if;
  if p_passing_percent < 0 or p_passing_percent > 100 then
    raise exception 'Passing grade must be from 0 to 100.';
  end if;
  if exists (
    select 1 from public.buklod_education_final_grades fg
    where fg.classroom_id = p_classroom_id
      and fg.status in ('RELEASED','LOCKED')
  ) then
    raise exception 'Reopen released or locked final grades before changing term weights.';
  end if;

  with x as (
    select upper(value->>'key') as term_key,
           coalesce((value->>'weight_percent')::numeric,0) as weight
    from jsonb_array_elements(p_terms)
  )
  select count(*), coalesce(sum(weight),0)
  into v_count, v_total
  from x
  where term_key in ('PRELIM','MIDTERM','SEMIFINALS','FINALS')
    and weight between 0 and 100;

  if v_count <> 4 or abs(v_total - 100) >= 0.0001 then
    raise exception 'Prelim, Midterm, Semifinals and Finals must all be present and total exactly 100%%.';
  end if;

  if (
    select count(distinct upper(value->>'key'))
    from jsonb_array_elements(p_terms)
  ) <> 4 then
    raise exception 'Each grading term must appear exactly once.';
  end if;

  update public.buklod_education_classrooms
  set grading_terms = (
        select jsonb_agg(jsonb_build_object(
          'key', upper(value->>'key'),
          'label', coalesce(nullif(value->>'label',''), initcap(lower(value->>'key'))),
          'weight_percent', (value->>'weight_percent')::numeric
        ) order by case upper(value->>'key')
          when 'PRELIM' then 1 when 'MIDTERM' then 2 when 'SEMIFINALS' then 3 else 4 end)
        from jsonb_array_elements(p_terms)
      ),
      grading_policy = coalesce(grading_policy,'{}'::jsonb) || jsonb_build_object(
        'version',2,
        'formula','TRANSMUTED_50_BASE',
        'formula_label','50 + (Raw Score / Highest Possible Score) x 50',
        'manual_editable',true
      ),
      passing_percent = p_passing_percent,
      updated_at = now()
  where id = p_classroom_id;

  return true;
end;
$$;

revoke all on function public.buklod_education_save_grading_terms_v1(uuid,jsonb,numeric) from public;
grant execute on function public.buklod_education_save_grading_terms_v1(uuid,jsonb,numeric) to authenticated;

create or replace function public.buklod_education_upsert_grade_category_v2(
  p_classroom_id uuid,
  p_category_id uuid,
  p_term_key text,
  p_name text,
  p_weight_percent numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_term text := upper(btrim(coalesce(p_term_key,'')));
  v_name text := nullif(btrim(coalesce(p_name,'')), '');
begin
  if not public.buklod_education_is_faculty_owner_v2(p_classroom_id) then
    raise exception 'Classroom not found or not authorized.';
  end if;
  if v_term not in ('PRELIM','MIDTERM','SEMIFINALS','FINALS') then
    raise exception 'Invalid grading term.';
  end if;
  if v_name is null then
    raise exception 'Category name is required.';
  end if;
  if p_weight_percent < 0 or p_weight_percent > 100 then
    raise exception 'Category weight must be from 0 to 100.';
  end if;
  if exists (
    select 1 from public.buklod_education_final_grades fg
    where fg.classroom_id = p_classroom_id
      and fg.status in ('RELEASED','LOCKED')
  ) then
    raise exception 'Reopen released or locked final grades before changing categories.';
  end if;

  if p_category_id is null then
    insert into public.buklod_education_grade_categories(
      classroom_id, term_key, name, category_type, weight_percent, created_by
    ) values (
      p_classroom_id, v_term, v_name, 'CUSTOM', p_weight_percent, v_uid
    ) returning id into v_id;
  else
    update public.buklod_education_grade_categories
    set term_key = v_term,
        name = v_name,
        weight_percent = p_weight_percent
    where id = p_category_id
      and classroom_id = p_classroom_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Grade category not found.';
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.buklod_education_upsert_grade_category_v2(uuid,uuid,text,text,numeric) from public;
grant execute on function public.buklod_education_upsert_grade_category_v2(uuid,uuid,text,text,numeric) to authenticated;

create or replace function public.buklod_education_delete_grade_category_v1(
  p_classroom_id uuid,
  p_category_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.buklod_education_is_faculty_owner_v2(p_classroom_id) then
    raise exception 'Classroom not found or not authorized.';
  end if;
  if exists (
    select 1 from public.buklod_education_grade_items gi
    where gi.classroom_id = p_classroom_id and gi.category_id = p_category_id
  ) then
    raise exception 'This category already has grade items and cannot be deleted.';
  end if;
  if exists (
    select 1 from public.buklod_education_final_grades fg
    where fg.classroom_id = p_classroom_id and fg.status in ('RELEASED','LOCKED')
  ) then
    raise exception 'Reopen released or locked final grades before changing categories.';
  end if;
  delete from public.buklod_education_grade_categories
  where id = p_category_id and classroom_id = p_classroom_id;
  return found;
end;
$$;

revoke all on function public.buklod_education_delete_grade_category_v1(uuid,uuid) from public;
grant execute on function public.buklod_education_delete_grade_category_v1(uuid,uuid) to authenticated;

create or replace function public.buklod_education_build_grade_breakdown_v1(
  p_classroom_id uuid,
  p_student_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  with terms as (
    select
      upper(value->>'key') as term_key,
      coalesce(value->>'label', initcap(lower(value->>'key'))) as term_label,
      coalesce((value->>'weight_percent')::numeric,0) as term_weight_percent
    from public.buklod_education_classrooms c,
         jsonb_array_elements(coalesce(c.grading_terms, public.buklod_education_default_grading_terms_v1())) value
    where c.id = p_classroom_id
  ),
  category_scores as (
    select
      gc.id as category_id,
      gc.term_key,
      gc.name as category_name,
      gc.weight_percent as category_weight_percent,
      t.term_label,
      t.term_weight_percent,
      round((t.term_weight_percent * gc.weight_percent) / 100.0, 6) as effective_weight_percent,
      coalesce(sum(g.score) filter (where g.status in ('RELEASED','LOCKED')),0)::numeric as earned,
      coalesce(sum(gi.points_possible) filter (where g.status in ('RELEASED','LOCKED')),0)::numeric as possible
    from public.buklod_education_grade_categories gc
    join terms t on t.term_key = gc.term_key
    left join public.buklod_education_grade_items gi
      on gi.category_id = gc.id
      and gi.classroom_id = p_classroom_id
    left join public.buklod_education_grades g
      on g.grade_item_id = gi.id
      and g.student_user_id = p_student_user_id
    where gc.classroom_id = p_classroom_id
    group by gc.id, gc.term_key, gc.name, gc.weight_percent,
             t.term_label, t.term_weight_percent
  ), scored as (
    select s.*,
      case when s.possible > 0 then round(least(100::numeric, greatest(50::numeric,
        50::numeric + ((s.earned / s.possible) * 50::numeric))),4) else null end as equivalent_percent
    from category_scores s
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'category_id', s.category_id,
    'term_key', s.term_key,
    'term_label', s.term_label,
    'term_weight_percent', s.term_weight_percent,
    'category_name', s.category_name,
    'category_weight_percent', s.category_weight_percent,
    'weight_percent', s.effective_weight_percent,
    'earned', s.earned,
    'possible', s.possible,
    'raw_percent', case when s.possible > 0 then round((s.earned / s.possible) * 100,4) else null end,
    'category_percent', s.equivalent_percent,
    'equivalent_percent', s.equivalent_percent,
    'weighted_points', case when s.equivalent_percent is not null
      then round((s.equivalent_percent / 100.0) * s.effective_weight_percent,4) else 0 end,
    'represented', s.possible > 0
  ) order by case s.term_key when 'PRELIM' then 1 when 'MIDTERM' then 2 when 'SEMIFINALS' then 3 else 4 end,
             s.category_name), '[]'::jsonb)
  from scored s;
$$;

create or replace function public.buklod_education_faculty_final_grade_summary_v1(p_classroom_id uuid)
returns table(
  student_user_id uuid,
  display_name text,
  weighted_points numeric,
  covered_weight numeric,
  current_percent numeric,
  positive_categories integer,
  represented_categories integer,
  ready_for_final boolean,
  final_grade numeric,
  final_status text
)
language sql
stable
security definer
set search_path = 'public'
as $$
  with authorized as (
    select c.id, c.grading_terms
    from public.buklod_education_classrooms c
    where c.id = p_classroom_id
      and public.buklod_education_is_faculty_owner_v2(c.id)
  ), terms as (
    select upper(value->>'key') as term_key,
           coalesce((value->>'weight_percent')::numeric,0) as term_weight
    from authorized a,
         jsonb_array_elements(coalesce(a.grading_terms, public.buklod_education_default_grading_terms_v1())) value
  ), config as (
    select
      coalesce((select sum(term_weight) from terms),0)::numeric as term_total,
      count(*) filter (where x.category_total is distinct from 100::numeric)::integer as invalid_terms,
      coalesce(sum(x.positive_categories),0)::integer as positive_categories
    from (
      select t.term_key, coalesce(sum(gc.weight_percent),0)::numeric as category_total,
             count(gc.id) filter (where gc.weight_percent > 0)::integer as positive_categories
      from terms t
      left join public.buklod_education_grade_categories gc
        on gc.classroom_id = p_classroom_id and gc.term_key = t.term_key
      group by t.term_key
    ) x
  ), roster as (
    select e.student_user_id
    from public.buklod_education_enrollments e
    join authorized a on a.id = e.classroom_id
    where e.status = 'ACTIVE'
  ), expanded as (
    select r.student_user_id, b.item
    from roster r
    cross join lateral jsonb_array_elements(
      public.buklod_education_build_grade_breakdown_v1(p_classroom_id, r.student_user_id)
    ) b(item)
  ), scores as (
    select
      e.student_user_id,
      coalesce(sum((e.item->>'weighted_points')::numeric),0)::numeric as weighted_points,
      coalesce(sum(case when (e.item->>'represented')::boolean and (e.item->>'weight_percent')::numeric > 0
        then (e.item->>'weight_percent')::numeric else 0 end),0)::numeric as covered_weight,
      count(*) filter (where (e.item->>'weight_percent')::numeric > 0 and (e.item->>'represented')::boolean)::integer as represented_categories
    from expanded e
    group by e.student_user_id
  )
  select
    r.student_user_id,
    coalesce(nullif(to_jsonb(p)->>'display_name',''), nullif(to_jsonb(p)->>'full_name',''),
             nullif(to_jsonb(p)->>'name',''), nullif(to_jsonb(p)->>'username',''), 'Student')::text,
    round(coalesce(s.weighted_points,0),4),
    round(coalesce(s.covered_weight,0),4),
    case when coalesce(s.covered_weight,0) > 0
      then round((s.weighted_points / s.covered_weight) * 100,4) else null end,
    cfg.positive_categories,
    coalesce(s.represented_categories,0),
    (abs(cfg.term_total - 100) < 0.0001 and cfg.invalid_terms = 0
      and cfg.positive_categories > 0
      and coalesce(s.represented_categories,0) = cfg.positive_categories),
    fg.computed_grade,
    fg.status
  from roster r
  cross join config cfg
  left join scores s on s.student_user_id = r.student_user_id
  left join public.profiles p on p.id = r.student_user_id
  left join public.buklod_education_final_grades fg
    on fg.classroom_id = p_classroom_id and fg.student_user_id = r.student_user_id
  order by 2;
$$;

create or replace function public.buklod_education_compute_final_grade_v1(
  p_classroom_id uuid,
  p_student_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_term_total numeric;
  v_invalid_terms integer;
  v_positive integer;
  v_represented integer;
  v_total_weight numeric;
  v_weighted_points numeric;
  v_breakdown jsonb;
  v_existing public.buklod_education_final_grades%rowtype;
  v_result public.buklod_education_final_grades%rowtype;
begin
  if not public.buklod_education_is_faculty_owner_v2(p_classroom_id) then
    raise exception 'Classroom not found or not authorized.';
  end if;
  if not exists (
    select 1 from public.buklod_education_enrollments e
    where e.classroom_id = p_classroom_id and e.student_user_id = p_student_user_id and e.status = 'ACTIVE'
  ) then
    raise exception 'Student is not actively enrolled.';
  end if;

  with terms as (
    select upper(value->>'key') term_key, coalesce((value->>'weight_percent')::numeric,0) term_weight
    from public.buklod_education_classrooms c,
         jsonb_array_elements(coalesce(c.grading_terms, public.buklod_education_default_grading_terms_v1())) value
    where c.id = p_classroom_id
  ), term_categories as (
    select t.term_key, coalesce(sum(gc.weight_percent),0)::numeric category_total
    from terms t left join public.buklod_education_grade_categories gc
      on gc.classroom_id = p_classroom_id and gc.term_key = t.term_key
    group by t.term_key
  )
  select coalesce((select sum(term_weight) from terms),0),
         count(*) filter (where category_total is distinct from 100::numeric)
  into v_term_total, v_invalid_terms
  from term_categories;

  if abs(v_term_total - 100) >= 0.0001 or v_invalid_terms <> 0 then
    raise exception 'Final grade requires term weights totaling 100%% and category weights totaling 100%% inside every term.';
  end if;

  v_breakdown := public.buklod_education_build_grade_breakdown_v1(p_classroom_id, p_student_user_id);

  with x as (select value item from jsonb_array_elements(v_breakdown))
  select
    count(*) filter (where (item->>'weight_percent')::numeric > 0),
    count(*) filter (where (item->>'weight_percent')::numeric > 0 and (item->>'represented')::boolean),
    coalesce(sum((item->>'weight_percent')::numeric),0),
    coalesce(sum((item->>'weighted_points')::numeric),0)
  into v_positive, v_represented, v_total_weight, v_weighted_points
  from x;

  if v_positive <= 0 or v_represented <> v_positive or abs(v_total_weight - 100) >= 0.0001 then
    raise exception 'Every positive-weight category in every grading term must have released or locked graded work before finalization.';
  end if;

  select * into v_existing
  from public.buklod_education_final_grades
  where classroom_id = p_classroom_id and student_user_id = p_student_user_id;

  if v_existing.id is not null and v_existing.status in ('RELEASED','LOCKED') then
    raise exception 'Released/locked final grade must be reopened before recomputation.';
  end if;

  insert into public.buklod_education_final_grades(
    classroom_id, student_user_id, computed_grade, covered_weight, breakdown,
    status, calculated_at, released_at, locked_at, updated_by, updated_at
  ) values (
    p_classroom_id, p_student_user_id, round(v_weighted_points,4), 100, v_breakdown,
    'DRAFT', now(), null, null, auth.uid(), now()
  )
  on conflict (classroom_id, student_user_id) do update set
    computed_grade = excluded.computed_grade,
    covered_weight = excluded.covered_weight,
    breakdown = excluded.breakdown,
    status = 'DRAFT', calculated_at = now(), released_at = null, locked_at = null,
    updated_by = auth.uid(), updated_at = now()
  returning * into v_result;

  insert into public.buklod_education_final_grade_audit(
    final_grade_id, changed_by, old_grade, new_grade, old_status, new_status, reason
  ) values (
    v_result.id, auth.uid(), v_existing.computed_grade, v_result.computed_grade,
    v_existing.status, 'DRAFT', 'Term-aware final grade computed from released/locked grade items'
  );

  return v_result.id;
end;
$$;

-- New classrooms automatically receive the editable default template.
create or replace function public.buklod_education_create_classroom_with_owner_v1(
  p_name text,
  p_subject_code text default null,
  p_section_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_classroom_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.is_active = true) then
    raise exception 'Active BUKLOD account required';
  end if;
  if v_name is null then raise exception 'Class/subject name is required'; end if;

  perform public.buklod_foundation_provision_creator_internal_v1(
    v_user_id, 'FACULTY_WORKSPACE', v_user_id, 'FACULTY', 'EDUCATION', null,
    'ACTIVE', 'FACULTY_CLASSROOM_CREATE', jsonb_build_object('creator_self_service', true)
  );

  insert into public.buklod_education_classrooms(
    faculty_user_id, name, subject_code, section_name, status,
    grading_terms, grading_policy, passing_percent
  ) values (
    v_user_id, v_name, nullif(trim(coalesce(p_subject_code, '')), ''),
    nullif(trim(coalesce(p_section_name, '')), ''), 'ACTIVE',
    public.buklod_education_default_grading_terms_v1(),
    public.buklod_education_default_grading_policy_v1(), 75
  ) returning id into v_classroom_id;

  perform public.buklod_education_apply_default_grading_template_v1(v_classroom_id, false);
  return v_classroom_id;
end;
$$;

-- Safe initial seed: current production has no grade items/final grades at R1 introduction.
update public.buklod_education_classrooms
set grading_terms = public.buklod_education_default_grading_terms_v1(),
    grading_policy = public.buklod_education_default_grading_policy_v1(),
    passing_percent = 75,
    updated_at = now();

insert into public.buklod_education_grade_categories(
  classroom_id, term_key, name, category_type, weight_percent, created_by
)
select cl.id, t.term_key, c.name, c.category_type, c.weight_percent, cl.faculty_user_id
from public.buklod_education_classrooms cl
cross join (values ('PRELIM'),('MIDTERM'),('SEMIFINALS'),('FINALS')) t(term_key)
cross join (values
  ('Attendance','ATTENDANCE',10::numeric),
  ('Participation / Recitation','PARTICIPATION',10::numeric),
  ('Quizzes','QUIZ',20::numeric),
  ('Activity / Seatworks','ACTIVITY',10::numeric),
  ('Attitude','ATTITUDE',10::numeric),
  ('Major Exam','EXAM',40::numeric)
) c(name, category_type, weight_percent)
on conflict (classroom_id, term_key, name) do nothing;
