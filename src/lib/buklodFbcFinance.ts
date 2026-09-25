import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { buklodAdsTestMode } from '@/lib/buklodAdUnits';
import { supabase } from '@/lib/supabase';

const QUEUE_KEY = '@buklod/fbc/admob-paid-events-v1';
const MAX_QUEUE = 250;

type PaidEventInput = {
  placement: string;
  adUnitId: string;
  value: number;
  currency: string;
  precision: number;
};

type QueuedPaidEvent = {
  event_id: string;
  placement: string;
  ad_unit_id: string;
  value: number;
  currency: string;
  precision: number;
  app_version: string | null;
  platform: string;
  queued_at: string;
};

let flushing = false;

function createEventId() {
  return [
    'admob',
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 12),
  ].join('-');
}

async function readQueue(): Promise<QueuedPaidEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedPaidEvent[]) {
  if (!queue.length) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return;
  }

  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(queue.slice(-MAX_QUEUE)),
  );
}

export async function flushBuklodAdMobPaidEventQueue() {
  if (flushing || buklodAdsTestMode) return;

  flushing = true;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    const queue = await readQueue();

    while (queue.length) {
      const next = queue[0];

      const { error } = await supabase.functions.invoke(
        'fbc-admob-paid-event',
        {
          body: next,
        },
      );

      if (error) {
        console.warn(
          'BUKLOD FBC AdMob paid-event sync:',
          error.message,
        );
        break;
      }

      queue.shift();
      await writeQueue(queue);
    }
  } finally {
    flushing = false;
  }
}

export async function recordBuklodAdMobPaidEvent(
  input: PaidEventInput,
) {
  if (buklodAdsTestMode) return;

  const value = Number(input.value);
  const currency = String(input.currency ?? '').trim().toUpperCase();
  const precision = Number(input.precision ?? 0);
  const placement = String(input.placement ?? '').trim();
  const adUnitId = String(input.adUnitId ?? '').trim();

  if (
    !Number.isFinite(value) ||
    value < 0 ||
    !/^[A-Z]{3}$/.test(currency) ||
    !placement
  ) {
    return;
  }

  const event: QueuedPaidEvent = {
    event_id: createEventId(),
    placement,
    ad_unit_id: adUnitId,
    value,
    currency,
    precision: Number.isFinite(precision) ? precision : 0,
    app_version: Constants.expoConfig?.version ?? null,
    platform: Platform.OS,
    queued_at: new Date().toISOString(),
  };

  const queue = await readQueue();
  queue.push(event);
  await writeQueue(queue);

  await flushBuklodAdMobPaidEventQueue();
}
