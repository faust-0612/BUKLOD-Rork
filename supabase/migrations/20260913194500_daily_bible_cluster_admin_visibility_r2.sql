-- BUKLOD Daily Bible Cluster Admin Visibility R2
-- Corrective/self-contained production migration.
-- Safe if R1 was never applied; also corrects the one speculative historical
-- fallback from R1 if R1 was applied before this migration.
--
-- Canonical rules:
-- * Daily Reading submissions are one canonical row per user + assignment.
-- * New submissions resolve Cluster from exact entry context first, then from
--   authoritative ACTIVE Cluster membership only when exactly one Cluster exists.
-- * Historical submissions are NEVER assigned from today's membership alone.
-- * Submitted-row admin visibility follows the stored submission Cluster (or an
--   already-existing exact-scope approval for older rows), not the client scope.
-- * Backfill never calls reward/payout functions.

-- ---------------------------------------------------------------------------
-- 1) Canonical Cluster snapshot columns (idempotent)
-- ---------------------------------------------------------------------------

alter table public.daily_bible_submissions
  add column if not exists cluster_id uuid references public.buklod_scopes(id) on delete set null,
  add column if not exists cluster_resolution_source text,
  add column if not exists cluster_resolved_at timestamptz;

create index if not exists daily_bible_submissions_cluster_assignment_idx
  on public.daily_bible_submissions (cluster_id, assignment_id, submitted_at desc);

-- ---------------------------------------------------------------------------
-- 2) Correct any speculative R1 historical assignment before using history.
--    R1 tagged these rows explicitly, so they can be repaired deterministically.
-- ---------------------------------------------------------------------------

-- If R1 created a synthetic approval for a speculative membership backfill,
-- remove only that generated approval. A row with this source could not have had
-- an exact-scope approval before R1, because R1 would have resolved it from that
-- exact approval instead of tagging it as unique_active_membership_backfill.
delete from public.buklod_scope_formation_approvals_v2 a
using public.daily_bible_submissions s
where s.cluster_resolution_source = 'unique_active_membership_backfill'
  and a.item_kind = 'DAILY_READING'
  and a.item_id = s.id
  and a.learner_id = s.user_id
  and a.scope_id = s.cluster_id
  and a.approver_id is null
  and a.remarks is null;

update public.daily_bible_submissions
set cluster_id = null,
    cluster_resolution_source = null,
    cluster_resolved_at = null
where cluster_resolution_source = 'unique_active_membership_backfill';

-- ---------------------------------------------------------------------------
-- 3) Authoritative scope resolver for new Daily Reading submissions.
-- ---------------------------------------------------------------------------

