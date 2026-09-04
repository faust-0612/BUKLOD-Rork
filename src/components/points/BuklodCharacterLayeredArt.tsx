/* BUKLOD_CHARACTER_R25_PROPORTION_SAFE_LAYERING */
import React, {
  Fragment,
  useMemo,
  useState,
} from 'react';

import {
  Image,
  StyleSheet,
  View,
} from 'react-native';

import BuklodLocalCharacterFigure
  from '@/components/points/BuklodLocalCharacterFigure';

import {
  assetUrl,
  BASE_ASPECT,
  placementFor,
} from '@/lib/character-lab-core/assets';

import {
  assetKeyFor,
  getItem,
  LAYER_ORDER,
} from '@/lib/character-lab-core/catalog';

import type {
  BodyId,
  Equipment,
  SlotId,
} from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  equipment: Equipment;
  height: number;
  showStage?: boolean;
  showEffects?: boolean;
};

type Layer = {
  key: string;
  url: string;
  tintColor: string | null;
  placement: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};

const pct = (value: number) =>
  `${value}%` as `${number}%`;

function alphaHex(
  color: string,
  alpha: string,
) {
  return /^#[0-9a-f]{6}$/i.test(color)
    ? `${color}${alpha}`
    : color;
}

function resolveLayer(
  equipment: Equipment,
  body: BodyId,
  slot: SlotId,
): Layer | null {
  const item = getItem(equipment[slot]);

  if (!item) return null;

  const key = assetKeyFor(item, body);
  if (!key) return null;

  const url = assetUrl(key);
  const placement = placementFor(key);

  if (!url || !placement) return null;

  return {
    key: `${slot}:${item.id}:${key}`,
    url,
    placement,
    tintColor:
      item.id.startsWith('prestige_')
        ? item.swatch[1]
        : null,
  };
}

