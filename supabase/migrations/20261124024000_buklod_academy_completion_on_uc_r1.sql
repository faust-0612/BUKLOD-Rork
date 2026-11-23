-- Automatic first-stage academic evaluation for verified UC inserts.
-- Does not touch existing BP, QMP, ads or feature-locked source progress.
create or replace function public.buklod_academy_auto_award_on_uc_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare user_ref uuid:=new.user_id; total integer; c record;
begin
 if not exists(select 1 from public.buklod_university_config where singleton and enabled) then return new;end if;
 -- Evidence is derived from authoritative, unique UC records only.
 insert into public.buklod_university_credential_evidence
 (user_id,credential_code,status,evidence_summary,verified_by_source,verified_at)
 select user_ref,'C-S01','VERIFIED',jsonb_build_object('daily_verified',count(*)),
  'academy_uc:daily_reading',now()
 from public.buklod_university_uc_ledger where user_id=user_ref and source_module='daily_reading'
 having count(*)>=20 on conflict(user_id,credential_code) do nothing;

 insert into public.buklod_university_credential_evidence
 (user_id,credential_code,status,evidence_summary,verified_by_source,verified_at)
 select user_ref,'C-S02','VERIFIED',
  jsonb_build_object('daily_verified',count(*) filter(where source_module='daily_reading'),
   'word_verified',count(*) filter(where source_module='word')),
  'academy_uc:daily_word',now()
 from public.buklod_university_uc_ledger where user_id=user_ref
 having count(*) filter(where source_module='daily_reading')>=12
 and count(*) filter(where source_module='word')>=12
 on conflict(user_id,credential_code) do nothing;

 insert into public.buklod_university_credential_evidence
 (user_id,credential_code,status,evidence_summary,verified_by_source,verified_at)
 select user_ref,'C-D01','VERIFIED',jsonb_build_object('abaka_verified',count(distinct source_key)),
  'academy_uc:abaka_28',now()
 from public.buklod_university_uc_ledger where user_id=user_ref and source_module='abaka'
  and (source_key in ('prelim-01','prelim-02') or source_key ~ '^lesson-(0[1-9]|1[0-9]|2[0-6])$')
 having count(distinct source_key)=28 on conflict(user_id,credential_code) do nothing;

 select coalesce(sum(uc),0)::integer into total from public.buklod_university_uc_ledger where user_id=user_ref;
 for c in select * from public.buklod_university_credentials where active order by min_uc,code loop
  if total<c.min_uc then continue;end if;
  if not exists(select 1 from public.buklod_university_credential_evidence e
    where e.user_id=user_ref and e.credential_code=c.code and e.status='VERIFIED'
      and e.verified_by_source is not null and e.verified_at is not null) then continue;end if;
  if exists(select 1 from unnest(c.prerequisites) pre where not exists(
    select 1 from public.buklod_university_awards a
    where a.user_id=user_ref and a.credential_code=pre and a.status='ISSUED')) then continue;end if;
  insert into public.buklod_university_awards(user_id,credential_code,qualifying_uc,policy_version)
  values(user_ref,c.code,total,'BU-ACADEMY-5')
  on conflict(user_id,credential_code) do nothing;
 end loop;
 return new;
end;
$$;
revoke all on function public.buklod_academy_auto_award_on_uc_v1() from public,anon,authenticated;
drop trigger if exists academy_award_after_verified_uc on public.buklod_university_uc_ledger;
create trigger academy_award_after_verified_uc after insert on public.buklod_university_uc_ledger
 for each row execute function public.buklod_academy_auto_award_on_uc_v1();

-- Backfill is gated, iterative, and never touches existing BP claim-state values.
-- Higher credentials stay locked until externally verified evidence rows exist.
