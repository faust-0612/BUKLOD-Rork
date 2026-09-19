import AsyncStorage from '@react-native-async-storage/async-storage';

import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { supabase } from '@/lib/supabase';
import {
  clearInflight,
  clearRealtimeRegistry,
  invalidateCache,
} from '@/lib/performance';

/* BUKLOD_AUTH_INFLIGHT_SHIELD_R1_RELEASE */
/* BUKLOD_PERMISSION_SNAPSHOT_R1_RELEASE */
/* BUKLOD_PERMISSION_SNAPSHOT_ANON_GUARD_R2_RELEASE */
/*
 * BUKLOD_LOGIN_LATENCY_GUARD_R2
 * Normal lifecycle checks are sub-second. Keep the safety gate authoritative,
 * but do not let a saturated database hold an already-authenticated login for
 * 5.5s plus another 3.5s fallback window.
 */
const AUTH_LIFECYCLE_TIMEOUT_MS = 1_800;
const AUTH_PROFILE_FALLBACK_TIMEOUT_MS = 1_500;
const AUTH_LOCAL_SESSION_TIMEOUT_MS = 1_200;
const AUTH_LOCAL_SIGN_OUT_TIMEOUT_MS = 2_500;
const AUTH_FRESH_SIGN_IN_USER_TTL_MS = 60_000;
const AUTH_PASSWORD_SIGN_IN_TIMEOUT_MS = 12_000;
const AUTH_EXISTING_PASSWORD_SIGN_IN_TIMEOUT_MS = 3_500;

/*
 * BUKLOD_MAIN_AUTH_STORM_R21
 * Keep the login lock on globalThis rather than component state so route
 * remounts / Fast Refresh cannot start a second password grant while the
 * first one is still running. One app runtime can only authenticate one
 * account at a time, so sharing the in-flight promise is the safest behavior.
 *
 * We also remember the user id from a successful password grant briefly.
 * The account-lifecycle gate can then query the profile fallback directly
 * without calling auth.getSession(), which can otherwise trigger another
 * refresh-token request when Auth is already under pressure.
 */
type BuklodAuthRuntimeState = {
  passwordSignInInFlight: Promise<any> | null;
  lastSignedInUserId: string | null;
  lastSignedInAt: number;
};

const AUTH_RUNTIME_STATE_KEY =
  '__BUKLOD_MAIN_AUTH_RUNTIME_R21__';

function getBuklodAuthRuntimeState(): BuklodAuthRuntimeState {
  const root = globalThis as any;
  const existing = root[AUTH_RUNTIME_STATE_KEY] as
    | BuklodAuthRuntimeState
    | undefined;

  if (existing) {
    return existing;
  }

  const created: BuklodAuthRuntimeState = {
    passwordSignInInFlight: null,
    lastSignedInUserId: null,
    lastSignedInAt: 0,
  };

  root[AUTH_RUNTIME_STATE_KEY] = created;
  return created;
}

const authRuntimeState = getBuklodAuthRuntimeState();

function authErrorText(error: any): string {
  return String(
    error?.message ??
      error?.error_description ??
      error?.error ??
      error ??
      ''
  ).toLowerCase();
}

function authErrorCode(error: any): string {
  return String(
    error?.code ??
      error?.error_code ??
      ''
  ).toLowerCase();
}

function authErrorStatus(error: any): number {
  const raw = Number(
    error?.status ??
      error?.statusCode ??
      error?.status_code ??
      0
  );

  return Number.isFinite(raw) ? raw : 0;
}

export function isBuklodInvalidCredentialsError(
  error: any
): boolean {
  const code = authErrorCode(error);
  const text = authErrorText(error);
  const status = authErrorStatus(error);

  return (
    code === 'invalid_credentials' ||
    text.includes('invalid login credentials') ||
    (
      status === 400 &&
      text.includes('invalid') &&
      text.includes('credential')
    )
  );
}

