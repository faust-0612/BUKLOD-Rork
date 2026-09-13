-- BUKLOD Daily Bible Cluster Admin Visibility R1
-- Stability-first repair for canonical Daily Reading submissions.
--
-- Goals:
-- 1) resolve an ordinary member's authoritative Cluster from ACTIVE membership,
--    not from a Cluster role assignment;
-- 2) snapshot the exact Cluster on the canonical daily_bible_submissions row;
-- 3) keep daily_bible_assignment_members synchronized for every real submission,
--    so the existing reviewer monitor cannot hide a valid submitted row;
-- 4) safely recover historical scope linkage where there is authoritative evidence;
-- 5) do not award/re-award any points during repair/backfill.

alter table public.daily_bible_submissions
  add column if not exists cluster_id uuid references public.buklod_scopes(id) on delete set null,
  add column if not exists cluster_resolution_source text,
  add column if not exists cluster_resolved_at timestamptz;

create index if not exists daily_bible_submissions_cluster_assignment_idx
  on public.daily_bible_submissions (cluster_id, assignment_id, submitted_at desc);

-- Daily Reading is Cluster-gated. Preserve the existing resolver behavior for
-- other Formation features, but correct Daily Reading so a normal ACTIVE member
-- does not need a Cluster role assignment just to resolve their own Cluster.
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

  -- Exact entry context always wins when it is still valid. Daily Reading must
  -- resolve to a real Cluster, never merely an Organization/client UI scope.
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
    -- Correct fallback: membership is authoritative for a member submission.
    -- If there is exactly one ACTIVE Cluster, it is safe to resolve it. If the
    -- member belongs to multiple Clusters, do not guess; exact entry context is
    -- required instead.
    select count(distinct s.id), min(s.id::text)::uuid
      into v_count, v_scope
    from public.buklod_scope_memberships m
    join public.buklod_scopes s
      on s.id = m.scope_id
    where m.user_id = p_user_id
      and coalesce(m.membership_status::text, '') = 'ACTIVE'
      and s.scope_type = 'CLUSTER'
      and s.status not in ('SUSPENDED','DELETED');

    if v_count = 1 then
      return v_scope;
    end if;

    return null;
  end if;

  -- Preserve the pre-existing fallback semantics for non-Daily-Reading callers.
  select count(distinct s.id), min(s.id::text)::uuid
    into v_count, v_scope
  from public.buklod_scopes s
  join public.buklod_scope_role_assignments ra
    on ra.scope_id = s.id
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

-- Stamp the exact Cluster before a canonical pending submission becomes visible
-- to downstream approval/monitoring triggers. This is backend-authoritative and
-- deliberately refuses ambiguous multi-Cluster fallback instead of guessing.
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

-- The legacy reviewer monitor is based on daily_bible_assignment_members.
-- Synchronize that bridge from the canonical submission so a real submission
-- can never be invisible merely because assignment-member materialization was
-- stale when the assignment was originally created.
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

-- Keep the current atomic member completion API, but make Cluster resolution
-- explicit in the returned canonical record and synchronize the reviewer bridge
-- even when an existing submission row is reused idempotently.
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
  v_approval_status text;
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

  v_submission_id := public.submit_daily_bible_evidence_v2(
    p_assignment_id,
    p_bible_text,
    p_reflection_text,
    p_language,
    p_bible_photo_path,
    p_reflection_photo_path,
    p_question_answers
  );

  update public.daily_bible_submissions s
  set cluster_id = v_scope,
      cluster_resolution_source = coalesce(
        nullif(s.cluster_resolution_source, ''),
        'complete_my_daily_bible_reading_v3'
      ),
      cluster_resolved_at = coalesce(s.cluster_resolved_at, now())
  where s.id = v_submission_id
    and s.user_id = v_actor;

  insert into public.daily_bible_assignment_members (assignment_id, user_id)
  values (p_assignment_id, v_actor)
  on conflict do nothing;

  select s.status::text
    into v_submission_status
  from public.daily_bible_submissions s
  where s.id = v_submission_id
    and s.user_id = v_actor;

  if v_submission_status is null then
    raise exception 'Daily Reading submission was not persisted';
  end if;

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
    'cluster_id', v_scope,
    'status', v_submission_status,
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
-- Historical repair. No point/reward function is called anywhere below.
-- ---------------------------------------------------------------------------