create or replace function public.buklod_resolve_auto_submission_scope_v1(
  p_feature_key text,
  p_user_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_scope uuid;
  v_count integer;
  v_feature text := upper(trim(coalesce(p_feature_key, '')));
begin
  if p_user_id is null then
    return null;
  end if;

  -- Exact Formation entry context wins when still valid. For Daily Reading the
  -- context itself must be a real active CLUSTER, never merely an Organization.
  if auth.uid() = p_user_id then
    v_scope := public.buklod_get_formation_entry_scope_v1(v_feature);

    if v_scope is not null
       and public.buklod_user_is_active_scope_member(v_scope, p_user_id)
       and (
         v_feature <> 'DAILY_READING'
         or exists (
           select 1
           from public.buklod_scopes s
           where s.id = v_scope
             and s.scope_type = 'CLUSTER'
             and s.status not in ('SUSPENDED','DELETED')
         )
       ) then
      return v_scope;
    end if;
  end if;

  if v_feature = 'DAILY_READING' then
    -- A normal member does NOT need a Cluster role assignment. Membership is
    -- authoritative. Exactly one active Cluster may be safely inferred; multiple
    -- active Clusters require an exact entry context and are never guessed.
    select count(distinct s.id), min(s.id::text)::uuid
      into v_count, v_scope
    from public.buklod_scope_memberships m
    join public.buklod_scopes s on s.id = m.scope_id
    where m.user_id = p_user_id
      and coalesce(m.membership_status::text, '') = 'ACTIVE'
      and s.scope_type = 'CLUSTER'
      and s.status not in ('SUSPENDED','DELETED');

    if v_count = 1 then
      return v_scope;
    end if;

    return null;
  end if;

  -- Preserve the established fallback semantics for other Formation features.
  select count(distinct s.id), min(s.id::text)::uuid
    into v_count, v_scope
  from public.buklod_scopes s
  join public.buklod_scope_role_assignments ra on ra.scope_id = s.id
  where ra.user_id = p_user_id
    and ra.status = 'ACTIVE'
    and s.scope_type = 'CLUSTER'
    and s.status not in ('SUSPENDED','DELETED')
    and public.buklod_user_is_active_scope_member(s.id, p_user_id);

  if v_count = 1 then
    return v_scope;
  end if;

  return null;
end;
$function$;

revoke all on function public.buklod_resolve_auto_submission_scope_v1(text,uuid) from anon;
grant execute on function public.buklod_resolve_auto_submission_scope_v1(text,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Stamp Cluster before downstream approval/monitoring triggers run.
-- ---------------------------------------------------------------------------

create or replace function public.buklod_stamp_daily_bible_submission_cluster_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_scope uuid;
begin
  if new.user_id is null then
    raise exception 'Daily Reading submission user is required';
  end if;

  -- A stored Cluster is immutable through ordinary resubmission. Do not silently
  -- move a canonical user+assignment submission to a different Cluster.
  if new.cluster_id is not null then
    return new;
  end if;

  if coalesce(new.status::text, '') not in ('pending_admin','pending') then
    return new;
  end if;

  v_scope := public.buklod_resolve_auto_submission_scope_v1(
    'DAILY_READING',
    new.user_id
  );

  if v_scope is null then
    raise exception 'Daily Reading could not resolve one authoritative Cluster. Open Daily Reading from the correct Cluster workspace and submit again.';
  end if;

  new.cluster_id := v_scope;
  new.cluster_resolution_source := 'authoritative_submission_scope';
  new.cluster_resolved_at := now();

  return new;
end;
$function$;

drop trigger if exists buklod_stamp_daily_bible_submission_cluster_v1
on public.daily_bible_submissions;

create trigger buklod_stamp_daily_bible_submission_cluster_v1
before insert or update of
  status,
  assignment_id,
  user_id,
  bible_text,
  bible_photo_path,
  answer_text,
  reflection_photo_path,
  question_answers
on public.daily_bible_submissions
for each row execute function public.buklod_stamp_daily_bible_submission_cluster_v1();

-- ---------------------------------------------------------------------------
-- 5) Keep the legacy assignment-member bridge synchronized from the canonical
--    submission. This removes the monitor's stale-materialization blind spot.
-- ---------------------------------------------------------------------------

create or replace function public.buklod_sync_daily_bible_assignment_member_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.assignment_id is not null and new.user_id is not null then
    insert into public.daily_bible_assignment_members (assignment_id, user_id)
    values (new.assignment_id, new.user_id)
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

drop trigger if exists buklod_sync_daily_bible_assignment_member_v1
on public.daily_bible_submissions;

create trigger buklod_sync_daily_bible_assignment_member_v1
after insert or update of assignment_id, user_id
on public.daily_bible_submissions
for each row execute function public.buklod_sync_daily_bible_assignment_member_v1();

-- ---------------------------------------------------------------------------
-- 6) Strengthen the atomic member completion API with backend postconditions.
-- ---------------------------------------------------------------------------

create or replace function public.complete_my_daily_bible_reading_v3(
  p_assignment_id uuid,
  p_bible_text text default null,
  p_reflection_text text default null,
  p_language text default 'fil',
  p_bible_photo_path text default null,
  p_reflection_photo_path text default null,
  p_question_answers jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_scope uuid;
  v_submission_id uuid;
  v_submission_status text;
  v_submission_cluster uuid;
  v_submitted_at timestamptz;
  v_approval_status text;
  v_pair_count integer;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_assignment_id is null then
    raise exception 'Daily Reading assignment is required';
  end if;

  v_scope := public.buklod_resolve_auto_submission_scope_v1(
    'DAILY_READING',
    v_actor
  );

  if v_scope is null then
    raise exception 'Daily Reading could not resolve one authoritative Cluster. Open Daily Reading from the correct Cluster workspace and submit again.';
  end if;

  -- Preserve the existing canonical evidence validation/idempotency path.
  v_submission_id := public.submit_daily_bible_evidence_v2(
    p_assignment_id,
    p_bible_text,
    p_reflection_text,
    p_language,
    p_bible_photo_path,
    p_reflection_photo_path,
    p_question_answers
  );

  select
    s.status::text,
    s.cluster_id,
    s.submitted_at
  into
    v_submission_status,
    v_submission_cluster,
    v_submitted_at
  from public.daily_bible_submissions s
  where s.id = v_submission_id
    and s.user_id = v_actor
    and s.assignment_id = p_assignment_id;

  if v_submission_status is null then
    raise exception 'Daily Reading submission was not persisted';
  end if;

  if v_submitted_at is null then
    raise exception 'Daily Reading submission is incomplete: submitted_at was not persisted';
  end if;

  if v_submission_cluster is null then
    raise exception 'Daily Reading submission is incomplete: authoritative Cluster was not persisted';
  end if;

  if v_submission_cluster <> v_scope then
    raise exception 'This Daily Reading submission is already bound to a different authoritative Cluster';
  end if;

  select count(*)::integer
    into v_pair_count
  from public.daily_bible_submissions s
  where s.user_id = v_actor
    and s.assignment_id = p_assignment_id;

  if v_pair_count <> 1 then
    raise exception 'Duplicate canonical Daily Reading submissions detected for this assignment';
  end if;

  -- Self-heal the legacy monitor bridge even when the underlying canonical RPC
  -- reused an existing row without changing assignment_id/user_id.
  insert into public.daily_bible_assignment_members (assignment_id, user_id)
  values (p_assignment_id, v_actor)
  on conflict do nothing;

  select a.status::text
    into v_approval_status
  from public.buklod_scope_formation_approvals_v2 a
  where a.item_kind = 'DAILY_READING'
    and a.item_id = v_submission_id
    and a.learner_id = v_actor
    and a.scope_id = v_scope
  order by a.created_at desc
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'submission_id', v_submission_id,
    'cluster_id', v_submission_cluster,
    'status', v_submission_status,
    'submitted_at', v_submitted_at,
    'automatic_check_status', coalesce(v_approval_status, 'EVALUATING'),
    'automatic', true,
    'human_approval_required', false
  );
