-- DEV-only additive schema for optional author-selected post audio balance.
-- Apply to the authorized target BEFORE deploying clients that select these fields.
-- Preserve all historical posts, media, catalog records, policies and RLS.
begin;
alter table public.buklod_post_creatives
  add column if not exists music_volume numeric(4,3),
  add column if not exists video_volume numeric(4,3);

alter table public.buklod_post_creatives
  drop constraint if exists buklod_post_creatives_audio_mix_range_check;
alter table public.buklod_post_creatives
  add constraint buklod_post_creatives_audio_mix_range_check
  check (
    (music_volume is null or music_volume between 0 and 1)
    and
    (video_volume is null or video_volume between 0 and 1)
  );

comment on column public.buklod_post_creatives.music_volume is
  'Optional soundtrack volume 0..1. NULL means legacy full volume.';
comment on column public.buklod_post_creatives.video_volume is
  'Optional original video volume 0..1. NULL means legacy full volume.';
commit;
