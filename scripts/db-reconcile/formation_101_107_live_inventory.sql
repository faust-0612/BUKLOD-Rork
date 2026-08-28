-- BUKLOD Formation 101-107 live inventory (read-only)
-- Run against linked production database

\echo '=== STAGE SUMMARY ==='
SELECT stage_code, COUNT(*) AS track_count
FROM public.buklod_formation_role_tracks
WHERE stage_code BETWEEN '101' AND '107'
GROUP BY stage_code
ORDER BY stage_code;

\echo '=== ROLE TRACKS 101-107 ==='
SELECT
  rt.stage_code AS stage,
  rt.track_code,
  rt.title AS track_title,
  rt.id AS track_id,
  rt.is_active,
  rt.sort_order
FROM public.buklod_formation_role_tracks rt
WHERE rt.stage_code BETWEEN '101' AND '107'
ORDER BY rt.stage_code, rt.sort_order, rt.track_code;

\echo '=== TRACK LESSONS 101-107 ==='
SELECT
  rt.stage_code AS stage,
  rt.track_code,
  rt.title AS track_title,
  tl.id AS track_lesson_id,
  tl.lesson_order,
  tl.title AS lesson_title,
  tl.learning_lesson_id,
  tl.is_active AS lesson_active,
  tl.source_key,
  tl.source_batch
FROM public.buklod_formation_role_tracks rt
JOIN public.buklod_formation_track_lessons tl ON tl.role_track_id = rt.id
WHERE rt.stage_code BETWEEN '101' AND '107'
ORDER BY rt.stage_code, rt.sort_order, rt.track_code, tl.lesson_order;

\echo '=== LESSON VERSIONS 101-107 ==='
SELECT
  rt.stage_code AS stage,
  rt.track_code,
  tl.lesson_order,
  tl.title AS lesson_title,
  tlv.id AS version_id,
  tlv.version_no,
  tlv.publication_status,
  tlv.review_status,
  tlv.approved_at IS NOT NULL AS approved,
  tlv.published_at IS NOT NULL AS published,
  length(coalesce(tlv.body_md, '')) AS body_len,
  tlv.source_provenance,
  tlv.learning_lesson_id,
  tl.id AS track_lesson_id,
  public.buklod_formation_track_lesson_is_member_visible(tl.id) AS member_visible
FROM public.buklod_formation_role_tracks rt
JOIN public.buklod_formation_track_lessons tl ON tl.role_track_id = rt.id
LEFT JOIN LATERAL (
  SELECT *
  FROM public.buklod_formation_lesson_versions v
  WHERE v.track_lesson_id = tl.id
  ORDER BY v.version_no DESC
  LIMIT 1
) tlv ON true
WHERE rt.stage_code BETWEEN '101' AND '107'
ORDER BY rt.stage_code, rt.track_code, tl.lesson_order;

\echo '=== 106 COUNTS ==='
SELECT
  (SELECT COUNT(*) FROM public.buklod_formation_role_tracks WHERE stage_code = '106') AS role_tracks,
  (SELECT COUNT(*) FROM public.buklod_formation_track_lessons tl
     JOIN public.buklod_formation_role_tracks rt ON rt.id = tl.role_track_id
     WHERE rt.stage_code = '106') AS track_lessons,
  (SELECT COUNT(*) FROM public.buklod_formation_lesson_versions v
     JOIN public.buklod_formation_track_lessons tl ON tl.id = v.track_lesson_id
     JOIN public.buklod_formation_role_tracks rt ON rt.id = tl.role_track_id
     WHERE rt.stage_code = '106') AS version_rows;

\echo '=== 107 COUNTS ==='
SELECT
  (SELECT COUNT(*) FROM public.buklod_formation_role_tracks WHERE stage_code = '107') AS role_tracks,
  (SELECT COUNT(*) FROM public.buklod_formation_track_lessons tl
     JOIN public.buklod_formation_role_tracks rt ON rt.id = tl.role_track_id
     WHERE rt.stage_code = '107') AS track_lessons,
  (SELECT COUNT(*) FROM public.buklod_formation_lesson_versions v
     JOIN public.buklod_formation_track_lessons tl ON tl.id = v.track_lesson_id
     JOIN public.buklod_formation_role_tracks rt ON rt.id = tl.role_track_id
     WHERE rt.stage_code = '107') AS version_rows;

\echo '=== LEARNING TRACKS FORMATION 101-107 ==='
SELECT id, code, title, stage_code, status, sort_order
FROM public.learning_tracks
WHERE stage_code BETWEEN '101' AND '107'
   OR code ILIKE '%101%' OR code ILIKE '%102%' OR code ILIKE '%103%'
   OR code ILIKE '%104%' OR code ILIKE '%105%' OR code ILIKE '%106%' OR code ILIKE '%107%'
