-- SEASON 2 ONLY. DRAFT. NEVER APPLY TO PRODUCTION.
-- Depends on the isolated S2 core draft AND existing Character V3.
-- The S2 schema is intentionally not exposed through PostgREST.
-- New certification is additive and does NOT revoke or mutate any legacy
-- Character collectibles, level, Circle Rank, BP, QMP, Kingdom Shards or cash.
-- Deploy to a separately reviewed and isolated staging DB only after
-- drift check, migrations, RLS tests, server-adapter review and approval.
begin;
create table if not exists buklod_s2.collectible_mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null check(character_id in (
    'phan','quin','van','christian','lhen',
    'ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')),
  character_level smallint not null check(character_level between 1 and 20),
  item_index smallint not null check(item_index between 1 and 5),
  source_receipt_id bigint references buklod_s2.source_receipt(id),
  foundation_week date,
  request_nonce uuid not null,
  rule_version text not null check(length(rule_version) between 8 and 100),
  certified_at timestamptz not null default now(),
  primary key(user_id,character_id,character_level,item_index),
  unique(user_id,request_nonce),
  -- Every verified source and Foundation week may certify only one item.
  unique(user_id,source_receipt_id),
  unique(user_id,foundation_week),
  constraint mastery_proof_shape check (
    (item_index in (1,5) and source_receipt_id is null and foundation_week is null)
    or (item_index in (2,3) and source_receipt_id is not null and foundation_week is null)
    or (item_index=4 and source_receipt_id is null and foundation_week is not null)
  )
);
create index if not exists collectible_mastery_user_created
 on buklod_s2.collectible_mastery(user_id,certified_at desc);
alter table buklod_s2.collectible_mastery enable row level security;
revoke all on buklod_s2.collectible_mastery from public,anon,authenticated;
grant select,insert on buklod_s2.collectible_mastery to service_role;

-- DO NOT expose this RPC directly to authenticated/anon. A future server
-- adapter must authenticate requester, derive userId from verified JWT,
-- reject cross-account requests and submit only server-known receipt IDs.
create or replace function buklod_s2.claim_collectible_mastery(
  p_user uuid,
  p_character text,
  p_level smallint,
  p_index smallint,
  p_nonce uuid,
  p_source_receipt_id bigint default null,
  p_foundation_week date default null
) returns jsonb language plpgsql security invoker set search_path=''
as $s2$
declare
  c buklod_s2.control;
  s record;
  v_level smallint;
  v_saved bigint;
  v_lifetime bigint;
  v_prior_count int;
  v_existing record;
  v_kind text;
  v_receipt buklod_s2.source_receipt;
