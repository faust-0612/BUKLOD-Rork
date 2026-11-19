-- BUKLOD S2 WEEKLY PERFORMANCE R1 — STAGING CANDIDATE / NOT A MIGRATION.
-- Never run on BUKLOD production or Season 1 backend. This file is deliberately
-- outside supabase/migrations. Requires a separately verified staging database.
-- No BP, QMP, AdMob, Character inventory, Season 1 reward, payout or Circle Rank writes.
-- Classification evidence: SERVER-CLAIMED credit events only. Pending/unclaimed,
-- basic comments, reactions, logins, and self-reported events never score.
BEGIN;

CREATE OR REPLACE FUNCTION public.buklod_weekly_performance_batch_s2(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, week_start date, class_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
  SELECT x.user_id,x.week_start,x.class_code
  FROM private.buklod_weekly_performance_core_s2(p_user_ids) x
  WHERE auth.uid() IS NOT NULL
    AND cardinality(p_user_ids) BETWEEN 1 AND 40;
$fn$;

-- Backend computation shared by public badge and owner's private explanation.
-- Deliberately narrow to 40 users; no unbounded all-member ranking table scan.
CREATE OR REPLACE FUNCTION private.buklod_weekly_performance_core_s2(p_user_ids uuid[])
RETURNS TABLE(
  user_id uuid, week_start date, class_code text, score integer,
  active_days integer, learning_days integer, community_days integer,
  creation_days integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
  WITH clock AS (
    SELECT date_trunc('week', now() AT TIME ZONE 'Asia/Manila')::date AS week_start
  ),
  bounds AS (
    SELECT week_start,
      week_start::timestamp AT TIME ZONE 'Asia/Manila' AS starts_at,
      (week_start + 7)::timestamp AT TIME ZONE 'Asia/Manila' AS ends_at
    FROM clock
  ),
  members AS (
    SELECT DISTINCT p.id AS user_id
    FROM unnest(p_user_ids) AS input(id)
    JOIN public.profiles p ON p.id=input.id
    WHERE auth.uid() IS NOT NULL
      AND cardinality(p_user_ids) BETWEEN 1 AND 40
      AND p.is_active = true
      AND NOT private.buklod_is_platform_official_v1(p.id)
  ),
  verified AS (
    SELECT l.user_id,
      (l.created_at AT TIME ZONE 'Asia/Manila')::date AS manila_day,
      CASE
        WHEN l.activity_type IN
          ('daily_bible','devotional','abc_growth_lesson',
           'bible_quiz_easy','bible_quiz_medium','bible_quiz_hard',
           'learning_progress_verification','kl_episode_completion')
          THEN 'learning'
        WHEN l.activity_type IN
          ('community_mutual_support_chain','r36_creator_impact')
          THEN 'community'
        WHEN l.activity_type IN
          ('reflection_quality_bonus','weekly_tip_dugtong','r36_publish_wall')
          THEN 'creation'
        ELSE NULL
      END AS category
    FROM public.buklod_points_ledger l
    JOIN members m ON m.user_id=l.user_id
    CROSS JOIN bounds b
    WHERE l.created_at >= b.starts_at AND l.created_at < b.ends_at
      AND l.direction='credit' AND l.claim_state='claimed' AND l.points>0
      AND l.activity_type IN (
        'daily_bible','devotional','abc_growth_lesson',
        'bible_quiz_easy','bible_quiz_medium','bible_quiz_hard',
        'learning_progress_verification','kl_episode_completion',
        'community_mutual_support_chain','r36_creator_impact',
        'reflection_quality_bonus','weekly_tip_dugtong','r36_publish_wall'
      )
      -- Original Wall content must still exist and be non-hidden / non-deleted.
      -- A duplicate body within the same user/week cannot generate new performance days.
      AND (
        l.activity_type <> 'r36_publish_wall'
        OR EXISTS (
          SELECT 1 FROM public.community_posts p
          WHERE p.id=l.source_id AND p.user_id=l.user_id
            AND p.deleted_at IS NULL AND NOT coalesce(p.is_hidden,false)
            AND NOT coalesce(p.author_only,false)
            AND length(trim(coalesce(p.body,''))) >= 40
            AND NOT EXISTS (
              SELECT 1 FROM public.community_posts earlier
              WHERE earlier.user_id=p.user_id AND earlier.id<>p.id
                AND earlier.created_at>=p.created_at-interval '7 days'
                AND earlier.created_at<p.created_at
                AND lower(trim(coalesce(earlier.body,'')))=lower(trim(p.body))
            )
        )
      )
      AND (
        l.activity_type <> 'r36_creator_impact'
        OR EXISTS (
          SELECT 1 FROM public.community_posts p
          WHERE p.id=l.source_id AND p.user_id=l.user_id
            AND p.deleted_at IS NULL AND NOT coalesce(p.is_hidden,false)
        )
      )
  ),
  per_day AS (
    SELECT DISTINCT v.user_id, v.manila_day, v.category
    FROM verified v WHERE v.category IS NOT NULL
  ),
  totals AS (
    SELECT d.user_id,
      count(DISTINCT d.manila_day)::integer AS active_days,
      count(*) FILTER (WHERE d.category='learning')::integer AS learning_days,
      count(*) FILTER (WHERE d.category='community')::integer AS community_days,
      count(*) FILTER (WHERE d.category='creation')::integer AS creation_days
    FROM per_day d GROUP BY d.user_id
  ),
  normalized AS (
    SELECT m.user_id,b.week_start,
      least(7,coalesce(t.active_days,0)) AS active_days,
      least(5,coalesce(t.learning_days,0)) AS learning_days,
      least(5,coalesce(t.community_days,0)) AS community_days,
      least(5,coalesce(t.creation_days,0)) AS creation_days
    FROM members m CROSS JOIN bounds b
    LEFT JOIN totals t ON t.user_id=m.user_id
  ),
  scored AS (
    SELECT n.*,
      least(100,n.active_days*5+n.learning_days*6+
        n.community_days*7+n.creation_days*6)::integer AS score,
      (n.learning_days>0)::integer+(n.community_days>0)::integer+
        (n.creation_days>0)::integer AS category_count
    FROM normalized n
  )
  SELECT s.user_id,s.week_start,
    CASE WHEN s.score>=85 AND s.active_days>=4 AND s.category_count>=2
      THEN 'exceptional'
      WHEN s.score>=60 AND s.active_days>=3 AND s.category_count>=2
      THEN 'thrive'
      WHEN s.score>=25 AND s.active_days>=2 THEN 'active'
      WHEN s.score>0 THEN 'emerging' ELSE 'unrated' END,
    s.score,s.active_days,s.learning_days,s.community_days,s.creation_days
  FROM scored s;
$fn$;

-- Private breakdown: ONLY the authenticated subject; no arbitrary target UUID.
CREATE OR REPLACE FUNCTION public.get_my_buklod_weekly_performance_s2()
RETURNS TABLE(
  user_id uuid,week_start date,class_code text,score integer,
  active_days integer,learning_days integer,
  community_days integer,creation_days integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
  SELECT c.user_id,c.week_start,c.class_code,c.score,c.active_days,
         c.learning_days,c.community_days,c.creation_days
  FROM private.buklod_weekly_performance_core_s2(ARRAY[auth.uid()]) c
  WHERE auth.uid() IS NOT NULL AND c.user_id=auth.uid();
$fn$;

-- SECURITY: Never expose the core or reward tables to untrusted clients.
REVOKE ALL ON FUNCTION private.buklod_weekly_performance_core_s2(uuid[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.buklod_weekly_performance_batch_s2(uuid[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_my_buklod_weekly_performance_s2() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_weekly_performance_batch_s2(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_buklod_weekly_performance_s2() TO authenticated;

-- Reward-grant design: intentionally non-payable/non-claimable preview.
-- The future server-only award path must use PRIMARY KEY(user_id,week_start),
-- verified closed-week evidence, and a separate owner-authorized Season2 control.
-- Do not create ledger entries or mint any BP, cash, QMP, tokens or cosmetics here.
COMMIT;
