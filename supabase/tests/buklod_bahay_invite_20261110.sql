-- Safe, read-only schema + security regression for BUKLOD Bahay invite.
-- Run after applying 20261110113000_buklod_bahay_invite_suggestions.sql.
do $check_bahay_invite$
declare
  v_fn regprocedure;
  v_source text;
  v_name text;
begin
  foreach v_name in array array[
    'public.buklod_home_invite_user_v2(uuid,uuid,text,timestamptz)',
    'public.buklod_home_invite_v1(uuid,text,text,timestamptz)',
    'public.buklod_home_invite_decide_v1(uuid,boolean)',
    'public.buklod_home_search_invitees_v1(uuid,text,integer)',
    'public.buklod_home_pending_invites_v1(uuid)'
  ] loop
    v_fn := to_regprocedure(v_name);
    if v_fn is null then
      raise exception 'Bahay invite RPC is missing: %', v_name;
    end if;
    if has_function_privilege('anon',v_fn,'EXECUTE') then
      raise exception 'Anonymous user may execute private Bahay RPC: %', v_name;
    end if;
    if not has_function_privilege('authenticated',v_fn,'EXECUTE') then
      raise exception 'Authenticated user cannot execute Bahay RPC: %', v_name;
    end if;
    v_source := lower(pg_get_functiondef(v_fn));
    if position('buklod_home_is_admin' in v_source) = 0
       and v_name not like '%buklod_home_invite_decide_v1%' then
      raise exception 'Home admin authorization guard missing: %', v_name;
    end if;
  end loop;

  v_source := lower(pg_get_functiondef(
    'public.buklod_home_invite_user_v2(uuid,uuid,text,timestamptz)'::regprocedure
  ));
  if position('on conflict on constraint buklod_home_members_pkey' in v_source) = 0
     or position('already a kasambahay' in v_source) = 0
     or position('already pending' in v_source) = 0 then
    raise exception 'Duplicate/active member protection missing';
  end if;
  v_source := lower(pg_get_functiondef(
    'public.buklod_home_search_invitees_v1(uuid,text,integer)'::regprocedure
  ));
  if position('buklod_connect_suggested_contacts_v1' in v_source)=0
     or position('buklod_user_follows' in v_source)=0
     or position('limit v_limit' in v_source)=0 then
    raise exception 'Bounded contact suggestions missing';
  end if;
  if position('auth.users' in v_source)>0 or position('au.email' in v_source)>0 then
    raise exception 'Private auth email may not be searched or returned';
  end if;
  v_source := lower(pg_get_functiondef(
    'public.buklod_home_invite_decide_v1(uuid,boolean)'::regprocedure
  ));
  if position('expires_at is null or expires_at > now()' in v_source)=0 then
    raise exception 'Expired invitation acceptance guard missing';
  end if;
end $check_bahay_invite$;
