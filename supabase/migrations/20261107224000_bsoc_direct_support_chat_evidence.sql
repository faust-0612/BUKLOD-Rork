-- BSOC Direct Support: additive case messaging and private evidence.
-- Existing user_feedback remains canonical case record.
create table if not exists public.bsoc_case_messages (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.user_feedback(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 sender_kind text not null check (sender_kind in ('member','agent')),
 body text not null default '' check (char_length(body) <= 8000),
 client_nonce uuid not null,
 created_at timestamptz not null default now(),
 unique(sender_id,client_nonce)
);
create index if not exists bsoc_case_messages_case_time_idx on public.bsoc_case_messages(case_id,created_at,id);
alter table public.bsoc_case_messages enable row level security;
drop policy if exists bsoc_case_messages_read on public.bsoc_case_messages;
create policy bsoc_case_messages_read on public.bsoc_case_messages for select to authenticated
using (
 exists (select 1 from public.user_feedback f where f.id=case_id and f.user_id=(select auth.uid()))
 or (select public.buklod_bsoc_can('bsoc.support.read'))
);
drop policy if exists bsoc_case_messages_post on public.bsoc_case_messages;
create policy bsoc_case_messages_post on public.bsoc_case_messages for insert to authenticated
with check (
 sender_id=(select auth.uid()) and (
 (sender_kind='member' and exists (
    select 1 from public.user_feedback f where f.id=case_id and f.user_id=(select auth.uid())
      and f.status::text not in ('closed')
 ))
 or (sender_kind='agent' and (select public.buklod_bsoc_can('bsoc.support.manage')))
 )
);
revoke all on public.bsoc_case_messages from anon;
grant select,insert on public.bsoc_case_messages to authenticated;

create table if not exists public.bsoc_case_attachments (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references public.user_feedback(id) on delete cascade,
 message_id uuid references public.bsoc_case_messages(id) on delete set null,
 uploader_id uuid not null references auth.users(id) on delete cascade,
 object_path text not null unique,
 mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm')),
 byte_size bigint not null check (byte_size>0 and byte_size<=262144000),
 created_at timestamptz not null default now(),
 constraint bsoc_attachment_path_check check (
   object_path=case_id::text || '/' || uploader_id::text || '/' || id::text
 )
);
create index if not exists bsoc_case_attachments_case_time_idx on public.bsoc_case_attachments(case_id,created_at,id);
alter table public.bsoc_case_attachments enable row level security;
drop policy if exists bsoc_attachments_read on public.bsoc_case_attachments;
create policy bsoc_attachments_read on public.bsoc_case_attachments for select to authenticated
using (
 exists (select 1 from public.user_feedback f where f.id=case_id and f.user_id=(select auth.uid()))
 or (select public.buklod_bsoc_can('bsoc.support.read'))
);
drop policy if exists bsoc_attachments_insert on public.bsoc_case_attachments;
create policy bsoc_attachments_insert on public.bsoc_case_attachments for insert to authenticated
with check (
 uploader_id=(select auth.uid())
 and (
   exists (select 1 from public.user_feedback f where f.id=case_id and f.user_id=(select auth.uid()) and f.status::text<>'closed')
   or (select public.buklod_bsoc_can('bsoc.support.manage'))
 )
 and exists (
   select 1 from storage.objects o where o.bucket_id='bsoc-support-evidence' and o.name=object_path
 )
);
revoke all on public.bsoc_case_attachments from anon;
grant select,insert on public.bsoc_case_attachments to authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('bsoc-support-evidence','bsoc-support-evidence',false,262144000,
 array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;
drop policy if exists bsoc_evidence_read on storage.objects;
create policy bsoc_evidence_read on storage.objects for select to authenticated
using (bucket_id='bsoc-support-evidence' and (
 exists (select 1 from public.user_feedback f where f.id::text=split_part(name,'/',1) and f.user_id=(select auth.uid()))
 or (select public.buklod_bsoc_can('bsoc.support.read'))
));
drop policy if exists bsoc_evidence_upload on storage.objects;
create policy bsoc_evidence_upload on storage.objects for insert to authenticated
with check (bucket_id='bsoc-support-evidence'
 and split_part(name,'/',2)=(select auth.uid())::text
 and split_part(name,'/',3) ~ '^[0-9a-f-]{36}$'
 and exists (select 1 from public.user_feedback f
   where f.id::text=split_part(name,'/',1) and f.status::text<>'closed'
   and (f.user_id=(select auth.uid()) or (select public.buklod_bsoc_can('bsoc.support.manage')))
 ));
do $block$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='bsoc_case_messages') then
   alter publication supabase_realtime add table public.bsoc_case_messages;
 end if;
end $block$;
-- Replies and evidence are append-only. No direct UPDATE or DELETE permission.
