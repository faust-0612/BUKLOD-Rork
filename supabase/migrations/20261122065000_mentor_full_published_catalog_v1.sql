-- BUKLOD MAIN DEV only. Apply on an isolated staging database after release review.
-- Broaden the mentor teaching picker to every published, content-ready BUKLOD learning track.
-- Submission continues through the existing mentor capability, assigned-learner, consent,
-- idempotency, private-evidence and System Admin approval checks.
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
    'title', (t.title || ' · Lesson ' || coalesce(l.lesson_number::text, '?') || ': ' || l.title),
    'track_title', t.title,
    'formation_program', t.formation_program
  ) order by t.stage_code nulls last, t.title, l.lesson_number nulls last, l.title), '[]'::jsonb)
  into answer
  from public.learning_lessons l
  join public.learning_tracks t on t.id = l.track_id
  where t.status = 'published'
    and coalesce(l.content_ready, true) = true;

  return answer;
end;
$$;

revoke all on function public.get_my_mentor_reportable_lessons_r2() from public, anon;
grant execute on function public.get_my_mentor_reportable_lessons_r2() to authenticated;
