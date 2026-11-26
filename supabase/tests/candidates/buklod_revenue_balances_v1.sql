-- DEV-only candidate. Reconstruct source attribution from the existing full-balance
-- withdrawal contract. Never alter the canonical wallet or infer unknown credits.
create or replace function private.buklod_replay_available_sources_v1(p_entries jsonb)
returns jsonb language plpgsql immutable security invoker set search_path to '' as $$
declare
  e jsonb; k text; typ text; dir text; n bigint;
  q bigint:=0; r bigint:=0; o bigint:=0;
  reserves jsonb:='{}'; saved jsonb;
begin
  if jsonb_typeof(p_entries) is distinct from 'array' then raise exception 'Invalid ledger'; end if;
  for e in select value from jsonb_array_elements(p_entries) loop
    typ:=e->>'entry_type'; dir:=e->>'direction'; k:=e->>'withdrawal_id'; n:=(e->>'amount_centavos')::bigint;
    if n is null or n<=0 then raise exception 'Invalid ledger amount'; end if;
    if typ='WITHDRAWAL_RESERVE' and dir='DEBIT' then
      if k is null or reserves ? k or n<>q+r+o then raise exception 'Unreconciled full reservation'; end if;
      reserves:=reserves||jsonb_build_object(k,jsonb_build_array(q,r,o));
      q:=0; r:=0; o:=0;
    elsif typ='WITHDRAWAL_RELEASE' and dir='CREDIT' then
      saved:=reserves->k;
      if saved is null or n<>(saved->>0)::bigint+(saved->>1)::bigint+(saved->>2)::bigint then raise exception 'Unreconciled release'; end if;
      q:=q+(saved->>0)::bigint; r:=r+(saved->>1)::bigint; o:=o+(saved->>2)::bigint;
      reserves:=reserves-k;
    elsif dir='CREDIT' and typ='USER_POOL_SETTLEMENT' then q:=q+n;
    elsif dir='CREDIT' and typ in ('FIRST_LINE_SETTLEMENT','REFERRAL_ONE_TIME_REWARD') then r:=r+n;
    elsif dir='CREDIT' and typ='ADMIN_CORRECTION' and e->>'funding_class'='ADMIN_FUNDED_REWARD' then o:=o+n;
    else raise exception 'Unclassified wallet movement';
    end if;
  end loop;
  return jsonb_build_object('qmp_balance_minor',q,'referral_balance_minor',r,'other_balance_minor',o,'available_minor',q+r+o);
end;
$$;
revoke all on function private.buklod_replay_available_sources_v1(jsonb) from public,anon,authenticated;

create or replace function public.get_my_buklod_revenue_balances_v1()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  actor uuid:=auth.uid(); person uuid; entries jsonb; result jsonb; available bigint;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  person:=private.buklod_pf_person_for_user_v2(actor);
  if person is null then return jsonb_build_object('status','IDENTITY_UNAVAILABLE'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('entry_type',l.entry_type,'direction',l.direction,
     'amount_centavos',l.amount_centavos,'withdrawal_id',l.withdrawal_id,'funding_class',l.metadata->>'funding_class')
     order by l.created_at,l.id),'[]'::jsonb)
  into entries from private.buklod_pf_cash_ledger l where l.person_id=person and l.bucket='AVAILABLE';
  -- If event order is ambiguous, do not invent source attribution.
  if exists(select 1 from private.buklod_pf_cash_ledger l where l.person_id=person and l.bucket='AVAILABLE'
    group by l.created_at having count(*)>1 and bool_or(l.entry_type in ('WITHDRAWAL_RESERVE','WITHDRAWAL_RELEASE'))) then
    return jsonb_build_object('status','UNRECONCILED');
  end if;
  begin
    result:=private.buklod_replay_available_sources_v1(entries);
  exception when others then return jsonb_build_object('status','UNRECONCILED');
  end;
  available:=private.buklod_pf_cash_balance_centavos_v3(person,'AVAILABLE');
  if available is null or available<>(result->>'available_minor')::bigint then
    return jsonb_build_object('status','UNRECONCILED');
  end if;
  return result||jsonb_build_object('status','RECONCILED','period_key',to_char(now() at time zone 'Asia/Manila','YYYY-MM'));
end;
$$;
revoke all on function public.get_my_buklod_revenue_balances_v1() from public,anon;
grant execute on function public.get_my_buklod_revenue_balances_v1() to authenticated;

-- Staging synthetic tests: paid/full reservation excludes old sources; release restores them.
do $$
declare
  credits jsonb:='[{"entry_type":"USER_POOL_SETTLEMENT","direction":"CREDIT","amount_centavos":400},{"entry_type":"REFERRAL_ONE_TIME_REWARD","direction":"CREDIT","amount_centavos":2000}]';
  reserve jsonb:='[{"entry_type":"WITHDRAWAL_RESERVE","direction":"DEBIT","amount_centavos":2400,"withdrawal_id":"a"}]';
  newcredit jsonb:='[{"entry_type":"USER_POOL_SETTLEMENT","direction":"CREDIT","amount_centavos":100}]';
  release jsonb:='[{"entry_type":"WITHDRAWAL_RELEASE","direction":"CREDIT","amount_centavos":2400,"withdrawal_id":"a"}]';
begin
  if private.buklod_replay_available_sources_v1(credits) <> '{"qmp_balance_minor":400,"referral_balance_minor":2000,"other_balance_minor":0,"available_minor":2400}'::jsonb then raise exception 'Credit test failed'; end if;
  if (private.buklod_replay_available_sources_v1(credits||reserve||newcredit)->>'available_minor')::bigint<>100 then raise exception 'Reservation test failed'; end if;
  if private.buklod_replay_available_sources_v1(credits||reserve||newcredit||release) <> '{"qmp_balance_minor":500,"referral_balance_minor":2000,"other_balance_minor":0,"available_minor":2500}'::jsonb then raise exception 'Release test failed'; end if;
end;
$$;
