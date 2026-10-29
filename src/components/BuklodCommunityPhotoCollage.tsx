import React, { useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { BuklodCachedMediaImage } from '@/components/BuklodCachedMediaImage';
import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';

export type CommunityPhotoCollageItem = {
  media_path?: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  preview_path?: string | null;
};

type Props = {
  items: CommunityPhotoCollageItem[];
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain';
  preserveSinglePhotoAspectRatio?: boolean;
  onPressPhoto?: (
    index: number,
    items: CommunityPhotoCollageItem[]
  ) => void;
  onLongPressPhoto?: (
    index: number,
    items: CommunityPhotoCollageItem[]
  ) => void;
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
      const key = String(
        item.media_path || item.media_url || ''
      ).trim();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, COMMUNITY_MAX_PHOTOS);
}

/**
 * Canonical Community Wall collage geometry.
 * Every absolute tile gets an explicit left/top coordinate.
 */
export function communityPhotoCollageTileLayout(
  count: number,
  index: number,
  width: number,
  height: number,
  gap = 2
): ViewStyle {
  const visibleCount = Math.max(1, Math.min(4, count));
  const safeIndex = Math.max(
    0,
    Math.min(index, visibleCount - 1)
  );

  if (visibleCount === 1) {
    return { left: 0, top: 0, width, height };
  }

  if (visibleCount === 2) {
    const tileWidth = (width - gap) / 2;

    return {
      left: safeIndex === 0 ? 0 : tileWidth + gap,
      top: 0,
      width: tileWidth,
      height,
    };
  }

  if (visibleCount === 3) {
    const topHeight = Math.round((height - gap) * 0.58);
    const bottomHeight = Math.max(
      1,
      height - gap - topHeight
    );
    const bottomWidth = (width - gap) / 2;

    if (safeIndex === 0) {
      return {
        left: 0,
        top: 0,
        width,
        height: topHeight,
      };
    }

    return {
      left:
        safeIndex === 1
          ? 0
          : bottomWidth + gap,
      top: topHeight + gap,
      width: bottomWidth,
      height: bottomHeight,
    };
  }

  const tileWidth = (width - gap) / 2;
  const tileHeight = (height - gap) / 2;
  const column = safeIndex % 2;
  const row = Math.floor(safeIndex / 2);

  return {
    left: column * (tileWidth + gap),
    top: row * (tileHeight + gap),
    width: tileWidth,
    height: tileHeight,
  };
}

export function BuklodCommunityPhotoCollage({
  items,
  width,
  height,
  style,
  imageStyle,
  contentFit = 'cover',
  preserveSinglePhotoAspectRatio = false,
  onPressPhoto,
  onLongPressPhoto,
}: Props) {
  const photos = communityPhotoCollageItems(items);
  const count = photos.length;
  const [measuredWidth, setMeasuredWidth] = useState(
    Math.max(1, Dimensions.get('window').width - 24)
  );

  const [
    singleAspectRatio,
    setSingleAspectRatio,
  ] = useState<number | null>(null);

  if (!count) {
    return null;
  }

  const collageWidth = Math.max(
    1,
    width ?? measuredWidth
  );
  const singlePhotoHeight =
    height ??
    (
      preserveSinglePhotoAspectRatio &&
      singleAspectRatio &&
      singleAspectRatio > 0
        ? Math.max(
            1,
            Math.min(
              520,
              Math.max(220, Math.round(collageWidth / singleAspectRatio))
            )
          )
        : 310
    );

  const collageHeight =
    count === 1
      ? singlePhotoHeight
      : (height ?? 280);

  const handleLayout = (event: LayoutChangeEvent) => {
    if (width != null) {
      return;
    }

    const nextWidth = Number(
      event.nativeEvent.layout.width ?? 0
    );

    if (
      nextWidth > 0 &&
      Math.abs(nextWidth - measuredWidth) > 0.5
    ) {
      setMeasuredWidth(nextWidth);
    }
  };

  if (count === 1) {
    return (
      <Pressable
        onLayout={handleLayout}
        onPress={() => onPressPhoto?.(0, photos)}
        onLongPress={() => onLongPressPhoto?.(0, photos)}
        style={[
          styles.one,
          {
            width: width ?? '100%',
            height: collageHeight,
          },
          style,
        ]}
      >
        <BuklodCachedMediaImage
          uri={photos[0].media_url}
          mediaPath={photos[0].media_path}
          useWallPreview
          previewPath={photos[0].preview_path}
          style={[styles.image, imageStyle]}
          contentFit={
            preserveSinglePhotoAspectRatio
              ? 'contain'
              : contentFit
          }
          onLoad={(event: any) => {
            if (
              !preserveSinglePhotoAspectRatio ||
              height != null
            ) {
              return;
            }

            const source =
              event?.source ?? event;

            const imageWidth =
              Number(
                source?.width ??
                event?.width ??
                0
              );

            const imageHeight =
              Number(
                source?.height ??
                event?.height ??
                0
              );

            if (
              imageWidth > 0 &&
              imageHeight > 0
            ) {
              const nextRatio =
                imageWidth /
                imageHeight;

              setSingleAspectRatio(
                current =>
                  current &&
                  Math.abs(
                    current -
                    nextRatio
                  ) < 0.001
                    ? current
                    : nextRatio
              );
            }
          }}
        />
      </Pressable>
    );
  }

  const visible = photos.slice(0, 4);
  const extraCount = count - 4;

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.grid,
        {
          width: width ?? '100%',
          height: collageHeight,
        },
        style,
      ]}
    >
      {visible.map((photo, index) => {
        const tileStyle = communityPhotoCollageTileLayout(
          visible.length,
          index,
          collageWidth,
          collageHeight,
          2
        );
        const showMore =
          extraCount > 0 &&
          index === visible.length - 1;

        return (
          <Pressable
            key={
              photo.media_path ||
              photo.media_url ||
              String(index)
            }
            onPress={() =>
              onPressPhoto?.(index, photos)
            }
            onLongPress={() =>
              onLongPressPhoto?.(index, photos)
            }
            style={[styles.tile, tileStyle]}
          >
            <BuklodCachedMediaImage
              uri={photo.media_url}
              mediaPath={photo.media_path}
              useWallPreview
              previewPath={photo.preview_path}
              style={[styles.image, imageStyle]}
              contentFit={contentFit}
            />

            {showMore ? (
              <View
                style={styles.more}
                pointerEvents="none"
              >
                <Text style={styles.moreText}>
                  +{extraCount}
                </Text>
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
    alignSelf: 'stretch',
    borderRadius: 0,
    overflow: 'hidden',
  },
  grid: {
    alignSelf: 'stretch',
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
    fontSize: 22,
    fontWeight: '900',
  },
});
