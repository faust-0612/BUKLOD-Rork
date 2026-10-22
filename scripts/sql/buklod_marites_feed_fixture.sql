-- Disposable GitHub Actions database only. Never run this fixture in production.
begin;
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.profiles(id uuid primary key,full_name text,avatar_url text,is_active boolean);
create table public.buklod_scopes(id uuid primary key,scope_type text,status text);
create table public.buklod_scope_memberships(scope_id uuid,user_id uuid,membership_status text);
create table public.community_posts(
 id uuid primary key,user_id uuid,body text,created_at timestamptz,media_path text,
 media_mime_type text,audience text default 'public',scope_id uuid,
 deleted_at timestamptz,is_hidden boolean default false,author_only boolean default false
);
create table public.community_post_media(post_id uuid,media_path text,media_mime_type text,media_position smallint);
create table public.reactions(post_id uuid,user_id uuid,reaction text);
create table public.post_mentions(post_id uuid,mentioned_user_id uuid);
create table public.buklod_community_post_meta(post_id uuid,privacy text,moderation_state text);
create function public.buklod_is_system_admin() returns boolean language sql as $$ select false $$;
create function public.buklod_community_root_owner_v1(p_id uuid) returns uuid language sql as
$$ select user_id from public.community_posts where id=p_id $$;
create function public.can_view_community_post_v2(p_id uuid) returns boolean language sql as $$
 select exists(select 1 from public.community_posts p
 join public.profiles viewer on viewer.id=auth.uid() and viewer.is_active
 where p.id=p_id and p.deleted_at is null and not p.is_hidden
 and (not p.author_only or p.user_id=auth.uid()))
$$;
\i scripts/sql/buklod_marites_feed_v1.sql

insert into public.profiles values
 ('00000000-0000-0000-0000-000000000001','Viewer','viewer.jpg',true),
 ('00000000-0000-0000-0000-000000000002','Peer','peer.jpg',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
-- More than a full Community page of unrelated newer posts.
insert into public.community_posts(id,user_id,body,created_at)
 select md5('ordinary-'||n)::uuid,'00000000-0000-0000-0000-000000000002','ordinary',now() - n*interval '1 minute'
 from generate_series(1,150) n;
insert into public.community_posts(id,user_id,body,created_at,media_path,media_mime_type) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',chr(8203)||chr(8204)||chr(8205)||chr(8288)||'text story',now()-interval '4 days',null,null),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','photo story',now()-interval '4 days',null,null),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','legacy photo',now()-interval '5 days','peer/marites-photo.jpg','image/jpeg');
insert into public.community_post_media values
 ('10000000-0000-0000-0000-000000000002','peer/marites-unmarked.jpg','image/jpeg',0);
-- Restrictive cases must stay excluded.
insert into public.community_posts(id,user_id,body,created_at,media_path,author_only,is_hidden,deleted_at)
 values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','private',now(),'marites-private.jpg',true,false,null),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','hidden',now(),'marites-hidden.jpg',false,true,null),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','deleted',now(),'marites-deleted.jpg',false,false,now()),
 ('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','blocked',now(),'marites-blocked.jpg',false,false,null);
insert into public.buklod_community_post_meta values
 ('20000000-0000-0000-0000-000000000004','public','blocked');

do $$
declare ids uuid[]; total integer;
begin
 if has_function_privilege('anon','public.get_buklod_marites_feed_v1(uuid,integer,integer)','execute') then
   raise exception 'anon can execute'; end if;
 if not has_function_privilege('authenticated','public.get_buklod_marites_feed_v1(uuid,integer,integer)','execute') then
   raise exception 'authenticated cannot execute'; end if;
 select count(*) into total from public.get_buklod_marites_feed_v1(null,20,0);
 if total<>3 then raise exception 'Expected 3 stories beyond the Community window, got %',total; end if;
 select array_agg(id) into ids from public.get_buklod_marites_feed_v1(null,1,0);
 if ids<>array['10000000-0000-0000-0000-000000000002'::uuid] then raise exception 'Tie ordering failed'; end if;
 select array_agg(id) into ids from public.get_buklod_marites_feed_v1(null,1,1);
 if ids<>array['10000000-0000-0000-0000-000000000001'::uuid] then raise exception 'Offset paging failed'; end if;
 if not exists(select 1 from public.get_buklod_marites_feed_v1(null,20,0)
 where id='10000000-0000-0000-0000-000000000002' and media_items->0->>'media_path'='peer/marites-unmarked.jpg') then
   raise exception 'Unmarked photo path not attached'; end if;
 begin
   perform public.get_buklod_marites_feed_v1('99999999-0000-0000-0000-000000000001',20,0);
   raise exception 'Invalid scope accepted';
 exception when others then
   if sqlerrm<>'Invalid Public Community location filter' then raise; end if;
 end;
end $$;

insert into public.buklod_community_post_meta values
 ('10000000-0000-0000-0000-000000000001','anonymous','approved');
insert into public.buklod_community_post_meta values
 ('10000000-0000-0000-0000-000000000002','anonymous','approved');
do $$ begin
 if exists(select 1 from public.get_buklod_marites_feed_v1(null,20,0)
 where id='10000000-0000-0000-0000-000000000001'
 and (user_id is not null or avatar_url is not null or author_name<>'Anonymous BUKLOD Member')) then
   raise exception 'Anonymous identity leaked'; end if;
end $$;
-- A photo-only anonymous story must never expose the author's ID in
-- user_id, avatar URL, primary media path or JSON media items.
do $ begin
 if not exists(
   select 1 from public.get_buklod_marites_feed_v1(null,20,0)
   where id='10000000-0000-0000-0000-000000000002'
     and user_id is null and avatar_url is null and media_path is null
     and media_items='[]'::jsonb
 ) then raise exception 'Anonymous photo storage path or identity exposed'; end if;
end $;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin
   perform public.get_buklod_marites_feed_v1();
   raise exception 'Unauthenticated call accepted';
 exception when others then
   if sqlerrm<>'Authentication required' then raise; end if;
 end;
end $$;
rollback;
