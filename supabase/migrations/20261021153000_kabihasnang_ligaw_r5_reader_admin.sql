-- Kabihasnang Ligaw R5 reader, admin, unlock, and points.
-- Additive candidate. Do not apply to production from this change.
-- No daily OTA. No client writes to the points ledger. Points and Bayanihan stay separate.

create table if not exists public.kl_publication_control (
  id boolean primary key default true check (id),
  emergency_stop boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.kl_publication_control (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.kl_seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.kl_episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.kl_seasons(id),
  episode_number integer not null,
  title text not null,
  content jsonb not null default '[]'::jsonb,
  release_at timestamptz not null,
  approved_at timestamptz,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

alter table public.kl_seasons add column if not exists protagonist text;
alter table public.kl_seasons add column if not exists episode_count integer not null default 30;
alter table public.kl_seasons add column if not exists emergency_stop boolean not null default false;
alter table public.kl_seasons add column if not exists updated_at timestamptz not null default now();

alter table public.kl_episodes add column if not exists kind text not null default 'episode';
alter table public.kl_episodes add column if not exists title_mode text not null default 'outline_label';
alter table public.kl_episodes add column if not exists manuscript_status text not null default 'outline_only';
alter table public.kl_episodes add column if not exists prose_complete boolean not null default false;
alter table public.kl_episodes add column if not exists media_gate text not null default 'missing';
alter table public.kl_episodes add column if not exists approved_by uuid;
alter table public.kl_episodes add column if not exists revision_notes text;
alter table public.kl_episodes add column if not exists updated_at timestamptz not null default now();

do $$
declare r record;
begin
  for r in
    select c.conname, t.relname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname in ('kl_seasons', 'kl_episodes', 'kl_reward_outbox')
      and c.contype = 'c'
  loop
    execute format('alter table public.%I drop constraint %I', r.relname, r.conname);
  end loop;
end $$;

alter table public.kl_reward_outbox drop constraint if exists kl_reward_outbox_source_type_check;
alter table public.kl_reward_outbox
  add constraint kl_reward_outbox_source_type_check
  check (source_type in ('episode', 'season'));

alter table public.kl_reward_outbox drop constraint if exists kl_reward_outbox_points_check;
alter table public.kl_reward_outbox
  add constraint kl_reward_outbox_points_check
  check (points >= 0);

alter table public.kl_reward_outbox drop constraint if exists kl_reward_outbox_status_check;
alter table public.kl_reward_outbox
  add constraint kl_reward_outbox_status_check
  check (status in ('pending', 'posted', 'failed'));

alter table public.kl_seasons drop constraint if exists kl_seasons_status_check;
alter table public.kl_seasons
  add constraint kl_seasons_status_check
  check (status in ('draft', 'approved', 'live', 'paused'));

alter table public.kl_episodes drop constraint if exists kl_episodes_status_check;
alter table public.kl_episodes
  add constraint kl_episodes_status_check
  check (status in ('draft', 'needs_revision', 'outline_only', 'approved', 'scheduled', 'live', 'paused'));

alter table public.kl_episodes drop constraint if exists kl_episodes_episode_number_check;
alter table public.kl_episodes
  add constraint kl_episodes_episode_number_check
  check (episode_number >= 0);

alter table public.kl_episodes drop constraint if exists kl_episodes_content_check;
alter table public.kl_episodes
  add constraint kl_episodes_content_check
  check (jsonb_typeof(content) = 'array');

alter table public.kl_episodes drop constraint if exists kl_episodes_manuscript_status_check;
alter table public.kl_episodes
  add constraint kl_episodes_manuscript_status_check
  check (manuscript_status in ('content_blocked', 'outline_only', 'approved_complete'));

alter table public.kl_episodes drop constraint if exists kl_episodes_media_gate_check;
alter table public.kl_episodes
  add constraint kl_episodes_media_gate_check
  check (media_gate in ('missing', 'provisional', 'unapproved', 'clear'));

create table if not exists public.kl_story_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.kl_episodes(id),
  completed_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

alter table public.kl_story_progress add column if not exists point_ledger_id uuid;
alter table public.kl_story_progress add column if not exists source_key text;

create table if not exists public.kl_season_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references public.kl_seasons(id),
  completed_at timestamptz not null default now(),
  primary key (user_id, season_id)
);

alter table public.kl_season_progress add column if not exists point_ledger_id uuid;
alter table public.kl_season_progress add column if not exists source_key text;

create table if not exists public.kl_reward_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('episode', 'season')),
  source_id uuid not null,
  points integer not null check (points >= 0),
  status text not null default 'pending' check (status in ('pending', 'posted', 'failed')),
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

