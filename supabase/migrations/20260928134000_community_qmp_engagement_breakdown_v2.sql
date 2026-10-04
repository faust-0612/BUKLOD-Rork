create or replace function public.get_my_buklod_community_contribution_v2()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_base jsonb;
  v_period private.buklod_community_settlement_periods%rowtype;
  v_previous private.buklod_community_settlement_periods%rowtype;
  v_reaction_qmp bigint := 0;
  v_share_qmp bigint := 0;
  v_reply_engagement_qmp bigint := 0;
  v_validated_engagement_qmp bigint := 0;
  v_validated_engagement_events bigint := 0;
  v_useful_post_qmp bigint := 0;
  v_video_qmp bigint := 0;
  v_reply_qmp bigint := 0;
  v_other_qmp bigint := 0;
  v_prev_user_qmp bigint := 0;
  v_prev_total_qmp bigint := 0;
  v_prev_weight numeric := 0;
  v_current_weight numeric := 0;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  v_base := public.get_my_buklod_community_contribution_v1();

  select p.* into v_period
  from private.buklod_community_settlement_periods p
  where p.period_key = (v_base #>> '{period,key}')
  order by p.starts_at desc limit 1;

  if v_period.id is null then
    return v_base || jsonb_build_object(
      'engagement_breakdown',jsonb_build_object(
        'validated_engagement_qmp',0,'validated_engagement_events',0,
        'reaction_bonus_qmp',0,'internal_share_bonus_qmp',0,
        'reply_engagement_bonus_qmp',0,'useful_post_qmp',0,
        'qualified_video_qmp',0,'meaningful_reply_qmp',0,'other_qmp',0
      ),
      'share_weight_previous',0,
      'share_weight_delta',coalesce((v_base->>'share_weight')::numeric,0)
    );
  end if;

  select
    coalesce(sum(e.total_qmp) filter(where e.contribution_type='VALIDATED_ENGAGEMENT'),0)::bigint,
    count(*) filter(where e.contribution_type='VALIDATED_ENGAGEMENT')::bigint,
    coalesce(sum(e.total_qmp) filter(where e.source_event_key like 'creator-reaction:%'),0)::bigint,
    coalesce(sum(e.total_qmp) filter(where e.source_event_key like 'creator-share:%'),0)::bigint,
    coalesce(sum(e.total_qmp) filter(where e.source_event_key like 'creator-comment:%'),0)::bigint,
    coalesce(sum(e.total_qmp) filter(where e.contribution_type='USEFUL_POST'),0)::bigint,
    coalesce(sum(e.total_qmp) filter(where e.contribution_type='QUALIFIED_VIDEO'),0)::bigint,
    coalesce(sum(e.total_qmp) filter(where e.contribution_type='MEANINGFUL_REPLY'),0)::bigint,
    coalesce(sum(e.total_qmp) filter(where e.contribution_type not in ('VALIDATED_ENGAGEMENT','USEFUL_POST','QUALIFIED_VIDEO','MEANINGFUL_REPLY')),0)::bigint
  into
    v_validated_engagement_qmp,v_validated_engagement_events,
    v_reaction_qmp,v_share_qmp,v_reply_engagement_qmp,
    v_useful_post_qmp,v_video_qmp,v_reply_qmp,v_other_qmp
  from private.buklod_community_qmp_events e
  where e.user_id=v_actor and e.settlement_period_id=v_period.id
    and e.state in ('QUALIFIED','FINALIZED');

  v_current_weight := coalesce((v_base->>'share_weight')::numeric,0);

  select p.* into v_previous
  from private.buklod_community_settlement_periods p
  where p.starts_at < v_period.starts_at
  order by p.starts_at desc limit 1;

  if v_previous.id is not null then
    select coalesce(a.qualified_qmp,0)::bigint into v_prev_user_qmp
    from private.buklod_community_qmp_accounts a
    where a.user_id=v_actor and a.settlement_period_id=v_previous.id;
    v_prev_user_qmp := coalesce(v_prev_user_qmp,0);

    select coalesce(sum(a.qualified_qmp),0)::bigint into v_prev_total_qmp
    from private.buklod_community_qmp_accounts a
    where a.settlement_period_id=v_previous.id;

    if v_prev_total_qmp > 0 then
      v_prev_weight := v_prev_user_qmp::numeric / v_prev_total_qmp::numeric;
    end if;
  end if;

  return v_base || jsonb_build_object(
    'engagement_breakdown',jsonb_build_object(
      'validated_engagement_qmp',v_validated_engagement_qmp,
      'validated_engagement_events',v_validated_engagement_events,
      'reaction_bonus_qmp',v_reaction_qmp,
      'internal_share_bonus_qmp',v_share_qmp,
      'reply_engagement_bonus_qmp',v_reply_engagement_qmp,
      'useful_post_qmp',v_useful_post_qmp,
      'qualified_video_qmp',v_video_qmp,
      'meaningful_reply_qmp',v_reply_qmp,
      'other_qmp',v_other_qmp
    ),
    'share_weight_previous',v_prev_weight,
    'share_weight_delta',v_current_weight-v_prev_weight
  );
end;
$function$;

revoke all on function public.get_my_buklod_community_contribution_v2() from public;
grant execute on function public.get_my_buklod_community_contribution_v2() to authenticated;
