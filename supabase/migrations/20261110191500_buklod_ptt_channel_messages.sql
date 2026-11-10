-- Additive, no-native PTT channel text and caption history.
-- Separate from Connect chat: CH01-CH10 stay isolated and membership is checked by RLS.
create table if not exists public.buklod_ptt_channel_messages (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.buklod_scopes(id) on delete cascade,
  channel smallint not null check (channel between 1 and 10),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 120),
  kind text not null check (kind in ('TEXT', 'CAPTION')),
  body text not null check (char_length(body) between 1 and 4000 and body = btrim(body)),
  provider_event_id text,
  transmission_id uuid references public.buklod_ptt_transmissions(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint buklod_ptt_message_origin check (
    (kind = 'TEXT' and provider_event_id is null and transmission_id is null) or
    (kind = 'CAPTION' and nullif(provider_event_id, '') is not null and transmission_id is not null)
  )
);
create index if not exists buklod_ptt_messages_history_idx
  on public.buklod_ptt_channel_messages(scope_id, channel, created_at desc, id desc);
create unique index if not exists buklod_ptt_messages_caption_dedupe_idx
  on public.buklod_ptt_channel_messages(scope_id, channel, provider_event_id)
  where provider_event_id is not null;
alter table public.buklod_ptt_channel_messages enable row level security;
revoke all on public.buklod_ptt_channel_messages from public, anon;
grant select, insert on public.buklod_ptt_channel_messages to authenticated;
revoke update, delete on public.buklod_ptt_channel_messages from authenticated;
drop policy if exists buklod_ptt_messages_active_member_read on public.buklod_ptt_channel_messages;
create policy buklod_ptt_messages_active_member_read on public.buklod_ptt_channel_messages
  for select to authenticated
  using (exists (
    select 1 from public.buklod_scope_memberships m
    where m.scope_id = buklod_ptt_channel_messages.scope_id
      and m.user_id = (select auth.uid())
      and m.membership_status = 'ACTIVE'
  ));
drop policy if exists buklod_ptt_messages_member_text_insert on public.buklod_ptt_channel_messages;
create policy buklod_ptt_messages_member_text_insert on public.buklod_ptt_channel_messages
  for insert to authenticated
  with check (
    kind = 'TEXT'
    and sender_user_id = (select auth.uid())
    and created_at between now() - interval '10 seconds' and now() + interval '10 seconds'
    and exists (
      select 1 from public.buklod_scope_memberships m
      where m.scope_id = buklod_ptt_channel_messages.scope_id
        and m.user_id = (select auth.uid())
        and m.membership_status = 'ACTIVE'
    )
  );
drop policy if exists buklod_ptt_messages_member_caption_insert on public.buklod_ptt_channel_messages;
create policy buklod_ptt_messages_member_caption_insert on public.buklod_ptt_channel_messages
  for insert to authenticated
  with check (
    kind = 'CAPTION'
    and sender_user_id = (select auth.uid())
    and char_length(provider_event_id) between 1 and 180
    and created_at between now() - interval '10 seconds' and now() + interval '10 seconds'
    and exists (
      select 1 from public.buklod_scope_memberships m
      where m.scope_id = buklod_ptt_channel_messages.scope_id
        and m.user_id = (select auth.uid())
        and m.membership_status = 'ACTIVE'
    )
    and exists (
      select 1 from public.buklod_ptt_transmissions tx
      where tx.id = buklod_ptt_channel_messages.transmission_id
        and tx.scope_id = buklod_ptt_channel_messages.scope_id
        and tx.channel = buklod_ptt_channel_messages.channel
        and tx.sender_user_id = (select auth.uid())
        and (
          (tx.status = 'ACTIVE' and tx.lease_expires_at > now() - interval '20 seconds') or
          (tx.status in ('ENDED','PREEMPTED') and tx.ended_at > now() - interval '60 seconds')
        )
    )
  );
-- RLS applies to changefeed, so no cross-scope message leakage.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'buklod_ptt_channel_messages'
     )
  then
    alter publication supabase_realtime add table public.buklod_ptt_channel_messages;
  end if;
end $$;
