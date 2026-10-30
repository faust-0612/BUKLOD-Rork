-- Read-only verification. Run after the production migration.
-- The view must preserve its columns but respect the caller's profiles RLS.
DO $profile_card_security_test$
DECLARE
  options text[];
  projection text;
BEGIN
  SELECT reloptions,pg_get_viewdef(oid,true)
    INTO options, projection
    FROM pg_class WHERE oid='public.public_profile_cards'::regclass;
  IF NOT coalesce('security_invoker=true'=ANY(options),false)
     OR NOT coalesce((SELECT relrowsecurity FROM pg_class WHERE oid='public.profiles'::regclass),false)
     OR has_table_privilege('anon','public.public_profile_cards','SELECT')
     OR has_table_privilege('anon','public.public_profile_cards','UPDATE')
     OR has_table_privilege('authenticated','public.public_profile_cards','UPDATE')
     OR NOT has_table_privilege('authenticated','public.public_profile_cards','SELECT')
     OR projection IS NULL OR position('is_active' in projection)=0
  THEN
    RAISE EXCEPTION 'public_profile_cards failed security invariant';
  END IF;

  IF (SELECT array_agg(attname ORDER BY attnum)
      FROM pg_attribute WHERE attrelid='public.public_profile_cards'::regclass
      AND attnum>0 AND NOT attisdropped)
      IS DISTINCT FROM ARRAY['id','full_name','avatar_url','quick_note','church_id']
  THEN
    RAISE EXCEPTION 'public_profile_cards projection changed';
  END IF;
END;
$profile_card_security_test$;
