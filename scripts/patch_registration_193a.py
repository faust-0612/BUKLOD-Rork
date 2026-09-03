from pathlib import Path

path = Path('src/app/(auth)/register.tsx')
text = path.read_text(encoding='utf-8')

old_import = """import {
  useEffect,
  useMemo,
  useState,
} from 'react';"""
new_import = """import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';"""
if text.count(old_import) != 1:
    raise SystemExit(f'193A STOPPED: react import anchor count={text.count(old_import)}')
text = text.replace(old_import, new_import, 1)

busy_anchor = """  const [busy, setBusy] =
    useState(false);"""
busy_replacement = """  const [busy, setBusy] =
    useState(false);
  const createAccountInFlight =
    useRef(false);

  const finishCreateAccount = () => {
    createAccountInFlight.current = false;
    setBusy(false);
  };"""
if text.count(busy_anchor) != 1:
    raise SystemExit(f'193A STOPPED: busy anchor count={text.count(busy_anchor)}')
text = text.replace(busy_anchor, busy_replacement, 1)

start_anchor = """      setBusy(true);

      const { data, error } ="""
start_replacement = """      if (createAccountInFlight.current) {
        return;
      }

      createAccountInFlight.current = true;
      setBusy(true);

      const { data, error } ="""
if text.count(start_anchor) != 1:
    raise SystemExit(f'193A STOPPED: create start anchor count={text.count(start_anchor)}')
text = text.replace(start_anchor, start_replacement, 1)

metadata_anchor = """                member_note:
                  null,
"""
metadata_replacement = """                member_note:
                  null,
                /* PATCH_193A_ATOMIC_REGISTRATION */
                buklod_registration_version:
                  '193A',
                registration_barangay:
                  barangay.trim(),
                registration_city_municipality:
                  cityMunicipality.trim(),
                registration_province:
                  province.trim(),
                registration_country:
                  country.trim() ||
                  'Philippines',
                registration_postal_code:
                  postalCode.trim() ||
                  null,
                registration_faith_identity:
                  faithIdentity,
                registration_show_faith_content:
                  showFaithContent,
"""
if text.count(metadata_anchor) != 1:
    raise SystemExit(f'193A STOPPED: metadata anchor count={text.count(metadata_anchor)}')
text = text.replace(metadata_anchor, metadata_replacement, 1)

early_busy = """      setBusy(false);

      if (error) {
"""
error_busy = """      if (error) {
        finishCreateAccount();
"""
if text.count(early_busy) != 1:
    raise SystemExit(f'193A STOPPED: early busy anchor count={text.count(early_busy)}')
text = text.replace(early_busy, error_busy, 1)

no_session_anchor = """      if (!data.session) {
        return Alert.alert(
"""
no_session_replacement = """      if (!data.session) {
        finishCreateAccount();
        return Alert.alert(
"""
if text.count(no_session_anchor) != 1:
    raise SystemExit(f'193A STOPPED: no-session anchor count={text.count(no_session_anchor)}')
text = text.replace(no_session_anchor, no_session_replacement, 1)

block_start_marker = """      /*
       * PATCH_164A_REG2B_PRIVATE_ONBOARDING
"""
block_end_marker = """      Alert.alert(
        'Account created',
        'Your BUKLOD account is ready. You can enter the Public Community immediately. Local, Cluster, Church, and Organization memberships can be added separately.'
      );
"""
start = text.find(block_start_marker)
end = text.find(block_end_marker, start)
if start < 0 or end < 0:
    raise SystemExit(f'193A STOPPED: onboarding block markers start={start} end={end}')

canonical = """      /*
       * PATCH_193A_REGISTRATION_HARDENING
       *
       * Auth signup atomically persists private address + faith onboarding
       * when the 193A marker is present. This RPC remains the one idempotent
       * completion path for local-scope synchronization.
       */
      let localSetupError: any = null;

      for (
        let attempt = 0;
        attempt < 2;
        attempt += 1
      ) {
        const result = await (
          supabase as any
        ).rpc(
          'buklod_complete_registration_v1',
          {
            p_barangay:
              barangay.trim(),
            p_city_municipality:
              cityMunicipality.trim(),
            p_province:
              province.trim(),
            p_country:
              country.trim() ||
              'Philippines',
            p_postal_code:
              postalCode.trim() ||
              null,
            p_faith_identity:
              faithIdentity,
            p_show_faith_content:
              showFaithContent,
            p_country_code: null,
            p_province_code: null,
            p_city_municipality_code:
              null,
            p_barangay_code: null,
          }
        );

        localSetupError =
          result.error;

        if (!localSetupError) {
          break;
        }

        if (attempt == 0) {
          await new Promise(
            (resolve) =>
              setTimeout(resolve, 350)
          );
        }
      }

      if (localSetupError) {
        finishCreateAccount();

        Alert.alert(
          'Account created - local setup pending',
          'Your BUKLOD account and private onboarding were saved, but Local assignment could not finish. You may continue to Public Home and retry your address setup later.'
        );

        router.replace(
          '/(tabs)/home'
        );

        return;
      }

      if (referralCode.trim()) {
        try {
          await recordReferral(
            referralCode
          );
        } catch (
          referralError: unknown
        ) {
          console.warn(
            'Referral record failed:',
            referralError instanceof Error
              ? referralError.message
              : referralError,
          );
        }
      }

      finishCreateAccount();

"""
text = text[:start] + canonical + text[end:]

path.write_text(text, encoding='utf-8')
print('Registration hardening 193A source patch applied.')
