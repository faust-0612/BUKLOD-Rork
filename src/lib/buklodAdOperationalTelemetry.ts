import {
  AD_OPERATIONAL_FLUSH_MS,
  AD_OPERATIONAL_MAX_BATCH_KEYS,
} from '@/lib/buklodAdMonetizationPolicy';
import { supabase } from '@/lib/supabase';

export type BuklodAdOperationalEvent = {
  eventKey: string;
  occurredAt: string;
  placementId: string;
  eventType: string;
  provider: string;
  platform: string;
  route: string;
  appVersion: string | null;
  buildVersion: string | null;
  runtimeVersion: string | null;
  sessionId: string;
  errorCategory: string | null;
  eventCount: number;
};

type Aggregate = BuklodAdOperationalEvent;

const aggregates = new Map<string, Aggregate>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let sequence = 0;

function aggregateKey(event: Omit<BuklodAdOperationalEvent, 'eventKey' | 'eventCount'>) {
  return [
    event.placementId,
    event.eventType,
    event.provider,
    event.platform,
    event.route,
    event.appVersion ?? '',
    event.buildVersion ?? '',
    event.runtimeVersion ?? '',
    event.sessionId,
    event.errorCategory ?? '',
  ].join('|');
}

function scheduleFlush() {
  if (flushTimer || aggregates.size === 0) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushBuklodAdOperationalTelemetry();
  }, AD_OPERATIONAL_FLUSH_MS);
}

export function enqueueBuklodAdOperationalEvent(
  event: Omit<BuklodAdOperationalEvent, 'eventKey' | 'eventCount'>,
) {
  const key = aggregateKey(event);
  const existing = aggregates.get(key);

  if (existing) {
    existing.eventCount = Math.min(1000, existing.eventCount + 1);
    existing.occurredAt = event.occurredAt;
  } else {
    sequence += 1;
    aggregates.set(key, {
      ...event,
      eventKey: `${event.sessionId}:${Date.now().toString(36)}:${sequence.toString(36)}`,
      eventCount: 1,
    });
  }

  if (aggregates.size >= AD_OPERATIONAL_MAX_BATCH_KEYS) {
    void flushBuklodAdOperationalTelemetry();
  } else {
    scheduleFlush();
  }
}

export async function flushBuklodAdOperationalTelemetry() {
  if (flushing || aggregates.size === 0) return;

  const keys = Array.from(aggregates.keys()).slice(
    0,
    AD_OPERATIONAL_MAX_BATCH_KEYS,
  );
  const batch = keys
    .map(key => aggregates.get(key))
    .filter((row): row is Aggregate => Boolean(row));

  if (batch.length === 0) return;

  for (const key of keys) aggregates.delete(key);
  flushing = true;

  try {
    const payload = batch.map(row => ({
      event_key: row.eventKey,
      occurred_at: row.occurredAt,
      placement_id: row.placementId,
      event_type: row.eventType,
      provider: row.provider,
      platform: row.platform,
      route: row.route,
      app_version: row.appVersion,
      build_version: row.buildVersion,
      runtime_version: row.runtimeVersion,
      session_id: row.sessionId,
      error_category: row.errorCategory,
      event_count: row.eventCount,
    }));

    const { error } = await (supabase as any).rpc(
      'record_buklod_ad_operational_events_v1',
      { p_events: payload },
    );

    if (error) throw error;
  } catch {
    for (const row of batch) {
      const key = aggregateKey(row);
      const existing = aggregates.get(key);
      if (existing) {
        existing.eventCount = Math.min(
          1000,
          existing.eventCount + row.eventCount,
        );
      } else if (aggregates.size < 100) {
        aggregates.set(key, row);
      }
    }
  } finally {
    flushing = false;
    scheduleFlush();
  }
}
