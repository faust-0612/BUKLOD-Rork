-- BSOC support: covering indexes for frequently joined evidence and message owner FKs.
create index if not exists bsoc_case_attachments_message_id_idx
on public.bsoc_case_attachments(message_id) where message_id is not null;
create index if not exists bsoc_case_attachments_uploader_id_idx
on public.bsoc_case_attachments(uploader_id);
create index if not exists bsoc_case_messages_sender_id_idx
on public.bsoc_case_messages(sender_id);
