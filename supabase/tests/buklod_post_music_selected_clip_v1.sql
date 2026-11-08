-- Read-only checks after additive production migration; no fictional user/posts.
-- Run with supabase test db against a dedicated QA database or read-only SQL.
begin;
do $clip_contract$
declare
  v_columns int;
  v_def text;
begin
  if to_regclass('public.buklod_post_creatives') is null then
    raise exception 'Post creative metadata is missing';
  end if;
  select count(*) into v_columns
    from information_schema.columns
    where table_schema='public' and table_name='buklod_post_creatives'
      and column_name in ('music_clip_start_seconds','music_clip_duration_seconds')
      and is_nullable='YES'
      and data_type='numeric';
  if v_columns<>2 then
    raise exception 'Missing nullable numeric clip start/duration pair';
  end if;
  select pg_get_constraintdef(c.oid) into v_def
    from pg_constraint c
    where c.conrelid='public.buklod_post_creatives'::regclass
      and c.conname='buklod_post_creatives_music_clip_window_check';
  if v_def is null or
     position('music_clip_start_seconds' in v_def)=0 or
     position('music_clip_duration_seconds' in v_def)=0 or
     position('21600' in v_def)=0 or
     position('60' in v_def)=0 then
    raise exception 'Post music clip range constraint missing';
  end if;
  if not exists (
    select 1 from pg_class
     where oid='public.buklod_post_creatives'::regclass and relrowsecurity
  ) then
    raise exception 'Post creative metadata must retain RLS';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public'
      and tablename='buklod_post_creatives' and cmd='SELECT'
      and qual like '%can_view_community_post_v2%'
  ) then
    raise exception 'Authorized post audience read guard missing';
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public'
      and tablename='buklod_post_creatives' and cmd='INSERT'
      and with_check like '%auth.uid()%'
  ) then
    raise exception 'Post author-only creative INSERT guard missing';
  end if;
end;
$clip_contract$;
rollback;
