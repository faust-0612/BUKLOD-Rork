-- Fail-closed daily release step. Not applied to production by this change.
-- Promotes only episodes that are already scheduled, owner-approved, and still
-- member-visible. Drafts, outlines, and unapproved art stay hidden.
-- With no such row, this publishes nothing. No daily OTA.

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
begin
  if coalesce(public.kl_publication_stopped(), false) then
    insert into public.kl_audit (actor_id, action, notes)
    values (actor, 'publish_due_stopped', 'emergency_stop');
    return jsonb_build_object('ok', true, 'published', 0, 'held', 0, 'stopped', true);
  end if;

  for ep in
    select e.id
    from public.kl_episodes e
    where e.status = 'scheduled'
      and e.approved_at is not null
      and e.release_at <= now()
    order by e.release_at, e.episode_number
    for update
  loop
    if public.kl_episode_member_visible(ep.id) then
      update public.kl_episodes
        set status = 'live', updated_at = now()
        where id = ep.id
          and status = 'scheduled';
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'publish_due', ep.id, 'scheduled_release_reached');
      promoted := promoted + 1;
    else
      insert into public.kl_audit (actor_id, action, episode_id, notes)
      values (actor, 'publish_due_held', ep.id, 'not_member_visible');
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
