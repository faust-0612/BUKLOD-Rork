-- Remove the remaining verbatim repeat in the V4 learning bank only.
-- The original R3 quiz bank stays unchanged for older clients.
update private.buklod_bible_v4_questions
set prompt='Sino ang dumalaw kay Elisabet matapos ibalita ng anghel na magkakaanak siya?',
    concept_key='e.mary_visits_elizabeth',
    scripture_reference='Lucas 1:39–40',
    rationale='Si Maria ang nagpunta sa tahanan ni Zacarias at bumati kay Elisabet.'
where id='r3_e1' and kind='mcq' and correct_choice='A' and options->>'A'='Maria';
do $qa$
begin
 if exists (
   select 1 from private.buklod_bible_v4_questions
   where active and reviewed
   group by prompt having count(*)>1
 ) then raise exception 'V4 bank still has duplicate prompts'; end if;
end $qa$;
