-- BUKLOD precise devotional revision notifications R1.
-- Source-only, additive, never backfill/alter existing user notifications.
-- Restores DEV-on-top-of-live notification producer with the same signature,
-- SECURITY DEFINER/search_path, idempotency keys and admin fanout.
-- When queued, the original item_id remains the submission id.
CREATE OR REPLACE FUNCTION public.buklod_notify_scope_formation_outcome_v1(p_approval_id uuid, p_auto_approved boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row record;
  v_admin uuid;
  v_label text;
  v_body text;
  v_admin_body text;
  v_devotional_id uuid;
  v_devotional_title text;
  v_revision_reason text;
  v_member_payload jsonb;
begin
  select a.* into v_row from public.buklod_scope_formation_approvals_v2 a where a.id=p_approval_id;
  if v_row.id is null or v_row.status not in ('APPROVED','REJECTED') then return; end if;
  v_label := case v_row.item_kind when 'DAILY_READING' then 'Daily Reading' when 'DAILY_DEVOTION' then 'Daily Devotion' when 'LESSON' then 'BUKLOD Lesson' else 'Formation submission' end;

  v_member_payload := jsonb_build_object(
    'approval_id',v_row.id, 'scope_id',v_row.scope_id,
    'item_kind',v_row.item_kind, 'item_id',v_row.item_id
  );

  -- The Formation item's ID is the canonical devotional_reward_submissions.id.
  -- Include that exact ID, not the generic daily devotion URL. Only the
  -- learner receives this detail; the existing admin report path is unchanged.
  if v_row.item_kind='DAILY_DEVOTION' then
    select s.devotional_id,
           coalesce(nullif(btrim(s.devotional_title_snapshot),''),
                    nullif(btrim(d.title),''),'Daily Devotion'),
           coalesce(nullif(btrim(s.admin_note),''),
                    nullif(btrim(v_row.remarks),''))
      into v_devotional_id,v_devotional_title,v_revision_reason
    from public.devotional_reward_submissions s
    left join public.devotionals d on d.id=s.devotional_id
    where s.id=v_row.item_id and s.user_id=v_row.learner_id;

    if v_devotional_id is not null then
      v_member_payload := v_member_payload || jsonb_build_object(
        'submission_id',v_row.item_id,
        'devotional_id',v_devotional_id,
        'devotional_title',v_devotional_title,
        'route','/devotional/submissions?submissionId='||v_row.item_id::text
      );
    end if;
  end if;

  if v_row.status='APPROVED' then
    v_body := case when p_auto_approved then 'Your response met the BUKLOD automatic validation standard and was approved. No human approval was used.' else 'Your response has been approved.' end;
    perform public.buklod_queue_notification_once_v1(v_row.learner_id,case when v_devotional_title is not null then 'Approved: '||left(v_devotional_title,96) else v_label || ' approved' end,v_body,'formation_approved',v_member_payload || jsonb_build_object('auto_approved',p_auto_approved),'formation:approved:user:' || v_row.id::text);
  else
    perform public.buklod_queue_notification_once_v1(v_row.learner_id,case when v_devotional_title is not null then 'Revision needed: '||left(v_devotional_title,88) else v_label || ' needs improvement' end,coalesce(v_revision_reason,nullif(trim(coalesce(v_row.remarks,'')),''),'Please improve the response and submit again.'),'formation_needs_improvement',v_member_payload || jsonb_build_object('automatic_check',p_auto_approved),'formation:rejected:user:' || v_row.id::text);
  end if;

  if p_auto_approved then
    v_admin_body := case when v_row.status='APPROVED'
      then 'A submission in your cluster passed BUKLOD automatic validation. This is a report only; no approval action is required.'
      else 'A submission in your cluster needs correction after BUKLOD automatic validation. This is a report only; no approval action is required.' end;
    for v_admin in select x.user_id from public.buklod_cluster_submission_admin_ids_v1(v_row.scope_id) x where x.user_id<>v_row.learner_id
    loop
      perform public.buklod_queue_notification_once_v1(
        v_admin,
        v_label || ' submission report',
        v_admin_body,
        'formation_submission_report',
        jsonb_build_object('approval_id',v_row.id,'scope_id',v_row.scope_id,'learner_id',v_row.learner_id,'item_kind',v_row.item_kind,'item_id',v_row.item_id,'report_only',true,'automatic_check',true,'status',v_row.status),
        'formation:report:cluster-admin:' || v_row.id::text || ':' || v_admin::text
      );
    end loop;
  end if;
end;
$function$
