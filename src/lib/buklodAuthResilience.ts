import AsyncStorage from '@react-native-async-storage/async-storage';

import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { supabase } from '@/lib/supabase';

const AUTH_TRANSIENT_RETRY_MIN_MS = 700;
const AUTH_TRANSIENT_RETRY_JITTER_MS = 350;
const AUTH_LIFECYCLE_TIMEOUT_MS = 5_500;
const AUTH_PROFILE_FALLBACK_TIMEOUT_MS = 3_500;
const AUTH_LOCAL_SIGN_OUT_TIMEOUT_MS = 2_500;

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

function wait(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}

export async function signInWithPasswordResilient(
  credentials: Parameters<
    typeof supabase.auth.signInWithPassword
  >[0]
) {
  let result =
    await supabase.auth.signInWithPassword(
      credentials
    );

  if (
    result.error &&
    isBuklodTransientAuthError(result.error)
  ) {
    const retryDelay =
      AUTH_TRANSIENT_RETRY_MIN_MS +
      Math.floor(
        Math.random() *
          AUTH_TRANSIENT_RETRY_JITTER_MS
      );

    await wait(retryDelay);

    result =
      await supabase.auth.signInWithPassword(
        credentials
      );
  }

  return result;
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

  const sessionResult =
    await withBuklodTimeout<any>(
      supabase.auth.getSession(),
      1_500,
      'BUKLOD local session'
    ).catch(() => ({
      data: null,
      error: null,
    }));

  const userId =
    sessionResult?.data?.session?.user?.id ??
    null;

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
    // Browser/app navigation must never be held hostage by a slow /logout
    // request. Removing the persisted token guarantees a clean next boot.
    await clearBuklodPersistedAuthStorage();
  }

  return {
    error: signOutError,
  };
}