alter table public.kl_reward_outbox add column if not exists ledger_id uuid;
alter table public.kl_reward_outbox add column if not exists last_error text;

create table if not exists public.kl_story_journey (
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references public.kl_seasons(id),
  episode_id uuid not null references public.kl_episodes(id),
  progress_percent integer not null check (progress_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

create table if not exists public.kl_storyboard (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.kl_episodes(id),
  scene_id text not null unique,
  paragraph_start integer,
  paragraph_end integer,
  editorial_intent text,
  status text not null,
  artwork_status text not null default 'NO_ARTWORK',
  approval_status text not null default 'pending',
  approved boolean not null default false,
  required boolean not null default true
);

create table if not exists public.kl_assets (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid references public.kl_episodes(id),
  scene_id text,
  kind text not null,
  storage_path text,
  classification text not null,
  required boolean not null default false,
  approved boolean not null default false,
  reason text not null default '',
  unique (episode_id, scene_id, kind)
);

create table if not exists public.kl_living_layers (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.kl_episodes(id),
  layer text not null,
  activation text not null,
  paragraph_start integer,
  paragraph_end integer,
  approved boolean not null default false,
  active boolean not null default false,
  unique (episode_id, layer)
);

create table if not exists public.kl_glossary (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  definition text not null,
  approved boolean not null default false
);

create table if not exists public.kl_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  episode_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.kl_reader_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('library', 'image', 'audio', 'unlock')),
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists kl_episode_release_idx
  on public.kl_episodes (release_at)
  where status in ('approved', 'scheduled', 'live');

insert into public.buklod_point_rules (
  activity_type, label, base_points, max_points_per_event,
  daily_cap_points, weekly_cap_points, is_active, notes, updated_at
)
values
  (
    'kl_episode_completion',
    'Kabihasnang Ligaw episode',
    2, 2, null, null, true,
    'Default +2 for a valid first-time episode completion. Configured here, not in the client. Points only.',
    now()
  ),
  (
    'kl_season_completion',
    'Kabihasnang Ligaw season',
    10, 10, null, null, true,
    'Default +10 for a valid first-time season completion. Configured here, not in the client. Points only.',
    now()
  )
on conflict (activity_type) do nothing;

insert into public.kl_seasons (id, slug, title, status, protagonist, episode_count)
values (
  '22222222-2222-4222-8222-000000000001',
  'phan-ang-lupang-hindi-namamatay',
  'Ang Lupang Hindi Namamatay',
  'draft',
  'Phan',
  30
)
on conflict (id) do nothing;

insert into public.kl_episodes (
  id, season_id, episode_number, title, content, release_at, status,
  kind, title_mode, manuscript_status, prose_complete, media_gate
)
select
  ('11111111-1111-4111-8111-' || lpad(n::text, 12, '0'))::uuid,
  '22222222-2222-4222-8222-000000000001',
  n,
  case
    when n = 0 then 'Panimula'
    when n = 1 then 'Ang Gabi ng Pag-ahon'
    else 'Kabanata ' || lpad(n::text, 2, '0')
  end,
  '[]'::jsonb,
  timestamptz '2099-01-01 22:00:00+00',
  case when n >= 2 then 'outline_only' else 'draft' end,
  case when n = 0 then 'panimula' else 'episode' end,
  case when n >= 2 then 'outline_label' else 'canon_title' end,
  case when n >= 2 then 'outline_only' else 'content_blocked' end,
  false,
  'missing'
from generate_series(0, 30) as n
on conflict (season_id, episode_number) do nothing;

insert into public.kl_storyboard (
  episode_id, scene_id, paragraph_start, paragraph_end, editorial_intent, status, artwork_status, approval_status, approved, required
)
select
  '11111111-1111-4111-8111-000000000001'::uuid,
  's1-e01-shot-' || lpad(shot::text, 2, '0'),
  null,
  null,
  case shot
    when 1 then $s$Phan tying harvested stalks in a quiet Lunawen storehouse as a floor crack forms.$s$
    when 2 then $s$Mother and Tali at the doorway while earth and a pale-green veined root rise beside the storehouse.$s$
    when 3 then $s$A small child gripping a fissure edge above luminous roots, Phan lowering a knotted rope.$s$
    when 4 then $s$Phan hauling the child while the father's voice is heard; no visible ghost or physical father.$s$
    else $s$Moonlit water vessel reflection and the child's absent cast shadow, preserving the narrative distinction: reflection visible, ground shadow absent.$s$
  end,
  'CONTENT BLOCKED / MANUSCRIPT NOT IN REPOSITORY / NO ARTWORK',
  'NO_ARTWORK',
  'pending',
  false,
  true
from generate_series(1, 5) as shot
on conflict (scene_id) do nothing;

insert into public.kl_storyboard (
  episode_id, scene_id, paragraph_start, paragraph_end, editorial_intent, status, artwork_status, approval_status, approved, required
)
select
  ('11111111-1111-4111-8111-' || lpad(n::text, 12, '0'))::uuid,
  case when n = 0 then 's1-panimula-unbound' else 's1-e' || lpad(n::text, 2, '0') || '-outline' end,
  null,
  null,
  null,
  case
    when n = 0 then 'CONTENT BLOCKED / MANUSCRIPT NOT IN REPOSITORY / NO ARTWORK'
    else 'OUTLINE ONLY / MANUSCRIPT NOT APPROVED / NO ARTWORK'
  end,
  'NO_ARTWORK',
  'pending',
  false,
  true
from generate_series(0, 30) as n
where n <> 1
on conflict (scene_id) do nothing;

insert into public.kl_assets (episode_id, scene_id, kind, storage_path, classification, required, approved, reason)
select b.episode_id, b.scene_id, 'illustration', null, 'MISSING', true, false,
  'No scene-accurate illustration binary. Owner approval remains pending.'
from public.kl_storyboard b
on conflict (episode_id, scene_id, kind) do nothing;

insert into public.kl_assets (episode_id, scene_id, kind, storage_path, classification, required, approved, reason)
select null, 'library-music', 'music', null, 'MISSING', false, false, 'No original or licensed melodic instrumental file.'
where not exists (
  select 1 from public.kl_assets a where a.kind = 'music' and a.scene_id = 'library-music'
);

insert into public.kl_assets (episode_id, scene_id, kind, storage_path, classification, required, approved, reason)
select null, 'library-ambient', 'ambient', null, 'MISSING', false, false, 'No original or licensed ambient bed.'
where not exists (
  select 1 from public.kl_assets a where a.kind = 'ambient' and a.scene_id = 'library-ambient'
);

insert into public.kl_living_layers (
  episode_id, layer, activation, paragraph_start, paragraph_end, approved, active
)
select
  '11111111-1111-4111-8111-000000000001'::uuid,
  layer,
  'BLOCKED_UNTIL_WORD_FOR_WORD_MANUSCRIPT',
  null,
  null,
  false,
  false
from (values ('rain'), ('wind_foliage'), ('magical_glow'), ('water_ripples')) as layers(layer)
on conflict (episode_id, layer) do nothing;

create or replace function public.kl_audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Kabihasnang Ligaw audit is append-only';
end;
$$;

drop trigger if exists kl_audit_no_update on public.kl_audit;
create trigger kl_audit_no_update
before update or delete on public.kl_audit
for each row execute function public.kl_audit_immutable();

create or replace function public.kl_is_manila_six(p_release timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_release is not null
    and extract(hour from timezone('Asia/Manila', p_release)) = 6
    and extract(minute from timezone('Asia/Manila', p_release)) = 0
    and extract(second from timezone('Asia/Manila', p_release)) < 1;
$$;

create or replace function public.kl_release_from_manila_date(p_date date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_date is null then null
    else (p_date::timestamp + time '06:00') at time zone 'Asia/Manila'
  end;
$$;

create or replace function public.kl_episode_member_visible(p_episode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kl_episodes e
    join public.kl_seasons s on s.id = e.season_id
    where e.id = p_episode_id
      and coalesce(s.emergency_stop, false) = false
      and s.status in ('approved', 'live')
      and e.status in ('approved', 'scheduled', 'live')
      and e.approved_at is not null
      and e.release_at <= now()
      and e.prose_complete
      and e.manuscript_status = 'approved_complete'
      and e.media_gate = 'clear'
      and exists (
        select 1
        from jsonb_array_elements(e.content) elem
        where length(trim(coalesce(elem->>'text', ''))) > 0
      )
      and exists (
        select 1 from public.kl_assets a
        where a.episode_id = e.id
          and a.required
          and a.approved
          and a.classification = 'APPROVED'
      )
      and not exists (
        select 1 from public.kl_assets a
        where a.episode_id = e.id
          and a.required
          and (a.approved is distinct from true or a.classification is distinct from 'APPROVED')
      )
      and not exists (
        select 1 from public.kl_storyboard b
        where b.episode_id = e.id
          and b.required
          and (b.paragraph_start is null or b.paragraph_end is null or b.approved is distinct from true)
      )
      and not exists (
        select 1 from public.kl_publication_control c
        where c.emergency_stop
      )
  );
$$;

create or replace function public.kl_post_points_v1(
  p_user uuid,
  p_activity text,
  p_source_key text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_points integer;
  rule_max integer;
  award integer;
  ledger_id uuid;
  has_claim boolean;
begin
  if p_user is null or p_source_key is null or length(trim(p_source_key)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'reward_rule_missing');
  end if;

  if exists (
    select 1 from public.buklod_points_ledger l
    where l.user_id = p_user and l.source_key = p_source_key
  ) then
    select l.id into ledger_id
    from public.buklod_points_ledger l
    where l.user_id = p_user and l.source_key = p_source_key
    limit 1;
    return jsonb_build_object('ok', true, 'already', true, 'points', 0, 'ledger_id', ledger_id);
  end if;

  select r.base_points, r.max_points_per_event
    into rule_points, rule_max
  from public.buklod_point_rules r
  where r.activity_type = p_activity
    and coalesce(r.is_active, false) = true
  limit 1;

  if rule_points is null or rule_max is null then
    return jsonb_build_object('ok', false, 'error', 'reward_rule_missing');
  end if;

  award := least(rule_points, rule_max);
  if award < 1 then
    return jsonb_build_object('ok', false, 'error', 'reward_rule_missing');
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'buklod_points_ledger'
      and column_name = 'claim_state'
  ) into has_claim;

  if has_claim then
    insert into public.buklod_points_ledger (
      user_id, direction, points, activity_type, source_key, source_id, description, awarded_by, claim_state
    ) values (
      p_user, 'credit', award, p_activity, p_source_key, null, p_description, p_user, 'pending'
    )
    on conflict (user_id, source_key) do nothing
    returning id into ledger_id;
  else
    insert into public.buklod_points_ledger (
      user_id, direction, points, activity_type, source_key, source_id, description, awarded_by
    ) values (
      p_user, 'credit', award, p_activity, p_source_key, null, p_description, p_user
    )
    on conflict (user_id, source_key) do nothing
    returning id into ledger_id;
  end if;

  if ledger_id is null then
    return jsonb_build_object('ok', true, 'already', true, 'points', 0);
  end if;

  return jsonb_build_object(
    'ok', true,
    'already', false,
    'points', award,
    'ledger_id', ledger_id,
    'claim_state', case when has_claim then 'pending' else null end
  );
end;
$$;

revoke all on function public.kl_post_points_v1(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.kl_try_season_points_v1(p_user uuid, p_season uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  done_count integer;
  source_key text;
  posted jsonb;
begin
  if p_user is null then
    return jsonb_build_object('ok', false, 'error', 'season_incomplete');
  end if;

  select count(*) into done_count
  from public.kl_episodes e
  where e.season_id = p_season
    and e.episode_number between 1 and 30
    and exists (
      select 1 from public.kl_story_progress p
      where p.user_id = p_user and p.episode_id = e.id
    );

  if done_count <> 30 then
    return jsonb_build_object('ok', false, 'error', 'season_incomplete');
  end if;

  source_key := 'kl:season:v1:' || p_season::text;
  if exists (
    select 1 from public.kl_season_progress sp
    where sp.user_id = p_user and sp.season_id = p_season
  ) then
    return jsonb_build_object('ok', true, 'already', true, 'points', 0);
  end if;

  posted := public.kl_post_points_v1(
    p_user,
    'kl_season_completion',
    source_key,
    'Kabihasnang Ligaw season completed'
  );

  if coalesce((posted->>'ok')::boolean, false) is distinct from true then
    insert into public.kl_reward_outbox (user_id, source_type, source_id, points, status, last_error)
    values (p_user, 'season', p_season, 0, 'failed', coalesce(posted->>'error', 'reward_failed'))
    on conflict (user_id, source_type, source_id) do update
      set status = 'failed', last_error = excluded.last_error;
    return posted;
  end if;

  if coalesce((posted->>'already')::boolean, false) then
    return posted;
  end if;

  insert into public.kl_season_progress (user_id, season_id, point_ledger_id, source_key)
  values (p_user, p_season, nullif(posted->>'ledger_id', '')::uuid, source_key)
  on conflict (user_id, season_id) do nothing;

  insert into public.kl_reward_outbox (user_id, source_type, source_id, points, status, ledger_id)
  values (
    p_user, 'season', p_season,
    coalesce((posted->>'points')::integer, 0),
    'posted',
    nullif(posted->>'ledger_id', '')::uuid
  )
  on conflict (user_id, source_type, source_id) do update
    set status = 'posted', ledger_id = excluded.ledger_id, points = excluded.points, last_error = null;

  return posted;
end;
$$;

revoke all on function public.kl_try_season_points_v1(uuid, uuid) from public, anon, authenticated;

create or replace function public.kl_complete_episode_v1(p_episode_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ep public.kl_episodes%rowtype;
  source_key text;
  posted jsonb;
  season_posted jsonb;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.kl_episode_member_visible(p_episode_id) then
    return jsonb_build_object('ok', false, 'error', 'not_readable');
  end if;

  select * into ep from public.kl_episodes where id = p_episode_id;
  source_key := 'kl:episode:v1:' || ep.id::text;

  if exists (
    select 1 from public.kl_story_progress p
    where p.user_id = actor and p.episode_id = ep.id
  ) then
    season_posted := public.kl_try_season_points_v1(actor, ep.season_id);
    return jsonb_build_object('ok', true, 'already_completed', true, 'points', 0, 'season', season_posted);
  end if;

  posted := public.kl_post_points_v1(
    actor,
    'kl_episode_completion',
    source_key,
    'Kabihasnang Ligaw episode completed'
  );

  if coalesce((posted->>'ok')::boolean, false) is distinct from true then
    insert into public.kl_reward_outbox (user_id, source_type, source_id, points, status, last_error)
    values (actor, 'episode', ep.id, 0, 'failed', coalesce(posted->>'error', 'reward_failed'))
    on conflict (user_id, source_type, source_id) do update
      set status = 'failed', last_error = excluded.last_error;
    return jsonb_build_object('ok', false, 'error', 'reward_failed', 'detail', posted);
  end if;

  if coalesce((posted->>'already')::boolean, false) then
    insert into public.kl_story_progress (user_id, episode_id, point_ledger_id, source_key)
    values (actor, ep.id, nullif(posted->>'ledger_id', '')::uuid, source_key)
    on conflict (user_id, episode_id) do nothing;
    return jsonb_build_object('ok', true, 'already_completed', true, 'points', 0);
  end if;

  insert into public.kl_story_progress (user_id, episode_id, point_ledger_id, source_key)
  values (actor, ep.id, nullif(posted->>'ledger_id', '')::uuid, source_key)
  on conflict (user_id, episode_id) do nothing;

  insert into public.kl_reward_outbox (user_id, source_type, source_id, points, status, ledger_id)
  values (
    actor, 'episode', ep.id,
    coalesce((posted->>'points')::integer, 0),
    'posted',
    nullif(posted->>'ledger_id', '')::uuid
  )
  on conflict (user_id, source_type, source_id) do update
    set status = 'posted', ledger_id = excluded.ledger_id, points = excluded.points, last_error = null;

  season_posted := public.kl_try_season_points_v1(actor, ep.season_id);
  return jsonb_build_object(
    'ok', true,
    'already_completed', false,
    'points', coalesce((posted->>'points')::integer, 0),
    'claim_state', 'pending',
    'season', season_posted
  );
end;
$$;

create or replace function public.kl_list_library_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'season_id', e.season_id,
      'episode_number', e.episode_number,
      'title', e.title,
      'kind', e.kind,
      'status', e.status,
      'manuscript_status', e.manuscript_status,
      'readable', public.kl_episode_member_visible(e.id),
      'release_at', e.release_at
    ) order by e.episode_number), '[]'::jsonb)
    from public.kl_episodes e
  );
end;
$$;

create or replace function public.kl_read_episode_v1(p_episode_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ep public.kl_episodes%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  select * into ep from public.kl_episodes where id = p_episode_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'missing');
  end if;
  if not public.kl_episode_member_visible(ep.id) then
    return jsonb_build_object('ok', true, 'readable', false, 'title', ep.title, 'content', '[]'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'readable', true, 'title', ep.title, 'content', ep.content);
end;
$$;

create or replace function public.kl_save_story_journey_v1(
  p_episode_id uuid,
  p_progress integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ep public.kl_episodes%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if not public.kl_episode_member_visible(p_episode_id) then
    return jsonb_build_object('ok', false, 'error', 'not_readable');
  end if;
  select * into ep from public.kl_episodes where id = p_episode_id;
  insert into public.kl_story_journey (user_id, season_id, episode_id, progress_percent)
  values (actor, ep.season_id, ep.id, least(100, greatest(0, coalesce(p_progress, 0))))
  on conflict (user_id, episode_id) do update
    set progress_percent = excluded.progress_percent, updated_at = now();
  return jsonb_build_object('ok', true, 'ledger', null);
end;
$$;

create or replace function public.kl_report_reader_issue_v1(p_kind text, p_detail text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  recent integer;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if p_kind not in ('library', 'image', 'audio', 'unlock') then
    return jsonb_build_object('ok', false, 'error', 'rejected');
  end if;
  select count(*) into recent
  from public.kl_reader_issues i
  where i.user_id = actor and i.created_at > now() - interval '1 hour';
  if recent >= 20 then
    return jsonb_build_object('ok', false, 'error', 'limited');
  end if;
  insert into public.kl_reader_issues (user_id, kind, detail)
  values (actor, p_kind, left(coalesce(p_detail, ''), 180));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.kl_admin_list_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(public.buklod_is_system_admin(), false) is distinct from true then
    raise exception 'Not allowed';
  end if;
  return jsonb_build_object(
    'emergency_stop', (select c.emergency_stop from public.kl_publication_control c where c.id),
    'episodes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'status', e.status,
        'manuscript_status', e.manuscript_status,
        'media_gate', e.media_gate,
        'prose_complete', e.prose_complete,
        'release_at', e.release_at,
        'approved_at', e.approved_at,
        'updated_at', e.updated_at,
        'readable', public.kl_episode_member_visible(e.id)
      ) order by e.episode_number), '[]'::jsonb)
      from public.kl_episodes e
    ),
    'reward_failures', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'source_type', o.source_type,
        'source_id', o.source_id,
        'status', o.status,
        'last_error', o.last_error
      )), '[]'::jsonb)
      from public.kl_reward_outbox o
      where o.status = 'failed'
    )
  );
