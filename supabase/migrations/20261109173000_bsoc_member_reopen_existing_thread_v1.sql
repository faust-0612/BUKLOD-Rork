-- Member initiated reopening of their OWN previously resolved BSOC case.
-- Preserves the same case conversation; message insert invokes existing staff notifications.
-- No arbitrary status edits or access to another user's case.
create or replace function public.buklod_bsoc_member_reopen_case_v1(
 p_case_id uuid,
 p_message text,
 p_client_nonce uuid
) returns jsonb
language plpgsql security definer
set search_path=''
as $function$
declare
 actor uuid:=auth.uid();
 support_case public.user_feedback%rowtype;
 prior_message uuid;
 reply_id uuid;
 reason text:=trim(coalesce(p_message,''));
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_case_id is null or p_client_nonce is null or length(reason)<10 or length(reason)>8000 then
   raise exception 'Case, unique request ID, and a 10-8000 character explanation are required';
 end if;
 select * into support_case from public.user_feedback
 where id=p_case_id and user_id=actor for update;
 if not found then raise exception 'Support case not found for this account' using errcode='42501'; end if;

 select id into prior_message from public.bsoc_case_messages
 where sender_id=actor and client_nonce=p_client_nonce and case_id=p_case_id limit 1;
 if prior_message is not null then
   return jsonb_build_object('case_id',p_case_id,'status',support_case.status::text,
                            'message_id',prior_message,'idempotent',true);
 end if;
 if support_case.status='closed'::public.feedback_status then
   raise exception 'Closed support cases cannot be reopened. Start a new concern.';
 end if;
 if support_case.status<>'resolved'::public.feedback_status then
   raise exception 'This case is already active; send a normal reply instead.';
 end if;

 update public.user_feedback
 set status='in_progress'::public.feedback_status, resolved_at=null
 where id=p_case_id and user_id=actor and status='resolved'::public.feedback_status;
 if not found then raise exception 'Support case changed; refresh before trying again'; end if;

 insert into public.bsoc_case_messages(case_id,sender_id,sender_kind,body,client_nonce)
 values(p_case_id,actor,'member','ISSUE STILL OCCURS: '||left(reason,7900),p_client_nonce)
 returning id into reply_id;

 return jsonb_build_object('case_id',p_case_id,'status','in_progress',
   'message_id',reply_id,'idempotent',false);
end;
$function$;
revoke all on function public.buklod_bsoc_member_reopen_case_v1(uuid,text,uuid) from public,anon;
grant execute on function public.buklod_bsoc_member_reopen_case_v1(uuid,text,uuid) to authenticated;
