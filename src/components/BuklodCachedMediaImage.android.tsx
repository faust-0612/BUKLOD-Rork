/**
 * Android-specific Community Wall photo renderer.
 *
 * Restores the direct image layout found in the pre-2026-10-28
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
import { decideAndroidPhotoRecovery } from '@/lib/buklodAndroidPhotoRecovery';
import { communityWallPreviewPath } from '@/lib/communityWallPreviewPath';

type Props = {
  uri?: string | null;
  mediaPath?: string | null;
  useWallPreview?: boolean;
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
  fromDiskCache: boolean;
};

// Check infrequently only while a photo is mounted and not yet painted.
const WATCHDOG_INTERVAL_MS = 3_000;

function initialSource(identity: string, path: string, preferred: string): SourceState {
  return {
    identity,
    url: peekCommunityMediaUrl(path, preferred) || (!path ? preferred || null : null),
    failed: false,
    renderer: 'expo',
    painted: false,
    fromDiskCache: false,
  };
}

function AndroidWallPhoto({ uri, mediaPath, useWallPreview = false, style, contentFit = 'cover', onLoad }: Props) {
  const originalPath = String(mediaPath ?? '').trim();
  const markedPreviewPath = useWallPreview ? communityWallPreviewPath(originalPath) : null;
  const [failedPreviewFor, setFailedPreviewFor] = useState('');
  const usingPreview = !!markedPreviewPath && failedPreviewFor !== originalPath;
  const path = usingPreview ? markedPreviewPath! : originalPath;
  // Never pass the original signed URL as a preference for the preview: it
  // refers to the wrong bytes and would poison the stable preview cache key.
  const preferred = usingPreview ? '' : String(uri ?? '').trim();
  const identity = path || `url:${preferred}`;
  const cacheKey = communityMediaCacheKey(path, path ? path : preferred);
  const signRetryRef = useRef(0);
  const resignInFlightRef = useRef(false);
  const progressRef = useRef({ uri: '', startedAt: Date.now(), lastProgressAt: 0, bytes: 0, decodedAt: 0 });
  const [source, setSource] = useState<SourceState>(() => initialSource(identity, path, preferred));
  const actual = source.identity === identity ? source : initialSource(identity, path, preferred);

  useEffect(() => {
    let active = true;
    signRetryRef.current = 0;
    resignInFlightRef.current = false;
    const first = initialSource(identity, path, preferred);
    setSource(first);

    void (async () => {
      // An already-downloaded disk photo is safe to show immediately for a
      // media path obtained from the authorized Wall feed. Avoid re-signing
      // or downloading the same bytes after reopening or scrolling.
      if (path && cacheKey) {
        try {
          // A stalled cache lookup must never delay first-time URL signing.
          let cacheTimer: ReturnType<typeof setTimeout> | null = null;
          const cached = await Promise.race([
            ExpoImage.getCachePathAsync(cacheKey).catch(() => null),
            new Promise<null>(resolve => {
              cacheTimer = setTimeout(() => resolve(null), 800);
            }),
          ]).finally(() => {
            if (cacheTimer) clearTimeout(cacheTimer);
          });
          if (!active) return;
          if (cached) {
            const fileUri = /^(file|content):\/\//i.test(cached)
              ? cached
              : `file://${cached}`;
            setSource(current => current.identity === identity && !current.painted
              ? { ...current, url: fileUri, renderer: 'native', fromDiskCache: true }
              : current);
            return;
          }
        } catch {
          // Disk cache is an optimization, not a requirement to load photos.
        }
      }

      if (!active || first.url || !path) return;
      let resolved = await resolveCommunityMediaUrl(path, null).catch(() => null);
      if (!active) return;
      if (!resolved) {
        // One bounded re-check on transient signing errors.
        await new Promise<void>(resolve => setTimeout(resolve, 5_500));
        if (!active) return;
        resolved = await resolveCommunityMediaUrl(path, null).catch(() => null);
      }
      if (!active) return;
      setSource(current => current.identity === identity && !current.url
        ? { ...current, url: resolved, failed: !resolved }
        : current);
    })();

    if (!first.url && !path) {
      setSource(current => current.identity === identity ? { ...current, failed: true } : current);
    }

    return () => { active = false; };
  }, [identity, cacheKey, path]);

  useEffect(() => {
    if (actual.failed || actual.painted || !actual.url) return;

    const url = actual.url;
    const now = Date.now();
    if (progressRef.current.uri !== url) {
      progressRef.current = {
        uri: url,
        startedAt: now,
        lastProgressAt: 0,
        bytes: 0,
        decodedAt: 0,
      };
    }

    // One lightweight watchdog per mounted, unfinished photo. Unlike the
    // previous unconditional 8-second switch, an active slow download is
    // allowed to finish rather than starting another network request.
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      if (!active) return;
      const p = progressRef.current;
      if (p.uri !== url) return;
      const at = Date.now();
      const decision = decideAndroidPhotoRecovery({
        now: at,
        startedAt: p.startedAt,
        lastProgressAt: p.lastProgressAt,
        decodedAt: p.decodedAt,
        renderer: actual.renderer,
        fromDiskCache: actual.fromDiskCache,
      });
      if (decision === 'fail') {
        setSource(current => current.identity === identity && current.url === url && !current.painted
          ? { ...current, failed: true }
          : current);
        return;
      }
      if (decision === 'fallback') {
        setSource(current => current.identity === identity && current.url === url &&
          current.renderer === 'expo' && !current.painted
          ? { ...current, renderer: 'native' }
          : current);
        return;
      }
      timer = setTimeout(check, WATCHDOG_INTERVAL_MS);
    };
    timer = setTimeout(check, WATCHDOG_INTERVAL_MS);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [identity, actual.url, actual.renderer, actual.failed, actual.painted, actual.fromDiskCache]);

  const retryAfterError = (failedUrl: string) => {
    if (resignInFlightRef.current || actual.identity !== identity || actual.url !== failedUrl) return;
    if (usingPreview) {
      // An unavailable/corrupt sidecar must never hide a valid original post.
      setFailedPreviewFor(originalPath);
      return;
    }

    if (actual.fromDiskCache) {
      // Cached bytes may have been evicted. Recover via the protected signer
      // once, rather than trapping the viewer in a corrupt local file.
      const first = initialSource(identity, path, preferred);
      // Fall back to the independent network loader if local bytes are bad.
      setSource({ ...first, failed: false, renderer: 'native' });
      if (!first.url && path) {
        resignInFlightRef.current = true;
        void resolveCommunityMediaUrl(path, null)
          .then(next => setSource(current => current.identity === identity && !current.url
            ? { ...current, url: next, failed: !next, renderer: 'native' }
            : current))
          .catch(() => setSource(current => current.identity === identity
            ? { ...current, failed: true }
            : current))
          .finally(() => { resignInFlightRef.current = false; });
      }
      return;
    }
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
            ? { ...current, url: next, failed: false, painted: false, renderer: 'expo', fromDiskCache: false }
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

  useEffect(() => {
    if (usingPreview && actual.identity === identity && actual.failed) {
      setFailedPreviewFor(originalPath);
    }
  }, [usingPreview, actual.identity, identity, actual.failed, originalPath]);

  // A sidecar is a fast hint, not a requirement to see the original. In the
  // exceptional case of a hung preview view, bypass it after a bounded window.
  useEffect(() => {
    if (!usingPreview || actual.painted || actual.failed || actual.identity !== identity) return;
    const timer = setTimeout(() => {
      setFailedPreviewFor(current => current === originalPath ? current : originalPath);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [usingPreview, originalPath, actual.painted, actual.failed, actual.identity, identity]);

  const retryManually = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!path || resignInFlightRef.current) return;
    signRetryRef.current = 0;
    resignInFlightRef.current = true;
    setSource({ identity, url: null, failed: false, renderer: 'expo', painted: false, fromDiskCache: false });
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
      // Android recycled image views were implicated in the Oct 28 regression.
      // The parent collage already keys each tile by its durable media path.
      transition={0}
      onProgress={event => {
        const loaded = Number(event.loaded ?? 0);
        const p = progressRef.current;
        if (p.uri === actual.url && loaded > p.bytes) {
          p.bytes = loaded;
          p.lastProgressAt = Date.now();
        }
      }}
      onLoad={event => {
        if (progressRef.current.uri === actual.url) {
          progressRef.current.decodedAt = Date.now();
        }
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
  prev.contentFit === next.contentFit &&
  prev.useWallPreview === next.useWallPreview
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
