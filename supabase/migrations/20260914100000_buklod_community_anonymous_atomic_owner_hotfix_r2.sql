-- Anonymous root creation must satisfy legacy insert-time points triggers without
-- exposing the real author after commit. Insert with the actor inside the same
-- transaction, store the private owner mapping, then null the public user_id
-- before the RPC transaction can become visible to other sessions.

begin;

create or replace function public.create_buklod_community_living_post_v2(
  p_kind text,
  p_privacy text default 'public',
  p_body text default '',
  p_title text default null,
  p_topic text default null,
  p_quiet_mode boolean default false,
  p_poll_options jsonb default null,
  p_challenge_config jsonb default null,
  p_context_config jsonb default '{}'::jsonb,
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_kind text := lower(trim(coalesce(p_kind,'open_discussion')));
  v_privacy text := lower(trim(coalesce(p_privacy,'public')));
  v_body text := trim(coalesce(p_body,''));
  v_post_id uuid;
  v_media_path text := nullif(trim(coalesce(p_media_path,'')),'');
  v_mime text := lower(trim(coalesce(p_media_mime_type,'')));
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_actor and p.is_active=true) then raise exception 'Active BUKLOD account required'; end if;
  if v_kind <> all(array['question','need_advice','challenge','poll','idea','encouragement','help_needed','share_a_win','decision','resource','story','open_discussion','moment']::text[]) then raise exception 'Invalid Community post type'; end if;
  if v_privacy not in ('public','anonymous') then raise exception 'Invalid Community privacy'; end if;
  if v_kind='resource' and v_privacy='anonymous' then raise exception 'Resource posts show the sharer name so file ownership stays clear'; end if;
  if char_length(v_body)>12000 then raise exception 'Community post is too long'; end if;
  if public.buklod_community_hard_block_v1(v_body) then raise exception 'This content cannot be posted'; end if;
  if v_privacy='anonymous' and (
    v_body ~* '\m(?:\+?63|0)?9[0-9]{9}\M'
    or v_body ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}'
  ) then raise exception 'Remove identifying contact details from an anonymous post'; end if;
  if v_kind='poll' and (p_poll_options is null or jsonb_typeof(p_poll_options)<>'array' or jsonb_array_length(p_poll_options)<2) then raise exception 'A poll needs at least two choices'; end if;

  if v_privacy='anonymous' then
    if v_media_path is not null then
      if (storage.foldername(v_media_path))[1] is distinct from 'anonymous-media' then raise exception 'Anonymous media must use an opaque BUKLOD path'; end if;
      if v_mime<>'image/jpeg' then raise exception 'Anonymous Community media must be a JPEG photo'; end if;
      if coalesce(p_media_size_bytes,0)<1 or p_media_size_bytes>5242880 then raise exception 'Anonymous photos are limited to 5 MB'; end if;
      if not exists(select 1 from storage.objects o where o.bucket_id='community-media' and o.name=v_media_path) then raise exception 'Anonymous Community photo was not found'; end if;
    end if;

    insert into public.community_posts(
      user_id,group_id,church_id,audience,category,body,media_path,media_mime_type,media_size_bytes,
      media_duration_seconds,is_reel,author_only
    ) values(
      v_actor,null,null,'public','reflection',coalesce(nullif(v_body,''),'Shared a photo.'),v_media_path,
      nullif(v_mime,''),p_media_size_bytes,null,false,false
    ) returning id into v_post_id;

    insert into public.buklod_community_root_owners(post_id,owner_id)
    values(v_post_id,v_actor);

    update public.community_posts set user_id=null where id=v_post_id;
  else
    select public.create_buklod_community_post_v3(
      'public',null,'reflection',v_body,p_media_path,p_media_mime_type,p_media_size_bytes,'{}'::uuid[],null,false
    ) into v_post_id;
  end if;

  perform public.set_buklod_community_post_meta_v1(
    v_post_id,v_kind,v_privacy,p_title,p_topic,coalesce(p_quiet_mode,false),
    p_poll_options,p_challenge_config,coalesce(p_context_config,'{}'::jsonb)
  );
  update public.buklod_community_post_meta set moderation_state='pending',updated_at=now() where post_id=v_post_id;
  return v_post_id;
end
$$;

revoke all on function public.create_buklod_community_living_post_v2(text,text,text,text,text,boolean,jsonb,jsonb,jsonb,text,text,bigint) from public,anon;
grant execute on function public.create_buklod_community_living_post_v2(text,text,text,text,text,boolean,jsonb,jsonb,jsonb,text,text,bigint) to authenticated;

commit;
