-- Genesis Estate RPC transactional regression — run ONLY in an isolated staging/test
-- Postgres with migration 20261121134500 already applied. NEVER run against live.
-- Every synthetic row and time adjustment is rolled back.
begin;
do $estate_test$
declare
 u uuid:=gen_random_uuid();
 other_user uuid:=gen_random_uuid();
 scope_id uuid:=gen_random_uuid();
 first_key text:='qa-estate-start-'+gen_random_uuid()::text;
 second_key text:='qa-estate-new-'+gen_random_uuid()::text;
 grant_key text:='qa-estate-grant-'+gen_random_uuid()::text;
 j jsonb;
 w jsonb;
 expected_debit bigint;
begin
 -- New exposed tables cannot be directly mutated by clients; every table has RLS.
 if exists (
   select 1 from pg_class c
   where c.oid in (
     'public.buklod_estate_wallet_v1'::regclass,
     'public.buklod_estate_progress_v1'::regclass,
     'public.buklod_estate_event_v1'::regclass,
     'public.buklod_estate_build_v1'::regclass
   ) and not c.relrowsecurity
 ) then raise exception 'Estate table has no RLS'; end if;
 if has_table_privilege('authenticated','public.buklod_estate_wallet_v1','INSERT')
 or has_table_privilege('authenticated','public.buklod_estate_wallet_v1','UPDATE')
 or has_table_privilege('authenticated','public.buklod_estate_progress_v1','UPDATE')
 or has_table_privilege('anon','public.buklod_estate_wallet_v1','SELECT')
 then raise exception 'Estate tables expose direct client writes/read'; end if;
 if has_function_privilege('authenticated',
 'public.award_buklod_estate_resources_v1(uuid,text,bigint,bigint,bigint,bigint)','EXECUTE')
 then raise exception 'Verified grant/mint function exposed to authenticated clients';end if;
 if not has_function_privilege('authenticated',
 'public.save_buklod_estate_design_v1(text,uuid,text,jsonb)','EXECUTE')
 then raise exception 'Authorized design RPC is unreachable';end if;

 perform set_config('request.jwt.claim.sub',u::text,true);
 j:=public.get_buklod_estate_snapshot_v1('USER',u,'lot');
 if j->>'server_verified'<>'true' or (j->>'level')::int<>1
 or (j->>'stage')::int<>0 or (j->'wallet'->>'timber')::bigint<>0
 then raise exception 'Unbuilt member estate returned fictional assets';end if;
 if j->>'can_build'<>'true' then raise exception 'Owner cannot build their own lot';end if;

 begin
   perform public.get_buklod_estate_snapshot_v1('USER',other_user,'lot');
   raise exception 'Cross-account read unexpectedly permitted';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.get_buklod_estate_snapshot_v1('SCOPE',scope_id,'cluster');
   raise exception 'Nonmember shared lot unexpectedly readable';
 exception when insufficient_privilege then null;
 end;
 begin
   perform public.contribute_buklod_estate_resources_v1(scope_id,
     'qa-donation-'+gen_random_uuid()::text,0,1,0,0);
   raise exception 'Unverified cross-scope contribution unexpectedly permitted';
 exception when insufficient_privilege then null;
 end;

 begin
   perform public.start_buklod_estate_construction_v1('USER',u,'lot',first_key);
   raise exception 'Member constructed without earned materials';
 exception when sqlstate 'P0001' then null;
 end;
 if not public.award_buklod_estate_resources_v1(u,grant_key,500,100,100,100)
 then raise exception 'First verified resource grant failed';end if;
 if public.award_buklod_estate_resources_v1(u,grant_key,500,100,100,100)
 then raise exception 'Duplicate participation event minted materials';end if;
 j:=public.get_buklod_estate_snapshot_v1('USER',u,'lot');
 if (j->'wallet'->>'development_xp')::bigint<>500 then
   raise exception 'Grant did not conserve earned XP';end if;
 expected_debit:=(j->'next_cost'->>'development_xp')::bigint;
 if expected_debit<=0 then raise exception 'Missing server-authored cost quote';end if;

 -- Cosmetic edits must persist for this member only; unsupported choices rejected.
 j:=public.save_buklod_estate_design_v1('USER',u,'lot',
  '{"finish":"garden","roof":"hip","ground":"flower","fence":"hedge",
    "windows":"panorama","lights":"starlight","door":"glass",
    "path":"pavers","yard":"pond"}'::jsonb);
 if j->'cosmetics'->>'yard'<>'pond' or j->'cosmetics'->>'door'<>'glass'
 then raise exception 'Nine-part saved cosmetics were lost';end if;
 begin
   perform public.save_buklod_estate_design_v1('USER',u,'lot',
     '{"finish":"invalid"}'::jsonb);
   raise exception 'Unknown design option was accepted';
 exception when sqlstate '22023' then null;
 end;

 j:=public.start_buklod_estate_construction_v1('USER',u,'lot',first_key);
 if j->>'pending_key'<>first_key then raise exception 'Build not pending';end if;
 w:=j->'wallet';
 if (w->>'development_xp')::bigint<>500-expected_debit
 then raise exception 'Construction debit mismatched signed cost';end if;
 j:=public.start_buklod_estate_construction_v1('USER',u,'lot',first_key);
 if j->'wallet'<>w then raise exception 'Retry charged materials twice';end if;
 begin
   perform public.start_buklod_estate_construction_v1('USER',u,'lot',second_key);
   raise exception 'Overlapping build allowed';
 exception when sqlstate 'P0001' then null;
 end;
 begin
   perform public.complete_buklod_estate_construction_v1('USER',u,'lot');
   raise exception 'Client completed unfinished timer';
 exception when sqlstate 'P0001' then null;
 end;

 -- Advance only a synthetic test row under rollback.
 update public.buklod_estate_progress_v1 set build_finish_at=now()-interval '1 minute'
 where owner_kind='USER' and owner_id=u and track='lot';
 j:=public.complete_buklod_estate_construction_v1('USER',u,'lot');
 if (j->>'stage')::int<>1 or j->>'pending_key' is not null
 then raise exception 'Construction completion failed';end if;
 j:=public.complete_buklod_estate_construction_v1('USER',u,'lot');
 if (j->>'stage')::int<>1 then raise exception 'Repeated completion advanced twice';end if;

 -- House progress must be independent from Lot, despite a common personal wallet.
 j:=public.get_buklod_estate_snapshot_v1('USER',u,'house');
 if (j->>'stage')::int<>0 or (j->>'level')::int<>1
 then raise exception 'Lot development incorrectly advanced the House';end if;
 if exists(select 1 from public.buklod_points_ledger where user_id=u)
 then raise exception 'Estate progression minted a BUKLOD Points ledger record';end if;
end $estate_test$;
rollback;
