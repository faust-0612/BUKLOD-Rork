CREATE OR REPLACE FUNCTION public.buklod_quiz_ensure_main_shadow_user_v1(p_user_id uuid, p_email text, p_user_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_existing_id uuid;
  v_now timestamptz := now();
  v_metadata jsonb := coalesce(p_user_metadata,'{}'::jsonb);
begin
  if p_user_id is null or v_email = '' then
    return jsonb_build_object('ok',false,'error','missing_identity');
  end if;

  select id into v_existing_id
  from auth.users
  where id = p_user_id;

  if v_existing_id is not null then
    return jsonb_build_object('ok',true,'created',false,'user_id',p_user_id);
  end if;

  select id into v_existing_id
  from auth.users
  where lower(email) = v_email
    and is_sso_user = false
  limit 1;

  if v_existing_id is not null and v_existing_id <> p_user_id then
    -- Preserve the existing Quiz UUID and all existing exam/roster/attempt data.
    -- This privileged RPC must be followed by live Main Auth email validation
    -- before the caller can issue any Quiz login link.
    if exists (
      select 1 from auth.users u
      where u.id = v_existing_id
        and u.email_confirmed_at is not null
        and coalesce(u.is_sso_user,false) = false
        and coalesce(u.is_anonymous,false) = false
        and (u.banned_until is null or u.banned_until <= now())
        and (
          u.raw_app_meta_data->>'buklod_main_user_id' is null
          or u.raw_app_meta_data->>'buklod_main_user_id' = p_user_id::text
        )
    ) then
      return jsonb_build_object('ok',true,'created',false,'user_id',v_existing_id,'legacy_existing',true);
    end if;
    return jsonb_build_object('ok',false,'error','email_identity_conflict');
  end if;

  insert into auth.users(
    instance_id,id,aud,role,email,encrypted_password,
    email_confirmed_at,confirmation_token,recovery_token,
    email_change_token_new,email_change,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,
    created_at,updated_at,phone,phone_change,phone_change_token,
    email_change_token_current,email_change_confirm_status,
    reauthentication_token,is_sso_user,is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    p_user_id,'authenticated','authenticated',v_email,null,
    v_now,'','',
    '','',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    v_metadata,null,
    v_now,v_now,null,'','',
    '',0,
    '',false,false
  )
  on conflict (id) do nothing;

  insert into auth.identities(
    provider_id,user_id,identity_data,provider,
    last_sign_in_at,created_at,updated_at
  ) values (
    p_user_id::text,
    p_user_id,
    v_metadata || jsonb_build_object(
      'sub',p_user_id::text,
      'email',v_email,
      'email_verified',true,
      'phone_verified',false
    ),
    'email',null,v_now,v_now
  )
  on conflict (provider_id,provider) do nothing;

  return jsonb_build_object('ok',true,'created',true,'user_id',p_user_id);
exception
  when unique_violation then
    return jsonb_build_object('ok',false,'error','identity_conflict');
end;
$function$;

-- Keep auth provisioning restricted to the privileged Edge Function.
REVOKE ALL ON FUNCTION public.buklod_quiz_ensure_main_shadow_user_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_ensure_main_shadow_user_v1(uuid,text,jsonb) TO service_role;
