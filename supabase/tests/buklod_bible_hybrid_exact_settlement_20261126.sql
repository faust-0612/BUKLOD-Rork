-- Run against isolated test database after queue migration; no fixture writes.
do $test$
declare c record; actual int;
begin
 for c in select * from (values
 ('reported','["readiness of mind","Searching scripture"]'::jsonb,'[["readiness of mind"],["searching scripture"]]'::jsonb,2),
 ('same concept','["readiness of mind","bukas ang isipan"]','[["readiness of mind","bukas ang isipan"],["searching scripture"]]',1),
 ('negated','["not readiness of mind","not searching scripture"]','[["readiness of mind"],["searching scripture"]]',0),
 ('ambiguous','["a","b"]','[["a","b"],["a"]]',2),
 ('one field','["a","wrong"]','[["a"],["a"]]',1),
 ('reversed','["Searching scripture","readiness of mind"]','[["readiness of mind"],["searching scripture"]]',2),
 ('duplicate','["readiness of mind","Readiness of mind"]','[["readiness of mind"],["searching scripture"]]',0)
 ) t(label,ans,groups,want) loop
 actual:=private.buklod_bible_hybrid_exact_units(jsonb_build_object('kind','enumeration','groups',c.groups),c.ans);
 if actual<>c.want then raise exception 'Exact grade mismatch: %',c.label;end if;
 end loop;
 if private.buklod_bible_hybrid_exact_units('{"kind":"identification","groups":[["Pedro","Peter"]]}'::jsonb,'"Peter"'::jsonb)<>2 then raise exception 'Identification failed';end if;
 if has_function_privilege('anon','public.buklod_bible_hybrid_settle_exact()','EXECUTE') or has_function_privilege('authenticated','public.buklod_bible_hybrid_settle_exact()','EXECUTE') then raise exception 'Settlement privilege regression';end if;
end;
$test$;
