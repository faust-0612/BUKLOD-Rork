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
  const [failed, setFailed] = useState(false);
  const [displayUri, setDisplayUri] = useState<string | null>(() =>
    peekCommunityMediaUrl(path, preferredUri) ||
    preferredUri ||
    null,
  );

  useEffect(() => {
    if (path !== lockedPath.current) {
      lockedPath.current = path;
      resignAttemptRef.current = 0;
      resignNotBeforeRef.current = 0;
      setFailed(false);
      setDisplayUri(
        peekCommunityMediaUrl(path, preferredUri) ||
          preferredUri ||
          null,
      );
      return;
    }

    // Preserve the already painted image when a feed refresh rotates
    // its signed URL. A new URL for the same storage path should not
    // cause a redundant download or visible loading flash. The existing
    // onError recovery still re-signs if the old credential expires.
    if (preferredUri && !displayUri) {
      const next = peekCommunityMediaUrl(path, preferredUri) || preferredUri;
      if (next) setDisplayUri(next);
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

  if (!displayUri || failed) {
    return (
      <Pressable
        accessibilityRole={failed && path ? 'button' : undefined}
        accessibilityLabel={failed ? 'Retry photo' : 'Loading photo'}
        disabled={!failed || !path}
        onPress={() => {
          if (!path) return;
          resignAttemptRef.current = 0;
          resignNotBeforeRef.current = 0;
          setFailed(false);
          setDisplayUri(null);
          void resignCommunityMediaUrl(path).then(next => {
            if (next) setDisplayUri(next);
            else setFailed(true);
          }).catch(() => setFailed(true));
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
      onLoad={event => {
        resignAttemptRef.current = 0;
        setFailed(false);
        onLoad?.(event);
      }}
      onError={() => {
        if (!path || resignAttemptRef.current >= 2) {
          setFailed(true);
          return;
        }

        void (async () => {
          const now = Date.now();
          if (now < resignNotBeforeRef.current) {
            setFailed(true);
            return;
          }
          resignNotBeforeRef.current =
            now +
            communityMediaResignDelayMs(resignAttemptRef.current);
          resignAttemptRef.current += 1;

          try {
            const next = await resignCommunityMediaUrl(path);
            if (next && next !== displayUri) {
              setDisplayUri(next);
            } else {
              // Missing/revoked files must not trigger repeated sign requests.
              setFailed(true);
            }
          } catch {
            setFailed(true);
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
