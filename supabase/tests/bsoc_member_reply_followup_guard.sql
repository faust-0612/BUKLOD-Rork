-- Cheap live introspection contract; never inserts member messages or sends pushes.
do $test$
declare body text;
begin
  select pg_get_functiondef(p.oid) into body
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='bsoc_ai_member_reply_followup_v1';
  if body is null then raise exception 'member reply trigger function missing'; end if;
  if position('member_id<>new.sender_id' in body)=0 then
    raise exception 'cross-account sender guard missing';
  end if;
  if position('state=''NEEDS_DETAILS''' in body)=0 then
    raise exception 'followup must not reset an unrelated support state';
  end if;
  if position('update public.user_feedback' in lower(body))>0 then
    raise exception 'member reply automation must not mutate canonical case status';
  end if;
  if not exists(select 1 from pg_trigger t
      join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='bsoc_case_messages'
        and t.tgname='bsoc_ai_member_reply_followup_v1'
        and t.tgenabled='O') then
    raise exception 'member followup trigger missing or disabled';
  end if;
end;
$test$;
select 'PASS: member reply owner guard, bounded state transition and active trigger' as result;
