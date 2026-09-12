-- BUKLOD IGPAT R19
-- Fix a cross-feature RLS failure where authenticated reads of
-- buklod_education_classrooms could raise permission denied on
-- buklod_education_classroom_faculty. Storage authorization for unrelated
-- buckets (including community-media / IGPAT) can touch classroom predicates,
-- so the classroom row-read check must not directly read the restricted
-- faculty table under the caller role.
--
-- Preserve the existing authorization contract without granting authenticated
-- direct SELECT access to buklod_education_classroom_faculty.

begin;

create or replace function private.buklod_education_can_read_classroom_row_v1(
  p_classroom_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    public.buklod_is_system_admin()
    or (
      public.buklod_is_active_faculty_focus_user_v1((select auth.uid()))
      and exists (
        select 1
        from public.buklod_education_classroom_faculty f
        where f.classroom_id = p_classroom_id
          and f.faculty_user_id = (select auth.uid())
          and upper(f.status) = 'ACTIVE'
          and f.ended_at is null
      )
    )
    or public.buklod_education_is_enrolled_for_classroom_v2(p_classroom_id);
$function$;

revoke all on function private.buklod_education_can_read_classroom_row_v1(uuid) from public;
revoke all on function private.buklod_education_can_read_classroom_row_v1(uuid) from anon;
grant execute on function private.buklod_education_can_read_classroom_row_v1(uuid) to authenticated;
grant execute on function private.buklod_education_can_read_classroom_row_v1(uuid) to service_role;

drop policy if exists buklod_edu_classroom_read
  on public.buklod_education_classrooms;

create policy buklod_edu_classroom_read
on public.buklod_education_classrooms
for select
to authenticated
using (
  private.buklod_education_can_read_classroom_row_v1(id)
);

commit;
