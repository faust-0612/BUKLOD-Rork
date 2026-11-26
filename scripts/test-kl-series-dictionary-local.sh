#!/usr/bin/env bash
# Synthetic isolated PostgreSQL integration test. NO project connection, no network, no production credentials.
set -euo pipefail
if [[ $(id -u) -eq 0 ]]; then echo 'Run as your normal WSL user, not sudo.' >&2; exit 2; fi
REF=$(git rev-parse --verify "${1:-HEAD}^{commit}")
BIN=${PG_BIN:-/usr/lib/postgresql/17/bin}
for exe in initdb pg_ctl psql; do [[ -x "$BIN/$exe" ]] || { echo "Missing $BIN/$exe"; exit 2; }; done
ROOT=$(mktemp -d /tmp/kl-pg.XXXXXX)
cleanup(){ "$BIN/pg_ctl" -D "$ROOT/db" -m immediate -w stop >/dev/null 2>&1 || true; rm -rf -- "$ROOT"; }
trap cleanup EXIT
mkdir "$ROOT/socket"
unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE PGOPTIONS
"$BIN/initdb" -D "$ROOT/db" -U kl_test_admin --auth=trust --no-locale --encoding=UTF8 >/dev/null
"$BIN/pg_ctl" -D "$ROOT/db" -l "$ROOT/postgres.log" -o "-c listen_addresses='' -c unix_socket_directories='$ROOT/socket' -c unix_socket_permissions=0700" -w start >/dev/null
PSQL=("$BIN/psql" -X -v ON_ERROR_STOP=1 -h "$ROOT/socket" -U kl_test_admin -d postgres)
echo "Testing isolated source $REF"
"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema private;
create schema storage;
create schema vault;
create schema cron;
create schema net;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.profiles(id uuid primary key,role text,is_active boolean);
insert into profiles values ('00000000-0000-0000-0000-000000000001','system_admin',true),('00000000-0000-0000-0000-000000000002','member',true),('00000000-0000-0000-0000-000000000003','system_admin',false);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select on storage.objects to anon,authenticated;
grant insert on storage.objects to authenticated;
create table public.kl_episodes(id uuid primary key,season_number integer,episode_number integer,manuscript text,status text,approved_at timestamptz,release_at timestamptz);
create table public.kl_quiz_sets(episode_id uuid primary key,status text,manuscript_hash text);
create table vault.decrypted_secrets(name text primary key,decrypted_secret text);
create table cron.job(jobname text primary key,schedule text,command text);
create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job values($1,$2,$3) returning 1::bigint $$;
-- HTTP is deliberately mocked: any actual dispatch is a test failure.
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$ begin raise exception 'No network calls permitted in fixture'; end $$;
insert into public.kl_episodes values
('10000000-0000-0000-0000-000000000001',1,1,'Sa Lunawen, lumipad ang Ulapin, isang nilalang na may pakpak na tila ulap. '||repeat('May liwanag sa lupa. ',8),'approved',now()-interval '2 days',now()-interval '1 day'),
('10000000-0000-0000-0000-000000000002',1,2,'Ulapin at Phan. '||repeat('May liwanag sa lupa. ',8),'approved',now()-interval '2 days',now()-interval '1 day'),
('10000000-0000-0000-0000-000000000003',1,3,'Pribadong lihim na nilalang. '||repeat('May liwanag sa lupa. ',8),'draft',null,null);
create function public.test_assert(p_ok boolean,p_label text) returns void language plpgsql as $$ begin if p_ok is distinct from true then raise exception 'FAIL: %',p_label; end if; end $$;
SQL
for migration in 20261126080000_kl_series_and_dictionary_v1.sql 20261126080001_kl_dictionary_scheduler_v1.sql; do
 git show "$REF:supabase/migrations/$migration" > "$ROOT/$migration"
 "${PSQL[@]}" -f "$ROOT/$migration"
done
"${PSQL[@]}" <<'SQL'
select test_assert((select count(*) from private.kl_dictionary_curated_v1)=146,'146 seed terms');
select test_assert((select count(*) from kl_episodes)=3,'existing chapters unchanged');
select test_assert(private.kl_dictionary_dispatch_v1() is null,'no worker credentials = no network');
select test_assert((select count(*) from cron.job where jobname='buklod-kl-dictionary-v1')=1,'one schedule');
set role anon;
select test_assert(jsonb_array_length(kl_series_list_v1(false))=1,'only existing series');
select test_assert(kl_dictionary_read_v1('10000000-0000-0000-0000-000000000003')='[]'::jsonb,'draft glossary hidden');
do $$ begin
 begin perform kl_dictionary_claim_v1(); raise exception 'FAIL: anonymous worker'; exception when insufficient_privilege then null; end;
 begin perform kl_series_list_v1(true); raise exception 'FAIL: anonymous admin'; exception when raise_exception then if sqlerrm<>'Admin only' then raise; end if; end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
 begin perform kl_series_save_v1(2,'Test series',null,false); raise exception 'FAIL: member saved series'; exception when raise_exception then if sqlerrm<>'Admin only' then raise; end if; end;
 begin insert into storage.objects values('kl-series-covers','2/member.jpg'); raise exception 'FAIL: member upload'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
 begin perform kl_series_save_v1(2,'Test series',null,false); raise exception 'FAIL: inactive admin saved'; exception when raise_exception then if sqlerrm<>'Admin only' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select test_assert((kl_series_save_v1(2,'Test series',null,false)->>'published')::boolean=false,'create private series');
