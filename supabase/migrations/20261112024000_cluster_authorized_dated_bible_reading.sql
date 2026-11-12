-- Secure dated Daily Bible plan gateway. Do NOT grant the lower-level, unrestricted
-- get_automatic_bible_reading(date) to authenticated; preserve Cluster membership.
-- Delegate authorization to the already released canonical get_automatic_bible_today
-- gate, then calculate the caller's requested date using the unchanged plan function.
create or replace function public.get_automatic_bible_reading_for_cluster(p_reading_date date)
returns table(reading_date date, plan_day_number integer, plan_week_number integer, cycle_number integer, chapters_today integer, start_absolute_chapter integer, end_absolute_chapter integer, start_book_no integer, start_book_name text, start_chapter integer, end_book_no integer, end_book_name text, end_chapter integer, bible_reference text)
language plpgsql stable security definer set search_path=''
as $secure_reading$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_reading_date is null then
    raise exception 'Reading date is required' using errcode='22023';
  end if;
  -- Existing authorized Daily Reading gate handles ACTIVE Cluster membership
  -- (or canonical system admin). Never bypass it, including for offline warmup.
  perform 1 from public.get_automatic_bible_today();
  return query select * from public.get_automatic_bible_reading(p_reading_date);
end $secure_reading$;
revoke all on function public.get_automatic_bible_reading_for_cluster(date) from PUBLIC, anon;
grant execute on function public.get_automatic_bible_reading_for_cluster(date) to authenticated;
