-- BUKLOD IGPAT R43
-- Skill badges are computed from verified Arena outcomes; no duplicate collectible table.
-- Current supported evidence source: completed King of the Hill wins in approved categories.

create or replace function public.get_my_buklod_igpat_skill_badges_v1()
returns table(
  badge_key text,
  badge_label text,
  evidence_category text,
  earned boolean,
  verified_wins integer,
  criteria text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return query
  with badge_map as (
    select * from (values
      ('athlete'::text, 'Athlete'::text, 'sports'::text),
      ('speaker'::text, 'Speaker'::text, 'preaching'::text),
      ('musician'::text, 'Musician'::text, 'singing'::text),
      ('teacher'::text, 'Teacher'::text, 'teaching'::text),
      ('creator'::text, 'Creator'::text, 'creativity'::text)
    ) as x(badge_key, badge_label, category_key)
  ), wins as (
    select c.arena_category as category_key, count(*)::integer as verified_wins
    from public.igpat_arena_challenges c
    where c.status = 'COMPLETED'
      and c.mode = 'king_of_the_hill'
      and c.winner_user_id = actor
      and c.arena_category is not null
    group by c.arena_category
  )
  select
    b.badge_key,
    b.badge_label,
    b.category_key,
    coalesce(w.verified_wins, 0) >= 1,
    coalesce(w.verified_wins, 0),
    concat('Earn 1 verified King of the Hill win in ', initcap(replace(b.category_key, '_', ' ')), '.')::text
  from badge_map b
  left join wins w on w.category_key = b.category_key
  order by b.badge_label;
end;
$$;

revoke all on function public.get_my_buklod_igpat_skill_badges_v1() from public;
revoke all on function public.get_my_buklod_igpat_skill_badges_v1() from anon;
grant execute on function public.get_my_buklod_igpat_skill_badges_v1() to authenticated;
grant execute on function public.get_my_buklod_igpat_skill_badges_v1() to service_role;
