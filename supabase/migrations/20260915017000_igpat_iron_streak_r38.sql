-- BUKLOD IGPAT R38
-- Iron Streak counts days with verified Arena completion, never app opens.

create or replace function public.get_my_buklod_igpat_iron_streak_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  d date;
  previous_day date := null;
  newest_day date := null;
  current_streak integer := 0;
  best_streak integer := 0;
  running integer := 0;
  completion_days integer := 0;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  for d in
    select distinct (c.completed_at at time zone 'UTC')::date as completion_day
    from public.igpat_arena_results r
    join public.igpat_arena_challenges c on c.id = r.challenge_id
    where r.submitted_by = actor
      and r.verified = true
      and c.status = 'COMPLETED'
      and c.completed_at is not null
    order by completion_day desc
  loop
    completion_days := completion_days + 1;
    if newest_day is null then
      newest_day := d;
    end if;

    if previous_day is null or previous_day - d = 1 then
      running := running + 1;
    else
      best_streak := greatest(best_streak, running);
      running := 1;
    end if;
    previous_day := d;
  end loop;

  best_streak := greatest(best_streak, running);

  if newest_day is not null
     and newest_day >= ((now() at time zone 'UTC')::date - 1) then
    current_streak := 0;
    previous_day := null;
    for d in
      select distinct (c.completed_at at time zone 'UTC')::date as completion_day
      from public.igpat_arena_results r
      join public.igpat_arena_challenges c on c.id = r.challenge_id
      where r.submitted_by = actor
        and r.verified = true
        and c.status = 'COMPLETED'
        and c.completed_at is not null
      order by completion_day desc
    loop
      if previous_day is null then
        current_streak := 1;
      elsif previous_day - d = 1 then
        current_streak := current_streak + 1;
      else
        exit;
      end if;
      previous_day := d;
    end loop;
  end if;

  return jsonb_build_object(
    'current_streak', current_streak,
    'best_streak', best_streak,
    'completion_days', completion_days,
    'seven_day_earned', best_streak >= 7,
    'fourteen_day_earned', best_streak >= 14,
    'thirty_day_earned', best_streak >= 30,
    'basis', 'verified_arena_completion_days'
  );
end;
$$;

revoke all on function public.get_my_buklod_igpat_iron_streak_v1() from public;
revoke all on function public.get_my_buklod_igpat_iron_streak_v1() from anon;
grant execute on function public.get_my_buklod_igpat_iron_streak_v1() to authenticated;
grant execute on function public.get_my_buklod_igpat_iron_streak_v1() to service_role;
