-- BUKLOD Classroom R4 — imported roster names + safe account synchronization
-- Additive only. Exact username enrollment remains unchanged.

create table if not exists public.buklod_classroom_roster_intents_v1 (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.buklod_education_classrooms(id) on delete cascade,
  source_name text not null,
  normalized_name text not null,
  source_username text not null default '',
  source_file_name text,
  source_ordinal integer not null default 0,
  status text not null default 'WAITING' check (status in ('WAITING','NEEDS_REVIEW','MATCHED','ENROLLED','IGNORED')),
  matched_user_id uuid references auth.users(id) on delete set null,
  matched_username text,
  match_score numeric(5,4),
  match_method text,
  suggestions jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  decision_by uuid references auth.users(id) on delete set null,
  decision_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (classroom_id, normalized_name, source_username)
);

create index if not exists buklod_classroom_roster_intents_class_status_idx
  on public.buklod_classroom_roster_intents_v1(classroom_id, status, normalized_name);
create index if not exists buklod_classroom_roster_intents_waiting_idx
  on public.buklod_classroom_roster_intents_v1(status, normalized_name)
  where status in ('WAITING','NEEDS_REVIEW');

alter table public.buklod_classroom_roster_intents_v1 enable row level security;
revoke all on public.buklod_classroom_roster_intents_v1 from anon, authenticated;

