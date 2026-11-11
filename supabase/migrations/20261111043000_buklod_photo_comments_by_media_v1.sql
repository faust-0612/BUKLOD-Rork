
-- Recover legacy image posts that had only post-level media metadata.
-- Never touch the physical media or overwrite any existing multi-photo post.
insert into public.community_post_media(
 post_id, media_position, media_path, media_mime_type, media_size_bytes
)
select cp.id, 0::smallint, cp.media_path, cp.media_mime_type, cp.media_size_bytes
from public.community_posts cp
where cp.media_path is not null and cp.media_mime_type like 'image/%'
 and cp.is_hidden = false and cp.deleted_at is null
 and not exists (
  select 1 from public.community_post_media m where m.post_id = cp.id
 )
on conflict (post_id, media_position) do nothing;

-- Independently threaded photo comments; posts and the existing post-wide comments are unchanged.
create table if not exists public.community_photo_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  media_position smallint not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_request_key text not null check (char_length(client_request_key) between 8 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint buklod_photo_comments_media_fk foreign key (post_id, media_position)
    references public.community_post_media(post_id, media_position) on delete cascade,
  constraint buklod_photo_comments_request_unique unique (user_id, client_request_key)
);
create index if not exists idx_buklod_photo_comments_visible
 on public.community_photo_comments(post_id, media_position, created_at desc, id desc)
 where is_hidden = false;
alter table public.community_photo_comments enable row level security;
revoke all on table public.community_photo_comments from public, anon, authenticated;
grant all on table public.community_photo_comments to service_role;

create or replace function public.get_buklod_photo_comment_summary_v1(
 p_post_id uuid, p_media_position smallint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if not public.can_view_community_post_v2(p_post_id) then
  raise exception 'Post is unavailable';
 end if;
 if not exists (
  select 1 from public.community_post_media m
  where m.post_id=p_post_id and m.media_position=p_media_position
   and m.media_mime_type like 'image/%'
 ) then raise exception 'Photo is unavailable'; end if;
 return jsonb_build_object(
  'comment_count', (
   select count(*) from public.community_photo_comments c
   where c.post_id=p_post_id and c.media_position=p_media_position and not c.is_hidden
  ),
  'comments', coalesce((
   select jsonb_agg(to_jsonb(rows) order by rows.created_at desc, rows.id desc)
   from (
    select c.id, c.user_id, c.body, c.created_at,
     coalesce(nullif(btrim(p.full_name),''), nullif(btrim(p.username),''), 'BUKLOD member') as author_name
    from public.community_photo_comments c
    left join public.profiles p on p.id=c.user_id
    where c.post_id=p_post_id and c.media_position=p_media_position and not c.is_hidden
    order by c.created_at desc, c.id desc limit 60
   ) rows
  ), '[]'::jsonb)
 );
end $$;

create or replace function public.add_buklod_photo_comment_v1(
 p_post_id uuid, p_media_position smallint, p_body text, p_request_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
 actor uuid := (select auth.uid());
 clean_body text := btrim(coalesce(p_body,''));
 prior record;
 new_id uuid;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if not public.can_view_community_post_v2(p_post_id) then
  raise exception 'Post is unavailable';
 end if;
 if not exists (
  select 1 from public.community_post_media m
  where m.post_id=p_post_id and m.media_position=p_media_position
   and m.media_mime_type like 'image/%'
 ) then raise exception 'Photo is unavailable'; end if;
 if char_length(clean_body) not between 1 and 2000 then
  raise exception 'Comment must be 1 to 2000 characters';
 end if;
 if p_request_key is null or p_request_key !~ '^[A-Za-z0-9:._-]{8,80}$' then
  raise exception 'Invalid request key';
 end if;
 select c.id,c.post_id,c.media_position,c.body into prior
 from public.community_photo_comments c
 where c.user_id=actor and c.client_request_key=p_request_key;
 if found then
  if prior.post_id<>p_post_id or prior.media_position<>p_media_position or prior.body<>clean_body then
   raise exception 'Request key was already used';
  end if;
  return prior.id;
 end if;
 insert into public.community_photo_comments(post_id,media_position,user_id,body,client_request_key)
 values(p_post_id,p_media_position,actor,clean_body,p_request_key)
 on conflict(user_id,client_request_key) do nothing returning id into new_id;
 if new_id is null then
  select c.id,c.post_id,c.media_position,c.body into prior
  from public.community_photo_comments c
  where c.user_id=actor and c.client_request_key=p_request_key;
  if not found or prior.post_id<>p_post_id or prior.media_position<>p_media_position
   or prior.body<>clean_body then
    raise exception 'Request key conflict';
  end if;
  new_id:=prior.id;
 end if;
 return new_id;
end $$;

create or replace function public.delete_buklod_photo_comment_v1(
 p_comment_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); deleted_id uuid;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 delete from public.community_photo_comments
 where id=p_comment_id and user_id=actor
 returning id into deleted_id;
 return deleted_id is not null;
end $$;

revoke all on function public.get_buklod_photo_comment_summary_v1(uuid,smallint) from public,anon,authenticated;
revoke all on function public.add_buklod_photo_comment_v1(uuid,smallint,text,text) from public,anon,authenticated;
revoke all on function public.delete_buklod_photo_comment_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_buklod_photo_comment_summary_v1(uuid,smallint) to authenticated;
grant execute on function public.add_buklod_photo_comment_v1(uuid,smallint,text,text) to authenticated;
grant execute on function public.delete_buklod_photo_comment_v1(uuid) to authenticated;

-- One audience-protected, index-backed count request for the entire photo collage.
create or replace function public.get_buklod_photo_comment_counts_v1(
 p_post_id uuid
) returns table(media_position smallint, comment_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if not public.can_view_community_post_v2(p_post_id) then
  raise exception 'Post is unavailable';
 end if;
 return query
 select c.media_position, count(*)::bigint
 from public.community_photo_comments c
 where c.post_id = p_post_id and not c.is_hidden
 group by c.media_position;
end $$;
revoke all on function public.get_buklod_photo_comment_counts_v1(uuid) from public,anon,authenticated;
grant execute on function public.get_buklod_photo_comment_counts_v1(uuid) to authenticated;

