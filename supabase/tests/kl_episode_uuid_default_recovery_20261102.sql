-- Read-only schema contract: all authorized KL chapter creation paths must
-- receive a database-generated UUID when their INSERT omits the id column.
DO $kl_uuid_default_test$
DECLARE default_expression text;
BEGIN
  SELECT pg_get_expr(d.adbin, d.adrelid)
  INTO default_expression
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = 'public' AND c.relname = 'kl_episodes' AND a.attname = 'id';

  IF default_expression IS NULL OR default_expression NOT LIKE '%gen_random_uuid()%' THEN
    RAISE EXCEPTION 'KL chapter UUID default is missing or incorrect';
  END IF;
END
$kl_uuid_default_test$;
