-- BUKLOD bounded client-version telemetry; no effect on auth, OTA admission or account status.
-- Prevents 20-installation cap from returning HTTP 500 after app reinstalls/cache resets.
-- Keep at most 20 rows/user using serialized, deterministic oldest-first rotation.
-- Existing role grants, service permissions and DB columns remain unchanged.

CREATE OR REPLACE FUNCTION public.buklod_register_client_version_r1(p_installation_id uuid, p_platform text, p_app_version text, p_native_build integer DEFAULT NULL::integer, p_runtime_version text DEFAULT NULL::text, p_ota_update_id uuid DEFAULT NULL::uuid, p_update_channel text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid:=auth.uid();
  platform_ok text:=lower(trim(coalesce(p_platform,'')));
  app_ver text:=trim(coalesce(p_app_version,''));
  runtime_ver text:=nullif(left(trim(coalesce(p_runtime_version,'')),80),'');
  update_channel text:=nullif(left(trim(coalesce(p_update_channel,'')),40),'');
  current_min text;
  current_recommended text;
begin
  if actor is null then
    raise exception 'Sign-in required' using errcode='42501';
  end if;
  if p_installation_id is null or platform_ok not in ('android','ios','web')
    or app_ver !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
    or (p_native_build is not null and p_native_build<=0) then
      raise exception 'Invalid client release metadata' using errcode='22023';
  end if;

  -- Serialize only this user's voluntary adoption telemetry. No account or
  -- device access decisions are made from these self-reported installation IDs.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor::text, 208742)
  );

  -- A reinstall/cache reset may create a new random installation ID. Keep the
  -- 20 most recently seen entries; rotate the oldest nonmatching record instead
  -- of returning SQLSTATE 54000 / HTTP 500 on a routine telemetry report.
  if not exists (
      select 1 from private.buklod_client_version_registry_r1
      where user_id=actor and installation_id=p_installation_id
  ) and (select count(*) from private.buklod_client_version_registry_r1 where user_id=actor) >= 20 then
    delete from private.buklod_client_version_registry_r1
    where user_id=actor and installation_id=(
      select installation_id
      from private.buklod_client_version_registry_r1
      where user_id=actor
      order by last_seen_at asc, first_seen_at asc, installation_id asc
      limit 1
    );
  end if;

  insert into private.buklod_client_version_registry_r1
    (user_id,installation_id,platform,app_version,native_build,runtime_version,ota_update_id,update_channel)
  values (actor,p_installation_id,platform_ok,app_ver,p_native_build,runtime_ver,p_ota_update_id,update_channel)
  on conflict(user_id,installation_id) do update set
    platform=excluded.platform,
    app_version=excluded.app_version,
    native_build=excluded.native_build,
    runtime_version=excluded.runtime_version,
    ota_update_id=excluded.ota_update_id,
    update_channel=excluded.update_channel,
    last_seen_at=clock_timestamp()
  where
    private.buklod_client_version_registry_r1.last_seen_at < clock_timestamp()-interval '15 minutes'
    or (private.buklod_client_version_registry_r1.platform,
        private.buklod_client_version_registry_r1.app_version,
        private.buklod_client_version_registry_r1.native_build,
        private.buklod_client_version_registry_r1.runtime_version,
        private.buklod_client_version_registry_r1.ota_update_id,
        private.buklod_client_version_registry_r1.update_channel)
       is distinct from
       (excluded.platform,excluded.app_version,excluded.native_build,
        excluded.runtime_version,excluded.ota_update_id,excluded.update_channel);

  select minimum_supported_version,recommended_version
    into current_min,current_recommended
    from public.app_runtime_config where environment='production';

  return pg_catalog.jsonb_build_object(
    'report_recorded',true,
    'admission_mode','OBSERVE_ONLY',
    'minimum_supported_version',current_min,
    'recommended_version',current_recommended,
    'upgrade_recommended', coalesce(public.semver_lt(app_ver,current_recommended),false),
    'upgrade_required',false,
    'enforcement_enabled',false,
    'note','Version, Android build, runtime and OTA are now distinguishable for new instrumented clients. No automatic forced deactivation.'
  );
end
$function$
;