begin
  c:=buklod_s2.assert_active();
  if p_user is null or p_nonce is null or
     p_character not in ('phan','quin','van','christian','lhen',
       'ace','ellusur','jawo','mitch','niel','angel','vhen','trudice') or
     p_level not between 1 and 20 or p_index not between 1 and 5 then
    raise exception 'INVALID_S2_COLLECTIBLE_REQUEST' using errcode='22023';
  end if;
  if public.buklod_is_official_system_admin(p_user) then
    raise exception 'OFFICIAL_SYSTEM_ADMIN_EXCLUDED' using errcode='42501';
  end if;
  -- Existing per-user S2 wallet acts as the serialization mutex.
  insert into buklod_s2.wallet(user_id) values(p_user)
    on conflict(user_id) do nothing;
  perform 1 from buklod_s2.wallet where user_id=p_user for update;
  -- Idempotency key is tied to the original request, not a client item alias.
  select m.* into v_existing from buklod_s2.collectible_mastery m
    where m.user_id=p_user and m.request_nonce=p_nonce;
  if found then
    if v_existing.character_id=p_character and
       v_existing.character_level=p_level and v_existing.item_index=p_index then
      return jsonb_build_object('status','ALREADY_CERTIFIED',
        'character_id',p_character,'level',p_level,'item_index',p_index);
    end if;
    raise exception 'REQUEST_NONCE_REUSED' using errcode='23505';
  end if;
  if exists(select 1 from buklod_s2.collectible_mastery m
    where m.user_id=p_user and m.character_id=p_character and
      m.character_level=p_level and m.item_index=p_index) then
    return jsonb_build_object('status','ALREADY_CERTIFIED',
       'character_id',p_character,'level',p_level,'item_index',p_index);
  end if;
  select selection.character_id,selection.baseline_lifetime_points
    into s from private.buklod_character_selection_v2 selection
    where selection.user_id=p_user;
  if not found or s.character_id is distinct from p_character then
    raise exception 'CHARACTER_NOT_ACTIVE' using errcode='42501';
  end if;
  select coalesce(p.earned_points,0) into v_saved
    from private.buklod_character_progress_v3 p
    where p.user_id=p_user and p.character_id=p_character;
  if not found then v_saved:=0;end if;
  select coalesce(b.lifetime_points,0) into v_lifetime
    from public.buklod_user_points_balances b where b.user_id=p_user;
  if not found then v_lifetime:=0;end if;
  v_level:=private.buklod_character_level_for_delta_v2(
    greatest(v_saved,0)+greatest(v_lifetime-greatest(coalesce(s.baseline_lifetime_points,0),0),0)
  );
  if v_level<p_level then
    return jsonb_build_object('status','LOCKED_LEVEL',
        'current_level',v_level,'required_level',p_level);
  end if;
  if p_index in (2,3) then
    if p_source_receipt_id is null or p_foundation_week is not null then
      raise exception 'RECEIPT_REQUIRED' using errcode='22023';
    end if;
    select r.* into v_receipt from buklod_s2.source_receipt r
      where r.id=p_source_receipt_id and r.user_id=p_user
        and r.source_at>=c.starts_at and r.source_at<=c.ends_at;
    if not found then
      raise exception 'RECEIPT_NOT_VERIFIED_OR_OUTSIDE_SEASON' using errcode='42501';
    end if;
    if (p_index=2 and v_receipt.source_kind<>'kl_verified_chapter') or
       (p_index=3 and v_receipt.source_kind not in (
         'today_dugtong','wall_original_post','wall_meaningful_comment')) then
      raise exception 'WRONG_RECEIPT_KIND' using errcode='42501';
    end if;
    if exists(select 1 from buklod_s2.collectible_mastery m
       where m.user_id=p_user and m.source_receipt_id=p_source_receipt_id) then
      return jsonb_build_object('status','RECEIPT_ALREADY_USED');
    end if;
  elsif p_index=4 then
    if p_source_receipt_id is not null or p_foundation_week is null then
      raise exception 'FOUNDATION_CLAIM_REQUIRED' using errcode='22023';
    end if;
    if not exists(select 1 from buklod_s2.weekly_claim w
       where w.user_id=p_user and w.week_start=p_foundation_week)
       or not exists(select 1 from buklod_s2.badge_grant b
         where b.user_id=p_user and b.week_start=p_foundation_week
         and b.badge_key='s2_weekly_foundation' and b.revoked_at is null) then
      raise exception 'FOUNDATION_NOT_VERIFIED' using errcode='42501';
    end if;
    if exists(select 1 from buklod_s2.collectible_mastery m
       where m.user_id=p_user and m.foundation_week=p_foundation_week) then
      return jsonb_build_object('status','FOUNDATION_ALREADY_USED');
    end if;
  elsif p_index=5 then
    if p_source_receipt_id is not null or p_foundation_week is not null then
      raise exception 'LEGACY_DOES_NOT_USE_EXTERNAL_RECEIPT' using errcode='22023';
    end if;
    select count(*) into v_prior_count from buklod_s2.collectible_mastery m
      where m.user_id=p_user and m.character_id=p_character
        and m.character_level=p_level and m.item_index between 1 and 4;
    if v_prior_count<>4 then
      return jsonb_build_object('status','PRIOR_FOUR_ITEMS_REQUIRED',
       'complete',v_prior_count,'required',4);
    end if;
  else
    if p_source_receipt_id is not null or p_foundation_week is not null then
      raise exception 'ORIGIN_STAGE_ONLY' using errcode='22023';
    end if;
  end if;
  insert into buklod_s2.collectible_mastery(
    user_id,character_id,character_level,item_index,source_receipt_id,
    foundation_week,request_nonce,rule_version)
  values(p_user,p_character,p_level,p_index,p_source_receipt_id,
    p_foundation_week,p_nonce,'s2-collectible-mastery-r1-preview');
  return jsonb_build_object('status','CERTIFIED','character_id',p_character,
    'level',p_level,'item_index',p_index,'rule_version',
    's2-collectible-mastery-r1-preview','tokens_minted',0,'bp_delta',0,
    'cash_delta',0,'qmp_delta',0,'legacy_inventory_mutated',false);
end;
$s2$;
revoke all on function buklod_s2.claim_collectible_mastery(
  uuid,text,smallint,smallint,uuid,bigint,date) from public,anon,authenticated;
grant execute on function buklod_s2.claim_collectible_mastery(
  uuid,text,smallint,smallint,uuid,bigint,date) to service_role;
commit;
