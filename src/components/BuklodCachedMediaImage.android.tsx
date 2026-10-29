/**
 * Android-specific Community Wall photo renderer.
 *
 * Restores the verified direct image layout used before the 2026-10-28
 * wrapper regression. Image URLs still come exclusively through the secure
 * community-media signer; this module never constructs public storage URLs.
 *
 * If the installed expo-image native view does not report completion, switch
 * once to React Native's independent Android image pipeline. Neither path
 * masks the photo with an opaque overlay.
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image as NativeImage,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import {
  communityMediaCacheKey,
  peekCommunityMediaUrl,
  resolveCommunityMediaUrl,
  resignCommunityMediaUrl,
} from '@/lib/buklodMediaUrl';

type Props = {
  uri?: string | null;
  mediaPath?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  onLoad?: (event: any) => void;
};

type SourceState = {
  identity: string;
  url: string | null;
  failed: boolean;
  renderer: 'expo' | 'native';
  painted: boolean;
};

const NATIVE_FALLBACK_MS = 8_000;

function initialSource(identity: string, path: string, preferred: string): SourceState {
  return {
    identity,
    url: peekCommunityMediaUrl(path, preferred) || (!path ? preferred || null : null),
    failed: false,
    renderer: 'expo',
    painted: false,
  };
}

function AndroidWallPhoto({ uri, mediaPath, style, contentFit = 'cover', onLoad }: Props) {
  const path = String(mediaPath ?? '').trim();
  const preferred = String(uri ?? '').trim();
  const identity = path || `url:${preferred}`;
  const cacheKey = communityMediaCacheKey(path, path ? path : preferred);
  const signRetryRef = useRef(0);
  const resignInFlightRef = useRef(false);
  const [source, setSource] = useState<SourceState>(() => initialSource(identity, path, preferred));
  const actual = source.identity === identity ? source : initialSource(identity, path, preferred);

  useEffect(() => {
    let active = true;
    signRetryRef.current = 0;
    resignInFlightRef.current = false;
    const first = initialSource(identity, path, preferred);
    setSource(first);

    if (!first.url && path) {
      void (async () => {
        let resolved = await resolveCommunityMediaUrl(path, null).catch(() => null);
        if (!active) return;
        if (!resolved) {
          // A transient negative sign result has a five-second cooldown.
          await new Promise<void>(resolve => setTimeout(resolve, 5_500));
          if (!active) return;
          resolved = await resolveCommunityMediaUrl(path, null).catch(() => null);
        }
        if (!active) return;
        setSource(current => current.identity === identity
          ? { ...current, url: resolved, failed: !resolved }
          : current);
      })();
    } else if (!first.url) {
      setSource(current => current.identity === identity ? { ...current, failed: true } : current);
    }

    return () => { active = false; };
  }, [identity]);

  useEffect(() => {
    if (actual.failed || actual.painted || !actual.url || actual.renderer !== 'expo') return;
    // A successful HTTP download can still leave older Android native views
    // waiting indefinitely. Switch to Fresco without re-signing the URL.
    const timer = setTimeout(() => {
      setSource(current => current.identity === identity && current.renderer === 'expo' && !current.painted
        ? { ...current, renderer: 'native' }
        : current);
    }, NATIVE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [identity, actual.url, actual.renderer, actual.painted, actual.failed]);

  const retryAfterError = (failedUrl: string) => {
    if (resignInFlightRef.current || actual.identity !== identity || actual.url !== failedUrl) return;
    if (!path || signRetryRef.current >= 1) {
      setSource(current => current.identity === identity ? { ...current, failed: true } : current);
      return;
    }

    signRetryRef.current += 1;
    resignInFlightRef.current = true;
    void resignCommunityMediaUrl(path)
      .then(next => {
        setSource(current => {
          if (current.identity !== identity || current.url !== failedUrl) return current;
          return next && next !== failedUrl
            ? { ...current, url: next, failed: false, painted: false }
            : { ...current, failed: true };
        });
      })
      .catch(() => {
        setSource(current => current.identity === identity && current.url === failedUrl
          ? { ...current, failed: true }
          : current);
      })
      .finally(() => { resignInFlightRef.current = false; });
  };

  const retryManually = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!path || resignInFlightRef.current) return;
    signRetryRef.current = 0;
    resignInFlightRef.current = true;
    setSource({ identity, url: null, failed: false, renderer: 'expo', painted: false });
    void resignCommunityMediaUrl(path)
      .then(next => setSource(current => current.identity === identity
        ? { ...current, url: next, failed: !next }
        : current))
      .catch(() => setSource(current => current.identity === identity
        ? { ...current, failed: true }
        : current))
      .finally(() => { resignInFlightRef.current = false; });
  };

  if (!actual.url || actual.failed) {
    return (
      <Pressable
        style={[styles.placeholder, style as any]}
        disabled={!actual.failed || !path}
        onPress={retryManually}
        accessibilityRole={actual.failed && path ? 'button' : undefined}
        accessibilityLabel={actual.failed ? 'Retry photo' : 'Loading photo'}
      >
        {actual.failed ? (
          <>
            <Text style={styles.label}>Hindi ma-load ang larawan</Text>
            {path ? <Text style={styles.retry}>I-tap para subukan muli</Text> : null}
          </>
        ) : (
          <ActivityIndicator color="#688A81" size="small" />
        )}
      </Pressable>
    );
  }

  if (actual.renderer === 'native') {
    return (
      <NativeImage
        source={{ uri: actual.url }}
        resizeMode={contentFit}
        style={style}
        onLoad={event => {
          setSource(current => current.identity === identity && !current.painted ? { ...current, painted: true } : current);
          // Keep single-photo aspect-ratio calculation identical for callers.
          onLoad?.({ source: event.nativeEvent.source });
        }}
        onError={() => retryAfterError(actual.url!)}
      />
    );
  }

  return (
    <ExpoImage
      source={{ uri: actual.url, cacheKey }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      priority="high"
      recyclingKey={cacheKey}
      transition={0}
      onLoad={event => {
        // Decode alone is not a paint: wait for onDisplay before suppressing
        // the independent RN Image fallback on affected Android builds.
        onLoad?.(event);
      }}
      onDisplay={() => {
        setSource(current => current.identity === identity && !current.painted ? { ...current, painted: true } : current);
      }}
      onError={() => retryAfterError(actual.url!)}
    />
  );
}

export const BuklodCachedMediaImage = memo(AndroidWallPhoto, (prev, next) =>
  String(prev.mediaPath ?? '') === String(next.mediaPath ?? '') &&
  String(prev.uri ?? '') === String(next.uri ?? '') &&
  prev.contentFit === next.contentFit
);

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#EEF3F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  label: { color: '#566D65', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  retry: { color: '#24735D', fontSize: 11, marginTop: 4, textAlign: 'center' },
});
