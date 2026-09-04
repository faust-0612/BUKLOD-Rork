-- BUKLOD Classroom Quiz Dedicated Gradebook R1 ACL lockdown
-- Reproducible source-control mirror of the production hardening migration.
-- Additive security only: no data reset or mutation.

revoke all on function public.buklod_education_import_quiz_scores_v4(uuid,uuid,uuid,text,numeric,uuid,text,jsonb) from public;
revoke all on function public.buklod_education_import_quiz_scores_v4(uuid,uuid,uuid,text,numeric,uuid,text,jsonb) from anon;
grant execute on function public.buklod_education_import_quiz_scores_v4(uuid,uuid,uuid,text,numeric,uuid,text,jsonb) to authenticated;
