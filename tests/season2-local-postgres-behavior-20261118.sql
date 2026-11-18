-- LOCAL ephemeral PostgreSQL only, after fixture + S2 DRAFT script.
-- Source IDs are fabricated synthetic data, not real accounts.
\set ON_ERROR_STOP on
do $test$
declare bad boolean:=false;
begin
 begin perform buklod_s2.assert_active();
 exception when sqlstate '55000' then bad:=true;end;
 if not bad then raise exception 'FAIL: S2 unexpectedly active by default';end if;
end;
$test$;

-- Enable only INSIDE THE THROWAWAY LOCAL DATABASE, with S1 deliberately
-- unreconciled first. This must fail until the isolated mock S1 is finalized.
update buklod_s2.control set enabled=true,
  starts_at=now()-interval '6 days',ends_at=now()+interval '90 days';
do $test$
declare bad boolean:=false;
begin
 begin perform buklod_s2.assert_active();
 exception when sqlstate '55000' then bad:=true;end;
 if not bad then raise exception 'FAIL: S1 active must block Season2';end if;
end;
$test$;

update public.buklod_rank_seasons set status='closed' where season_number=1;
insert into public.buklod_rank_season_results(season_id,user_id)
values('11111111-1111-4111-8111-111111111111',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.community_posts(id,user_id,category,body,created_at)
values
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'discussion','Long original and meaningful post for verified Season 2 participation.',now()-interval '4 minutes'),
 ('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'reflection','A separate genuine discussion thread for verified comment testing.',now()-interval '9 minutes');
insert into public.comments(id,post_id,user_id,body,created_at)
values('44444444-4444-4444-8444-444444444444',
 '33333333-3333-4333-8333-333333333333',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 'Meaningful response to a different person in the community.',now()-interval '3 minutes');
insert into public.buklod_community_dugtongs(
 id,user_id,root_post_id,body,created_at,moderation_state)
values('55555555-5555-4555-8555-555555555555',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '33333333-3333-4333-8333-333333333333',
 'A meaningful, original and approved continuation.',now()-interval '2 minutes','approved');
insert into public.kl_reading_sessions(user_id,episode_id,completed_at)
values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 '66666666-6666-4666-8666-666666666666',now()-interval '15 minutes');
insert into public.kl_quiz_attempts(id,episode_id,user_id,verified_at)
values('77777777-7777-4777-8777-777777777777',
 '66666666-6666-4666-8666-666666666666',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()-interval '10 minutes');

-- Protected platform Official is permanently excluded from S2 reward writes.
insert into auth.users(id) values('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
insert into public.buklod_foundation_protected_principals
 (user_id,principal_key,protected)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'OFFICIAL_SYSTEM_ADMIN',true);
insert into public.community_posts(id,user_id,category,body,created_at)
values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 'discussion',
 'A substantial synthetic official-only post which must never earn tokens.',
 now()-interval '2 minutes');