export function isBuklodRateLimitError(
  error: any
): boolean {
  if (!error) {
    return false;
  }

  const code = authErrorCode(error);
  const text = authErrorText(error);
  const status = authErrorStatus(error);

  return (
    status === 429 ||
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    text.includes('too many requests') ||
    text.includes('rate limit') ||
    text.includes('rate-limit')
  );
}

/*
 * BUKLOD_MASS_LOGIN_RATE_LIMIT_GUARD_R22
 * Keep rate-limit detection separate from generic transient failures so the
 * Login UI can pause repeated taps instead of amplifying a shared-IP burst.
 */
export function isBuklodTransientAuthError(
  error: any
): boolean {
  if (!error) {
    return false;
  }

  if (isBuklodInvalidCredentialsError(error)) {
    return false;
  }

  const code = authErrorCode(error);
  const text = authErrorText(error);
  const status = authErrorStatus(error);

  if (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return true;
  }

  return (
    code === 'request_timeout' ||
    code === 'unexpected_failure' ||
    text.includes('timed out') ||
    text.includes('timeout') ||
    text.includes('context deadline exceeded') ||
    text.includes('context canceled') ||
    text.includes('failed to connect') ||
    text.includes('network request failed') ||
    text.includes('fetch failed') ||
    text.includes('temporarily unavailable') ||
    text.includes('connection terminated') ||
    text.includes('connection reset')
  );
}

export async function signInWithPasswordResilient(
  credentials: Parameters<
    typeof supabase.auth.signInWithPassword
  >[0]
) {
  /*
   * HIGH_CONCURRENCY_LOGIN_R1 + BUKLOD_MAIN_AUTH_STORM_R21
   *
   * The underlying password request remains single-flight. The UI wait is
   * bounded separately so one slow auth request cannot leave the Login screen
   * permanently disabled. A timed-out caller does NOT start a second password
   * grant while the original request is still active.
   */
  if (authRuntimeState.passwordSignInInFlight) {
    try {
      return await withBuklodTimeout<any>(
        authRuntimeState.passwordSignInInFlight,
        AUTH_EXISTING_PASSWORD_SIGN_IN_TIMEOUT_MS,
        'BUKLOD sign-in already in progress'
      );
    }
    catch (error) {
      return {
        data: {
          user: null,
          session: null,
        },
        error,
      } as any;
    }
  }

  const task = supabase.auth
    .signInWithPassword(credentials)
    .then((result: any) => {
      const userId = String(
        result?.data?.user?.id ?? ''
      ).trim();

      if (!result?.error && userId) {
        authRuntimeState.lastSignedInUserId = userId;
        authRuntimeState.lastSignedInAt = Date.now();
      }

      return result;
    });

  authRuntimeState.passwordSignInInFlight = task;

  void task
    .finally(() => {
      if (
        authRuntimeState.passwordSignInInFlight ===
        task
      ) {
        authRuntimeState.passwordSignInInFlight =
          null;
      }
    })
    .catch(() => undefined);

  try {
    return await withBuklodTimeout<any>(
      task,
      AUTH_PASSWORD_SIGN_IN_TIMEOUT_MS,
      'BUKLOD password sign-in'
    );
  }
  catch (error) {
    return {
      data: {
        user: null,
        session: null,
      },
      error,
    } as any;
  }
}

export type BuklodAccountLifecycleResult = {
  data: any;
  error: any;
  usedProfileFallback: boolean;
};

