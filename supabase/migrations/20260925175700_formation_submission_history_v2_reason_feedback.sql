-- BUKLOD Formation submission history V2
-- Adds WHY and automatic feedback while preserving V1.

CREATE OR REPLACE FUNCTION public.buklod_scope_formation_submission_history_v2(p_scope_id uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(approval_id uuid, scope_id uuid, scope_name text, item_kind text, item_id uuid, learner_id uuid, learner_name text, title text, subtitle text, submitted_at timestamp with time zone, decided_at timestamp with time zone, status text, why text, automatic_feedback text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select
  h.approval_id,
  h.scope_id,
  h.scope_name,
  h.item_kind,
  h.item_id,
  h.learner_id,
  h.learner_name,
  h.title,
  h.subtitle,
  h.submitted_at,
  h.decided_at,
  h.status,
  coalesce(
    nullif(trim(a.remarks),''),
    case
      when h.status='REJECTED'
        then 'Automatic checking found an item that needs revision.'
      when h.status='APPROVED'
        then 'Passed BUKLOD automatic validation.'
      when h.status in ('PENDING','EVALUATING')
        then 'Automatic checking is still in progress.'
      else 'No additional reason recorded.'
    end
  )::text as why,
  coalesce(
    nullif(trim(a.remarks),''),
    case
      when h.status='REJECTED'
        then 'Review the flagged response and submit again.'
      when h.status='APPROVED'
        then 'No revision needed.'
      when h.status in ('PENDING','EVALUATING')
        then 'Please wait for automatic checking to finish.'
      else 'No automatic feedback recorded.'
    end
  )::text as automatic_feedback
from public.buklod_scope_formation_submission_history_v1(
  p_scope_id,
  p_limit
) h
left join public.buklod_scope_formation_approvals_v2 a
  on a.id=h.approval_id
order by h.submitted_at desc;
$function$


revoke all on function
public.buklod_scope_formation_submission_history_v2(uuid,integer)
from public,anon;

grant execute on function
public.buklod_scope_formation_submission_history_v2(uuid,integer)
to authenticated,service_role;

notify pgrst,'reload schema';
