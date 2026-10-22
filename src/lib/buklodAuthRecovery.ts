import * as ExpoLinking from 'expo-linking';

import {
  supabase,
} from '@/lib/supabase';

export function
isInternalBuklodEmail(
  value:
    | string
    | null
    | undefined
) {
  const email =
    String(
      value ??
      ''
    )
      .trim()
      .toLowerCase();

  return (
    !email ||
    email.endsWith(
      '@buklod.invalid'
    )
  );
}

export function
isRealEmail(
  value:
    | string
    | null
    | undefined
) {
  const email =
    String(
      value ??
      ''
    )
      .trim()
      .toLowerCase();

  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    ) &&
    !isInternalBuklodEmail(
      email
    )
  );
}

export function
passwordRecoveryRedirectUrl() {
  return ExpoLinking
    .createURL(
      '/account/reset-password'
    );
}

function decodeValue(
  value: string
) {
  try {
    return decodeURIComponent(
      value.replace(
        /\+/g,
        ' '
      )
    );
  } catch {
    return value;
  }
}

function parseAuthParams(
  url: string
) {
  const result =
    new Map<
      string,
      string
    >();

  const parts =
    [
      url.includes('?')
        ? url
            .split('?')[1]
            ?.split('#')[0] ??
          ''
        : '',
      url.includes('#')
        ? url
            .split('#')[1] ??
          ''
        : '',
    ];

  for (
    const part
    of parts
  ) {
    for (
      const pair
      of part.split('&')
    ) {
      if (!pair) {
        continue;
      }

      const index =
        pair.indexOf('=');

      if (index < 0) {
        continue;
      }

      const key =
        decodeValue(
          pair.slice(
            0,
            index
          )
        );

      const value =
        decodeValue(
          pair.slice(
            index + 1
          )
        );

      result.set(
        key,
        value
      );
    }
  }

  return result;
}

export async function
consumeSupabaseRecoveryUrl(
  url:
    | string
    | null
    | undefined
) {
  if (!url) {
    return false;
  }

  const params =
    parseAuthParams(
      url
    );

  const code =
    params.get(
      'code'
    );

  if (code) {
    const {
      error,
    } =
      await supabase
        .auth
        .exchangeCodeForSession(
          code
        );

    if (error) {
      throw error;
    }

    return true;
  }

  const accessToken =
    params.get(
      'access_token'
    );

  const refreshToken =
    params.get(
      'refresh_token'
    );

  if (
    accessToken &&
    refreshToken
  ) {
    const {
      error,
    } =
      await supabase
        .auth
        .setSession({
          access_token:
            accessToken,
          refresh_token:
            refreshToken,
        });

    if (error) {
      throw error;
    }

    return true;
  }

  return false;
}
