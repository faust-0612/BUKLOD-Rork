/* Original BUKLOD Circle Rank emblem. No third-party badge artwork/assets. */
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';
import GenesisRankBadgeArtwork, { normalizeGenesisRankName } from '@/features/season2/genesis/GenesisRankBadgeArtwork';
import { getBuklodCircleRankArt } from '@/lib/buklodCircleRankArt';
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg';

type BadgeProps = {
  rankFamily?: string | null;
  rankLevel?: string | null;
  rankName?: string | null;
  size?: number;
  locked?: boolean;
  animate?: boolean;
};

type Colors = { base: string; edge: string; deep: string; jewel: string };
const FAMILY_COLORS: Record<string, Colors> = {
  starter: { base: '#607F8D', edge: '#BCD4D9', deep: '#304955', jewel: '#E7F5F1' },
  active: { base: '#148D77', edge: '#A5E0CE', deep: '#075E52', jewel: '#D8FFF2' },
  steady: { base: '#2C7FC0', edge: '#B4DFFA', deep: '#184D85', jewel: '#DEF2FF' },
  builder: { base: '#625BB4', edge: '#D2CAFF', deep: '#353579', jewel: '#F1EBFF' },
  impact: { base: '#9856A8', edge: '#F0C4F2', deep: '#61366F', jewel: '#FFF0FF' },
  vanguard: { base: '#C37A2B', edge: '#FFE1A1', deep: '#794517', jewel: '#FFF5D7' },
  prime: { base: '#B94757', edge: '#FFD3C1', deep: '#752D46', jewel: '#FFF0E7' },
  'prime elite': { base: '#C99B22', edge: '#FFE99E', deep: '#775309', jewel: '#FFFFDF' },
};

const LEVELS = new Set(['V', 'IV', 'III', 'II', 'I']);
export function circleRankBadgeParts(rankName?: string | null) {
  const name = String(rankName ?? 'Circle Starter V').trim();
  const level = (name.match(/\b(V|IV|III|II|I)$/i)?.[1] ?? 'V').toUpperCase();
  const family = name.replace(/^Circle\s+/i, '').replace(/\s+(V|IV|III|II|I)$/i, '').trim();
  return { family: family || 'Starter', level };
}

function OriginalCircleRankBadge({
  rankFamily, rankLevel, rankName, size = 56, locked = false,
}: BadgeProps) {
  const parsed = circleRankBadgeParts(rankName);
  const previewName = rankName ||
    [rankFamily || 'Circle '+parsed.family,rankLevel || parsed.level].join(' ');
  const approved = getBuklodCircleRankArt(normalizeGenesisRankName(previewName));
  if (isGenesisPreviewBuild() && approved) {
    return <GenesisRankBadgeArtwork rankName={approved.name} size={size} locked={locked}/>;
  }
  const family = String(rankFamily || parsed.family).replace(/^Circle\s+/i, '').trim();
  const level = String(rankLevel || parsed.level).trim().toUpperCase();
  const roman = LEVELS.has(level) ? level : parsed.level;
  const colors = FAMILY_COLORS[family.toLowerCase()] ?? FAMILY_COLORS.starter;
  const outer = locked ? '#BAC5C0' : colors.edge;
  const inner = locked ? '#D8E1DC' : colors.base;
  const deep = locked ? '#A7B4AC' : colors.deep;
  const shine = locked ? '#EEF3EF' : colors.jewel;
  const text = locked ? '#75867D' : '#FFFFFF';
  const tier = ['V', 'IV', 'III', 'II', 'I'].indexOf(roman);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${rankName || `Circle ${family} ${roman}`}${locked ? ', locked' : ', badge'}`}
      style={{ width: size, height: size * 1.12, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size * 1.12} viewBox="0 0 100 112">
        <Path
          d="M50 3 C64 11 78 16 92 16 L89 63 Q85 85 50 109 Q15 85 11 63 L8 16 C22 16 36 11 50 3 Z"
          fill={outer}
        />
        <Path
          d="M50 10 C64 18 74 21 84 22 L81 62 Q77 80 50 101 Q23 80 19 62 L16 22 C26 21 36 18 50 10 Z"
          fill={deep}
        />
        <Path
          d="M50 15 C62 21 72 26 79 27 L76 61 Q73 76 50 94 Q27 76 24 61 L21 27 C28 26 38 21 50 15 Z"
          fill={inner}
        />
        <Path d="M24 30 Q39 28 50 18 Q65 28 76 30 L72 37 Q59 33 50 26 Q38 33 28 37 Z" fill={shine} opacity={0.35} />
        <Polygon points="50,22 53.8,30 63,31 56,37 58,46 50,41 42,46 44,37 37,31 46.2,30" fill={shine} />
        <Circle cx={31} cy={52} r={2.1} fill={shine} opacity={0.8} />
        <Circle cx={69} cy={52} r={2.1} fill={shine} opacity={0.8} />
        <SvgText
          x="50" y="73" fontSize={roman.length > 2 ? 28 : 33}
          fontWeight="900" fill={text} textAnchor="middle"
        >{roman}</SvgText>
        {Array.from({ length: Math.max(1, tier + 1) }, (_, index) => {
          const x = 50 + (index - tier / 2) * 8;
          return <Circle key={index} cx={x} cy={84} r={2} fill={shine} />;
        })}
      </Svg>
    </View>
  );
}

/** Finite opt-in motion; the original artwork and dimensions are unchanged. */
export default function BuklodCircleRankBadge(props: BadgeProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const enabled = Boolean(props.animate && !props.locked);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let motion: Animated.CompositeAnimation | undefined;
    let preferenceChanged = false;
    let reduced = true;
    const stop = () => { motion?.stop(); scale.setValue(1); };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      preferenceChanged = true;
      reduced = value;
      if (value) stop();
    });
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (!alive) return;
      if (!preferenceChanged) reduced = value;
      if (reduced) return;
      scale.setValue(0.96);
      motion = Animated.sequence([
        Animated.timing(scale, { toValue: 1.035, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }),
        Animated.timing(scale, { toValue: 1, duration: 320, easing: Easing.inOut(Easing.cubic), useNativeDriver: true, isInteraction: false }),
      ]);
      motion.start();
    }).catch(() => { if (alive) stop(); });
    return () => { alive = false; subscription.remove(); stop(); };
  }, [enabled, props.rankName, props.rankFamily, props.rankLevel, scale]);
  if (!enabled) return <OriginalCircleRankBadge {...props} />;
  return <Animated.View style={{ transform: [{ scale }] }}><OriginalCircleRankBadge {...props} /></Animated.View>;
}
