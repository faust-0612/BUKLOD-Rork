-- Forward-only notification hooks for the remaining canonical Faith Monitoring v2 metrics.
-- Scope membership is evaluated server-side. Personal completions are not described as cluster submissions.
-- No reward, approval, evidence, or historical rows are modified.
create or replace function private.buklod_notify_faith_accomplishment_v1(
 p_user uuid,p_kind text,p_item text,p_activity text,p_verb text,p_at timestamptz,
 p_scope uuid default null,p_peer uuid default null
) returns void language plpgsql security definer set search_path='' as $fn$
declare v_scope record; v_admin uuid; v_name text; v_key text;
begin
 if p_user is null or p_at is null or p_item is null or p_activity is null then return; end if;
 if p_kind not in ('ABAKA','BIBLE_CHAPTER','CHILDREN_STORY','SALIKSIK','MENTOR_SESSION','MENTEE_SESSION','CHILDREN_TEACHING') then return; end if;
 select coalesce(nullif(btrim(p.full_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.surname)),''),'BUKLOD Member')
 into v_name from public.profiles p where p.id=p_user;
 v_name:=coalesce(v_name,'BUKLOD Member');
 for v_scope in
  select distinct s.id,s.name from public.buklod_scope_memberships m
  join public.buklod_scopes s on s.id=m.scope_id
  where m.user_id=p_user and m.membership_status='ACTIVE'
    and s.scope_type='CLUSTER' and s.status not in ('SUSPENDED','DELETED')
    and (p_scope is null or s.id=p_scope)
    and coalesce(m.joined_at,m.created_at)<=p_at
    and (p_peer is null or exists(select 1 from public.buklod_scope_memberships peer
      where peer.scope_id=s.id and peer.user_id=p_peer and peer.membership_status='ACTIVE'
        and coalesce(peer.joined_at,peer.created_at)<=p_at))
 loop
  for v_admin in select distinct a.user_id from public.buklod_cluster_submission_admin_ids_v1(v_scope.id) a
    where a.user_id<>p_user
  loop
   v_key:=format('faith:accomplishment:%s:%s:%s:%s:%s',p_kind,p_user,p_item,v_scope.id,v_admin);
   -- Serialize the existing lookup/queue pair per logical event, including repeated chapter rows.
   perform pg_advisory_xact_lock(hashtextextended(v_key,0));
   begin
    perform public.buklod_queue_notification_once_v1(v_admin,left(p_activity,100),
     format('%s %s %s %s your cluster (%s). Report only; no approval required.',
       left(v_name,120),p_verb,left(p_activity,180),
       case when p_scope is null then 'as a member of' else 'in' end,
       left(coalesce(nullif(btrim(v_scope.name),''),'Unnamed cluster'),100)),
     'formation_submission_report',
     jsonb_build_object('scope_id',v_scope.id,'learner_id',p_user,'item_kind',p_kind,
       'item_id',p_item,'report_only',true,'status','RECORDED'),
     v_key);
   exception when others then
    -- Never interrupt a canonical completion for notification transport failure.
    raise warning 'Faith notification queue failed: kind %, SQLSTATE %',p_kind,SQLSTATE;
   end;
  end loop;
 end loop;
end;
$fn$;
revoke all on function private.buklod_notify_faith_accomplishment_v1(uuid,text,text,text,text,timestamptz,uuid,uuid) from public,anon,authenticated;

