-- Read-only post-migration database identity/privacy contract assertions.
do $wall_avatar_privacy_guard$
declare
  definition text;
  output_columns text;
begin
  select pg_get_functiondef('public.get_buklod_profile_avatars_v1(uuid[])'::regprocedure),
         pg_get_function_result('public.get_buklod_profile_avatars_v1(uuid[])'::regprocedure)
    into definition,output_columns;
  if definition is null or output_columns is null then
    raise exception 'Avatar lookup RPC is missing';
  end if;
  if position('select p.id, p.avatar_url' in lower(definition)) = 0
    or position('auth.uid()' in lower(definition)) = 0
    or position('p.is_active = true' in lower(definition)) = 0
    or lower(definition) ~ 'is_verified|profile_locked|quick_note|email'
  then raise exception 'Wall avatar RPC must expose only photos of active accounts to signed-in viewers'; end if;
  if output_columns <> 'TABLE(user_id uuid, avatar_url text)' then
    raise exception 'Wall avatar RPC response contains more than user ID and avatar URL: %', output_columns;
  end if;
  if not has_function_privilege('authenticated','public.get_buklod_profile_avatars_v1(uuid[])','execute')
    or has_function_privilege('anon','public.get_buklod_profile_avatars_v1(uuid[])','execute')
  then raise exception 'Wall avatar API access grants are unsafe'; end if;
end;
$wall_avatar_privacy_guard$;