end;
$function$;

revoke all on function public.complete_my_daily_bible_reading_v3(uuid,text,text,text,text,text,jsonb) from public;
revoke all on function public.complete_my_daily_bible_reading_v3(uuid,text,text,text,text,text,jsonb) from anon;
grant execute on function public.complete_my_daily_bible_reading_v3(uuid,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.complete_my_daily_bible_reading_v3(uuid,text,text,text,text,text,jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 7) Safe historical repair.
--    A canonical submission proves submission; it does NOT by itself prove the
--    historical Cluster. Cluster is recovered only from existing exact-scope
--    approval evidence. Current membership is never used to rewrite history.
-- ---------------------------------------------------------------------------

insert into public.daily_bible_assignment_members (assignment_id, user_id)
select s.assignment_id, s.user_id
from public.daily_bible_submissions s
where s.assignment_id is not null
  and s.user_id is not null
on conflict do nothing;

with unique_exact_scope as (
  select
    a.item_id,
    min(a.scope_id::text)::uuid as scope_id,
    min(a.created_at) as resolved_at
  from public.buklod_scope_formation_approvals_v2 a
  join public.buklod_scopes sc
    on sc.id = a.scope_id
   and sc.scope_type = 'CLUSTER'
  where a.item_kind = 'DAILY_READING'
  group by a.item_id
  having count(distinct a.scope_id) = 1
)
update public.daily_bible_submissions s
set cluster_id = x.scope_id,
    cluster_resolution_source = 'formation_approval_backfill',
    cluster_resolved_at = coalesce(s.cluster_resolved_at, x.resolved_at, now())
from unique_exact_scope x
where s.id = x.item_id
  and s.cluster_id is null;

-- Intentionally NO conversion of bible_reading_sessions into canonical
-- submissions. A completed reading session does not prove the required answers,
-- reflection, or final submit action. Such rows are reported by the audit below.
-- Intentionally NO reward/points function is called by this migration.

-- ---------------------------------------------------------------------------
-- 8) Make stored submission Cluster authoritative in the reviewer monitor.
--    Preserve the current v3 signature so the existing app requires no client
--    route/API change and no OTA/native build for this backend repair.
-- ---------------------------------------------------------------------------

do $block$
begin
  if to_regprocedure('public.reviewer_get_daily_bible_monitor_legacy_cluster_visibility_r1(uuid)') is null then
    if to_regprocedure('public.reviewer_get_daily_bible_monitor_v3(uuid)') is null then
      raise exception 'reviewer_get_daily_bible_monitor_v3(uuid) is required before Daily Reading visibility R2';
    end if;

    alter function public.reviewer_get_daily_bible_monitor_v3(uuid)
      rename to reviewer_get_daily_bible_monitor_legacy_cluster_visibility_r1;
  end if;
end;
$block$;