create or replace function private.buklod_faith_accomplishment_trigger_v1()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare v_title text; v_peer uuid; v_at timestamptz; v_scope uuid; v_books constant text[]:=array[
'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'];
begin
 case TG_TABLE_NAME
 when 'buklod_abc_growth_progress' then
  perform private.buklod_notify_faith_accomplishment_v1(new.user_id,'ABAKA',new.lesson_id,
    'ABAKA - '||initcap(replace(new.lesson_id,'-',' ')),'completed',new.completed_at);
 when 'bible_reading_sessions' then
  if new.completed_at is not null and new.source in ('free_reading','search','search_reading')
   and new.book_no between 1 and 66 and new.chapter_no>0 then
   if TG_OP='UPDATE' then
    if old.completed_at is not null then return new; end if;
   end if;
   perform private.buklod_notify_faith_accomplishment_v1(new.user_id,'BIBLE_CHAPTER',
     concat_ws(':',new.book_no,new.chapter_no,(new.completed_at at time zone 'Asia/Manila')::date),
     'Bible Reading - '||v_books[new.book_no]||' '||new.chapter_no,'recorded completion of',new.completed_at);
  end if;
 when 'buklod_children_story_completions' then
  select nullif(btrim(s.payload->>'title'),'') into v_title from public.buklod_children_stories s
   where s.id=new.story_id and new.source='published';
  perform private.buklod_notify_faith_accomplishment_v1(new.user_id,'CHILDREN_STORY',new.story_id,
   'Children’s Story - '||coalesce(v_title,initcap(replace(new.story_id,'-',' '))),'completed',new.completed_at);
 when 'mentor_teaching_sessions' then
  if lower(new.status)='approved' then
   if TG_OP='UPDATE' then
    if lower(old.status)='approved' then return new; end if;
   end if;
   select nullif(btrim(l.title),'') into v_title from public.learning_lessons l where l.id=new.lesson_id;
   -- Use the session's Manila date, matching the report's membership rule.
   v_at:=((new.session_date+1)::timestamp at time zone 'Asia/Manila')-interval '1 microsecond';
   for v_peer in select distinct a.user_id from public.mentor_session_attendees a
    where a.session_id=new.id and a.user_id<>new.mentor_id
   loop
    perform private.buklod_notify_faith_accomplishment_v1(new.mentor_id,'MENTOR_SESSION',new.id::text,
     'Mentoring - '||coalesce(v_title,'Teaching session'),'completed',v_at,null,v_peer);
    perform private.buklod_notify_faith_accomplishment_v1(v_peer,'MENTEE_SESSION',new.id::text,
     'Mentoring - '||coalesce(v_title,'Learning session'),'participated in',v_at,null,new.mentor_id);
   end loop;
  end if;
 when 'saliksik_mastery' then
  -- Exact scope attribution from the matching passed attempt, not a guessed active cluster.
  select i.title into v_title from public.saliksik_investigations i where i.id=new.investigation_id;
  for v_scope in
   select a.scope_id from public.saliksik_attempts a where a.user_id=new.user_id
    and a.investigation_id=new.investigation_id and a.passed=true and a.submitted_at=new.passed_at
   union
   select a.scope_id from public.saliksik_master_submissions a where a.user_id=new.user_id
    and a.investigation_id=new.investigation_id and a.version=new.version
    and a.status='approved' and a.reviewed_at=new.passed_at
  loop
   perform private.buklod_notify_faith_accomplishment_v1(new.user_id,'SALIKSIK',
    new.investigation_id::text||':v'||new.version,'SALIKSIK - '||coalesce(v_title,'Investigation'),
    'completed',new.passed_at,v_scope);
  end loop;
 end case;
 return new;
exception when others then
 raise warning 'Faith notification hook failed: table %, SQLSTATE %',TG_TABLE_NAME,SQLSTATE;
 return new;
end;
$fn$;
revoke all on function private.buklod_faith_accomplishment_trigger_v1() from public,anon,authenticated;

drop trigger if exists buklod_faith_named_accomplishment on public.buklod_abc_growth_progress;
create trigger buklod_faith_named_accomplishment after insert on public.buklod_abc_growth_progress
 for each row execute function private.buklod_faith_accomplishment_trigger_v1();
drop trigger if exists buklod_faith_named_accomplishment on public.bible_reading_sessions;
create trigger buklod_faith_named_accomplishment after insert or update of completed_at on public.bible_reading_sessions
 for each row execute function private.buklod_faith_accomplishment_trigger_v1();
drop trigger if exists buklod_faith_named_accomplishment on private.buklod_children_story_completions;
create trigger buklod_faith_named_accomplishment after insert on private.buklod_children_story_completions
 for each row execute function private.buklod_faith_accomplishment_trigger_v1();
drop trigger if exists buklod_faith_named_accomplishment on public.mentor_teaching_sessions;
create trigger buklod_faith_named_accomplishment after insert or update of status on public.mentor_teaching_sessions
 for each row execute function private.buklod_faith_accomplishment_trigger_v1();

-- Optional module: call installer again in release transaction AFTER SALIKSIK's migrations.
-- Missing source is not treated as an installed integration.
create or replace function private.buklod_install_saliksik_faith_notification_v1()
returns boolean language plpgsql security definer set search_path='' as $fn$
begin
 if to_regclass('public.saliksik_mastery') is null or to_regclass('public.saliksik_attempts') is null
  or to_regclass('public.saliksik_master_submissions') is null or to_regclass('public.saliksik_investigations') is null
 then return false; end if;
 execute 'drop trigger if exists buklod_faith_named_accomplishment on public.saliksik_mastery';
 execute 'create trigger buklod_faith_named_accomplishment after insert on public.saliksik_mastery for each row execute function private.buklod_faith_accomplishment_trigger_v1()';
 return true;
end;
$fn$;
revoke all on function private.buklod_install_saliksik_faith_notification_v1() from public,anon,authenticated;
select private.buklod_install_saliksik_faith_notification_v1();
-- CHILDREN_TEACHING: do not install a hook until a verified adult-account teaching source exists.
