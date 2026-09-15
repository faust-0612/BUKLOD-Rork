-- BUKLOD IGPAT R61 — client compatibility wrapper.
-- The core analytics function keeps canonical aggregate names; this wrapper
-- also exposes the current UI aliases without inventing unavailable Like data.

alter function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer)
  rename to get_my_buklod_igpat_creator_analytics_core_v1;

create or replace function public.get_my_buklod_igpat_creator_analytics_v1(
  p_days integer default 30,
  p_limit integer default 10
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select public.get_my_buklod_igpat_creator_analytics_core_v1(p_days, p_limit) as payload
  ), normalized_posts as (
    select coalesce(jsonb_agg(
      item || jsonb_build_object(
        'save_events', coalesce(item->'saves', '0'::jsonb),
        'replay_signals', coalesce(item->'replays', '0'::jsonb),
        'likes', 0,
        'pulses', coalesce(item->'reactions', '0'::jsonb)
      )
    ), '[]'::jsonb) as rows
    from base,
      lateral jsonb_array_elements(coalesce(base.payload->'top_posts', '[]'::jsonb)) item
  )
  select jsonb_build_object(
    'overview',
      coalesce(base.payload->'overview', '{}'::jsonb) || jsonb_build_object(
        'replay_signals', coalesce(base.payload #> '{overview,replays}', '0'::jsonb),
        'likes', 0,
        'pulses', coalesce(base.payload #> '{overview,reactions}', '0'::jsonb)
      ),
    'retention',
      coalesce(base.payload->'retention', '{}'::jsonb) || jsonb_build_object(
        'sample_count', coalesce(base.payload #> '{retention,sessions}', '0'::jsonb)
      ),
    'top_posts', normalized_posts.rows,
    'generated_at', base.payload->'generated_at'
  )
  from base cross join normalized_posts;
$$;

revoke all on function public.get_my_buklod_igpat_creator_analytics_core_v1(integer,integer) from public;
revoke all on function public.get_my_buklod_igpat_creator_analytics_core_v1(integer,integer) from anon;
grant execute on function public.get_my_buklod_igpat_creator_analytics_core_v1(integer,integer) to authenticated, service_role;

revoke all on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) from public;
revoke all on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) from anon;
grant execute on function public.get_my_buklod_igpat_creator_analytics_v1(integer,integer) to authenticated, service_role;