end;
$$;

create or replace function public.kl_admin_preview_v1(p_episode_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(public.buklod_is_system_admin(), false) is distinct from true then
    raise exception 'Not allowed';
  end if;
  return jsonb_build_object(
    'episode', (select to_jsonb(e) from public.kl_episodes e where e.id = p_episode_id),
    'storyboard', (
      select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      from public.kl_storyboard s where s.episode_id = p_episode_id
    ),
    'assets', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from public.kl_assets a where a.episode_id = p_episode_id or a.episode_id is null
    ),
    'living', (
      select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb)
      from public.kl_living_layers l where l.episode_id = p_episode_id
    ),
    'audit', (
      select coalesce(jsonb_agg(to_jsonb(au) order by au.created_at desc), '[]'::jsonb)
      from (
        select * from public.kl_audit a
        where a.episode_id = p_episode_id
        order by a.created_at desc
        limit 20
      ) au
    )
  );
end;
$$;

create or replace function public.kl_admin_action_v1(
  p_action text,
  p_episode_id uuid,
  p_notes text,
  p_manila_date date,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ep public.kl_episodes%rowtype;
  release_at timestamptz;
  blocked text;
begin
  if actor is null or coalesce(public.buklod_is_system_admin(), false) is distinct from true then
    raise exception 'Not allowed';
  end if;

  if p_action = 'emergency_stop' then
    update public.kl_publication_control
      set emergency_stop = true, updated_at = now(), updated_by = actor
      where id = true;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, p_episode_id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'emergency_clear' then
    update public.kl_publication_control
      set emergency_stop = false, updated_at = now(), updated_by = actor
      where id = true;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, p_episode_id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  select * into ep from public.kl_episodes where id = p_episode_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'missing');
  end if;

  if p_expected_updated_at is not null and ep.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  if p_action = 'pause_season' then
    update public.kl_seasons set status = 'paused', emergency_stop = false, updated_at = now()
    where id = ep.season_id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'resume_season' then
    update public.kl_seasons set status = 'approved', updated_at = now()
    where id = ep.season_id and status = 'paused';
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'pause' then
    update public.kl_episodes set status = 'paused', updated_at = now() where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'revise' then
    update public.kl_episodes
      set status = 'needs_revision',
          approved_at = null,
          approved_by = null,
          revision_notes = left(coalesce(p_notes, ''), 2000),
          updated_at = now()
      where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, p_action, ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  blocked := null;
  if ep.manuscript_status is distinct from 'approved_complete' or ep.prose_complete is distinct from true then
    blocked := 'manuscript_incomplete';
  elsif not exists (
    select 1 from jsonb_array_elements(ep.content) elem
    where length(trim(coalesce(elem->>'text', ''))) > 0
  ) then
    blocked := 'manuscript_incomplete';
  elsif not exists (
    select 1 from public.kl_storyboard b
    where b.episode_id = ep.id and b.required
  ) or exists (
    select 1 from public.kl_storyboard b
    where b.episode_id = ep.id and b.required
      and (b.paragraph_start is null or b.paragraph_end is null or b.approved is distinct from true or b.artwork_status is distinct from 'APPROVED')
  ) then
    blocked := 'media_blocked';
  elsif not exists (
    select 1 from public.kl_assets a
    where a.episode_id = ep.id and a.required and a.approved and a.classification = 'APPROVED'
  ) or exists (
    select 1 from public.kl_assets a
    where a.episode_id = ep.id and a.required
      and (a.approved is distinct from true or a.classification is distinct from 'APPROVED')
  ) then
    blocked := 'media_blocked';
  end if;

  if p_action = 'approve' then
    if blocked is not null then
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'approve_refused', ep.id, blocked);
      return jsonb_build_object('ok', false, 'error', blocked, 'published', false);
    end if;
    update public.kl_episodes
      set status = 'approved',
          approved_at = now(),
          approved_by = actor,
          media_gate = 'clear',
          revision_notes = left(coalesce(p_notes, ''), 2000),
          updated_at = now()
      where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, 'approve', ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  if p_action = 'schedule' then
    if ep.approved_at is null or ep.status not in ('approved', 'scheduled', 'live') or blocked is not null then
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'schedule_refused', ep.id, coalesce(blocked, 'not_approved'));
      return jsonb_build_object('ok', false, 'error', coalesce(blocked, 'not_approved'), 'published', false);
    end if;
    release_at := public.kl_release_from_manila_date(p_manila_date);
    if release_at is null or public.kl_is_manila_six(release_at) is distinct from true then
      return jsonb_build_object('ok', false, 'error', 'release_must_be_0600_asia_manila');
    end if;
    update public.kl_episodes
      set status = 'scheduled', release_at = release_at, updated_at = now()
      where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, 'schedule', ep.id, release_at::text);
    return jsonb_build_object('ok', true, 'published', false, 'release_at', release_at);
  end if;

  if p_action = 'resume' then
    if ep.approved_at is null or blocked is not null then
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'resume_refused', ep.id, coalesce(blocked, 'not_approved'));
      return jsonb_build_object('ok', false, 'error', coalesce(blocked, 'not_approved'));
    end if;
    update public.kl_episodes
      set status = case when release_at <= now() then 'live' else 'scheduled' end,
          updated_at = now()
      where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, 'resume', ep.id, left(coalesce(p_notes, ''), 2000));
    return jsonb_build_object('ok', true, 'published', false);
  end if;

  return jsonb_build_object('ok', false, 'error', 'unknown_action');
