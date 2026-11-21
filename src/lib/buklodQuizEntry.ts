import { Linking, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/*
 * BUKLOD_QUIZ_UNIFIED_MAIN_ENTRY_R21
 *
 * Canonical BUKLOD Main -> Quiz launcher.
 * Every Main Quiz door must use this helper so authenticated users never
 * fall through to the standalone Quiz sign-in page because one screen opened
 * the bare Quiz URL or used an older token-in-URL handoff.
 *
 * Security:
 * - validates the persisted Main session against Auth;
 * - refreshes once when the local session is stale;
 * - sends only the Main bearer token to the server-side bridge;
 * - never places Main access/refresh tokens in the Quiz URL;
 * - accepts the bridge's one-time Quiz launch URL only.
 */

const QUIZ_ENTRY_BRIDGE =
  'https://cjtehbfspgimyhifnjon.supabase.co/functions/v1/buklod-quiz-main-entry-v1';

const SESSION_TIMEOUT_MS = 8_000;
const ENTRY_TIMEOUT_MS = 15_000;

type QuizEntrySource =
  | 'buklod-main-profile'
  | 'buklod-main-classroom-student'
  | 'buklod-main-classroom'
  | 'buklod-main-faculty-examiner'
  | 'buklod-main-faculty-results';

type OpenBuklodQuizOptions = {
  source: QuizEntrySource;
};

/*
 * BUKLOD_QUIZ_DOOR_SESSION_FASTPATH_R1
 * The dedicated Quiz bridge verifies the signed Main JWT cryptographically.
 * Avoid a second getUser() network round-trip for an unexpired Main session.
 * Near-expiry sessions refresh before handoff; uncertain legacy sessions keep
 * remote validation. A rejected bridge JWT may refresh/retry exactly once.
 * No Main tokens appear in the Quiz URL.
 */
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

async function withTimeout<T>(operation: Promise<T>, ms: number, code: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(code)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function getValidatedMainAccessToken() {
  const current = await withTimeout(
    supabase.auth.getSession(),
    SESSION_TIMEOUT_MS,
    'BUKLOD_MAIN_SESSION_READ_TIMEOUT',
  );
  if (current.error) throw current.error;

  const session = current.data.session;
  let accessToken = String(session?.access_token ?? '').trim();
  if (!accessToken) {
    throw new Error(
      'Your BUKLOD Main session is unavailable. Sign in to BUKLOD Main again, then open BUKLOD Quiz.',
    );
  }

  const expiresAt = Number(session?.expires_at ?? 0);
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Backend getClaims() remains the authoritative verifier. A still-fresh
  // signed JWT does not need a separate Main Auth /user request per door tap.
  if (Number.isFinite(expiresAt) && expiresAt > nowSeconds + TOKEN_EXPIRY_BUFFER_SECONDS) {
    return accessToken;
  }

  if (!expiresAt || !Number.isFinite(expiresAt)) {
    // Legacy sessions without expiry metadata retain the prior validation.
    const validation = await withTimeout(
      supabase.auth.getUser(accessToken),
      SESSION_TIMEOUT_MS,
      'BUKLOD_MAIN_SESSION_VALIDATE_TIMEOUT',
    ).catch(() => null);
    if (!validation?.error && validation?.data?.user) return accessToken;
  }

  const refreshed = await withTimeout(
    supabase.auth.refreshSession(),
    SESSION_TIMEOUT_MS,
    'BUKLOD_MAIN_SESSION_REFRESH_TIMEOUT',
  );

  accessToken = String(refreshed?.data?.session?.access_token ?? '').trim();
  if (refreshed?.error || !accessToken) {
    throw new Error(
      'Your saved BUKLOD session is no longer valid. Sign in to BUKLOD Main again, then open BUKLOD Quiz.',
    );
  }

  const revalidated = await withTimeout(
    supabase.auth.getUser(accessToken),
    SESSION_TIMEOUT_MS,
    'BUKLOD_MAIN_SESSION_REVALIDATE_TIMEOUT',
  );
  if (revalidated?.error || !revalidated?.data?.user) {
    throw new Error(
      'BUKLOD refreshed your session, but verification did not finish. Check your connection and retry.',
    );
  }
  return accessToken;
}

type QuizBridgeResult = {
  response: Awaited<ReturnType<typeof fetch>>;
  result: any;
};

async function requestQuizBridge(
  accessToken: string,
  options: OpenBuklodQuizOptions,
): Promise<QuizBridgeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENTRY_TIMEOUT_MS);
  try {
    const response = await fetch(QUIZ_ENTRY_BRIDGE, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: options.source }),
      signal: controller.signal,
    });
    // Keep the timeout active until the whole response body has arrived.
    const result = await response.json().catch(() => null);
    return { response, result };
  } catch (error: any) {
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(
        'BUKLOD Quiz entry timed out. Check your connection, then tap BUKLOD Quiz once to retry.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

let launchInFlight: Promise<string> | null = null;

async function createQuizLaunchUrlOnce(options: OpenBuklodQuizOptions) {
  const startedAt = Date.now();
  let accessToken = await getValidatedMainAccessToken();
  let bridge = await requestQuizBridge(accessToken, options);

  // Retry only a rejected Main session. Never retry ambiguous network errors,
  // 409 duplicate-entry claims, or a minted one-time handoff.
  if (
    bridge.response.status === 401 &&
    bridge.result?.error === 'main_session_required'
  ) {
    const refreshed = await withTimeout(
      supabase.auth.refreshSession(),
      SESSION_TIMEOUT_MS,
      'BUKLOD_MAIN_SESSION_REFRESH_TIMEOUT',
    );
    accessToken = String(refreshed?.data?.session?.access_token ?? '').trim();
    if (refreshed?.error || !accessToken) {
      throw new Error(
        'Your BUKLOD Main session expired. Sign in again, then open Quiz.',
      );
    }
    bridge = await requestQuizBridge(accessToken, options);
  }

  const { response, result } = bridge;
  const legacyLaunchUrl = String(result?.launch_url ?? '').trim();
  const sessionLaunchUrl = String(result?.session_launch_url ?? '').trim();
  const launchUrl =
    result?.session_launch_ready === true && sessionLaunchUrl
      ? sessionLaunchUrl
      : legacyLaunchUrl;

  if (response.status !== 200 || Date.now() - startedAt > 3000) {
    // Safe for BSOC aggregation: no user ID, bearer, magic URL, or token.
    console.warn('buklod_quiz_entry_result', {
      status: response.status,
      error_code: String(result?.error ?? 'none').slice(0, 80),
      elapsed_ms: Date.now() - startedAt,
    });
  }

  if (!response.ok || result?.ok !== true || !launchUrl) {
    if (result?.error === 'entry_already_in_progress') {
      throw new Error(
        'Your BUKLOD Quiz entry is already processing. Wait a few seconds, then tap once.',
      );
    }
    throw new Error(
      String(
        result?.message ??
          result?.error ??
          'Could not create your automatic BUKLOD Quiz session.',
      ),
    );
  }

  return launchUrl;
}

export function createBuklodQuizLaunchUrl(options: OpenBuklodQuizOptions) {
  if (launchInFlight) return launchInFlight;
  const pending = createQuizLaunchUrlOnce(options);
  launchInFlight = pending;
  // clear both resolved and rejected promises without unhandled rejections
  void pending.then(
    () => { if (launchInFlight === pending) launchInFlight = null; },
    () => { if (launchInFlight === pending) launchInFlight = null; },
  );
  return pending;
}

export async function openBuklodQuizFromMain(
  options: OpenBuklodQuizOptions,
) {
  const launchUrl = await createBuklodQuizLaunchUrl(options);

  /*
   * BUKLOD_QUIZ_MOBILE_DIRECT_ENTRY_R22
   *
   * React Native Web's Linking.openURL() may rely on a browser-created window.
   * Because Quiz entry first performs async session validation + one-time SSO
   * minting, some mobile browsers/PWA/WebViews no longer treat the final open
   * as part of the original tap and may block it. canOpenURL() can also return
   * false on otherwise valid HTTPS links on some devices.
   *
   * For web, use same-context navigation so the handoff cannot be blocked as a
   * popup. Native keeps Linking.openURL(). The server-issued URL is still the
   * only URL accepted from createBuklodQuizLaunchUrl().
   */
  if (Platform.OS === 'web') {
    /*
     * BUKLOD_QUIZ_WEB_SAME_CONTEXT_REPLACE_R23
     * Prefer same-tab replace so mobile Safari/PWA/WebViews cannot treat the
     * post-await navigation as a popup and the stale Main route is not left
     * as the immediate history entry. Keep assign as a compatibility fallback.
     */
    const webLocation = (globalThis as any)?.location;

    if (typeof webLocation?.replace === 'function') {
      try {
        webLocation.replace(launchUrl);
        return;
      } catch {
        // Fall through to assign below.
      }
    }

    if (typeof webLocation?.assign === 'function') {
      try {
        webLocation.assign(launchUrl);
        return;
      } catch {
        // Fall through to native Linking fallback below.
      }
    }
  }

  try {
    await Linking.openURL(launchUrl);
  } catch {
    throw new Error(
      'This device could not open BUKLOD Quiz. Check the browser/app link settings, then tap BUKLOD Quiz once again.',
    );
  }
}
