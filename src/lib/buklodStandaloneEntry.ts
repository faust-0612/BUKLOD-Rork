import { Linking, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

export type BuklodStandaloneTarget = 'home' | 'kingdom';

type StandaloneEntrySource =
  | 'buklod-main-home'
  | 'buklod-main-kingdom'
  | 'buklod-main-home-route'
  | 'buklod-main-kingdom-route';

type OpenStandaloneOptions = {
  target: BuklodStandaloneTarget;
  source: StandaloneEntrySource;
};

const SESSION_TIMEOUT_MS = 8_000;
const ENTRY_TIMEOUT_MS = 15_000;

function timeoutResult<T>(value: T, ms: number) {
  return new Promise<T>(resolve => {
    setTimeout(() => resolve(value), ms);
  });
}

async function getValidatedMainAccessToken() {
  const current = await supabase.auth.getSession();
  if (current.error) throw current.error;

  let accessToken = String(current.data.session?.access_token ?? '').trim();
  if (!accessToken) {
    throw new Error(
      'Your BUKLOD Main session is unavailable. Sign in to BUKLOD Main again, then open this app.',
    );
  }

  const validation = await Promise.race([
    supabase.auth.getUser(accessToken),
    timeoutResult<any>(
      {
        data: { user: null },
        error: new Error('BUKLOD_MAIN_SESSION_VALIDATE_TIMEOUT'),
      },
      SESSION_TIMEOUT_MS,
    ),
  ]);

  if (!validation?.error && validation?.data?.user) {
    return accessToken;
  }

  const refreshed = await Promise.race([
    supabase.auth.refreshSession(),
    timeoutResult<any>(
      {
        data: { session: null, user: null },
        error: new Error('BUKLOD_MAIN_SESSION_REFRESH_TIMEOUT'),
      },
      SESSION_TIMEOUT_MS,
    ),
  ]);

  accessToken = String(refreshed?.data?.session?.access_token ?? '').trim();
  if (refreshed?.error || !accessToken) {
    throw new Error(
      'Your saved BUKLOD session is no longer valid. Sign in to BUKLOD Main again, then retry.',
    );
  }

  const revalidated = await Promise.race([
    supabase.auth.getUser(accessToken),
    timeoutResult<any>(
      {
        data: { user: null },
        error: new Error('BUKLOD_MAIN_SESSION_REVALIDATE_TIMEOUT'),
      },
      SESSION_TIMEOUT_MS,
    ),
  ]);

  if (revalidated?.error || !revalidated?.data?.user) {
    throw new Error(
      'BUKLOD refreshed your session but could not validate it. Check your connection and try again.',
    );
  }

  return accessToken;
}

function getBridgeUrl() {
  const base = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!base) {
    throw new Error('BUKLOD standalone entry service is not configured.');
  }
  return `${base}/functions/v1/buklod-surface-main-entry-v1`;
}

export async function createBuklodStandaloneLaunchUrl(
  options: OpenStandaloneOptions,
) {
  const accessToken = await getValidatedMainAccessToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENTRY_TIMEOUT_MS);

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(getBridgeUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: options.target,
        source: options.source,
      }),
      signal: controller.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(
        'Opening this BUKLOD app timed out. Check your connection, then tap once to retry.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const result = await response.json().catch(() => null);
  const launchUrl = String(result?.session_launch_url ?? '').trim();

  if (!response.ok || result?.ok !== true || !launchUrl) {
    throw new Error(
      String(
        result?.message ??
          result?.error ??
          'Could not create a secure standalone BUKLOD session.',
      ),
    );
  }

  return launchUrl;
}

export async function openBuklodStandaloneFromMain(
  options: OpenStandaloneOptions,
) {
  const launchUrl = await createBuklodStandaloneLaunchUrl(options);

  if (Platform.OS === 'web') {
    const webLocation = (globalThis as any)?.location;
    if (typeof webLocation?.assign === 'function') {
      try {
        webLocation.assign(launchUrl);
        return;
      } catch {
        // Fall through to Linking.
      }
    }
  }

  try {
    await Linking.openURL(launchUrl);
  } catch {
    throw new Error(
      'This device could not open the standalone BUKLOD app. Check browser/app link settings and retry.',
    );
  }
}
