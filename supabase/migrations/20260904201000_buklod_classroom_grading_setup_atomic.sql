-- BUKLOD Classroom R1 - one atomic save for term weights + category weights.
create or replace function public.buklod_education_save_grading_setup_v1(
  p_classroom_id uuid,
  p_terms jsonb,
  p_categories jsonb,
  p_passing_percent numeric default 75
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.buklod_education_save_grading_terms_v1(
    p_classroom_id,
    p_terms,
    p_passing_percent
  );

  perform public.buklod_education_save_grade_categories_v1(
    p_classroom_id,
    p_categories
  );

  return true;
end;
$$;

revoke all on function public.buklod_education_save_grading_setup_v1(uuid,jsonb,jsonb,numeric) from public;
grant execute on function public.buklod_education_save_grading_setup_v1(uuid,jsonb,jsonb,numeric) to authenticated;
