-- BUKLOD Community Living Wall R1 private-parent branch guard
-- A poster-only Dugtong may be continued only by its author or the root poster.

begin;

create or replace function public.create_buklod_dugtong_v1(
  p_post_id uuid,
  p_parent_id uuid default null,
  p_body text default '',
  p_type text default 'continuation',
  p_privacy text default 'public',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_body text := trim(coalesce(p_body,''));
  v_parent public.buklod_community_dugtongs%rowtype;
  v_root_owner uuid;
  v_depth smallint := 1;
  v_id uuid := gen_random_uuid();
  v_branch uuid;
  v_count integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  if not public.buklod_community_can_access_root_v1(p_post_id,v_actor) then
    raise exception 'Post is not available for Dugtong';
  end if;

  select p.user_id into v_root_owner
  from public.community_posts p
  where p.id=p_post_id and p.deleted_at is null;

  if char_length(v_body)<1 or char_length(v_body)>4000 then
    raise exception 'Dugtong must be 1 to 4000 characters';
  end if;
  if (length(lower(v_body))-length(replace(lower(v_body),'http','')))/4 > 5 then
    raise exception 'Too many links in one Dugtong';
  end if;

  if p_parent_id is not null then
    select * into v_parent
    from public.buklod_community_dugtongs d
    where d.id=p_parent_id
      and d.root_post_id=p_post_id
      and d.deleted_at is null;
    if not found then
      raise exception 'Parent Dugtong was not found in this chain';
    end if;

    if v_parent.privacy='private_poster'
       and v_parent.user_id<>v_actor
       and v_root_owner<>v_actor then
      raise exception 'This private Dugtong is not available to continue';
    end if;

    v_depth := (v_parent.depth+1)::smallint;
    if v_depth>24 then
      raise exception 'This branch is already deep. Start from the original post.';
    end if;
    v_branch := coalesce(v_parent.branch_id,v_parent.id);
  else
    v_branch := v_id;
  end if;

  if nullif(trim(coalesce(p_media_path,'')),'') is not null
     and (storage.foldername(p_media_path))[1] is distinct from v_actor::text then
    raise exception 'Invalid Dugtong media path';
  end if;

  insert into public.buklod_community_dugtongs(
    id,root_post_id,parent_id,branch_id,user_id,body,dugtong_type,privacy,depth,
    media_path,media_mime_type,media_size_bytes
  ) values(
    v_id,p_post_id,p_parent_id,v_branch,v_actor,v_body,
    lower(trim(coalesce(p_type,'continuation'))),
    lower(trim(coalesce(p_privacy,'public'))),
    v_depth,
    nullif(trim(coalesce(p_media_path,'')),''),
    nullif(lower(trim(coalesce(p_media_mime_type,''))),''),
    p_media_size_bytes
  );

  select count(*)::integer into v_count
  from public.buklod_community_dugtongs d
  where d.root_post_id=p_post_id
    and d.user_id=v_actor
    and d.deleted_at is null;

  if v_count=1 then
    perform public.buklod_community_award_small_v1(
      v_actor,
      'community_dugtong',
      'community_dugtong:'||p_post_id::text,
      1,
      'Meaningful Dugtong added to a Community chain'
    );
  end if;

  insert into public.buklod_community_post_meta(post_id,kind,chain_status,updated_at)
  values(p_post_id,'open_discussion','growing',now())
  on conflict(post_id) do update set
    chain_status=case
      when public.buklod_community_post_meta.chain_status='resolved' then 'resolved'
      else 'growing'
    end,
    updated_at=now();

  return jsonb_build_object(
    'id',v_id,
    'root_post_id',p_post_id,
    'parent_id',p_parent_id,
    'depth',v_depth,
    'branch_id',v_branch
  );
end
$$;

revoke all on function public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint) from public,anon;
grant execute on function public.create_buklod_dugtong_v1(uuid,uuid,text,text,text,text,text,bigint) to authenticated;

commit;
