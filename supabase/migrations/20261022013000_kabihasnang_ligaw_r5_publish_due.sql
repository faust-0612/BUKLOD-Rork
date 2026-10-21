-- Fail-closed daily release step. Not applied to production by this change.
-- One already-scheduled episode can become live when its stored UTC instant,
-- which is 06:00 Asia/Manila, has passed. A second episode on that Manila
-- date is held. Drafts and unapproved art are never selected.
-- Calling this again retries held rows. Each hold writes an alert.

create table if not exists public.kl_publish_alerts (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid,
  kind text not null,
  detail text not null,
  retry_count integer not null default 1,
  open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists kl_publish_alerts_open_uidx
  on public.kl_publish_alerts (episode_id, kind)
  where open;

alter table public.kl_publish_alerts enable row level security;

drop policy if exists kl_admin_read_publish_alerts on public.kl_publish_alerts;
create policy kl_admin_read_publish_alerts
  on public.kl_publish_alerts
  for select to authenticated
  using (public.buklod_is_system_admin());

revoke all on public.kl_publish_alerts from public, anon, authenticated;
grant select on public.kl_publish_alerts to authenticated;

create or replace function public.kl_record_publish_alert(
  p_actor uuid,
  p_episode_id uuid,
  p_kind text,
  p_detail text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  select a.id into existing
  from public.kl_publish_alerts a
  where a.episode_id is not distinct from p_episode_id
    and a.kind = p_kind
    and a.open
  limit 1;

  if existing is null then
    insert into public.kl_publish_alerts (episode_id, kind, detail)
    values (p_episode_id, p_kind, left(p_detail, 500));
  else
    update public.kl_publish_alerts
      set retry_count = retry_count + 1,
          detail = left(p_detail, 500),
          updated_at = now()
      where id = existing;
  end if;

  insert into public.kl_audit (actor_id, action, episode_id, notes)
  values (p_actor, p_kind, p_episode_id, left(p_detail, 2000));
end;
$$;

revoke all on function public.kl_record_publish_alert(uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.kl_publish_due_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  promoted integer := 0;
  held integer := 0;
  ep record;
  reason text;
begin
  if coalesce(public.kl_publication_stopped(), false) then
    perform public.kl_record_publish_alert(actor, null, 'publish_due_stopped', 'emergency_stop');
    return jsonb_build_object('ok', true, 'published', 0, 'held', 0, 'stopped', true);
  end if;

  for ep in
    select e.id, e.season_id, e.release_at, e.episode_number, s.status as season_status
    from public.kl_episodes e
    join public.kl_seasons s on s.id = e.season_id
    where e.status = 'scheduled'
      and e.approved_at is not null
      and e.release_at <= now()
    order by e.release_at, e.episode_number
    for update of e
  loop
    reason := null;
    if ep.season_status = 'paused' then
      reason := 'season_paused';
    elsif exists (
      select 1
      from public.kl_episodes other
      where other.season_id = ep.season_id
        and other.id <> ep.id
        and other.status = 'live'
        and timezone('Asia/Manila', other.release_at)::date
            = timezone('Asia/Manila', ep.release_at)::date
    ) then
      reason := 'one_episode_per_manila_day';
    elsif not public.kl_episode_member_visible(ep.id) then
      reason := 'not_member_visible';
    end if;

    if reason is null then
      update public.kl_episodes
        set status = 'live', updated_at = now()
        where id = ep.id
          and status = 'scheduled';
      update public.kl_publish_alerts
        set open = false, updated_at = now()
        where episode_id = ep.id
          and open;
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'publish_due', ep.id, 'scheduled_release_reached');
      promoted := promoted + 1;
    else
      perform public.kl_record_publish_alert(actor, ep.id, 'publish_due_held', reason);
      held := held + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'published', promoted, 'held', held, 'stopped', false);
end;
$$;

revoke all on function public.kl_publish_due_v1() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.kl_publish_due_v1() to service_role;
  end if;
end $$;

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
  v_release_at timestamptz;
  blocked text;
begin
  if actor is null or coalesce(public.buklod_is_system_admin(), false) is distinct from true then
    raise exception 'Not allowed';
  end if;

  if p_action = 'hold' then
    p_action := 'pause';
  elsif p_action = 'correct' then
    p_action := 'revise';
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
    where a.required
      and (a.episode_id = ep.id or a.episode_id is null)
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
    update public.kl_seasons
      set status = 'approved', updated_at = now()
      where id = ep.season_id and status = 'draft';
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
    v_release_at := public.kl_release_from_manila_date(p_manila_date);
    if v_release_at is null or public.kl_is_manila_six(v_release_at) is distinct from true then
      return jsonb_build_object('ok', false, 'error', 'release_must_be_0600_asia_manila');
    end if;
    perform pg_advisory_xact_lock(hashtextextended('kl-schedule:' || ep.season_id::text, 0));
    if exists (
      select 1
      from public.kl_episodes other
      where other.season_id = ep.season_id
        and other.id <> ep.id
        and other.status in ('scheduled', 'live')
        and timezone('Asia/Manila', other.release_at)::date
            = timezone('Asia/Manila', public.kl_release_from_manila_date(p_manila_date))::date
    ) then
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'schedule_refused', ep.id, 'one_episode_per_manila_day');
      return jsonb_build_object('ok', false, 'error', 'one_episode_per_manila_day', 'published', false);
    end if;
    update public.kl_episodes
      set status = 'scheduled', release_at = v_release_at, updated_at = now()
      where id = ep.id;
    insert into public.kl_audit (actor_id, action, episode_id, notes)
    values (actor, 'schedule', ep.id, v_release_at::text);
    return jsonb_build_object('ok', true, 'published', false, 'release_at', v_release_at);
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


revoke all on function public.kl_admin_action_v1(text, uuid, text, date, timestamptz) from public, anon;
grant execute on function public.kl_admin_action_v1(text, uuid, text, date, timestamptz) to authenticated;
