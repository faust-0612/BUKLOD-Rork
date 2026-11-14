-- Authorized patient / clinician and denied non-participant regression checks.
\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.buklod_hc_consultation_cases(patient_id,topic,consent_at)
values ('11111111-1111-4111-8111-111111111111','general',now());
insert into public.buklod_hc_consultation_messages(case_id,sender_id,body,client_nonce)
select id,'11111111-1111-4111-8111-111111111111','Private concern','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
from public.buklod_hc_consultation_cases;
do $$ begin
 if (select count(*) from public.buklod_hc_consultation_cases) <> 1 then raise exception 'patient cannot see own case'; end if;
 if (select count(*) from public.buklod_hc_consultation_messages) <> 1 then raise exception 'patient cannot read own message'; end if;
end $$;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ begin
 if (select count(*) from public.buklod_hc_consultation_cases) <> 0 then raise exception 'nonparticipant leaked case'; end if;
 if (select count(*) from public.buklod_hc_consultation_messages) <> 0 then raise exception 'nonparticipant leaked message'; end if;
 begin
  insert into public.buklod_hc_verified_professionals(user_id,authorized)
  values ('22222222-2222-4222-8222-222222222222',true);
  raise exception 'unverified clinician granted own credentials';
 exception when insufficient_privilege then null; end;
end $$;
insert into public.buklod_hc_professional_applications(user_id,profession,license_number,license_expires_on)
values('22222222-2222-4222-8222-222222222222','registered_nurse','PRC-TEST-NUMBER',current_date + 100);
reset role;
-- Only privileged bootstrap/operator can approve and assign. Client has no UPDATE grant.
update public.buklod_hc_professional_applications set status='approved',reviewed_at=now()
where user_id='22222222-2222-4222-8222-222222222222';
insert into public.buklod_hc_verified_professionals(user_id,authorized,verified_at,valid_until)
values('22222222-2222-4222-8222-222222222222',true,now(),now()+interval '30 days');
update public.buklod_hc_consultation_cases set
 clinician_id='22222222-2222-4222-8222-222222222222',status='open'
where patient_id='11111111-1111-4111-8111-111111111111';
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ begin
 if (select count(*) from public.buklod_hc_consultation_cases) <> 1 then raise exception 'verified clinician denied assigned case'; end if;
 if (select count(*) from public.buklod_hc_consultation_messages) <> 1 then raise exception 'verified clinician denied assigned messages'; end if;
end $$;
insert into public.buklod_hc_consultation_messages(case_id,sender_id,body,client_nonce)
select id,'22222222-2222-4222-8222-222222222222','Professional reply','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
from public.buklod_hc_consultation_cases;
reset role;
update public.buklod_hc_verified_professionals set revoked_at=now(),authorized=false
where user_id='22222222-2222-4222-8222-222222222222';
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
do $$ begin
 if (select count(*) from public.buklod_hc_consultation_cases) <> 0 then raise exception 'revoked clinician still sees case'; end if;
 if (select count(*) from public.buklod_hc_consultation_messages) <> 0 then raise exception 'revoked clinician still sees messages'; end if;
end $$;
reset role;
