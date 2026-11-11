-- BUKLOD mutual engagement R4, forward-only supplementary social rewards.
-- Disabled by default until consolidated RC and back-end verification pass.
-- Existing R37 QEU + BCU and Community QMP allocations are untouched.
CREATE TABLE IF NOT EXISTS private.buklod_engagement_r4_rollout (
  id smallint PRIMARY KEY CHECK (id=1),
  enabled boolean NOT NULL DEFAULT false,
  effective_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO private.buklod_engagement_r4_rollout(id,enabled,effective_at)
VALUES(1,false,now()) ON CONFLICT(id) DO NOTHING;
REVOKE ALL ON private.buklod_engagement_r4_rollout FROM PUBLIC,anon,authenticated;

-- Qualified R37 events only: no synthetic like counts, no self engagement,
-- at most three qualified comments per actor/post/Manila day.
CREATE OR REPLACE FUNCTION private.buklod_engagement_r4_post_bonus_v1(p_post_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_owner uuid; v_likes integer:=0; v_comments integer:=0;
        v_commenters integer:=0; v_lb integer:=0; v_cb integer:=0;
BEGIN
 SELECT user_id INTO v_owner FROM public.community_posts
 WHERE id=p_post_id AND deleted_at IS NULL AND NOT coalesce(is_hidden,false);
 IF v_owner IS NULL THEN RETURN jsonb_build_object('likes',0,'comments',0,'commenters',0,'likes_bonus',0,'comments_bonus',0); END IF;
 SELECT count(DISTINCT e.actor_user_id)::int INTO v_likes
 FROM private.buklod_r36_social_impact_events e
 WHERE e.content_id=p_post_id AND e.creator_user_id=v_owner
   AND e.actor_user_id<>v_owner AND e.policy_version='r37_standard_social_points_v1'
   AND e.qualification_state='qualified' AND e.engagement_kind='reaction';
 WITH ranked AS (
   SELECT e.actor_user_id,
     row_number() over(partition by e.actor_user_id,
       (e.occurred_at at time zone 'Asia/Manila')::date
       order by e.occurred_at,e.id) AS rn
   FROM private.buklod_r36_social_impact_events e
   JOIN public.comments c ON c.id=e.source_entity_id AND c.post_id=p_post_id
   WHERE e.content_id=p_post_id AND e.creator_user_id=v_owner
     AND e.actor_user_id<>v_owner AND e.policy_version='r37_standard_social_points_v1'
     AND e.qualification_state='qualified' AND e.engagement_kind IN ('comment','reply')
     AND c.deleted_at IS NULL AND NOT coalesce(c.is_hidden,false)
 )
 SELECT count(*)::int,count(DISTINCT actor_user_id)::int INTO v_comments,v_commenters
 FROM ranked WHERE rn<=3;
 v_lb := CASE WHEN v_likes>=500 THEN 200 WHEN v_likes>=250 THEN 125
   WHEN v_likes>=100 THEN 75 WHEN v_likes>=50 THEN 45
   WHEN v_likes>=25 THEN 25 WHEN v_likes>=10 THEN 10
   WHEN v_likes>=5 THEN 5 ELSE 0 END;
 v_cb := CASE WHEN v_comments>=250 AND v_commenters>=40 THEN 200
   WHEN v_comments>=100 AND v_commenters>=20 THEN 120
   WHEN v_comments>=50 AND v_commenters>=10 THEN 70
   WHEN v_comments>=25 AND v_commenters>=5 THEN 35
   WHEN v_comments>=10 AND v_commenters>=3 THEN 15
   WHEN v_comments>=5 AND v_commenters>=2 THEN 5 ELSE 0 END;
 RETURN jsonb_build_object('likes',v_likes,'comments',v_comments,
   'commenters',v_commenters,'likes_bonus',v_lb,'comments_bonus',v_cb);
END $fn$;
REVOKE ALL ON FUNCTION private.buklod_engagement_r4_post_bonus_v1(uuid) FROM PUBLIC,anon,authenticated;

-- Reward-only ceiling. It never blocks comments or other normal activity.
-- The existing R37 engagement economics remain the authority for base BP / BCU.
CREATE OR REPLACE FUNCTION private.buklod_engagement_r4_available_bonus_v1(
 p_user_id uuid,p_requested integer)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_day integer:=0; v_week integer:=0;
BEGIN
 SELECT coalesce(sum(points) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Manila')::date
        =(now() AT TIME ZONE 'Asia/Manila')::date),0)::int,
        coalesce(sum(points) FILTER (WHERE created_at>=now()-interval '7 days'),0)::int
 INTO v_day,v_week FROM public.buklod_points_ledger
 WHERE user_id=p_user_id AND direction='credit'
   AND activity_type IN (
    'community_post','community_comment','community_reaction',
    'r36_publish_wall','r36_publish_reel','r36_engager_reaction',
    'r36_engager_comment','r36_engager_reply','r36_engager_share',
    'community_mutual_support_chain','community_comment_helpful_bonus'
   ) AND created_at>=now()-interval '7 days';
 RETURN greatest(0,least(p_requested,60-v_day,300-v_week));
END $fn$;
REVOKE ALL ON FUNCTION private.buklod_engagement_r4_available_bonus_v1(uuid,integer) FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS private.buklod_engagement_r4_helpful_comment_state (
 comment_id uuid PRIMARY KEY REFERENCES public.comments(id) ON DELETE CASCADE,
 commenter_user_id uuid NOT NULL,
 credited_bp integer NOT NULL DEFAULT 0 CHECK(credited_bp BETWEEN 0 AND 10),
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.buklod_engagement_r4_helpful_comment_state FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.buklod_engagement_r4_settle_helpful_comment_v1(p_comment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_comment public.comments%rowtype; v_post public.community_posts%rowtype;
        v_activation timestamptz; v_likes integer:=0; v_target integer:=0;
        v_credited integer:=0; v_delta integer:=0; v_today integer:=0;
        v_id uuid;
BEGIN
 SELECT effective_at INTO v_activation FROM private.buklod_engagement_r4_rollout
 WHERE id=1 AND enabled;
 IF v_activation IS NULL THEN RETURN; END IF;
 SELECT * INTO v_comment FROM public.comments WHERE id=p_comment_id;
 IF NOT FOUND OR v_comment.created_at<v_activation OR v_comment.deleted_at IS NOT NULL
    OR coalesce(v_comment.is_hidden,false) THEN RETURN; END IF;
 SELECT * INTO v_post FROM public.community_posts WHERE id=v_comment.post_id;
 IF NOT FOUND OR v_post.created_at<v_activation OR v_post.deleted_at IS NOT NULL
    OR coalesce(v_post.is_hidden,false) OR v_comment.user_id=v_post.user_id THEN RETURN; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM private.buklod_r36_social_impact_events e
   WHERE e.source_entity_id=p_comment_id AND e.actor_user_id=v_comment.user_id
    AND e.policy_version='r37_standard_social_points_v1'
    AND e.qualification_state='qualified' AND e.engagement_kind IN ('comment','reply')
 ) THEN RETURN; END IF;
 SELECT count(DISTINCT user_id)::int INTO v_likes FROM public.comment_reactions
 WHERE comment_id=p_comment_id AND user_id<>v_comment.user_id;
 v_target:=CASE WHEN v_likes>=25 THEN 10 WHEN v_likes>=10 THEN 5
                  WHEN v_likes>=3 THEN 2 ELSE 0 END;
 IF v_target=0 THEN RETURN; END IF;
 -- One user/day mutex prevents multiple parallel comment threads from exceeding BP ceilings.
 PERFORM pg_advisory_xact_lock(hashtextextended('buklod:r4:bonus:'||v_comment.user_id::text,0));
 INSERT INTO private.buklod_engagement_r4_helpful_comment_state(comment_id,commenter_user_id)
 VALUES(p_comment_id,v_comment.user_id) ON CONFLICT DO NOTHING;
 SELECT credited_bp INTO v_credited FROM private.buklod_engagement_r4_helpful_comment_state
 WHERE comment_id=p_comment_id FOR UPDATE;
 v_delta:=greatest(v_target-v_credited,0);
 IF v_delta=0 THEN RETURN; END IF;
 SELECT coalesce(sum(points),0)::int INTO v_today FROM public.buklod_points_ledger
 WHERE user_id=v_comment.user_id AND direction='credit'
   AND activity_type='community_comment_helpful_bonus'
   AND (created_at AT TIME ZONE 'Asia/Manila')::date =
       (now() AT TIME ZONE 'Asia/Manila')::date;
 v_delta:=least(v_delta,greatest(0,20-v_today),
   private.buklod_engagement_r4_available_bonus_v1(v_comment.user_id,v_delta));
 IF v_delta<=0 THEN RETURN; END IF;
 INSERT INTO public.buklod_points_ledger(
   user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
 VALUES(v_comment.user_id,'credit',v_delta,'community_comment_helpful_bonus',
   'r4:helpful-comment:'||p_comment_id::text||':total-'||(v_credited+v_delta)::text,
   p_comment_id,'Qualified community comment reactions milestone',null::uuid)
 ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN RETURN; END IF;
 UPDATE private.buklod_engagement_r4_helpful_comment_state
 SET credited_bp=v_credited+v_delta,updated_at=now() WHERE comment_id=p_comment_id;
END $fn$;
REVOKE ALL ON FUNCTION private.buklod_engagement_r4_settle_helpful_comment_v1(uuid) FROM PUBLIC,anon,authenticated;

-- A support chain is a real conversation, not merely three accounts reacting.
CREATE OR REPLACE FUNCTION private.buklod_engagement_r4_settle_support_chain_v1(p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_post public.community_posts%rowtype; v_activation timestamptz;
        v_comment_count integer:=0; v_participants integer:=0; v_turns integer:=0;
        v_actor record; v_already integer:=0; v_award uuid;
BEGIN
 SELECT effective_at INTO v_activation FROM private.buklod_engagement_r4_rollout
 WHERE id=1 AND enabled;
 IF v_activation IS NULL THEN RETURN; END IF;
 SELECT * INTO v_post FROM public.community_posts WHERE id=p_post_id;
 IF NOT FOUND OR v_post.created_at<v_activation OR v_post.created_at<now()-interval '7 days'
    OR v_post.deleted_at IS NOT NULL OR coalesce(v_post.is_hidden,false) THEN RETURN; END IF;
 WITH qualified AS (
  SELECT e.actor_user_id,c.id,c.parent_id
  FROM private.buklod_r36_social_impact_events e
  JOIN public.comments c ON c.id=e.source_entity_id AND c.post_id=p_post_id
  WHERE e.content_id=p_post_id AND e.policy_version='r37_standard_social_points_v1'
   AND e.qualification_state='qualified' AND e.engagement_kind IN ('comment','reply')
   AND c.deleted_at IS NULL AND NOT coalesce(c.is_hidden,false)
 )
 SELECT count(*)::int,
        count(DISTINCT actor_user_id) FILTER(WHERE actor_user_id<>v_post.user_id)::int,
        count(*) FILTER(WHERE EXISTS(
          SELECT 1 FROM public.comments parent
          WHERE parent.id=q.parent_id AND parent.user_id<>q.actor_user_id
            AND parent.deleted_at IS NULL AND NOT coalesce(parent.is_hidden,false)))::int
 INTO v_comment_count,v_participants,v_turns FROM qualified q;
 IF v_comment_count<3 OR v_participants<2 OR v_turns<1 THEN RETURN; END IF;
 -- Stable selection of creator plus up to four first qualified contributors,
 -- then stable UUID lock ordering to avoid cycles on different conversations.
 FOR v_actor IN
  WITH participants AS (
   SELECT v_post.user_id AS uid, v_post.created_at AS first_seen,0 AS priority
   UNION ALL
   SELECT e.actor_user_id AS uid,min(e.occurred_at) AS first_seen,1 AS priority
   FROM private.buklod_r36_social_impact_events e
   JOIN public.comments c ON c.id=e.source_entity_id AND c.post_id=p_post_id
   WHERE e.content_id=p_post_id AND e.policy_version='r37_standard_social_points_v1'
     AND e.qualification_state='qualified' AND e.engagement_kind IN ('comment','reply')
     AND c.deleted_at IS NULL AND NOT coalesce(c.is_hidden,false)
     AND e.actor_user_id<>v_post.user_id
   GROUP BY e.actor_user_id
  ), selected AS (
   SELECT uid FROM participants ORDER BY priority,first_seen,uid LIMIT 5
  )
  SELECT uid FROM selected ORDER BY uid
 LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('buklod:r4:bonus:'||v_actor.uid::text,0));
  IF EXISTS (SELECT 1 FROM public.buklod_points_ledger
    WHERE user_id=v_actor.uid AND source_key='r4:support-chain:'||p_post_id::text||':'||v_actor.uid::text)
    THEN CONTINUE; END IF;
  SELECT count(*)::int INTO v_already FROM public.buklod_points_ledger
  WHERE user_id=v_actor.uid AND activity_type='community_mutual_support_chain'
    AND (created_at AT TIME ZONE 'Asia/Manila')::date =
       (now() AT TIME ZONE 'Asia/Manila')::date;
  IF v_already>=2 OR private.buklod_engagement_r4_available_bonus_v1(v_actor.uid,3)<3
    THEN CONTINUE; END IF;
  INSERT INTO public.buklod_points_ledger(
    user_id,direction,points,activity_type,source_key,source_id,description,awarded_by)
  VALUES(v_actor.uid,'credit',3,'community_mutual_support_chain',
    'r4:support-chain:'||p_post_id::text||':'||v_actor.uid::text,
    p_post_id,'Mutual Support Chain: three-member qualified discussion',null::uuid)
  ON CONFLICT(user_id,source_key) DO NOTHING RETURNING id INTO v_award;
 END LOOP;
END $fn$;
REVOKE ALL ON FUNCTION private.buklod_engagement_r4_settle_support_chain_v1(uuid) FROM PUBLIC,anon,authenticated;

-- AFTER triggers follow the pre-existing R37 trigger order; publishing still never waits for an ad.
CREATE OR REPLACE FUNCTION private.buklod_engagement_r4_post_trigger_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM private.buklod_engagement_r4_rollout r
   WHERE r.id=1 AND r.enabled AND NEW.created_at>=r.effective_at) THEN
    PERFORM private.buklod_r36_settle_creator_impact_v1(
       CASE WHEN coalesce(NEW.is_reel,false) THEN 'reel' ELSE 'wall' END,
       NEW.id,'r37_standard_social_points_v1');
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION private.buklod_engagement_r4_post_trigger_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zz_buklod_engagement_r4_post ON public.community_posts;
CREATE TRIGGER zz_buklod_engagement_r4_post AFTER INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION private.buklod_engagement_r4_post_trigger_v1();

CREATE OR REPLACE FUNCTION private.buklod_engagement_r4_comment_trigger_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 PERFORM private.buklod_engagement_r4_settle_support_chain_v1(NEW.post_id);
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION private.buklod_engagement_r4_comment_trigger_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zz_buklod_engagement_r4_comment ON public.comments;
CREATE TRIGGER zz_buklod_engagement_r4_comment AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION private.buklod_engagement_r4_comment_trigger_v1();

CREATE OR REPLACE FUNCTION private.buklod_engagement_r4_comment_reaction_trigger_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 PERFORM private.buklod_engagement_r4_settle_helpful_comment_v1(NEW.comment_id);
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION private.buklod_engagement_r4_comment_reaction_trigger_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zz_buklod_engagement_r4_comment_reaction ON public.comment_reactions;
CREATE TRIGGER zz_buklod_engagement_r4_comment_reaction AFTER INSERT ON public.comment_reactions
FOR EACH ROW EXECUTE FUNCTION private.buklod_engagement_r4_comment_reaction_trigger_v1();

-- For existing R37 reaction/response triggers, the creator settlement now
-- calculates one monotonically increasing total. Extra credits do not mint QMP or BCU.

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