create or replace function public.buklod_classroom_roster_normalize_name_v1(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(
      lower(coalesce(p_value,'')),
      'áàâäãåéèêëíìîïóòôöõúùûüñçýÿ',
      'aaaaaaeeeeiiiiooooouuuuncyy'
    ),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

create or replace function public.buklod_classroom_roster_token_signature_v1(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(token, ' ' order by token), '')
  from (
    select distinct token
    from regexp_split_to_table(public.buklod_classroom_roster_normalize_name_v1(p_value), E'\\s+') token
    where length(token) > 1
      and token not in ('jr','sr','ii','iii','iv')
  ) s;
$$;

create or replace function public.buklod_classroom_roster_edit_similarity_v1(p_left text, p_right text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  a text := replace(public.buklod_classroom_roster_normalize_name_v1(p_left), ' ', '');
  b text := replace(public.buklod_classroom_roster_normalize_name_v1(p_right), ' ', '');
  n integer;
  m integer;
  i integer;
  j integer;
  cost integer;
  prev integer[];
  curr integer[];
begin
  if a = b then return 1; end if;
  n := length(a); m := length(b);
  if n = 0 or m = 0 then return 0; end if;
  prev := array_fill(0, array[m + 1], array[0]);
  for j in 0..m loop prev[j] := j; end loop;
  for i in 1..n loop
    curr := array_fill(0, array[m + 1], array[0]);
    curr[0] := i;
    for j in 1..m loop
      cost := case when substring(a from i for 1) = substring(b from j for 1) then 0 else 1 end;
      curr[j] := least(curr[j-1] + 1, prev[j] + 1, prev[j-1] + cost);
    end loop;
    prev := curr;
  end loop;
  return greatest(0, 1 - (prev[m]::numeric / greatest(n,m)));
end;
$$;

create or replace function public.buklod_classroom_roster_name_similarity_v1(p_left text, p_right text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  a text := public.buklod_classroom_roster_normalize_name_v1(p_left);
  b text := public.buklod_classroom_roster_normalize_name_v1(p_right);
  sa text;
  sb text;
  edit_score numeric;
begin
  if a = '' or b = '' then return 0; end if;
  if a = b then return 1; end if;
  sa := public.buklod_classroom_roster_token_signature_v1(a);
  sb := public.buklod_classroom_roster_token_signature_v1(b);
  if sa <> '' and sa = sb then return 0.99; end if;
  edit_score := public.buklod_classroom_roster_edit_similarity_v1(a,b);
  return least(1, edit_score);
end;
$$;

create or replace function public.buklod_classroom_roster_import_service_v1(
  p_faculty_id uuid,
  p_classroom_id uuid,
  p_source_file_name text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  v_name text;
  v_norm text;
  v_username text;
  v_candidate uuid;
  v_candidate_username text;
  v_score numeric;
  v_auto boolean;
  v_status text;
  v_method text;
  v_intent uuid;
  v_total integer := 0;
  v_enrolled integer := 0;
  v_review integer := 0;
  v_waiting integer := 0;
begin
  if p_faculty_id is null or not exists (
    select 1 from public.buklod_education_classrooms c
    where c.id = p_classroom_id and c.faculty_user_id = p_faculty_id
    union all
    select 1 from public.buklod_education_classroom_faculty f
    where f.classroom_id = p_classroom_id and f.faculty_user_id = p_faculty_id
      and upper(f.status) = 'ACTIVE' and f.ended_at is null
  ) then
    raise exception 'Faculty access required.';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Roster rows must be an array.'; end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    v_name := btrim(coalesce(r->>'original_name',''));
    if v_name = '' then continue; end if;
    v_norm := public.buklod_classroom_roster_normalize_name_v1(v_name);
    if v_norm = '' then continue; end if;
    v_username := lower(regexp_replace(btrim(coalesce(r->>'source_username','')), '^@', ''));
    v_candidate := nullif(r->>'candidate_user_id','')::uuid;
    v_candidate_username := nullif(r->>'candidate_username','');
    v_score := greatest(0, least(1, coalesce(nullif(r->>'match_score','')::numeric,0)));
    v_auto := coalesce((r->>'auto_enroll')::boolean,false);
    v_method := coalesce(nullif(r->>'match_method',''),'NONE');
    v_status := case when v_auto and v_candidate is not null then 'MATCHED'
                     when v_candidate is not null then 'NEEDS_REVIEW'
                     else 'WAITING' end;

    insert into public.buklod_classroom_roster_intents_v1(
      classroom_id,source_name,normalized_name,source_username,source_file_name,source_ordinal,
      status,matched_user_id,matched_username,match_score,match_method,suggestions,created_by,last_synced_at,updated_at
    ) values (
      p_classroom_id,v_name,v_norm,v_username,p_source_file_name,coalesce((r->>'ordinal')::integer,0),
      v_status,v_candidate,v_candidate_username,v_score,v_method,coalesce(r->'suggestions','[]'::jsonb),p_faculty_id,now(),now()
    )
    on conflict (classroom_id,normalized_name,source_username) do update set
      source_name=excluded.source_name,
      source_file_name=excluded.source_file_name,
      source_ordinal=excluded.source_ordinal,
      matched_user_id=case when public.buklod_classroom_roster_intents_v1.status='ENROLLED' then public.buklod_classroom_roster_intents_v1.matched_user_id else excluded.matched_user_id end,
      matched_username=case when public.buklod_classroom_roster_intents_v1.status='ENROLLED' then public.buklod_classroom_roster_intents_v1.matched_username else excluded.matched_username end,
      match_score=case when public.buklod_classroom_roster_intents_v1.status='ENROLLED' then public.buklod_classroom_roster_intents_v1.match_score else excluded.match_score end,
      match_method=case when public.buklod_classroom_roster_intents_v1.status='ENROLLED' then public.buklod_classroom_roster_intents_v1.match_method else excluded.match_method end,
      suggestions=excluded.suggestions,
      status=case when public.buklod_classroom_roster_intents_v1.status='ENROLLED' then 'ENROLLED' else excluded.status end,
      last_synced_at=now(), updated_at=now()
    returning id,status into v_intent,v_status;

    v_total := v_total + 1;
    if v_auto and v_candidate is not null and exists(select 1 from public.profiles p where p.id=v_candidate and p.is_active=true) then
      insert into public.buklod_education_enrollments(classroom_id,student_user_id,status)
      values(p_classroom_id,v_candidate,'ACTIVE')
      on conflict(classroom_id,student_user_id) do update set status='ACTIVE';
      update public.buklod_classroom_roster_intents_v1
      set status='ENROLLED', decision_by=p_faculty_id, decision_at=now(), last_synced_at=now(), updated_at=now()
      where id=v_intent;
      v_enrolled := v_enrolled + 1;
    elsif v_candidate is not null then
      v_review := v_review + 1;
    else
      v_waiting := v_waiting + 1;
    end if;
  end loop;

  return jsonb_build_object('imported',v_total,'enrolled',v_enrolled,'needs_review',v_review,'waiting',v_waiting);
end;
$$;

revoke all on function public.buklod_classroom_roster_import_service_v1(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.buklod_classroom_roster_import_service_v1(uuid,uuid,text,jsonb) to service_role;

create or replace function public.buklod_classroom_roster_pending_v1(p_classroom_id uuid)
returns table(
  id uuid,
  source_name text,
  status text,
  matched_user_id uuid,
  matched_username text,
  match_score numeric,
  match_method text,
  suggestions jsonb,
  source_file_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.buklod_education_faculty_can_manage_classroom_v3(p_classroom_id) then
    raise exception 'Not authorized to manage this classroom.';
  end if;
  return query
  select i.id,i.source_name,i.status,i.matched_user_id,i.matched_username,i.match_score,i.match_method,i.suggestions,i.source_file_name
  from public.buklod_classroom_roster_intents_v1 i
  where i.classroom_id=p_classroom_id and i.status <> 'IGNORED'
  order by lower(i.source_name),i.source_name;
end;
$$;
grant execute on function public.buklod_classroom_roster_pending_v1(uuid) to authenticated;

create or replace function public.buklod_classroom_roster_confirm_match_v1(p_intent_id uuid,p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_classroom uuid;
  v_username text;
begin
  select classroom_id into v_classroom from public.buklod_classroom_roster_intents_v1 where id=p_intent_id;
  if v_classroom is null or not public.buklod_education_faculty_can_manage_classroom_v3(v_classroom) then
    raise exception 'Not authorized to manage this roster item.';
  end if;
  select username into v_username from public.profiles where id=p_user_id and is_active=true;
  if not found then raise exception 'The selected BUKLOD account is unavailable.'; end if;
  insert into public.buklod_education_enrollments(classroom_id,student_user_id,status)
  values(v_classroom,p_user_id,'ACTIVE')
  on conflict(classroom_id,student_user_id) do update set status='ACTIVE';
  update public.buklod_classroom_roster_intents_v1
  set status='ENROLLED',matched_user_id=p_user_id,matched_username=v_username,match_score=1,
      match_method='FACULTY_CONFIRMED',decision_by=auth.uid(),decision_at=now(),last_synced_at=now(),updated_at=now()
  where id=p_intent_id;
  return 'Student matched and enrolled.';
end;
$$;
grant execute on function public.buklod_classroom_roster_confirm_match_v1(uuid,uuid) to authenticated;

create or replace function public.buklod_classroom_roster_profile_arrival_sync_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  i record;
  v_profile_name text;
  v_score numeric;
  v_second numeric;
  v_username_count integer;
  v_method text;
begin
  if coalesce(new.is_active,false) <> true then return new; end if;
  if not exists(select 1 from public.buklod_classroom_roster_intents_v1 where status in ('WAITING','NEEDS_REVIEW')) then return new; end if;

  v_profile_name := coalesce(nullif(btrim(new.full_name),''),
    nullif(btrim(concat_ws(' ',new.first_name,new.middle_name,new.surname,new.suffix)),''),new.username,'');

  for i in
    select * from public.buklod_classroom_roster_intents_v1
    where status in ('WAITING','NEEDS_REVIEW')
    order by created_at
  loop
    v_score := public.buklod_classroom_roster_name_similarity_v1(i.source_name,v_profile_name);
    v_method := 'PROFILE_SYNC_NAME';

    if i.source_username <> '' and lower(coalesce(new.username,''))=i.source_username then
      select count(*) into v_username_count from public.profiles p
      where p.is_active=true and lower(coalesce(p.username,''))=i.source_username;
      if v_username_count=1 then v_score:=1; v_method:='PROFILE_SYNC_USERNAME'; end if;
    end if;

    if v_score >= 0.90 and (
      v_method='PROFILE_SYNC_USERNAME'
      or array_length(regexp_split_to_array(i.normalized_name,E'\\s+'),1) >= 2
    ) then
      if v_method='PROFILE_SYNC_USERNAME' then
        v_second := 0;
      else
        select coalesce(max(public.buklod_classroom_roster_name_similarity_v1(
          i.source_name,
          coalesce(nullif(btrim(p.full_name),''),nullif(btrim(concat_ws(' ',p.first_name,p.middle_name,p.surname,p.suffix)),''),p.username,'')
        )),0)
        into v_second
        from public.profiles p
        where p.id<>new.id and p.is_active=true;
      end if;

      if v_method='PROFILE_SYNC_USERNAME' or v_score-v_second >= 0.10 then
        insert into public.buklod_education_enrollments(classroom_id,student_user_id,status)
        values(i.classroom_id,new.id,'ACTIVE')
        on conflict(classroom_id,student_user_id) do update set status='ACTIVE';
        update public.buklod_classroom_roster_intents_v1
        set status='ENROLLED',matched_user_id=new.id,matched_username=new.username,match_score=v_score,
            match_method=v_method,decision_at=now(),last_synced_at=now(),updated_at=now()
        where id=i.id;
        continue;
      end if;
    end if;

    if v_score >= 0.70 and (i.match_score is null or v_score > i.match_score) then
      update public.buklod_classroom_roster_intents_v1
      set status='NEEDS_REVIEW',matched_user_id=new.id,matched_username=new.username,match_score=v_score,
          match_method='PROFILE_SYNC_REVIEW',last_synced_at=now(),updated_at=now()
      where id=i.id;
    end if;
  end loop;
  return new;
exception when others then
  raise warning 'BUKLOD Classroom roster profile sync skipped: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.buklod_classroom_roster_profile_arrival_sync_v1() from public, anon, authenticated;

drop trigger if exists buklod_classroom_roster_profile_arrival_sync_r4 on public.profiles;
create trigger buklod_classroom_roster_profile_arrival_sync_r4
after insert or update of username,full_name,first_name,middle_name,surname,suffix,is_active on public.profiles
for each row execute function public.buklod_classroom_roster_profile_arrival_sync_v1();
