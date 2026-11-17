-- Isolated attendance engine behavior; all test writes roll back.
begin;
do $case$
declare
 creator uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 attendee uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 reviewer uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 forger uuid:='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 host_scope uuid:='22222222-2222-4222-8222-222222222222';
 home_scope uuid:='11111111-1111-4111-8111-111111111111';
 v_event_id uuid:='33333333-3333-4333-8333-333333333333';
 payload text;
 result jsonb;
 count_rows int;
 point_rows int;
 debit_points int;
 denied boolean;
begin
 insert into public.attendance_events(id,scope_id,title,location,starts_at,ends_at,is_active,
   created_by,created_at,allowed_methods,attendance_open_at,attendance_close_at,late_after)
 values(v_event_id,host_scope,'Verified Workshop','Main Hall',
   now()-interval '10 minutes',now()+interval '10 minutes',true,
   creator,now()-interval '90 minutes',array['qr','manual'],
   now()-interval '20 minutes',now()+interval '10 minutes',now()+interval '2 minutes');

 perform set_config('request.jwt.claim.sub',creator::text,true);
 result:=public.buklod_issue_event_qr_v2(v_event_id);
 payload:=result->>'payload';
 if payload is null or left(payload,16)<>'BUKLOD:EVENT:V2:' then
   raise exception 'QR issuance failed'; end if;

 perform set_config('request.jwt.claim.sub',attendee::text,true);
 result:=public.buklod_scan_event_qr_v2(payload);
 if result->>'status'<>'recorded' then raise exception 'Expected initial QR check-in'; end if;
 result:=public.buklod_scan_event_qr_v2(payload);
 if result->>'status'<>'already_recorded' then raise exception 'Duplicate QR was not idempotent'; end if;
 select count(*) into count_rows from public.attendance_records
 where event_id=v_event_id and user_id=attendee;
 if count_rows<>1 then raise exception 'Multiple attendance records from QR replay'; end if;
 select count(*) into point_rows from public.buklod_points_ledger where user_id=attendee;
 if point_rows<>0 then raise exception 'Unverified check-in minted BP'; end if;

 -- A client can spoof the legacy metadata source, but cannot mint a trusted receipt.
 insert into public.attendance_records(event_id,user_id,status,method,operator_id,metadata)
 values(v_event_id,forger,'present','manual',forger,'{"source":"event_qr_v2"}');

 -- Simulate a completed event; assert the exact attendance time remains in-window.
 update public.attendance_records set checked_in_at=now()-interval '2 minutes'
 where attendance_records.event_id=v_event_id and user_id=attendee;
 update public.buklod_attendance_scan_receipts_v2 set verified_at=now()-interval '2 minutes'
 where buklod_attendance_scan_receipts_v2.event_id=v_event_id and user_id=attendee;
 update public.attendance_records set checked_in_at=now()-interval '2 minutes'
 where attendance_records.event_id=v_event_id and user_id=forger;
 update public.attendance_events set ends_at=now()-interval '1 minute',
   attendance_close_at=now()-interval '1 minute' where id=v_event_id;

 perform set_config('request.jwt.claim.sub',creator::text,true);
 denied:=false;
 begin
   perform public.buklod_review_event_rewards_v2(v_event_id,true,'Creator self approval');
 exception when sqlstate '42501' then denied:=true;
 end;
 if not denied then raise exception 'Creator self-approval was accepted'; end if;

 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 result:=public.buklod_review_event_rewards_v2(v_event_id,true,'Independent event verification completed');
 if result->>'status'<>'approved' then raise exception 'Independent review failed'; end if;
 select count(*) into point_rows from public.buklod_points_ledger l
 where l.user_id=attendee and l.direction='credit' and l.source_id=v_event_id;
 if point_rows<>1 then raise exception 'Verified QR attendee must receive one reward'; end if;
 select count(*) into point_rows from public.buklod_points_ledger l
 where l.user_id=forger and l.direction='credit' and l.source_id=v_event_id;
 if point_rows<>0 then raise exception 'Forged metadata bypassed trusted QR receipt'; end if;

 -- Repeated review cannot create a second credit.
 perform public.buklod_review_event_rewards_v2(v_event_id,true,'Repeated review must be idempotent');
 select count(*) into point_rows from public.buklod_points_ledger l
 where l.user_id=attendee and l.direction='credit' and l.source_id=v_event_id;
 if point_rows<>1 then raise exception 'Duplicate review minted duplicate BP'; end if;

 -- Authorized home scope sees attendance but not sensitive external event title.
 select count(*) into count_rows
 from public.buklod_attendance_home_report_v2(home_scope,null,null) r
 where r.member_id=attendee and r.event_id=v_event_id and r.event_title='External attendance';
 if count_rows<>1 then raise exception 'Private cross-scope report not redacted'; end if;

 -- Caps must debit the exact original credit, even if that credit is partial.
 update public.buklod_points_ledger set points=5
 where user_id=attendee and direction='credit' and source_id=v_event_id;
 perform public.buklod_reverse_scope_attendance_points_v1(attendee,v_event_id,null,reviewer);
 perform public.buklod_reverse_scope_attendance_points_v1(attendee,v_event_id,null,reviewer);
 select coalesce(sum(points),0) into debit_points from public.buklod_points_ledger
 where user_id=attendee and direction='debit' and source_id=v_event_id;
 if debit_points<>5 then raise exception 'Reversal did not debit exact credited 5 BP once'; end if;

 -- 2 legacy attendance credits with changing source keys for one event must not farm rewards.
 insert into public.church_events(id,starts_at)
 values('44444444-4444-4444-8444-444444444444',now()-interval '10 minutes');
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id)
 values(attendee,'credit',10,'event_attendance','legacy-1','44444444-4444-4444-8444-444444444444');
 insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id)
 values(attendee,'credit',10,'event_attendance','legacy-2','44444444-4444-4444-8444-444444444444');
 select count(*) into point_rows from public.buklod_points_ledger
 where user_id=attendee and direction='credit' and activity_type='event_attendance';
 if point_rows<>1 then raise exception 'Legacy timestamp replay minted a second reward'; end if;

 select count(*) into count_rows from public.buklod_attendance_review_audit_v2
 where event_id=v_event_id;
 if count_rows<>2 then raise exception 'Review changes not audited'; end if;
end
$case$;
rollback;
