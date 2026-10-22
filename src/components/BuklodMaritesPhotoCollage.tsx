import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  MARITES_CARD_FOOTER_HEIGHT,
  MARITES_CARD_HEIGHT,
  MARITES_CARD_WIDTH,
  MARITES_MAX_PHOTOS,
  maritesCollageTileLayout,
} from '@/lib/buklodMaritesBoard';

type Props = {
  uris: string[];
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
  onPressPhoto?: (index: number) => void;
};

export default function BuklodMaritesPhotoCollage({
  uris,
  width = MARITES_CARD_WIDTH,
  height = MARITES_CARD_HEIGHT - MARITES_CARD_FOOTER_HEIGHT,
  style,
  onPressPhoto,
}: Props) {
  const photos = useMemo(
    () => uris.filter(Boolean).slice(0, MARITES_MAX_PHOTOS),
    [uris]
  );

  if (!photos.length) {
    return null;
  }

  if (photos.length === 1) {
    const content = (
      <Image
        source={{ uri: photos[0] }}
        style={styles.single}
        resizeMode="cover"
      />
    );

    if (onPressPhoto) {
      return (
        <Pressable
          style={[styles.wrap, { width, height }, style]}
          onPress={() => onPressPhoto(0)}
        >
          {content}
        </Pressable>
      );
    }

    return (
      <View style={[styles.wrap, { width, height }, style]}>
        {content}
      </View>
    );
  }

  const visible = photos.slice(0, 4);
  const extraCount = photos.length - 4;

  return (
    <View
      style={[
        styles.wrap,
        styles.collage,
        { width, height },
        style,
      ]}
    >
      {visible.map((uri, index) => {
        const tile = maritesCollageTileLayout(
          visible.length,
          index,
          width,
          height,
          2
        );
        const showMore =
          extraCount > 0 && index === visible.length - 1;

        const tileContent = (
          <>
            <Image
              source={{ uri }}
              style={styles.tileImage}
              resizeMode="cover"
            />
            {showMore ? (
              <View style={styles.moreOverlay} pointerEvents="none">
                <Text style={styles.moreText}>
                  +{extraCount}
                </Text>
              </View>
            ) : null}
          </>
        );

        if (onPressPhoto) {
          return (
            <Pressable
              key={`${uri}-${index}`}
              style={[styles.tile, tile]}
              onPress={() => onPressPhoto(index)}
            >
              {tileContent}
            </Pressable>
          );
        }

        return (
          <View
            key={`${uri}-${index}`}
            style={[styles.tile, tile]}
          >
            {tileContent}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#E5ECE8',
  },
  single: {
    width: '100%',
    height: '100%',
  },
  collage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  tile: {
    overflow: 'hidden',
    backgroundColor: '#DDE7E1',
    position: 'relative',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  moreOverlay: {
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
