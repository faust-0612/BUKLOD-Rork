-- Read-only test of the 24-hour Connect Note reaction production contract.
do $verify_buklod_note_reactions$
declare
  getter text;
  setter text;
  rls_on boolean;
begin
  if to_regclass('public.buklod_connect_note_reactions') is null then
    raise exception 'Connect Note reaction table missing';
  end if;
  select relrowsecurity into rls_on from pg_class
    where oid = 'public.buklod_connect_note_reactions'::regclass;
  if not rls_on then raise exception 'Note reactions require row-level security'; end if;
  if has_table_privilege('anon','public.buklod_connect_note_reactions','SELECT')
    or has_table_privilege('authenticated','public.buklod_connect_note_reactions','SELECT')
    or has_table_privilege('authenticated','public.buklod_connect_note_reactions','INSERT')
  then raise exception 'Direct Note reaction table access is not permitted'; end if;

  if has_function_privilege('anon','public.get_buklod_connect_note_reactions_v1(uuid[])','execute')
    or has_function_privilege('anon','public.set_buklod_connect_note_reaction_v1(uuid,text)','execute')
    or not has_function_privilege('authenticated','public.get_buklod_connect_note_reactions_v1(uuid[])','execute')
    or not has_function_privilege('authenticated','public.set_buklod_connect_note_reaction_v1(uuid,text)','execute')
  then raise exception 'Note reaction API role grants are unsafe'; end if;

  select pg_get_functiondef('public.get_buklod_connect_note_reactions_v1(uuid[])'::regprocedure),
    pg_get_functiondef('public.set_buklod_connect_note_reaction_v1(uuid,text)'::regprocedure)
    into getter, setter;
  if position('auth.uid()' in getter) = 0
    or position('auth.uid()' in setter) = 0
    or position('note_revision' in getter) = 0
    or position('note_revision' in setter) = 0
    or position('quick_note_expires_at' in getter) = 0
    or position('quick_note_expires_at' in setter) = 0
    or position('p_owner_id = v_actor' in setter) = 0
    or position('pg_advisory_xact_lock' in setter) = 0
  then raise exception 'Note reaction revision, self-guard, auth or serialization missing'; end if;
end;
$verify_buklod_note_reactions$;
