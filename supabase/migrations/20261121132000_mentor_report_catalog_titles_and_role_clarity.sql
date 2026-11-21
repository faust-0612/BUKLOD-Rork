-- DEV only until reviewed and migrated through the release gate.
-- Keep the existing mentor authorization; expose track/lesson numbers as search labels.
create or replace function public.get_my_mentor_reportable_lessons_r2()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare actor uuid := (select auth.uid()); answer jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not public.has_capability(actor,'mentor') then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'title', (t.title || ' · Lesson ' || l.lesson_number::text || ': ' || l.title)
  ) order by t.title, l.lesson_number, l.title), '[]'::jsonb)
  into answer
  from public.learning_lessons l
  join public.learning_tracks t on t.id = l.track_id
  where t.formation_program in ('ccp','discipleship');
  return answer;
end;
$$;
revoke all on function public.get_my_mentor_reportable_lessons_r2() from public, anon;
grant execute on function public.get_my_mentor_reportable_lessons_r2() to authenticated;
