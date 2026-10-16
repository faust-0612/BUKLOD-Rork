/*
 * BUKLOD BSOC CLIENT SAFETY R1 — only approved DEV->RC->OTA should ship this.
 * Anonymous clients and legacy builds cannot be identified by this module.
 * No client-submitted arbitrary SQL, scripts, updates or personal descriptions.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const ID_KEY = '@buklod/bsoc-client-r1/install-id';
const REGISTERED_PREFIX = '@buklod/bsoc-client-r1/version/';
const REGISTRATION_INTERVAL_MS = 6 * 60 * 60_000;
const REQUEST_COOLDOWN_MS = 30 * 60_000;
const requestTimes = new Map<string, number>();
let identityPromise: Promise<string> | null = null;
let registrationPromise: Promise<void> | null = null;

function asVersion(value: unknown) {
  const v = String(value ?? '0.0.0').trim();
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v) ? v : '0.0.0';
}
function asBuild(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}
function asUuid(value: unknown): string | null {
  const s = String(value ?? '');
  return /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(s) ? s : null;
}
function platform() {
  return Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android';
}
export function buklodClientReleaseIdentityR1() {
  return {
    p_platform: platform(),
    p_app_version: asVersion((Constants as any).nativeAppVersion ?? Constants.expoConfig?.version),
    p_native_build: Platform.OS === 'web' ? null :
      asBuild((Constants as any).nativeBuildVersion ??
        (Platform.OS === 'android' ? Constants.expoConfig?.android?.versionCode : Constants.expoConfig?.ios?.buildNumber)),
    p_runtime_version: Platform.OS === 'web' ? null :
      (typeof Updates.runtimeVersion === 'string' ? Updates.runtimeVersion.slice(0, 80) : null),
    p_ota_update_id: Platform.OS === 'web' ? null : asUuid(Updates.updateId),
    p_update_channel: Platform.OS === 'web' ? null :
      (typeof Updates.channel === 'string' ? Updates.channel.slice(0, 40) : null),
  };
}

async function installationId() {
  if (!identityPromise) {
    identityPromise = (async () => {
      const existing = asUuid(await AsyncStorage.getItem(ID_KEY));
      if (existing) return existing;
      const created = Crypto.randomUUID();
      await AsyncStorage.setItem(ID_KEY, created);
      return created;
    })().catch(error => {
      identityPromise = null;
      throw error;
    });
  }
  return identityPromise;
}

/** Best effort: one initial report per login, then once per six hours. */
export async function registerBuklodClientReleaseR1(userId: string) {
  if (!userId || registrationPromise) return registrationPromise ?? undefined;
  registrationPromise = (async () => {
    try {
      const identity = buklodClientReleaseIdentityR1();
      const localKey = REGISTERED_PREFIX + userId;
      const fingerprint = [
        identity.p_platform, identity.p_app_version, identity.p_native_build,
        identity.p_runtime_version, identity.p_ota_update_id, identity.p_update_channel,
      ].join(':');
      const raw = await AsyncStorage.getItem(localKey);
      if (raw) {
        const [stamp, prior] = raw.split('|');
        if (prior === fingerprint && Date.now() - Number(stamp) < REGISTRATION_INTERVAL_MS) return;
      }
      const result = await (supabase as any).rpc('buklod_register_client_version_r1', {
        ...identity,
        p_installation_id: await installationId(),
      });
      if (result.error) return; // Optional telemetry must never break app login.
      await AsyncStorage.setItem(localKey, String(Date.now()) + '|' + fingerprint);
    } catch {
      // No recursive retries; the next foreground/login opportunity can retry.
    }
  })();
  try { await registrationPromise; } finally { registrationPromise = null; }
}

export type BuklodClientRequestKind =
  | 'RECOVERY_FAILED'
  | 'LOCAL_RECOVERY_RESULT'
  | 'UPGRADE_NOTICE'
  | 'REQUEST_HELP';
export type BuklodClientRequestResult =
  | 'REPORTED'
  | 'APPLIED_VERIFIED'
  | 'FAILED'
  | 'NOT_AVAILABLE';

/** Sanitized, deduplicated BSOC notification; never transmits free text or secrets. */
export async function notifyBuklodBsocClientR1(
  kind: BuklodClientRequestKind,
  code: string,
  result: BuklodClientRequestResult = 'REPORTED',
) {
  const safeCode = String(code).trim().toUpperCase();
  if (!/^[A-Z0-9_.:-]{2,64}$/.test(safeCode)) return false;
  const key = kind + ':' + safeCode + ':' + result;
  const last = requestTimes.get(key) ?? 0;
  if (Date.now() - last < REQUEST_COOLDOWN_MS) return false;
  requestTimes.set(key, Date.now());
  try {
    const identity = buklodClientReleaseIdentityR1();
    const { error } = await (supabase as any).rpc('buklod_bsoc_submit_client_request_r1', {
      p_kind: kind,
      p_safe_code: safeCode,
      p_platform: identity.p_platform,
      p_app_version: identity.p_app_version,
      p_native_build: identity.p_native_build,
      p_result: result,
    });
    return !error;
  } catch {
    return false; // Never cascade a telemetry outage.
  }
}
