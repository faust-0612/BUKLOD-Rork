
revoke execute on function public.buklod_record_feedback_event_v1(
  text,text,text,text,text,text,text,text,boolean,boolean,uuid,uuid
) from anon;

revoke execute on function public.buklod_record_feedback_event_v1(
  text,text,text,text,text,text,text,text,boolean,boolean,uuid,uuid
) from public;

grant execute on function public.buklod_record_feedback_event_v1(
  text,text,text,text,text,text,text,text,boolean,boolean,uuid,uuid
) to authenticated;

revoke execute on function public.buklod_bsoc_record_support_action_audit_v1(
  text,text,text,uuid,uuid,uuid,text,text
) from anon;

revoke execute on function public.buklod_bsoc_record_support_action_audit_v1(
  text,text,text,uuid,uuid,uuid,text,text
) from public;

grant execute on function public.buklod_bsoc_record_support_action_audit_v1(
  text,text,text,uuid,uuid,uuid,text,text
) to authenticated;
