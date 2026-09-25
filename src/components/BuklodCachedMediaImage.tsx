import React, {
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  StyleSheet,
  View,
  type StyleProp,
  type ImageStyle,
} from 'react-native';

import { Image as ExpoImage } from 'expo-image';

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
  const path = String(mediaPath ?? '').trim();
  const cacheKey = communityMediaCacheKey(path, path ? path : uri);
  const lockedPath = useRef(path);
  const [displayUri, setDisplayUri] = useState<string | null>(() =>
    peekCommunityMediaUrl(path, null) ||
    String(uri ?? '').trim() ||
    null,
  );

  useEffect(() => {
    if (path !== lockedPath.current) {
      lockedPath.current = path;
      setDisplayUri(
        peekCommunityMediaUrl(path, null) ||
          String(uri ?? '').trim() ||
          null,
      );
    }
  }, [path]);

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
      recyclingKey={cacheKey}
      transition={0}
      onLoad={onLoad}
      onError={() => {
        if (!path) {
          return;
        }

        void resignCommunityMediaUrl(path).then(next => {
          if (next && next !== displayUri) {
            setDisplayUri(next);
          }
        });
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
      return prevPath === nextPath && prev.contentFit === next.contentFit;
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
