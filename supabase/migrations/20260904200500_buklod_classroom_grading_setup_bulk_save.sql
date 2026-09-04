-- BUKLOD Classroom R1 - atomic faculty grading setup save.

create or replace function public.buklod_education_save_grade_categories_v1(
  p_classroom_id uuid,
  p_categories jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_term text;
  v_name text;
  v_weight numeric;
  v_existing_id uuid;
  v_seen_ids uuid[] := array[]::uuid[];
  v_term_count integer;
  v_bad_terms integer;
begin
  if not public.buklod_education_is_faculty_owner_v2(p_classroom_id) then
    raise exception 'Classroom not found or not authorized.';
  end if;

  if jsonb_typeof(p_categories) <> 'array' then
    raise exception 'Grade categories must be an array.';
  end if;

  if exists (
    select 1
    from public.buklod_education_final_grades fg
    where fg.classroom_id = p_classroom_id
      and fg.status in ('RELEASED','LOCKED')
  ) then
    raise exception 'Reopen released or locked final grades before changing categories.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_categories) x(item)
    where upper(btrim(coalesce(item->>'term_key',''))) not in ('PRELIM','MIDTERM','SEMIFINALS','FINALS')
       or nullif(btrim(coalesce(item->>'name','')), '') is null
       or coalesce((item->>'weight_percent')::numeric, -1) < 0
       or coalesce((item->>'weight_percent')::numeric, 101) > 100
  ) then
    raise exception 'Every category needs a valid term, name, and weight from 0 to 100.';
  end if;

  if exists (
    select 1
    from (
      select upper(btrim(item->>'term_key')) term_key,
             lower(btrim(item->>'name')) category_name,
             count(*) n
      from jsonb_array_elements(p_categories) x(item)
      group by 1,2
      having count(*) > 1
    ) d
  ) then
    raise exception 'Category names must be unique inside each grading term.';
  end if;

  with sums as (
    select upper(btrim(item->>'term_key')) term_key,
           sum((item->>'weight_percent')::numeric) total_weight
    from jsonb_array_elements(p_categories) x(item)
    group by 1
  )
  select count(*), count(*) filter (where abs(total_weight - 100) >= 0.0001)
  into v_term_count, v_bad_terms
  from sums;

  if v_term_count <> 4 or v_bad_terms <> 0 then
    raise exception 'Each of Prelim, Midterm, Semifinals and Finals must have category weights totaling exactly 100%%.';
  end if;

  -- Reject removal of a category that already owns grade items.
  if exists (
    select 1
    from public.buklod_education_grade_categories gc
    join public.buklod_education_grade_items gi on gi.category_id = gc.id
    where gc.classroom_id = p_classroom_id
      and not exists (
        select 1
        from jsonb_array_elements(p_categories) x(item)
        where nullif(item->>'id','')::uuid = gc.id
      )
  ) then
    raise exception 'A category with existing grade items cannot be removed.';
  end if;

  -- Remove only omitted categories that have no grade items.
  delete from public.buklod_education_grade_categories gc
  where gc.classroom_id = p_classroom_id
    and not exists (
      select 1
      from public.buklod_education_grade_items gi
      where gi.category_id = gc.id
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_categories) x(item)
      where nullif(item->>'id','')::uuid = gc.id
    );

  for v_item in select value from jsonb_array_elements(p_categories)
  loop
    v_id := nullif(v_item->>'id','')::uuid;
    v_term := upper(btrim(v_item->>'term_key'));
    v_name := btrim(v_item->>'name');
    v_weight := (v_item->>'weight_percent')::numeric;
    v_existing_id := null;

    if v_id is not null then
      update public.buklod_education_grade_categories
      set term_key = v_term,
          name = v_name,
          weight_percent = v_weight
      where id = v_id
        and classroom_id = p_classroom_id
      returning id into v_existing_id;

      if v_existing_id is null then
        raise exception 'One of the submitted grade categories no longer exists.';
      end if;
      v_seen_ids := array_append(v_seen_ids, v_existing_id);
    else
      insert into public.buklod_education_grade_categories(
        classroom_id, term_key, name, category_type, weight_percent, created_by
      ) values (
        p_classroom_id, v_term, v_name, 'CUSTOM', v_weight, (select auth.uid())
      )
      returning id into v_existing_id;
      v_seen_ids := array_append(v_seen_ids, v_existing_id);
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.buklod_education_save_grade_categories_v1(uuid,jsonb) from public;
grant execute on function public.buklod_education_save_grade_categories_v1(uuid,jsonb) to authenticated;
