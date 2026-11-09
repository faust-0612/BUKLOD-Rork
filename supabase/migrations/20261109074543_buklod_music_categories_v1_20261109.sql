-- Additive virtual folders. Existing tracks and storage paths remain unchanged.
begin;
alter table public.buklod_music_library
 add column if not exists category text not null default 'others';
do $$
begin
 if not exists(
  select 1 from pg_constraint where conname='buklod_music_library_category_check'
   and conrelid='public.buklod_music_library'::regclass
 ) then
  alter table public.buklod_music_library add constraint buklod_music_library_category_check
   check(category in ('christian','love','instrumental','sound_clips','ambience','others'));
 end if;
end $$;
create index if not exists buklod_music_category_browse_idx
 on public.buklod_music_library(category,sort_order,title,id) where is_active;
commit;
