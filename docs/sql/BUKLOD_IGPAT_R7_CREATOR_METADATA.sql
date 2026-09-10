-- BUKLOD IGPAT R7 — CREATOR QUICK EDIT METADATA
-- Additive playback metadata. No destructive media transcoding is required.

create table if not exists public.igpat_post_metadata (
  post_id uuid primary key,
  owner_user_id uuid not null default auth.uid(),
  trim_start_seconds numeric(7,3) not null default 0 check (trim_start_seconds >= 0),
  trim_end_seconds numeric(7,3) null check (trim_end_seconds is null or trim_end_seconds > 0),
  playback_speed numeric(4,2) not null default 1 check (playback_speed between 0.5 and 2),
  text_overlay text not null default '' check (char_length(text_overlay) <= 120),
  captions_enabled boolean not null default false,
  audio_label text not null default '' check (char_length(audio_label) <= 80),
  cover_seconds numeric(7,3) not null default 0 check (cover_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists igpat_post_metadata_owner_idx on public.igpat_post_metadata(owner_user_id, updated_at desc);
alter table public.igpat_post_metadata enable row level security;

do $$ begin
  create policy igpat_metadata_read_authenticated on public.igpat_post_metadata for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_metadata_write_owner on public.igpat_post_metadata for all using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid());
exception when duplicate_object then null; end $$;

create or replace function public.igpat_set_post_metadata_v1(
  p_post_id uuid,
  p_trim_start_seconds numeric default 0,
  p_trim_end_seconds numeric default null,
  p_playback_speed numeric default 1,
  p_text_overlay text default '',
  p_captions_enabled boolean default false,
  p_audio_label text default '',
  p_cover_seconds numeric default 0
) returns void language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.igpat_post_metadata(
    post_id,owner_user_id,trim_start_seconds,trim_end_seconds,playback_speed,text_overlay,captions_enabled,audio_label,cover_seconds,updated_at
  ) values(
    p_post_id,auth.uid(),greatest(coalesce(p_trim_start_seconds,0),0),p_trim_end_seconds,least(2,greatest(.5,coalesce(p_playback_speed,1))),left(coalesce(p_text_overlay,''),120),coalesce(p_captions_enabled,false),left(coalesce(p_audio_label,''),80),greatest(coalesce(p_cover_seconds,0),0),now()
  )
  on conflict(post_id) do update set
    trim_start_seconds=excluded.trim_start_seconds,
    trim_end_seconds=excluded.trim_end_seconds,
    playback_speed=excluded.playback_speed,
    text_overlay=excluded.text_overlay,
    captions_enabled=excluded.captions_enabled,
    audio_label=excluded.audio_label,
    cover_seconds=excluded.cover_seconds,
    updated_at=now()
  where public.igpat_post_metadata.owner_user_id=auth.uid();
end; $$;

create or replace function public.igpat_get_post_metadata_v1(p_post_ids uuid[])
returns table(
  post_id uuid,
  trim_start_seconds numeric,
  trim_end_seconds numeric,
  playback_speed numeric,
  text_overlay text,
  captions_enabled boolean,
  audio_label text,
  cover_seconds numeric
) language sql security invoker set search_path=public as $$
  select m.post_id,m.trim_start_seconds,m.trim_end_seconds,m.playback_speed,m.text_overlay,m.captions_enabled,m.audio_label,m.cover_seconds
  from public.igpat_post_metadata m
  where m.post_id=any(coalesce(p_post_ids,'{}'::uuid[]));
$$;

grant execute on function public.igpat_set_post_metadata_v1(uuid,numeric,numeric,numeric,text,boolean,text,numeric) to authenticated;
grant execute on function public.igpat_get_post_metadata_v1(uuid[]) to authenticated;
