-- BUKLOD Official moderation/security contract. Read-only + rejected writes; rollback.
begin;
do $test$
declare
  official_id uuid;
  ordinary_id uuid;
  result jsonb;
  notices_before bigint;
begin
  select user_id into official_id from private.buklod_official_identity_snapshot_v1
   where principal_key='OFFICIAL_SYSTEM_ADMIN';
  select id into ordinary_id from public.profiles
   where id<>official_id and is_active=true limit 1;
  if official_id is null or ordinary_id is null then
    raise exception 'Official / member identity prerequisite missing';
  end if;
  if has_table_privilege('authenticated','private.buklod_official_wall_audit_v1','SELECT')
     or has_table_privilege('authenticated','private.buklod_official_notice_receipts_v1','SELECT')
     or not (select relrowsecurity from pg_class where oid='private.buklod_official_wall_audit_v1'::regclass)
  then raise exception 'Private moderation audit improperly exposed';end if;

  perform set_config('request.jwt.claim.sub',official_id::text,true);
  result:=public.admin_list_buklod_official_wall_v1(5,null,null,'ALL',null);
  if jsonb_typeof(result->'rows')<>'array' then
    raise exception 'Official Wall list malformed';
  end if;
  result:=public.admin_search_buklod_notice_recipients_v1('a',10);
  if jsonb_array_length(result)<>0 then
    raise exception 'Recipient search ignored two-character minimum';
  end if;

  select count(*) into notices_before from public.notifications;
  begin
    perform public.admin_send_buklod_official_notice_v1(
      null,'Official message','A test message.','migration-contract-rollback-001');
    raise exception 'Invalid target was allowed';
  exception when raise_exception then
    if SQLERRM='Invalid target was allowed' then raise;end if;
  end;
  if (select count(*) from public.notifications) <> notices_before then
    raise exception 'Denied notice caused a notification';
  end if;

  begin
    perform public.admin_set_buklod_official_wall_visibility_v1(
      gen_random_uuid(),true,'Test-only invalid target');
    raise exception 'Unrelated post could be taken down';
  exception when raise_exception then
    if SQLERRM='Unrelated post could be taken down' then raise;end if;
  end;

  perform set_config('request.jwt.claim.sub',ordinary_id::text,true);
  begin
    perform public.admin_list_buklod_official_wall_v1(5,null,null,'ALL',null);
    raise exception 'Nonofficial member gained admin Wall access';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_search_buklod_notice_recipients_v1('an',10);
    raise exception 'Nonofficial member gained recipient search';
  exception when insufficient_privilege then null;
  end;
end $test$;
rollback;
