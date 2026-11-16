-- Run against disposable PostgreSQL only, after both additive migrations.
-- Explicit rollback prevents test records becoming part of a release artifact.
begin;
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
insert into private.buklod_character_selection_v2(user_id,character_id)
values
 ('11111111-1111-4111-8111-111111111111','phan'),
 ('22222222-2222-4222-8222-222222222222','phan');
insert into private.buklod_character_public_events_v3(user_id,metric_key,source_table,source_id)
values
 ('11111111-1111-4111-8111-111111111111','character_public_post','community_posts','post-1'),
 ('11111111-1111-4111-8111-111111111111','character_public_comment','community_comments','comment-1'),
 ('11111111-1111-4111-8111-111111111111','character_public_reaction','community_reactions','reaction-1'),
 ('11111111-1111-4111-8111-111111111111','character_public_reaction','community_reactions','reaction-2'),
 ('11111111-1111-4111-8111-111111111111','character_public_share','community_shares','share-1');
-- The triggered ledger must snapshot Phan even when the active Character changes.
update private.buklod_character_selection_v2 set character_id='quin'
 where user_id='11111111-1111-4111-8111-111111111111';
insert into private.buklod_character_public_events_v3(user_id,metric_key,source_table,source_id)
values ('11111111-1111-4111-8111-111111111111','character_public_post','community_posts','post-quin');
do $test$
declare original_count int; switched_count int;
begin
 select count(*) into original_count
 from private.buklod_character_task_events_v1
 where user_id='11111111-1111-4111-8111-111111111111' and character_id='phan';
 select count(*) into switched_count
 from private.buklod_character_task_events_v1
 where user_id='11111111-1111-4111-8111-111111111111' and character_id='quin';
 if original_count<>5 or switched_count<>1 then
   raise exception 'Character switch attributed tasks incorrectly: %/%',original_count,switched_count;
 end if;
end;
$test$;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $test$
declare result jsonb;
begin
 result := public.get_my_buklod_character_story_tasks_v1('phan');
 if (result->>'owned_total')::integer <> 5
  or (result->>'newly_awarded')::integer <> 5 then
  raise exception 'Verified level-one five-slot award failed: %',result;
 end if;
 result := public.get_my_buklod_character_story_tasks_v1('phan');
 if (result->>'newly_awarded')::integer <> 0 then
  raise exception 'Retry minted duplicate Character items';
 end if;
 if (result->'items'->0->>'owned')::boolean is not true then
  raise exception 'Server-granted item not reflected in owned state';
 end if;
 begin
  perform public.get_my_buklod_character_story_tasks_v1('ace');
  raise exception 'Unauthorized Special Character was accessible';
 exception when others then
  if sqlerrm not like '%not unlocked%' then raise; end if;
 end;
end;
$test$;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $test$
declare result jsonb;
begin
 result := public.get_my_buklod_character_story_tasks_v1('phan');
 if (result->>'owned_total')::integer <> 0 then
  raise exception 'Another user can see or claim owner A awards';
 end if;
end;
$test$;
reset role;
reset request.jwt.claim.sub;
do $test$
declare got int;
begin
 select count(*) into got from private.buklod_character_story_awards_v1
 where user_id='11111111-1111-4111-8111-111111111111' and character_id='phan';
 if got<>5 then raise exception 'Expected exactly 5 unique owned slots, got %',got; end if;
end;
$test$;
-- Pending/withdrawn BP credits cannot mint an award; original Character is retained.
insert into public.buklod_points_ledger(id,user_id,direction,points,activity_type,claim_state)
values ('33333333-3333-4333-8333-333333333333',
        '22222222-2222-4222-8222-222222222222','credit',10,'daily_bible','pending');
do $test$ begin
 if exists(select 1 from private.buklod_character_task_events_v1
           where source_table='buklod_points_ledger' and verified=true)
 then raise exception 'Pending BP counted as verified';end if;
end;$test$;
update public.buklod_points_ledger set claim_state='claimed'
where id='33333333-3333-4333-8333-333333333333';
do $test$ begin
 if not exists(select 1 from private.buklod_character_task_events_v1
               where source_table='buklod_points_ledger' and verified=true and character_id='phan')
 then raise exception 'Claimed BP was not verified for its original Character';end if;
end;$test$;
update public.buklod_points_ledger set claim_state='rejected'
where id='33333333-3333-4333-8333-333333333333';
do $test$ begin
 if exists(select 1 from private.buklod_character_task_events_v1
           where source_table='buklod_points_ledger' and verified=true)
 then raise exception 'Rejected BP remained verified';end if;
end;$test$;
rollback;
