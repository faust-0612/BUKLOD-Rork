-- Offline-first Community comments: stable retry identity without duplicate posts.
-- DEV candidate ONLY. Apply through the controlled backend release gate before any client OTA.
alter table public.comments
  add column if not exists client_request_key text;

-- Multiple legacy NULL keys remain valid; repeated non-NULL keys are unique per author.
create unique index if not exists comments_author_request_key_v1
  on public.comments (user_id, client_request_key);

create or replace function public.add_buklod_post_comment_v5(
  p_post_id uuid,
  p_body text,
  p_request_key text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_body text := btrim(coalesce(p_body, ''));
  existing record;
  new_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_request_key is null or p_request_key !~ '^[A-Za-z0-9:._-]{8,80}$' then
    raise exception 'Invalid request key' using errcode = '22023';
  end if;
  if char_length(clean_body) not between 1 and 2000 then
    raise exception 'Comment must be 1 to 2000 characters' using errcode = '22023';
  end if;
  if not public.can_view_community_post_v2(p_post_id) then
    raise exception 'Post is not visible to your account' using errcode = '42501';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.comments c
    where c.id = p_parent_id and c.post_id = p_post_id
      and c.is_hidden = false and c.deleted_at is null
  ) then
    raise exception 'Reply target is not available' using errcode = '22023';
  end if;

  select c.id, c.post_id, c.body, c.parent_id into existing
  from public.comments c
  where c.user_id = actor and c.client_request_key = p_request_key;
  if found then
    if existing.post_id <> p_post_id or existing.body <> clean_body
       or existing.parent_id is distinct from p_parent_id then
      raise exception 'Request key was already used for a different comment'
        using errcode = '23505';
    end if;
    return existing.id;
  end if;

  insert into public.comments(post_id, user_id, body, parent_id, client_request_key)
  values(p_post_id, actor, clean_body, p_parent_id, p_request_key)
  on conflict do nothing
  returning id into new_id;

  if new_id is null then
    select c.id, c.post_id, c.body, c.parent_id into existing
    from public.comments c
    where c.user_id = actor and c.client_request_key = p_request_key;
    if not found or existing.post_id <> p_post_id
       or existing.body <> clean_body
       or existing.parent_id is distinct from p_parent_id then
      raise exception 'Request key conflict' using errcode = '23505';
    end if;
    new_id := existing.id;
  end if;

  return new_id;
end
$function$;

-- Security definer is retained ONLY for parity with v4's authenticated view
-- authorization; never expose the function to unauthenticated callers.
revoke all on function public.add_buklod_post_comment_v5(uuid, text, text, uuid)
  from public, anon;
grant execute on function public.add_buklod_post_comment_v5(uuid, text, text, uuid)
  to authenticated;
