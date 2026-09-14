-- BUKLOD IGPAT R48
-- A narrow IGPAT wrapper around the existing Main content_reports moderation queue.

create or replace function public.submit_buklod_igpat_report_v1(
  p_post_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_reason text := lower(trim(coalesce(p_reason, 'other')));
  report_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if safe_reason not in ('spam','harassment','privacy','misinformation','inappropriate','other') then
    safe_reason := 'other';
  end if;

  if not exists (
    select 1
    from public.community_posts cp
    where cp.id = p_post_id
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and public.can_view_community_post_v2(cp.id)
  ) then
    raise exception 'IGPAT is unavailable for this account';
  end if;

  insert into public.content_reports(
    reporter_id,
    entity_type,
    entity_id,
    reason,
    details,
    status,
    resolution,
    reviewed_by,
    reviewed_at
  )
  values(
    actor,
    'post'::public.content_entity_type,
    p_post_id,
    safe_reason::public.report_reason,
    nullif(left(trim(coalesce(p_details, '')), 1200), ''),
    'open'::public.moderation_status,
    null,
    null,
    null
  )
  on conflict(reporter_id, entity_type, entity_id)
  do update set
    reason = excluded.reason,
    details = excluded.details,
    status = 'open'::public.moderation_status,
    resolution = null,
    reviewed_by = null,
    reviewed_at = null,
    resolved_by = null,
    resolved_at = null,
    created_at = now()
  returning id into report_id;

  perform public.igpat_track_event_v2(
    'report',
    p_post_id,
    null,
    'controls',
    0,
    jsonb_build_object('reason', safe_reason)
  );

  return report_id;
end;
$$;

revoke all on function public.submit_buklod_igpat_report_v1(uuid,text,text) from public;
revoke all on function public.submit_buklod_igpat_report_v1(uuid,text,text) from anon;
grant execute on function public.submit_buklod_igpat_report_v1(uuid,text,text) to authenticated;
grant execute on function public.submit_buklod_igpat_report_v1(uuid,text,text) to service_role;
