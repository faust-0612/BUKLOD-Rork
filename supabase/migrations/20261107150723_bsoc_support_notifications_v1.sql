-- BSOC notification routing. Use pre-existing BUKLOD notification and push infrastructure.
-- No content/body/PII copied to notification payload, just case reference and safe navigation.
create or replace function private.bsoc_support_notify_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  case_uuid uuid;
  notify_kind text;
  target_id uuid;
  member_id uuid;
  sender_id uuid;
  alert_title text;
  alert_body text;
begin
  if tg_table_name='user_feedback' then
    if tg_op <> 'INSERT' then return new; end if;
    case_uuid := new.id;
    notify_kind := 'new_case';
  elsif tg_table_name='bsoc_case_messages' then
    case_uuid := new.case_id;
    notify_kind := case when new.sender_kind='agent' then 'agent_reply' else 'member_reply' end;
    sender_id := new.sender_id;
  elsif tg_table_name='bsoc_case_attachments' then
    case_uuid := new.case_id;
    notify_kind := 'evidence_uploaded';
    sender_id := new.uploader_id;
  else
    return new;
  end if;

  select f.user_id into member_id from public.user_feedback f where f.id=case_uuid;
  if notify_kind='agent_reply' then
    if member_id is not null and member_id is distinct from sender_id then
      insert into public.notifications(user_id,title,body,kind,data)
      values(member_id,'BUKLOD Support reply','May bagong sagot ang support team sa iyong concern.',
        'bsoc_support',jsonb_build_object('route','/support/live','case_id',case_uuid::text,'event',notify_kind));
    end if;
    return new;
  end if;

  alert_title := case when notify_kind='new_case' then 'New BUKLOD support case'
                       when notify_kind='member_reply' then 'New member support reply'
                       else 'New support evidence' end;
  alert_body := case when notify_kind='new_case' then 'May bagong concern sa BSOC inbox.'
                      when notify_kind='member_reply' then 'May bagong reply sa isang support case.'
                      else 'May bagong photo/video evidence sa support case.' end;

  -- Eligible personnel: active SYSTEM-scope support readers or active system admins.
  -- No membership is granted by notifications; receiver-side authorization is rechecked on open.
  insert into public.notifications(user_id,title,body,kind,data)
  select distinct recipients.user_id,alert_title,alert_body,'bsoc_support',
     jsonb_build_object('route','/admin/bsoc-conversations','case_id',case_uuid::text,
                        'event',notify_kind,'scope','BSOC_SUPPORT')
  from (
    select ur.user_id
      from public.user_roles ur
      where ur.role='system_admin' and ur.is_active=true
    union
    select ra.user_id from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    join public.buklod_role_permissions rp on rp.role_key=ra.role_key
    where ra.status='ACTIVE' and s.scope_type='SYSTEM' and s.status='ACTIVE'
      and rp.permission_key='bsoc.support.read'
  ) recipients
  join public.profiles p on p.id=recipients.user_id and coalesce(p.is_active,true)=true
  where recipients.user_id is distinct from sender_id;
  return new;
end
$$;
revoke all on function private.bsoc_support_notify_v1() from public,anon,authenticated;

drop trigger if exists bsoc_notify_new_case_v1 on public.user_feedback;
create trigger bsoc_notify_new_case_v1 after insert on public.user_feedback
for each row execute function private.bsoc_support_notify_v1();

drop trigger if exists bsoc_notify_message_v1 on public.bsoc_case_messages;
create trigger bsoc_notify_message_v1 after insert on public.bsoc_case_messages
for each row execute function private.bsoc_support_notify_v1();

drop trigger if exists bsoc_notify_evidence_v1 on public.bsoc_case_attachments;
create trigger bsoc_notify_evidence_v1 after insert on public.bsoc_case_attachments
for each row execute function private.bsoc_support_notify_v1();

create index if not exists notifications_bsoc_unread_idx
on public.notifications(user_id,created_at desc)
where kind='bsoc_support' and read_at is null;
