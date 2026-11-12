-- Private, membership-authorized scope privacy invalidation.
-- Realtime sends post ID and revocation state only; never content/media.
create policy buklod_scope_post_privacy_receive_v1
on realtime.messages for select to authenticated
using (
  extension = 'broadcast'
  and split_part(realtime.topic(), ':', 1) = 'buklod-scope-posts'
  and case
    when split_part(realtime.topic(), ':', 2)
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.buklod_scope_social_can_access(
      split_part(realtime.topic(), ':', 2)::uuid
    )
    else false
  end
);

create or replace function private.buklod_scope_post_privacy_broadcast_v1()
returns trigger language plpgsql security definer set search_path to ''
as $body$
declare
  v_old_scope_id uuid;
  v_revoked boolean := true;
begin
  if tg_op = 'DELETE' then
    v_old_scope_id := old.scope_id;
  else
    v_old_scope_id := old.scope_id;
    v_revoked :=
      coalesce(new.author_only,false)
      or coalesce(new.is_hidden,false)
      or new.deleted_at is not null
      or new.scope_id is distinct from old.scope_id
      or new.audience <> 'scope';
  end if;
  if v_old_scope_id is not null then
    perform realtime.send(
      jsonb_build_object(
        'post_id', old.id,
        'visibility_revoked', v_revoked
      ),
      'post_changed',
      'buklod-scope-posts:' || v_old_scope_id::text,
      true
    );
  end if;
  return null;
end;
$body$;

create trigger buklod_scope_post_privacy_broadcast_v1
after update of author_only, is_hidden, deleted_at, scope_id, audience or delete
on public.community_posts
for each row execute function private.buklod_scope_post_privacy_broadcast_v1();
