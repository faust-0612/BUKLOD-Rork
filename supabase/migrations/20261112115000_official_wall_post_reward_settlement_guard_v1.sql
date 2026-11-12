-- BUKLOD Official posting regression hotfix (2026-11-12)
-- Restore Wall publishing for platform Official identity while keeping
-- existing no-reward Points/QMP/BCU guards and ordinary member paths intact.
-- Original live function bodies preserved; only scoped Official early returns added.
-- No RLS, storage, media, auth, historic finance or trigger topology changes.

CREATE OR REPLACE FUNCTION private.buklod_community_qmp_after_post_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_period private.buklod_community_settlement_periods;
  v_rule private.buklod_community_qmp_rule_versions;
  v_min integer:=40; v_post bigint:=5; v_video bigint:=10; v_is_video boolean; v_awarded uuid;
begin
  -- A published Official post has no QMP event or active-day credit.
  if private.buklod_is_platform_official_v1(new.user_id) then return new; end if;
  if new.user_id is null or new.is_reel=true or new.is_hidden or new.deleted_at is not null then return new; end if;
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  v_min:=coalesce((v_rule.config#>>'{qualification,post_min_chars}')::integer,40);
  v_post:=coalesce((v_rule.config#>>'{base_qmp,useful_post}')::bigint,5);
  v_video:=coalesce((v_rule.config#>>'{base_qmp,qualified_video}')::bigint,10);
  v_is_video:=lower(coalesce(new.media_mime_type,'')) like 'video/%';
  if v_is_video then
    v_awarded:=private.buklod_community_qmp_record_event_v1(new.user_id,new.id,'post:'||new.id::text,'QUALIFIED_VIDEO',
      v_video,0,'QUALIFIED','QUALIFIED','VIDEO_BASE',jsonb_build_object('audience',new.audience));
    if v_awarded is not null and exists(
      select 1 from private.buklod_community_qmp_events where id=v_awarded and state='QUALIFIED'
    ) then
      perform private.buklod_community_qmp_progress_mission_v1(new.user_id,v_period.id,'QUALIFIED_VIDEO');
    end if;
  elsif length(trim(coalesce(new.body,'')))>=v_min or new.media_path is not null then
    v_awarded:=private.buklod_community_qmp_record_event_v1(new.user_id,new.id,'post:'||new.id::text,'USEFUL_POST',
      v_post,0,'QUALIFIED','QUALIFIED','POST_BASE',jsonb_build_object('audience',new.audience));
    if v_awarded is not null and exists(
      select 1 from private.buklod_community_qmp_events where id=v_awarded and state='QUALIFIED'
    ) then
      perform private.buklod_community_qmp_progress_mission_v1(new.user_id,v_period.id,'USEFUL_POST');
    end if;
  else
    perform private.buklod_community_qmp_record_event_v1(new.user_id,new.id,'post:'||new.id::text,'USEFUL_POST',
      v_post,0,'PENDING','PENDING','MINIMUM_SUBSTANCE_REVIEW',jsonb_build_object('audience',new.audience));
  end if;
  perform private.buklod_community_qmp_mark_active_day_v1(new.user_id,v_period.id);
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION private.buklod_engagement_r4_post_trigger_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 -- Official posts remain publishable without creator-impact settlement.
 IF private.buklod_is_platform_official_v1(NEW.user_id) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM private.buklod_engagement_r4_rollout r
   WHERE r.id=1 AND r.enabled AND NEW.created_at>=r.effective_at) THEN
    PERFORM private.buklod_r36_settle_creator_impact_v1(
       CASE WHEN coalesce(NEW.is_reel,false) THEN 'reel' ELSE 'wall' END,
       NEW.id,'r37_standard_social_points_v1');
 END IF;
 RETURN NEW;
END $function$

CREATE OR REPLACE FUNCTION private.buklod_r36_settle_creator_impact_v1(p_content_kind text, p_content_id uuid, p_policy_version text DEFAULT 'r36_social_economy_v1'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status text;
  v_effective_at timestamptz;
  v_config jsonb;
  v_r4_enabled boolean := false;
  v_r4_progress jsonb;
  v_settlement_enabled boolean := false;
  v_cutover_completed boolean := false;
  v_post_user_id uuid;
  v_post_created_at timestamptz;
  v_is_reel boolean;
  v_creator uuid;
  v_qeu integer := 0;
  v_unique integer := 0;
  v_credited_tier text := 'none';
  v_credited_cp integer := 0;
  v_credited_bcu numeric(18,4) := 0;
  v_target jsonb;
  v_tier_id text;
  v_target_cp integer := 0;
  v_target_bcu numeric(18,4) := 0;
  v_delta_cp integer := 0;
  v_delta_bcu numeric(18,4) := 0;
  v_cp_source_key text;
  v_bcu_event_key text;
  v_cp_ledger_id uuid;
  v_existing_cp integer;
  v_bcu_result jsonb;
  v_mod_econ text := 'normal';
  v_mod_distribution text := 'normal';
begin
  if p_content_kind not in ('wall','reel') or p_content_id is null then
    return jsonb_build_object('status','rejected','reason','invalid_input','written',false);
  end if;

  select p.status,p.effective_at,p.config
    into v_status,v_effective_at,v_config
  from private.buklod_r36_economy_policy_versions p
  where p.policy_version=p_policy_version;

  if v_config is null then
    return jsonb_build_object('status','rejected','reason','policy_not_found','written',false);
  end if;

  begin
    v_settlement_enabled := coalesce((v_config #>> '{activation,creator_impact_settlement_enabled}')::boolean,false);
  exception when others then
    v_settlement_enabled := false;
  end;

  begin
    v_cutover_completed := coalesce((v_config #>> '{activation,legacy_social_publish_cutover_completed}')::boolean,false);
  exception when others then
    v_cutover_completed := false;
  end;

  if v_status <> 'active' or v_effective_at is null or v_effective_at > now() then
    return jsonb_build_object('status','policy_inactive','written',false);
  end if;

  if not v_settlement_enabled or not v_cutover_completed then
    return jsonb_build_object(
      'status','settlement_disabled',
      'written',false,
      'creator_impact_settlement_enabled',v_settlement_enabled,
      'legacy_social_publish_cutover_completed',v_cutover_completed
    );
  end if;

  select p.user_id,p.created_at,p.is_reel
    into v_post_user_id,v_post_created_at,v_is_reel
  from public.community_posts p
  where p.id=p_content_id;

  if v_post_user_id is null then
    return jsonb_build_object('status','rejected','reason','content_not_found','written',false);
  end if;
  -- Engagement with Official content stays valid; creator reward settlement does not run.
  if private.buklod_is_platform_official_v1(v_post_user_id) then
    return jsonb_build_object('status','official_excluded','written',false);
  end if;

  if (p_content_kind='reel' and not v_is_reel)
     or (p_content_kind='wall' and v_is_reel) then
    return jsonb_build_object('status','rejected','reason','content_kind_mismatch','written',false);
  end if;

  if v_post_created_at < v_effective_at then
    return jsonb_build_object(
      'status','rejected','reason','pre_effective_content_preserved','written',false,
      'content_created_at',v_post_created_at,'policy_effective_at',v_effective_at
    );
  end if;

  select s.creator_user_id,s.qeu_total,s.unique_qualified_users,
         s.credited_tier_id,s.credited_total_cp,s.credited_total_bcu
    into v_creator,v_qeu,v_unique,v_credited_tier,v_credited_cp,v_credited_bcu
  from private.buklod_r36_content_impact_state s
  where s.content_kind=p_content_kind
    and s.content_id=p_content_id
    and s.policy_version=p_policy_version
  for update;

  if v_creator is null then
    return jsonb_build_object('status','rejected','reason','impact_state_not_found','written',false);
  end if;

  if v_creator <> v_post_user_id then
    return jsonb_build_object('status','rejected','reason','creator_mismatch','written',false);
  end if;

  select coalesce(m.economic_qualification,'normal'),coalesce(m.distribution,'normal')
    into v_mod_econ,v_mod_distribution
  from private.buklod_r36_content_moderation_state m
  where m.entity_type=case when p_content_kind='wall' then 'post' else 'reel' end
    and m.entity_id=p_content_id
    and m.policy_version=p_policy_version;

  v_mod_econ := coalesce(v_mod_econ,'normal');
  v_mod_distribution := coalesce(v_mod_distribution,'normal');

  if v_mod_econ <> 'normal' or v_mod_distribution <> 'normal' then
    return jsonb_build_object(
      'status','held','reason','moderation_economics_not_normal','written',false,
      'economic_qualification',v_mod_econ,'distribution',v_mod_distribution
    );
  end if;

  -- Preserve all historical +5 community-post rewards. Any content already carrying
  -- the legacy publish source key is ineligible for R36 creator-impact settlement.
  if exists(
    select 1
    from public.buklod_points_ledger l
    where l.user_id=v_creator
      and l.source_key='community_post:' || p_content_id::text
  ) then
    return jsonb_build_object(
      'status','rejected','reason','legacy_publish_reward_present','written',false
    );
  end if;

  v_target := private.buklod_r36_impact_tier_v1(p_policy_version,p_content_kind,coalesce(v_qeu,0),coalesce(v_unique,0));
  v_tier_id := coalesce(v_target->>'tier_id','published');
  v_target_cp := coalesce((v_target->>'total_cp')::integer,0);
  -- Progressive BP affects only posts published after explicit R4 activation.
  SELECT EXISTS (
    SELECT 1 FROM private.buklod_engagement_r4_rollout r
    WHERE r.id=1 AND r.enabled AND v_post_created_at>=r.effective_at
  ) INTO v_r4_enabled;
  IF v_r4_enabled THEN
    v_r4_progress := private.buklod_engagement_r4_post_bonus_v1(p_content_id);
    v_target_cp := greatest(
      v_target_cp, coalesce(v_credited_cp,0),
      least(600, 5 +
        coalesce((v_r4_progress->>'likes_bonus')::integer,0) +
        coalesce((v_r4_progress->>'comments_bonus')::integer,0)
      )
    );
  END IF;
  v_target_bcu := coalesce((v_target->>'total_bcu')::numeric,0);
  v_delta_cp := greatest(v_target_cp-coalesce(v_credited_cp,0),0);
  v_delta_bcu := greatest(v_target_bcu-coalesce(v_credited_bcu,0),0);

  if v_delta_cp=0 and v_delta_bcu=0 then
    return jsonb_build_object(
      'status','already_settled','written',false,'tier_id',v_tier_id,
      'credited_total_cp',v_credited_cp,'credited_total_bcu',v_credited_bcu
    );
  end if;

  v_cp_source_key := 'r36:creator-impact:' || p_content_kind || ':' || p_content_id::text || ':' || v_tier_id || ':cp';
  -- Fresh source key for each monotonic R4 BP target; BCU tier keys are unchanged.
  IF v_r4_enabled THEN
    v_cp_source_key := 'r4:creator-impact:' || p_content_kind || ':' ||
      p_content_id::text || ':total-' || v_target_cp::text || ':cp';
  END IF;
  v_bcu_event_key := 'r36:creator-impact:' || p_content_kind || ':' || p_content_id::text || ':' || v_tier_id || ':bcu';

  if v_delta_cp > 0 then
    insert into public.buklod_points_ledger(
      user_id,direction,points,activity_type,source_key,source_id,description,awarded_by
    ) values (
      v_creator,'credit',v_delta_cp,'r36_creator_impact',v_cp_source_key,p_content_id,
      'BUKLOD Creator Impact - ' || initcap(replace(v_tier_id,'_',' ')),null::uuid
    )
    on conflict (user_id,source_key) do nothing
    returning id into v_cp_ledger_id;

    if v_cp_ledger_id is null then
      select l.points into v_existing_cp
      from public.buklod_points_ledger l
      where l.user_id=v_creator and l.source_key=v_cp_source_key;

      if v_existing_cp is distinct from v_delta_cp then
        raise exception 'R36 settlement ledger/source-key inconsistency for %',v_cp_source_key;
      end if;

      raise exception 'R36 settlement state inconsistency: CP tier ledger exists but credited totals are behind';
    end if;
  end if;

  if v_delta_bcu > 0 then
    v_bcu_result := private.buklod_r36_credit_bcu_v1(
      v_creator,v_delta_bcu,v_bcu_event_key,'creator_impact',p_content_id,
      jsonb_build_object('content_kind',p_content_kind,'tier_id',v_tier_id)
    );

    if coalesce(v_bcu_result->>'status','') <> 'credited' then
      raise exception 'R36 BCU settlement failed: %',coalesce(v_bcu_result::text,'null');
    end if;
  end if;

  update private.buklod_r36_content_impact_state
  set credited_tier_id=v_tier_id,
      credited_total_cp=v_target_cp,
      credited_total_bcu=v_target_bcu,
      updated_at=now()
  where content_kind=p_content_kind
    and content_id=p_content_id
    and policy_version=p_policy_version;

  return jsonb_build_object(
    'status','settled','written',true,
    'tier_id',v_tier_id,
    'delta_cp',v_delta_cp,
    'delta_bcu',v_delta_bcu,
    'target_total_cp',v_target_cp,
    'target_total_bcu',v_target_bcu,
    'points_claim_state','pending',
    'cash_or_bayanihan_write',false
  );
end;
$function$

CREATE OR REPLACE FUNCTION private.buklod_r36_settle_publish_v1(p_post_id uuid, p_policy_version text DEFAULT 'r36_social_economy_v1'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_status text;
  v_effective_at timestamptz;
  v_config jsonb;
  v_enabled boolean := false;
  v_tz text := 'Asia/Manila';
  v_post public.community_posts%rowtype;
  v_kind text;
  v_cap integer := 0;
  v_cp integer := 0;
  v_rank integer := 0;
  v_day date;
  v_source_key text;
  v_ledger_id uuid;
begin
  select status,effective_at,config into v_status,v_effective_at,v_config
  from private.buklod_r36_economy_policy_versions where policy_version=p_policy_version;
  if v_config is null then return jsonb_build_object('status','policy_not_found','written',false); end if;
  begin v_enabled := coalesce((v_config #>> '{activation,publisher_economics_enabled}')::boolean,false); exception when others then v_enabled:=false; end;
  v_tz := coalesce(nullif(v_config->>'economic_day_timezone',''),'Asia/Manila');
  if v_status<>'active' or v_effective_at is null or v_effective_at>now() then return jsonb_build_object('status','policy_inactive','written',false); end if;
  if not v_enabled then return jsonb_build_object('status','publisher_economics_disabled','written',false); end if;

  select * into v_post from public.community_posts where id=p_post_id;
  if v_post.id is null then return jsonb_build_object('status','post_not_found','written',false); end if;
  -- Bypass only Official member economics. Do not alter post creation or visibility.
  if private.buklod_is_platform_official_v1(v_post.user_id) then
    return jsonb_build_object('status','official_excluded','written',false);
  end if;
  if v_post.created_at < v_effective_at then return jsonb_build_object('status','pre_effective_preserved','written',false); end if;

  if exists(select 1 from public.buklod_points_ledger l where l.user_id=v_post.user_id and l.source_key='community_post:'||v_post.id::text) then
    return jsonb_build_object('status','legacy_reward_present','written',false);
  end if;

  v_kind := case when coalesce(v_post.is_reel,false) then 'reel' else 'wall' end;
  begin v_cap := coalesce((v_config #>> array['publisher_economics',v_kind,'economic_daily_cap'])::integer,0); exception when others then v_cap:=0; end;
  begin v_cp := coalesce((v_config #>> array['publisher_economics',v_kind,'cp'])::integer,0); exception when others then v_cp:=0; end;
  v_day := (v_post.created_at at time zone v_tz)::date;

  select count(*)::integer into v_rank
  from public.community_posts p
  where p.user_id=v_post.user_id
    and (p.created_at at time zone v_tz)::date=v_day
    and (p.created_at < v_post.created_at or (p.created_at=v_post.created_at and p.id<=v_post.id))
    and coalesce(p.is_reel,false)=coalesce(v_post.is_reel,false);

  if v_cap<=0 or v_rank>v_cap or v_cp<=0 then
    return jsonb_build_object('status','daily_cap_or_zero_reward','written',false,'rank',v_rank,'cap',v_cap,'kind',v_kind);
  end if;

  v_source_key := 'r36:publish:'||v_post.id::text||':cp';
  insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
  values(v_post.user_id,'credit',v_cp,'r36_publish_'||v_kind,v_source_key,v_post.id,'BUKLOD publish reward',null::uuid)
  on conflict(user_id,source_key) do nothing
  returning id into v_ledger_id;

  insert into private.buklod_r36_content_impact_state(
    content_kind,content_id,creator_user_id,policy_version,qeu_total,unique_qualified_users,
    credited_tier_id,credited_total_cp,credited_total_bcu,updated_at
  ) values(v_kind,v_post.id,v_post.user_id,p_policy_version,0,0,'published',v_cp,0,now())
  on conflict(content_kind,content_id,policy_version) do update set
    credited_tier_id=case when private.buklod_r36_content_impact_state.credited_total_cp < v_cp then 'published' else private.buklod_r36_content_impact_state.credited_tier_id end,
    credited_total_cp=greatest(private.buklod_r36_content_impact_state.credited_total_cp,v_cp),
    updated_at=now();

  return jsonb_build_object('status',case when v_ledger_id is null then 'idempotent' else 'settled' end,'written',v_ledger_id is not null,'kind',v_kind,'rank',v_rank,'cap',v_cap,'cp',v_cp,'bcu',0,'points_claim_state','pending');
end;
$function$

CREATE OR REPLACE FUNCTION public.community_post_points_trigger_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Official may publish, but cannot mint member Points.
  if private.buklod_is_platform_official_v1(new.user_id) then return new; end if;
  if private.buklod_r37_social_route_v1()='r37' then perform private.buklod_r36_settle_publish_v1(new.id,'r37_standard_social_points_v1');
  else perform public.credit_community_social_points_v2(new.user_id,'community_post','community_post:'||new.id::text,new.id); end if;
  return new;
end;
$function$

