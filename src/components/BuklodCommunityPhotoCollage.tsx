import React from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';

import { BuklodCachedMediaImage } from '@/components/BuklodCachedMediaImage';
import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';
import { maritesCollageTileLayout } from '@/lib/buklodMaritesBoard';

export type CommunityPhotoCollageItem = {
  media_path?: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
};

type Props = {
  items: CommunityPhotoCollageItem[];
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  onPressPhoto?: (index: number, items: CommunityPhotoCollageItem[]) => void;
};

function isPhotoItem(item: CommunityPhotoCollageItem) {
  return (
    (!!item?.media_url || !!item?.media_path) &&
    !String(item?.media_mime_type ?? '')
      .toLowerCase()
      .startsWith('video/')
  );
}

export function communityPhotoCollageItems(
  mediaItems: CommunityPhotoCollageItem[] | null | undefined,
  fallback?: CommunityPhotoCollageItem | null
): CommunityPhotoCollageItem[] {
  const raw = (
    Array.isArray(mediaItems) && mediaItems.length
      ? mediaItems
      : fallback?.media_path || fallback?.media_url
        ? [fallback]
        : []
  ).filter(isPhotoItem);

  const seen = new Set<string>();

  return raw
    .filter(item => {
      const key = String(item.media_path || item.media_url || '').trim();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, COMMUNITY_MAX_PHOTOS);
}

export function BuklodCommunityPhotoCollage({
  items,
  width,
  height,
  style,
  imageStyle,
  onPressPhoto,
}: Props) {
  const photos = communityPhotoCollageItems(items);
  const count = photos.length;

  if (!count) {
    return null;
  }

  const collageWidth = width ?? Dimensions.get('window').width;
  const collageHeight = height ?? (count === 1 ? 310 : 280);

  if (count === 1) {
    return (
      <Pressable
        onPress={() => onPressPhoto?.(0, photos)}
        style={[
          styles.one,
          { width: collageWidth, height: collageHeight },
          style,
        ]}
      >
        <BuklodCachedMediaImage
          uri={photos[0].media_url}
          mediaPath={photos[0].media_path}
          style={[styles.image, imageStyle]}
          contentFit="cover"
        />
      </Pressable>
    );
  }

  const visible = photos.slice(0, 4);
  const extraCount = count - 4;

  return (
    <View
      style={[
        styles.grid,
        { width: collageWidth, height: collageHeight },
        style,
      ]}
    >
      {visible.map((photo, index) => {
        const tileStyle = maritesCollageTileLayout(
          visible.length,
          index,
          collageWidth,
          collageHeight,
          2
        );
        const showMore = extraCount > 0 && index === visible.length - 1;

        return (
          <Pressable
            key={photo.media_path || String(index)}
            onPress={() => onPressPhoto?.(index, photos)}
            style={[styles.tile, tileStyle]}
          >
            <BuklodCachedMediaImage
              uri={photo.media_url}
              mediaPath={photo.media_path}
              style={[styles.image, imageStyle]}
              contentFit="cover"
            />
            {showMore ? (
              <View style={styles.more} pointerEvents="none">
                <Text style={styles.moreText}>+{extraCount}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  one: {
    alignSelf: 'center',
    borderRadius: 0,
    overflow: 'hidden',
  },
  grid: {
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  tile: {
    overflow: 'hidden',
    position: 'absolute',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  more: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  moreText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
});
