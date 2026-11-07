-- BUKLOD Quiz selection predicate check. READ-ONLY and data-free;
-- validates the fail-closed fallback for historical sessions with 200
-- bank questions but only 100 selected. Does NOT replace real RPC E2E
-- tests in an isolated RC.
BEGIN READ ONLY;

WITH bank AS (
 SELECT generate_series(1,200)::integer question_id
),
scenarios AS (
 SELECT * FROM (VALUES
  ('LIVE_SELECTED_100'::text,true,100,ARRAY(SELECT generate_series(1,100))),
  ('LIVE_MISSING_SELECTION_100'::text,true,100,ARRAY[]::integer[]),
  ('LIVE_FULL_BANK_200'::text,true,200,ARRAY[]::integer[]),
  ('NONLIVE_FULL_BANK'::text,false,0,ARRAY[]::integer[])
 ) t(label,is_live,question_count,selected_ids)
),
result AS (
 SELECT s.label,count(*)::integer returned_questions
 FROM scenarios s CROSS JOIN bank q
 WHERE NOT s.is_live
   OR (
      (coalesce(array_length(s.selected_ids,1),0)>0
       AND q.question_id=ANY(s.selected_ids))
      OR (
       coalesce(array_length(s.selected_ids,1),0)=0
       AND s.question_count>=200
      )
   )
 GROUP BY s.label
)
SELECT s.label,coalesce(r.returned_questions,0) as returned_questions,
 CASE s.label
  WHEN 'LIVE_SELECTED_100' THEN 100
  WHEN 'LIVE_MISSING_SELECTION_100' THEN 0
  WHEN 'LIVE_FULL_BANK_200' THEN 200
  WHEN 'NONLIVE_FULL_BANK' THEN 200
 END AS expected,
 COALESCE(r.returned_questions,0)=CASE s.label
  WHEN 'LIVE_SELECTED_100' THEN 100
  WHEN 'LIVE_MISSING_SELECTION_100' THEN 0
  WHEN 'LIVE_FULL_BANK_200' THEN 200
  WHEN 'NONLIVE_FULL_BANK' THEN 200
 END AS passes
FROM scenarios s LEFT JOIN result r USING(label)
ORDER BY s.label
;
COMMIT;
