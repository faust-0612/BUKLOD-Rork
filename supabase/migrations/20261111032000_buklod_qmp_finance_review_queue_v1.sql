-- Admin-only pending QMP queue for the canonical month-close gate.
-- This lists context for human review; it neither approves events nor funds cash.
create or replace function public.admin_list_buklod_qmp_month_review_queue_v1(
  p_period_key text,p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_actor uuid:=(select auth.uid());
  v_period uuid;
  v_total bigint:=0;
  v_rows jsonb:='[]'::jsonb;
begin
  if v_actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;
  if coalesce(p_period_key,'') !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Invalid month key';
  end if;
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Review limit must be 1 to 100';
  end if;
  select id into v_period from private.buklod_community_settlement_periods
  where period_key=p_period_key;
  if v_period is null then
    return jsonb_build_object('period_key',p_period_key,
      'total_pending',0,'rows','[]'::jsonb);
  end if;

  select count(*) into v_total from private.buklod_community_qmp_events e
  where e.settlement_period_id=v_period
    and e.state in ('PENDING','HELD') and e.total_qmp>0;

  select coalesce(jsonb_agg(jsonb_build_object(
      'event_id',v.id,'type',v.contribution_type,
      'state',v.state,'reason',coalesce(v.reason_code,'REVIEW'),
      'qmp',v.total_qmp,'created_at',v.created_at,
      'source_excerpt',v.source_excerpt,'source_available',v.source_available
    ) order by v.created_at,v.id),'[]'::jsonb)
  into v_rows
  from (
    select e.id,e.contribution_type,e.state,e.reason_code,e.total_qmp,
      e.created_at,
      case
        when e.contribution_type='MEANINGFUL_REPLY'
          then left(coalesce(c.body,''),300)
        else left(coalesce(p.body,''),300)
      end source_excerpt,
      case
        when e.contribution_type='MEANINGFUL_REPLY'
          then c.id is not null and not coalesce(c.is_hidden,false)
            and c.deleted_at is null
        else p.id is not null and not coalesce(p.is_hidden,false)
          and p.deleted_at is null
      end source_available
    from private.buklod_community_qmp_events e
    left join public.community_posts p on p.id=e.content_id
    left join public.comments c on c.id=case
      when coalesce(e.metadata->>'comment_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (e.metadata->>'comment_id')::uuid else null end
    where e.settlement_period_id=v_period
      and e.state in ('PENDING','HELD') and e.total_qmp>0
    order by e.created_at asc,e.id asc
    limit p_limit
  ) v;

  return jsonb_build_object(
    'period_key',p_period_key,
    'total_pending',v_total,
    'rows',v_rows
  );
end;
$function$;
revoke all on function public.admin_list_buklod_qmp_month_review_queue_v1(text,integer)
from public,anon;
grant execute on function public.admin_list_buklod_qmp_month_review_queue_v1(text,integer)
to authenticated;
comment on function public.admin_list_buklod_qmp_month_review_queue_v1(text,integer) is
'Admin-only QMP qualification queue; source context is private, never available to ordinary members.';