do $$ begin
 begin perform kl_series_save_v1(2,'Test series',null,true); raise exception 'FAIL: no cover'; exception when raise_exception then if sqlerrm<>'Upload a cover first' then raise; end if; end;
end $$;
insert into storage.objects values('kl-series-covers','2/test.jpg');
select kl_series_save_v1(2,'Test series','2/test.jpg',false);
reset role;
set role anon;
select test_assert(jsonb_array_length(kl_series_list_v1(false))=1,'draft hidden');
select test_assert((select count(*) from storage.objects)=0,'draft cover hidden');
reset role;
do $$ begin
 begin insert into kl_episodes values(gen_random_uuid(),3,1,'test','draft',null,null); raise exception 'FAIL: automatic series'; exception when raise_exception then if sqlerrm<>'Create the series in KL Studio first' then raise; end if; end;
end $$;
insert into kl_episodes values('20000000-0000-0000-0000-000000000001',2,1,'Ulapin at Lunawen. '||repeat('May liwanag sa lupa. ',8),'approved',now(),null);
do $$ begin
 begin update kl_episodes set release_at=now() where season_number=2; raise exception 'FAIL: private release'; exception when raise_exception then if sqlerrm<>'Publish the series cover first' then raise; end if; end;
end $$;
set role authenticated;
select test_assert((kl_series_save_v1(2,'Test series','2/test.jpg',true)->>'published')::boolean,'explicit publish');
reset role;
set role anon;
select test_assert(jsonb_array_length(kl_series_list_v1(false))=2,'published series visible');
select test_assert((select count(*) from storage.objects)=1,'published cover visible');
reset role;
do $$ begin
 begin update kl_episodes set release_at=now() where season_number=2; raise exception 'FAIL: release without quiz'; exception when raise_exception then if sqlerrm<>'Prepare validated reading quiz before release' then raise; end if; end;
end $$;
insert into kl_quiz_sets select id,'ready',md5(manuscript) from kl_episodes where season_number=2;
update kl_episodes set release_at=now() where season_number=2;
set role service_role;
do $$
declare j jsonb; items jsonb; ok boolean;
begin
 j:=kl_dictionary_claim_v1();
 perform test_assert(j->>'episode_id'='10000000-0000-0000-0000-000000000001','first released chapter claim');
 items:='[{"name":"Ulapin","kind":"Nilalang","meaning":"Nilalang na may pakpak na tila ulap.","evidence":"lumipad ang Ulapin, isang nilalang na may pakpak na tila ulap."}]';
 ok:=kl_dictionary_finish_v1((j->>'episode_id')::uuid,j->>'source_hash',gen_random_uuid(),items,null);
 perform test_assert(not ok,'wrong lease rejected');
 begin
  perform kl_dictionary_finish_v1((j->>'episode_id')::uuid,j->>'source_hash',(j->>'lease_token')::uuid,'[{"name":"Ulapin","kind":"Nilalang","meaning":"Maling kahulugan.","evidence":"Hindi ito bahagi ng teksto."}]',null);
  raise exception 'FAIL: invented evidence accepted';
 exception when raise_exception then if sqlerrm<>'No source-grounded glossary entries' then raise; end if; end;
 ok:=kl_dictionary_finish_v1((j->>'episode_id')::uuid,j->>'source_hash',(j->>'lease_token')::uuid,items,null);
 perform test_assert(ok,'valid glossary stored');
 j:=kl_dictionary_claim_v1();
 perform test_assert(j->>'episode_id'='10000000-0000-0000-0000-000000000002','next chapter claim');
 perform test_assert(j->'known_names' ? 'Ulapin','reuse known name');
 perform test_assert(kl_dictionary_finish_v1((j->>'episode_id')::uuid,j->>'source_hash',(j->>'lease_token')::uuid,'[]',null),'empty valid glossary');
end $$;
reset role;
set role anon;
select test_assert(kl_dictionary_read_v1('10000000-0000-0000-0000-000000000002') @> '[{"name":"Ulapin"}]'::jsonb,'prior definition reused');
select test_assert(kl_dictionary_read_v1('10000000-0000-0000-0000-000000000003')='[]'::jsonb,'draft remains hidden');
reset role;
-- Simulate a manuscript version change in fixture only; old derived glossary fails closed.
update kl_episodes set manuscript=manuscript||' Bagong bersyon.' where id='10000000-0000-0000-0000-000000000001';
select test_assert(not (kl_dictionary_read_v1('10000000-0000-0000-0000-000000000002') @> '[{"name":"Ulapin"}]'::jsonb),'stale glossary excluded');
select 'PASS: isolated migration, roles, series/cover/release, dictionary evidence and version isolation' as result;
SQL
echo "PASS: temporary PostgreSQL fixture only; no live/staging deployment."
