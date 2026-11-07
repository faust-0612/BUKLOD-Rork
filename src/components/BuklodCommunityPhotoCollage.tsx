import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
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
import { communitySinglePhotoFrame } from '@/lib/communityMediaPresentation';
import { dedupeCommunityPhotoItems } from '@/lib/communityPhotoIdentity';

export type CommunityPhotoCollageItem = {
  media_path?: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  preview_path?: string | null;
};

export type CommunityPhotoCollageLayout = 'grid' | 'highlight' | 'swipe';
const layoutForOriginal = new Map<string, CommunityPhotoCollageLayout>();
export function rememberCommunityCollageLayout(mediaIdentity: string, layout: CommunityPhotoCollageLayout) {
  if (mediaIdentity) layoutForOriginal.set(mediaIdentity, layout);
}
const LAYOUTS: readonly CommunityPhotoCollageLayout[] = ['grid', 'highlight', 'swipe'];

type Props = {
  items: CommunityPhotoCollageItem[];
  /** Composer preview can supply its chosen layout; feed viewers may switch locally. */
  layoutMode?: CommunityPhotoCollageLayout;
  showLayoutPicker?: boolean;
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

  return dedupeCommunityPhotoItems(raw).slice(0, COMMUNITY_MAX_PHOTOS);
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
  gap = 2,
  mode: 'grid' | 'highlight' = 'grid',
): ViewStyle {
  const visibleCount = Math.max(1, Math.min(4, count));
  const safeIndex = Math.max(
    0,
    Math.min(index, visibleCount - 1)
  );

  if (visibleCount === 1) {
    return { left: 0, top: 0, width, height };
  }

  if (mode === 'highlight') {
    const heroWidth = Math.max(1, Math.round(width * 0.62));
    const sideWidth = Math.max(1, width - heroWidth - gap);
    if (safeIndex === 0) return { left: 0, top: 0, width: heroWidth, height };
    const remaining = visibleCount - 1;
    const sideHeight = Math.max(1, (height - gap * (remaining - 1)) / remaining);
    return {
      left: heroWidth + gap,
      top: (safeIndex - 1) * (sideHeight + gap),
      width: sideWidth,
      height: sideHeight,
    };
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
  layoutMode,
  showLayoutPicker = true,
  style,
  imageStyle,
  contentFit = 'cover',
  preserveSinglePhotoAspectRatio = true,
  onPressPhoto,
  onLongPressPhoto,
}: Props) {
  const photos = communityPhotoCollageItems(items);
  const count = photos.length;
  const [measuredWidth, setMeasuredWidth] = useState(
    Math.max(1, Dimensions.get('window').width - 24)
  );

  const photoIdentity = String(photos[0]?.media_path || photos[0]?.media_url || '');
  const [chosenLayout, setChosenLayout] = useState<CommunityPhotoCollageLayout>(
    () => layoutForOriginal.get(photoIdentity) ?? 'grid',
  );
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => {
    setChosenLayout(layoutForOriginal.get(photoIdentity) ?? 'grid');
    setLayoutMenuOpen(false);
    setSlideIndex(0);
  }, [photoIdentity]);
  const effectiveLayout = layoutMode ?? chosenLayout;
  const chooseLayout = (value: CommunityPhotoCollageLayout) => {
    setChosenLayout(value);
    rememberCommunityCollageLayout(photoIdentity, value);
    setLayoutMenuOpen(false);
  };
  const [singleAspect, setSingleAspect] = useState<{ identity: string; ratio: number } | null>(null);
  const singleAspectRatio = singleAspect?.identity === photoIdentity ? singleAspect.ratio : null;

  if (!count) {
    return null;
  }

  const collageWidth = Math.max(
    1,
    width ?? measuredWidth
  );
  const singlePhotoFrame = preserveSinglePhotoAspectRatio && singleAspectRatio
    ? communitySinglePhotoFrame(collageWidth, singleAspectRatio)
    : null;
  const singlePhotoHeight = height ?? singlePhotoFrame?.height ?? 310;
  const singlePhotoFit = singlePhotoFrame?.contentFit ?? contentFit;

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
          // Render the authorized original directly on Android: a tiny preview
          // must not remain visible after the original has downloaded.
          useWallPreview={false}
          previewPath={photos[0].preview_path}
          style={[styles.image, imageStyle]}
          // Normal ratios remain edge-to-edge; extreme ratios show every pixel.
          contentFit={singlePhotoFit}
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

              setSingleAspect(current =>
                current?.identity === photoIdentity && Math.abs(current.ratio - nextRatio) < 0.001
                  ? current
                  : { identity: photoIdentity, ratio: nextRatio }
              );
            }
          }}
        />
      </Pressable>
    );
  }

  const visible = photos.slice(0, 4);
  const extraCount = count - 4;
  const layoutPicker = showLayoutPicker && count > 1 ? (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Choose photo collage layout. Current: ${effectiveLayout}`}
        style={styles.layoutToggle}
        onPress={() => setLayoutMenuOpen(open => !open)}
      >
        <Text style={styles.layoutToggleText}>Layout · {effectiveLayout}</Text>
      </Pressable>
      {layoutMenuOpen ? (
        <View style={styles.layoutOptions}>
          {LAYOUTS.map(value => (
            <Pressable key={value} accessibilityRole="button"
              accessibilityLabel={`Use ${value} collage layout`}
              onPress={() => chooseLayout(value)}
              style={[styles.layoutOption, value === effectiveLayout && styles.layoutSelected]}
            >
              <Text style={styles.layoutToggleText}>{value}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  ) : null;

  if (effectiveLayout === 'swipe') {
    return (
      <View onLayout={handleLayout}
        style={[styles.grid, { width: width ?? '100%', height: collageHeight }, style]}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(photo, index) => String(photo.media_path || photo.media_url || index)}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          getItemLayout={(_, index) => ({ length: collageWidth, offset: collageWidth * index, index })}
          onMomentumScrollEnd={event => {
            setSlideIndex(Math.min(photos.length - 1,
              Math.max(0, Math.round(event.nativeEvent.contentOffset.x / collageWidth))));
          }}
          renderItem={({ item: photo, index }) => (
            <Pressable
              style={{ width: collageWidth, height: collageHeight }}
              onPress={() => onPressPhoto?.(index, photos)}
              onLongPress={() => onLongPressPhoto?.(index, photos)}
            >
              <BuklodCachedMediaImage
                uri={photo.media_url}
                mediaPath={photo.media_path}
                useWallPreview={false}
                previewPath={photo.preview_path}
                style={[styles.image, imageStyle]}
                contentFit="contain"
              />
            </Pressable>
          )}
        />
        <View pointerEvents="none" style={styles.slideCounter}>
          <Text style={styles.layoutToggleText}>{slideIndex + 1}/{count}</Text>
        </View>
        {layoutPicker}
      </View>
    );
  }

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
          2,
          effectiveLayout,
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
              useWallPreview={false}
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
      {layoutPicker}
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
  layoutToggle: {
    position: 'absolute',
    zIndex: 12,
    top: 8,
    right: 8,
    minHeight: 30,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  layoutOptions: {
    position: 'absolute',
    zIndex: 13,
    top: 42,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.83)',
  },
  layoutOption: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 9,
  },
  layoutSelected: {
    backgroundColor: '#236F4B',
  },
  layoutToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  slideCounter: {
    position: 'absolute',
    zIndex: 8,
    bottom: 9,
    right: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 9,
    paddingVertical: 5,
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