set role service_role;
do $test$
declare refused boolean:=false;
begin
  begin
    perform buklod_s2.credit_main_source(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'wall_original_post',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  exception when sqlstate '42501' then refused:=true;
  end;
  if not refused then raise exception 'FAIL: protected Official earned a Season2 token';end if;
  if exists(select 1 from buklod_s2.wallet
    where user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd') then
    raise exception 'FAIL: Official wallet was created';end if;
end;
$test$;
reset role;

-- The production client roles cannot read or invoke the new schema.
do $test$
begin
 if has_schema_privilege('authenticated','buklod_s2','USAGE')
    or has_schema_privilege('anon','buklod_s2','USAGE')
    or has_table_privilege('authenticated','buklod_s2.wallet','SELECT')
    or has_table_privilege('anon','buklod_s2.wallet','SELECT')
 then raise exception 'FAIL: client schema or table access present';end if;
end;
$test$;

set role service_role;
do $test$
declare a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        result jsonb;bad boolean:=false;current_balance int;
begin
 begin
    perform buklod_s2.credit_main_source(b,'wall_original_post',
       '22222222-2222-4222-8222-222222222222');
 exception when others then bad:=true;end;
 if not bad then raise exception 'FAIL: other-user spoof accepted';end if;
 result:=buklod_s2.credit_main_source(a,'wall_original_post',
       '22222222-2222-4222-8222-222222222222');
 if result->>'status'<>'EARNED' or (result->>'minted')::int<>2
 then raise exception 'FAIL: post credit %',result;end if;
 result:=buklod_s2.credit_main_source(a,'wall_original_post',
       '22222222-2222-4222-8222-222222222222');
 if result->>'status'<>'DUPLICATE' then
    raise exception 'FAIL: duplicate post credit %',result;end if;
 result:=buklod_s2.credit_main_source(a,'kl_verified_chapter',
       '77777777-7777-4777-8777-777777777777');
 if (result->>'minted')::int<>3 then raise exception 'FAIL: KL credit %',result;end if;
 result:=buklod_s2.credit_main_source(a,'wall_meaningful_comment',
       '44444444-4444-4444-8444-444444444444');
 if (result->>'minted')::int<>1 then raise exception 'FAIL: comment %',result;end if;
 result:=buklod_s2.credit_main_source(a,'today_dugtong',
       '55555555-5555-4555-8555-555555555555');
 if (result->>'minted')::int<>2 then raise exception 'FAIL: Dugtong %',result;end if;
 select balance into current_balance from buklod_s2.wallet where user_id=a;
 if current_balance<>8 then raise exception 'FAIL: wallet should 8, found %',current_balance;end if;
 if (select count(*) from buklod_s2.source_receipt where user_id=a)<>4
 then raise exception 'FAIL: replay duplicated receipt';end if;
 if (select coalesce(sum(amount),0) from buklod_s2.token_ledger
      where user_id=a)<>current_balance
 then raise exception 'FAIL: ledger/wallet drift';end if;
end;
$test$;

do $test$
declare a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 v_week date;result jsonb;
begin
 select (starts_at at time zone 'Asia/Manila')::date
 into v_week from buklod_s2.control;
 result:=buklod_s2.claim_weekly_foundation(a,v_week);
 if result->>'status'<>'CLAIMED' then raise exception 'FAIL: P0 badge %',result;end if;
 result:=buklod_s2.claim_weekly_foundation(a,v_week);
 if result->>'status'<>'ALREADY_CLAIMED'
 then raise exception 'FAIL: weekly replay %',result;end if;
 if (select count(*) from buklod_s2.badge_grant where user_id=a)<>1
 then raise exception 'FAIL: duplicate badge';end if;
 if (select count(*) from buklod_s2.weekly_claim where user_id=a)<>1
 then raise exception 'FAIL: duplicate weekly receipt';end if;
end;
$test$;
reset role;

-- Cosmetics remain disabled until independently enabled inside local fixture.
-- Artificial balance is ONLY a test fixture (not a real token mint).
update buklod_s2.cosmetic_catalog set enabled=true
  where item_key='accessory_finish_emerald';
insert into buklod_s2.wallet(user_id,earned,balance)
values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',80,80);
set role service_role;
do $test$
declare b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 nonce uuid:='88888888-8888-4888-8888-888888888888';result jsonb;
begin
 result:=buklod_s2.buy_cosmetic(b,'accessory_finish_emerald',nonce);
 if result->>'status'<>'PURCHASED' or (result->>'balance')::int<>50
 then raise exception 'FAIL: purchase %',result;end if;
 result:=buklod_s2.buy_cosmetic(b,'accessory_finish_emerald',nonce);
 if result->>'status'<>'ALREADY_PURCHASED'
 then raise exception 'FAIL: repeated purchase %',result;end if;
 if (select balance from buklod_s2.wallet where user_id=b)<>50
 then raise exception 'FAIL: double debit';end if;
 if (select count(*) from buklod_s2.purchases where user_id=b)<>1
 then raise exception 'FAIL: duplicate purchased item';end if;
end;
$test$;
-- S2 cosmetic equipment must bind to the canonical currently active
-- character and preserve previous Character loadout across switches.
do $test$
declare a uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        blocked boolean:=false;
begin
 begin
   perform buklod_s2.equip_cosmetic(a,'accessory_finish','accessory_finish_emerald');
 exception when sqlstate '42501' then blocked:=true; end;
 if not blocked then raise exception 'FAIL: non-owner equipped cosmetic';end if;
end;
$test$;
set role service_role;
do $test$
declare b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        result jsonb;
begin
 result:=buklod_s2.equip_cosmetic(b,'accessory_finish','accessory_finish_emerald');
 if result->>'status'<>'EQUIPPED' or result->>'character_id'<>'phan' then
   raise exception 'FAIL: first character equip %',result;end if;
end;
$test$;
reset role;
-- Synthetic canonical Character switch; never mutate actual Character data.
update private.buklod_character_world_v3 set active_character_id='van'
 where user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set role service_role;
do $test$
declare b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        result jsonb;
begin
 result:=buklod_s2.equip_cosmetic(b,'accessory_finish','accessory_finish_emerald');
 if result->>'status'<>'EQUIPPED' or result->>'character_id'<>'van' then
   raise exception 'FAIL: second character equip %',result;end if;
 if (select count(*) from buklod_s2.equipped_cosmetics where user_id=b)<>2
 then raise exception 'FAIL: switching discarded character loadout';end if;
 result:=buklod_s2.equip_cosmetic(b,'accessory_finish',null);
 if result->>'status'<>'UNEQUIPPED' then
   raise exception 'FAIL: unequip %',result;end if;
 if (select count(*) from buklod_s2.equipped_cosmetics where user_id=b)<>1
   or not exists(select 1 from buklod_s2.equipped_cosmetics
     where user_id=b and character_id='phan' and item_key='accessory_finish_emerald')
 then raise exception 'FAIL: unequip affected prior Character';end if;
end;
$test$;
reset role;
-- Null SQL CHECK semantics must NEVER permit un-audited badge revocation.
do $test$
declare rejected boolean:=false;
begin
  begin
    insert into buklod_s2.badge_grant(
      user_id,badge_key,week_start,revoked_at,revoked_case_id)
    values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      's2_invalid_revocation',current_date,now(),null);
  exception when check_violation then rejected:=true;
  end;
  if not rejected then
    raise exception 'FAIL: badge revocation with NULL case ID passed';
  end if;
end;
$test$;
-- P0 is achievement-based: a verified source with ZERO spendable tokens
-- (because of the day cap) must still satisfy learning+community foundation.
insert into auth.users(id)values('ffffffff-ffff-4fff-8fff-ffffffffffff');
insert into public.community_posts(id,user_id,category,body,created_at)
values('f2222222-2222-4222-8222-222222222222',
  'ffffffff-ffff-4fff-8fff-ffffffffffff','reflection',
  'An independently verified synthetic post that earns no currency due to cap.',
  now()-interval '3 minutes');
insert into public.kl_reading_sessions(user_id,episode_id,completed_at)
values('ffffffff-ffff-4fff-8fff-ffffffffffff',
 'f6666666-6666-4666-8666-666666666666',now()-interval '18 minutes');
insert into public.kl_quiz_attempts(id,episode_id,user_id,verified_at)
values('f7777777-7777-4777-8777-777777777777',
 'f6666666-6666-4666-8666-666666666666',
 'ffffffff-ffff-4fff-8fff-ffffffffffff',now()-interval '12 minutes');
update buklod_s2.control set daily_token_cap=0;
set role service_role;
do $test$
declare f uuid:='ffffffff-ffff-4fff-8fff-ffffffffffff';
        w date; a jsonb;b jsonb;claim jsonb;
begin
 select (starts_at at time zone 'Asia/Manila')::date into w
 from buklod_s2.control;
 a:=buklod_s2.credit_main_source(f,'kl_verified_chapter',
   'f7777777-7777-4777-8777-777777777777');
 b:=buklod_s2.credit_main_source(f,'wall_original_post',
   'f2222222-2222-4222-8222-222222222222');
 if (a->>'minted')::int<>0 or (b->>'minted')::int<>0 then
   raise exception 'FAIL: token ceiling 0 still minted';end if;
 claim:=buklod_s2.claim_weekly_foundation(f,w);
 if claim->>'status'<>'CLAIMED' then
   raise exception 'FAIL: P0 ignored valid zero-token evidence %',claim;end if;
 if (select balance from buklod_s2.wallet where user_id=f)<>0 then
   raise exception 'FAIL: fake spendable token minted for P0';end if;
end;
$test$;
reset role;
update buklod_s2.control set daily_token_cap=12;

-- Two 7-day flex credits (split across two weeks) are replay-safe,
-- opt-in and cannot silently be granted a third time.
set role service_role;
do $test$
declare b uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
        w date; r jsonb; refused boolean:=false;
begin
 select (starts_at at time zone 'Asia/Manila')::date into w
 from buklod_s2.control;
 r:=buklod_s2.allocate_flex(b,w,1,'a1111111-1111-4111-8111-111111111111');
 if r->>'status'<>'ALLOCATED' or (r->>'remaining')::int<>1 then
   raise exception 'FAIL: first flex %',r;end if;
 r:=buklod_s2.allocate_flex(b,w,1,'a1111111-1111-4111-8111-111111111111');
 if r->>'status'<>'ALREADY_ALLOCATED' then
   raise exception 'FAIL: flex replay %',r;end if;
 r:=buklod_s2.allocate_flex(b,w+7,1,'a2222222-2222-4222-8222-222222222222');
 if r->>'status'<>'ALLOCATED' or (r->>'remaining')::int<>0 then
   raise exception 'FAIL: second flex %',r;end if;
 begin
   perform buklod_s2.allocate_flex(b,w+14,1,
    'a3333333-3333-4333-8333-333333333333');
 exception when others then refused:=true;
 end;
 if not refused then raise exception 'FAIL: accepted a third Flex credit';end if;
end;
$test$;
reset role;

select 'S2 LOCAL POSTGRES BEHAVIOR TESTS PASSED; NOT SUPABASE OR PROD' as evidence;
