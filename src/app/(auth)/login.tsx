import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import {
  isBuklodInvalidCredentialsError,
  isBuklodTransientAuthError,
  resolveBuklodAccountLifecycleAfterLogin,
  signOutBuklodResilient,
} from '@/lib/buklodAuthResilience';
import {
  HomePressable,
  useBuklodReduceMotion,
} from '@/components/HomeMotion';
import {
  clearSavedSuggestedLoginPassword,
  consumePasswordRecoveryNotice,
} from '@/lib/buklodSuggestedLoginStorage';

const LOGIN_EASING = Easing.out(Easing.cubic);

function LoginMotionScale({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const opacity = useRef(
    new Animated.Value(1)
  ).current;
  const scale = useRef(
    new Animated.Value(1)
  ).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }

    opacity.setValue(0.65);
    scale.setValue(0.92);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        easing: LOGIN_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 280,
        easing: LOGIN_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, reduceMotion, scale]);

  return (
    <Animated.View
      style={[
        { opacity, transform: [{ scale }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function LoginMotionFadeUp({
  delay = 0,
  duration = 240,
  fromY = 10,
  fromOpacity = 0,
  children,
  style,
}: {
  delay?: number;
  duration?: number;
  fromY?: number;
  fromOpacity?: number;
  children: React.ReactNode;
  style?: object;
}) {
  const reduceMotion = useBuklodReduceMotion();
  const opacity = useRef(
    new Animated.Value(1)
  ).current;
  const translateY = useRef(
    new Animated.Value(0)
  ).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(fromOpacity);
    translateY.setValue(fromY);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: LOGIN_EASING,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: LOGIN_EASING,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    delay,
    duration,
    fromOpacity,
    fromY,
    opacity,
    reduceMotion,
    translateY,
  ]);

  return (
    <Animated.View
      style={[
        {
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function useLoginShake() {
  const reduceMotion = useBuklodReduceMotion();
  const shakeX = useRef(
    new Animated.Value(0)
  ).current;

  const triggerShake = useCallback(() => {
    if (reduceMotion) {
      return;
    }

    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: -8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 6,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: -6,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, shakeX]);

  return { shakeX, triggerShake };
}

const BUKLOD_FRESH_LOGIN_PUBLIC_INTENT_KEY =
  'buklod.auth.fresh_login_public.v1';

const BUKLOD_CANONICAL_LOGIN_TIMEOUT_MS = 15_000;
const BUKLOD_CANONICAL_SESSION_TIMEOUT_MS = 5_000;


/* PATCH_171I_SUGGESTED_LOGIN_BUBBLES */
type SuggestedLogin = {
  userId: string;
  identifier: string;
  displayName: string;
  avatarUrl: string | null;
  lastUsedAt: string;
  hasPassword: boolean;
};

const SUGGESTED_LOGINS_KEY =
  'buklod.suggested_logins.v2';

function suggestedLoginPasswordKey(
  userId: string
) {
  return `buklod.suggested_login.password.${userId}`;
}

/* PATCH_AUTH_RESILIENCE_R1_WEB_SECRET_STORAGE
 * SecureStore is native-only. Web uses the app's existing AsyncStorage
 * adapter so Suggested Login never crashes the browser login screen.
 */
async function readLoginSecret(key: string) {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function writeLoginSecret(
  key: string,
  value: string
) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteLoginSecret(key: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

function parseSuggestedLogins(
  raw: string | null
): SuggestedLogin[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (item): item is SuggestedLogin =>
          typeof item?.userId === 'string' &&
          typeof item?.identifier === 'string' &&
          typeof item?.displayName === 'string'
      )
      .map(item => ({
        ...item,
        avatarUrl:
          typeof item.avatarUrl === 'string'
            ? item.avatarUrl
            : null,
        lastUsedAt:
          typeof item.lastUsedAt === 'string'
            ? item.lastUsedAt
            : new Date(0).toISOString(),
        hasPassword:
          item.hasPassword === true,
      }))
      .sort(
        (a, b) =>
          new Date(b.lastUsedAt).getTime() -
          new Date(a.lastUsedAt).getTime()
      )
      .slice(0, 6);
  }
  catch {
    return [];
  }
}

async function signInForFreshPublicHome(
  identifier: string,
  password: string
) {
  /*
   * BUKLOD_CANONICAL_LOGIN_RESOLVER_R23
   *
   * Never derive/guess an internal auth email from the text entered by the
   * member. The central login service resolves Mobile / Username / Email to
   * the actual BUKLOD account first, then performs the password grant against
   * that account. This prevents recovered username-based accounts from
   * becoming unreachable when the member signs in with the mobile number
   * stored on the same profile.
   */
  try {
    await AsyncStorage.setItem(
      BUKLOD_FRESH_LOGIN_PUBLIC_INTENT_KEY,
      '1'
    );
  }
  catch (error) {
    console.warn(
      'Could not save fresh-login routing intent.',
      error
    );
  }

  const fail = async (error: any) => {
    await AsyncStorage.removeItem(
      BUKLOD_FRESH_LOGIN_PUBLIC_INTENT_KEY
    ).catch(() => undefined);

    return {
      data: {
        user: null,
        session: null,
      },
      error,
    } as any;
  };

  try {
    const {
      data,
      error: invokeError,
    } = await withBuklodTimeout(
      supabase.functions.invoke(
        'buklod-auth-login-v2',
        {
          body: {
            identifier,
            password,
          },
        }
      ),
      BUKLOD_CANONICAL_LOGIN_TIMEOUT_MS,
      'BUKLOD canonical sign-in'
    );

    if (invokeError) {
      return fail(invokeError);
    }

    if (!data?.ok) {
      return fail({
        code:
          String(data?.error ?? '').trim() ||
          'invalid_credentials',
        message:
          String(data?.message ?? '').trim() ||
          'Invalid username/mobile/email or password.',
        status:
          data?.error === 'invalid_credentials'
            ? 400
            : 503,
      });
    }

    const accessToken =
      String(
        data?.session?.access_token ?? ''
      ).trim();
    const refreshToken =
      String(
        data?.session?.refresh_token ?? ''
      ).trim();

    if (!accessToken || !refreshToken) {
      return fail({
        code: 'login_temporarily_unavailable',
        message:
          'Login service returned an incomplete session. Please try again.',
        status: 503,
      });
    }

    const sessionResult =
      await withBuklodTimeout(
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }),
        BUKLOD_CANONICAL_SESSION_TIMEOUT_MS,
        'BUKLOD local session persistence'
      );

    if (
      sessionResult.error ||
      !sessionResult.data?.session ||
      !sessionResult.data?.user
    ) {
      return fail(
        sessionResult.error ?? {
          code: 'login_temporarily_unavailable',
          message:
            'BUKLOD could not save the authenticated session. Please try again.',
          status: 503,
        }
      );
    }

    return sessionResult;
  }
  catch (error) {
    return fail(error);
  }
}

/* PATCH_174C_R5_SUGGESTED_LOGIN_AVATAR_EXACT_AST_FIX */
const SUGGESTED_LOGIN_BUKLOD_LOGO =
  require('../../../assets/release/buklod-generic.png');

function normalizeSuggestedAvatarUrl(
  rawAvatarUrl: unknown
): string | null {
  const value =
    typeof rawAvatarUrl === 'string'
      ? rawAvatarUrl.trim()
      : '';

  if (!value) {
    return null;
  }

  const markers = [
    '/storage/v1/object/public/profile-avatars/',
    '/storage/v1/object/sign/profile-avatars/',
    '/storage/v1/object/authenticated/profile-avatars/',
  ];

  for (const marker of markers) {
    const index =
      value.indexOf(marker);

    if (index < 0) {
      continue;
    }

    const encodedObjectPath =
      value
        .slice(
          index +
            marker.length
        )
        .split('?')[0];

    let objectPath =
      encodedObjectPath;

    try {
      objectPath =
        decodeURIComponent(
          encodedObjectPath
        );
    }
    catch {
      objectPath =
        encodedObjectPath;
    }

    if (!objectPath) {
      return null;
    }

    const {
      data,
    } =
      supabase
        .storage
        .from('profile-avatars')
        .getPublicUrl(
          objectPath
        );

    return (
      data?.publicUrl ||
      null
    );
  }

  if (
    /^https?:\/\//i.test(
      value
    )
  ) {
    return value;
  }

  const objectPath =
    value
      .replace(
        /^profile-avatars\//i,
        ''
      )
      .replace(
        /^\/+/, 
        ''
      );

  if (!objectPath) {
    return null;
  }

  const {
    data,
  } =
    supabase
      .storage
      .from('profile-avatars')
      .getPublicUrl(
        objectPath
      );

  return (
    data?.publicUrl ||
    null
  );
}

function canonicalSuggestedAvatarUrl(
  userId: string
): string | null {
  const clean =
    String(
      userId ||
      ''
    ).trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clean
    )
  ) {
    return null;
  }

  const {
    data,
  } =
    supabase
      .storage
      .from('profile-avatars')
      .getPublicUrl(
        `${clean}/avatar.jpg`
      );

  return (
    data?.publicUrl ||
    null
  );
}

function SuggestedLoginAvatar({
  avatarUrl,
  userId,
  style,
}: {
  avatarUrl: string | null;
  userId: string;
  style: any;
}) {
  const savedUrl =
    normalizeSuggestedAvatarUrl(
      avatarUrl
    );

  const canonicalUrl =
    canonicalSuggestedAvatarUrl(
      userId
    );

  const candidates =
    Array.from(
      new Set(
        [
          savedUrl,
          canonicalUrl,
        ].filter(
          (value):
            value is string =>
              typeof value ===
                'string' &&
              value.length > 0
        )
      )
    );

  const [
    candidateIndex,
    setCandidateIndex,
  ] =
    useState(0);

  const candidateKey =
    candidates.join('|');

  useEffect(() => {
    setCandidateIndex(0);
  }, [candidateKey]);

  const remoteUrl =
    candidates[
      candidateIndex
    ] ?? null;

  return (
    <Image
      source={
        remoteUrl
          ? {
              uri:
                remoteUrl,
            }
          : SUGGESTED_LOGIN_BUKLOD_LOGO
      }
      defaultSource={
        SUGGESTED_LOGIN_BUKLOD_LOGO
      }
      onError={() => {
        setCandidateIndex(
          current =>
            current + 1
        );
      }}
      resizeMode="cover"
      style={style}
    />
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loginStatus, setLoginStatus] = useState('');
  const [passwordRecoveryNotice, setPasswordRecoveryNotice] =
    useState(false);
  // HIGH_CONCURRENCY_LOGIN_R1: React state alone cannot stop same-tick double taps.
  const loginInFlightRef = useRef(false);
  const [
    suggestedLogins,
    setSuggestedLogins,
  ] = useState<SuggestedLogin[]>([]);

  const [
    suggestedLoginsLoaded,
    setSuggestedLoginsLoaded,
  ] = useState(false);

  // PATCH_171E_ONE_STEP_SMOOTH_LOGIN
  // Keep the Login screen mounted until AuthProvider is fully ready.
  // This prevents: Login -> tabs spinner -> Home.
  // PATCH_171F_LOGIN_SESSION_READY_GATE
  // Successful authentication must not deadlock on profile != null.
  // AuthProvider finishes its load cycle first; the Tabs layout then
  // applies the canonical profile/membership/community access rules.
  const { session, loading: authLoading } = useAuth();
  const [loginAccepted, setLoginAccepted] = useState(false);
  // PATCH_154B_REMEMBER_PASSWORD
  const [rememberPassword, setRememberPassword] =
    useState(false);
  const [rememberLoaded, setRememberLoaded] =
    useState(false);
  const { shakeX, triggerShake } = useLoginShake();

  useEffect(() => {
    let active = true;

    void consumePasswordRecoveryNotice()
      .then(notice => {
        if (active && notice) {
          setPasswordRecoveryNotice(true);
          setLoginStatus(
            'Password updated. Enter your new password once to sign in.'
          );
        }
      })
      .catch(error => {
        console.warn(
          'Could not load password recovery notice.',
          error
        );
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    void AsyncStorage
      .getItem(SUGGESTED_LOGINS_KEY)
      .then(raw => {
        if (!active) return;

        setSuggestedLogins(
          parseSuggestedLogins(raw)
        );
      })
      .catch(error => {
        console.warn(
          'Could not load suggested BUKLOD logins.',
          error
        );
      })
      .finally(() => {
        if (active) {
          setSuggestedLoginsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const saved =
          await AsyncStorage.getItem(
            'buklod.remembered_credentials.v1'
          );

        if (!active || !saved) {
          return;
        }

        const parsed = JSON.parse(saved);

        if (
          typeof parsed?.identifier === 'string' &&
          typeof parsed?.password === 'string'
        ) {
          setIdentifier(parsed.identifier);
          setPassword(parsed.password);
          setRememberPassword(true);
        }
      } catch (error) {
        console.warn(
          'Could not restore remembered BUKLOD credentials.',
          error
        );
      } finally {
        if (active) {
          setRememberLoaded(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  /* PATCH_171K_REMOVED_OLD_READY_ROUTE */
    /*
   * PATCH_171K_SUGGESTED_CONNECT_MANUAL_HOME
   */
  /* PATCH_171K_R3_REMOVED_SECOND_STAGE_STATE */

const chooseSuggestedLogin =
    async (item: SuggestedLogin) => {
      if (busy) {
        setLoginStatus(
          'A sign-in is already being processed. Please wait for it to finish.'
        );
        return;
      }

      setIdentifier(
        item.identifier
      );
      setShowPassword(false);

      try {
        const savedPassword =
          await readLoginSecret(
            suggestedLoginPasswordKey(
              item.userId
            )
          );

        if (savedPassword) {
          setPassword(
            savedPassword
          );
          setRememberPassword(
            true
          );

          /*
           * PATCH_171K_R3_TRUE_ONE_TAP_BUBBLE
           *
           * Do not merely select/fill this remembered account.
           * Authenticate in this same tap and go to Home.
           */
          void login({
            identifier:
              item.identifier,
            password:
              savedPassword,
            suggestedUserId:
              item.userId,
          });

          return;
        }

        setPassword('');
        setRememberPassword(false);
        setLoginStatus(
          'Enter the current password for this account. If you recently reset it, use the new password.'
        );
      }
      catch (error) {
        console.warn(
          'Could not open saved BUKLOD login.',
          error
        );

        setPassword('');
        setRememberPassword(false);
        setLoginStatus(
          'BUKLOD could not read the saved password on this device. Enter your current password manually.'
        );
        Alert.alert(
          'Saved login unavailable',
          'BUKLOD could not read the saved password on this device. Enter your current password manually. If you recently reset it, use the new password.'
        );
      }
    };

  const removeSuggestedLogin =
    async (item: SuggestedLogin) => {
      const next =
        suggestedLogins.filter(
          saved =>
            saved.userId !== item.userId
        );

      setSuggestedLogins(next);

      await Promise.allSettled([
        AsyncStorage.setItem(
          SUGGESTED_LOGINS_KEY,
          JSON.stringify(next)
        ),
        deleteLoginSecret(
          suggestedLoginPasswordKey(
            item.userId
          )
        ),
      ]);

      if (
        identifier.trim().toLowerCase() ===
        item.identifier.trim().toLowerCase()
      ) {
        setIdentifier('');
        setPassword('');
        setRememberPassword(false);
      }
    };

  const confirmRemoveSuggestedLogin =
    (item: SuggestedLogin) => {
      Alert.alert(
        'Remove suggested login?',
        `Remove ${item.displayName || item.identifier} from this device? This does not delete the BUKLOD account.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              void removeSuggestedLogin(item);
            },
          },
        ]
      );
    };

  const saveSuggestedLogin =
    async (
      loginIdentifier: string,
      loginPassword: string,
      authenticatedUser: any
    ) => {
      /*
       * HIGH_CONCURRENCY_LOGIN_R1
       * Canonical login already returned the authenticated user. Do not
       * call auth.getUser() and profiles again just to paint a local bubble.
       */
      const userId =
        String(authenticatedUser?.id ?? '').trim();

      if (!userId) {
        return;
      }

      const stored =
        parseSuggestedLogins(
          await AsyncStorage.getItem(
            SUGGESTED_LOGINS_KEY
          )
        );

      const existing =
        stored.find(
          item => item.userId === userId
        );

      const metadata =
        authenticatedUser?.user_metadata ?? {};

      const displayName =
        String(
          metadata?.full_name ||
          metadata?.display_name ||
          metadata?.name ||
          metadata?.username ||
          existing?.displayName ||
          loginIdentifier
        ).trim();

      const rawAvatar =
        metadata?.avatar_url ||
        metadata?.picture ||
        existing?.avatarUrl ||
        null;

      const nextItem: SuggestedLogin = {
        userId,
        identifier:
          loginIdentifier.trim(),
        displayName:
          displayName ||
          loginIdentifier.trim(),
        avatarUrl:
          typeof rawAvatar === 'string' &&
          rawAvatar.trim()
            ? rawAvatar.trim()
            : null,
        lastUsedAt:
          new Date().toISOString(),
        hasPassword:
          rememberPassword,
      };

      const next = [
        nextItem,
        ...stored.filter(
          item =>
            item.userId !== userId
        ),
      ].slice(0, 6);

      await AsyncStorage.setItem(
        SUGGESTED_LOGINS_KEY,
        JSON.stringify(next)
      );

      if (rememberPassword) {
        await writeLoginSecret(
          suggestedLoginPasswordKey(
            userId
          ),
          loginPassword
        );
      }
      else {
        await deleteLoginSecret(
          suggestedLoginPasswordKey(
            userId
          )
        );
      }

      setSuggestedLogins(next);
    };
  async function login(
    credentialsOverride?: {
      identifier: string;
      password: string;
      suggestedUserId?: string;
    },
  ) {
    const raw =
      (
        credentialsOverride
          ?.identifier ??
        identifier
      ).trim();

    const effectivePassword =
      credentialsOverride
        ?.password ??
      password;

    if (!raw || !effectivePassword) {
      setLoginStatus(
        'Enter your login and password to continue.'
      );
      triggerShake();
      return Alert.alert(
        'BUKLOD',
        'Enter your Mobile Number, Username, or Email and your password.'
      );
    }

    if (loginInFlightRef.current) {
      setLoginStatus(
        'Sign-in is already being processed. Please wait for the current attempt to finish.'
      );
      return;
    }

    loginInFlightRef.current = true;
    setBusy(true);
    setLoginStatus(
      'Checking your BUKLOD account…'
    );

    const releaseLogin = (
      status?: string
    ) => {
      loginInFlightRef.current = false;
      setBusy(false);
      if (typeof status === 'string') {
        setLoginStatus(status);
      }
    };

    let error: any = null;
    let authenticatedUser: any = null;

    const result =
      await signInForFreshPublicHome(
        raw,
        effectivePassword
      );

    error = result.error;

    authenticatedUser =
      result.data?.user ??
      null;

    if (error) {
      const temporaryFailure =
        isBuklodTransientAuthError(error);
      const invalidCredentials =
        isBuklodInvalidCredentialsError(error);

      if (
        invalidCredentials &&
        credentialsOverride?.suggestedUserId
      ) {
        await clearSavedSuggestedLoginPassword({
          userId:
            credentialsOverride.suggestedUserId,
          loginIdentifier: raw,
        }).catch(clearError => {
          console.warn(
            'Could not clear stale Suggested Login password.',
            clearError
          );
        });

        setSuggestedLogins(current =>
          current.map(item =>
            item.userId ===
            credentialsOverride.suggestedUserId
              ? {
                  ...item,
                  hasPassword: false,
                }
              : item
          )
        );
        setPassword('');
        setRememberPassword(false);
      }

      releaseLogin(
        temporaryFailure
          ? 'BUKLOD did not finish this sign-in request. You can try again; no extra request will be started while the old one is still active.'
          : invalidCredentials &&
            credentialsOverride?.suggestedUserId
            ? 'The saved password no longer matches this account. Enter the current password, then you may save it again.'
            : 'Login was not completed. Check your login and password, then try again.'
      );
      triggerShake();

      return Alert.alert(
        temporaryFailure
          ? 'BUKLOD is temporarily busy'
          : invalidCredentials &&
            credentialsOverride?.suggestedUserId
            ? 'Saved password needs updating'
            : 'Login failed',
        temporaryFailure
          ? 'BUKLOD did not finish the sign-in request. Please try again. If this continues, close and reopen BUKLOD before retrying.'
          : invalidCredentials &&
            credentialsOverride?.suggestedUserId
            ? 'The password saved on this device is no longer valid. Enter your current password. If you recently reset it, use the new password.'
            : 'Invalid login identifier or password.'
      );
    }

    // PATCH_171D_NO_LOGIN_UI_FLICKER
    // Keep the Login screen busy after successful authentication.
    // Navigation starts immediately; non-critical credential storage
    // may finish while the authenticated route is already opening.
    /* PATCH_174C_DEACTIVATED_LOGIN_GATE
     * A voluntarily deactivated account may authenticate only far enough to
     * choose whether to reactivate. Normal app navigation remains blocked.
     */
    const {
      data: accountLifecycle,
      error: accountLifecycleError,
    } =
      await resolveBuklodAccountLifecycleAfterLogin();

    if (accountLifecycleError) {
      await signOutBuklodResilient();

      const temporaryFailure =
        isBuklodTransientAuthError(
          accountLifecycleError
        );

      releaseLogin(
        temporaryFailure
          ? 'Password accepted, but BUKLOD could not finish the account-status check. Please try again.'
          : 'BUKLOD could not verify this account status. Please try again.'
      );

      Alert.alert(
        temporaryFailure
          ? 'BUKLOD is temporarily busy'
          : 'Account Status',
        temporaryFailure
          ? 'Your password was accepted, but BUKLOD could not safely finish the account-status check. Please try again in a moment.'
          : 'BUKLOD could not verify this account status. Sign-in was stopped safely. Please try again.'
      );
      return;
    }

    const accountWasSelfDeactivated =
      accountLifecycle?.deactivated === true;
    const accountIsInactive =
      accountLifecycle?.is_active === false;

    if (
      accountWasSelfDeactivated ||
      accountIsInactive
    ) {
      releaseLogin();

      Alert.alert(
        accountWasSelfDeactivated
          ? 'Account Deactivated'
          : 'Account Inactive',
        accountWasSelfDeactivated
          ? (
              accountLifecycle?.can_self_reactivate === true
                ? 'This account is currently deactivated. Reactivate it to continue using BUKLOD.'
                : 'This account cannot be self-reactivated. Please contact a BUKLOD administrator.'
            )
          : 'This account is inactive. Please contact a BUKLOD administrator.',
        accountLifecycle?.can_self_reactivate === true
          ? [
              {
                text: 'CANCEL',
                style: 'cancel',
                onPress: () => {
                  void signOutBuklodResilient();
                },
              },
              {
                text: 'REACTIVATE',
                onPress: async () => {
                  setBusy(true);
                  try {
                    const {
                      data: reactivateResult,
                      error: reactivateError,
                    } = await (supabase as any).rpc(
                      'reactivate_my_account'
                    );

                    if (reactivateError) throw reactivateError;
                    if (!reactivateResult?.ok) {
                      throw new Error('Account reactivation was not completed.');
                    }

                    // Refresh cleanly through the same successful Login path so
                    // AuthProvider reloads the now-active profile before Home.
                    await signOutBuklodResilient();
                    releaseLogin();
                    void login({
                      identifier: raw,
                      password: effectivePassword,
                    });
                  } catch (error: any) {
                    await signOutBuklodResilient();
                    releaseLogin();
                    Alert.alert(
                      'Could Not Reactivate',
                      String(error?.message ?? error ?? 'Please try again.')
                    );
                  }
                },
              },
            ]
          : [
              {
                text: 'OK',
                onPress: () => {
                  void signOutBuklodResilient();
                },
              },
            ]
      );

      return;
    }
    setLoginAccepted(true);
    setLoginStatus(
      'Signed in. Opening BUKLOD…'
    );

    /*
     * PATCH_171K_R3_BUBBLE_HOME_REOPEN_CONNECT
     *
     * A successful authentication action ALWAYS opens Public Home:
     * - manual Log In
     * - remembered Suggested Login bubble
     *
     * Existing-session app reopen is handled by src/app/index.tsx
     * and remains global/personal Connect.
     */
    router.replace(
      '/(tabs)/home'
    );


    /*
     * PATCH_171K_SUGGESTED_CONNECT_MANUAL_HOME
     *
     * Manual Log In -> Public/global Home.
     * Remembered Suggested Profile -> global/personal Connect.
     * No intermediate route and no artificial delay.
     */

    /*
     * Keep Suggested Login persistence non-blocking.
     * Fresh login routing continues immediately through 171F.
     */
    void saveSuggestedLogin(
      raw,
      effectivePassword,
      authenticatedUser
    ).catch(error => {
      console.warn(
        'Could not save suggested BUKLOD login.',
        error
      );
    });

    // The account may sign in immediately, but AuthProvider will keep every
    // unverified account on /onboarding until System Admin approval.
    try {
      if (rememberPassword) {
        await AsyncStorage.setItem(
          'buklod.remembered_credentials.v1',
          JSON.stringify({
            identifier: raw,
            password: effectivePassword,
          })
        );
      } else {
        await AsyncStorage.removeItem(
          'buklod.remembered_credentials.v1'
        );
      }
    } catch (storageError) {
      console.warn(
        'Could not update remembered BUKLOD credentials.',
        storageError
      );
    }

  }

  /* PATCH_171K_R3_REMOVED_SECOND_STAGE_EFFECT */


  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <LoginMotionScale>
            <Image
              source={require('../../../assets/release/buklod-generic-photo.jpg')}
              style={styles.logo}
            />
          </LoginMotionScale>

          <LoginMotionFadeUp delay={60} duration={240}>
            <Text style={styles.title}>BUKLOD</Text>
          </LoginMotionFadeUp>

          <LoginMotionFadeUp delay={100} duration={240}>
            <Text style={styles.tagline}>
              Samahang Binuklod ng Pag-ibig
            </Text>
          </LoginMotionFadeUp>
        </View>

        {suggestedLoginsLoaded &&
        suggestedLogins.length > 0 ? (
          <LoginMotionFadeUp delay={120} duration={240} fromOpacity={0.78}>
          <View style={styles.suggestedSection}>
            <View style={styles.suggestedHeadingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestedTitle}>
                  Suggested Login
                </Text>

                <Text style={styles.suggestedSubtitle}>
                  Tap a profile so you do not have to type it again.
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.suggestedRow}
            >
              {suggestedLogins.map((item, index) => (
                <LoginMotionFadeUp
                  key={item.userId}
                  delay={160 + index * 35}
                  duration={220}
                  fromOpacity={0.78}
                  fromY={8}
                >
                <View
                  style={styles.suggestedItem}
                >
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      void chooseSuggestedLogin(
                        item
                      )
                    }
                    style={({ pressed }) => [
                      styles.suggestedProfileButton,
                      pressed &&
                        styles.suggestedPressed,
                      identifier
                        .trim()
                        .toLowerCase() ===
                        item.identifier
                          .trim()
                          .toLowerCase() &&
                        styles.suggestedSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${item.displayName} login`}
                  >
                    <View style={styles.suggestedAvatarWrap}>
                      {<SuggestedLoginAvatar
                          avatarUrl={item.avatarUrl}
                          userId={item.userId}
                          style={styles.suggestedAvatar}
                        />}

                      {item.hasPassword ? (
                        <View style={styles.suggestedKeyBadge}>
                          <Ionicons
                            name="key"
                            size={10}
                            color="#FFFFFF"
                          />
                        </View>
                      ) : null}
                    </View>

                    <Text
                      numberOfLines={1}
                      style={styles.suggestedName}
                    >
                      {item.displayName}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={styles.suggestedIdentifier}
                    >
                      {item.identifier}
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      confirmRemoveSuggestedLogin(
                        item
                      )
                    }
                    hitSlop={BUKLOD_HIT_SLOP}
                    style={({ pressed }) => ({
                      paddingVertical: 5,
                      opacity: pressed ? 0.55 : 1,
                    })}
                  >
                    <Text style={styles.suggestedRemove}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
                </LoginMotionFadeUp>
              ))}
            </ScrollView>
          </View>
          </LoginMotionFadeUp>
        ) : null}
        {passwordRecoveryNotice ? (
          <View style={styles.recoveryNotice}>
            <Ionicons
              name="information-circle-outline"
              size={22}
              color={colors.greenDark}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.recoveryNoticeTitle}>
                Password updated
              </Text>
              <Text style={styles.recoveryNoticeText}>
                For your security, BUKLOD removed the old saved password on this device. Enter the new password once, then you may turn on Remember password again.
              </Text>
            </View>
          </View>
        ) : null}

        <Animated.View
          style={[
            styles.form,
            {
              transform: [{ translateX: shakeX }],
            },
          ]}
        >
          <LoginMotionFadeUp delay={140} duration={240} fromOpacity={0.78}>
          <Text style={styles.label}>
            Sign in with your mobile number, username,
            or email — all BUKLOD apps use the same login.
          </Text>

          <Text style={styles.help}>
            Use the login identifier you selected when you created your account.
          </Text>

          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Mobile / Username / Email"
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>

          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
            />

            <Pressable
              onPress={() => setShowPassword((value) => !value)}
              style={styles.eye}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.muted}
              />
            </Pressable>
          </View>
          <Pressable
            onPress={() =>
              setRememberPassword(
                (value) => !value
              )
            }
            disabled={!rememberLoaded || busy}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: rememberPassword,
              disabled: !rememberLoaded || busy,
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              marginBottom: 14,
              opacity:
                !rememberLoaded || busy
                  ? 0.55
                  : 1,
            }}
          >
            <Ionicons
              name={
                rememberPassword
                  ? 'checkbox-outline'
                  : 'square-outline'
              }
              size={22}
              color={colors.greenDark}
            />
            <Text
              style={{
                color: colors.greenDark,
                fontWeight: '800',
                fontSize: 13,
              }}
            >
              Remember password on this device
            </Text>
          </Pressable>

          <HomePressable
            haptic={false}
            onPress={() => void login()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={
              busy
                ? 'BUKLOD login in progress'
                : 'Log in to BUKLOD'
            }
            style={[
              styles.primary,
              busy && styles.primaryBusy,
            ]}
          >
            <View style={styles.primaryContent}>
              {busy ? (
                <ActivityIndicator
                  size="small"
                  color={colors.white}
                />
              ) : null}
              <Text style={styles.primaryText}>
                {busy ? 'LOGGING IN…' : 'LOG IN'}
              </Text>
            </View>
          </HomePressable>

          {!!loginStatus ? (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.loginStatus}
            >
              {loginStatus}
            </Text>
          ) : null}

          
          {/* PATCH_166D_PASSWORD_RECOVERY */}
          <Pressable
            onPress={() =>
              router.push(
                '/(auth)/forgot-password' as any
              )
            }
            disabled={busy}
            style={{
              alignSelf: 'flex-end',
              paddingVertical: 8,
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                color: colors.green,
                fontSize: 10,
                fontWeight: '900',
              }}
            >
              FORGOT PASSWORD?
            </Text>
          </Pressable>
          {/* PATCH_CREATE_ACCOUNT_TOUCH_R1 */}
          <Pressable
            onPress={() => router.push('/(auth)/register')}
            accessibilityRole="button"
            accessibilityLabel="Create BUKLOD account"
            hitSlop={8}
            style={styles.secondary}
          >
            <Text style={styles.secondaryText}>
              CREATE ACCOUNT
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/privacy' as any)}
            disabled={busy}
            accessibilityRole="link"
            accessibilityLabel="BUKLOD Privacy Policy"
            style={{ alignSelf: 'center', paddingVertical: 10 }}
          >
            <Text
              style={{
                color: colors.greenDark,
                fontSize: 13,
                fontWeight: '800',
                textDecorationLine: 'underline',
              }}
            >
              Privacy Policy
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/delete-account' as any)}
            disabled={busy}
            accessibilityRole="link"
            accessibilityLabel="BUKLOD account deletion"
            style={{ alignSelf: 'center', paddingBottom: 10 }}
          >
            <Text
              style={{
                color: colors.greenDark,
                fontSize: 13,
                fontWeight: '800',
                textDecorationLine: 'underline',
              }}
            >
              Delete Account
            </Text>
          </Pressable>

          <Text style={styles.note}>
            New accounts can enter the BUKLOD Community immediately. Local Church and BUKLOD Group access requires membership verification.
          </Text>
          </LoginMotionFadeUp>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 44,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  title: {
    marginTop: 12,
    fontSize: 30,
    fontWeight: '900',
    color: colors.greenDark,
  },
  tagline: {
    marginTop: 5,
    textAlign: 'center',
    color: colors.muted,
    lineHeight: 20,
  },
  suggestedSection: {
    marginBottom: 18,
    paddingVertical: 13,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE8E1',
  },
  suggestedHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  suggestedTitle: {
    color: colors.greenDark,
    fontSize: 14,
    fontWeight: '900',
  },
  suggestedSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 14,
  },
  suggestedRow: {
    paddingHorizontal: 10,
    gap: 8,
  },
  suggestedItem: {
    width: 94,
    alignItems: 'center',
  },
  suggestedProfileButton: {
    width: 90,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  suggestedPressed: {
    opacity: 0.72,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },
  suggestedSelected: {
    backgroundColor: '#EEF8F1',
    borderColor: '#A8D5B5',
  },
  suggestedAvatarWrap: {
    position: 'relative',
    width: 58,
    height: 58,
    marginBottom: 6,
  },
  suggestedAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#D7E7DC',
  },
  suggestedAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF5F0',
  },
  suggestedKeyBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenDark,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  suggestedName: {
    width: '100%',
    textAlign: 'center',
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '900',
  },
  suggestedIdentifier: {
    width: '100%',
    marginTop: 1,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 8.5,
  },
  suggestedRemove: {
    color: '#9A4D4D',
    fontSize: 9,
    fontWeight: '800',
  },
  recoveryNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C9DFCf',
    backgroundColor: '#EEF8F1',
  },
  recoveryNoticeTitle: {
    color: colors.greenDark,
    fontSize: 13,
    fontWeight: '900',
  },
  recoveryNoticeText: {
    marginTop: 3,
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  form: {
    gap: 8,
  },
  label: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
  },
  help: {
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 13,
    backgroundColor: colors.white,
  },
  passwordRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    padding: 13,
  },
  eye: {
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  primary: {
    marginTop: 8,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.green,
  },
  primaryBusy: {
    opacity: 0.82,
  },
  primaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: {
    color: colors.white,
    fontWeight: '900',
  },
  loginStatus: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  secondary: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.green,
    fontWeight: '900',
  },
  note: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
});

