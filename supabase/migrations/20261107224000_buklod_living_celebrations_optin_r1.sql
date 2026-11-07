-- BUKLOD Living Community R1: voluntary church-scoped welcome and birthday moments.
-- Source-only until the consolidated release gate applies this migration.
-- No global discovery, no public date of birth, no automatic push fan-out.

begin;

create table if not exists public.buklod_living_celebration_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  welcome_to_church boolean not null default false,
  birthday_to_church boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.buklod_living_celebration_preferences enable row level security;
revoke all on public.buklod_living_celebration_preferences from public, anon, authenticated;
grant select, insert, update on public.buklod_living_celebration_preferences to authenticated;

drop policy if exists buklod_living_celebrations_own_select
  on public.buklod_living_celebration_preferences;
create policy buklod_living_celebrations_own_select
  on public.buklod_living_celebration_preferences
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists buklod_living_celebrations_own_insert
  on public.buklod_living_celebration_preferences;
create policy buklod_living_celebrations_own_insert
  on public.buklod_living_celebration_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists buklod_living_celebrations_own_update
  on public.buklod_living_celebration_preferences;
create policy buklod_living_celebrations_own_update
  on public.buklod_living_celebration_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- SECURITY DEFINER is limited to this exact, consent-gated data projection.
-- Do not return birth_date, year of birth, email, phone, or a cross-church member.
create or replace function public.buklod_living_church_celebrations()
returns table (
  event_kind text,
  subject_user_id uuid,
  subject_name text,
  occurred_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select p.church_id
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active is true
      and p.church_id is not null
    limit 1
  ),
  consented as (
    select
      p.id,
      left(coalesce(nullif(trim(p.full_name), ''), 'BUKLOD member'), 80) as full_name,
      coalesce(p.verified_at, p.created_at) as member_since,
      p.birth_date,
      f.welcome_to_church,
      f.birthday_to_church,
      d.show_birth_month_day
    from public.profiles p
    join viewer v on v.church_id = p.church_id
    join public.directory_preferences d
      on d.user_id = p.id and d.directory_visibility = 'church'
    join public.buklod_living_celebration_preferences f
      on f.user_id = p.id
    where p.is_active is true
      and p.is_verified is true
      and p.id <> (select auth.uid())
  ),
  celebrations as (
    select 'new_member'::text as event_kind,
      c.id as subject_user_id, c.full_name as subject_name,
      c.member_since as occurred_at
    from consented c
    where c.welcome_to_church is true
      and c.member_since >= now() - interval '7 days'
      and c.member_since <= now()

    union all

    select 'member_birthday'::text, c.id, c.full_name,
      (date_trunc('day', now() at time zone 'Asia/Manila')
        at time zone 'Asia/Manila')::timestamptz
    from consented c
    where c.birthday_to_church is true
      and c.show_birth_month_day is true
      and c.birth_date is not null
      and extract(month from c.birth_date) =
        extract(month from now() at time zone 'Asia/Manila')
      and extract(day from c.birth_date) =
        extract(day from now() at time zone 'Asia/Manila')
  )
  select c.event_kind, c.subject_user_id, c.subject_name, c.occurred_at
  from celebrations c
  order by c.occurred_at desc
  limit 6
$$;

revoke all on function public.buklod_living_church_celebrations()
  from public, anon;
grant execute on function public.buklod_living_church_celebrations()
  to authenticated;

commit;