end;
$$;

revoke all on function public.kl_episode_member_visible(uuid) from public, anon, authenticated;
revoke all on function public.kl_complete_episode_v1(uuid) from public, anon;
revoke all on function public.kl_list_library_v1() from public, anon;
revoke all on function public.kl_read_episode_v1(uuid) from public, anon;
revoke all on function public.kl_save_story_journey_v1(uuid, integer) from public, anon;
revoke all on function public.kl_report_reader_issue_v1(text, text) from public, anon;
revoke all on function public.kl_admin_list_v1() from public, anon;
revoke all on function public.kl_admin_preview_v1(uuid) from public, anon;
revoke all on function public.kl_admin_action_v1(text, uuid, text, date, timestamptz) from public, anon;

grant execute on function public.kl_complete_episode_v1(uuid) to authenticated;
grant execute on function public.kl_list_library_v1() to authenticated;
grant execute on function public.kl_read_episode_v1(uuid) to authenticated;
grant execute on function public.kl_save_story_journey_v1(uuid, integer) to authenticated;
grant execute on function public.kl_report_reader_issue_v1(text, text) to authenticated;
grant execute on function public.kl_admin_list_v1() to authenticated;
grant execute on function public.kl_admin_preview_v1(uuid) to authenticated;
grant execute on function public.kl_admin_action_v1(text, uuid, text, date, timestamptz) to authenticated;

