-- BUKLOD R37 — standard social points normalization
-- Forward-only policy cutover. Historical ledger rows are preserved.
-- Routine social participation stays within the canonical 1–2 point range;
-- qualified/impact rewards remain separate.

-- Create the successor as STAGED first because the policy table enforces
-- exactly one ACTIVE row at a time.
insert into private.buklod_r36_economy_policy_versions (
  policy_version,
  status,
  effective_at,
  supersedes_policy_version,
  config,
  activated_at
)
select
  'r37_standard_social_points_v1',
  'staged',
  now(),
  'r36_social_economy_v1',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        p.config,
        '{policy_family}',
        to_jsonb('buklod_r37_standard_social_points'::text),
        true
      ),
      '{engager_economics,meaningful_comment,cp_each}',
      '2'::jsonb,
      true
    ),
    '{engager_economics,reply,cp_each}',
    '2'::jsonb,
    true
  ),
  null
from private.buklod_r36_economy_policy_versions p
where p.policy_version = 'r36_social_economy_v1'
  and not exists (
    select 1
    from private.buklod_r36_economy_policy_versions x
    where x.policy_version = 'r37_standard_social_points_v1'
  );

-- Preserve the old policy row for historical audit, but stop using it for
-- new social events.
update private.buklod_r36_economy_policy_versions
set status = 'retired'
where policy_version = 'r36_social_economy_v1'
  and status = 'active';

update private.buklod_r36_economy_policy_versions
set
  status = 'active',
  effective_at = coalesce(effective_at, now()),
  activated_at = coalesce(activated_at, now())
where policy_version = 'r37_standard_social_points_v1';

-- R37 keeps all R36 anti-farming / event-recording / settlement machinery,
-- but uses a small route guard that validates the successor policy itself.
create or replace function private.buklod_r37_social_route_v1()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_effective_at timestamptz;
  v_config jsonb;
  v_activation jsonb;
begin
  select p.status, p.effective_at, p.config
  into v_status, v_effective_at, v_config
  from private.buklod_r36_economy_policy_versions p
  where p.policy_version = 'r37_standard_social_points_v1';

  if v_config is null
     or v_status <> 'active'
     or v_effective_at is null
     or v_effective_at > now() then
    return 'legacy';
  end if;

  v_activation := coalesce(v_config->'activation', '{}'::jsonb);

  if not coalesce((v_activation->>'social_event_recording_enabled')::boolean, false)
     or not coalesce((v_activation->>'engager_economics_enabled')::boolean, false)
     or not coalesce((v_activation->>'publisher_economics_enabled')::boolean, false)
     or not coalesce((v_activation->>'creator_impact_settlement_enabled')::boolean, false)
     or not coalesce((v_activation->>'legacy_social_publish_cutover_completed')::boolean, false) then
    return 'legacy';
  end if;

  return 'r37';
exception
  when others then
    return 'legacy';
end;
$$;

-- Settle NEW social events under R37. Existing ledger rows remain unchanged.
create or replace function public.community_post_points_trigger_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.buklod_r37_social_route_v1() = 'r37' then
    perform private.buklod_r36_settle_publish_v1(
      new.id,
      'r37_standard_social_points_v1'
    );
  else
    perform public.credit_community_social_points_v2(
      new.user_id,
      'community_post',
      'community_post:' || new.id::text,
      new.id
    );
  end if;
  return new;
end;
$$;

create or replace function public.community_comment_points_trigger_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.buklod_r37_social_route_v1() = 'r37' then
    perform private.buklod_r36_process_comment_v1(
      new.id,
      'r37_standard_social_points_v1'
    );
  else
    perform public.credit_community_social_points_v2(
      new.user_id,
      'community_comment',
      'community_comment:' || new.id::text,
      new.id
    );
  end if;
  return new;
end;
$$;

create or replace function public.community_reaction_points_trigger_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.buklod_r37_social_route_v1() = 'r37' then
    perform private.buklod_r36_process_reaction_v1(
      new.post_id,
      new.user_id,
      'r37_standard_social_points_v1'
    );
  else
    perform public.credit_community_social_points_v2(
      new.user_id,
      'community_reaction',
      'community_reaction:' || new.post_id::text || ':' || new.user_id::text,
      new.post_id
    );
  end if;
  return new;
end;
$$;

create or replace function public.community_share_points_trigger_r36_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.buklod_r37_social_route_v1() = 'r37' then
    perform private.buklod_r36_process_share_v1(
      new.id,
      'r37_standard_social_points_v1'
    );
  end if;
  return new;
end;
$$;
