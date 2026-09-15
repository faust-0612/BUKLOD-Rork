-- BUKLOD IGPAT R52 — caption refinement + optional translations.
-- Depends on 20260915022000_igpat_smart_feed_controls_r47_r48.sql, which creates
-- the private igpat_captions table and creator/viewer RPC boundary.

create index if not exists igpat_captions_owner_idx
  on public.igpat_captions(owner_user_id, updated_at desc);

alter table public.igpat_captions
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.igpat_captions
  drop constraint if exists igpat_captions_translations_object;
alter table public.igpat_captions
  add constraint igpat_captions_translations_object
  check (jsonb_typeof(translations) = 'object');

create or replace function public.get_buklod_igpat_caption_v1(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  post_owner uuid;
  row_data public.igpat_captions%rowtype;
  is_owner boolean := false;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select cp.user_id into post_owner
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.is_hidden = false
    and cp.deleted_at is null
    and cp.media_mime_type like 'video/%';

  if post_owner is null then raise exception 'IGPAT is unavailable'; end if;
  is_owner := post_owner = actor;
  if not is_owner and not public.can_view_community_post_v2(p_post_id) then
    raise exception 'IGPAT is unavailable for this account';
  end if;

  select * into row_data
  from public.igpat_captions c
  where c.post_id = p_post_id;

  if row_data.post_id is null then
    return jsonb_build_object(
      'configured', false,
      'is_owner', is_owner,
      'is_visible', false,
      'translations', '{}'::jsonb
    );
  end if;

  if not is_owner and row_data.is_visible is not true then
    return jsonb_build_object(
      'configured', false,
      'is_owner', false,
      'is_visible', false,
      'translations', '{}'::jsonb
    );
  end if;

  return jsonb_build_object(
    'configured', true,
    'is_owner', is_owner,
    'language', row_data.language,
    'caption_text', row_data.caption_text,
    'segments', row_data.segments,
    'translations', coalesce(row_data.translations, '{}'::jsonb),
    'is_visible', row_data.is_visible,
    'updated_at', row_data.updated_at
  );
end;
$$;

create or replace function public.update_buklod_igpat_caption_v1(
  p_post_id uuid,
  p_caption_text text,
  p_is_visible boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_text text := trim(coalesce(p_caption_text, ''));
  row_data public.igpat_captions%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if char_length(safe_text) > 12000 then raise exception 'Caption text is too long'; end if;

  if not exists (
    select 1 from public.community_posts cp
    where cp.id = p_post_id
      and cp.user_id = actor
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
  ) then raise exception 'Only the active IGPAT creator can edit captions'; end if;

  update public.igpat_captions c
  set caption_text = safe_text,
      segments = '[]'::jsonb,
      translations = '{}'::jsonb,
      is_visible = coalesce(p_is_visible, true),
      source_model = case
        when coalesce(c.source_model, '') like '%+manual' then c.source_model
        when nullif(c.source_model, '') is null then 'manual'
        else c.source_model || '+manual'
      end,
      updated_at = now()
  where c.post_id = p_post_id
    and c.owner_user_id = actor
  returning * into row_data;

  if row_data.post_id is null then raise exception 'Generate a caption track before editing it'; end if;

  return jsonb_build_object(
    'configured', true,
    'is_owner', true,
    'language', row_data.language,
    'caption_text', row_data.caption_text,
    'segments', row_data.segments,
    'translations', coalesce(row_data.translations, '{}'::jsonb),
    'is_visible', row_data.is_visible,
    'updated_at', row_data.updated_at
  );
end;
$$;

revoke all on function public.get_buklod_igpat_caption_v1(uuid) from public;
revoke all on function public.get_buklod_igpat_caption_v1(uuid) from anon;
grant execute on function public.get_buklod_igpat_caption_v1(uuid) to authenticated, service_role;

revoke all on function public.update_buklod_igpat_caption_v1(uuid,text,boolean) from public;
revoke all on function public.update_buklod_igpat_caption_v1(uuid,text,boolean) from anon;
grant execute on function public.update_buklod_igpat_caption_v1(uuid,text,boolean) to authenticated, service_role;
