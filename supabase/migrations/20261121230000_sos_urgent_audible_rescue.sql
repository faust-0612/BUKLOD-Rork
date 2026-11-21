-- BUKLOD SOS emergency notification and responder location, DEV only.
-- Apply after RC security review. Do not modify production directly.
BEGIN;

-- Prevent authenticated clients from bypassing anti-abuse, ownership, and
-- expiry enforcement by writing their own raw request/response rows.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.buklod_help_requests,
  public.buklod_help_responses, public.buklod_help_presence
FROM PUBLIC, anon, authenticated;

-- Foreground-only opt-in refresh: never CREATE or re-enable disabled presence.
CREATE OR REPLACE FUNCTION public.buklod_help_refresh_opted_in_presence(
  p_latitude double precision, p_longitude double precision
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (p_latitude BETWEEN -90 AND 90 AND p_longitude BETWEEN -180 AND 180)
    THEN RAISE EXCEPTION 'INVALID_LOCATION'; END IF;
  UPDATE public.buklod_help_presence
    SET latitude=p_latitude, longitude=p_longitude, updated_at=now()
  WHERE user_id=(SELECT auth.uid()) AND safety_alerts_enabled=true;
END;
$$;

-- Declare channel support only when THIS Android installation has created it.
-- A legacy or account-switched token that cannot claim ownership fails closed.
CREATE OR REPLACE FUNCTION public.buklod_help_register_emergency_channel(
  p_expo_push_token text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF length(btrim(coalesce(p_expo_push_token,''))) NOT BETWEEN 8 AND 300
    THEN RAISE EXCEPTION 'INVALID_PUSH_TOKEN'; END IF;
  UPDATE public.device_tokens SET emergency_alert_mode_version=3,updated_at=now()
  WHERE user_id=(SELECT auth.uid()) AND platform='android'
    AND expo_push_token=btrim(p_expo_push_token);
  IF NOT FOUND THEN RAISE EXCEPTION 'TOKEN_NOT_OWNED'; END IF;
END;
$$;

-- A targeted lookup is required because the generic nearby feed is capped.
-- The viewer must be the owner OR have both a canonical recipient notice and
-- fresh enabled nearby presence. Never return exact coordinates here.
CREATE OR REPLACE FUNCTION public.buklod_help_get_emergency_for_viewer(
  p_request_id uuid
) RETURNS TABLE (
  id uuid,creator_id uuid,kind text,category text,message text,status text,
  distance_km double precision,created_at timestamptz,expires_at timestamptz,
  can_help_count bigint,on_my_way_count bigint,confirm_count bigint,my_response text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_request public.buklod_help_requests%ROWTYPE;
  v_lat double precision;
  v_lon double precision;
  v_distance double precision;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_request FROM public.buklod_help_requests r
  WHERE r.id=p_request_id AND r.kind='EMERGENCY' AND r.status='ACTIVE'
    AND r.expires_at>now();
  IF NOT FOUND THEN RETURN; END IF;

  IF v_request.creator_id<>v_uid THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id=v_uid AND n.kind='community_emergency'
        AND n.data->>'help_request_id'=p_request_id::text
    ) THEN RETURN; END IF;
    SELECT p.latitude,p.longitude INTO v_lat,v_lon
    FROM public.buklod_help_presence p
    WHERE p.user_id=v_uid AND p.safety_alerts_enabled=true
      AND p.updated_at>now()-interval '60 minutes';
    IF v_lat IS NULL THEN RETURN; END IF;
    v_distance:=public.buklod_help_distance_km(
      v_lat,v_lon,v_request.latitude,v_request.longitude);
    IF v_distance>LEAST(5.0,v_request.radius_km) THEN RETURN; END IF;
  END IF;

  RETURN QUERY SELECT r.id,r.creator_id,r.kind,r.category,r.message,r.status,
    CASE WHEN r.creator_id=v_uid THEN NULL::double precision
      ELSE round(v_distance::numeric,1)::double precision END,
    r.created_at,r.expires_at,
    (SELECT count(*) FROM public.buklod_help_responses a
      WHERE a.request_id=r.id AND a.response_type='CAN_HELP'),
    (SELECT count(*) FROM public.buklod_help_responses a
      WHERE a.request_id=r.id AND a.response_type='ON_MY_WAY'),
    (SELECT count(*) FROM public.buklod_help_responses a
      WHERE a.request_id=r.id AND a.response_type='CONFIRM_INCIDENT'),
    (SELECT a.response_type FROM public.buklod_help_responses a
      WHERE a.request_id=r.id AND a.responder_id=v_uid)
  FROM public.buklod_help_requests r WHERE r.id=p_request_id;
END;
$$;

-- Raw SOS location is disclosed ONLY after an intentional ON_MY_WAY action.
-- No raw coordinates in general notifications, discovery, or the overlay.
CREATE OR REPLACE FUNCTION public.buklod_help_get_rescue_coordinates(
  p_request_id uuid
) RETURNS TABLE(latitude double precision,longitude double precision)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid:=(SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN QUERY
  SELECT r.latitude,r.longitude
  FROM public.buklod_help_requests r
  JOIN public.buklod_help_responses response
    ON response.request_id=r.id AND response.responder_id=v_uid
   AND response.response_type='ON_MY_WAY'
   AND response.updated_at>now()-interval '90 minutes'
  JOIN public.buklod_help_presence p
    ON p.user_id=v_uid AND p.safety_alerts_enabled=true
   AND p.updated_at>now()-interval '60 minutes'
  WHERE r.id=p_request_id AND r.kind='EMERGENCY'
    AND r.status='ACTIVE' AND r.expires_at>now() AND r.creator_id<>v_uid
    AND public.buklod_help_distance_km(
      p.latitude,p.longitude,r.latitude,r.longitude
    ) <= LEAST(5.0,r.radius_km)
    AND EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id=v_uid AND n.kind='community_emergency'
        AND n.data->>'help_request_id'=r.id::text
    );
END;
$$;

REVOKE ALL ON FUNCTION public.buklod_help_refresh_opted_in_presence(
  double precision,double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buklod_help_register_emergency_channel(text)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buklod_help_get_emergency_for_viewer(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.buklod_help_get_rescue_coordinates(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buklod_help_refresh_opted_in_presence(
  double precision,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_help_register_emergency_channel(text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_help_get_emergency_for_viewer(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_help_get_rescue_coordinates(uuid)
  TO authenticated;
COMMIT;
