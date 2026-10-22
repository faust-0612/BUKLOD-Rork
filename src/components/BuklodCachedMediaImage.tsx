import React, {
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Platform,
  StyleSheet,
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
  const lockedPath = useRef(path);
  const resignAttemptRef = useRef(0);
  const resignNotBeforeRef = useRef(0);
  const [displayUri, setDisplayUri] = useState<string | null>(() =>
    peekCommunityMediaUrl(path, preferredUri) ||
    preferredUri ||
    null,
  );

  useEffect(() => {
    if (path !== lockedPath.current) {
      lockedPath.current = path;
      setDisplayUri(
        peekCommunityMediaUrl(path, preferredUri) ||
          preferredUri ||
          null,
      );
      return;
    }

    if (preferredUri && preferredUri !== displayUri) {
      const next =
        peekCommunityMediaUrl(path, preferredUri) ||
        preferredUri;
      if (next && next !== displayUri) {
        setDisplayUri(next);
      }
    }
  }, [path, preferredUri, displayUri]);

  useEffect(() => {
    if (!path || displayUri) {
      return;
    }

    let active = true;
    void resolveCommunityMediaUrl(path, null).then(resolved => {
      if (!active || !resolved) {
        return;
      }

      setDisplayUri(current => current || resolved);
    });

    return () => {
      active = false;
    };
  }, [path, displayUri]);

  if (!displayUri && !path) {
    return <View style={[styles.placeholder, style]} />;
  }

  return (
    <ExpoImage
      source={
        displayUri
          ? {
              uri: displayUri,
              cacheKey,
            }
          : undefined
      }
      style={style}
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
      onLoad={onLoad}
      onError={() => {
        if (!path) {
          return;
        }

        void (async () => {
          const reader = (
            ExpoImage as {
              getCachePathAsync?: (key: string) => Promise<string | null>;
            }
          ).getCachePathAsync;
          if (cacheKey && reader) {
            const cached = await reader(cacheKey).catch(() => null);
            if (cached) return;
          }

          const now = Date.now();
          if (now < resignNotBeforeRef.current) return;
          resignNotBeforeRef.current =
            now +
            communityMediaResignDelayMs(resignAttemptRef.current);
          resignAttemptRef.current += 1;

          const next = await resignCommunityMediaUrl(path);
          if (next && next !== displayUri) {
            setDisplayUri(next);
          }
        })();
      }}
    />
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
  placeholder: {
    backgroundColor: '#EEF3F0',
  },
});
