/* BUKLOD_CLIENT_VERSION_TELEMETRY_R1
 * Observe which compatible OTA is actually running, not just downloaded.
 * Per-account installation IDs are random; no hardware identifiers are read.
 * Noncritical telemetry must NEVER block login, calls, feed or navigation.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { shouldReportClientVersion, type LastVersionReport } from '@/lib/buklodClientVersionPolicy';

const REPORT_TIMEOUT_MS = 5_000;
const FAILURE_BACKOFF_MS = 30 * 60_000;
const inFlight = new Map<string, Promise<void>>();
const retryAfter = new Map<string, number>();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function accountInstallationId(userId: string): Promise<string> {
  // Per-user identity prevents accidental cross-account correlation.
  const key = 'buklod:version-installation:v1:' + userId;
  const stored = await AsyncStorage.getItem(key);
  if (stored && uuidPattern.test(stored)) return stored;
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(key, created);
  return created;
}

async function reportOnce(userId: string) {
  const appVersion = Constants.expoConfig?.version ?? '';
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(appVersion)) return;
  const updateId = Updates.updateId ?? null;
  const runtimeVersion = Updates.runtimeVersion ?? null;
  const updateChannel = Updates.channel ?? null;
  const fingerprint = JSON.stringify([appVersion, runtimeVersion, updateId, updateChannel]);
  const lastKey = 'buklod:version-report:v1:' + userId;
  let previous: LastVersionReport | null = null;

  try {
    const stored = await AsyncStorage.getItem(lastKey);
    if (stored) previous = JSON.parse(stored) as LastVersionReport;
  } catch {
    // A broken local cache is not a reason to block app usage.
  }
  if (!shouldReportClientVersion(previous, fingerprint, Date.now())) return;

  try {
    const installationId = await accountInstallationId(userId);
    const { error } = await withBuklodTimeout(
      (supabase as any).rpc('buklod_register_client_version_r1', {
        p_installation_id: installationId,
        p_platform: 'android',
        p_app_version: appVersion,
        // Expo Constants no longer exposes reliable native build number.
        // Do not fabricate it from an OTA manifest: the server accepts null.
        p_native_build: null,
        p_runtime_version: runtimeVersion,
        p_ota_update_id: updateId,
        p_update_channel: updateChannel,
      }),
      REPORT_TIMEOUT_MS,
      'BUKLOD version reporting',
    );
    if (error) throw error;
    await AsyncStorage.setItem(lastKey, JSON.stringify({ fingerprint, at: Date.now() }));
    retryAfter.delete(userId);
  } catch {
    retryAfter.set(userId, Date.now() + FAILURE_BACKOFF_MS);
    // Best effort by design; sensitive session or account data is not logged.
  }
}

export async function reportBuklodClientVersion(userId: string): Promise<void> {
  if (__DEV__ || Platform.OS !== 'android' || !Updates.isEnabled || !userId) return;
  const now = Date.now();
  if (now < (retryAfter.get(userId) ?? 0)) return;
  const existing = inFlight.get(userId);
  if (existing) return existing;
  const task = reportOnce(userId);
  inFlight.set(userId, task);
  try {
    await task;
  } finally {
    if (inFlight.get(userId) === task) inFlight.delete(userId);
  }
}
