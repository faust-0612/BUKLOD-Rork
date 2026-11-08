-- Execute ONLY after the staged music Admin/ambience migration in a QA DB.
-- Non-destructive authorization and published-post schema contract.
begin;
do $music_rc$
declare v_constraint text;
begin
  select pg_get_constraintdef(c.oid) into v_constraint
    from pg_constraint c
    where c.conrelid='public.buklod_post_creatives'::regclass
      and c.conname='buklod_post_creatives_motion_preset_check';
  if v_constraint is null
    or position('rain' in v_constraint)=0
    or position('snow' in v_constraint)=0
    or position('underwater' in v_constraint)=0 then
      raise exception 'Music ambiance constraint not applied';
  end if;
  if not exists(
    select 1 from pg_class
    where oid='public.buklod_music_library'::regclass and relrowsecurity
  ) then raise exception 'Music catalog RLS disabled'; end if;
  if not exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='buklod_music_library'
      and policyname='buklod_music_admin_insert' and cmd='INSERT'
      and position('is_system_admin()' in with_check)>0
  ) or not exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='buklod_music_library'
      and policyname='buklod_music_admin_delete' and cmd='DELETE'
      and position('is_system_admin()' in qual)>0
  ) then raise exception 'Music catalog Admin-only writes missing'; end if;
  if not exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='buklod_music_library'
      and policyname='buklod_music_library_authenticated_read'
      and position('is_active' in qual)>0
  ) then raise exception 'Member music catalog must remain active-only'; end if;
  if not exists(
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='buklod_music_admin_storage_insert'
      and cmd='INSERT'
      and position('is_system_admin()' in with_check)>0
  ) or not exists(
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='buklod_music_admin_storage_delete'
      and cmd='DELETE'
      and position('is_system_admin()' in qual)>0
  ) then raise exception 'Private bucket Admin-only upload/delete missing'; end if;
  if not exists(
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='buklod_music_private_active_read'
      and cmd='SELECT'
      and position('is_active' in qual)>0
  ) then raise exception 'Only active music should have signed read eligibility'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.buklod_post_creatives'::regclass
      and contype='f' and pg_get_constraintdef(oid) ilike '%ON DELETE SET NULL%'
  ) then raise exception 'Deleting music must preserve published post records'; end if;
end;
$music_rc$;
rollback;