export async function resolveBuklodAccountLifecycleAfterLogin():
  Promise<BuklodAccountLifecycleResult> {
  const lifecycle =
    await withBuklodTimeout<any>(
      (supabase as any).rpc(
        'buklod_my_account_lifecycle'
      ),
      AUTH_LIFECYCLE_TIMEOUT_MS,
      'BUKLOD account status'
    ).catch((error: any) => ({
      data: null,
      error,
    }));

  if (!lifecycle?.error) {
    return {
      data: lifecycle?.data ?? null,
      error: null,
      usedProfileFallback: false,
    };
  }

  if (
    !isBuklodTransientAuthError(
      lifecycle.error
    )
  ) {
    return {
      data: lifecycle?.data ?? null,
      error: lifecycle.error,
      usedProfileFallback: false,
    };
  }

  const freshUserId =
    authRuntimeState.lastSignedInUserId &&
    Date.now() - authRuntimeState.lastSignedInAt <=
      AUTH_FRESH_SIGN_IN_USER_TTL_MS
      ? authRuntimeState.lastSignedInUserId
      : null;

  let userId = freshUserId;

  /*
   * A successful password grant already returned the authenticated user id.
   * Reuse it during the immediate lifecycle fallback instead of asking Auth
   * for the session again. Only older/non-login callers need getSession().
   */
  if (!userId) {
    const sessionResult =
      await withBuklodTimeout<any>(
        supabase.auth.getSession(),
        AUTH_LOCAL_SESSION_TIMEOUT_MS,
        'BUKLOD local session'
      ).catch(() => ({
        data: null,
        error: null,
      }));

    userId =
      sessionResult?.data?.session?.user?.id ??
      null;
  }

  if (!userId) {
    return {
      data: lifecycle?.data ?? null,
      error: lifecycle.error,
      usedProfileFallback: false,
    };
  }

  const profileStatus =
    await withBuklodTimeout<any>(
      (supabase as any)
        .from('profiles')
        .select(
          'is_active,user_deactivated_at,user_deactivation_prev_active'
        )
        .eq('id', userId)
        .maybeSingle(),
      AUTH_PROFILE_FALLBACK_TIMEOUT_MS,
      'BUKLOD profile status'
    ).catch((error: any) => ({
      data: null,
      error,
    }));

  if (
    profileStatus?.error ||
    !profileStatus?.data
  ) {
    return {
      data: lifecycle?.data ?? null,
      error:
        profileStatus?.error ??
        lifecycle.error,
      usedProfileFallback: false,
    };
  }

  const deactivated =
    profileStatus.data.user_deactivated_at != null;

  return {
    data: {
      is_active:
        profileStatus.data.is_active === true,
      deactivated,
      deactivated_at:
        profileStatus.data.user_deactivated_at ??
        null,
      can_self_reactivate:
        deactivated &&
        profileStatus.data.user_deactivation_prev_active ===
          true,
    },
    error: null,
    usedProfileFallback: true,
  };
}

function persistedSupabaseAuthKeys() {
  const url = String(
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
      ''
  );

  let projectRef = '';

  try {
    projectRef =
      new URL(url).hostname.split('.')[0] ||
      '';
  }
  catch {
    projectRef = '';
  }

  return Array.from(
    new Set(
      [
        projectRef
          ? `sb-${projectRef}-auth-token`
          : '',
        'supabase.auth.token',
      ].filter(Boolean)
    )
  );
}

export async function clearBuklodPersistedAuthStorage() {
  const keys = persistedSupabaseAuthKeys();

  await Promise.allSettled(
    keys.map(key =>
      AsyncStorage.removeItem(key)
    )
  );
}

export async function signOutBuklodResilient() {
  let signOutError: any = null;

  authRuntimeState.lastSignedInUserId = null;
  authRuntimeState.lastSignedInAt = 0;

  try {
    const result =
      await withBuklodTimeout<any>(
        supabase.auth.signOut({
          scope: 'local',
        }),
        AUTH_LOCAL_SIGN_OUT_TIMEOUT_MS,
        'BUKLOD local sign out'
      );

    signOutError = result?.error ?? null;
  }
  catch (error) {
    signOutError = error;
  }
  finally {
    // Auth is a hard isolation boundary. Never let one account's cached
    // profile/points/scope state or realtime listeners survive into the next
    // signed-in account in the same app runtime.
    invalidateCache();
    clearInflight();
    clearRealtimeRegistry();

    // Browser/app navigation must never be held hostage by a slow /logout
    // request. Removing the persisted token guarantees a clean next boot.
    await clearBuklodPersistedAuthStorage();
  }

  return {
    error: signOutError,
  };
}
