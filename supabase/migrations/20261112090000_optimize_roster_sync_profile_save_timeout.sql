-- BUKLOD performance hotfix. Maintains all existing Classroom roster match safety rules.
-- Profile identity edits previously scanned every active profile for every pending
-- Classroom roster name. The competing-score scan is used only when the incoming
-- name has v_score >= 0.97 (strict fuzzy qualification). Skip it otherwise.
-- Existing exact username, exact token, manual review, and enrollment flow unchanged.
-- Preserves SECURITY DEFINER, empty search_path, existing permissions and trigger.

CREATE OR REPLACE FUNCTION public.buklod_classroom_roster_profile_arrival_sync_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  i record;
  v_profile_name text;
  v_score numeric;
  v_second numeric;
  v_sig_match boolean;
  v_username_match boolean;
  v_username_count integer;
  v_sig_count integer;
  v_method text;
begin
  -- Sync depends on an active account/profile, not admin/email verification.
  if coalesce(new.is_active,false) <> true then
    return new;
  end if;

  if not exists(
    select 1 from public.buklod_classroom_roster_intents_v1
    where status in ('WAITING','NEEDS_REVIEW','MATCHED')
  ) then
    return new;
  end if;

  v_profile_name := coalesce(
    nullif(btrim(new.full_name),''),
    nullif(btrim(concat_ws(' ',new.first_name,new.middle_name,new.surname,new.suffix)),''),
    new.username,
    ''
  );

  for i in
    select *
    from public.buklod_classroom_roster_intents_v1
    where status in ('WAITING','NEEDS_REVIEW','MATCHED')
    order by created_at, id
  loop
    -- Never silently link one account to two official names in the same classroom.
    if exists (
      select 1
      from public.buklod_classroom_roster_intents_v1 other
      where other.classroom_id = i.classroom_id
        and other.id <> i.id
        and other.status = 'ENROLLED'
        and other.matched_user_id = new.id
    ) then
      continue;
    end if;

    v_score := public.buklod_classroom_roster_name_similarity_v1(i.source_name,v_profile_name);
    v_method := 'PROFILE_SYNC_REVIEW';
    v_username_match := false;
    v_sig_match := false;
    v_second := 0;

    if i.source_username <> '' and lower(coalesce(new.username,'')) = i.source_username then
      select count(*) into v_username_count
      from public.profiles p
      where p.is_active=true
        and lower(coalesce(p.username,''))=i.source_username;
      v_username_match := (v_username_count = 1);
    end if;

    if not v_username_match
       and public.buklod_classroom_roster_token_signature_v1(i.source_name) <> ''
       and public.buklod_classroom_roster_token_signature_v1(i.source_name)
           = public.buklod_classroom_roster_token_signature_v1(v_profile_name) then
      select count(*) into v_sig_count
      from public.profiles p
      where p.is_active=true
        and public.buklod_classroom_roster_token_signature_v1(
          coalesce(
            nullif(btrim(p.full_name),''),
            nullif(btrim(concat_ws(' ',p.first_name,p.middle_name,p.surname,p.suffix)),''),
            p.username,
            ''
          )
        ) = public.buklod_classroom_roster_token_signature_v1(i.source_name);
      v_sig_match := (v_sig_count = 1);
    end if;

    if v_username_match then
      v_score := 1;
      v_second := 0;
      v_method := 'PROFILE_SYNC_USERNAME_EXACT';
    elsif v_sig_match then
      v_score := 0.99;
      v_second := 0;
      v_method := 'PROFILE_SYNC_OFFICIAL_TOKEN_EXACT';
    elsif v_score >= 0.97 then
      -- Competitor score only matters for possible strict-fuzzy auto-match.
      -- Do not compare against all accounts for unrelated roster names.
      select coalesce(max(public.buklod_classroom_roster_name_similarity_v1(
        i.source_name,
        coalesce(
          nullif(btrim(p.full_name),''),
          nullif(btrim(concat_ws(' ',p.first_name,p.middle_name,p.surname,p.suffix)),''),
          p.username,
          ''
        )
      )),0)
      into v_second
      from public.profiles p
      where p.id<>new.id and p.is_active=true;
    end if;

    if v_username_match
       or v_sig_match
       or (
         coalesce(array_length(regexp_split_to_array(public.buklod_classroom_roster_token_signature_v1(i.source_name), E'\\s+'),1),0) >= 2
         and v_score >= 0.97
         and (v_score-v_second) >= 0.15
       ) then
      if not v_username_match and not v_sig_match then
        v_method := 'PROFILE_SYNC_OFFICIAL_STRICT_FUZZY';
      end if;

      insert into public.buklod_education_enrollments(classroom_id,student_user_id,status)
      values(i.classroom_id,new.id,'ACTIVE')
      on conflict(classroom_id,student_user_id) do update set status='ACTIVE';

      update public.buklod_classroom_roster_intents_v1
      set status='ENROLLED',
          matched_user_id=new.id,
          matched_username=new.username,
          match_score=v_score,
          match_method=v_method,
          decision_at=now(),
          last_synced_at=now(),
          updated_at=now()
      where id=i.id;

      continue;
    end if;

    if v_score >= 0.90 and (i.match_score is null or v_score > i.match_score) then
      update public.buklod_classroom_roster_intents_v1
      set status='NEEDS_REVIEW',
          matched_user_id=new.id,
          matched_username=new.username,
          match_score=v_score,
          match_method='PROFILE_SYNC_REVIEW',
          last_synced_at=now(),
          updated_at=now()
      where id=i.id;
    end if;
  end loop;

  return new;
exception when others then
  raise warning 'BUKLOD Classroom roster profile sync skipped: %', sqlerrm;
  return new;
end;
$function$
;
