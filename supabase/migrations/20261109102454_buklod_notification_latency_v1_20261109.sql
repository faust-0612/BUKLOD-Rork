-- BUKLOD notification freshness R1. RC-gated; do not apply before safe release.
-- Fix two membership rows for the same person/scope producing duplicate welcome events.
-- Keep event privacy, target selection and the existing PTT push path unchanged.
create or replace function private.buklod_living_member_welcome_v1()
returns trigger language plpgsql security definer set search_path='' as $living$
declare
  v_scope_type text;
  v_scope_name text;
  v_name text;
begin
  if new.membership_status <> 'ACTIVE' or
    (tg_op='UPDATE' and old.membership_status='ACTIVE') then return new; end if;
  select s.scope_type,s.name into v_scope_type,v_scope_name from public.buklod_scopes s
  where s.id=new.scope_id and s.status='ACTIVE';
  if v_scope_type is null or v_scope_type not in ('CLUSTER','ORGANIZATION') then return new; end if;
  select coalesce(nullif(pg_catalog.btrim(p.full_name),''),'bagong miyembro')
    into v_name from public.profiles p where p.id=new.user_id;
  insert into private.buklod_living_greeting_events_v1
    (event_key,kind,actor_id,scope_id,title,body,route,expires_at)
  values (
    -- Deduplicate at the actual recipient event identity (person + scope).
    -- A later genuine join is eligible again after event retention cleanup.
    'membership:scope-user:'||new.scope_id::text||':'||new.user_id::text,
    'cluster_welcome',new.user_id,new.scope_id,
    left('Welcome, '||coalesce(v_name,'bagong miyembro')||'!',140),
    left('Kasama na si '||coalesce(v_name,'bagong miyembro')||' sa '||
      coalesce(v_scope_name,'BUKLOD')||'. Batiin siya sa Community!',450),
    '/member/'||new.user_id::text,now()+interval '48 hours'
  ) on conflict(event_key) do nothing;
  return new;
end;
$living$;
revoke all on function private.buklod_living_member_welcome_v1() from public,anon,authenticated;

-- The original worker is intentionally unchanged: it has transaction-scoped
-- advisory locking, recipient deduplication, privacy checks and a 100-user cap.
-- The existing cron processed only one event or one 100-recipient slice/minute.
-- A bounded wrapper clears several pending slices per tick without parallel jobs.
create or replace function private.buklod_living_dispatch_batch_v1(
  p_iterations integer default 6,
  p_recipients_per_iteration integer default 100
)
returns integer language plpgsql security definer set search_path='' as $living$
declare
  v_i integer;
  v_total integer := 0;
begin
  for v_i in 1..least(greatest(coalesce(p_iterations,1),1),6) loop
    v_total := v_total + private.buklod_living_dispatch_greetings_v1(
      least(greatest(coalesce(p_recipients_per_iteration,100),1),100)
    );
  end loop;
  return v_total;
end;
$living$;
revoke all on function private.buklod_living_dispatch_batch_v1(integer,integer)
  from public,anon,authenticated;
-- Same job name: replace schedule, do not create a second dispatcher.
select cron.schedule(
  'buklod-living-greetings-dispatch-v1','* * * * *',
  'select private.buklod_living_dispatch_batch_v1(6,100)'
);
