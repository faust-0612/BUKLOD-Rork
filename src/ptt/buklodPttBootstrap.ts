import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {
  handleBuklodPttDutyResponse,
  startBuklodPttDutyNotifications,
} from './buklodPttDutyNotification';
import {
  bootstrapBuklodPttRuntime,
  handleBuklodPttPush,
  shutdownBuklodPttRuntime,
} from './buklodPttRuntime';
import { supabase } from './buklodPttCore';

const TASK = 'BUKLOD_PTT_BACKGROUND_RX_V1';
const PENDING_KEY = '@buklod/ptt/pending-rx-v1';

function parseMaybeJson(value: unknown) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function extractPttData(raw: any): any {
  if (!raw) return null;

  const direct = parseMaybeJson(raw?.dataString);
  if (direct && typeof direct === 'object') {
    const candidate = (direct as any).data ?? direct;
    if (candidate?.kind) return candidate;
  }

  const nested = parseMaybeJson(raw?.data?.dataString);
  if (nested && typeof nested === 'object') {
    const candidate = (nested as any).data ?? nested;
    if (candidate?.kind) return candidate;
  }

  const contentData =
    raw?.notification?.request?.content?.data ??
    raw?.request?.content?.data ??
    raw?.data;

  if (contentData?.kind) return contentData;
  return raw?.kind ? raw : null;
}

TaskManager.defineTask(TASK, async ({ data, error }: any) => {
  if (error) return;

  const payload = extractPttData(data);
  const kind = String(payload?.kind || '').toLowerCase();

  if (!kind.startsWith('ptt_')) return;

  await AsyncStorage.setItem(
    PENDING_KEY,
    JSON.stringify({
      ...payload,
      _received_at_ms: Date.now(),
    }),
  ).catch(() => undefined);

  if (
    kind === 'ptt_incoming' ||
    kind === 'ptt_priority' ||
    kind === 'ptt_sos'
  ) {
    await handleBuklodPttPush(payload).catch(() => undefined);
  }
});

void Notifications.registerTaskAsync(TASK).catch(() => undefined);

startBuklodPttDutyNotifications();
void bootstrapBuklodPttRuntime().catch(() => undefined);

supabase.auth.onAuthStateChange((event: string, session: any) => {
  if (event === 'SIGNED_OUT' || !session) {
    void shutdownBuklodPttRuntime();
    return;
  }

  void bootstrapBuklodPttRuntime().catch(() => undefined);
});

Notifications.addNotificationResponseReceivedListener((response) => {
  if (handleBuklodPttDutyResponse(response)) return;
  const data = response?.notification?.request?.content?.data;
  if (!data) return;
  void handleBuklodPttPush(data).catch(() => undefined);
});

void Notifications.getLastNotificationResponseAsync()
  .then((response) => {
    const data = response?.notification?.request?.content?.data;
    if (!data || data.kind === 'ptt_duty') return;
    return handleBuklodPttPush(data);
  })
  .catch(() => undefined);

void AsyncStorage.getItem(PENDING_KEY)
  .then(async (raw) => {
    if (!raw) return;

    const data = JSON.parse(raw);
    const age = Date.now() - Number(data?._received_at_ms || 0);

    await AsyncStorage.removeItem(PENDING_KEY).catch(() => undefined);

    if (age >= 0 && age <= 45000) {
      await handleBuklodPttPush(data).catch(() => undefined);
    }
  })
  .catch(() => undefined);