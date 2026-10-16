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

function timeoutResult<T>(value: T, ms: number) {
  return new Promise<T>(resolve => {
    setTimeout(() => resolve(value), ms);
  });
}

/* BUKLOD_QUIZ_AUTH_504_FAST_PATH_20261016
 * Quiz bridge verifies the signed Main token cryptographically (getClaims).
 * Avoid a separate Main /auth/v1/user request on every door tap: that service
 * returned 504/522 during active sessions and blocked valid users unnecessarily.
 * A 401 from the bridge is the only reason to refresh and retry once.
 */
async function getMainAccessToken() {
  const result: any = await Promise.race([
    supabase.auth.getSession(),
    timeoutResult<any>(
      {
        data: { session: null },
        error: new Error('BUKLOD_MAIN_SESSION_READ_TIMEOUT'),
      },
      SESSION_TIMEOUT_MS,
    ),
  ]);

  const token = String(result?.data?.session?.access_token ?? '').trim();
  if (token) return token;

  if (result?.error?.message === 'BUKLOD_MAIN_SESSION_READ_TIMEOUT') {
    throw new Error(
      'BUKLOD Main is taking too long to restore your session. Check your connection and tap Quiz again.',
    );
  }

  throw new Error(
    'BUKLOD Main has no usable session on this device. Sign in to BUKLOD Main, then open Quiz.',
  );
}

async function refreshMainTokenOnce() {
  const refreshed: any = await Promise.race([
    supabase.auth.refreshSession(),
    timeoutResult<any>(
      {
        data: { session: null },
        error: new Error('BUKLOD_MAIN_SESSION_REFRESH_TIMEOUT'),
      },
      SESSION_TIMEOUT_MS,
    ),
  ]);
  const token = String(refreshed?.data?.session?.access_token ?? '').trim();
  if (refreshed?.error || !token) {
    throw new Error(
      'Your BUKLOD Main session has expired or could not be refreshed. Sign in again, then open Quiz.',
    );
  }
  return token;
}

async function postQuizBridge(accessToken: string, source: QuizEntrySource) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENTRY_TIMEOUT_MS);
  try {
    return await fetch(QUIZ_ENTRY_BRIDGE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(
        'BUKLOD Quiz entry timed out. Check your connection, then tap Quiz once to retry.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function createBuklodQuizLaunchUrl(
  options: OpenBuklodQuizOptions,
) {
  let accessToken = await getMainAccessToken();
  let response = await postQuizBridge(accessToken, options.source);

  // A 401 is rejected before the Quiz gate/identity creation, so one
  // refresh + retry cannot duplicate attempts, exams, or handoff requests.
  if (response.status === 401) {
    accessToken = await refreshMainTokenOnce();
    response = await postQuizBridge(accessToken, options.source);
  }

  const result = await response.json().catch(() => null);
  const legacyLaunchUrl = String(result?.launch_url ?? '').trim();
  const sessionLaunchUrl = String(result?.session_launch_url ?? '').trim();
  const launchUrl =
    result?.session_launch_ready === true && sessionLaunchUrl
      ? sessionLaunchUrl
      : legacyLaunchUrl;

  if (!response.ok || result?.ok !== true || !launchUrl) {
    const code = String(result?.error ?? '').trim();

    if (code === 'entry_already_in_progress') {
      throw new Error(
        'Your BUKLOD Quiz entry is already processing. Wait a few seconds, then tap Quiz once.',
      );
    }
    if (response.status === 401 || code === 'main_session_required') {
      throw new Error(
        'Your BUKLOD Main session was rejected after refresh. Sign in again, then open Quiz.',
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
