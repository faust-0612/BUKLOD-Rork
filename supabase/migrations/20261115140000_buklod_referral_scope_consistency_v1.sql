-- 2026-11-15 BUKLOD referral/scope consistency. Finance release flags stay unchanged.
-- Canonical public suggestion; historical aliases remain valid inputs, never displayed.
CREATE OR REPLACE FUNCTION public.suggest_buklod_referral_targets_v1(p_query text, p_limit integer DEFAULT 8)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $f$
DECLARE v_q text:=lower(trim(coalesce(p_query,'')));
v_code text:=upper(regexp_replace(trim(coalesce(p_query,'')),'[^A-Za-z0-9]','','g'));
v_items jsonb:='[]'::jsonb;
BEGIN
 IF length(v_q)<2 OR length(v_q)>80 THEN RETURN jsonb_build_object('ok',true,'query',v_q,'items','[]'::jsonb); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('username',q.username,'label',q.label,
   'referral_code',q.referral_code,'canonical_referral_code',q.referral_code,
   'match_kind',q.match_kind,'identity_ready',q.identity_ready) ORDER BY q.score,q.label),'[]'::jsonb)
 INTO v_items FROM (
  SELECT p.username,
   coalesce(nullif(trim(p.username),''),nullif(trim(p.full_name),''),'BUKLOD member') label,
   coalesce(c.referral_code,l.referral_code) referral_code,
   (c.referral_code IS NOT NULL) identity_ready,
   CASE WHEN upper(c.referral_code)=v_code OR upper(coalesce(l.referral_code,''))=v_code THEN 'code'
     WHEN lower(coalesce(p.username,''))=v_q THEN 'username_exact'
     WHEN left(lower(coalesce(p.username,'')),length(v_q))=v_q THEN 'username_prefix'
     ELSE 'name' END match_kind,
   CASE WHEN upper(c.referral_code)=v_code OR upper(coalesce(l.referral_code,''))=v_code THEN 0
     WHEN lower(coalesce(p.username,''))=v_q THEN 1
     WHEN left(lower(coalesce(p.username,'')),length(v_q))=v_q THEN 2 ELSE 3 END score
  FROM public.profiles p
  LEFT JOIN private.buklod_pf_persons f ON f.current_user_id=p.id
  LEFT JOIN public.buklod_referral_codes_v2 c ON c.person_id=f.person_id AND c.is_active
  LEFT JOIN public.buklod_user_referral_codes l ON l.user_id=p.id
  WHERE p.is_active=true AND p.user_deactivated_at IS NULL
    AND (c.referral_code IS NOT NULL OR l.referral_code IS NOT NULL)
    AND (upper(c.referral_code)=v_code OR upper(coalesce(l.referral_code,''))=v_code
      OR lower(coalesce(p.username,''))=v_q
      OR left(lower(coalesce(p.username,'')),length(v_q))=v_q
      OR position(v_q IN lower(coalesce(p.full_name,'')))>0)
  ORDER BY score,label LIMIT least(greatest(coalesce(p_limit,8),1),12)
 ) q;
 RETURN jsonb_build_object('ok',true,'query',v_q,'items',v_items);
END $f$;

