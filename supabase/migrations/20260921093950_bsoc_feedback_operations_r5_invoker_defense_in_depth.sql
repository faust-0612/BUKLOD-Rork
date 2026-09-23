
alter function public.buklod_bsoc_feedback_metrics_v1(integer) security invoker;
alter function public.buklod_bsoc_top_error_routes_v1(integer,integer) security invoker;
alter function public.buklod_bsoc_support_lookup_v1(text) security invoker;
alter function public.buklod_bsoc_preview_support_case_action_v1(
  uuid,public.feedback_status,text,uuid
) security invoker;
alter function public.buklod_bsoc_apply_support_case_action_v1(
  uuid,timestamptz,public.feedback_status,text,uuid,text
) security invoker;
alter function public.buklod_bsoc_preview_incident_update_v1(
  uuid,public.incident_status,uuid,text
) security invoker;
alter function public.buklod_bsoc_apply_incident_update_v1(
  uuid,timestamptz,public.incident_status,uuid,text,text
) security invoker;
alter function public.buklod_bsoc_create_incident_v1(
  public.incident_severity,text,text,text,text,text,text,text,text,text,text,text,uuid,text
) security invoker;
alter function public.buklod_bsoc_correlate_known_incidents_v1(
  text,text,text,text,text,text,integer
) security invoker;
alter function public.buklod_bsoc_error_category_metrics_v1(integer,integer) security invoker;
alter function public.buklod_bsoc_user360_v1(uuid,integer) security invoker;
