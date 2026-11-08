-- Applied to production yhanxndaqbmuzbdqlblu as 20261108093945.
-- Nullable pair retains legacy full-song posts without disturbing existing RLS,
-- authorized music catalog, or dependent post/media upload RPCs.
alter table public.buklod_post_creatives
  add column if not exists music_clip_start_seconds numeric(8,2),
  add column if not exists music_clip_duration_seconds numeric(8,2);

alter table public.buklod_post_creatives
  add constraint buklod_post_creatives_music_clip_window_check
  check (
    (music_clip_start_seconds is null and music_clip_duration_seconds is null)
    or (
      music_clip_start_seconds between 0 and 21600
      and music_clip_duration_seconds between 5 and 60
    )
  );
