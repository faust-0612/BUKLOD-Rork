-- Read-only authenticated security/metadata assertions; run ONLY on a migrated QA database.
-- Deliberately creates no users, posts, media or financial ledger records.
begin;
do $audio_mix_contract$
declare
 v_count integer;
 v_definition text;
begin
 if to_regclass('public.buklod_post_creatives') is null then
   raise exception 'Post creative table missing';
 end if;
 select count(*) into v_count
   from information_schema.columns
   where table_schema='public' and table_name='buklod_post_creatives'
     and column_name in ('music_volume','video_volume')
     and is_nullable='YES' and data_type='numeric'
     and numeric_scale=3;
 if v_count<>2 then
   raise exception 'Missing nullable 0..1 post audio mix columns';
 end if;
 select pg_get_constraintdef(oid) into v_definition
   from pg_constraint
   where conrelid='public.buklod_post_creatives'::regclass
    and conname='buklod_post_creatives_audio_mix_range_check';
 if v_definition is null
    or position('music_volume' in v_definition)=0
    or position('video_volume' in v_definition)=0
    or position('0' in v_definition)=0
    or position('1' in v_definition)=0 then
   raise exception 'Audio mix bound constraint missing';
 end if;
 if not exists (
    select 1 from pg_class where oid='public.buklod_post_creatives'::regclass
    and relrowsecurity
 ) then
   raise exception 'RLS was disabled on post creatives';
 end if;
 if not exists (
   select 1 from pg_policies
   where schemaname='public' and tablename='buklod_post_creatives'
   and cmd='SELECT' and qual like '%can_view_community_post_v2%'
 ) then
   raise exception 'Post audience SELECT policy missing';
 end if;
 if not exists (
   select 1 from pg_policies
   where schemaname='public' and tablename='buklod_post_creatives'
   and cmd='INSERT' and with_check like '%auth.uid()%'
 ) then
   raise exception 'Post author INSERT policy missing';
 end if;
end;
$audio_mix_contract$;
rollback;
