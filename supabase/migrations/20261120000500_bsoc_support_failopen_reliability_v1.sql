-- Live reliability hotfix: never block support intake/chat if auxiliary queue or notifications fail.
create or replace function private.bsoc_ai_enqueue_new_case_v1() returns trigger
language plpgsql security definer set search_path='' as $fn$
begin
  begin
    insert into public.bsoc_ai_case_jobs(case_id,state)
      values(new.id,'PENDING') on conflict(case_id) do nothing;
  exception when others then
    raise warning 'BSOC intake queue deferred for case %',new.id;
  end;
  -- Member submissions must succeed even if notifications or push dispatch fail.
  -- Keep the durable queue entry; the worker retries reporting later.
  begin
    perform private.bsoc_ai_emit_member_report_v1(new.id,'RECEIVED','receipt-v1',
      'Natanggap ng BSOC ang iyong concern. Susuriin ito at magbibigay ng update dito. Hindi pa ibig sabihing naayos na ang problema.');
  exception when others then
    raise warning 'BSOC report notification deferred for case %', new.id;
  end;
  return new;
end;
$fn$;
create or replace function private.bsoc_ai_enqueue_reopened_case_v1() returns trigger
language plpgsql security definer set search_path='' as $fn$
begin
  if old.status in ('resolved'::public.feedback_status,'closed'::public.feedback_status)
     and new.status='in_progress'::public.feedback_status then
    begin
      insert into public.bsoc_ai_case_jobs(case_id,state,attempts,leased_until,
                                          next_attempt_at,error_code,safe_analysis,issue_url,updated_at)
        values(new.id,'PENDING',0,null,now(),null,null,null,now())
        on conflict(case_id) do update set state='PENDING',attempts=0,leased_until=null,
          next_attempt_at=now(),error_code=null,safe_analysis=null,issue_url=null,updated_at=now();
    exception when others then
      raise warning 'BSOC reopened queue deferred for case %',new.id;
    end;
    begin
      perform private.bsoc_ai_emit_member_report_v1(new.id,'REOPENED',
        'reopened-'||to_char(new.updated_at at time zone 'UTC','YYYYMMDDHH24MISSUS'),
        'Muling binuksan ng BSOC ang concern mo. Magsasagawa ng panibagong investigation.');
    exception when others then
      raise warning 'BSOC reopened notification deferred for case %', new.id;
    end;
  end if;
  return new;
end;
$fn$;
create or replace function private.bsoc_ai_member_reply_followup_v1()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare
  member_id uuid;
  canonical_status text;
  job_state text;
  note text;
  area text;
  next_state text;
  reason_code text;
  user_message text;
begin
  if new.sender_kind<>'member' then return new; end if;
  select f.user_id,f.status::text,j.state
    into member_id,canonical_status,job_state
    from public.user_feedback f
      join public.bsoc_ai_case_jobs j on j.case_id=f.id
   where f.id=new.case_id;
  if member_id is null or member_id<>new.sender_id
     or canonical_status in ('resolved','closed') or job_state<>'NEEDS_DETAILS' then
    return new;
  end if;
  note:=lower(left(coalesce(new.body,''),1000));
  area:=case
    when note ~ 'wall|community|marites|comment|reaction' then 'WALL'
    when note ~ 'connect|chat|message' then 'CONNECT'
    when note ~ 'cluster' then 'CLUSTER'
    when note ~ 'profile|avatar|badge' then 'PROFILE'
    when note ~ 'reels|video|upload|photo' then 'MEDIA'
    when note ~ 'notification' then 'NOTIFICATIONS'
    when note ~ 'offline|sync' then 'SYNC'
    else 'UNKNOWN' end;
  if note ~ 'password|otp|secret|identity|selfie|government|withdraw|payout|finance|payment|bank|security|privacy|delete account|child abuse|moderation|login|authentication'
     or area='UNKNOWN' then
    next_state:='NEEDS_HUMAN';
    reason_code:='MEMBER_REPLY_NEEDS_SUPPORT';
    user_message:='Natanggap ng BSOC ang karagdagang detalye. Kailangan pa ng support review bago makumpirma ang sanhi o fix.';
  else
    next_state:='TRIAGED';
    reason_code:='MEMBER_REPLY_HAS_TECHNICAL_CONTEXT';
    user_message:='Natanggap ang karagdagang impormasyon tungkol sa '||area||
      '. Ipinagpapatuloy ang technical investigation. Hindi pa ito verified fix.';
  end if;
  update public.bsoc_ai_case_jobs
    set state=next_state,error_code=reason_code,
        safe_analysis='preliminary_module='||area||';source=sanitized_member_followup;verification=required;zero_paid_api=true',
        updated_at=now()
    where case_id=new.case_id and state='NEEDS_DETAILS';
  if not found then return new; end if;
  begin
    perform private.bsoc_ai_emit_member_report_v1(new.case_id,next_state,
      'member-followup-'||new.id::text,user_message);
  exception when others then
    raise warning 'BSOC member-followup report deferred for case %',new.case_id;
  end;
  return new;
exception when others then
  -- Never fail the member's actual support message because automation is unhealthy.
  raise warning 'BSOC member followup deferred for message %',new.id;
  return new;
end;
$fn$;
