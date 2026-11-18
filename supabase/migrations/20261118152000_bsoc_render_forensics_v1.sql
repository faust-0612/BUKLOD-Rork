-- BUKLOD Main BSOC render forensics v1. Additive only.
-- No raw exception message, React component stack, user content or secrets.
-- Apply before publishing clients that call buklod_attach_render_forensics_v1.
create table if not exists public.bsoc_render_forensics_v1 (
  health_event_id uuid primary key references public.bsoc_health_events(id) on delete cascade,
  user_id uuid not null,
  cause_code text not null check (cause_code in (
    'UNKNOWN','HOOK_ORDER','RENDER_LOOP','INVALID_ELEMENT','INVALID_CHILD',
    'NULLISH_ACCESS','INVALID_CALL','MISSING_PROVIDER','TYPE_ERROR','REFERENCE_ERROR'
  )),
  origin_area text not null check (origin_area in (
    'UNKNOWN','PROVIDER','SCOPE','CONNECT','CHARACTER','MEDIA','AUTH',
    'ROUTE','COMPONENT','LIB'
  )),
  source_path text,
  source_line integer,
  source_column integer,
  bundle_line integer,
  bundle_column integer,
  runtime_version text,
  ota_update_id uuid,
  update_channel text,
  observed_at timestamptz not null default now(),
  constraint bsoc_render_path_safe check (
    source_path is null or
    (length(source_path) <= 180
      and source_path ~ '^src/(app|components|providers|lib)/[A-Za-z0-9_/\[\]().-]+\.(tsx?|jsx?)$'
      and position('..' in source_path)=0)
  ),
  constraint bsoc_render_source_position check (
    (source_line is null or (source_path is not null and source_line between 1 and 100000000))
    and (source_column is null or (source_path is not null and source_column between 1 and 100000000))
    and (bundle_line is null or bundle_line between 1 and 100000000)
    and (bundle_column is null or bundle_column between 1 and 100000000)
  ),
  constraint bsoc_render_release_safe check (
    (runtime_version is null or runtime_version ~ '^[A-Za-z0-9_.-]{1,60}$')
    and (update_channel is null or update_channel in ('production','staging','preview','development'))
  )
);
create index if not exists bsoc_render_forensics_owner_observed
  on public.bsoc_render_forensics_v1(user_id,observed_at desc);

alter table public.bsoc_render_forensics_v1 enable row level security;
revoke all on table public.bsoc_render_forensics_v1 from public, anon, authenticated;
grant select on table public.bsoc_render_forensics_v1 to authenticated;
drop policy if exists "BSOC render forensics read" on public.bsoc_render_forensics_v1;
create policy "BSOC render forensics read" on public.bsoc_render_forensics_v1
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.buklod_bsoc_can('bsoc.observability.read')
    or public.buklod_bsoc_can('bsoc.user360.read')
  );

create or replace function public.buklod_attach_render_forensics_v1(
  p_health_event_id uuid,
  p_cause_code text,
  p_origin_area text,
  p_source_path text default null,
  p_source_line integer default null,
  p_source_column integer default null,
  p_bundle_line integer default null,
  p_bundle_column integer default null,
  p_runtime_version text default null,
  p_ota_update_id uuid default null,
  p_update_channel text default null
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  recorded public.bsoc_health_events%rowtype;
  normalized_source text := nullif(btrim(p_source_path), '');
  normalized_runtime text := nullif(btrim(p_runtime_version),'');
  normalized_channel text := nullif(lower(btrim(p_update_channel)),'');
  created boolean := false;
  inserted_count bigint := 0;
begin
  if actor is null then
    raise exception 'Authenticated BUKLOD member required' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles p where p.id=actor and coalesce(p.is_active,true)) then
    raise exception 'Active BUKLOD account required' using errcode='42501';
  end if;
  select * into recorded from public.bsoc_health_events e
    where e.id=p_health_event_id and e.user_id=actor
    for share;
  if not found or recorded.health_category <> 'ROUTE'
     or recorded.safe_error_code <> 'SYS-500'
     or recorded.error_signature !~ '^RENDER_[0-9A-F]{6,8}$' then
    raise exception 'Render health event not found or not eligible' using errcode='42501';
  end if;
  if recorded.occurred_at < now()-interval '1 hour' then
    raise exception 'Render evidence upload window expired' using errcode='22023';
  end if;
  if p_cause_code not in (
    'UNKNOWN','HOOK_ORDER','RENDER_LOOP','INVALID_ELEMENT','INVALID_CHILD',
    'NULLISH_ACCESS','INVALID_CALL','MISSING_PROVIDER','TYPE_ERROR','REFERENCE_ERROR'
  ) or p_origin_area not in (
    'UNKNOWN','PROVIDER','SCOPE','CONNECT','CHARACTER','MEDIA','AUTH',
    'ROUTE','COMPONENT','LIB'
  ) then
    raise exception 'Unsupported render classification' using errcode='22023';
  end if;
  if normalized_source is not null and (
    length(normalized_source)>180 or
    normalized_source !~ '^src/(app|components|providers|lib)/[A-Za-z0-9_/\[\]().-]+\.(tsx?|jsx?)$'
    or position('..' in normalized_source)>0
  ) then
    raise exception 'Unsafe source frame' using errcode='22023';
  end if;
  if (p_source_line is not null and (normalized_source is null or p_source_line not between 1 and 100000000))
     or (p_source_column is not null and (normalized_source is null or p_source_column not between 1 and 100000000))
     or (p_bundle_line is not null and p_bundle_line not between 1 and 100000000)
     or (p_bundle_column is not null and p_bundle_column not between 1 and 100000000)
     or (normalized_runtime is not null and normalized_runtime !~ '^[A-Za-z0-9_.-]{1,60}$')
     or (normalized_channel is not null and normalized_channel not in
         ('production','staging','preview','development')) then
    raise exception 'Unsafe render position or release identity' using errcode='22023';
  end if;

  -- First write wins. Replays cannot overwrite a previous incident with a
  -- different OTA identity or claim a different location retroactively.
  insert into public.bsoc_render_forensics_v1 (
    health_event_id,user_id,cause_code,origin_area,
    source_path,source_line,source_column,bundle_line,bundle_column,
    runtime_version,ota_update_id,update_channel
  ) values (
    recorded.id,actor,p_cause_code,p_origin_area,
    normalized_source,p_source_line,p_source_column,p_bundle_line,p_bundle_column,
    normalized_runtime,p_ota_update_id,normalized_channel
  ) on conflict(health_event_id) do nothing;
  get diagnostics inserted_count = row_count;
  created := inserted_count > 0;
  return jsonb_build_object('recorded', true, 'inserted', created,
                            'event_id', recorded.id);
end;
$$;
revoke all on function public.buklod_attach_render_forensics_v1(
  uuid,text,text,text,integer,integer,integer,integer,text,uuid,text
) from public,anon;
grant execute on function public.buklod_attach_render_forensics_v1(
  uuid,text,text,text,integer,integer,integer,integer,text,uuid,text
) to authenticated;

comment on table public.bsoc_render_forensics_v1 is
 'RLS-protected allowlisted code/position/OTA evidence only. Never store raw exception messages or stacks.';
