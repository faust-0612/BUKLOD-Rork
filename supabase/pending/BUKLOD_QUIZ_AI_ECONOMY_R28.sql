-- R28 private, bounded, service-only suggestion cache and provider quota circuit breaker.
CREATE TABLE private.buklod_quiz_ai_cache_r28(cache_key text PRIMARY KEY CHECK(cache_key ~ '^[0-9a-f]{64}$'), score numeric NOT NULL CHECK(score>=0 AND score::text NOT IN ('NaN','Infinity','-Infinity')), feedback text NOT NULL CHECK(length(feedback)<=350), confidence numeric NOT NULL CHECK(confidence BETWEEN 0 AND 1), model text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days');
ALTER TABLE private.buklod_quiz_ai_cache_r28 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.buklod_quiz_ai_cache_r28 FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX buklod_quiz_ai_cache_r28_expiry ON private.buklod_quiz_ai_cache_r28(expires_at);
CREATE TABLE private.buklod_quiz_ai_gate_r28(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), lease uuid, lease_until timestamptz NOT NULL DEFAULT '-infinity', cooldown_until timestamptz NOT NULL DEFAULT '-infinity');
ALTER TABLE private.buklod_quiz_ai_gate_r28 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.buklod_quiz_ai_gate_r28 FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO private.buklod_quiz_ai_gate_r28(singleton) VALUES(true);
CREATE FUNCTION public.buklod_quiz_ai_cache_read_r28(p_keys text[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('cooldown',g.cooldown_until>now(),'reviews',coalesce((SELECT jsonb_agg(jsonb_build_object('cache_key',c.cache_key,'score',c.score,'feedback',c.feedback,'confidence',c.confidence)) FROM private.buklod_quiz_ai_cache_r28 c WHERE cardinality(p_keys)<=40 AND c.cache_key=ANY(p_keys) AND c.expires_at>now()),'[]'::jsonb)) FROM private.buklod_quiz_ai_gate_r28 g WHERE g.singleton;
$$;
CREATE FUNCTION public.buklod_quiz_ai_claim_r28(p_owner uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l uuid:=gen_random_uuid();
BEGIN
 IF p_owner IS NULL THEN RETURN jsonb_build_object('allowed',false); END IF;
 UPDATE private.buklod_quiz_ai_gate_r28 SET lease=l,lease_until=now()+interval '90 seconds' WHERE singleton AND lease_until<=now() AND cooldown_until<=now();
 RETURN jsonb_build_object('allowed',FOUND,'lease',l);
END $$;
CREATE FUNCTION public.buklod_quiz_ai_release_r28(p_lease uuid,p_quota boolean) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE private.buklod_quiz_ai_gate_r28 SET lease=NULL,lease_until='-infinity',cooldown_until=CASE WHEN p_quota THEN greatest(cooldown_until,now()+interval '5 minutes') ELSE cooldown_until END WHERE singleton AND lease=p_lease;
$$;
CREATE FUNCTION public.buklod_quiz_ai_cache_write_r28(p_rows jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows)>40 OR pg_column_size(p_rows)>65536 THEN RAISE EXCEPTION 'Invalid cache batch'; END IF;
 DELETE FROM private.buklod_quiz_ai_cache_r28 WHERE cache_key IN (SELECT cache_key FROM private.buklod_quiz_ai_cache_r28 WHERE expires_at<=now() ORDER BY expires_at LIMIT 200);
 INSERT INTO private.buklod_quiz_ai_cache_r28(cache_key,score,feedback,confidence,model)
 SELECT r.cache_key,r.score,r.feedback,r.confidence,r.model FROM jsonb_to_recordset(p_rows) r(cache_key text,score numeric,feedback text,confidence numeric,model text)
 ON CONFLICT(cache_key) DO UPDATE SET score=excluded.score,feedback=excluded.feedback,confidence=excluded.confidence,model=excluded.model,expires_at=now()+interval '7 days';
END $$;
REVOKE ALL ON FUNCTION public.buklod_quiz_ai_cache_read_r28(text[]),public.buklod_quiz_ai_claim_r28(uuid),public.buklod_quiz_ai_release_r28(uuid,boolean),public.buklod_quiz_ai_cache_write_r28(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_ai_cache_read_r28(text[]),public.buklod_quiz_ai_claim_r28(uuid),public.buklod_quiz_ai_release_r28(uuid,boolean),public.buklod_quiz_ai_cache_write_r28(jsonb) TO service_role;
