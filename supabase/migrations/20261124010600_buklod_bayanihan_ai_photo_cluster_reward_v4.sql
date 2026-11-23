-- BUKLOD Bayanihan V4: +50 BP only on BOTH AI photo evidence review
-- and authorized, non-self Cluster/Formation approval of the SAME action.
-- Evidence in private Storage; AI does NOT certify real-world authenticity:
-- it is a relevance/safety screening aid, final responsibility is human.
-- Source-only until staged RC; no QMP, ad, cash or older rewards mutated.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('buklod-bayanihan-evidence','buklod-bayanihan-evidence',false,
       6291456,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy "Bayanihan owner upload v4" on storage.objects
 for insert to authenticated
 with check(bucket_id='buklod-bayanihan-evidence' and
   (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Bayanihan owner read v4" on storage.objects
 for select to authenticated
 using(bucket_id='buklod-bayanihan-evidence' and
   (storage.foldername(name))[1]=(select auth.uid())::text);

create table if not exists public.buklod_bayanihan_photo_reviews_v4 (
 action_id uuid primary key references public.buklod_formation_bayanihan_actions(id) on delete cascade,
 member_id uuid not null references auth.users(id) on delete cascade,
 photo_storage_path text not null,
 image_sha256 text not null check(image_sha256~'^[a-f0-9]{64}$'),
 review_state text not null check(review_state in ('PASSED','REVIEW_REQUIRED','REJECTED')),
 confidence numeric(4,3) not null check(confidence between 0 and 1),
 model text not null,
 feedback text not null,
 attempts smallint not null default 1 check(attempts between 1 and 3),
 reviewed_at timestamptz not null default now()
);
create unique index if not exists buklod_bayanihan_v4_photo_per_member
 on public.buklod_bayanihan_photo_reviews_v4(member_id,image_sha256)
 where review_state='PASSED';
alter table public.buklod_bayanihan_photo_reviews_v4 enable row level security;
revoke all on public.buklod_bayanihan_photo_reviews_v4 from public,anon,authenticated;
grant select on public.buklod_bayanihan_photo_reviews_v4 to authenticated;
create policy "Bayanihan own AI status v4" on public.buklod_bayanihan_photo_reviews_v4
 for select to authenticated using((select auth.uid())=member_id);
-- No INSERT/UPDATE/DELETE grant to authenticated. Only the authenticated
-- server-side AI function with service-role can write the trusted verdict.
create or replace function public.get_bayanihan_ai_review_v4(p_action_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $read$
declare v_actor uuid:=(select auth.uid());v_action public.buklod_formation_bayanihan_actions%rowtype;
v_review public.buklod_bayanihan_photo_reviews_v4%rowtype;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into v_action from public.buklod_formation_bayanihan_actions where id=p_action_id;
 if v_action.id is null then raise exception 'Action not found';end if;
 if v_actor<>v_action.member_id and not public.is_system_admin()
   and not public.buklod_formation_can_authorize_repeat(v_action.member_id)
 then raise exception 'Not authorized' using errcode='42501';end if;
 select * into v_review from public.buklod_bayanihan_photo_reviews_v4
 where action_id=p_action_id;
 return jsonb_build_object(
   'status',coalesce(v_review.review_state,'PENDING_AI'),
   'feedback',v_review.feedback,
   'verified_at',v_review.reviewed_at,
   'human_verification_status',v_action.verification_status,
   'can_approve',v_review.review_state='PASSED');
end;
$read$;
revoke all on function public.get_bayanihan_ai_review_v4(uuid)
 from public,anon,authenticated;
grant execute on function public.get_bayanihan_ai_review_v4(uuid) to authenticated;

create or replace function public.claim_approved_bayanihan_v4(p_action_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $award$
declare
 v_actor uuid:=(select auth.uid());
 v_action public.buklod_formation_bayanihan_actions%rowtype;
 v_review public.buklod_bayanihan_photo_reviews_v4%rowtype;
 v_count integer;
 v_points integer;
 v_ledger uuid;
 v_day date:=(now() at time zone 'Asia/Manila')::date;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 select * into v_action from public.buklod_formation_bayanihan_actions a
 where a.id=p_action_id for update;
 if v_action.id is null or v_action.stage_code<>106 then
   raise exception 'No eligible Bayanihan action';end if;
 -- A Cluster reviewer with actual authority, or System Admin, must finalize
 -- the old canonical formation action; no self-approval and no anonymous calls.
 if v_action.verification_status<>'verified' or v_action.verified_by is null
   or v_action.verified_by=v_action.member_id then
   return jsonb_build_object('status','waiting_for_cluster_approval','awarded_points',0);
 end if;
 if v_actor<>v_action.verified_by and not public.is_system_admin() then
   raise exception 'Only the approving reviewer can finalize the reward' using errcode='42501';
 end if;
 if not public.buklod_formation_can_authorize_repeat(v_action.member_id)
   and not public.is_system_admin() then
   raise exception 'Reviewer is not authorized for this member' using errcode='42501';
 end if;
 select * into v_review from public.buklod_bayanihan_photo_reviews_v4
 where action_id=p_action_id;
 if v_review.review_state is distinct from 'PASSED' or
   v_review.member_id<>v_action.member_id or
   v_action.evidence_url is distinct from
     ('storage:buklod-bayanihan-evidence/'||v_review.photo_storage_path)
 then
   return jsonb_build_object('status','waiting_for_ai_photo_review','awarded_points',0);
 end if;
 if coalesce(length(trim(v_action.description)),0)<50 or
    coalesce(length(trim(v_action.reflection_text)),0)<30 or
    nullif(v_action.scope_metadata->>'action_date','') is null or
    nullif(v_action.scope_metadata->>'beneficiary_kind','') is null or
    nullif(v_action.scope_metadata->>'beneficiary_description','') is null then
   return jsonb_build_object('status','missing_action_information','awarded_points',0);
 end if;
 if private.buklod_is_platform_official_v1(v_action.member_id) then
   return jsonb_build_object('status','official_excluded','awarded_points',0);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('buklod-bayanihan-v4'),
   pg_catalog.hashtext(v_action.member_id::text));
 if exists(select 1 from public.buklod_points_ledger l
   where l.user_id=v_action.member_id and
     l.source_key='bayanihan:v4:'||p_action_id::text) then
   return jsonb_build_object('status','already_credited','awarded_points',0);
 end if;
 select count(*)::integer into v_count from public.buklod_points_ledger l
 where l.user_id=v_action.member_id and l.activity_type='bayanihan_verified_action'
 and l.direction='credit' and (l.created_at at time zone 'Asia/Manila')::date=v_day;
 if v_count>=2 then
   return jsonb_build_object('status','daily_reward_limit','awarded_points',0);
 end if;
 select r.base_points into v_points from public.buklod_point_rules r
 where r.activity_type='bayanihan_verified_action' and r.is_active=true
 and r.base_points=50 and r.max_points_per_event>=50;
 if v_points is null then
   return jsonb_build_object('status','reward_rule_unavailable','awarded_points',0);
 end if;
 insert into public.buklod_points_ledger(
    user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
 values(v_action.member_id,'credit',v_points,'bayanihan_verified_action',
        'bayanihan:v4:'||p_action_id::text,p_action_id,
        'AI screened and Cluster-approved Bayanihan action',v_actor)
 on conflict(user_id,source_key) do nothing returning id into v_ledger;
 return jsonb_build_object('status',case when v_ledger is null
   then 'already_credited' else 'credited' end,
   'awarded_points',case when v_ledger is null then 0 else v_points end,
   'claim_state','pending');
end;
$award$;
revoke all on function public.claim_approved_bayanihan_v4(uuid)
 from public,anon,authenticated;
grant execute on function public.claim_approved_bayanihan_v4(uuid) to authenticated;
update public.buklod_point_rules
set is_active=true,updated_at=now()
where activity_type='bayanihan_verified_action' and base_points=50;
comment on table public.buklod_bayanihan_photo_reviews_v4 is
 'Server-only Gemini image relevance screening, never photographic authenticity guarantee; final Cluster Admin reviewer required.';
