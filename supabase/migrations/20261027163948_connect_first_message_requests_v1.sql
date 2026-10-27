-- First-contact direct messages are requests until the recipient replies.
-- Existing two-way conversations remain in Personal, regardless of unread state.
create or replace function public.buklod_connect_message_requests_v1()
returns table(thread_id uuid)
language sql
stable
security definer
set search_path = ''
as $function$
  with actor as (
    select (select auth.uid()) as user_id
  )
  select t.id as thread_id
  from public.buklod_connect_direct_threads t
  cross join actor a
  where a.user_id is not null
    and (t.user_one = a.user_id or t.user_two = a.user_id)
    and exists (
      select 1
      from public.buklod_connect_direct_messages incoming
      where incoming.thread_id = t.id
        and incoming.sender_id <> a.user_id
        and incoming.deleted_at is null
    )
    and not exists (
      select 1
      from public.buklod_connect_direct_messages sent
      where sent.thread_id = t.id
        and sent.sender_id = a.user_id
    )
  order by t.created_at desc;
$function$;

revoke all on function public.buklod_connect_message_requests_v1() from public, anon;
grant execute on function public.buklod_connect_message_requests_v1() to authenticated;
