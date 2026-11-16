-- Core collectible and independent Character V3 XP reconciliation.
-- Never reset an inactive Character's level or recredit BP/QMP/Shards.
-- Legacy Core reward ownership and RPC parameters remain unchanged.
create or replace function private.buklod_character_collectible_progress_v1(
 p_user_id uuid,p_character_id text
)returns table(is_active boolean,character_level integer,points_on_character bigint,lifetime_points bigint)
language plpgsql stable security definer set search_path=''
as $fn$
declare
 v_character text:=lower(btrim(coalesce(p_character_id,'')));
 v_lifetime bigint:=0;
 v_baseline bigint:=0;
 v_active text:='phan';
 v_saved bigint:=0;
 v_active_window bigint:=0;
 v_total bigint:=0;
begin
 if p_user_id is null or v_character not in ('phan','quin','van','christian','lhen') then
  return;
 end if;
 v_lifetime:=greatest(coalesce(public.buklod_lifetime_points_for(p_user_id),0),0);
 select s.character_id,greatest(coalesce(s.baseline_lifetime_points,0),0)
 into v_active,v_baseline
 from private.buklod_character_selection_v2 s where s.user_id=p_user_id;
 if not found then
  -- Before a member's first explicit switch, Phan owns their earned points.
  v_active:='phan';v_baseline:=0;
 end if;
 select coalesce(p.earned_points,0) into v_saved
 from private.buklod_character_progress_v3 p
 where p.user_id=p_user_id and p.character_id=v_character;
 v_saved:=greatest(coalesce(v_saved,0),0);
 if v_active=v_character then
  v_active_window:=greatest(v_lifetime-v_baseline,0);
 end if;
 v_total:=v_saved+v_active_window;
 return query select (v_active=v_character),
  private.buklod_character_level_for_delta_v2(v_total)::integer,
  v_total,v_lifetime;
end;
$fn$;
-- Only trusted definer functions can inspect another user's progress.
revoke all on function private.buklod_character_collectible_progress_v1(uuid,text)
 from public,anon,authenticated;