-- A canonical submission is definitive proof that this assignment/user pair
-- belongs in the reviewer bridge.
insert into public.daily_bible_assignment_members (assignment_id, user_id)
select s.assignment_id, s.user_id
from public.daily_bible_submissions s
where s.assignment_id is not null
  and s.user_id is not null
on conflict do nothing;

-- Strongest historical evidence: an existing exact-scope Formation approval.
with latest_exact_scope as (
  select distinct on (a.item_id)
    a.item_id,
    a.scope_id,
    a.created_at
  from public.buklod_scope_formation_approvals_v2 a
  join public.buklod_scopes sc
    on sc.id = a.scope_id
   and sc.scope_type = 'CLUSTER'
  where a.item_kind = 'DAILY_READING'
  order by a.item_id, a.created_at desc
)
update public.daily_bible_submissions s
set cluster_id = x.scope_id,
    cluster_resolution_source = 'formation_approval_backfill',
    cluster_resolved_at = coalesce(s.cluster_resolved_at, x.created_at, now())
from latest_exact_scope x
where s.id = x.item_id
  and s.cluster_id is null;

-- Conservative secondary recovery: only users who currently have exactly one
-- ACTIVE Cluster membership are recoverable without guessing. Ambiguous rows
-- deliberately remain NULL for later audit instead of being assigned falsely.
with one_active_cluster as (
  select
    m.user_id,
    min(m.scope_id::text)::uuid as scope_id
  from public.buklod_scope_memberships m
  join public.buklod_scopes sc
    on sc.id = m.scope_id
   and sc.scope_type = 'CLUSTER'
   and sc.status not in ('SUSPENDED','DELETED')
  where coalesce(m.membership_status::text, '') = 'ACTIVE'
  group by m.user_id
  having count(distinct m.scope_id) = 1
)
update public.daily_bible_submissions s
set cluster_id = x.scope_id,
    cluster_resolution_source = 'unique_active_membership_backfill',
    cluster_resolved_at = coalesce(s.cluster_resolved_at, now())
from one_active_cluster x
where s.user_id = x.user_id
  and s.cluster_id is null;

-- Reconstruct missing scope-approval linkage only when the submission's Cluster
-- is now authoritative. This does NOT invoke automatic checking or payout; it
-- only restores visibility/audit state and therefore cannot double-award points.
insert into public.buklod_scope_formation_approvals_v2 (
  scope_id,
  learner_id,
  item_kind,
  item_id,
  status,
  created_at,
  decided_at,
  updated_at
)
select
  s.cluster_id,
  s.user_id,
  'DAILY_READING',
  s.id,
  case
    when s.status::text = 'approved' then 'APPROVED'
    when s.status::text = 'rejected' then 'REJECTED'
    else 'PENDING'
  end,
  coalesce(s.submitted_at, now()),
  case
    when s.status::text in ('approved','rejected') then coalesce(s.reviewed_at, s.submitted_at, now())
    else null
  end,
  now()
from public.daily_bible_submissions s
where s.cluster_id is not null
  and not exists (
    select 1
    from public.buklod_scope_formation_approvals_v2 a
    where a.item_kind = 'DAILY_READING'
      and a.item_id = s.id
      and a.learner_id = s.user_id
  )
on conflict do nothing;

-- Lightweight audit helper for post-deploy verification. Read-only and restricted
-- to System Admin/service-role contexts because it reports global repair counts.
create or replace function public.buklod_daily_bible_cluster_visibility_audit_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_total bigint;
  v_linked bigint;
  v_unresolved bigint;
  v_bridge_missing bigint;
  v_approval_missing bigint;
begin
  if auth.role() <> 'service_role' and not public.buklod_is_system_admin() then
    raise exception 'System administrator access required';
  end if;

  select count(*) into v_total
  from public.daily_bible_submissions;

  select count(*) into v_linked
  from public.daily_bible_submissions
  where cluster_id is not null;

  select count(*) into v_unresolved
  from public.daily_bible_submissions
  where cluster_id is null;

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

  return jsonb_build_object(
    'total_submissions', v_total,
    'cluster_linked', v_linked,
    'unresolved', v_unresolved,
    'assignment_member_bridge_missing', v_bridge_missing,
    'scope_approval_missing', v_approval_missing
  );
end;
$function$;

revoke all on function public.buklod_daily_bible_cluster_visibility_audit_v1() from public, anon, authenticated;
grant execute on function public.buklod_daily_bible_cluster_visibility_audit_v1() to service_role;
