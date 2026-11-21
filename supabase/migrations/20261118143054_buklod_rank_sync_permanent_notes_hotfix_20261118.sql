-- Non-Season2 hotfix. Public rank display only, not reward/points entitlement.
CREATE OR REPLACE FUNCTION public.get_member_circle_ranks_v1(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, rank_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with actor_ok as (
    select p.id
    from public.profiles p
    where p.id=(select auth.uid())
      and p.is_active=true
      -- Presentation-only: public rank does not require verification
    limit 1
  ), requested as (
    select distinct u.user_id
    from unnest(coalesce(p_user_ids,'{}'::uuid[])) as u(user_id)
    where u.user_id is not null
    limit 200
  ), totals as (
    select p.id as user_id,coalesce(b.lifetime_points,0)::bigint as lifetime_points
    from requested q
    join public.profiles p on p.id=q.user_id
      and p.is_active=true
      and not private.buklod_is_platform_official_v1(p.id)
      -- Presentation-only: public rank does not require verification
    left join public.buklod_user_points_balances b on b.user_id=p.id
    where exists(select 1 from actor_ok)
  )
  select t.user_id,
    coalesce((
      select r.rank_name
      from public.buklod_rank_levels r
      where r.is_active=true and r.rank_name is not null and r.min_points<=t.lifetime_points
      order by r.min_points desc,r.rank_order desc nulls last
      limit 1
    ),'Circle Starter V')::text
  from totals t
  order by t.user_id;
$function$
;

create or replace function private.buklod_profile_note_permanent_v1()
returns trigger language plpgsql set search_path to '' as $note$
begin
  new.quick_note_expires_at := null;
  return new;
end;
$note$;
drop trigger if exists buklod_profile_note_permanent_v1 on public.buklod_profile_status;
create trigger buklod_profile_note_permanent_v1
before insert or update of quick_note, quick_note_expires_at
on public.buklod_profile_status
for each row execute function private.buklod_profile_note_permanent_v1();
update public.buklod_profile_status
set quick_note_expires_at = null
where quick_note_expires_at is not null;
CREATE OR REPLACE FUNCTION public.set_buklod_messages_status_note_v1(p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_note text := nullif(btrim(p_note), '');
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if v_note is not null and char_length(v_note) > 80 then
    raise exception 'Note is too long (80 characters max).';
  end if;

  insert into public.buklod_profile_status (
    user_id,
    quick_note,
    quick_note_expires_at,
    updated_at
  )
  values (
    v_user,
    v_note,
    null,
    now()
  )
  on conflict (user_id) do update
  set
    quick_note = excluded.quick_note,
    quick_note_expires_at = excluded.quick_note_expires_at,
    updated_at = now();
end;
$function$
;
comment on column public.buklod_profile_status.quick_note_expires_at is
'Legacy compatibility only; Notes remain permanent until edited or deleted.';
