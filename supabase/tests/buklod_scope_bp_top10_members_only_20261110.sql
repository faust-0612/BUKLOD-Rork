-- Read-only security regression for BUKLOD Scope BP Top 10.
-- Execute against a DB where migration 20261110093333 is installed.
BEGIN;
DO $test$
DECLARE
 v record; v_count integer; v_expected integer; v_leaks integer;
 v_outsider uuid; v_denied boolean; v_scopes_checked integer := 0;
BEGIN
 IF has_function_privilege('anon','public.get_buklod_scope_bp_top10_v1(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'Anon can execute private BP RPC';
 END IF;
 IF NOT has_function_privilege('authenticated','public.get_buklod_scope_bp_top10_v1(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'Authenticated RPC grant missing';
 END IF;
 FOR v IN SELECT DISTINCT ON (s.scope_type)
   s.scope_type, s.id AS scope_id, (array_agg(m.user_id ORDER BY m.joined_at))[1] AS viewer
   FROM public.buklod_scopes s
   JOIN public.buklod_scope_memberships m ON m.scope_id=s.id
   JOIN public.profiles p ON p.id=m.user_id AND p.is_active=true
   WHERE s.scope_type IN ('CLUSTER','ORGANIZATION') AND s.status='ACTIVE'
     AND m.membership_status='ACTIVE' AND m.left_at IS NULL
   GROUP BY s.id,s.scope_type HAVING count(*)>=2
   ORDER BY s.scope_type,count(*) DESC
 LOOP
   v_scopes_checked := v_scopes_checked + 1;
   PERFORM set_config('request.jwt.claim.sub',v.viewer::text,true);
   SELECT least(10,count(*)) INTO v_expected
   FROM public.buklod_scope_memberships m JOIN public.profiles p ON p.id=m.user_id
   WHERE m.scope_id=v.scope_id AND m.membership_status='ACTIVE'
     AND m.left_at IS NULL AND p.is_active=true;
   SELECT count(*) INTO v_count FROM public.get_buklod_scope_bp_top10_v1(v.scope_id);
   IF v_count<>v_expected THEN RAISE EXCEPTION 'Incorrect Top10 size for %',v.scope_type; END IF;
   SELECT count(*) INTO v_leaks FROM public.get_buklod_scope_bp_top10_v1(v.scope_id) r
   WHERE NOT EXISTS(SELECT 1 FROM public.buklod_scope_memberships m
     WHERE m.scope_id=v.scope_id AND m.user_id=r.user_id
       AND m.membership_status='ACTIVE' AND m.left_at IS NULL);
   IF v_leaks<>0 THEN RAISE EXCEPTION 'Unrelated user leaked in %',v.scope_type; END IF;
   SELECT p.id INTO v_outsider FROM public.profiles p WHERE p.is_active=true
      AND NOT EXISTS (SELECT 1 FROM public.buklod_scope_memberships m WHERE m.scope_id=v.scope_id
        AND m.user_id=p.id AND m.membership_status='ACTIVE' AND m.left_at IS NULL) LIMIT 1;
   IF v_outsider IS NULL THEN RAISE EXCEPTION 'Outsider fixture unavailable'; END IF;
   PERFORM set_config('request.jwt.claim.sub',v_outsider::text,true);
   v_denied:=false;
   BEGIN PERFORM * FROM public.get_buklod_scope_bp_top10_v1(v.scope_id);
   EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
   IF NOT v_denied THEN RAISE EXCEPTION 'Outsider was allowed in %',v.scope_type; END IF;
 END LOOP;
 IF v_scopes_checked<>2 THEN RAISE EXCEPTION 'Expected both scope types, got %',v_scopes_checked; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 v_denied:=false;
 BEGIN PERFORM * FROM public.get_buklod_scope_bp_top10_v1(
     (SELECT id FROM public.buklod_scopes WHERE scope_type='CLUSTER' AND status='ACTIVE' LIMIT 1));
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Anonymous viewer was allowed'; END IF;
END $test$;
ROLLBACK;