alter table public.kl_publication_control enable row level security;
alter table public.kl_seasons enable row level security;
alter table public.kl_episodes enable row level security;
alter table public.kl_story_progress enable row level security;
alter table public.kl_season_progress enable row level security;
alter table public.kl_reward_outbox enable row level security;
alter table public.kl_story_journey enable row level security;
alter table public.kl_storyboard enable row level security;
alter table public.kl_assets enable row level security;
alter table public.kl_living_layers enable row level security;
alter table public.kl_glossary enable row level security;
alter table public.kl_audit enable row level security;
alter table public.kl_reader_issues enable row level security;

revoke all on table public.kl_publication_control from public, anon, authenticated;
revoke all on table public.kl_seasons from public, anon, authenticated;
revoke all on table public.kl_episodes from public, anon, authenticated;
revoke all on table public.kl_story_progress from public, anon, authenticated;
revoke all on table public.kl_season_progress from public, anon, authenticated;
revoke all on table public.kl_reward_outbox from public, anon, authenticated;
revoke all on table public.kl_story_journey from public, anon, authenticated;
revoke all on table public.kl_storyboard from public, anon, authenticated;
revoke all on table public.kl_assets from public, anon, authenticated;
revoke all on table public.kl_living_layers from public, anon, authenticated;
revoke all on table public.kl_glossary from public, anon, authenticated;
revoke all on table public.kl_audit from public, anon, authenticated;
revoke all on table public.kl_reader_issues from public, anon, authenticated;