create or replace function public.reviewer_get_daily_bible_monitor_v3(
  p_assignment_id uuid
)
returns table(
  assignment_id uuid,
  reading_date date,
  bible_reference text,
  user_id uuid,
  full_name text,
  church_id uuid,
  church_name text,
  submission_id uuid,
  bible_text text,
  bible_photo_path text,
  chapter_questions_fil jsonb,
  chapter_questions_en jsonb,
  question_answers jsonb,
  answer_language text,
  reflection_text text,
  reflection_photo_path text,
  submission_status text,
  submitted_at timestamptz,
  submitted_on_time boolean,
  has_bible_photo boolean,
  has_reflection_photo boolean,
  reviewer_can_act boolean
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  actor uuid := auth.uid();
  actor_is_system_admin boolean := public.buklod_is_system_admin();
  actor_has_scope boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.buklod_scopes s
    where s.scope_type = 'CLUSTER'
      and s.status not in ('SUSPENDED','DELETED')
      and public.buklod_is_formation_scope_approver_v1(s.id, actor)
  ) into actor_has_scope;

  if not actor_is_system_admin and not actor_has_scope then
    raise exception 'Formation monitoring access required';
  end if;

  return query
  with submitted_rows as (
    select
      a.id::uuid as assignment_id,
      a.reading_date::date as reading_date,
      a.bible_reference::text as bible_reference,
      sub.user_id::uuid as user_id,
      coalesce(p.full_name, 'BUKLOD Member')::text as full_name,
      p.church_id::uuid as church_id,
      coalesce(c.name, 'No Local')::text as church_name,
      sub.id::uuid as submission_id,
      sub.bible_text::text as bible_text,
      sub.bible_photo_path::text as bible_photo_path,
      coalesce(a.chapter_questions_fil, '[]'::jsonb)::jsonb as chapter_questions_fil,
      coalesce(a.chapter_questions_en, '[]'::jsonb)::jsonb as chapter_questions_en,
      coalesce(sub.question_answers, '[]'::jsonb)::jsonb as question_answers,
      coalesce(sub.answer_language::text, 'fil')::text as answer_language,
      sub.answer_text::text as reflection_text,
      sub.reflection_photo_path::text as reflection_photo_path,
      (
        case
          when sub.status::text = 'approved' then 'approved'
          when sub.status::text = 'rejected' then 'revision_required'
          when sub.id is not null and appr.status::text = 'EVALUATING' then 'ai_checking'
          when sub.id is not null and appr.status::text = 'PENDING' then 'ai_checked_pending_review'
          else 'submitted'
        end
      )::text as submission_status,
      sub.submitted_at::timestamptz as submitted_at,
      coalesce(sub.submitted_on_time, false)::boolean as submitted_on_time,
      (
        sub.bible_photo_path is not null
        and exists (
          select 1
          from storage.objects o
          where o.bucket_id = 'daily-bible-evidence'
            and o.name = sub.bible_photo_path
        )
      )::boolean as has_bible_photo,
      (
        sub.reflection_photo_path is not null
        and exists (
          select 1
          from storage.objects o
          where o.bucket_id = 'daily-bible-evidence'
            and o.name = sub.reflection_photo_path
        )
      )::boolean as has_reflection_photo,
      (
        sub.status::text = 'pending_admin'
        and appr.id is not null
        and appr.status::text = 'PENDING'
        and public.buklod_is_formation_scope_approver_v1(
          coalesce(sub.cluster_id, appr.scope_id),
          actor
        )
      )::boolean as reviewer_can_act
    from public.daily_bible_submissions sub
    join public.daily_bible_assignments a on a.id = sub.assignment_id
    join public.profiles p on p.id = sub.user_id
    left join public.churches c on c.id = p.church_id
    left join lateral (
      select fa.id, fa.scope_id, fa.status
      from public.buklod_scope_formation_approvals_v2 fa
      where fa.learner_id = sub.user_id
        and fa.item_kind = 'DAILY_READING'
        and fa.item_id = sub.id
        and (sub.cluster_id is null or fa.scope_id = sub.cluster_id)
      order by fa.created_at desc
      limit 1
    ) appr on true
    where sub.assignment_id = p_assignment_id
      and (
        actor_is_system_admin
        or (
          sub.cluster_id is not null
          and public.buklod_is_formation_scope_approver_v1(sub.cluster_id, actor)
        )
        or (
          sub.cluster_id is null
          and appr.scope_id is not null
          and public.buklod_is_formation_scope_approver_v1(appr.scope_id, actor)
        )
      )
  ),
  roster_rows as (
    select
      r.assignment_id::uuid,
      r.reading_date::date,
      r.bible_reference::text,
      r.user_id::uuid,
      r.full_name::text,
      r.church_id::uuid,
      r.church_name::text,
      r.submission_id::uuid,
      r.bible_text::text,
      r.bible_photo_path::text,
      r.chapter_questions_fil::jsonb,
      r.chapter_questions_en::jsonb,
      r.question_answers::jsonb,
      r.answer_language::text,
      r.reflection_text::text,
      r.reflection_photo_path::text,
      r.submission_status::text,
      r.submitted_at::timestamptz,
      r.submitted_on_time::boolean,
      r.has_bible_photo::boolean,
      r.has_reflection_photo::boolean,
      r.reviewer_can_act::boolean
    from public.reviewer_get_daily_bible_monitor_legacy_cluster_visibility_r1(
      p_assignment_id
    ) r
    where r.submission_id is null
  )
  select * from submitted_rows
  union all
  select * from roster_rows;
