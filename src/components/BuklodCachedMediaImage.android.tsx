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
import { useNetwork } from '@/providers/NetworkProvider';

import {
  communityMediaCacheKey,
  peekCommunityMediaUrl,
  resolveCommunityMediaUrl,
  resignCommunityMediaUrl,
} from '@/lib/buklodMediaUrl';
import { decideAndroidPhotoRecovery } from '@/lib/buklodAndroidPhotoRecovery';
import { communityWallPreviewPath, verifiedLegacyWallPreviewPath } from '@/lib/communityWallPreviewPath';
import { communityWallSharpGate, configureCommunityWallOriginalQuality } from '@/lib/communityWallSharpUpgrade';
import { classifyNetworkQuality } from '@/lib/buklodNetworkQuality';
import { WALL_PREVIEW_LAYER_Z_INDEX, wallOriginalLayerZIndex, planWallOriginalSource, shouldKeepWallOriginalTransfer, shouldMountWallOriginalUpgrade, shouldRevealWallOriginal } from '@/lib/communityWallPhotoDisplayGate';

type Props = {
  uri?: string | null;
  mediaPath?: string | null;
  useWallPreview?: boolean;
  previewPath?: string | null;
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
  alternateAttempted: boolean;
};

// Check infrequently only while a photo is mounted and not yet painted.
const WATCHDOG_INTERVAL_MS = 3_000;

function initialSource(identity: string, path: string, preferred: string, preferNative = false): SourceState {
  return {
    identity,
    url: peekCommunityMediaUrl(path, preferred) || (!path ? preferred || null : null),
    failed: false,
    renderer: preferNative ? 'native' : 'expo',
    painted: false,
    fromDiskCache: false,
    alternateAttempted: false,
  };
}


/**
 * The 384px/quality-46 sidecar is a first-paint placeholder, never the final
 * Wall image. Only after it paints, resolve the private ORIGINAL and decode it
 * independently of sidecar success. Only after Expo reports a valid decode
 * and display do we reveal the original. Preserve thumbnail while loading.
 * At alpha=1 behind preview, the hidden Android native view can draw and
 * emit onDisplay; zero-alpha original can strand a blurred preview.
 */
