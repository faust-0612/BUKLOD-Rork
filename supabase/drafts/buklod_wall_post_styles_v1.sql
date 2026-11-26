-- DEV SQL candidate only; no production DDL or migration activation.
begin;
create table if not exists public.buklod_wall_post_styles_v1 (
 post_id uuid primary key references public.community_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 design_id text,
 font_id text not null default 'standard',
 animated boolean not null default false,
 created_at timestamptz not null default now(),
 check (font_id in ('standard','bold','serif','editorial','royal','cosmic','divine')),
 check (not animated or design_id is not null)
);
alter table public.buklod_wall_post_styles_v1 enable row level security;
revoke all on public.buklod_wall_post_styles_v1 from public,anon,authenticated;
grant select,insert on public.buklod_wall_post_styles_v1 to authenticated;
-- Policy checks the existing canonical rank RPC, never user-provided rank.
create policy wall_post_style_read_v1 on public.buklod_wall_post_styles_v1
 for select to authenticated using (public.can_view_community_post_v2(post_id));
create policy wall_post_style_insert_v1 on public.buklod_wall_post_styles_v1
 for insert to authenticated with check (
 author_id=(select auth.uid())
 and exists(select 1 from public.community_posts p where p.id=post_id
   and p.user_id=(select auth.uid()) and p.deleted_at is null and not coalesce(p.is_reel,false)
   and p.media_path is null and p.media_mime_type is null and nullif(pg_catalog.btrim(p.body),'') is not null)
 and not exists(select 1 from public.community_post_media m where m.post_id=buklod_wall_post_styles_v1.post_id)
 and exists(select 1 from public.get_my_buklod_rank_progress() r where
   r.rank_order between 1 and 40
   and r.rank_order >= case font_id when 'standard' then 1 when 'bold' then 2 when 'serif' then 8 when 'editorial' then 18 when 'royal' then 28 when 'cosmic' then 33 when 'divine' then 38 else 99 end
   and (design_id is null or exists(select 1 from (values
    ('emerald-faith',6,7),
    ('sapphire-dawn',8,8),
    ('garden-of-hope',10,10),
    ('amethyst-sky',11,12),
    ('crystal-waters',13,13),
    ('quiet-moon',15,15),
    ('golden-light',16,17),
    ('bronze-legacy',18,18),
    ('architects-dawn',20,20),
    ('aurora-blessing',21,22),
    ('ocean-of-grace',23,23),
    ('living-paradise',25,25),
    ('ember-crown',26,27),
    ('sunrise-victory',28,28),
    ('crimson-valour',30,30),
    ('royal-nebula',31,32),
    ('celestial-throne',33,33),
    ('infinity-orbit',35,35),
    ('genesis-of-light',36,37),
    ('eternal-crown',38,38),
    ('divine-cosmos',40,40)
   ) as allowed(id,min_rank,min_motion_rank)
    where allowed.id=design_id and r.rank_order>=allowed.min_rank and (not animated or r.rank_order>=allowed.min_motion_rank)))
 )
);
-- Rendering also checks current media state so a later legacy media edit does
-- not show a text-only design over photos or videos. Post privacy unchanged.
commit;