end;
$function$;

revoke all on function public.reviewer_get_daily_bible_monitor_v3(uuid) from public;
revoke all on function public.reviewer_get_daily_bible_monitor_v3(uuid) from anon;
grant execute on function public.reviewer_get_daily_bible_monitor_v3(uuid) to authenticated;
grant execute on function public.reviewer_get_daily_bible_monitor_v3(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9) Read-only audit for post-deploy evidence. Service role only.
-- ---------------------------------------------------------------------------

create or replace function public.buklod_daily_bible_cluster_visibility_audit_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_total bigint;
  v_linked bigint;
  v_exact_recovered bigint;
  v_unresolved bigint;
  v_bridge_missing bigint;
  v_approval_missing bigint;
  v_duplicate_pairs bigint;
  v_session_only bigint;
  v_speculative_remaining bigint;
begin
  if auth.role() <> 'service_role' and not public.buklod_is_system_admin() then
    raise exception 'System administrator access required';
  end if;

  select count(*) into v_total
  from public.daily_bible_submissions;

  select count(*) into v_linked
  from public.daily_bible_submissions
  where cluster_id is not null;

  select count(*) into v_exact_recovered
  from public.daily_bible_submissions
  where cluster_resolution_source = 'formation_approval_backfill';

  select count(*) into v_unresolved
  from public.daily_bible_submissions
  where cluster_id is null;

  select count(*) into v_speculative_remaining
  from public.daily_bible_submissions
  where cluster_resolution_source = 'unique_active_membership_backfill';

  select count(*) into v_bridge_missing
  from public.daily_bible_submissions s
  where not exists (
    select 1
    from public.daily_bible_assignment_members am
    where am.assignment_id = s.assignment_id
      and am.user_id = s.user_id
  );

  select count(*) into v_approval_missing
  from public.daily_bible_submissions s
  where s.cluster_id is not null
    and not exists (
      select 1
      from public.buklod_scope_formation_approvals_v2 a
      where a.item_kind = 'DAILY_READING'
        and a.item_id = s.id
        and a.learner_id = s.user_id
        and a.scope_id = s.cluster_id
    );

  select count(*) into v_duplicate_pairs
  from (
    select s.assignment_id, s.user_id
    from public.daily_bible_submissions s
    group by s.assignment_id, s.user_id
    having count(*) > 1
  ) d;

  select count(*) into v_session_only
  from (
    select distinct s.user_id, a.id as assignment_id
    from public.bible_reading_sessions s
    join public.daily_bible_assignments a
      on (s.started_at at time zone 'Asia/Manila')::date = a.reading_date
    where s.source = 'daily_plan'
      and s.completed_at is not null
      and not exists (
        select 1
        from public.daily_bible_submissions dbs
        where dbs.user_id = s.user_id
          and dbs.assignment_id = a.id
      )
  ) x;

  return jsonb_build_object(
    'total_submissions', v_total,
    'cluster_linked', v_linked,
    'exact_scope_recovered', v_exact_recovered,
    'unresolved_canonical_submissions', v_unresolved,
    'assignment_member_bridge_missing', v_bridge_missing,
    'scope_approval_missing_for_cluster_linked', v_approval_missing,
    'duplicate_assignment_user_pairs', v_duplicate_pairs,
    'completed_daily_plan_sessions_without_canonical_submission', v_session_only,
    'speculative_backfills_remaining', v_speculative_remaining
  );
end;
$function$;

revoke all on function public.buklod_daily_bible_cluster_visibility_audit_v2() from public;
revoke all on function public.buklod_daily_bible_cluster_visibility_audit_v2() from anon;
revoke all on function public.buklod_daily_bible_cluster_visibility_audit_v2() from authenticated;
grant execute on function public.buklod_daily_bible_cluster_visibility_audit_v2() to service_role;
