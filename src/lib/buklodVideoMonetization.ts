import { Platform } from 'react-native';

const GOOGLE_SAMPLE_TAG =
  'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&correlator=';

function flag(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase() === 'true';
}

export function buklodImaVideoEnabled() {
  return (
    Platform.OS === 'android' &&
    flag(process.env.EXPO_PUBLIC_IMA_VIDEO_ENABLED)
  );
}

export function getBuklodBaseImaAdTagUrl() {
  const configured =
    String(process.env.EXPO_PUBLIC_IMA_AD_TAG_URL ?? '').trim();

  if (configured) {
    return configured;
  }

  if (
    process.env.EXPO_PUBLIC_APP_ENV !== 'production' &&
    flag(process.env.EXPO_PUBLIC_IMA_USE_GOOGLE_SAMPLE_TAG)
  ) {
    return GOOGLE_SAMPLE_TAG;
  }

  return '';
}

export function getBuklodVideoCuePointsSeconds(
  durationSeconds: number | null | undefined,
) {
  const duration = Math.max(
    0,
    Math.round(Number(durationSeconds ?? 0)),
  );

  if (duration < 120) {
    return [];
  }

  if (duration < 1200) {
    return [
      Math.max(60, Math.round(duration * 0.5)),
    ];
  }

  return [
    Math.max(90, Math.round(duration / 3)),
    Math.max(180, Math.round((duration * 2) / 3)),
  ];
}

/**
 * Adds duration + bounded cue signals to a Google Ad Manager/IMA tag.
 *
 * The ad server/ad rule remains authoritative. This does not synthesize or
 * fake ads. Google Ad Manager may ignore cue points when its time-based ad
 * rule is authoritative.
 */
export function buildBuklodImaAdTagUrl(
  durationSeconds: number | null | undefined,
) {
  const base = getBuklodBaseImaAdTagUrl();
  if (!base) return '';

  try {
    const url = new URL(base);
    const duration = Math.max(
      0,
      Math.round(Number(durationSeconds ?? 0)),
    );

    if (duration > 0) {
      url.searchParams.set(
        'vid_d',
        String(duration),
      );
    }

    if (!url.searchParams.has('ciu_szs')) {
      url.searchParams.set(
        'ciu_szs',
        '300x250',
      );
    }

    const cues =
      getBuklodVideoCuePointsSeconds(
        duration,
      );

    if (cues.length) {
      url.searchParams.set(
        'allcues',
        cues
          .map(seconds =>
            String(seconds * 1000)
          )
          .join(','),
      );
    } else {
      url.searchParams.delete('allcues');
    }

    return url.toString();
  } catch {
    return '';
  }
}

export function shouldUseBuklodImaForVideo(
  durationSeconds: number | null | undefined,
) {
  return Boolean(
    buklodImaVideoEnabled() &&
    buildBuklodImaAdTagUrl(
      durationSeconds,
    ),
  );
}
