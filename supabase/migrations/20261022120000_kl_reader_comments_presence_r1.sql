-- Kabihasnang Ligaw live-reader comments + presence (additive).
-- Members can comment and see who is reading only on released chapters via RPCs.

create schema if not exists private;

create table if not exists private.kl_episode_comments (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  is_hidden boolean not null default false
);

create index if not exists kl_episode_comments_episode_created_idx
  on private.kl_episode_comments (episode_id, created_at desc)
  where is_hidden = false;

create table if not exists private.kl_episode_readers (
  episode_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Miyembro',
  last_seen_at timestamptz not null default now(),
  primary key (episode_id, user_id)
);

create index if not exists kl_episode_readers_seen_idx
  on private.kl_episode_readers (episode_id, last_seen_at desc);

revoke all on table private.kl_episode_comments from public, anon, authenticated;
revoke all on table private.kl_episode_readers from public, anon, authenticated;

create or replace function private.kl_reader_display_name_v1(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(p.username), ''),
    'Miyembro'
  )
  from public.profiles p
  where p.id = p_uid
  limit 1;
$$;

revoke all on function private.kl_reader_display_name_v1(uuid) from public, anon, authenticated;

create or replace function public.kl_ping_reading_v1(p_episode_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sign_in_required');
  end if;
  if p_episode_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_episode');
  end if;

  v_name := coalesce(private.kl_reader_display_name_v1(v_uid), 'Miyembro');

  insert into private.kl_episode_readers as r (episode_id, user_id, display_name, last_seen_at)
  values (p_episode_id, v_uid, v_name, now())
  on conflict (episode_id, user_id) do update
    set display_name = excluded.display_name,
        last_seen_at = now();

  delete from private.kl_episode_readers
  where episode_id = p_episode_id
    and last_seen_at < now() - interval '20 minutes';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.kl_ping_reading_v1(uuid) from public, anon;
grant execute on function public.kl_ping_reading_v1(uuid) to authenticated;

create or replace function public.kl_list_readers_v1(p_episode_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
  v_count integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sign_in_required', 'count', 0, 'readers', '[]'::jsonb);
  end if;
  if p_episode_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_episode', 'count', 0, 'readers', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', r.user_id,
      'display_name', r.display_name,
      'last_seen_at', r.last_seen_at,
      'is_self', r.user_id = v_uid
    )
    order by r.last_seen_at desc
  ), '[]'::jsonb),
  count(*)::integer
  into v_rows, v_count
  from private.kl_episode_readers r
  where r.episode_id = p_episode_id
    and r.last_seen_at >= now() - interval '15 minutes';

  return jsonb_build_object(
    'ok', true,
    'count', coalesce(v_count, 0),
    'readers', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.kl_list_readers_v1(uuid) from public, anon;
grant execute on function public.kl_list_readers_v1(uuid) to authenticated;

create or replace function public.kl_list_comments_v1(p_episode_id uuid, p_limit integer default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 80);
  v_rows jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sign_in_required', 'comments', '[]'::jsonb);
  end if;
  if p_episode_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_episode', 'comments', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(row_json order by created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'id', c.id,
      'body', c.body,
      'created_at', c.created_at,
      'display_name', coalesce(private.kl_reader_display_name_v1(c.user_id), 'Miyembro'),
      'is_self', c.user_id = v_uid
    ) as row_json,
    c.created_at
    from private.kl_episode_comments c
    where c.episode_id = p_episode_id
      and c.is_hidden = false
    order by c.created_at desc
    limit v_limit
  ) q;

  return jsonb_build_object('ok', true, 'comments', coalesce(v_rows, '[]'::jsonb));
end;
$$;

revoke all on function public.kl_list_comments_v1(uuid, integer) from public, anon;
grant execute on function public.kl_list_comments_v1(uuid, integer) to authenticated;

create or replace function public.kl_add_comment_v1(p_episode_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_created timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sign_in_required');
  end if;
  if p_episode_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_episode');
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    return jsonb_build_object('ok', false, 'error', 'invalid_body');
  end if;

  insert into private.kl_episode_comments (episode_id, user_id, body)
  values (p_episode_id, v_uid, v_body)
  returning id, created_at into v_id, v_created;

  return jsonb_build_object(
    'ok', true,
    'comment', jsonb_build_object(
      'id', v_id,
      'body', v_body,
      'created_at', v_created,
      'display_name', coalesce(private.kl_reader_display_name_v1(v_uid), 'Miyembro'),
      'is_self', true
    )
  );
end;
$$;

revoke all on function public.kl_add_comment_v1(uuid, text) from public, anon;
grant execute on function public.kl_add_comment_v1(uuid, text) to authenticated;

comment on table private.kl_episode_comments is
  'Kabihasnang Ligaw member comments on live released chapters. Access only via kl_* RPCs.';
comment on table private.kl_episode_readers is
  'Recent readers for live KL chapters. Presence expires after quiet minutes.';
comment on function public.kl_ping_reading_v1(uuid) is
  'Marks the signed-in member as currently reading a KL episode.';
comment on function public.kl_list_readers_v1(uuid) is
  'Lists members reading a KL episode in the last 15 minutes.';
comment on function public.kl_list_comments_v1(uuid, integer) is
  'Lists recent comments for a live KL episode.';
comment on function public.kl_add_comment_v1(uuid, text) is
  'Adds a member comment under a live KL episode.';
