-- Additive creative metadata. No changes to existing post/media RPC signatures.
create table if not exists public.buklod_post_creatives (
 post_id uuid primary key references public.community_posts(id) on delete cascade,
 created_by uuid not null,
 music_track_id uuid references public.buklod_music_library(id) on delete set null,
 motion_preset text not null default 'none'
  check (motion_preset in ('none','zoom','pan','float','fade')),
 created_at timestamptz not null default now(),
 check (music_track_id is not null or motion_preset <> 'none')
);
create index if not exists buklod_post_creatives_track_idx
 on public.buklod_post_creatives(music_track_id) where music_track_id is not null;
alter table public.buklod_post_creatives enable row level security;
grant select, insert, update, delete on public.buklod_post_creatives to authenticated;

create policy "Read creative metadata of visible posts"
 on public.buklod_post_creatives for select to authenticated
 using (public.can_view_community_post_v2(post_id));

create policy "Author creates own post creative metadata"
 on public.buklod_post_creatives for insert to authenticated
 with check (
  created_by = (select auth.uid())
  and exists (select 1 from public.community_posts p
   where p.id=post_id and p.user_id=(select auth.uid()))
  and (music_track_id is null or exists (
   select 1 from public.buklod_music_library m
   where m.id=music_track_id and m.is_active=true))
 );

create policy "Author updates own post creative metadata"
 on public.buklod_post_creatives for update to authenticated
 using (
  created_by=(select auth.uid())
  and exists (select 1 from public.community_posts p
   where p.id=post_id and p.user_id=(select auth.uid()))
 )
 with check (
  created_by=(select auth.uid())
  and exists (select 1 from public.community_posts p
   where p.id=post_id and p.user_id=(select auth.uid()))
  and (music_track_id is null or exists (
   select 1 from public.buklod_music_library m
   where m.id=music_track_id and m.is_active=true))
 );
create policy "Author deletes own post creative metadata"
 on public.buklod_post_creatives for delete to authenticated
 using (created_by=(select auth.uid()));
