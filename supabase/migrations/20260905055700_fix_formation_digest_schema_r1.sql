-- Formation-only pgcrypto schema qualification.
-- No data mutation; Quiz digest functions intentionally untouched.

create or replace function public.buklod_formation_compute_content_hash(p_text text)
returns text
language sql
immutable
as $function$
  select pg_catalog.encode(
    extensions.digest(coalesce(p_text, ''), 'sha256'),
    'hex'
  );
$function$;
