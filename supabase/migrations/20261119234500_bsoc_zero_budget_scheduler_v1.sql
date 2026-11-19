-- Zero-paid-API BSOC screening worker. Requires 20261119223000_bsoc_ai_autofix_reports_v1.sql.
-- Runs in existing Postgres; NO external AI/API, GitHub Actions, user case status, rewards or release mutation.
-- Full coding remains the separate hourly ChatGPT agent with existing connector permissions.
create or replace function private.bsoc_ai_zero_budget_tick_v1(p_limit integer default 3)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
  item record;
  f public.user_feedback%rowtype;
  h record;
  raw_text text;
  s text;
  route_name text;
  code text;
  phase text;
  reason_code text;
  report_message text;
  accepted integer:=0;
  verified integer:=0;
  denied integer:=0;
  limit_n integer:=greatest(1,least(coalesce(p_limit,3),3));
  report_key text;
begin
  -- Bounded, row-locked queue; duplicate cron calls cannot process the same case concurrently.
  for item in
    select j.case_id,j.attempts from public.bsoc_ai_case_jobs j
    where j.state='PENDING' and j.next_attempt_at<=now()
    order by j.created_at,j.case_id
    limit limit_n for update skip locked
  loop
    select * into f from public.user_feedback where id=item.case_id;
    if not found or f.status::text in ('resolved','closed') then
      update public.bsoc_ai_case_jobs
        set state='FAILED',error_code='CASE_NOT_OPEN',updated_at=now()
        where case_id=item.case_id;
      denied:=denied+1;
      continue;
    end if;
    update public.bsoc_ai_case_jobs
      set state='INVESTIGATING',attempts=least(attempts+1,5),
          leased_until=null,updated_at=now()
      where case_id=item.case_id;
    -- Pseudonymous member-only reporting; member's name/body never leave Postgres.
    perform private.bsoc_ai_emit_member_report_v1(f.id,'INVESTIGATING',
      'screening-start-'||to_char(f.updated_at at time zone 'UTC','YYYYMMDDHH24MISSUS'),
      'Sinusuri ng BSOC ang concern mo. Paunang automated screening ito; wala pang na-verify na software fix.');
    select e.error_signature,e.route_module into h
      from public.bsoc_health_events e
      where e.support_case_id=f.id
      order by e.last_seen_at desc limit 1;
    raw_text:=lower(coalesce(f.title,'')||' '||coalesce(f.message,''));
    code:=coalesce(nullif(h.error_signature,''),nullif(f.diagnostics->>'error_signature',''),'');
    route_name:=coalesce(nullif(h.route_module,''),nullif(f.diagnostics->>'route_module',''),'');
    -- Report only approved domain names (not arbitrary client-controlled text).
    s:=case
      when route_name ~* 'wall|community|marites' or raw_text ~ 'wall|community|marites|comment|reaction' then 'WALL'
      when route_name ~* 'connect|chat|message' or raw_text ~ 'connect|chat|message' then 'CONNECT'
      when route_name ~* 'cluster' or raw_text ~ 'cluster' then 'CLUSTER'
      when route_name ~* 'profile' or raw_text ~ 'profile|avatar|badge' then 'PROFILE'
      when route_name ~* 'media|reels|video' or raw_text ~ 'reels|video|upload|photo' then 'MEDIA'
      when route_name ~* 'notification' or raw_text ~ 'notification' then 'NOTIFICATIONS'
      when code ~* '^RENDER_' then 'RENDER'
      when code ~* '^SYNC_' or raw_text ~ 'offline|sync' then 'SYNC'
      else 'UNKNOWN' end;
    if f.category::text<>'bug'
      or raw_text ~ 'password|otp|secret|identity|selfie|government|withdraw|payout|finance|payment|bank|security|privacy|delete account|child abuse|moderation|login|authentication'
      or code ~* '^(AUTH_|FINANCE|PAYOUT|ROLE_|ACCOUNT_DELETE|SECURITY_|OWNERSHIP_|BREAK_GLASS)'
    then
      phase:='NEEDS_HUMAN';reason_code:='SENSITIVE_OR_NONBUG';
      report_message:='Ang concern mo ay nangangailangan ng mas maingat na BSOC review. Walang awtomatikong pagbabago sa account o sensitibong data.';
    elsif s='UNKNOWN' then
      phase:='NEEDS_DETAILS';reason_code:='MISSING_REPRODUCTION_DETAILS';
      report_message:='Para masuri ang concern, pakibigay ang screen, eksaktong ginawa bago ang error, at app version sa pribadong support thread. Huwag magbahagi ng password o OTP.';
    else
      phase:='TRIAGED';reason_code:='ZERO_BUDGET_SCREENED';
      report_message:='Naiugnay ang concern sa app module na '||s||'. Naka-queue ito para sa technical investigation. Hindi pa ito verified fix o live update.';
    end if;
    update public.bsoc_ai_case_jobs
      set state=phase,error_code=reason_code,
        safe_analysis='preliminary_module='||s||';evidence='||
          case when code ~* '^(RENDER_|SYNC_|MEDIA_|NETWORK_|SYS-)' then 'technical_code' else 'description_only' end||
          ';verification=required;zero_paid_api=true',
        updated_at=now()
      where case_id=item.case_id;
    report_key:='screening-'||to_char(f.updated_at at time zone 'UTC','YYYYMMDDHH24MISSUS')||'-'||lower(phase);
    perform private.bsoc_ai_emit_member_report_v1(f.id,phase,report_key,report_message);
    accepted:=accepted+1;
  end loop;

  -- A previously reviewed production release must be documented in the existing audit system.
  -- No DEV PR, code commit, GPT claim or telemetry silence qualifies for this transition.
  for item in
    select j.case_id,t.release_reference,t.release_version
      from public.bsoc_ai_case_jobs j
      join public.bsoc_case_fix_tracking t on t.case_id=j.case_id
      join public.user_feedback fb on fb.id=j.case_id
      where j.state in ('TRIAGED','DEV_FIX_REQUESTED','DEV_FIX_READY','AWAITING_RELEASE_VERIFICATION','NEEDS_HUMAN','NEEDS_DETAILS')
        and fb.status::text='resolved'
        and t.stage='VERIFIED_RESOLVED' and t.verified_at is not null
        and t.release_reference<>'' and t.release_version<>''
        and t.deployed_at<=now()
      order by t.verified_at
      limit limit_n for update of j skip locked
  loop
    perform private.bsoc_ai_emit_member_report_v1(item.case_id,'VERIFIED_RESOLVED',
      'verified-'||left(md5(item.release_reference||':'||item.release_version),32),
      'Na-verify ng BSOC ang fix sa release '||left(item.release_version,60)||
      '. Kung nararanasan mo pa rin ang issue, buksan muli ang support concern.');
    update public.bsoc_ai_case_jobs set state='VERIFIED_RESOLVED',updated_at=now()
      where case_id=item.case_id and state<>'VERIFIED_RESOLVED';
    verified:=verified+1;
  end loop;
  return jsonb_build_object('screened',accepted,'verified_reports',verified,'skipped_closed',denied,
                            'paid_api_calls',0,'production_releases',0);
end;
$fn$;
revoke all on function private.bsoc_ai_zero_budget_tick_v1(integer) from public,anon,authenticated;
-- Uses the existing pg_cron facility; tiny bounded job, not an Edge Function or paid AI API.
select cron.schedule('buklod-bsoc-zero-budget-screening-r1','*/15 * * * *',
  'select private.bsoc_ai_zero_budget_tick_v1(3);');