function WallSharpOverlay({ mediaPath, contentFit }: { mediaPath: string; contentFit: 'cover' | 'contain' }) {
  const [sharp, setSharp] = useState({ identity: '', url: '', ready: false });
  const [retryEpoch, setRetryEpoch] = useState(0);
  const [retryPending, setRetryPending] = useState(false);
  // Expo's onDisplay verifies the original reached its image view. Native is
  // only a bounded fallback, never a second simultaneous download.
  const [upgradeRenderer, setUpgradeRenderer] = useState<'expo' | 'native'>('expo');
  const decodedOriginalRef = useRef({ url: '', width: 0, height: 0 });
  const displayedOriginalRef = useRef({ url: '', displayed: false });
  const activeUpgradeRendererRef = useRef(upgradeRenderer);
  activeUpgradeRendererRef.current = upgradeRenderer;
  const upgradeProgressRef = useRef({ url: '', bytes: 0, lastProgressAt: 0 });
  const activeSharpUrlRef = useRef('');
  const { isConnected, isInternetReachable, lastOnlineAt } = useNetwork();
  const releaseRef = useRef<(() => void) | null>(null);
  const badOriginalCacheRef = useRef(new Set<string>());
  const canRequest = isConnected && isInternetReachable !== false;
  // Connectivity hints may flap on cellular. Do not unmount an in-flight image.
  const canRequestRef = useRef(canRequest);
  canRequestRef.current = canRequest;

  useEffect(() => {
    // Dynamic 3G budget; do not resubscribe or restart a mounted transfer.
    configureCommunityWallOriginalQuality(classifyNetworkQuality() === 'degraded');
  }, [isConnected, isInternetReachable, lastOnlineAt]);

  useEffect(() => {
    // A successfully decoded original must survive NetInfo changes untouched.
    if (sharp.identity === mediaPath && sharp.ready) return;
    let active = true;
    setRetryPending(false);
    setUpgradeRenderer('expo');
    decodedOriginalRef.current = { url: '', width: 0, height: 0 };
    displayedOriginalRef.current = { url: '', displayed: false };
    upgradeProgressRef.current = { url: '', bytes: 0, lastProgressAt: 0 };
    activeSharpUrlRef.current = '';
    setSharp({ identity: mediaPath, url: '', ready: false });
    // Cached originals bypass the network gate: a photo already downloaded
    // in the full-screen viewer must become sharp without joining downloads.
    // Missing/corrupt sidecars are not a prerequisite for this independent
    // original path.
    let cancelQueued: (() => void) | null = null;
    void (async () => {
      const key = communityMediaCacheKey(mediaPath, mediaPath);
      let url: string | null = null;
      try {
        let cacheTimer: ReturnType<typeof setTimeout> | null = null;
        const cached = key && !badOriginalCacheRef.current.has(key) ? await Promise.race([
          ExpoImage.getCachePathAsync(key).catch(() => null),
          new Promise<null>(resolve => {
            cacheTimer = setTimeout(() => resolve(null), 1600);
          }),
        ]).finally(() => { if (cacheTimer) clearTimeout(cacheTimer); }) : null;
        if (!active) return;
        const sourcePlan = planWallOriginalSource(Boolean(cached), canRequestRef.current);
        if (sourcePlan === 'cached' && cached) {
          url = /^(file|content):\/\//i.test(cached) ? cached : 'file://' + cached;
          activeSharpUrlRef.current = url;
          setSharp({ identity: mediaPath, url, ready: false });
          return;
        }
        if (sourcePlan === 'defer') {
          setRetryPending(true);
          return;
        }
        // Only actual new network originals consume scarce download slots.
        const request = communityWallSharpGate.request();
        cancelQueued = request.cancel;
        const release = await request.granted;
        if (!release) {
          if (active) setRetryPending(true);
          return;
        }
        if (!active) { release(); return; }
        releaseRef.current = release;
        url = await resolveCommunityMediaUrl(mediaPath, null).catch(() => null);
        if (!active || !url) {
          if (releaseRef.current === release) releaseRef.current = null;
          release();
        }
        if (active && url) {
          activeSharpUrlRef.current = url;
          setSharp({ identity: mediaPath, url, ready: false });
        } else if (active) setRetryPending(true);
      } catch {
        if (active) setRetryPending(true);
        releaseRef.current?.();
        releaseRef.current = null;
      }
    })();

    return () => {
      active = false;
      activeSharpUrlRef.current = '';
      cancelQueued?.();
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, [mediaPath, retryEpoch]);

  // A visible/mounted preview must not be stranded after a failed sign,
  // expired URL or native decode. Use slow bounded retries; a reconnection
  // starts the next attempt immediately without adding periodic polling.
  useEffect(() => {
    if (!retryPending || !canRequest) return;
    const pause = Math.min(120_000, 12_000 * 2 ** Math.min(4, retryEpoch));
    const timer = setTimeout(() => setRetryEpoch(value => value + 1), pause);
    return () => clearTimeout(timer);
  }, [retryPending, retryEpoch, canRequest]);
  useEffect(() => {
    if (retryPending && canRequest && lastOnlineAt) {
      setRetryEpoch(value => value + 1);
    }
  }, [lastOnlineAt]);

  const current = sharp.identity === mediaPath ? sharp : { identity: mediaPath, url: '', ready: false };
  useEffect(() => {
    if (!current.url || current.ready) return;
    // A genuinely stuck decoder must not monopolize a scarce upgrade slot.
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      const progress = upgradeProgressRef.current;
      if (shouldKeepWallOriginalTransfer({
        expectedUrl: current.url,
        progressUrl: progress.url,
        lastProgressAt: progress.lastProgressAt,
        now: Date.now(),
        stallMs: upgradeRenderer === 'expo' ? 18_000 : 40_000,
      })) {
        // Never restart an actively downloading original, even beyond 90 s.
        timeout = setTimeout(check, 12_000);
        return;
      }
      if (upgradeRenderer === 'expo') {
        // The decoder genuinely stalled: one native attempt with the SAME URL.
        setUpgradeRenderer('native');
        return;
      }
      if (activeSharpUrlRef.current !== current.url) return;
      activeSharpUrlRef.current = '';
      releaseRef.current?.();
      releaseRef.current = null;
      setSharp(state => state.identity === mediaPath && state.url === current.url
        ? { ...state, url: '' }
        : state);
      setRetryPending(true);
    };
    timeout = setTimeout(check, upgradeRenderer === 'expo' ? 18_000 : 90_000);
    return () => { if (timeout) clearTimeout(timeout); };
  }, [mediaPath, current.url, current.ready, upgradeRenderer]);

  if (!current.url) return null;
  const finish = (ready: boolean) => {
    // A callback from an old signed URL must not free the current URL's slot.
    if (activeSharpUrlRef.current !== current.url) return;
    const invalidCachedOriginal = !ready && /^(file|content):\/\//i.test(current.url);
    if (invalidCachedOriginal) {
      const key = communityMediaCacheKey(mediaPath, mediaPath);
      if (key) badOriginalCacheRef.current.add(key);
    }
    releaseRef.current?.();
    releaseRef.current = null;
    if (!ready) activeSharpUrlRef.current = '';
    setSharp(state => state.identity === mediaPath && state.url === current.url
      ? { ...state, url: ready ? state.url : '', ready }
      : state);
    if (!ready) {
      setRetryPending(true);
      // A verified invalid disk image is different from a network failure.
      // Resolve the protected original immediately once instead of showing
      // a broken cache for the entire exponential retry window.
      if (invalidCachedOriginal && canRequestRef.current) {
        setRetryEpoch(epoch => epoch + 1);
      }
    }
  };

  // Use the same stable disk cache key as the fullscreen Expo image. Once
  // this original is downloaded successfully, remounts can reuse its bytes.
  const originalCacheKey = communityMediaCacheKey(mediaPath, mediaPath);
  return upgradeRenderer === 'expo' ? (
    <ExpoImage
      key={'sharp-expo:' + mediaPath + ':' + current.url}
      source={{ uri: current.url, cacheKey: originalCacheKey }}
      style={[StyleSheet.absoluteFillObject, { opacity: 1, zIndex: wallOriginalLayerZIndex(current.ready) }]}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      priority="low"
      transition={0}
      onProgress={event => {
        const loaded = Number(event.loaded ?? 0);
        const progress = upgradeProgressRef.current;
        if (progress.url !== current.url) {
          progress.url = current.url;
          progress.bytes = 0;
          progress.lastProgressAt = 0;
        }
        if (loaded > progress.bytes) {
          progress.bytes = loaded;
          progress.lastProgressAt = Date.now();
        }
      }}
      onLoad={event => {
        const dimensions = event.source;
        decodedOriginalRef.current = {
          url: current.url,
          width: Number(dimensions?.width ?? 0),
          height: Number(dimensions?.height ?? 0),
        };
        const decoded = decodedOriginalRef.current;
        if (activeUpgradeRendererRef.current === 'expo' &&
            displayedOriginalRef.current.url === current.url &&
            displayedOriginalRef.current.displayed &&
            shouldRevealWallOriginal({
              expectedUrl: current.url,
              decodedUrl: decoded.url,
              width: decoded.width,
              height: decoded.height,
              activeRenderer: activeUpgradeRendererRef.current,
              renderedBy: 'expo',
              displayed: true,
            })) finish(true);
      }}
      onDisplay={() => {
        if (activeUpgradeRendererRef.current !== 'expo') return;
        displayedOriginalRef.current = { url: current.url, displayed: true };
        const decoded = decodedOriginalRef.current;
        if (shouldRevealWallOriginal({
          expectedUrl: current.url,
          decodedUrl: decoded.url,
          width: decoded.width,
          height: decoded.height,
          activeRenderer: upgradeRenderer,
          renderedBy: 'expo',
          displayed: true,
        })) finish(true);
      }}
      onError={() => { if (activeUpgradeRendererRef.current === 'expo') setUpgradeRenderer('native'); }}
    />
  ) : (
    <NativeImage
      key={'sharp-native:' + mediaPath + ':' + current.url}
      source={{ uri: current.url }}
      style={[StyleSheet.absoluteFillObject, { opacity: 1, zIndex: wallOriginalLayerZIndex(current.ready) }]}
      resizeMode={contentFit}
      fadeDuration={0}
      onProgress={event => {
        const loaded = Number(event.nativeEvent?.loaded ?? 0);
        const progress = upgradeProgressRef.current;
        if (progress.url !== current.url) {
          progress.url = current.url;
          progress.bytes = 0;
          progress.lastProgressAt = 0;
        }
        if (loaded > progress.bytes) {
          progress.bytes = loaded;
          progress.lastProgressAt = Date.now();
        }
      }}
      onLoad={event => {
        if (activeUpgradeRendererRef.current !== 'native') return;
        const dimensions = event.nativeEvent.source;
        const hasDimensions = Number(dimensions?.width) > 0 && Number(dimensions?.height) > 0;
        finish(hasDimensions && shouldRevealWallOriginal({
          expectedUrl: current.url,
          decodedUrl: current.url,
          width: Number(dimensions?.width ?? 0),
          height: Number(dimensions?.height ?? 0),
          activeRenderer: upgradeRenderer,
          renderedBy: 'native',
          displayed: false,
        }));
      }}
      onError={() => { if (activeUpgradeRendererRef.current === 'native') finish(false); }}
    />
  );
}

function AndroidWallPhoto({ uri, mediaPath, useWallPreview = false, previewPath, style, contentFit = 'cover', onLoad }: Props) {
  const originalPath = String(mediaPath ?? '').trim();
  const markedPreviewPath = useWallPreview
    ? communityWallPreviewPath(originalPath) || verifiedLegacyWallPreviewPath(originalPath, previewPath)
    : null;
  // Never replace pixels already painted from an original with a late-arriving
  // thumbnail index. That would recreate the October 28 blank-tile regression.
  const paintedOriginalPathRef = useRef('');
  // Keep the preview identity stable even when the sidecar fails. Switching
  // identities mid-flight used to cancel and re-download the same original.
  const usingPreview = !!markedPreviewPath &&
    paintedOriginalPathRef.current !== originalPath;
  const path = usingPreview ? markedPreviewPath! : originalPath;
  // Never pass the original signed URL as a preference for the preview: it
  // refers to the wrong bytes and would poison the stable preview cache key.
  const preferred = usingPreview ? '' : String(uri ?? '').trim();
  const identity = path || `url:${preferred}`;
  const cacheKey = communityMediaCacheKey(path, path ? path : preferred);
  const signRetryRef = useRef(0);
  const resignInFlightRef = useRef(false);
  const progressRef = useRef({ uri: '', startedAt: Date.now(), lastProgressAt: 0, bytes: 0, decodedAt: 0 });
  const badCacheKeys = useRef(new Set<string>());
  const [retryEpoch, setRetryEpoch] = useState(0);
  const { isConnected, isInternetReachable, lastOnlineAt } = useNetwork();
  const canRequest = isConnected && isInternetReachable !== false;
  const canRequestRef = useRef(canRequest);
  canRequestRef.current = canRequest;
  const [source, setSource] = useState<SourceState>(() => initialSource(identity, path, preferred, usingPreview));
  const actual = source.identity === identity ? source : initialSource(identity, path, preferred, usingPreview);

  useEffect(() => {
    let active = true;
    signRetryRef.current = 0;
    resignInFlightRef.current = false;
    // Reconnection must not reset a previously painted tile.
    if (actual.identity === identity && actual.painted) return;
    const first = retryEpoch
      ? { ...initialSource(identity, path, preferred, usingPreview), url: null }
      : initialSource(identity, path, preferred, usingPreview);
    setSource(first);

    void (async () => {
      // An already-downloaded disk photo is safe to show immediately for a
      // media path obtained from the authorized Wall feed. Avoid re-signing
      // or downloading the same bytes after reopening or scrolling.
      if (path && cacheKey && !badCacheKeys.current.has(cacheKey)) {
        try {
          // Resolve the original locally before signing; Expo onDisplay is
          // required before treating previously cached pixels as painted.
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
              ? { ...current, url: fileUri, renderer: 'expo', fromDiskCache: true }
              : current);
            return;
          }
        } catch {
          // Disk cache is an optimization, not a requirement to load photos.
        }
      }

      if (!active || first.url || !path) return;
      if (!canRequestRef.current) {
        // An offline missing tile is a recoverable failure, never a permanent
        // blank spinner. Reconnect/backoff will retry without discarding cache.
        setSource(current => current.identity === identity && !current.painted && !current.url
          ? { ...current, failed: true } : current);
        return;
      }
      let resolved = await (retryEpoch
        ? resignCommunityMediaUrl(path)
        : resolveCommunityMediaUrl(path, null)).catch(() => null);
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
  }, [identity, cacheKey, path, usingPreview, retryEpoch]);

  // Per-mounted-photo autonomous recovery. This never loops a request while
  // offline, always exposes Retry, and tops out at one retry per 2 minutes.
  useEffect(() => {
    if (actual.identity !== identity || !actual.failed || actual.painted ||
        !path || !canRequest) return;
    const delay = Math.min(120_000, 12_000 * 2 ** Math.min(4, retryEpoch));
    const timer = setTimeout(() => setRetryEpoch(value => value + 1), delay);
    return () => clearTimeout(timer);
  }, [identity, path, actual.failed, actual.painted, canRequest, retryEpoch]);

  useEffect(() => {
    if (actual.failed && canRequest && lastOnlineAt) {
      setRetryEpoch(value => value + 1);
    }
  }, [lastOnlineAt]);

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
        if (actual.fromDiskCache) {
          // An unusable cached file must not trap a Wall tile.
          retryAfterError(url);
          return;
        }
        if (!actual.alternateAttempted) {
          setSource(current => current.identity === identity && current.url === url &&
            current.renderer === actual.renderer && !current.painted && !current.alternateAttempted
            ? { ...current, renderer: current.renderer === 'native' ? 'expo' : 'native', alternateAttempted: true }
            : current);
          return;
        }
        // Never switch repeatedly; wait for progress or the hard deadline.
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
    // A failed sidecar is only a failed preview: the independent sharp layer
    // continues downloading the original. Never replace its media identity.
    if (usingPreview) {
      setSource(current => current.identity === identity && current.url === failedUrl
        ? { ...current, failed: true } : current);
      return;
    }

    if (actual.fromDiskCache) {
      if (cacheKey) badCacheKeys.current.add(cacheKey);
      // Cached bytes may have been evicted. Recover via the protected signer
      // once, rather than trapping the viewer in a corrupt local file.
      const first = initialSource(identity, path, preferred, usingPreview);
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
            ? { ...current, url: next, failed: false, painted: false, renderer: usingPreview ? 'native' : 'expo', fromDiskCache: false, alternateAttempted: false }
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
    setSource({ identity, url: null, failed: false, renderer: usingPreview ? 'native' : 'expo', painted: false, fromDiskCache: false, alternateAttempted: false });
    void resignCommunityMediaUrl(path)
      .then(next => setSource(current => current.identity === identity
        ? { ...current, url: next, failed: !next }
        : current))
      .catch(() => setSource(current => current.identity === identity
        ? { ...current, failed: true }
        : current))
      .finally(() => { resignInFlightRef.current = false; });
  };

  // The measured collage Pressable remains the parent (no masking wrapper).
  // Start original resolution independently of preview decode/display. A
  // white or stalled thumbnail can never block its sharp replacement.
  // Keep a visible loading affordance while the decoder has not confirmed
  // on-screen paint. A raw image view is otherwise a large white rectangle.
  const pendingPaintIndicator = !actual.painted ? (
    <ActivityIndicator
      pointerEvents="none"
      size="small"
      color="#688A81"
      style={{ position: 'absolute', top: '50%', left: '50%', marginTop: -10, marginLeft: -10 }}
    />
  ) : null;

  const renderWithUpgrade = (preview: React.ReactNode) => (
    shouldMountWallOriginalUpgrade({
      originalPath,
      usingPreview,
    }) ? (
      <>
        {preview}
        <WallSharpOverlay mediaPath={originalPath} contentFit={contentFit} />
      </>
    ) : preview
  );

  if (!actual.url || actual.failed) {
    return renderWithUpgrade(
      <Pressable
        style={[styles.placeholder, style as any, usingPreview && { zIndex: WALL_PREVIEW_LAYER_Z_INDEX }]}
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
    return renderWithUpgrade(
      <>
      <NativeImage
        source={{ uri: actual.url }}
        resizeMode={contentFit}
        style={[{ backgroundColor: '#EEF3F0' }, style, usingPreview && { zIndex: WALL_PREVIEW_LAYER_Z_INDEX }]}
        onProgress={event => {
          const bytes = Number(event.nativeEvent?.loaded ?? 0);
          const p = progressRef.current;
          if (p.uri === actual.url && bytes > p.bytes) {
            p.bytes = bytes;
            p.lastProgressAt = Date.now();
          }
        }}
        onLoad={event => {
          const dimensions = event.nativeEvent.source;
          if (!(Number(dimensions?.width) > 0 && Number(dimensions?.height) > 0)) {
            retryAfterError(actual.url!);
            return;
          }
          if (!usingPreview) paintedOriginalPathRef.current = originalPath;
          setSource(current => current.identity === identity && current.url === actual.url &&
            current.renderer === 'native' && !current.painted
            ? { ...current, painted: true } : current);
          // Keep single-photo aspect-ratio calculation identical for callers.
          onLoad?.({ source: event.nativeEvent.source });
        }}
        onError={() => {
          // Native decode error does not prove missing private media.
          if (!actual.fromDiskCache && !actual.alternateAttempted) {
            setSource(current => current.identity === identity && current.url === actual.url &&
              current.renderer === 'native' && !current.painted && !current.alternateAttempted
              ? { ...current, renderer: 'expo', alternateAttempted: true } : current);
          } else retryAfterError(actual.url!);
        }}
      />
      {pendingPaintIndicator}
      </>
    );
  }

  return renderWithUpgrade(
    <>
    <ExpoImage
      source={{ uri: actual.url, cacheKey }}
      style={[{ backgroundColor: '#EEF3F0' }, style, usingPreview && { zIndex: WALL_PREVIEW_LAYER_Z_INDEX }]}
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
        if (!usingPreview) paintedOriginalPathRef.current = originalPath;
        setSource(current => current.identity === identity && current.url === actual.url &&
          current.renderer === 'expo' && !current.painted ? { ...current, painted: true } : current);
      }}
      onError={() => retryAfterError(actual.url!)}
    />
    {pendingPaintIndicator}
    </>
  );
}

export const BuklodCachedMediaImage = memo(AndroidWallPhoto, (prev, next) =>
  String(prev.mediaPath ?? '') === String(next.mediaPath ?? '') &&
  String(prev.uri ?? '') === String(next.uri ?? '') &&
  prev.contentFit === next.contentFit &&
  prev.useWallPreview === next.useWallPreview &&
  String(prev.previewPath ?? '') === String(next.previewPath ?? '')
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
