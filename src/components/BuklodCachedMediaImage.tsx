import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image as NativeImage,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ImageStyle,
} from 'react-native';

import { Image as ExpoImage } from 'expo-image';

import { communityMediaResignDelayMs } from '@/lib/buklodNetworkQuality';
import {
  communityMediaCacheKey,
  peekCommunityMediaUrl,
  resignCommunityMediaUrl,
  resolveCommunityMediaUrl,
} from '@/lib/buklodMediaUrl';

// Only recover a genuinely stalled native request; active byte progress extends the window.
const PHOTO_STALL_NO_PROGRESS_MS = 40_000;
const PHOTO_LOAD_TIMEOUT_MS = 20_000;
// A second Android rendering engine recovers files delivered successfully
// by Storage but stuck inside the expo-image / Glide view lifecycle.
const ANDROID_IMAGE_FALLBACK_MS = 8_000;

type Props = {
  uri?: string | null;
  mediaPath?: string | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  onLoad?: (event: any) => void;
};

function BuklodCachedMediaImageInner({
  uri,
  mediaPath,
  style,
  contentFit = 'cover',
  onLoad,
}: Props) {
  /* BUKLOD_COMMUNITY_MEDIA_FRESH_URI_R2 */
  const path = String(mediaPath ?? '').trim();
  const preferredUri = String(uri ?? '').trim();
  const cacheKey = communityMediaCacheKey(path, path ? path : preferredUri);
  // Refresh no-path images when a recycled Wall tile receives a new URL.
  const mediaIdentity = path || `url:${preferredUri}`;
  const lockedMediaIdentityRef = useRef(mediaIdentity);
  const imageViewRef = useRef<ExpoImage | null>(null);
  const lastImageProgressAtRef = useRef(Date.now());
  const lastLoadedBytesRef = useRef(0);
  const stalledReloadAttemptRef = useRef(0);
  const resignAttemptRef = useRef(0);
  const resignNotBeforeRef = useRef(0);
  const resignInFlightRef = useRef(false);
  const manualRetryInFlightRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [useNativeFallback, setUseNativeFallback] = useState(false);
  const [slow, setSlow] = useState(false);
  const [cachedImage, setCachedImage] = useState<any>(null);
  const [displayUri, setDisplayUri] = useState<string | null>(() =>
    // A feed-supplied signed URL may already be expired. Only the signing
    // cache knows when a durable Storage-path URL was actually minted.
    peekCommunityMediaUrl(path, preferredUri) ||
    (!path ? preferredUri || null : null),
  );

  useEffect(() => {
    if (mediaIdentity !== lockedMediaIdentityRef.current) {
      lockedMediaIdentityRef.current = mediaIdentity;
      resignAttemptRef.current = 0;
      stalledReloadAttemptRef.current = 0;
      lastImageProgressAtRef.current = Date.now();
      lastLoadedBytesRef.current = 0;
      resignNotBeforeRef.current = 0;
      resignInFlightRef.current = false;
      manualRetryInFlightRef.current = false;
      setFailed(false);
      setLoaded(false);
      setSlow(false);
      setUseNativeFallback(false);
      setCachedImage(null);
      setDisplayUri(
        peekCommunityMediaUrl(path, preferredUri) ||
          (!path ? preferredUri || null : null),
      );
      return;
    }

    // Keep an already painted image when a refresh rotates the signing
    // credential for the *same* durable storage path. A missing credential
    // is resolved through the bounded signing queue below.
    if (preferredUri && !displayUri && !failed) {
      const next =
        peekCommunityMediaUrl(path, preferredUri) ||
        (!path ? preferredUri : null);
      if (next) setDisplayUri(next);
    }
  }, [mediaIdentity, path, preferredUri, displayUri, failed]);

  useEffect(() => {
    if (!path || displayUri || (cachedImage && !useNativeFallback) || failed || manualRetryInFlightRef.current || resignInFlightRef.current) return;

    let active = true;
    void (async () => {
      // Previously viewed private photos must be visible offline and on a
      // very weak connection without waiting for a new Storage signature.
      // Cache keys are durable object paths, never expiring signed tokens.
      if (Platform.OS !== 'web' && cacheKey && !useNativeFallback) {
        try {
          const reader = (ExpoImage as any).readFromCacheAsync as
            | ((key: string) => Promise<unknown>)
            | undefined;
          const local = await reader?.(cacheKey);
          if (!active) return;
          if (local) {
            setCachedImage(local);
            // A cache hit does not establish successful native paint. Do not
            // permanently suppress the alternate renderer without onLoad.
            setLoaded(false);
            return;
          }
        } catch {
          // An unavailable or evicted cache is not a missing photo.
        }
      }

      let resolved = await resolveCommunityMediaUrl(path, null).catch(() => null);
      if (!active) return;
      if (!resolved) {
        // One bounded automatic retry for a transient signing timeout. A
        // permanently missing/forbidden file remains negative-cached.
        await new Promise(resolve => setTimeout(resolve, 5_500));
        if (!active) return;
        resolved = await resolveCommunityMediaUrl(path, null).catch(() => null);
      }
      if (!active) return;
      if (resolved) {
        setLoaded(false);
        setDisplayUri(current => current || resolved);
      } else if (!cachedImage) {
        // Offline: preserve an available cache ImageRef even when re-signing
        // fails; do not replace its pixels with a failed placeholder.
        setFailed(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [path, displayUri, cachedImage, failed, cacheKey, useNativeFallback]);

  useEffect(() => {
    // Web behavior stays unchanged. Only Android removes the opaque mask.
    if (Platform.OS !== 'web' || (!displayUri && !cachedImage) || loaded || failed) return;
    const timer = setTimeout(() => setSlow(true), PHOTO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [displayUri, cachedImage, loaded, failed]);

  useEffect(() => {
    // Only mounted, unresolved Android tiles switch to Fresco. This requires
    // no new APK/native module and uses the same authorized URL. Web and iOS
    // remain unchanged; offline cached tiles are never discarded.
    if (Platform.OS !== 'android' || (!displayUri && !cachedImage) ||
        loaded || failed || useNativeFallback) return;
    const timer = setTimeout(() => setUseNativeFallback(true), ANDROID_IMAGE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [displayUri, cachedImage, loaded, failed, useNativeFallback]);

  useEffect(() => {
    // Android Glide can stall without firing onError/onLoad. A timed recovery
    // must be based on absent byte progress, not total transfer duration.
    if (Platform.OS !== 'android' || (!displayUri && !cachedImage) || loaded || failed || useNativeFallback) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const checkStall = () => {
      if (!active) return;
      const quietMs = Date.now() - lastImageProgressAtRef.current;
      if (quietMs < PHOTO_STALL_NO_PROGRESS_MS) {
        timer = setTimeout(checkStall, Math.max(1_000, PHOTO_STALL_NO_PROGRESS_MS - quietMs));
        return;
      }
      if (stalledReloadAttemptRef.current >= 1) {
        setFailed(true); // Actionable retry; never spin indefinitely on a dead request.
        return;
      }
      stalledReloadAttemptRef.current += 1;
      lastImageProgressAtRef.current = Date.now();
      const view = imageViewRef.current;
      if (!view || typeof view.reloadAsync !== 'function') {
        setFailed(true);
        return;
      }
      void view.reloadAsync().catch(() => {
        if (active && !resignInFlightRef.current) setFailed(true);
      });
      timer = setTimeout(checkStall, PHOTO_STALL_NO_PROGRESS_MS);
    };
    timer = setTimeout(checkStall, PHOTO_STALL_NO_PROGRESS_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [displayUri, cachedImage, loaded, failed, useNativeFallback]);

  useEffect(() => {
    lastImageProgressAtRef.current = Date.now();
    stalledReloadAttemptRef.current = 0;
    lastLoadedBytesRef.current = 0;
  }, [displayUri, cachedImage, mediaIdentity]);

  // Preserve source identity across slow-status renders and parent feed refreshes.
  const imageSource = useMemo(
    () => cachedImage || (displayUri ? { uri: displayUri, cacheKey } : undefined),
    [cachedImage, displayUri, cacheKey],
  );

  if ((!displayUri && !cachedImage) || failed) {
    return (
      <Pressable
        accessibilityRole={failed && path ? 'button' : undefined}
        accessibilityLabel={failed ? 'Retry photo' : 'Loading photo'}
        disabled={!failed || !path}
        onPress={event => {
          // A failed tile sits inside the collage's own Pressable. Retry must
          // not also open a blank fullscreen viewer on the same tap.
          event.stopPropagation();
          if (!path) return;
          resignAttemptRef.current = 0;
          stalledReloadAttemptRef.current = 0;
          lastImageProgressAtRef.current = Date.now();
          lastLoadedBytesRef.current = 0;
          resignNotBeforeRef.current = 0;
          manualRetryInFlightRef.current = true;
          setFailed(false);
          setLoaded(false);
          setSlow(false);
          setUseNativeFallback(false);
          setCachedImage(null);
          setDisplayUri(null);
          void resignCommunityMediaUrl(path)
            .then(next => {
              if (lockedMediaIdentityRef.current !== mediaIdentity) return;
              if (next) setDisplayUri(next);
              else setFailed(true);
            })
            .catch(() => {
              if (lockedMediaIdentityRef.current === mediaIdentity) {
                setFailed(true);
              }
            })
            .finally(() => {
              if (lockedMediaIdentityRef.current === mediaIdentity) {
                manualRetryInFlightRef.current = false;
              }
            });
        }}
        style={[styles.placeholder, style as any]}
      >
        {failed ? (
          <>
            <Text style={styles.placeholderText}>Hindi ma-load ang larawan</Text>
            {path ? <Text style={styles.retryText}>I-tap para subukan muli</Text> : null}
          </>
        ) : (
          <ActivityIndicator color="#688A81" size="small" />
        )}
      </Pressable>
    );
  }

  return (
    <View style={[styles.imageFrame, style as any]}>
      {Platform.OS === 'android' && useNativeFallback && displayUri ? (
        <NativeImage
          key={`native-${mediaIdentity}-${displayUri}`}
          source={{ uri: displayUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={contentFit}
          onLoad={event => {
            setLoaded(true);
            setFailed(false);
            onLoad?.(event.nativeEvent);
          }}
          onError={() => {
            // Never spin or issue an unbounded signing loop; manual Retry
            // can create a fresh authorized URL if the credential expired.
            setFailed(true);
          }}
        />
      ) : (
      <ExpoImage
      key={Platform.OS === 'android' ? mediaIdentity : undefined}
      ref={imageViewRef}
      source={imageSource}
      style={StyleSheet.absoluteFillObject}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      priority="high"
      /* BUKLOD_WEB_MEDIA_NO_RECYCLE_BLANK_R3
       * On web, recyclingKey intentionally clears the underlying image while
       * FlashList reuses a row. Keep the browser cache key but do not clear the
       * painted image during fast scrolling/back-scroll.
       */
      // SDK 57 Glide recycled-view cleanup can strand an Android tile blank.
      // Force a React key by path instead; keep iOS recycling isolation.
      recyclingKey={Platform.OS === 'web' || Platform.OS === 'android' ? undefined : cacheKey}
      transition={0}
      onLoadStart={() => {
        lastImageProgressAtRef.current = Date.now();
        lastLoadedBytesRef.current = 0;
        setSlow(false);
      }}
      onProgress={event => {
        const bytes = Number(event?.loaded ?? 0);
        if (Number.isFinite(bytes) && bytes > lastLoadedBytesRef.current) {
          lastLoadedBytesRef.current = bytes;
          lastImageProgressAtRef.current = Date.now();
        }
      }}
      onLoad={event => {
        resignAttemptRef.current = 0;
        stalledReloadAttemptRef.current = 0;
        setFailed(false);
        setSlow(false);
        // onLoad is the reliable successful-decode fallback if onDisplay is
        // delayed/skipped by a recycled native view or web image element.
        setLoaded(true);
        onLoad?.(event);
      }}
      onDisplay={() => {
        setLoaded(true);
        setSlow(false);
      }}
      onError={() => {
        // If the on-device ImageRef itself cannot render, fall back to the
        // authenticated network path rather than reusing a broken cache hit.
        setCachedImage(null);
        setLoaded(false);
        setSlow(false);
        if (resignInFlightRef.current) return;
        if (!path || resignAttemptRef.current >= 2) {
          setFailed(true);
          return;
        }

        const now = Date.now();
        if (now < resignNotBeforeRef.current) {
          setFailed(true);
          return;
        }

        resignInFlightRef.current = true;
        void (async () => {
          resignNotBeforeRef.current =
            now +
            communityMediaResignDelayMs(resignAttemptRef.current);
          resignAttemptRef.current += 1;

          try {
            const next = await resignCommunityMediaUrl(path);
            if (lockedMediaIdentityRef.current !== mediaIdentity) return;
            if (next && next !== displayUri) {
              setLoaded(false);
              setDisplayUri(next);
            } else {
              // Missing/revoked files must not trigger repeated sign requests.
              setFailed(true);
            }
          } catch {
            if (lockedMediaIdentityRef.current === mediaIdentity) {
              setFailed(true);
            }
          } finally {
            if (lockedMediaIdentityRef.current === mediaIdentity) {
              resignInFlightRef.current = false;
            }
          }
        })();
      }}
    />
      )}
      {!loaded ? (
        Platform.OS === 'android' ? (
          // Never cover Android image pixels with a full-area loading mask.
          <View pointerEvents="none" style={styles.loadingBadge}>
            <ActivityIndicator color="#688A81" size="small" />
          </View>
        ) : (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <ActivityIndicator color="#688A81" size="small" />
            {slow ? (
              <Text style={styles.slowText}>Mahina ang signal. Patuloy na nilo-load ang larawan.</Text>
            ) : null}
          </View>
        )
      ) : null}
    </View>
  );
}

export const BuklodCachedMediaImage = memo(
  BuklodCachedMediaImageInner,
  (prev, next) => {
    const prevPath = String(prev.mediaPath ?? '');
    const nextPath = String(next.mediaPath ?? '');
    if (prevPath || nextPath) {
      return (
        prevPath === nextPath &&
        String(prev.uri ?? '') === String(next.uri ?? '') &&
        prev.contentFit === next.contentFit
      );
    }

    return (
      String(prev.uri ?? '') === String(next.uri ?? '') &&
      prev.contentFit === next.contentFit
    );
  },
);

const styles = StyleSheet.create({
  imageFrame: {
    backgroundColor: '#EEF3F0',
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EEF3F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slowText: {
    color: '#566D65',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  loadingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(238, 243, 240, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    backgroundColor: '#EEF3F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  placeholderText: {
    color: '#566D65',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryText: {
    color: '#24735D',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
});

