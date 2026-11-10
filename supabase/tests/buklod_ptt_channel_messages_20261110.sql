-- PTT message safety regression: no production rows changed.
begin;
do $ptt_tests$
declare
  policies text;
begin
  if to_regclass('public.buklod_ptt_channel_messages') is null then
    raise exception 'PTT conversation table missing';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.buklod_ptt_channel_messages'::regclass) then
    raise exception 'PTT conversation RLS must be enabled';
  end if;
  if has_table_privilege('anon','public.buklod_ptt_channel_messages','SELECT')
    or has_table_privilege('anon','public.buklod_ptt_channel_messages','INSERT') then
    raise exception 'Anonymous accounts must never read or write PTT history';
  end if;
  if not has_table_privilege('authenticated','public.buklod_ptt_channel_messages','SELECT')
    or not has_table_privilege('authenticated','public.buklod_ptt_channel_messages','INSERT')
    or has_table_privilege('authenticated','public.buklod_ptt_channel_messages','UPDATE')
    or has_table_privilege('authenticated','public.buklod_ptt_channel_messages','DELETE') then
    raise exception 'PTT messages need member read/append-only access';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public'
      and tablename='buklod_ptt_channel_messages'
  ) then
    raise exception 'PTT message INSERT changefeed is not available';
  end if;
  select string_agg(coalesce(qual,'') || ' ' || coalesce(with_check,''), ' ')
  into policies from pg_policies
  where schemaname='public' and tablename='buklod_ptt_channel_messages';
  if policies is null
     or position('buklod_scope_memberships' in policies)=0
     or position('membership_status' in policies)=0
     or position('auth.uid()' in policies)=0
     or position('buklod_ptt_transmissions' in policies)=0
     or position('sender_user_id' in policies)=0 then
    raise exception 'Member/speaker/floor checks missing from PTT RLS';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and tablename='buklod_ptt_channel_messages'
      and indexname='buklod_ptt_messages_caption_dedupe_idx'
  ) then
    raise exception 'Idempotent caption storage index missing';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.buklod_ptt_channel_messages'::regclass
      and conname='buklod_ptt_channel_messages_channel_check'
  ) then
    raise exception 'PTT CH01-CH10 channel validation missing';
  end if;
  raise notice 'PTT channel history: RLS, permissions, floor attribution, realtime and dedupe PASS';
end
$ptt_tests$;
rollback;
