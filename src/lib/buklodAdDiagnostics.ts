import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { buklodAdsTestMode } from '@/lib/buklodAdUnits';
import {
  enqueueBuklodAdOperationalEvent,
} from '@/lib/buklodAdOperationalTelemetry';

export type BuklodAdDiagnosticPlacement =
  | 'legacy_home_banner'
  | 'community_wall_feed'
  | 'content_inline'
  | 'prayer_banner'
  | 'messages_banner'
  | 'profile_banner'
  | 'reels_inline'
  | 'interstitial'
  | 'rewarded_optional'
  | 'test';

export type BuklodAdDiagnosticEvent =
  | 'ad_request'
  | 'ad_loaded'
  | 'ad_rendered'
  | 'ad_impression'
  | 'ad_failed'
  | 'ad_dismissed'
  | 'ad_opened';

type PlacementCounts = {
  ad_request: number;
  ad_loaded: number;
  ad_rendered: number;
  ad_impression: number;
  ad_failed: number;
  ad_dismissed: number;
  ad_opened: number;
};

export type BuklodAdDiagnosticRecord = {
  placement: BuklodAdDiagnosticPlacement;
  event: BuklodAdDiagnosticEvent;
  timestamp: number;
  environment: string;
  provider: 'ADMOB_NATIVE' | 'ADSENSE_WEB' | 'BUKLOD_SPONSOR';
  platform: string;
  route: string;
  appVersion: string | null;
  buildVersion: string | null;
  runtimeVersion: string | null;
  sessionId: string;
  errorCode?: string;
  errorMessage?: string;
};

const MAX_RECENT = 60;
const countsByPlacement = new Map<
  BuklodAdDiagnosticPlacement,
  PlacementCounts
>();
const recent: BuklodAdDiagnosticRecord[] = [];
const sessionId =
  `ads-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function blankCounts(): PlacementCounts {
  return {
    ad_request: 0,
    ad_loaded: 0,
    ad_rendered: 0,
    ad_impression: 0,
    ad_failed: 0,
    ad_dismissed: 0,
    ad_opened: 0,
  };
}

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

function buildVersion() {
  const value =
    (Constants as any).nativeBuildVersion ??
    Constants.expoConfig?.android?.versionCode ??
    Constants.expoConfig?.ios?.buildNumber ??
    null;
  return value == null ? null : String(value);
}

function runtimeVersion() {
  const value = Constants.expoConfig?.runtimeVersion as unknown;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, 80);
    } catch {}
  }
  return null;
}

function normalizeRoute(value: unknown) {
  const raw = String(value ?? '/').trim().split('?')[0]?.split('#')[0] || '/';
  return (raw.startsWith('/') ? raw : `/${raw}`).slice(0, 180);
}

function sanitizeError(value: unknown) {
  if (value == null) return undefined;
  const raw =
    typeof value === 'object' && value && 'message' in value
      ? String((value as { message?: unknown }).message ?? '')
      : String(value);
  return raw
    .replace(/\S+@\S+/g, '[redacted]')
    .replace(/\+?\d[\d\s().-]{7,}/g, '[redacted]')
    .slice(0, 180);
}

function sanitizeCode(value: unknown) {
  if (value == null) return undefined;
  if (typeof value === 'object' && value && 'code' in value) {
    return String((value as { code?: unknown }).code ?? '').slice(0, 48);
  }
  return undefined;
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function recordBuklodAdEvent(
  placement: BuklodAdDiagnosticPlacement,
  event: BuklodAdDiagnosticEvent,
  error?: unknown,
  context?: {
    route?: string | null;
    provider?: 'ADMOB_NATIVE' | 'ADSENSE_WEB' | 'BUKLOD_SPONSOR';
  },
) {
  const bucket = countsByPlacement.get(placement) ?? blankCounts();
  bucket[event] += 1;
  countsByPlacement.set(placement, bucket);

  const provider =
    context?.provider ??
    (Platform.OS === 'web' ? 'ADSENSE_WEB' : 'ADMOB_NATIVE');
  const errorCode = event === 'ad_failed' ? sanitizeCode(error) : undefined;
  const record: BuklodAdDiagnosticRecord = {
    placement,
    event,
    timestamp: Date.now(),
    environment: appEnvironment(),
    provider,
    platform: Platform.OS,
    route: normalizeRoute(context?.route),
    appVersion: appVersion(),
    buildVersion: buildVersion(),
    runtimeVersion: runtimeVersion(),
    sessionId,
    errorCode,
    errorMessage: event === 'ad_failed' ? sanitizeError(error) : undefined,
  };

  recent.unshift(record);
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;

  if (!buklodAdsTestMode) {
    enqueueBuklodAdOperationalEvent({
      occurredAt: new Date(record.timestamp).toISOString(),
      placementId: placement,
      eventType: event,
      provider,
      platform: Platform.OS,
      route: record.route,
      appVersion: record.appVersion,
      buildVersion: record.buildVersion,
      runtimeVersion: record.runtimeVersion,
      sessionId,
      errorCategory: errorCode ?? (event === 'ad_failed' ? 'AD_ERROR' : null),
    });
  } else {
    console.info(
      'BUKLOD Ad',
      placement,
      event,
      errorCode ?? '',
    );
  }
}

export function getBuklodAdDiagnosticsSummary() {
  const placements = Array.from(countsByPlacement.entries()).map(
    ([placement, counts]) => ({
      placement,
      requested: counts.ad_request,
      loaded: counts.ad_loaded,
      rendered: counts.ad_rendered,
      impression: counts.ad_impression,
      failed_load: counts.ad_failed,
      failed_show: 0,
      dismissed: counts.ad_dismissed,
      opened: counts.ad_opened,
      requestToLoadRate: percent(counts.ad_loaded, counts.ad_request),
      loadToRenderRate: percent(counts.ad_rendered, counts.ad_loaded),
      showRate: percent(counts.ad_impression, counts.ad_loaded),
      requestToImpressionRate: percent(
        counts.ad_impression,
        counts.ad_request,
      ),
    }),
  );

  const totals = placements.reduce(
    (acc, row) => {
      acc.requested += row.requested;
      acc.loaded += row.loaded;
      acc.rendered += row.rendered;
      acc.impression += row.impression;
      acc.failures += row.failed_load;
      return acc;
    },
    {
      requested: 0,
      loaded: 0,
      rendered: 0,
      impression: 0,
      failures: 0,
    },
  );

  const showRate = percent(totals.impression, totals.loaded);

  return {
    environment: appEnvironment(),
    appVersion: appVersion(),
    testMode: buklodAdsTestMode,
    totals,
    requestToLoadRate: percent(totals.loaded, totals.requested),
    loadToRenderRate: percent(totals.rendered, totals.loaded),
    showRate,
    requestToImpressionRate: percent(
      totals.impression,
      totals.requested,
    ),
    // Backward-compatible field name used by the staging diagnostics card.
    loadToImpressionRate: showRate,
    placements,
    recent: buklodAdsTestMode ? recent.slice(0, 20) : [],
  };
}

export type BuklodAdDiagnosticsSummary = ReturnType<
  typeof getBuklodAdDiagnosticsSummary
>;
