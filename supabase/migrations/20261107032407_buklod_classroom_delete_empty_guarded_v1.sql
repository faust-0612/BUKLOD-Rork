-- BUKLOD Classroom Web: safe delete for genuinely empty classes.
-- Does not change the existing delete_empty_v1 RPC used by other clients.
-- RLS/roster grants remain unchanged. Only authenticated class owners may execute this.
create or replace function public.buklod_classroom_delete_empty_guarded_v1(p_classroom_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_class_name text;
  v_table record;
  v_found boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required to delete a classroom.' using errcode = '42501';
  end if;

  if not public.buklod_education_is_faculty_owner_v2(p_classroom_id) then
    raise exception 'Faculty owner permission is required.' using errcode = '42501';
  end if;

  -- Serializes with inserts through the FK KEY SHARE lock to prevent stale preflight.
  select c.name into v_class_name
  from public.buklod_education_classrooms c
  where c.id = p_classroom_id
  for update nowait;
  if v_class_name is null then
    raise exception 'Classroom not found.';
  end if;

  -- Keep the normal single primary faculty and system-created General thread.
  if (select count(*) from public.buklod_education_classroom_faculty f
      where f.classroom_id = p_classroom_id) > 1 then
    raise exception 'This class has additional faculty. Export and archive instead.';
  end if;
  if (select count(*) from public.buklod_education_classroom_threads t
      where t.classroom_id = p_classroom_id) > 1
    or exists (
      select 1 from public.buklod_education_classroom_threads t
      where t.classroom_id = p_classroom_id
        and (upper(coalesce(t.thread_type,'')) <> 'GENERAL' or t.archived_at is not null)
    ) then
    raise exception 'This class has custom discussion threads. Export and archive instead.';
  end if;

  -- Every public base table keyed by classroom_id (including future modules) must
  -- be empty, except generated category defaults, owner assignment and General thread.
  -- This also catches orphaned content and QuickCheck links not covered by delete_empty_v1.
  for v_table in
    select n.nspname as schema_name, c.relname as table_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a
      on a.attrelid = c.oid and a.attname = 'classroom_id'
      and a.atttypid = 'uuid'::pg_catalog.regtype and not a.attisdropped
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and c.relname not in (
        'buklod_education_classroom_faculty',
        'buklod_education_classroom_threads',
        'buklod_education_grade_categories'
      )
    order by c.relname
  loop
    execute format(
      'select exists(select 1 from %I.%I where classroom_id = $1)',
      v_table.schema_name, v_table.table_name
    ) into v_found using p_classroom_id;
    if v_found then
      raise exception
        'Classroom contains saved records (%). Export and archive instead of deleting.',
        v_table.table_name;
    end if;
  end loop;

  delete from public.buklod_education_classrooms
   where id = p_classroom_id;
  if not found then
    raise exception 'Classroom could not be deleted.';
  end if;
  return jsonb_build_object(
    'classroom_id', p_classroom_id, 'deleted', true
  );
end;
$function$;

revoke all on function public.buklod_classroom_delete_empty_guarded_v1(uuid)
  from public, anon;
grant execute on function public.buklod_classroom_delete_empty_guarded_v1(uuid)
  to authenticated;
