/**
 * Privacy-safe Community Wall timings.
 * Never store post text, names, signed URLs, or credentials.
 */

import type { BuklodNetworkQuality } from '@/lib/buklodNetworkQuality';

export type CommunityFeedMetricStage =
  | 'feed_rpc'
  | 'first_text_paint'
  | 'media_prefetch'
  | 'video_player';

export type CommunityFeedMetric = {
  stage: CommunityFeedMetricStage;
  elapsedMs: number;
  status: 'ok' | 'error' | 'timeout' | 'cache';
  rowCount?: number;
  cache?: 'hit' | 'miss' | 'deduped';
  prefetchCount?: number;
  prefetchInFlight?: number;
  quality?: BuklodNetworkQuality;
  offline?: boolean;
  degraded?: boolean;
  player?: 'expo-video' | 'google-ima';
  at: number;
};

const metrics: CommunityFeedMetric[] = [];
const errorReportAt = new Map<string, number>();
const METRIC_LIMIT = 40;
const ERROR_DEDUPE_MS = 60_000;

export function recordCommunityFeedMetric(
  metric: Omit<CommunityFeedMetric, 'at'> & { at?: number },
) {
  metrics.push({
    stage: metric.stage,
    elapsedMs: Math.max(0, Math.round(Number(metric.elapsedMs) || 0)),
    status: metric.status,
    rowCount:
      metric.rowCount == null
        ? undefined
        : Math.max(0, Math.round(Number(metric.rowCount) || 0)),
    cache: metric.cache,
    prefetchCount: metric.prefetchCount,
    prefetchInFlight: metric.prefetchInFlight,
    quality: metric.quality,
    offline: metric.offline,
    degraded: metric.degraded,
    player: metric.player,
    at: metric.at ?? Date.now(),
  });

  while (metrics.length > METRIC_LIMIT) metrics.shift();
}

export function shouldReportCommunityFeedFailure(
  code: string,
  now = Date.now(),
) {
  const key = String(code ?? '').trim() || 'community_feed_failed';
  const previous = errorReportAt.get(key) ?? 0;
  if (previous > 0 && now - previous < ERROR_DEDUPE_MS) return false;
  errorReportAt.set(key, now);
  return true;
}

export function communityFeedMetricSnapshot() {
  return metrics.map(metric => ({ ...metric }));
}

export function resetCommunityFeedTelemetryForTests() {
  metrics.splice(0, metrics.length);
  errorReportAt.clear();
}
