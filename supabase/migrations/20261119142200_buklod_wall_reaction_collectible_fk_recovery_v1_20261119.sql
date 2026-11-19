-- BUKLOD MAIN | public Wall reaction 409 FK emergency repair
-- 2026-11-19: three POST /rest/v1/rpc/set_buklod_post_reaction_v3
-- failures at ~13:55 UTC caused by FK 23503 on collectible awards.
-- Do not change rules, remove triggers, or modify historical awards.
-- Applied to BUKLOD MAIN production at 2026-11-19 14:22 UTC; all live DB contract checks passed.
-- Preserve original reward rules and legacy award foreign key.

-- Refuse to overwrite an independently modified production implementation.
DO $buklod_wall_reaction_baseline$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('private.buklod_character_record_public_metric_v3(uuid,text,text,text,timestamptz,jsonb)'::regprocedure)
  INTO v_definition;
  IF position('perform private.buklod_eval_special_collectibles_v2(p_user_id,v_event_id);' IN v_definition)=0
    AND position('perform private.buklod_eval_special_collectibles_v2(p_user_id,null);' IN v_definition)=0
  THEN
    RAISE EXCEPTION 'Unrecognized character metric provenance implementation; reconcile before applying Wall reaction fix';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='private.buklod_special_collectible_awards_v2'::regclass
      AND conname='buklod_special_collectible_awards_v2_trigger_event_id_fkey'
      AND confrelid='private.buklod_achievement_events_v2'::regclass
  ) THEN
    RAISE EXCEPTION 'Collectible provenance FK changed; reconcile before applying Wall reaction fix';
  END IF;
END
$buklod_wall_reaction_baseline$;

create or replace function private.buklod_character_record_public_metric_v3(
  p_user_id uuid,
  p_metric_key text,
  p_source_table text,
  p_source_id text,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_metric text := lower(btrim(coalesce(p_metric_key,'')));
  v_when timestamptz := coalesce(p_occurred_at,now());
  v_cap integer := 0;
  v_day date;
  v_week date;
  v_count integer := 0;
  v_event_id bigint;
  v_week_event_id bigint;
begin
  if p_user_id is null or nullif(btrim(coalesce(p_source_id,'')),'') is null then
    return false;
  end if;
  if v_metric not in ('character_public_post','character_public_comment','character_public_reaction','character_public_share') then
    return false;
  end if;

  v_cap := case v_metric
    when 'character_public_post' then 3
    when 'character_public_comment' then 8
    when 'character_public_reaction' then 12
    when 'character_public_share' then 5
    else 0
  end;
  v_day := (v_when at time zone 'Asia/Manila')::date;

  select count(*)::integer into v_count
  from private.buklod_character_public_events_v3 e
  where e.user_id=p_user_id
    and e.metric_key=v_metric
    and (e.occurred_at at time zone 'Asia/Manila')::date=v_day;

  if v_cap <= 0 or v_count >= v_cap then
    return false;
  end if;

  insert into private.buklod_character_public_events_v3(
    user_id,metric_key,source_table,source_id,occurred_at,metadata
  ) values (
    p_user_id,v_metric,btrim(p_source_table),btrim(p_source_id),v_when,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return false;
  end if;

  insert into private.buklod_character_public_metrics_v3(user_id,metric_key,metric_value)
  values(p_user_id,v_metric,1)
  on conflict(user_id,metric_key) do update
    set metric_value=private.buklod_character_public_metrics_v3.metric_value+1,
        updated_at=now();

  insert into private.buklod_character_public_metrics_v3(user_id,metric_key,metric_value)
  values(p_user_id,'character_public_actions',1)
  on conflict(user_id,metric_key) do update
    set metric_value=private.buklod_character_public_metrics_v3.metric_value+1,
        updated_at=now();

  v_week := date_trunc('week',v_when at time zone 'Asia/Manila')::date;
  insert into private.buklod_character_public_events_v3(
    user_id,metric_key,source_table,source_id,occurred_at,metadata
  ) values (
    p_user_id,'character_public_active_week','character_public_week',v_week::text,v_when,
    jsonb_build_object('week_start',v_week)
  )
  on conflict do nothing
  returning id into v_week_event_id;

  if v_week_event_id is not null then
    insert into private.buklod_character_public_metrics_v3(user_id,metric_key,metric_value)
    values(p_user_id,'character_public_active_weeks',1)
    on conflict(user_id,metric_key) do update
      set metric_value=private.buklod_character_public_metrics_v3.metric_value+1,
          updated_at=now();
  end if;

  -- The collectible award's legacy trigger_event_id FK references
  -- private.buklod_achievement_events_v2, NOT
  -- private.buklod_character_public_events_v3 (the source of v_event_id).
  -- NULL is allowed and avoids false provenance and transaction rollback.
  -- Award requirements, points, limits and event accounting stay unchanged.
  perform private.buklod_eval_special_collectibles_v2(p_user_id,null);
  return true;
end;
$$;

-- Preserve existing private RPC surface: the function is trigger-only,
-- never a directly accessible member/admin API.
REVOKE ALL ON FUNCTION private.buklod_character_record_public_metric_v3(uuid,text,text,text,timestamptz,jsonb)
  FROM PUBLIC, anon, authenticated;
