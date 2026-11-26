-- Isolated fixture only; all accounts and reward rows are fictional.
begin;
do $test$
declare member uuid:='00000000-0000-0000-0000-000000000001'; other_member uuid:='00000000-0000-0000-0000-000000000002'; administrator uuid:='00000000-0000-0000-0000-000000000003';
 r jsonb; i text; first_id text; second_id text; note text:='Fictional fixture review only. Not theological publication approval.';
 reflection text:='Natutuhan kong ang pananampalataya ay nangangailangan ng katapatan, kabutihan, paggalang at pagmamahal sa kapwa araw-araw.';
 blocks jsonb:='[{"kind":"heading","text":"Fixture test heading"},{"kind":"body","text":"Fictional study material for database test only."}]'; opts text[]:=array['Option Alpha','Option Bravo','Option Charlie','Option Delta'];
begin
 perform set_config('request.jwt.claim.sub',member::text,true);
 begin perform public.buklod_abc_doctrine_admin_list_v2(null); raise exception 'Unauthorized editor list accepted'; exception when insufficient_privilege then null; end;
 begin perform public.complete_my_abc_doctrinal_lesson_v1('doctrine-0001','B',reflection); raise exception 'Draft completion accepted'; exception when raise_exception then if SQLERRM<>'Lesson is not published' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',administrator::text,true);
 begin perform public.buklod_abc_doctrine_admin_publication_v1('doctrine-0002',true,note); raise exception 'Out-of-order publication accepted'; exception when raise_exception then if SQLERRM not like 'Prerequisite must be published first%' then raise; end if; end;
 foreach i in array array['doctrine-0001','doctrine-0002','doctrine-0003','doctrine-0004'] loop
   perform public.buklod_abc_doctrine_admin_publication_v1(i,true,note);
 end loop;
 begin perform public.buklod_abc_doctrine_admin_publication_v1('doctrine-0001',false,note); raise exception 'Published dependent broken'; exception when raise_exception then if SQLERRM not like 'Unpublish dependent lessons%' then raise; end if; end;
 -- Test ID rollover and numeric prerequisite ordering.
 perform setval('private.buklod_abc_doctrine_id_seq',9998,true);
 r:=public.buklod_abc_doctrine_admin_save_v1(null,'fixture-series','Fixture Series',1,'F1','Fixture Lesson One','foundation','doctrine-0004',blocks,'Which option is correct in the fixture?',opts,'A'); first_id:=r->>'lesson_id';
 r:=public.buklod_abc_doctrine_admin_save_v1(null,'fixture-series','Fixture Series',2,'F2','Fixture Lesson Two','foundation',first_id,blocks,'Which option is correct in the fixture?',opts,'A'); second_id:=r->>'lesson_id';
 if first_id<>'doctrine-9999' or second_id<>'doctrine-10000' then raise exception 'ID rollover failed: %, %',first_id,second_id; end if;
 perform public.buklod_abc_doctrine_admin_publication_v1(first_id,true,note);
 perform public.buklod_abc_doctrine_admin_publication_v1(second_id,true,note);
 perform public.buklod_abc_doctrine_admin_publication_v1(second_id,false,note);
 begin perform public.buklod_abc_doctrine_admin_save_v1(second_id,'fixture-series','Fixture Series',2,'F2','Modified Fixture Lesson','foundation',first_id,blocks,'Which option is correct in the fixture?',opts,'A'); raise exception 'Formerly published revision accepted'; exception when raise_exception then if SQLERRM not like 'Published lessons are immutable%' then raise; end if; end;
 if public.buklod_abc_doctrine_admin_list_v2(null)->0->>'lesson_id' <> second_id then raise exception 'Numeric page order failed'; end if;
 if not ((public.buklod_abc_doctrine_admin_list_v2(null)->0->>'content_locked')::boolean) then raise exception 'Editor immutable flag missing'; end if;
 if exists(select 1 from jsonb_array_elements(public.buklod_abc_doctrine_admin_list_v2(second_id)) x where x->>'lesson_id'=second_id) then raise exception 'Cursor duplicate'; end if;
 perform set_config('request.jwt.claim.sub',member::text,true);
 begin perform public.complete_my_abc_doctrinal_lesson_v1('doctrine-0001','B',reflection); raise exception 'Prerequisite bypass'; exception when raise_exception then if SQLERRM not like 'Complete the preceding%' then raise; end if; end;
 perform public.complete_my_abc_growth_lesson_v1('lesson-26');
 for j in 1..3 loop
   r:=public.complete_my_abc_doctrinal_lesson_v1('doctrine-0001','A',reflection);
   if r->>'reason'<>'quiz_incorrect' then raise exception 'Wrong quiz not rejected'; end if;
 end loop;
 r:=public.complete_my_abc_doctrinal_lesson_v1('doctrine-0001','B',reflection);
 if r->>'reason'<>'quiz_cooldown' then raise exception 'Cooldown bypass'; end if;
 update private.buklod_abc_doctrine_quiz_attempts set blocked_until=now()-interval '1 second' where user_id=member;
 r:=public.complete_my_abc_doctrinal_lesson_v1('doctrine-0001','B',reflection);
 if r->>'points'<>'12' or r->>'claim_state'<>'pending' then raise exception 'Intermediate pending award failed: %',r; end if;
 r:=public.complete_my_abc_doctrinal_lesson_v1('doctrine-0001','B',reflection);
 if r->>'already_completed'<>'true' then raise exception 'Duplicate failed'; end if;
 begin perform public.complete_my_abc_doctrinal_lesson_v1('doctrine-0002','C',upper(reflection)); raise exception 'Copied reflection accepted'; exception when raise_exception then if SQLERRM not like 'Same reflection already used%' then raise; end if; end;
 r:=public.complete_my_abc_doctrinal_lesson_v1('doctrine-0002','C',reflection||' Pangalawang aralin sa kabanalan.');
 if r->>'points'<>'12' then raise exception 'Second award failed'; end if;
 r:=public.complete_my_abc_doctrinal_lesson_v1('doctrine-0003','D',reflection||' Ikatlong aralin sa biyaya.');
 if r->>'points'<>'18' then raise exception 'Advanced award failed'; end if;
 r:=public.complete_my_abc_doctrinal_lesson_v1('doctrine-0004','A',reflection||' Ikaapat na aralin sa konteksto.');
 if r->>'points'<>'0' or r->>'completed'<>'true' then raise exception 'Daily cap or continuing study failed'; end if;
 r:=public.complete_my_abc_doctrinal_lesson_v1(first_id,'A',reflection||' Ikalimang aralin sa pag-unlad.');
 if r->>'points'<>'8' then raise exception 'Exact daily cap failed'; end if;
 if (select sum(points) from public.buklod_points_ledger where user_id=member and source_key like 'abc_growth:v1:doctrine-%')<>50 then raise exception 'Cap sum mismatch'; end if;
 if (select count(*) from public.buklod_points_ledger where user_id=member and source_key='abc_growth:v1:doctrine-0001')<>1 then raise exception 'Duplicate ledger'; end if;
 perform set_config('request.jwt.claim.sub',other_member::text,true);
 if exists(select 1 from public.get_my_abc_growth_progress_v1()) then raise exception 'Other account progress exposed'; end if;
 perform set_config('request.jwt.claim.sub',administrator::text,true);
 -- Seed prerequisite without awarding the official account any legacy credits.
 insert into public.buklod_abc_growth_progress(user_id,lesson_id,source_key) values(administrator,'lesson-26','abc_growth:v1:lesson-26');
 r:=public.complete_my_abc_doctrinal_lesson_v1('doctrine-0001','B',reflection);
 if r->>'points'<>'0' or r->>'completed'<>'true' then raise exception 'Official admin reward exclusion failed'; end if;
 if has_function_privilege('anon','public.buklod_abc_doctrine_admin_list_v2(text)','EXECUTE') then raise exception 'Anonymous editor access'; end if;
end;
$test$;
-- Check catalog metadata as the fixture owner, before switching to a restricted role.
do $acl_check$ begin
 if has_table_privilege('authenticated','private.buklod_abc_doctrinal_answers','SELECT') then raise exception 'Answer key SELECT grant exposed'; end if;
end $acl_check$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $acl_check$ begin
 if not exists(select 1 from public.buklod_abc_doctrinal_lessons where published) then raise exception 'Published catalog inaccessible to member'; end if;
 if exists(select 1 from public.buklod_abc_doctrinal_lessons where not published) then raise exception 'Unpublished catalog leaked via RLS'; end if;
 -- Exercise actual forbidden access rather than resolving a private relation name
 -- with has_table_privilege under a role that correctly lacks schema USAGE.
 begin
   execute 'select 1 from private.buklod_abc_doctrinal_answers limit 1';
   raise exception 'Answer key readable by ordinary member';
 exception when insufficient_privilege then
   null; -- SQLSTATE 42501 is the expected security boundary.
 end;
end $acl_check$;
reset role;
rollback;
