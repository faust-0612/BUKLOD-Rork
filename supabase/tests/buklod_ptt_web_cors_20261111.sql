-- Read-only BUKLOD PTT guard: CORS repairs must not bypass scoped RLS or floor ownership.
begin;
do $ptt_cors_guard$
begin
  if to_regclass('public.buklod_scope_memberships') is null or
     to_regclass('public.buklod_ptt_channel_messages') is null then
    raise exception 'Required PTT tables missing';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.buklod_scope_memberships'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.buklod_ptt_channel_messages'::regclass) then
    raise exception 'PTT membership and messages must remain RLS-protected';
  end if;
  if to_regprocedure('public.buklod_ptt_claim_floor(uuid,smallint,text,text,integer)') is null
     or to_regprocedure('public.buklod_ptt_release_floor(uuid)') is null then
    raise exception 'PTT floor-control RPC missing';
  end if;
  if has_table_privilege('anon','public.buklod_ptt_channel_messages','SELECT')
     or has_table_privilege('anon','public.buklod_ptt_channel_messages','INSERT') then
    raise exception 'Anonymous PTT message access must remain forbidden';
  end if;
  raise notice 'PTT CORS backend security dependencies intact';
end $ptt_cors_guard$;
rollback;
