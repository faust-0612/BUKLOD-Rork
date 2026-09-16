-- BUKLOD IGPAT R35 — cancellation escape hatch before a Squad battle starts.
-- OPEN: only the challenging captain may cancel.
-- ACCEPTED: either participating captain may cancel while neither team has
-- submitted an IGPAT. Once a submission exists, the accepted battle proceeds
-- under the locked roster and fairness rules.

create or replace function public.igpat_cancel_squad_match_v1(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  match_row public.igpat_arena_squad_matches%rowtype;
  is_challenger_captain boolean := false;
  is_opponent_captain boolean := false;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select * into match_row
  from public.igpat_arena_squad_matches m
  where m.id=p_match_id and m.status in ('OPEN','ACCEPTED')
  for update;

  if match_row.id is null then
    raise exception 'Only an open or not-yet-started accepted Squad challenge can be cancelled';
  end if;

  select exists(
    select 1 from public.igpat_arena_squads s
    where s.id=match_row.challenger_squad_id
      and s.captain_user_id=actor
      and s.status='ACTIVE'
  ) into is_challenger_captain;

  select exists(
    select 1 from public.igpat_arena_squads s
    where s.id=match_row.opponent_squad_id
      and s.captain_user_id=actor
      and s.status='ACTIVE'
  ) into is_opponent_captain;

  if match_row.status='OPEN' and not is_challenger_captain then
    raise exception 'Only the challenging captain can cancel an open Squad challenge';
  end if;

  if match_row.status='ACCEPTED' and not (is_challenger_captain or is_opponent_captain) then
    raise exception 'Only a participating captain can cancel this accepted Squad challenge';
  end if;

  if match_row.status='ACCEPTED'
     and (match_row.challenger_post_id is not null or match_row.opponent_post_id is not null) then
    raise exception 'A Squad battle cannot be cancelled after a team submission. Finish the battle instead';
  end if;

  if exists(select 1 from public.igpat_arena_squad_votes v where v.match_id=p_match_id) then
    raise exception 'A Squad battle cannot be cancelled after outside Respect voting begins';
  end if;

  update public.igpat_arena_squad_matches
  set status='CANCELLED'
  where id=p_match_id;

  delete from public.igpat_arena_squad_match_members mm
  where mm.match_id=p_match_id;
end;
$$;

revoke all on function public.igpat_cancel_squad_match_v1(uuid) from public,anon;
grant execute on function public.igpat_cancel_squad_match_v1(uuid) to authenticated,service_role;
