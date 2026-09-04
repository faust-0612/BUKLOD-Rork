import React, {
  createElement,
  useEffect,
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodSponsorSlot from '@/components/BuklodSponsorSlot';
import type { BuklodAdPlacement } from '@/lib/buklodAdUnits';

/*
 * BUKLOD_WEB_ADS_R1
 *
 * AdMob is a native mobile SDK and cannot serve the Expo web build. Web uses
 * Google AdSense when a publisher client + slot are configured in the EAS
 * production environment. Until then, the same visible placement falls back
 * to BUKLOD's approved first-party sponsor inventory instead of disappearing.
 *
 * No timer refresh is used here. Each mounted, viewable slot requests at most
 * one Google ad, keeping the implementation policy-safe and user-visible.
 */

type SponsorPlacement =
  | 'home'
  | 'messages'
  | 'learn'
  | 'community'
  | 'prayer';

type Format =
  | 'adaptive'
  | 'inline'
  | 'mediumRectangle';

type Props = {
  placement: BuklodAdPlacement;
  compact?: boolean;
  format?: Format;
  showLabel?: boolean;
};

const ADSENSE_SCRIPT_ID =
  'buklod-google-adsense-script';

function clean(value: string | undefined) {
  return String(value ?? '').trim();
}

const ADSENSE_CLIENT = clean(
  process.env.EXPO_PUBLIC_ADSENSE_CLIENT_ID
);

const GENERIC_SLOT = clean(
  process.env.EXPO_PUBLIC_ADSENSE_SLOT_ID
);

function isValidClient(value: string) {
  return /^ca-pub-\d+$/.test(value);
}

function isValidSlot(value: string) {
  return /^\d+$/.test(value);
}

function slotForPlacement(
  placement: BuklodAdPlacement
) {
  const env = process.env;

  const placementSlot =
    placement === 'home'
      ? clean(env.EXPO_PUBLIC_ADSENSE_HOME_SLOT_ID)
      : placement === 'community'
        ? clean(env.EXPO_PUBLIC_ADSENSE_COMMUNITY_SLOT_ID)
        : placement === 'messages'
          ? clean(env.EXPO_PUBLIC_ADSENSE_MESSAGES_SLOT_ID)
          : placement === 'prayer'
            ? clean(env.EXPO_PUBLIC_ADSENSE_PRAYER_SLOT_ID)
            : placement === 'reels'
              ? clean(env.EXPO_PUBLIC_ADSENSE_REELS_SLOT_ID)
              : placement === 'bible'
                ? clean(env.EXPO_PUBLIC_ADSENSE_BIBLE_SLOT_ID)
                : placement === 'devotion'
                  ? clean(env.EXPO_PUBLIC_ADSENSE_DEVOTION_SLOT_ID)
                  : placement === 'me'
                    ? clean(env.EXPO_PUBLIC_ADSENSE_ME_SLOT_ID)
                    : placement === 'focus'
                      ? clean(env.EXPO_PUBLIC_ADSENSE_FOCUS_SLOT_ID)
                      : '';

  return placementSlot || GENERIC_SLOT;
}

function sponsorPlacementFor(
  placement: BuklodAdPlacement
): SponsorPlacement {
  if (placement === 'messages') {
    return 'messages';
  }

  if (
    placement === 'community' ||
    placement === 'reels'
  ) {
    return 'community';
  }

  if (placement === 'prayer') {
    return 'prayer';
  }

  if (
    placement === 'bible' ||
    placement === 'devotion' ||
    placement === 'focus'
  ) {
    return 'learn';
  }

  return 'home';
}

function ensureAdSenseScript(client: string) {
  if (
    typeof document === 'undefined' ||
    !isValidClient(client)
  ) {
    return;
  }

  if (document.getElementById(ADSENSE_SCRIPT_ID)) {
    return;
  }

  const script = document.createElement('script');
  script.id = ADSENSE_SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src =
    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;

  document.head.appendChild(script);
}

export default function BuklodWebAdSlot({
  placement,
  compact = false,
  format = 'adaptive',
  showLabel = true,
}: Props) {
  const slot = useMemo(
    () => slotForPlacement(placement),
    [placement]
  );

  const canServeGoogle =
    isValidClient(ADSENSE_CLIENT) &&
    isValidSlot(slot);

  useEffect(() => {
    if (!canServeGoogle || typeof window === 'undefined') {
      return;
    }

    ensureAdSenseScript(ADSENSE_CLIENT);

    const timer = window.setTimeout(() => {
      try {
        const target = window as any;
        target.adsbygoogle = target.adsbygoogle || [];
        target.adsbygoogle.push({});
      }
      catch (error) {
        console.warn('BUKLOD web ad request:', error);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canServeGoogle, slot]);

  if (!canServeGoogle) {
    return (
      <View
        style={[
          styles.sponsorFallback,
          compact && styles.compact,
        ]}
      >
        <BuklodSponsorSlot
          placement={sponsorPlacementFor(placement)}
        />
      </View>
    );
  }

  const minHeight =
    format === 'mediumRectangle'
      ? 250
      : compact
        ? 72
        : 90;

  const adFormat =
    format === 'mediumRectangle'
      ? 'rectangle'
      : 'auto';

  return (
    <View
      style={[
        styles.shell,
        compact && styles.compact,
        { minHeight },
      ]}
    >
      {showLabel ? (
        <Text style={styles.label}>
          Sponsored
        </Text>
      ) : null}

      <View style={styles.adArea}>
        {createElement('ins', {
          className: 'adsbygoogle',
          style: {
            display: 'block',
            width: '100%',
            minHeight,
          },
          'data-ad-client': ADSENSE_CLIENT,
          'data-ad-slot': slot,
          'data-ad-format': adFormat,
          'data-full-width-responsive': 'true',
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E1E7E3',
    overflow: 'hidden',
  },
  compact: {
    borderRadius: 14,
    marginVertical: 8,
  },
  label: {
    paddingHorizontal: 9,
    paddingTop: 6,
    color: '#77837C',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  adArea: {
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  sponsorFallback: {
    width: '100%',
  },
});
