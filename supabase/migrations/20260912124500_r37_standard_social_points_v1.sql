-- BUKLOD R37 — standard social points normalization
-- Forward-only policy cutover. Historical ledger rows are preserved.
-- Routine social participation stays within the canonical 1–2 point range;
-- qualified/impact rewards remain separate.

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
  'active',
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
  now()
from private.buklod_r36_economy_policy_versions p
where p.policy_version = 'r36_social_economy_v1'
  and not exists (
    select 1
    from private.buklod_r36_economy_policy_versions x
    where x.policy_version = 'r37_standard_social_points_v1'
  );

-- Keep the proven R36 cutover/readiness gate, but settle NEW social events
-- under the forward-only R37 policy. This avoids rewriting historical awards.
create or replace function public.community_post_points_trigger_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.buklod_r36_social_route_v1() = 'r36' then
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
  if private.buklod_r36_social_route_v1() = 'r36' then
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
  if private.buklod_r36_social_route_v1() = 'r36' then
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
  if private.buklod_r36_social_route_v1() = 'r36' then
    perform private.buklod_r36_process_share_v1(
      new.id,
      'r37_standard_social_points_v1'
    );
  end if;
  return new;
end;
$$;