grant select on table public.kl_seasons to authenticated;
grant select on table public.kl_episodes to authenticated;
grant select on table public.kl_story_progress to authenticated;
grant select on table public.kl_season_progress to authenticated;
grant select on table public.kl_story_journey to authenticated;
grant select on table public.kl_glossary to authenticated;

drop policy if exists kl_read_approved_seasons on public.kl_seasons;
create policy kl_read_approved_seasons on public.kl_seasons
for select to authenticated
using (
  status in ('approved', 'live')
  and emergency_stop = false
  and not exists (select 1 from public.kl_publication_control c where c.emergency_stop)
);

drop policy if exists kl_admin_read_seasons on public.kl_seasons;
create policy kl_admin_read_seasons on public.kl_seasons
for select to authenticated
using (public.buklod_is_system_admin());

drop policy if exists kl_read_released_episodes on public.kl_episodes;
create policy kl_read_released_episodes on public.kl_episodes
for select to authenticated
using (
  status in ('approved', 'scheduled', 'live')
  and approved_at is not null
  and release_at <= now()
  and prose_complete
  and manuscript_status = 'approved_complete'
  and media_gate = 'clear'
  and exists (
    select 1 from public.kl_seasons s
    where s.id = season_id and s.status in ('approved', 'live') and s.emergency_stop = false
  )
  and not exists (select 1 from public.kl_publication_control c where c.emergency_stop)
  and exists (
    select 1 from public.kl_assets a
    where a.episode_id = kl_episodes.id and a.required and a.approved and a.classification = 'APPROVED'
  )
  and not exists (
    select 1 from public.kl_assets a
    where a.episode_id = kl_episodes.id and a.required
      and (a.approved is distinct from true or a.classification is distinct from 'APPROVED')
  )
);