ORDER BY stage_code NULLS LAST, sort_order;

\echo '=== LEARNING LESSONS FORMATION-LINKED ==='
SELECT
  ll.id,
  ll.title,
  ll.track_id,
  lt.code AS track_code,
  lt.stage_code,
  ll.sort_order,
  ll.status,
  length(coalesce(ll.content, '')) AS content_len
FROM public.learning_lessons ll
JOIN public.learning_tracks lt ON lt.id = ll.track_id
WHERE lt.stage_code BETWEEN '101' AND '107'
ORDER BY lt.stage_code, ll.sort_order;

\echo '=== PROGRESS REFERENCES BY STAGE ==='
SELECT
  rt.stage_code,
  COUNT(DISTINCT fp.user_id) AS users_with_progress,
  COUNT(*) AS progress_rows
FROM public.buklod_formation_progress fp
JOIN public.buklod_formation_role_tracks rt ON rt.id = fp.role_track_id
WHERE rt.stage_code BETWEEN '101' AND '107'
GROUP BY rt.stage_code
ORDER BY rt.stage_code;

\echo '=== QUESTIONS / ACTIVITIES BY STAGE ==='
SELECT
  rt.stage_code,
  COUNT(DISTINCT fq.id) FILTER (WHERE fq.id IS NOT NULL) AS formation_questions,
  COUNT(DISTINCT fa.id) FILTER (WHERE fa.id IS NOT NULL) AS formation_activities
FROM public.buklod_formation_role_tracks rt
JOIN public.buklod_formation_track_lessons tl ON tl.role_track_id = rt.id
LEFT JOIN public.buklod_formation_lesson_versions tlv ON tlv.track_lesson_id = tl.id
LEFT JOIN public.buklod_formation_questions fq ON fq.lesson_version_id = tlv.id
LEFT JOIN public.buklod_formation_activities fa ON fa.lesson_version_id = tlv.id
WHERE rt.stage_code BETWEEN '101' AND '107'
GROUP BY rt.stage_code
ORDER BY rt.stage_code;

\echo '=== 106 DRAFT DETAIL ==='
SELECT
  rt.track_code,
  tl.lesson_order,
  tl.title,
  tlv.publication_status,
  tlv.review_status,
  length(coalesce(tlv.body_md, '')) AS body_len,
  tlv.source_provenance,
  (SELECT COUNT(*) FROM public.buklod_formation_questions q WHERE q.lesson_version_id = tlv.id) AS questions,
  (SELECT COUNT(*) FROM public.buklod_formation_activities a WHERE a.lesson_version_id = tlv.id) AS activities
FROM public.buklod_formation_role_tracks rt
JOIN public.buklod_formation_track_lessons tl ON tl.role_track_id = rt.id
LEFT JOIN LATERAL (
  SELECT * FROM public.buklod_formation_lesson_versions v
  WHERE v.track_lesson_id = tl.id ORDER BY v.version_no DESC LIMIT 1
) tlv ON true
WHERE rt.stage_code = '106'
ORDER BY rt.track_code, tl.lesson_order;

\echo '=== 107 DRAFT DETAIL ==='
SELECT
  rt.track_code,
  tl.lesson_order,
  tl.title,
  tlv.publication_status,
  tlv.review_status,
  length(coalesce(tlv.body_md, '')) AS body_len,
  tlv.source_provenance,
  (SELECT COUNT(*) FROM public.buklod_formation_questions q WHERE q.lesson_version_id = tlv.id) AS questions,
  (SELECT COUNT(*) FROM public.buklod_formation_activities a WHERE a.lesson_version_id = tlv.id) AS activities
FROM public.buklod_formation_role_tracks rt
JOIN public.buklod_formation_track_lessons tl ON tl.role_track_id = rt.id
LEFT JOIN LATERAL (
  SELECT * FROM public.buklod_formation_lesson_versions v
  WHERE v.track_lesson_id = tl.id ORDER BY v.version_no DESC LIMIT 1
) tlv ON true
WHERE rt.stage_code = '107'
ORDER BY rt.track_code, tl.lesson_order;

\echo '=== MEMBER CURRICULUM DELIVERY 106/107 ==='
SELECT *
FROM public.buklod_formation_member_curriculum_delivery
WHERE stage_code IN ('106', '107')
ORDER BY stage_code, role_track_id, lesson_order
LIMIT 200;

\echo '=== STAGE GATES ==='
SELECT * FROM public.buklod_formation_stage_gates ORDER BY stage_code;

\echo '=== COMMERCIAL / FAITH ACCESS CONFIG ==='
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name ILIKE '%faith%' OR table_name ILIKE '%commercial%' OR table_name ILIKE '%formation%access%' OR table_name ILIKE '%focus%')
ORDER BY 1;
