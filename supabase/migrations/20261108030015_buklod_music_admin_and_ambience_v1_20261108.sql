-- BUKLOD Music Library Admin and Photo Ambience (DEV/RC only).
-- Never apply to production until the consolidated OTA release is authorized.
-- Existing 42 music records and existing post creative rows remain untouched.
begin;

alter table public.buklod_post_creatives
  drop constraint if exists buklod_post_creatives_motion_preset_check;
alter table public.buklod_post_creatives
  add constraint buklod_post_creatives_motion_preset_check check (
    motion_preset in (
      'none','zoom','pan','float','fade',
      'rain','storm','snow','mist','sparkles','fireflies','petals',
      'sunrays','dust','bokeh','stars','autumn','underwater'
    )
  );

-- Existing public read policy stays restricted to active tracks.
-- An inactive track is visible only to a verified System Admin.
alter table public.buklod_music_library enable row level security;
grant select, insert, update, delete on public.buklod_music_library to authenticated;
drop policy if exists "buklod_music_admin_read_all" on public.buklod_music_library;
create policy "buklod_music_admin_read_all"
  on public.buklod_music_library for select to authenticated
  using ((select public.is_system_admin()));
drop policy if exists "buklod_music_admin_insert" on public.buklod_music_library;
create policy "buklod_music_admin_insert"
  on public.buklod_music_library for insert to authenticated
  with check (
    (select public.is_system_admin())
    and audio_path like 'library/admin/%'
    and length(trim(title)) between 1 and 160
  );
drop policy if exists "buklod_music_admin_update" on public.buklod_music_library;
create policy "buklod_music_admin_update"
  on public.buklod_music_library for update to authenticated
  using ((select public.is_system_admin()))
  with check ((select public.is_system_admin()));
drop policy if exists "buklod_music_admin_delete" on public.buklod_music_library;
create policy "buklod_music_admin_delete"
  on public.buklod_music_library for delete to authenticated
  using ((select public.is_system_admin()));

-- Private bucket: only signed/read for a currently active catalog track, or
-- an authorized System Admin. Never grant anonymous write or list-all access.
drop policy if exists "buklod_music_private_active_read" on storage.objects;
create policy "buklod_music_private_active_read"
  on storage.objects for select to authenticated
  using (
    bucket_id='buklod-music-library'
    and (
      (select public.is_system_admin())
      or exists (
        select 1 from public.buklod_music_library m
        where m.is_active = true
          and (m.audio_path = name
             or m.audio_path = 'buklod-music-library/' || name)
      )
    )
  );

-- Only verified System Admins can mutate storage. Upload uses immutable
-- library/admin/<uuid>.<audio-extension> paths and upsert=false.
drop policy if exists "buklod_music_admin_storage_insert" on storage.objects;
create policy "buklod_music_admin_storage_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id='buklod-music-library'
    and name ~ '^library/admin/[a-f0-9-]{36}\.(mp3|m4a|mp4|aac|wav|ogg)$'
    and (select public.is_system_admin())
  );
drop policy if exists "buklod_music_admin_storage_delete" on storage.objects;
create policy "buklod_music_admin_storage_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id='buklod-music-library'
    and (select public.is_system_admin())
  );
commit;
