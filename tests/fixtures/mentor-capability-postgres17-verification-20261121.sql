-- Must be executed ONLY in disposable PG17 fixture with migrations already applied.
begin;
set local request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $integration$
declare
  initial jsonb;
  replay jsonb;
  revoked jsonb;
  catalog jsonb;
  n int;
begin
  if not public.is_system_admin() then raise exception 'Admin fixture incorrectly denied'; end if;
  initial:=public.admin_set_mentor_capability_v1(
    '22222222-2222-4222-8222-222222222222',true,
    'Verified active mentor responsibility for assigned learner',
    'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa');
  if initial->>'changed' <> 'true' then raise exception 'Mentor grant failed'; end if;

  replay:=public.admin_set_mentor_capability_v1(
    '22222222-2222-4222-8222-222222222222',true,
    'Verified active mentor responsibility for assigned learner',
    'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa');
  if replay->>'already_recorded' <> 'true' then raise exception 'Idempotency failed'; end if;

  begin
    perform public.admin_set_mentor_capability_v1(
      '33333333-3333-4333-8333-333333333333',true,
      'A mismatching target is not allowed with the same request key',
      'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa');
    raise exception 'Reused request key must be rejected';
  exception when sqlstate 'P0001' then
    if sqlerrm='Reused request key must be rejected' then raise; end if;
  end;

  insert into public.mentor_assignments(mentor_id,disciple_id,is_active)
    values('22222222-2222-4222-8222-222222222222',
           '33333333-3333-4333-8333-333333333333',true);

  begin
    insert into public.user_capabilities(user_id,capability,granted_by,is_active)
      values('44444444-4444-4444-8444-444444444444','mentor',
             '11111111-1111-4111-8111-111111111111',true);
    raise exception 'Protected principal capability write unexpectedly allowed';
  exception when sqlstate '42501' then null;
  end;

  begin
    insert into public.mentor_assignments(mentor_id,disciple_id,is_active)
      values('44444444-4444-4444-8444-444444444444',
             '33333333-3333-4333-8333-333333333333',true);
    raise exception 'Protected principal relationship unexpectedly allowed';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.admin_set_mentor_capability_v1(
      '44444444-4444-4444-8444-444444444444',true,
      'Attempt to grant to protected official is forbidden',
      'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb');
    raise exception 'Protected principal granted by RPC';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.admin_set_mentor_capability_v1(
      '55555555-5555-4555-8555-555555555555',true,
      'Attempt to grant inactive member must be forbidden',
      'cccccccc-0000-4000-8000-cccccccccccc');
    raise exception 'Inactive member granted';
  exception when sqlstate 'P0001' then
    if sqlerrm='Inactive member granted' then raise; end if;
  end;

  select count(*) into n from private.buklod_mentor_capability_audit_v1;
  if n<>1 then raise exception 'Unexpected audit rows after idempotent grant: %', n; end if;

  revoked:=public.admin_set_mentor_capability_v1(
    '22222222-2222-4222-8222-222222222222',false,
    'Role suspended following end of assigned mentoring responsibility',
    'dddddddd-0000-4000-8000-dddddddddddd');
  if revoked->>'changed' <> 'true' then raise exception 'Revocation failed'; end if;
  if public.has_capability('22222222-2222-4222-8222-222222222222','mentor') then
     raise exception 'Revoked capability remains active';
  end if;
  begin
    insert into public.mentor_assignments(mentor_id,disciple_id,is_active)
      values('22222222-2222-4222-8222-222222222222',
             '11111111-1111-4111-8111-111111111111',true);
    raise exception 'Revoked mentor assigned a learner';
  exception when sqlstate '42501' then null;
  end;
  select count(*) into n from private.buklod_mentor_capability_audit_v1;
  if n<>2 then raise exception 'Expected grant + revoke audit rows: %',n; end if;
end;
$integration$;
rollback;

-- Actual SQL permission boundary, with ordinary authenticated role.
begin;
set local role authenticated;
set local request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
do $member$
begin
  begin
    perform public.admin_set_mentor_capability_v1(
      '22222222-2222-4222-8222-222222222222',true,
      'Ordinary member cannot grant mentor permission',
      'eeeeeeee-0000-4000-8000-eeeeeeeeeeee');
    raise exception 'Member bypassed admin authorization';
  exception when sqlstate '42501' then null;
  end;
end;
$member$;
rollback;
