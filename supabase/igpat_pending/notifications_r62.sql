-- BUKLOD IGPAT R62 — Notifications
-- PENDING RELEASE SQL ONLY. Reuses the existing BUKLOD notification queue and
-- dedupe helper. Intentionally narrow: meaningful direct events only, no spam.

create or replace function public.buklod_igpat_notify_arena_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mode_label text := initcap(replace(coalesce(new.mode, 'arena'), '_', ' '));
begin
  if tg_op = 'INSERT' then
    if new.opponent_user_id is not null and new.opponent_user_id <> new.creator_user_id then
      perform public.buklod_queue_notification_once_v1(
        new.opponent_user_id,
        'IGPAT ' || mode_label,
        'You received a new IGPAT challenge.',
        'igpat_arena_challenge',
        jsonb_build_object(
          'route', '/igpat/arena/' || new.id::text,
          'challenge_id', new.id,
          'mode', new.mode
        ),
        'igpat-arena-created:' || new.id::text || ':' || new.opponent_user_id::text
      );
    end if;
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'ACCEPTED' then
    if new.creator_user_id is not null then
      perform public.buklod_queue_notification_once_v1(
        new.creator_user_id,
        'IGPAT ' || mode_label,
        'Your IGPAT challenge was accepted.',
        'igpat_arena_accepted',
        jsonb_build_object(
          'route', '/igpat/arena/' || new.id::text,
          'challenge_id', new.id,
          'mode', new.mode
        ),
        'igpat-arena-accepted:' || new.id::text || ':' || new.creator_user_id::text
      );
    end if;
  elsif old.status is distinct from new.status and new.status = 'COMPLETED' then
    if new.creator_user_id is not null then
      perform public.buklod_queue_notification_once_v1(
        new.creator_user_id,
        'IGPAT result ready',
        'Your Arena result is ready to view.',
        'igpat_arena_result',
        jsonb_build_object(
          'route', '/igpat/arena/' || new.id::text,
          'challenge_id', new.id,
          'mode', new.mode
        ),
        'igpat-arena-completed:' || new.id::text || ':' || new.creator_user_id::text
      );
    end if;

    if new.opponent_user_id is not null and new.opponent_user_id <> new.creator_user_id then
      perform public.buklod_queue_notification_once_v1(
        new.opponent_user_id,
        'IGPAT result ready',
        'Your Arena result is ready to view.',
        'igpat_arena_result',
        jsonb_build_object(
          'route', '/igpat/arena/' || new.id::text,
          'challenge_id', new.id,
          'mode', new.mode
        ),
        'igpat-arena-completed:' || new.id::text || ':' || new.opponent_user_id::text
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists buklod_igpat_arena_notify_v1 on public.igpat_arena_challenges;
create trigger buklod_igpat_arena_notify_v1
after insert or update of status on public.igpat_arena_challenges
for each row execute function public.buklod_igpat_notify_arena_v1();

create or replace function public.buklod_igpat_notify_relay_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_text text := new.context_config #>> '{igpat_relay,parent_post_id}';
  parent_id uuid;
  parent_owner uuid;
  child_owner uuid;
begin
  if coalesce(parent_text, '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (old.context_config #>> '{igpat_relay,parent_post_id}') is not distinct from parent_text then
    return new;
  end if;

  parent_id := parent_text::uuid;

  select cp.user_id into parent_owner
  from public.community_posts cp
  where cp.id = parent_id;

  select cp.user_id into child_owner
  from public.community_posts cp
  where cp.id = new.post_id;

  if parent_owner is null or child_owner is null or parent_owner = child_owner then
    return new;
  end if;

  perform public.buklod_queue_notification_once_v1(
    parent_owner,
    'New IGPAT Relay',
    'Someone continued your IGPAT Relay.',
    'igpat_relay',
    jsonb_build_object(
      'route', '/igpat/relay/' || new.post_id::text,
      'post_id', new.post_id,
      'parent_post_id', parent_id
    ),
    'igpat-relay:' || new.post_id::text || ':' || parent_owner::text
  );

  return new;
end;
$$;

drop trigger if exists buklod_igpat_relay_notify_v1 on public.buklod_community_post_meta;
create trigger buklod_igpat_relay_notify_v1
after insert or update of context_config on public.buklod_community_post_meta
for each row execute function public.buklod_igpat_notify_relay_v1();

create or replace function public.buklod_igpat_notify_bond_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  title_text text;
  body_text text;
  kind_text text;
begin
  if new.target_id is null or new.target_id = new.actor_user_id then
    return new;
  end if;

  if new.kind = 'pass' then
    title_text := 'IGPAT shared with you';
    body_text := 'Someone passed an IGPAT moment to you.';
    kind_text := 'igpat_pass';
  elsif new.kind = 'capsule' then
    title_text := 'IGPAT Capsule';
    body_text := case
      when new.unlock_at is not null then 'A new IGPAT Capsule is waiting for you.'
      else 'You received an IGPAT Capsule.'
    end;
    kind_text := 'igpat_capsule';
  else
    return new;
  end if;

  perform public.buklod_queue_notification_once_v1(
    new.target_id,
    title_text,
    body_text,
    kind_text,
    jsonb_build_object(
      'route', '/igpat/bonds',
      'bond_action_id', new.id,
      'post_id', new.post_id,
      'kind', new.kind,
      'unlock_at', new.unlock_at
    ),
    'igpat-bond:' || new.id::text || ':' || new.target_id::text
  );

  return new;
end;
$$;

drop trigger if exists buklod_igpat_bond_notify_v1 on public.igpat_bond_actions;
create trigger buklod_igpat_bond_notify_v1
after insert on public.igpat_bond_actions
for each row execute function public.buklod_igpat_notify_bond_v1();

-- No generic reaction/view notifications are introduced here. Existing Community
-- comment/reaction notification paths remain authoritative, and IGPAT-specific
-- notifications are deliberately limited to direct meaningful events above.
