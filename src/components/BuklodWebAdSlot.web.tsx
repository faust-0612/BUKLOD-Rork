import { usePathname } from 'expo-router';
import React, {
  createElement,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodSponsorSlot from '@/components/BuklodSponsorSlot';
import type { BuklodAdPlacement } from '@/lib/buklodAdUnits';
import {
  buklodAdsLiveIdsEnabled,
  diagnosticPlacementFor,
} from '@/lib/buklodAdUnits';
import {
  isBuklodPassiveAdAllowed,
  reserveBuklodPassiveAdRequest,
} from '@/lib/buklodGlobalAdController';
import { useBuklodAdViewportGate } from '@/lib/buklodAdViewport';
import { recordBuklodAdEvent } from '@/lib/buklodAdDiagnostics';

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
  placementId?: string;
  requestKey?: string;
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
  const placementSlot =
    placement === 'home'
      ? clean(process.env.EXPO_PUBLIC_ADSENSE_HOME_SLOT_ID)
      : placement === 'community_entry'
        ? clean(process.env.EXPO_PUBLIC_ADSENSE_COMMUNITY_ENTRY_SLOT_ID) ||
          clean(process.env.EXPO_PUBLIC_ADSENSE_COMMUNITY_SLOT_ID)
      : placement === 'community'
        ? clean(process.env.EXPO_PUBLIC_ADSENSE_COMMUNITY_SLOT_ID)
        : placement === 'messages'
          ? clean(process.env.EXPO_PUBLIC_ADSENSE_MESSAGES_SLOT_ID)
          : placement === 'prayer'
            ? clean(process.env.EXPO_PUBLIC_ADSENSE_PRAYER_SLOT_ID)
            : placement === 'reels'
              ? clean(process.env.EXPO_PUBLIC_ADSENSE_REELS_SLOT_ID)
              : placement === 'bible'
                ? clean(process.env.EXPO_PUBLIC_ADSENSE_BIBLE_SLOT_ID)
                : placement === 'devotion'
                  ? clean(process.env.EXPO_PUBLIC_ADSENSE_DEVOTION_SLOT_ID)
                  : placement === 'me'
                    ? clean(process.env.EXPO_PUBLIC_ADSENSE_ME_SLOT_ID)
                    : placement === 'focus' || placement === 'content'
                      ? clean(process.env.EXPO_PUBLIC_ADSENSE_FOCUS_SLOT_ID)
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
    placement === 'community_entry' ||
    placement === 'video_companion' ||
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
    placement === 'focus' ||
    placement === 'content' ||
    placement === 'submission'
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
  placementId,
  requestKey,
}: Props) {
  const pathname = usePathname();
  const { ref, eligible } = useBuklodAdViewportGate();
  const requestStarted = useRef(false);
  const rendered = useRef(false);
  const stablePlacementId = placementId ?? `${placement}_generic`;
  const routeSafe = isBuklodPassiveAdAllowed({
    placement,
    placementId: stablePlacementId,
    pathname,
  });
  const slot = useMemo(
    () => slotForPlacement(placement),
    [placement]
  );

  const canServeGoogle =
    buklodAdsLiveIdsEnabled &&
    isValidClient(ADSENSE_CLIENT) &&
    isValidSlot(slot);

  useEffect(() => {
    if (
      !routeSafe ||
      !eligible ||
      !canServeGoogle ||
      typeof window === 'undefined' ||
      requestStarted.current
    ) {
      return;
    }

    const accepted = reserveBuklodPassiveAdRequest(
      stablePlacementId,
      requestKey ?? `${pathname}:${stablePlacementId}`,
    );
    if (!accepted) return;

    requestStarted.current = true;
    recordBuklodAdEvent(
      diagnosticPlacementFor(placement),
      'ad_request',
      undefined,
      { route: pathname, provider: 'ADSENSE_WEB', placementId: stablePlacementId },
    );

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
  }, [
    canServeGoogle,
    eligible,
    pathname,
    placement,
    requestKey,
    routeSafe,
    slot,
    stablePlacementId,
  ]);

  useEffect(() => {
    if (!eligible || !canServeGoogle || rendered.current) return;
    rendered.current = true;
    recordBuklodAdEvent(
      diagnosticPlacementFor(placement),
      'ad_rendered',
      undefined,
      { route: pathname, provider: 'ADSENSE_WEB' },
    );
  }, [canServeGoogle, eligible, pathname, placement]);

  if (!routeSafe) {
    return null;
  }

  if (!eligible) {
    return (
      <View
        ref={ref}
        collapsable={false}
        pointerEvents="none"
        style={styles.viewportProbe}
      />
    );
  }

  if (!canServeGoogle) {
    return (
      <View
        ref={ref}
        collapsable={false}
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
      ref={ref}
      collapsable={false}
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
  viewportProbe: {
    width: '100%',
    minHeight: 16,
    opacity: 0,
  },
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