drop policy if exists kl_admin_read_episodes on public.kl_episodes;
create policy kl_admin_read_episodes on public.kl_episodes
for select to authenticated
using (public.buklod_is_system_admin());

drop policy if exists kl_read_own_episode_progress on public.kl_story_progress;
create policy kl_read_own_episode_progress on public.kl_story_progress
for select to authenticated
using (user_id = auth.uid());

drop policy if exists kl_read_own_season_progress on public.kl_season_progress;
create policy kl_read_own_season_progress on public.kl_season_progress
for select to authenticated
using (user_id = auth.uid());

drop policy if exists kl_read_own_journey on public.kl_story_journey;
create policy kl_read_own_journey on public.kl_story_journey
for select to authenticated
using (user_id = auth.uid());

drop policy if exists kl_admin_read_outbox on public.kl_reward_outbox;
create policy kl_admin_read_outbox on public.kl_reward_outbox
for select to authenticated
using (public.buklod_is_system_admin());

drop policy if exists kl_admin_read_storyboard on public.kl_storyboard;
create policy kl_admin_read_storyboard on public.kl_storyboard
for select to authenticated
using (public.buklod_is_system_admin());

drop policy if exists kl_admin_read_assets on public.kl_assets;
create policy kl_admin_read_assets on public.kl_assets
for select to authenticated
using (public.buklod_is_system_admin());

drop policy if exists kl_admin_read_living on public.kl_living_layers;
create policy kl_admin_read_living on public.kl_living_layers
for select to authenticated
using (public.buklod_is_system_admin());

drop policy if exists kl_read_approved_glossary on public.kl_glossary;
create policy kl_read_approved_glossary on public.kl_glossary
for select to authenticated
using (approved = true or public.buklod_is_system_admin());

drop policy if exists kl_admin_read_audit on public.kl_audit;
create policy kl_admin_read_audit on public.kl_audit
for select to authenticated
using (public.buklod_is_system_admin());

drop policy if exists kl_admin_read_issues on public.kl_reader_issues;
create policy kl_admin_read_issues on public.kl_reader_issues
for select to authenticated
using (public.buklod_is_system_admin());

drop policy if exists kl_admin_read_control on public.kl_publication_control;
create policy kl_admin_read_control on public.kl_publication_control
for select to authenticated
using (public.buklod_is_system_admin());
