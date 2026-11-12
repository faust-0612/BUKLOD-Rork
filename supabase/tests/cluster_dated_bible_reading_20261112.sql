begin;
do $bible_secure_test$
declare
  def text;
begin
  select pg_get_functiondef('public.get_automatic_bible_reading_for_cluster(date)'::regprocedure) into def;
  if position('perform 1 from public.get_automatic_bible_today()' in lower(def))=0 or
     position('auth.uid() is null' in lower(def))=0 then
    raise exception 'Daily Bible Cluster membership/auth gate missing';
  end if;
  if not has_function_privilege('authenticated','public.get_automatic_bible_reading_for_cluster(date)','EXECUTE')
     or has_function_privilege('anon','public.get_automatic_bible_reading_for_cluster(date)','EXECUTE') then
    raise exception 'Dated Daily Bible RPC privilege guard incorrect';
  end if;
  if has_function_privilege('authenticated','public.get_automatic_bible_reading(date)','EXECUTE') then
    raise exception 'Lower-level reading calculation must not be publicly exposed';
  end if;
  if position('get_automatic_bible_reading(p_reading_date)' in lower(def))=0 then
    raise exception 'Dated Bible calculation changed';
  end if;
end $bible_secure_test$;
rollback;