-- Serialize attribution for one registrant and refuse changing an existing referrer.
CREATE OR REPLACE FUNCTION public.buklod_record_referral_verified_v2(p_referrer_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$
DECLARE v_user uuid:=(select auth.uid()); v_owner uuid; v_ref uuid; v_existing uuid; v_resolved jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT p.id INTO v_owner FROM public.profiles p WHERE p.id=v_user AND p.is_active
   AND p.user_deactivated_at IS NULL FOR UPDATE;
 IF v_owner IS NULL THEN RAISE EXCEPTION 'Active account required'; END IF;
 v_resolved:=public.resolve_buklod_referral_target_v1(p_referrer_code);
 IF coalesce((v_resolved->>'found')::boolean,false)<>true THEN RAISE EXCEPTION 'Invalid referral'; END IF;
 v_ref:=(v_resolved->>'user_id')::uuid;
 IF v_ref=v_user THEN RAISE EXCEPTION 'Self-referral is not allowed'; END IF;
 SELECT r.referrer_id INTO v_existing FROM public.buklod_referrals r WHERE r.referred_id=v_user;
 IF FOUND THEN
   IF v_existing IS DISTINCT FROM v_ref THEN RAISE EXCEPTION 'Another referrer is already locked'; END IF;
   RETURN jsonb_build_object('ok',true,'idempotent',true);
 END IF;
 PERFORM public.buklod_record_referral_v1(p_referrer_code);
 RETURN jsonb_build_object('ok',true,'idempotent',false);
END $f$;
REVOKE ALL ON FUNCTION public.buklod_record_referral_verified_v2(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_record_referral_verified_v2(text) TO authenticated,service_role;

-- List only the signed-in person's active Organization/Cluster memberships.
CREATE OR REPLACE FUNCTION public.get_my_buklod_community_destinations_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $f$
DECLARE v_user uuid:=(select auth.uid()); v_items jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('scope_id',x.id,'name',x.name,
   'scope_type',x.scope_type) ORDER BY x.priority,x.name),'[]'::jsonb)
 INTO v_items FROM (
 SELECT s.id,s.name,s.scope_type,CASE WHEN s.scope_type='CLUSTER' THEN 0 ELSE 1 END priority
 FROM public.buklod_scope_memberships m
 JOIN public.buklod_scopes s ON s.id=m.scope_id
 WHERE m.user_id=v_user AND m.membership_status='ACTIVE'
   AND s.scope_type IN ('CLUSTER','ORGANIZATION')
   AND s.status='ACTIVE' AND s.archived_at IS NULL
 ORDER BY priority,s.name LIMIT 50
 ) x;
 RETURN jsonb_build_object('ok',true,'items',v_items);
END $f$;
REVOKE ALL ON FUNCTION public.get_my_buklod_community_destinations_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_buklod_community_destinations_v1() TO authenticated,service_role;

-- Selecting a destination does not accrue points, revenue, or cash. Server enforces switch lock.
CREATE OR REPLACE FUNCTION public.set_my_buklod_community_destination_v1(p_scope_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $f$
DECLARE v_user uuid:=(select auth.uid()); v_person uuid;
 v_previous private.buklod_pf_community_designations%rowtype;
 v_new uuid; v_days int; v_now timestamptz:=now(); v_until timestamptz;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_scope_id IS NULL THEN RAISE EXCEPTION 'Destination is required'; END IF;
 SELECT f.person_id INTO v_person FROM private.buklod_pf_persons f
 JOIN public.profiles p ON p.id=f.current_user_id
 WHERE f.current_user_id=v_user AND p.is_active AND p.user_deactivated_at IS NULL
 FOR UPDATE OF f;
 IF v_person IS NULL THEN RAISE EXCEPTION 'Finance identity not ready'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.buklod_scope_memberships m
   JOIN public.buklod_scopes s ON s.id=m.scope_id
   WHERE m.user_id=v_user AND m.scope_id=p_scope_id AND m.membership_status='ACTIVE'
     AND s.scope_type IN ('CLUSTER','ORGANIZATION') AND s.status='ACTIVE'
     AND s.archived_at IS NULL) THEN
   RAISE EXCEPTION 'Choose an active Organization or Cluster you belong to';
 END IF;
 SELECT * INTO v_previous FROM private.buklod_pf_community_designations d
   WHERE d.person_id=v_person AND d.effective_to IS NULL FOR UPDATE;
 IF FOUND THEN
   IF v_previous.scope_id=p_scope_id THEN
     RETURN jsonb_build_object('ok',true,'idempotent',true,'scope_id',p_scope_id,
       'locked_until',v_previous.locked_until);
   END IF;
   IF v_previous.locked_until>v_now THEN
     RAISE EXCEPTION 'Destination is locked until %',v_previous.locked_until;
   END IF;
 END IF;
 SELECT least(greatest(coalesce(c.community_switch_lock_days,30),0),365)
 INTO v_days FROM private.buklod_pf_config c WHERE c.singleton;
 IF v_days IS NULL THEN RAISE EXCEPTION 'Destination policy unavailable'; END IF;
 v_until:=v_now+make_interval(days=>v_days);
 IF v_previous.id IS NOT NULL THEN
   UPDATE private.buklod_pf_community_designations
   SET effective_to=v_now,close_reason='USER_SWITCH'
   WHERE id=v_previous.id AND effective_to IS NULL;
 END IF;
 INSERT INTO private.buklod_pf_community_designations
  (person_id,scope_id,effective_from,locked_until,previous_designation_id,policy_version,metadata)
 SELECT v_person,p_scope_id,v_now,v_until,v_previous.id,c.policy_version,
   jsonb_build_object('source','MEMBER_SELECTION','cash_generated',false)
 FROM private.buklod_pf_config c WHERE c.singleton
 RETURNING id INTO v_new;
 RETURN jsonb_build_object('ok',true,'designation_id',v_new,'scope_id',p_scope_id,
   'locked_until',v_until,'idempotent',false);
