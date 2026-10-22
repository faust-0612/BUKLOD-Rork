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

async function sessionDeadline<T>(pending: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(pending),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('BUKLOD_SESSION_CHECK_TIMEOUT')), SESSION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isSessionTransportError(error: any) {
  const status = Number(error?.status ?? 0);
  return !status || status >= 500 ||
    error?.name === 'AuthRetryableFetchError';
}

export async function getValidatedMainAccessToken() {
  let current: Awaited<ReturnType<typeof supabase.auth.getSession>>;
  try {
    // Session storage/refresh can stall under a weak connection too.
    current = await sessionDeadline(supabase.auth.getSession());
  } catch {
    throw new Error('BUKLOD could not load your saved session yet. Check your connection, then tap Quiz again.');
  }
  if (current.error) {
    if (isSessionTransportError(current.error)) {
      throw new Error('BUKLOD could not load your saved session yet. Check your connection, then tap Quiz again.');
    }
    throw current.error;
  }
  const saved = current.data.session;
  let accessToken = String(saved?.access_token ?? '').trim();
  if (!accessToken) {
    throw new Error('Your BUKLOD Main session is unavailable. Sign in to BUKLOD Main again, then open BUKLOD Quiz.');
  }

  const savedIsCurrent = () => Number(saved?.expires_at ?? 0) * 1000 > Date.now() + 10_000;
  let validation: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    validation = await sessionDeadline(supabase.auth.getUser(accessToken));
  } catch {
    if (savedIsCurrent()) return accessToken;
    throw new Error('BUKLOD could not check your session yet. Check your connection, then tap Quiz again.');
  }
  if (!validation.error && validation.data.user) return accessToken;
  if (validation.error && isSessionTransportError(validation.error)) {
    // The bridge still validates the bearer token server-side.
    if (savedIsCurrent()) return accessToken;
    throw new Error('BUKLOD could not check your session yet. Check your connection, then tap Quiz again.');
  }

  let refreshed: Awaited<ReturnType<typeof supabase.auth.refreshSession>>;
  try {
    refreshed = await sessionDeadline(supabase.auth.refreshSession());
  } catch {
    throw new Error('BUKLOD could not refresh your session yet. Check your connection, then tap Quiz again.');
  }
  accessToken = String(refreshed.data.session?.access_token ?? '').trim();
  if (refreshed.error) {
    if (isSessionTransportError(refreshed.error)) {
      throw new Error('BUKLOD could not refresh your session yet. Check your connection, then tap Quiz again.');
    }
    throw new Error('Your saved BUKLOD session is no longer valid. Sign in to BUKLOD Main again, then open Quiz.');
  }
  if (!accessToken) throw new Error('Your BUKLOD Main session is unavailable. Sign in again, then open Quiz.');
  // refreshSession issued a fresh token; the bridge performs authoritative validation.
  return accessToken;
}

export async function createBuklodQuizLaunchUrl(
  options: OpenBuklodQuizOptions,
) {
  const accessToken = await getValidatedMainAccessToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENTRY_TIMEOUT_MS);

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(QUIZ_ENTRY_BRIDGE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: options.source }),
      signal: controller.signal,
    });
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
        'Your BUKLOD Quiz entry is already processing. Wait a few seconds, then tap BUKLOD Quiz once.',
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
