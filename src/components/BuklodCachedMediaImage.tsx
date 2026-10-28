import React, {
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
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

const PHOTO_LOAD_TIMEOUT_MS = 20_000;

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
  const resignAttemptRef = useRef(0);
  const resignNotBeforeRef = useRef(0);
  const resignInFlightRef = useRef(false);
  const manualRetryInFlightRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
      resignNotBeforeRef.current = 0;
      resignInFlightRef.current = false;
      manualRetryInFlightRef.current = false;
      setFailed(false);
      setLoaded(false);
      setSlow(false);
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
    if (!path || displayUri || cachedImage || failed || manualRetryInFlightRef.current) return;

    let active = true;
    void (async () => {
      // Previously viewed private photos must be visible offline and on a
      // very weak connection without waiting for a new Storage signature.
      // Cache keys are durable object paths, never expiring signed tokens.
      if (Platform.OS !== 'web' && cacheKey) {
        try {
          const reader = (ExpoImage as any).readFromCacheAsync as
            | ((key: string) => Promise<unknown>)
            | undefined;
          const local = await reader?.(cacheKey);
          if (!active) return;
          if (local) {
            setCachedImage(local);
            setLoaded(true);
            setSlow(false);
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
      } else {
        setFailed(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [path, displayUri, cachedImage, failed, cacheKey]);

  useEffect(() => {
    if (!displayUri || loaded || failed) return;

    // Slow networks are not missing files. Keep ExpoImage mounted so a late
    // successful response can still paint; only an actual error marks failure.
    const timer = setTimeout(() => setSlow(true), PHOTO_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [displayUri, loaded, failed]);

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
          resignNotBeforeRef.current = 0;
          manualRetryInFlightRef.current = true;
          setFailed(false);
          setLoaded(false);
          setSlow(false);
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
      <ExpoImage
      source={
        cachedImage || (displayUri
          ? {
              uri: displayUri,
              cacheKey,
            }
          : undefined)
      }
      style={StyleSheet.absoluteFillObject}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      priority="high"
      /* BUKLOD_WEB_MEDIA_NO_RECYCLE_BLANK_R3
       * On web, recyclingKey intentionally clears the underlying image while
       * FlashList reuses a row. Keep the browser cache key but do not clear the
       * painted image during fast scrolling/back-scroll.
       */
      recyclingKey={Platform.OS === 'web' ? undefined : cacheKey}
      transition={0}
      onLoadStart={() => setSlow(false)}
      onLoad={event => {
        resignAttemptRef.current = 0;
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
      {!loaded ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color="#688A81" size="small" />
          {slow ? (
            <Text style={styles.slowText}>Mahina ang signal. Patuloy na nilo-load ang larawan.</Text>
          ) : null}
        </View>
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