export default function BuklodCharacterLayeredArt({
  body,
  equipment,
  height,
  showStage = false,
  showEffects = true,
}: Props) {
  const [baseFailed, setBaseFailed] =
    useState(false);

  const aspect = BASE_ASPECT[body] || 0.37;
  const artWidth = Math.max(
    1,
    Math.round(height * aspect),
  );

  const baseItem =
    getItem(equipment.base) ??
    getItem(
      body === 'female'
        ? 'base_female'
        : 'base_male',
    );

  const baseKey = baseItem
    ? assetKeyFor(baseItem, body)
    : null;

  const baseUrl = assetUrl(
    baseKey ??
      (body === 'female'
        ? 'char_base_female'
        : 'char_base_male'),
  );

  const layers = useMemo(
    () =>
      LAYER_ORDER
        .filter(
          (slot) =>
            slot !== 'base' &&
            slot !== 'background' &&
            slot !== 'special' &&
            slot !== 'badge',
        )
        .map((slot) =>
          resolveLayer(equipment, body, slot),
        )
        .filter(
          (row): row is Layer => Boolean(row),
        ),
    [body, equipment],
  );

  const backgroundItem = getItem(
    equipment.background,
  );

  const backgroundUrl = showStage
    ? assetUrl(backgroundItem?.stage ?? null)
    : null;

  const backgroundTint =
    backgroundItem?.id.startsWith('prestige_')
      ? backgroundItem.swatch[1]
      : null;

  const specialItem = getItem(
    equipment.special,
  );

  const effect =
    showEffects
      ? specialItem?.effect
      : 'none';

  const effectColor =
    specialItem?.swatch?.[1] ?? '#4FBF6B';

  const badgeItem = getItem(
    equipment.badge,
  );

  const badgeColor =
    badgeItem?.swatch?.[1] ?? '#F0B429';

  if (!baseUrl || baseFailed) {
    return (
      <View
        style={[
          styles.fallback,
          { width: artWidth, height },
        ]}
        pointerEvents="none"
      >
        <BuklodLocalCharacterFigure
          body={body}
          equipment={equipment}
          width={artWidth}
          mode="full"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.outer,
        {
          width: showStage
            ? Math.max(116, artWidth * 2.25)
            : artWidth,
          height,
        },
      ]}
      pointerEvents="none"
    >
      {showStage ? (
        <View style={styles.stage}>
          {backgroundUrl ? (
            <Image
              source={{ uri: backgroundUrl }}
              resizeMode="cover"
              fadeDuration={0}
              style={StyleSheet.absoluteFill}
            />
          ) : null}

          {backgroundTint ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor:
                    alphaHex(backgroundTint, '24'),
                },
              ]}
            />
          ) : null}

          <View style={styles.stageWash} />

          {effect && effect !== 'none' ? (
            <View
              style={[
                styles.effectGlow,
                {
                  backgroundColor:
                    alphaHex(effectColor, '18'),
                  borderColor:
                    alphaHex(effectColor, '54'),
                },
              ]}
            />
          ) : null}

          {effect === 'ascend' ? (
            <>
              <View
                style={[
                  styles.effectRing,
                  styles.effectRingLarge,
                  {
                    borderColor:
                      alphaHex(effectColor, '70'),
                  },
                ]}
              />
              <View
                style={[
                  styles.effectRing,
                  styles.effectRingSmall,
                  {
                    borderColor:
                      alphaHex(effectColor, '90'),
                  },
                ]}
              />
            </>
          ) : effect === 'aura' ? (
            <View
              style={[
                styles.effectRing,
                styles.auraRing,
                {
                  borderColor:
                    alphaHex(effectColor, '80'),
                },
              ]}
            />
          ) : null}

          {badgeItem &&
          badgeItem.id !== 'badge_none' ? (
            <View
              style={[
                styles.badgeMark,
                {
                  borderColor:
                    alphaHex(badgeColor, 'A0'),
                  backgroundColor:
                    alphaHex(badgeColor, '28'),
                },
              ]}
            >
              <View
                style={[
                  styles.badgeDot,
                  { backgroundColor: badgeColor },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.art,
          { width: artWidth, height },
        ]}
      >
        <Image
          source={{ uri: baseUrl }}
          resizeMode="contain"
          fadeDuration={0}
          onError={() => setBaseFailed(true)}
          style={StyleSheet.absoluteFill}
        />

        {layers.map(
          ({
            key,
            url,
            placement,
            tintColor,
          }) => (
            <Fragment key={key}>
              <Image
                source={{ uri: url }}
                resizeMode="contain"
                fadeDuration={0}
                style={{
                  position: 'absolute',
                  left: pct(placement.left),
                  top: pct(placement.top),
                  width: pct(placement.width),
                  height: pct(placement.height),
                }}
              />

              {tintColor ? (
                <Image
                  source={{ uri: url }}
                  resizeMode="contain"
                  fadeDuration={0}
                  style={{
                    position: 'absolute',
                    left: pct(placement.left),
                    top: pct(placement.top),
                    width: pct(placement.width),
                    height: pct(placement.height),
                    tintColor,
                    opacity: 0.24,
                  }}
                />
              ) : null}
            </Fragment>
          ),
        )}
      </View>

      <View
        style={[
          styles.shadow,
          {
            width: Math.max(
              30,
              artWidth * 0.75,
            ),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },

  art: {
    zIndex: 3,
    position: 'relative',
    overflow: 'visible',
  },

  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },

  stage: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#EAF2ED',
  },

  stageWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor:
      'rgba(247,250,248,0.18)',
  },

  effectGlow: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 4,
    width: '82%',
    height: '66%',
    borderRadius: 999,
    borderWidth: 1,
  },

  effectRing: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 10,
    borderRadius: 999,
    borderWidth: 2,
  },

  auraRing: {
    width: '66%',
    height: 22,
  },

  effectRingLarge: {
    width: '78%',
    height: 30,
  },

  effectRingSmall: {
    width: '52%',
    height: 18,
    bottom: 16,
  },

  badgeMark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  shadow: {
    position: 'absolute',
    zIndex: 2,
    alignSelf: 'center',
    bottom: 1,
    height: 9,
    borderRadius: 999,
    backgroundColor:
      'rgba(22,48,31,0.15)',
    transform: [{ scaleY: 0.55 }],
  },
});
