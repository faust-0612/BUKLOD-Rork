-- Event-driven UC settlement for first three fully identifiable verified sources.
-- Feature is DEFAULT OFF. Source adapters for other modules require audited
-- canonical completion IDs; never credit from mere taps, reads or unverified BP.
create or replace function public.buklod_academy_verified_source_to_uc_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare source_uuid uuid; member_uuid uuid; source_type text; source_key_value text;
        amount integer; reviewed timestamptz; linked_ledger uuid;
begin
 if not exists(select 1 from public.buklod_university_config where singleton and enabled) then
   return new;
 end if;
 if TG_TABLE_NAME='buklod_points_ledger' then
  if new.direction<>'credit' or new.source_id is null or new.activity_type not in ('daily_bible','devotional') then return new;end if;
  source_uuid:=new.source_id;member_uuid:=new.user_id;linked_ledger:=new.id;
 elsif TG_TABLE_NAME='daily_bible_submissions' then
  if new.status<>'approved' or new.reviewed_at is null then return new;end if;
  source_uuid:=new.id;member_uuid:=new.user_id;
 elsif TG_TABLE_NAME='devotional_reward_submissions' then
  if new.status<>'approved' or new.reviewed_at is null then return new;end if;
  source_uuid:=new.id;member_uuid:=new.user_id;
 elsif TG_TABLE_NAME='buklod_abc_growth_progress' then
  if new.completed_at is null or new.point_ledger_id is null then return new;end if;
  if not exists(select 1 from public.buklod_points_ledger l
   where l.id=new.point_ledger_id and l.user_id=new.user_id
   and l.activity_type='abc_growth_lesson' and l.direction='credit') then return new;end if;
  insert into public.buklod_university_uc_ledger
   (user_id,source_module,source_key,source_ledger_id,uc,verified_at,policy_version)
  values(new.user_id,'abaka',new.lesson_id,new.point_ledger_id,5,new.completed_at,'BU-ACADEMY-5')
  on conflict(user_id,source_module,source_key) do nothing;
  return new;
 else return new;
 end if;
 if TG_TABLE_NAME='buklod_points_ledger' then
  if new.activity_type='daily_bible' then source_type:='daily_reading';
  else source_type:='word';end if;
 else
  if TG_TABLE_NAME='daily_bible_submissions' then source_type:='daily_reading';
  else source_type:='word';end if;
 end if;
 if source_type='daily_reading' then
  select s.reviewed_at,l.id into reviewed,linked_ledger
   from public.daily_bible_submissions s
   join public.buklod_points_ledger l on l.user_id=s.user_id and l.source_id=s.id
   and l.activity_type='daily_bible' and l.direction='credit'
   where s.id=source_uuid and s.user_id=member_uuid and s.status='approved'
   and s.reviewed_at is not null limit 1;
  amount:=1;
 else
  select s.reviewed_at,l.id into reviewed,linked_ledger
   from public.devotional_reward_submissions s
   join public.buklod_points_ledger l on l.user_id=s.user_id and l.source_id=s.id
   and l.activity_type='devotional' and l.direction='credit'
   where s.id=source_uuid and s.user_id=member_uuid and s.status='approved'
   and s.reviewed_at is not null limit 1;
  amount:=2;
 end if;
 if linked_ledger is not null and reviewed is not null then
  insert into public.buklod_university_uc_ledger
   (user_id,source_module,source_key,source_ledger_id,uc,verified_at,policy_version)
  values(member_uuid,source_type,source_uuid::text,linked_ledger,amount,reviewed,'BU-ACADEMY-5')
  on conflict(user_id,source_module,source_key) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.buklod_academy_verified_source_to_uc_v1() from public,anon,authenticated;
drop trigger if exists academy_uc_after_points_credit on public.buklod_points_ledger;
create trigger academy_uc_after_points_credit after insert on public.buklod_points_ledger
 for each row execute function public.buklod_academy_verified_source_to_uc_v1();
drop trigger if exists academy_uc_after_daily_review on public.daily_bible_submissions;
create trigger academy_uc_after_daily_review after insert or update of status,reviewed_at on public.daily_bible_submissions
 for each row execute function public.buklod_academy_verified_source_to_uc_v1();
drop trigger if exists academy_uc_after_word_review on public.devotional_reward_submissions;
create trigger academy_uc_after_word_review after insert or update of status,reviewed_at on public.devotional_reward_submissions
 for each row execute function public.buklod_academy_verified_source_to_uc_v1();
drop trigger if exists academy_uc_after_abaka_completion on public.buklod_abc_growth_progress;
create trigger academy_uc_after_abaka_completion after insert or update of point_ledger_id,completed_at on public.buklod_abc_growth_progress
 for each row execute function public.buklod_academy_verified_source_to_uc_v1();
