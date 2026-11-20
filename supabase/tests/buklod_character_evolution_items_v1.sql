-- Read-only deployment contract. Run only after applying the reviewed migration in isolated test DB.
DO $character_items_gate$
DECLARE v_getter text; v_claimer text;
BEGIN
 IF to_regclass('private.buklod_character_evolution_items_v1') IS NULL
    OR to_regclass('private.buklod_character_evolution_legacy_v1') IS NULL
    OR to_regclass('private.buklod_character_evolution_activity_v1') IS NULL
    THEN RAISE EXCEPTION 'Evolution authority tables missing'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.buklod_character_evolution_items_v1'::regclass)
    THEN RAISE EXCEPTION 'Evolution receipts must use RLS'; END IF;
 IF has_table_privilege('authenticated','private.buklod_character_evolution_items_v1','INSERT')
    OR has_table_privilege('authenticated','private.buklod_character_evolution_items_v1','SELECT')
    OR has_function_privilege('anon','public.claim_my_buklod_character_evolution_item_v1(integer,integer)','EXECUTE')
    THEN RAISE EXCEPTION 'Character items can be forged/read by client'; END IF;
 IF private.buklod_character_evolution_item_count_v1(1)<>2
   OR private.buklod_character_evolution_item_count_v1(5)<>3
   OR private.buklod_character_evolution_item_count_v1(10)<>4
   OR private.buklod_character_evolution_item_count_v1(15)<>5
   OR private.buklod_character_evolution_item_count_v1(20)<>0
    THEN RAISE EXCEPTION 'Stage item count regressed'; END IF;
 IF private.buklod_character_evolution_task_target_v1(1,2,1)
    <= private.buklod_character_evolution_task_target_v1(1,1,1)
    THEN RAISE EXCEPTION 'Task difficulty not progressive'; END IF;
 SELECT pg_get_functiondef('public.get_my_buklod_character_selection_v2()'::regprocedure) INTO v_getter;
 SELECT pg_get_functiondef('public.claim_my_buklod_character_evolution_item_v1(integer,integer)'::regprocedure) INTO v_claimer;
 IF position('buklod_character_evolution_level_v1' IN v_getter)=0
    OR position('buklod_character_evolution_task_count_v1' IN v_claimer)=0
    OR position('auth.uid()' IN v_claimer)=0
    THEN RAISE EXCEPTION 'Server gate or claim validator missing'; END IF;
END;
$character_items_gate$;
