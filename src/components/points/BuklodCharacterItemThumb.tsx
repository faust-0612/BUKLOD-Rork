/* BUKLOD_CHARACTER_500K_REWARDS_R1 */
import BuklodLocalCharacterFigure
  from '@/components/points/BuklodLocalCharacterFigure';

import React, {
  memo,
} from 'react';

import {
  Image,
  StyleSheet,
  View,
} from 'react-native';

import {
  LinearGradient,
} from 'expo-linear-gradient';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  assetUrl,
} from '@/lib/character-lab-core/assets';

import {
  assetKeyFor,
  defaultEquipment,
} from '@/lib/character-lab-core/catalog';

import {
  catalogItemGlyph,
} from '@/lib/character-lab-core/localLooks';

import type {
  BodyId,
  CatalogItem,
} from '@/lib/character-lab-core/types';

type Props = {
  item: CatalogItem;
  body: BodyId;
  locked: boolean;
  size?: number;
};

type IconName =
  React.ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];

function BuklodCharacterItemThumbImpl({
  item,
  body,
  locked,
  size = 56,
}: Props) {
  const { theme } =
    useBuklodPresentation();

  const [from, to] =
    item.swatch;

  const glyph =
    catalogItemGlyph(item) as IconName;

  const assetKey =
    item.slot === 'background'
      ? item.stage ?? null
      : assetKeyFor(item, body);

  const url = assetUrl(assetKey);

  const prestige =
    item.id.startsWith('prestige_');

  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderColor: theme.border,
          backgroundColor:
            theme.surfaceMuted,
        },
      ]}
    >
      <LinearGradient
        colors={[
          `${from}30`,
          `${to}18`,
        ]}
        style={StyleSheet.absoluteFill}
      />

      {url ? (
        <>
          <Image
            source={{ uri: url }}
            resizeMode={
              item.slot === 'background'
                ? 'cover'
                : 'contain'
            }
            fadeDuration={0}
            style={[
              StyleSheet.absoluteFill,
              styles.realArt,
            ]}
          />

          {prestige ? (
            item.slot === 'background' ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor:
                      `${to}24`,
                  },
                ]}
              />
            ) : (
              <Image
                source={{ uri: url }}
                resizeMode="contain"
                fadeDuration={0}
                style={[
                  StyleSheet.absoluteFill,
                  styles.realArt,
                  {
                    tintColor: to,
                    opacity: 0.28,
                  },
                ]}
              />
            )
          ) : null}
        </>
      ) : (
        <View style={styles.fallback}>
          {/* BUKLOD_REAL_HAIR_FALLBACK_R7 */}
          {item.slot === 'hair' ? (
            <BuklodLocalCharacterFigure
              body={body}
              equipment={{
                ...defaultEquipment(
                  body,
                ),
                hair: item.id,
              }}
              width={
                Math.round(
                  size * 0.92,
                )
              }
              mode="face"
            />
          ) : (
            <MaterialCommunityIcons
            name={glyph}
            size={Math.round(
              size * 0.38,
            )}
            color={
              locked
                ? theme.textMuted
                : to
            }
          />
          )}
        </View>
      )}

      {prestige ? (
        <View
          style={[
            styles.prestigeDot,
            { backgroundColor: to },
          ]}
        />
      ) : null}

      {locked ? (
        <View style={styles.lockedOverlay}>
          <MaterialCommunityIcons
            name="lock-outline"
            size={18}
            color={theme.white}
          />
        </View>
      ) : null}
    </View>
  );
}

export default memo(
  BuklodCharacterItemThumbImpl,
);

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },

  realArt: {
    margin: 3,
  },

  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  prestigeDot: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },

  lockedOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      'rgba(0,0,0,0.40)',
  },
});
