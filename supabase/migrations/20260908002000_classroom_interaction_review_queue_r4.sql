alter table public.buklod_education_classroom_live_interactions
  add column if not exists review_status text not null default 'AUTO',
  add column if not exists resolution text,
  add column if not exists review_note text,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz;

create index if not exists buklod_classroom_live_interactions_review_idx
  on public.buklod_education_classroom_live_interactions(classroom_id, review_status, created_at desc);

create or replace function public.buklod_classroom_interaction_reviews_v1(p_classroom_id uuid)
returns table(
  id uuid,
  session_id uuid,
  target_user_id uuid,
  target_name text,
  interaction_type text,
  result text,
  network_evidence jsonb,
  created_at timestamptz,
  completed_at timestamptz,
  review_status text,
  resolution text,
  review_note text
)
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(
    select 1 from public.buklod_education_classrooms c
    where c.id=p_classroom_id and c.faculty_user_id=auth.uid()
  ) then raise exception 'Faculty access required'; end if;

  return query
  select
    i.id,
    i.session_id,
    i.target_user_id,
    coalesce(
      nullif(trim(concat_ws(' ',p.first_name,p.surname)),''),
      nullif(p.full_name,''),
      nullif(p.username,''),
      'BUKLOD Student'
    )::text as target_name,
    i.interaction_type,
    i.result,
    i.network_evidence,
    i.created_at,
    i.completed_at,
    i.review_status,
    i.resolution,
    i.review_note
  from public.buklod_education_classroom_live_interactions i
  left join public.profiles p on p.id=i.target_user_id
  where i.classroom_id=p_classroom_id
    and i.interaction_type in ('CALL_STUDENT','START_CONVERSATION')
    and i.result in ('NO_RESPONSE_REVIEW','NO_RESPONSE_NETWORK_REVIEW','TECHNICAL_FAILURE','NETWORK_POOR')
  order by
    case when i.review_status='RESOLVED' then 1 else 0 end,
    i.created_at desc;
end;
$$;

create or replace function public.buklod_classroom_resolve_interaction_review_v1(
  p_interaction_id uuid,
  p_resolution text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_resolution text:=upper(trim(coalesce(p_resolution,'')));
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_resolution not in ('NO_PENALTY','MISSED_RESPONSE','TECHNICAL','EXCUSED') then
    raise exception 'Unsupported review resolution';
  end if;

  update public.buklod_education_classroom_live_interactions i
  set review_status='RESOLVED',
      resolution=v_resolution,
      review_note=nullif(trim(coalesce(p_note,'')),''),
      reviewed_by=v_uid,
      reviewed_at=now()
  where i.id=p_interaction_id
    and exists(
      select 1 from public.buklod_education_classrooms c
      where c.id=i.classroom_id and c.faculty_user_id=v_uid
    );

  if not found then raise exception 'Faculty access required'; end if;
  return true;
end;
$$;

grant execute on function public.buklod_classroom_interaction_reviews_v1(uuid) to authenticated;
grant execute on function public.buklod_classroom_resolve_interaction_review_v1(uuid,text,text) to authenticated;
