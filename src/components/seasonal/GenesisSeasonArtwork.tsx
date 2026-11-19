import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  GENESIS_ART_PERFORMANCE,
  GENESIS_SEASON2_VISUALS,
  type BuklodGenesisMotif,
} from '@/lib/buklodSeasonVisuals';

/**
 * Decorative Genesis line art for a bounded hero/banner surface.
 *
 * Opt-in only: DO NOT mount automatically before a separately authorized
 * Season 2 release. Parent must use position:'relative' and clip artwork.
 * Render no artwork over ads, readable long-form content or video controls.
 */
export default function GenesisSeasonArtwork({
  motif = 'firstLight',
  stroke = GENESIS_SEASON2_VISUALS.colors.sunriseGold,
  opacity = 0.13,
}: {
  motif?: BuklodGenesisMotif;
  stroke?: string;
  opacity?: number;
}) {
  const safeOpacity = Number.isFinite(opacity)
    ? Math.max(0, Math.min(opacity, GENESIS_ART_PERFORMANCE.maxDecorativeOpacity))
    : 0.13;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFillObject, { opacity: safeOpacity }]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 360 180" preserveAspectRatio="xMidYMid slice">
        {motif === 'glorySeed' ? (
          <>
            <Path d="M-30 182 C53 103 102 93 169 113 S293 165 396 56" fill="none" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" />
            <Path d="M-31 206 C56 124 111 111 166 138 S294 184 399 80" fill="none" stroke={stroke} strokeWidth={1.1} />
            <Path d="M184 53 C164 68 168 97 186 111 C211 97 212 69 184 53 Z" fill="none" stroke={stroke} strokeWidth={2} />
            <Path d="M174 65 C190 75 178 87 195 100 M195 64 C178 76 191 88 175 102 M178 72 L191 75 M177 85 L193 87 M177 96 L192 95" fill="none" stroke={stroke} strokeWidth={1} />
            <Path d="M184 111 C184 127 172 133 158 146 M184 119 C199 128 212 139 220 148" fill="none" stroke={stroke} strokeWidth={1.6} />
            <Path d="M185 46 L185 20 M157 56 L141 36 M215 57 L230 38 M155 90 L133 92 M218 90 L240 91" fill="none" stroke={stroke} strokeWidth={1.2} />
            <Circle cx="184" cy="83" r="48" fill="none" stroke={stroke} strokeWidth={0.9} />
            <Circle cx="184" cy="83" r="58" fill="none" stroke={stroke} strokeWidth={0.6} strokeDasharray="2 7" />
          </>
        ) : motif === 'firstLight' ? (
          <>
            <Path d="M-35 178 C50 88 117 66 179 85 S291 154 395 28" fill="none" stroke={stroke} strokeWidth={2.8} strokeLinecap="round" />
            <Path d="M-30 200 C53 111 118 87 178 107 S286 165 398 52" fill="none" stroke={stroke} strokeWidth={1.6} />
            <Path d="M-27 225 C66 140 123 110 184 132 S286 184 395 81" fill="none" stroke={stroke} strokeWidth={1} />
            <Path d="M185 78 L180 -5 M206 80 L249 -15 M230 92 L318 -6 M247 113 L373 53" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
            <Circle cx="184" cy="100" r="34" fill="none" stroke={stroke} strokeWidth={1.4} />
          </>
        ) : motif === 'livingRoots' ? (
          <>
            <Path d="M180 -5 C177 38 190 67 176 93 C156 125 105 130 76 181" fill="none" stroke={stroke} strokeWidth={2.7} strokeLinecap="round" />
            <Path d="M176 91 C204 122 257 117 322 187" fill="none" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" />
            <Path d="M156 110 C122 101 99 67 76 17 M210 112 C242 96 262 66 278 21" fill="none" stroke={stroke} strokeWidth={1.4} />
            <Path d="M115 141 C94 147 70 151 40 143 M242 134 C281 130 312 141 348 128" fill="none" stroke={stroke} strokeWidth={1.2} />
            <Circle cx="176" cy="92" r="5" fill="none" stroke={stroke} strokeWidth={2} />
          </>
        ) : (
          <>
            <Path d="M-10 140 C62 97 120 112 166 71 S280 31 377 4" fill="none" stroke={stroke} strokeWidth={2.5} />
            <Path d="M-12 171 C69 144 113 143 180 121 S293 91 381 146" fill="none" stroke={stroke} strokeWidth={1.6} />
            <Path d="M84 121 L161 72 L232 112 L302 48 M160 72 L180 121" fill="none" stroke={stroke} strokeWidth={1.3} />
            {[{ x: 84, y: 121 }, { x: 161, y: 72 }, { x: 232, y: 112 }, { x: 302, y: 48 }, { x: 180, y: 121 }].map(({x,y}) => (
              <Circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="none" stroke={stroke} strokeWidth={1.7} />
            ))}
          </>
        )}
      </Svg>
    </View>
  );
}
