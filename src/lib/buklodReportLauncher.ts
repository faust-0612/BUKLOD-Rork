import { Linking } from 'react-native';

const REPORT_PRODUCTION_URL = 'https://buklod-report-mzb.expo.app';

function trimBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function getBuklodReportWebBaseUrl() {
  const configured = trimBaseUrl(
    process.env.EXPO_PUBLIC_BUKLOD_REPORT_WEB_URL ?? ''
  );

  if (configured) {
    if (!/^https:\/\//i.test(configured)) {
      throw new Error('BUKLOD Report web URL must use HTTPS.');
    }
    return configured;
  }

  // Canonical Main-door default: always use the original stable production
  // hostname. QA/staging may opt in to another stable URL only through the
  // explicit EXPO_PUBLIC_BUKLOD_REPORT_WEB_URL override.
  return REPORT_PRODUCTION_URL;
}

export function buildBuklodReportExternalUrl(args: {
  scopeId: string;
  scopeType?: string;
}) {
  const scopeId = args.scopeId.trim();
  if (!scopeId) throw new Error('A Report scope is required.');

  const query = new URLSearchParams({
    scope_id: scopeId,
    entry: 'main',
  });

  const scopeType = args.scopeType?.trim();
  if (scopeType) query.set('source_scope_type', scopeType);

  return `${getBuklodReportWebBaseUrl()}/reports?${query.toString()}`;
}

/**
 * Open the standalone BUKLOD Report app.
 *
 * Only non-sensitive context is handed off in the URL. Authentication/session
 * tokens must never be placed in query parameters. The standalone Report app
 * performs its own canonical account/access checks after opening.
 */
export async function openBuklodReportExternal(args: {
  scopeId: string;
  scopeType?: string;
}) {
  const url = buildBuklodReportExternalUrl(args);
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    throw new Error('The BUKLOD Report app could not be opened on this device.');
  }
  await Linking.openURL(url);
  return url;
}
