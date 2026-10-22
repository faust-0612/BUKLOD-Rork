import React from 'react';
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/*
 * BUKLOD_BRAND_CENTER_LOCK_R1
 *
 * The logo box is the only centered child. The tagline sits below it and
 * must never change the mark's center. Splash, startup, and reload share this.
 */
const CANONICAL_MARK = require('../../assets/release/buklod-main-canonical.png');

/*
 * Frozen at load. A later window shrink — the fingerprint sheet uses
 * adjustResize — must not move the mark to a new center.
 */
const LOCKED_SCREEN = Dimensions.get('screen');

export const BUKLOD_BRAND_LOGO_NATIVE = 200;
export const BUKLOD_BRAND_LOGO_WEB = 220;

type Props = {
  logoSize: number;
  markStyle?: object;
  taglineStyle?: object;
  showTagline?: boolean;
  lockToScreen?: boolean;
  onLogoLoad?: () => void;
};

export default function BuklodCenteredBrandMark({
  logoSize,
  markStyle,
  taglineStyle,
  showTagline = true,
  lockToScreen = false,
  onLogoLoad,
}: Props) {
  const lockedTop = (LOCKED_SCREEN.height - logoSize) / 2;
  const lockedLeft = (LOCKED_SCREEN.width - logoSize) / 2;

  return (
    <View
      pointerEvents="none"
      style={
        lockToScreen
          ? [
              styles.lockedStage,
              {
                width: LOCKED_SCREEN.width,
                height: LOCKED_SCREEN.height,
              },
            ]
          : styles.stage
      }
    >
      <Animated.View
        style={[
          styles.mark,
          lockToScreen
            ? {
                position: 'absolute',
                top: lockedTop,
                left: lockedLeft,
              }
            : null,
          { width: logoSize, height: logoSize },
          markStyle,
        ]}
      >
        <Image
          source={CANONICAL_MARK}
          resizeMode="contain"
          onLoad={onLogoLoad}
          onLoadEnd={onLogoLoad}
          style={{ width: logoSize, height: logoSize }}
        />
      </Animated.View>

      {showTagline ? (
        <Animated.View
          style={[
            styles.taglineWrap,
            lockToScreen
              ? { top: LOCKED_SCREEN.height / 2 + logoSize / 2 + 13 }
              : { marginTop: logoSize / 2 + 13 },
            taglineStyle,
          ]}
        >
          <Text style={styles.tagline}>Your Daily Companion in Life</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedStage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineWrap: {
    position: 'absolute',
    top: '50%',
    left: 28,
    right: 28,
    alignItems: 'center',
  },
  tagline: {
    color: '#5D6D63',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 0.25,
    textAlign: 'center',
  },
});
