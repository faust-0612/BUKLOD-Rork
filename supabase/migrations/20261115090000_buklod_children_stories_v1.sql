-- BUKLOD Children's Story World v1
-- Server keeps only adult-approved editorial content. No child identities or private reading records.
create table if not exists public.buklod_children_stories (
  id text primary key check (id ~ '^[a-z0-9-]{3,70}$'),
  payload jsonb not null,
  is_published boolean not null default false,
  publish_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint children_story_payload_shape check (
    jsonb_typeof(payload) = 'object'
    and payload->>'id' = id
    and payload->>'source' = 'published'
    and length(payload::text) <= 45000
    and case when jsonb_typeof(payload->'pages') = 'array'
      then jsonb_array_length(payload->'pages') between 3 and 16
      else false
    end
  )
);
create index if not exists buklod_children_stories_publication_idx
  on public.buklod_children_stories (is_published, publish_at)
  where is_published = true;

alter table public.buklod_children_stories enable row level security;
revoke all on public.buklod_children_stories from public, anon, authenticated;
grant select, insert, update, delete on public.buklod_children_stories to authenticated;

drop policy if exists "Children stories published read" on public.buklod_children_stories;
create policy "Children stories published read" on public.buklod_children_stories
  for select to authenticated
  using (is_published and (publish_at is null or publish_at <= now()));

drop policy if exists "Children stories system admin read" on public.buklod_children_stories;
create policy "Children stories system admin read" on public.buklod_children_stories
  for select to authenticated
  using ((select public.is_system_admin()));

drop policy if exists "Children stories system admin insert" on public.buklod_children_stories;
create policy "Children stories system admin insert" on public.buklod_children_stories
  for insert to authenticated
  with check ((select public.is_system_admin()) and created_by = (select auth.uid()));

drop policy if exists "Children stories system admin update" on public.buklod_children_stories;
create policy "Children stories system admin update" on public.buklod_children_stories
  for update to authenticated
  using ((select public.is_system_admin()))
  with check ((select public.is_system_admin()));

drop policy if exists "Children stories system admin delete" on public.buklod_children_stories;
create policy "Children stories system admin delete" on public.buklod_children_stories
  for delete to authenticated
  using ((select public.is_system_admin()));

comment on table public.buklod_children_stories is
  'Children story editorial catalog only; no child accounts, names, user progress or ad tracking.';