END $f$;
REVOKE ALL ON FUNCTION public.set_my_buklod_community_destination_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_my_buklod_community_destination_v1(uuid) TO authenticated,service_role;

-- Recover only provable, non-official, identity-mapped legacy sign-up relationships.
-- The existing Official guard MUST remain intact. These rows remain unqualified PENDING.
WITH candidates AS (
 SELECT l.id legacy_id,l.created_at signup_at,ref.person_id ref_person,
  invited.person_id invited_person,canonical.referral_code code,
  old.referral_code old_code,cfg.one_time_referral_centavos reward,
  cfg.referred_qualification_centavos threshold,cfg.policy_version policy
 FROM public.buklod_referrals l
 JOIN public.profiles a ON a.id=l.referrer_id AND a.is_active=true AND a.user_deactivated_at IS NULL
 JOIN public.profiles b ON b.id=l.referred_id AND b.is_active=true AND b.user_deactivated_at IS NULL
 JOIN private.buklod_pf_persons ref ON ref.current_user_id=l.referrer_id
 JOIN private.buklod_pf_persons invited ON invited.current_user_id=l.referred_id
 JOIN public.buklod_referral_codes_v2 canonical ON canonical.person_id=ref.person_id AND canonical.is_active
 JOIN public.buklod_user_referral_codes old ON old.user_id=l.referrer_id
 CROSS JOIN private.buklod_pf_config cfg
 WHERE lower(l.status)='pending' AND l.referrer_id<>l.referred_id
  AND ref.person_id<>invited.person_id
  AND NOT private.buklod_official_finance_person_v1(ref.person_id)
  AND NOT private.buklod_official_finance_person_v1(invited.person_id)
  AND NOT EXISTS (SELECT 1 FROM private.buklod_pf_referrals r WHERE r.referred_person_id=invited.person_id)
  AND NOT EXISTS (SELECT 1 FROM private.buklod_pf_referrals r
       WHERE r.referred_person_id=ref.person_id AND r.referrer_person_id=invited.person_id)
), inserted AS (
 INSERT INTO private.buklod_pf_referrals
  (referrer_person_id,referred_person_id,original_referral_code,status,
   one_time_reward_centavos,qualification_threshold_centavos,policy_version,
   relationship_locked_at,created_at,metadata)
 SELECT ref_person,invited_person,code,'PENDING',reward,threshold,policy,signup_at,signup_at,
   jsonb_build_object('source','LEGACY_SIGNUP','legacy_referral_id',legacy_id,
     'legacy_code',old_code,'qualification_not_inferred',true,'cash_generated',false)
 FROM candidates
 ON CONFLICT DO NOTHING
 RETURNING referral_id,referrer_person_id,referred_person_id
)
INSERT INTO private.buklod_pf_referral_events
 (actor_person_id,referral_id,event_type,event_key,metadata)
SELECT referred_person_id,referral_id,'REFERRAL_ATTRIBUTED_HISTORICAL',
  'historical-recovered:'||referral_id::text,
  jsonb_build_object('source','LEGACY_SIGNUP','financially_qualified',false,'credited_php',0)
FROM inserted ON CONFLICT DO NOTHING;
