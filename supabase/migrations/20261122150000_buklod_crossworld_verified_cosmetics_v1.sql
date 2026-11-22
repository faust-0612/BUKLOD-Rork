-- BUKLOD Genesis cross-world display-only achievement receipts v1.
-- Source authority: existing server-scored 3/3 Kingdom Mastery Checks, each
-- joined to its canonical +2 BP ledger event (which this migration NEVER edits).
-- Does NOT award BP, Shards, Diamonds, QMP, transferable items or PvP power.
-- Estate and ranked Arena proof sources are deliberately NOT enabled here.
-- New display receipts are NOT canonical Character inventory or property deeds.
create table if not exists private.buklod_crossworld_cosmetic_receipts_v1 (
  user_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_key text not null check (cosmetic_key in (
    'house_artisan_planter', 'arena_apprentice_banner',
    'house_heritage_pergola', 'arena_kingdom_banner',
    'house_verified_fountain', 'arena_verified_veteran_emblem'
  )),
  source_key text not null check (
    source_key in ('kingdom:verified_checks:1','kingdom:verified_checks:10',
                   'kingdom:verified_checks:25')
  ),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, cosmetic_key),
  unique (user_id, source_key, cosmetic_key)
);
alter table private.buklod_crossworld_cosmetic_receipts_v1 enable row level security;
revoke all on private.buklod_crossworld_cosmetic_receipts_v1 from public, anon, authenticated;

-- Bounded, owner-scoped, read-only view of already-granted display receipts.
create or replace function public.get_my_buklod_crossworld_cosmetics_v1()
returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
  v_owned jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select count(distinct a.game_id)::integer into v_count
  from private.buklod_kingdom_mastery_attempts_v1 a
  join public.buklod_points_ledger l on l.user_id=a.user_id
    and l.source_key='kingdom:mastery:v1:' || a.game_id
    and l.activity_type='game_first_qualified'
    and l.direction='credit' and l.points=2
  where a.user_id=v_uid and a.status='credited';
  select coalesce(jsonb_agg(
    jsonb_build_object('key',r.cosmetic_key,
      'destination', case when r.cosmetic_key like 'house_%' then 'house'
                          when r.cosmetic_key like 'arena_%' then 'arena'
                          else 'kingdom' end,
      'source_key',r.source_key,
      'unlocked_at',r.unlocked_at)
    order by r.unlocked_at, r.cosmetic_key), '[]'::jsonb)
  into v_owned
  from private.buklod_crossworld_cosmetic_receipts_v1 r
  where r.user_id=v_uid;
  return jsonb_build_object('ok',true,'version',1,'source','server',
    'verified_checks',v_count,'items',v_owned,
    'display_only',true,'tradeable',false,'bp_awarded',0,
    'arena_stat_bonus',0);
end;
$function$;

-- The only client mutation: refresh valid, server-derived showcase receipts.
-- No client-supplied score, tier, source key, target user or item ID.
create or replace function public.claim_my_buklod_crossworld_cosmetics_v1()
returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select count(distinct a.game_id)::integer into v_count
  from private.buklod_kingdom_mastery_attempts_v1 a
  join public.buklod_points_ledger l on l.user_id=a.user_id
    and l.source_key='kingdom:mastery:v1:' || a.game_id
    and l.activity_type='game_first_qualified'
    and l.direction='credit' and l.points=2
  where a.user_id=v_uid and a.status='credited';

  insert into private.buklod_crossworld_cosmetic_receipts_v1
    (user_id,cosmetic_key,source_key)
  select v_uid, v.cosmetic_key,
    'kingdom:verified_checks:' || v.threshold::text
  from (values
    (1,'house_artisan_planter'), (1,'arena_apprentice_banner'),
    (10,'house_heritage_pergola'), (10,'arena_kingdom_banner'),
    (25,'house_verified_fountain'), (25,'arena_verified_veteran_emblem')
  ) as v(threshold,cosmetic_key)
  where v_count>=v.threshold
  on conflict (user_id,cosmetic_key) do nothing;

  return public.get_my_buklod_crossworld_cosmetics_v1();
end;
$function$;

revoke all on function public.get_my_buklod_crossworld_cosmetics_v1()
  from public,anon,authenticated;
revoke all on function public.claim_my_buklod_crossworld_cosmetics_v1()
  from public,anon,authenticated;
grant execute on function public.get_my_buklod_crossworld_cosmetics_v1()
  to authenticated;
grant execute on function public.claim_my_buklod_crossworld_cosmetics_v1()
  to authenticated;

comment on table private.buklod_crossworld_cosmetic_receipts_v1 is
  'Display-only, non-tradable milestone receipts, not Character item ownership or a spendable ledger.';
comment on function public.claim_my_buklod_crossworld_cosmetics_v1() is
  'Idempotently grants six bounded cross-world showcase visuals from existing first 3/3 server-verified Kingdom checks (1/10/25). No client-supplied score, item or recipient; no BP, Diamond, QMP or Arena effect.';
