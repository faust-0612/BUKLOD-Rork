import Constants from 'expo-constants';

import { buklodAdsTestMode } from '@/lib/buklodAdUnits';

export type BuklodAdDiagnosticPlacement =
  | 'home_bottom_banner'
  | 'community_inline'
  | 'reels_inline'
  | 'test';

export type BuklodAdDiagnosticEvent =
  | 'requested'
  | 'loaded'
  | 'displayed'
  | 'impression'
  | 'failed_load'
  | 'failed_show';

export type BuklodAdDiagnosticRecord = {
  placement: BuklodAdDiagnosticPlacement;
  event: BuklodAdDiagnosticEvent;
  timestamp: number;
  environment: string;
  appVersion: string | null;
  errorCode?: string;
  errorMessage?: string;
};

type PlacementCounts = {
  requested: number;
  loaded: number;
  displayed: number;
  impression: number;
  failed_load: number;
  failed_show: number;
};

const EMPTY_COUNTS: PlacementCounts = {
  requested: 0,
  loaded: 0,
  displayed: 0,
  impression: 0,
  failed_load: 0,
  failed_show: 0,
};

const MAX_RECENT = 40;

const countsByPlacement: Record<
  BuklodAdDiagnosticPlacement,
  PlacementCounts
> = {
  home_bottom_banner: { ...EMPTY_COUNTS },
  community_inline: { ...EMPTY_COUNTS },
  reels_inline: { ...EMPTY_COUNTS },
  test: { ...EMPTY_COUNTS },
};

const recent: BuklodAdDiagnosticRecord[] = [];

function appEnvironment() {
  return String(
    process.env.EXPO_PUBLIC_APP_ENV ??
      Constants.expoConfig?.extra?.appEnvironment ??
      'development',
  )
    .trim()
    .toLowerCase();
}

function appVersion() {
  return Constants.expoConfig?.version ?? null;
}

function sanitizeError(value: unknown) {
  if (value == null) return undefined;
  const raw =
    typeof value === 'object' && value && 'message' in value
      ? String((value as { message?: unknown }).message ?? '')
      : String(value);
  return raw.replace(/\S+@\S+/g, '[redacted]').slice(0, 180);
}

function sanitizeCode(value: unknown) {
  if (value == null) return undefined;
  if (typeof value === 'object' && value && 'code' in value) {
    return String((value as { code?: unknown }).code ?? '').slice(0, 40);
  }
  return undefined;
}

export function recordBuklodAdEvent(
  placement: BuklodAdDiagnosticPlacement,
  event: BuklodAdDiagnosticEvent,
  error?: unknown,
) {
  const bucket = countsByPlacement[placement];
  bucket[event] += 1;

  const record: BuklodAdDiagnosticRecord = {
    placement,
    event,
    timestamp: Date.now(),
    environment: appEnvironment(),
    appVersion: appVersion(),
    errorCode: event.startsWith('failed') ? sanitizeCode(error) : undefined,
    errorMessage: event.startsWith('failed')
      ? sanitizeError(error)
      : undefined,
  };

  recent.unshift(record);
  if (recent.length > MAX_RECENT) {
    recent.length = MAX_RECENT;
  }

  if (buklodAdsTestMode) {
    console.info('BUKLOD AdMob', placement, event, record.errorCode ?? '');
  }
}

export function getBuklodAdDiagnosticsSummary() {
  const placements = (
    Object.keys(countsByPlacement) as BuklodAdDiagnosticPlacement[]
  ).map((placement) => {
    const counts = countsByPlacement[placement];
    const rate =
      counts.requested > 0
        ? Math.round((counts.impression / counts.requested) * 100)
        : 0;
    const loadRate =
      counts.requested > 0
        ? Math.round((counts.loaded / counts.requested) * 100)
        : 0;

    return {
      placement,
      ...counts,
      loadToImpressionRate: rate,
      requestToLoadRate: loadRate,
    };
  });

  const totals = placements.reduce(
    (acc, row) => {
      acc.requested += row.requested;
      acc.loaded += row.loaded;
      acc.impression += row.impression;
      acc.failures += row.failed_load + row.failed_show;
      return acc;
    },
    { requested: 0, loaded: 0, impression: 0, failures: 0 },
  );

  return {
    environment: appEnvironment(),
    appVersion: appVersion(),
    testMode: buklodAdsTestMode,
    totals,
    loadToImpressionRate:
      totals.requested > 0
        ? Math.round((totals.impression / totals.requested) * 100)
        : 0,
    placements,
    recent: buklodAdsTestMode ? recent.slice(0, 12) : [],
  };
}

export type BuklodAdDiagnosticsSummary = ReturnType<
  typeof getBuklodAdDiagnosticsSummary
>;
