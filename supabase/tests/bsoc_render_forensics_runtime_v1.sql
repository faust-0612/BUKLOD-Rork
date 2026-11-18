-- Runs only in disposable PG17 CI after fixture + migration.
-- Tests real SQL execution, not string matching.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);

do $$
declare
  result jsonb;
  saved record;
begin
  result := public.buklod_attach_render_forensics_v1(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'NULLISH_ACCESS','CONNECT',
    'src/components/connect/MessageList.tsx',
    22,4,1,492305,
    '1.3.2','123e4567-e89b-42d3-a456-426614174000','staging'
  );
  if result->>'recorded' <> 'true' or result->>'inserted' <> 'true' then
    raise exception 'Valid first forensic write rejected';
  end if;
  select * into saved from public.bsoc_render_forensics_v1
    where health_event_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if not found or saved.user_id <> auth.uid()
     or saved.ota_update_id <> '123e4567-e89b-42d3-a456-426614174000'::uuid
     or saved.source_line <> 22 or saved.bundle_column <> 492305 then
    raise exception 'Forensic identity/coordinate lost';
  end if;

  -- First write wins: retries cannot replace the originally seen source/OTA.
  result := public.buklod_attach_render_forensics_v1(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','TYPE_ERROR','UNKNOWN',
    null,null,null,5,5,'1.3.4',
    '123e4567-e89b-42d3-a456-426614174001','production');
  if result->>'inserted' <> 'false' then
    raise exception 'Duplicate forensic replay unexpectedly inserted';
  end if;
  select * into saved from public.bsoc_render_forensics_v1
    where health_event_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if saved.cause_code <> 'NULLISH_ACCESS'
     or saved.ota_update_id <> '123e4567-e89b-42d3-a456-426614174000'::uuid then
    raise exception 'Replay changed original crash evidence';
  end if;

  -- An operator with a normal member token cannot attach to other users.
  begin
    perform public.buklod_attach_render_forensics_v1(
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','TYPE_ERROR','UNKNOWN');
    raise exception 'CROSS_ACCOUNT_WRITE_NOT_BLOCKED';
  exception when sqlstate '42501' then null;
  end;

  -- Only route SYS-500 render evidence accepted.
  begin
    perform public.buklod_attach_render_forensics_v1(
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc','TYPE_ERROR','ROUTE');
    raise exception 'NON_RENDER_WRITE_NOT_BLOCKED';
  exception when sqlstate '42501' then null;
  end;

  -- Path traversal, arbitrary text and unsupported cause are rejected.
  begin
    perform public.buklod_attach_render_forensics_v1(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','UNKNOWN','ROUTE',
      'src/components/../private/secret.tsx',5,3);
    raise exception 'TRAVERSAL_NOT_BLOCKED';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.buklod_attach_render_forensics_v1(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PRIVATE_SECRET','ROUTE');
    raise exception 'UNSAFE_CATEGORY_NOT_BLOCKED';
  exception when sqlstate '22023' then null;
  end;
end;
$$;

-- RLS restricts even a direct SELECT to the current authenticated identity.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$
begin
 if exists(select 1 from public.bsoc_render_forensics_v1
           where health_event_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then
   raise exception 'RLS exposed other member private forensic record';
 end if;
end$$;

-- An inactive account must not attach its own or anyone else's evidence.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
do $$
begin
  begin
    perform public.buklod_attach_render_forensics_v1(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','UNKNOWN','UNKNOWN');
    raise exception 'INACTIVE_ACCOUNT_NOT_BLOCKED';
  exception when sqlstate '42501' then null;
  end;
end$$;
rollback;
