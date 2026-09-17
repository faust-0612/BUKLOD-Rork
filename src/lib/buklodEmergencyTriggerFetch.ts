import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type FetchLike = typeof fetch;

export type BuklodEmergencyTriggerSource =
  | 'IN_APP'
  | 'QUICK_TILE'
  | 'LOCKSCREEN_ACTION'
  | 'APP_SHORTCUT'
  | 'DEEP_LINK'
  | 'UNKNOWN';

type EmergencyTriggerContext = {
  source: BuklodEmergencyTriggerSource;
  locationAccuracyMeters?: number | null;
};

type EmergencyVerification =
  | 'LOCAL_DEVICE_AUTH'
  | 'DEVICE_AUTH_UNAVAILABLE';

const INSTALLATION_ID_KEY = 'buklod.sos.installation_id.v1';
const SOS_RPC_SUFFIX = '/rest/v1/rpc/buklod_help_create_request';
const ROOT_KEY = '__BUKLOD_SOS_TRIGGER_CONTEXT_R1__';

function triggerState() {
  const root = globalThis as any;
  if (!root[ROOT_KEY]) {
    root[ROOT_KEY] = {
      next: null as EmergencyTriggerContext | null,
      verificationInFlight: null as Promise<EmergencyVerification> | null,
    };
  }
  return root[ROOT_KEY] as {
    next: EmergencyTriggerContext | null;
    verificationInFlight: Promise<EmergencyVerification> | null;
  };
}

export function setNextBuklodEmergencyTriggerContext(
  context: EmergencyTriggerContext,
) {
  triggerState().next = {
    source: context.source,
    locationAccuracyMeters:
      typeof context.locationAccuracyMeters === 'number' &&
      Number.isFinite(context.locationAccuracyMeters)
        ? Math.max(0, context.locationAccuracyMeters)
        : null,
  };
}

function takeNextBuklodEmergencyTriggerContext(): EmergencyTriggerContext {
  const state = triggerState();
  const context = state.next ?? { source: 'IN_APP' as const };
  state.next = null;
  return context;
}

async function getInstallationId() {
  try {
    let value = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
    if (value) return value;
    value = Crypto.randomUUID();
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return value;
  } catch {
    return '';
  }
}

async function verifyEmergencyDeviceOwner(): Promise<EmergencyVerification> {
  if (Platform.OS === 'web') return 'DEVICE_AUTH_UNAVAILABLE';

  const state = triggerState();
  if (state.verificationInFlight) return state.verificationInFlight;

  state.verificationInFlight = (async () => {
    try {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const level = await LocalAuthentication.getEnrolledLevelAsync();

      if (!hardware || level === LocalAuthentication.SecurityLevel.NONE) {
        return 'DEVICE_AUTH_UNAVAILABLE';
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify BUKLOD SOS',
        promptSubtitle: 'Confirm that you are the signed-in BUKLOD user.',
        promptDescription:
          'Use fingerprint, Face ID, or the device authentication fallback before this emergency alert is sent.',
        cancelLabel: 'Cancel SOS',
        fallbackLabel: 'Use device PIN',
        disableDeviceFallback: false,
        requireConfirmation: false,
      });

      if (!result.success) {
        const reason = String(result.error ?? 'authentication_failed');
        throw new Error(`SOS_DEVICE_AUTH_REQUIRED:${reason}`);
      }

      return 'LOCAL_DEVICE_AUTH';
    } finally {
      state.verificationInFlight = null;
    }
  })();

  return state.verificationInFlight;
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function parseBody(init?: RequestInit) {
  if (typeof init?.body !== 'string') return null;
  try {
    return JSON.parse(init.body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isEmergencyCreateRequest(input: RequestInfo | URL, init?: RequestInit) {
  if (String(init?.method ?? 'GET').toUpperCase() !== 'POST') return false;
  const url = requestUrl(input);
  if (!url.includes(SOS_RPC_SUFFIX)) return false;
  const body = parseBody(init);
  return String(body?.p_kind ?? '').trim().toUpperCase() === 'EMERGENCY';
}

function localAuthFailureResponse(message: string) {
  return new Response(
    JSON.stringify({
      code: 'BUKLOD_SOS_DEVICE_AUTH_REQUIRED',
      message,
      hint:
        'Retry SOS and complete fingerprint, Face ID, or device authentication. If this phone has no device authentication enrolled, BUKLOD will continue with the signed-in session and mark the alert accordingly.',
    }),
    {
      status: 403,
      headers: { 'content-type': 'application/json' },
    },
  );
}

/**
 * Native emergency dispatch shield.
 *
 * This is intentionally at the transport boundary so EVERY current or future
 * call to buklod_help_create_request(kind=EMERGENCY) receives the same device
 * owner challenge. Normal HELP requests and every unrelated Supabase request
 * pass through untouched.
 *
 * Supabase authentication remains the server identity. Local device auth is an
 * additional anti-misuse gate; it never stores the user's BUKLOD password.
 */
export function createBuklodEmergencyTriggerFetch(baseFetch: FetchLike): FetchLike {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (Platform.OS === 'web' || !isEmergencyCreateRequest(input, init)) {
      return baseFetch(input as any, init as any);
    }

    const context = takeNextBuklodEmergencyTriggerContext();
    let verification: EmergencyVerification;

    try {
      verification = await verifyEmergencyDeviceOwner();
    } catch (error: any) {
      return localAuthFailureResponse(
        String(error?.message ?? 'Device authentication was not completed.'),
      );
    }

    const installationId = await getInstallationId();
    const headers = new Headers(init?.headers);
    headers.set('x-buklod-emergency-trigger-source', context.source);
    headers.set('x-buklod-emergency-verification', verification);
    headers.set('x-buklod-client-platform', Platform.OS);
    if (installationId) {
      headers.set('x-buklod-installation-id', installationId);
    }
    if (
      typeof context.locationAccuracyMeters === 'number' &&
      Number.isFinite(context.locationAccuracyMeters)
    ) {
      headers.set(
        'x-buklod-location-accuracy-m',
        String(Math.round(context.locationAccuracyMeters * 10) / 10),
      );
    }

    return baseFetch(input as any, {
      ...init,
      headers,
    } as any);
  }) as FetchLike;
}
