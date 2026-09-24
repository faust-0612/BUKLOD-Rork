import * as Sentry from '@sentry/react-native';

/* BUKLOD_SENTRY_PRODUCTION_R1
 * Crash/performance diagnostics only. Do not attach pastoral, prayer,
 * reflection, message, auth-token, or other private content as custom context.
 */
const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn) && !__DEV__,
  environment: (process.env.EXPO_PUBLIC_APP_ENV ?? 'production').trim(),
  sendDefaultPii: false,
  tracesSampleRate: 0.02,
  enableAutoSessionTracking: true,
});
