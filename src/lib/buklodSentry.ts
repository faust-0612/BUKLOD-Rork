import * as Sentry from '@sentry/react-native';

/* BUKLOD_SENTRY_PRODUCTION_R1
 * Crash/performance diagnostics only. Do not attach pastoral, prayer,
 * reflection, message, auth-token, or other private content as custom context.
 */
const dsn = (process.env.EXPO_PUBLIC_SENTRY_DSN ?? '').trim();

/* BUKLOD_SENTRY_IAB_NOISE_R1
 * Facebook/Meta in-app browsers inject an iabjs postMessage bridge.
 * If the host activity closes, that injected bridge can throw
 * "Java object is gone". It is not a BUKLOD app failure.
 */
function isKnownInAppBrowserBridgeNoise(event: any) {
  const values = event?.exception?.values ?? [];

  const messages = [
    event?.message,
    ...values.map((value: any) => value?.value),
  ]
    .filter(Boolean)
    .map((value: unknown) => String(value));

  const frameFiles =
    values.flatMap((value: any) =>
      (value?.stacktrace?.frames ?? [])
        .map((frame: any) =>
          String(frame?.filename ?? '')
        )
    );

  const javaObjectGone =
    messages.some(message =>
      /error invoking postmessage:\s*java object is gone/i
        .test(message)
    );

  const injectedIabFrame =
    frameFiles.some((filename: string) =>
      /^iabjs:\/\//i.test(filename)
    );

  return javaObjectGone && injectedIabFrame;
}

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn) && !__DEV__,
  environment: (process.env.EXPO_PUBLIC_APP_ENV ?? 'production').trim(),
  sendDefaultPii: false,
  tracesSampleRate: 0.02,
  enableAutoSessionTracking: true,
  beforeSend(event) {
    if (isKnownInAppBrowserBridgeNoise(event)) {
      return null;
    }
    return event;
  },
});
