-- Named formation submission reports. Forward-only; no historical rewrites.
-- Retain member messages, admin recipient selection, routing, dedupe and ACL.
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
  v_learner_name text;
  v_scope_name text;
  v_scope_type text;
  v_scope_context text;
  v_admin_label text;
  v_activity_detail text;
  v_admin_activity text;
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
    -- All display values are resolved from the exact approval and its owner.
    -- Do not accept caller-supplied names or widen the existing admin audience.
    select coalesce(nullif(btrim(p.full_name),''),
                    nullif(btrim(concat_ws(' ',p.first_name,p.surname)),''),
                    nullif(btrim(p.username),''),'BUKLOD Member')
      into v_learner_name
    from public.profiles p where p.id=v_row.learner_id;
    v_learner_name := coalesce(v_learner_name,'BUKLOD Member');

    select nullif(btrim(s.name),''), s.scope_type
      into v_scope_name,v_scope_type
    from public.buklod_scopes s where s.id=v_row.scope_id;
    v_scope_context := case
      when v_scope_type='CLUSTER' then 'your cluster'
      when v_scope_type='ORGANIZATION' then 'your organization'
      else 'your scope' end;
    if v_scope_name is not null then
      v_scope_context := v_scope_context || ' (' || left(v_scope_name,100) || ')';
    end if;

    v_admin_label := v_label;
    if v_row.item_kind='DAILY_DEVOTION' then
      v_activity_detail := v_devotional_title;
    elsif v_row.item_kind='DAILY_READING' then
      select nullif(btrim(a.bible_reference),'') into v_activity_detail
      from public.daily_bible_submissions s
      join public.daily_bible_assignments a on a.id=s.assignment_id
      where s.id=v_row.item_id and s.user_id=v_row.learner_id;
    elsif v_row.item_kind='LESSON' then
      select case when btrim(t.stage_code) in ('101','102','103','104','105','106','107')
                  then 'BUKLOD ' || btrim(t.stage_code)
                  else coalesce(nullif(btrim(t.title),''),'BUKLOD Lesson') end,
             nullif(btrim(l.title),'')
        into v_admin_label,v_activity_detail
      from public.lesson_progress lp
      join public.learning_lessons l on l.id=lp.lesson_id
      join public.learning_tracks t on t.id=l.track_id
      where lp.id=v_row.item_id and lp.user_id=v_row.learner_id;
    end if;
    v_admin_label := coalesce(v_admin_label,v_label);
    v_admin_activity := v_admin_label;
    if v_activity_detail is not null
       and lower(v_activity_detail)<>lower(v_admin_label) then
      v_admin_activity := v_admin_activity || ' - ' || left(v_activity_detail,140);
    end if;

    v_admin_body := format('%s submitted %s in %s. %s',
      left(v_learner_name,120),left(v_admin_activity,220),v_scope_context,
      case when v_row.status='APPROVED'
        then 'Automatically validated. No approval required.'
        else 'Needs correction after automatic validation. No approval required.' end);
    for v_admin in select x.user_id from public.buklod_cluster_submission_admin_ids_v1(v_row.scope_id) x where x.user_id<>v_row.learner_id
    loop
      perform public.buklod_queue_notification_once_v1(
        v_admin,
        left(v_admin_label,96) || ' submitted',
        v_admin_body,
        'formation_submission_report',
        jsonb_build_object('approval_id',v_row.id,'scope_id',v_row.scope_id,'learner_id',v_row.learner_id,'item_kind',v_row.item_kind,'item_id',v_row.item_id,'report_only',true,'automatic_check',true,'status',v_row.status),
        'formation:report:cluster-admin:' || v_row.id::text || ':' || v_admin::text
      );
    end loop;
  end if;
end;
$function$;

-- The outcome producer is invoked exclusively by the existing database
-- approval trigger. Never let arbitrary client roles invoke this SECURITY
-- DEFINER producer with another member's approval UUID. Trigger invocation
-- executes as its own trusted database function owner, not as an RPC grant.
revoke all on function public.buklod_notify_scope_formation_outcome_v1(uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.buklod_notify_scope_formation_outcome_v1(uuid,boolean)
  to service_role;
