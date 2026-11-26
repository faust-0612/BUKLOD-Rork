-- Admin authoring security contract. Run only after staged migrations.
begin;
do $test$
declare
  v_list oid:=to_regprocedure('public.buklod_abc_doctrine_admin_list_v1()');
  v_save oid:=to_regprocedure('public.buklod_abc_doctrine_admin_save_v1(text,text,text,integer,text,text,text,text,jsonb,text,text[],text)');
  v_pub oid:=to_regprocedure('public.buklod_abc_doctrine_admin_publication_v1(text,boolean,text)');
  v_body text;
begin
  if v_list is null or v_save is null or v_pub is null then
    raise exception 'ABaKa admin RPCs missing';
  end if;
  if has_function_privilege('anon',v_list,'EXECUTE') or
     has_function_privilege('anon',v_save,'EXECUTE') or
     has_function_privilege('anon',v_pub,'EXECUTE') or
     not has_function_privilege('authenticated',v_save,'EXECUTE') then
    raise exception 'ABaKa admin RPC privilege regression';
  end if;
  if has_table_privilege('authenticated','private.buklod_abc_doctrinal_answers','SELECT') or
     has_table_privilege('authenticated','private.buklod_abc_doctrine_publication_audit','INSERT') then
    raise exception 'Private answers or publication audit exposed';
  end if;
  foreach v_body in array array[
    pg_get_functiondef(v_list),pg_get_functiondef(v_save),pg_get_functiondef(v_pub)
  ] loop
    if position('buklod_is_system_admin' in v_body)=0 then
      raise exception 'Admin authorization check missing from function';
    end if;
  end loop;
  if position('Published lessons are immutable' in pg_get_functiondef(v_save))=0 or
     position('Prerequisite must be published first' in pg_get_functiondef(v_pub))=0 then
    raise exception 'Immutable content or prerequisite verification missing';
  end if;
end;
$test$;
rollback;