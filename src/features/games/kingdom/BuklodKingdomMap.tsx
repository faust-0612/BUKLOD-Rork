import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Circle as SvgCircle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  loadBuklodKingdomPreviewProgress,
  subscribeBuklodKingdomPreviewProgress,
  type BuklodKingdomPreviewProgress,
} from './progress';

const WORLD_W = 1200;
const WORLD_H = 900;

type Station = {
  id: string;
  character: string;
  region: string;
  game: string;
  href: string;
  x: number;
  y: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: string;
  worldChange: string;
};

const STATIONS: readonly Station[] = [
  { id: 'phan-enterprise-builder', character: 'Phan', region: 'Farm / Enterprise', game: 'Enterprise Builder', href: '/games/phan-enterprise-builder', x: 110, y: 660, icon: 'barn', accent: '#d9a52f', worldChange: 'The farmstead grows into a working enterprise.' },
  { id: 'vhen-farm-to-market', character: 'Vhen', region: 'Agricultural Valley', game: 'Farm to Market', href: '/games/vhen-farm-to-market', x: 265, y: 745, icon: 'sprout', accent: '#75a841', worldChange: 'Fields become greener and the market road activates.' },
  { id: 'jawo-forest-trail', character: 'Jawo', region: 'Explorer Forest', game: 'Forest Trail', href: '/games/jawo-forest-trail', x: 170, y: 475, icon: 'pine-tree', accent: '#3d8758', worldChange: 'Trail lights awaken and the forest route glows.' },
  { id: 'trudice-playground-memory', character: 'Trudice', region: "Children's Haven", game: 'Wonder Path', href: '/games/trudice-playground-memory', x: 355, y: 375, icon: 'human-child', accent: '#bc6fb1', worldChange: 'Playground stations light up one by one.' },
  { id: 'mitch-restore-mural', character: 'Mitch', region: 'Art Village', game: 'Restore the Mural', href: '/games/mitch-restore-mural', x: 505, y: 545, icon: 'palette-outline', accent: '#bf6d50', worldChange: 'The village mural returns and new colors appear.' },
  { id: 'christian-civic-leadership', character: 'Christian', region: 'Civic Academy', game: 'Leadership Council', href: '/games/christian-civic-leadership', x: 580, y: 285, icon: 'bank-outline', accent: '#4b69a0', worldChange: 'The council hall opens and civic lights activate.' },
  { id: 'ace-rescue-grid', character: 'Ace', region: 'Strategy / Rescue', game: 'Rescue Grid', href: '/games/ace-rescue-grid', x: 720, y: 430, icon: 'map-marker-path', accent: '#397b9c', worldChange: 'Blocked corridors clear and rescue beacons stay lit.' },
  { id: 'van-living-city-dispatch', character: 'Van', region: 'Living City', game: 'City Dispatch', href: '/games/van-living-city-dispatch', x: 825, y: 260, icon: 'city-variant-outline', accent: '#327c91', worldChange: 'The skyline activates and service routes begin moving.' },
  { id: 'lhen-rhythm-journey', character: 'Lhen', region: 'Music City', game: 'Rhythm Journey', href: '/games/lhen-rhythm-journey', x: 970, y: 350, icon: 'music-note', accent: '#8b4b91', worldChange: 'Music lights pulse across the performance district.' },
  { id: 'angel-kingdom-treasury', character: 'Angel', region: 'Treasury City', game: 'Kingdom Treasury', href: '/games/angel-kingdom-treasury', x: 910, y: 620, icon: 'treasure-chest-outline', accent: '#a36c24', worldChange: 'Treasury lanterns glow and reserve vaults open.' },
  { id: 'niel-mission-trail', character: 'Niel', region: 'Mission Frontier', game: 'Mission Trail', href: '/games/niel-mission-trail', x: 690, y: 710, icon: 'compass-outline', accent: '#55744d', worldChange: 'A frontier road extends toward distant settlements.' },
  { id: 'elesur-village-builder', character: 'ELESUR', region: 'Highland Community', game: 'Village Builder', href: '/games/elesur-village-builder', x: 1040, y: 710, icon: 'home-group', accent: '#54766f', worldChange: 'New community structures rise in the highlands.' },
  { id: 'quin-discovery-expedition', character: 'Quin', region: 'Discovery World', game: 'Discovery Expedition', href: '/games/quin-discovery-expedition', x: 1045, y: 135, icon: 'telescope', accent: '#5268a4', worldChange: 'Fog clears and a hidden route becomes visible.' },
] as const;

const JOURNEY_PATH = [
  'M 110 660 C 155 700 210 730 265 745',
  'M 265 745 C 220 665 190 565 170 475',
  'M 170 475 C 230 430 290 390 355 375',
  'M 355 375 C 410 420 465 490 505 545',
  'M 505 545 C 525 440 555 350 580 285',
  'M 580 285 C 630 330 680 390 720 430',
  'M 720 430 C 765 355 795 305 825 260',
  'M 825 260 C 885 285 930 315 970 350',
  'M 970 350 C 955 455 935 545 910 620',
  'M 910 620 C 830 660 760 690 690 710',
  'M 690 710 C 820 760 930 750 1040 710',
  'M 1040 710 C 1095 580 1090 420 970 350',
  'M 970 350 C 1010 285 1035 205 1045 135',
] as const;

const FOREST_POINTS = [
  [115, 375], [145, 395], [205, 390], [225, 430], [120, 515], [210, 535], [300, 495],
  [420, 225], [455, 250], [495, 220], [765, 190], [795, 205], [1080, 245], [1110, 285],
  [550, 715], [590, 760], [650, 770], [790, 755], [1000, 785], [1085, 690],
] as const;

const MOUNTAINS = [
  { x: 450, y: 120, s: 1.15 },
  { x: 515, y: 95, s: 0.82 },
  { x: 875, y: 95, s: 1.08 },
  { x: 930, y: 120, s: 0.72 },
  { x: 1090, y: 180, s: 0.86 },
] as const;

const FUTURE = [
  { x: 1130, y: 465 },
  { x: 390, y: 115 },
  { x: 825, y: 800 },
] as const;

function emptyProgress(): BuklodKingdomPreviewProgress {
  return { version: 1, stations: {} };
}

function stageFor(cleared: number) {
  if (cleared >= 10) return 4;
  if (cleared >= 7) return 3;
  if (cleared >= 4) return 2;
  return 1;
}

const STAGE_COPY: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'A SMALL BEGINNING', subtitle: 'A greater tomorrow starts here' },
  2: { title: 'STRONGER TOGETHER', subtitle: 'The kingdom begins to awaken' },
  3: { title: 'A GROWING KINGDOM', subtitle: 'More paths, people and purpose' },
  4: { title: 'A BRIGHTER TOMORROW', subtitle: 'A united people, a living world' },
};

function StationNode({
  station,
  index,
  progress,
}: {
  station: Station;
  index: number;
  progress: BuklodKingdomPreviewProgress;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const state = progress.stations[station.id];
  const cleared = (state?.clears ?? 0) > 0;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: cleared ? 1300 : 2100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: cleared ? 1300 : 2100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cleared, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, cleared ? 1.09 : 1.035] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, cleared ? 0.62 : 0.3] });

  return (
    <View style={[styles.stationWrap, { left: station.x - 76, top: station.y - 64 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.stationGlow,
          {
            opacity: glowOpacity,
            transform: [{ scale }],
            backgroundColor: cleared ? '#ffd65d' : station.accent,
          },
        ]}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open station ${index + 1}, ${station.character}, ${station.game}`}
        onPress={() => router.push(station.href as any)}
        style={({ pressed }) => [styles.stationPressable, pressed && styles.stationPressed]}
      >
        <LinearGradient
          colors={cleared ? ['#ffe892', '#d49a2f'] : ['#f7f0d2', '#d7b974']}
          style={styles.landmarkOrb}
        >
          <View style={[styles.landmarkInner, { borderColor: station.accent }]}>
            <MaterialCommunityIcons name={station.icon} size={27} color={station.accent} />
          </View>
          <View style={[styles.numberBadge, cleared && styles.numberBadgeCleared]}>
            <Text style={styles.numberText}>{index + 1}</Text>
          </View>
          {cleared ? (
            <View style={styles.clearedBadge}>
              <MaterialCommunityIcons name="check-bold" size={10} color="#fff" />
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.parchmentPlaque}>
          <Text style={styles.stationCharacter}>{station.character}</Text>
          <Text numberOfLines={1} style={styles.stationRegion}>{station.region}</Text>
          <Text numberOfLines={1} style={styles.stationGame}>{station.game}</Text>
          <View style={styles.progressRow}>
            <Text style={styles.levelText}>1</Text>
            {Array.from({ length: 8 }).map((_, dot) => (
              <View
                key={dot}
                style={[
                  styles.progressDot,
                  dot < Math.max(1, state?.bestStars ?? 0) && (cleared ? styles.progressDotCleared : styles.progressDotActive),
                ]}
              />
            ))}
            <Text style={styles.levelText}>20</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function FutureNode({ x, y }: { x: number; y: number }) {
  return (
    <View style={[styles.futureNode, { left: x - 43, top: y - 43 }]}>
      <View style={styles.futureFog} />
      <View style={styles.futureLock}>
        <MaterialCommunityIcons name="lock-outline" size={20} color="#6b7780" />
        <Text style={styles.futureTitle}>???</Text>
        <Text style={styles.futureCopy}>COMING SOON</Text>
      </View>
    </View>
  );
}

function DecorativeLabel({
  left,
  top,
  icon,
  label,
  stage,
  minimumStage,
}: {
  left: number;
  top: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  stage: number;
  minimumStage: number;
}) {
  const locked = stage < minimumStage;
  return (
    <View style={[styles.decorativeLabel, { left, top, opacity: locked ? 0.4 : 0.95 }]}>
      <MaterialCommunityIcons name={locked ? 'lock-outline' : icon} size={18} color={locked ? '#67737a' : '#234f78'} />
      <Text style={[styles.decorativeLabelText, locked && styles.decorativeLabelLocked]}>{locked ? 'LOCKED LAND' : label}</Text>
    </View>
  );
}

export default function BuklodKingdomMap() {
  const [progress, setProgress] = useState<BuklodKingdomPreviewProgress>(emptyProgress());
  const { width } = useWindowDimensions();

  useEffect(() => {
    let mounted = true;
    loadBuklodKingdomPreviewProgress().then((value) => {
      if (mounted) setProgress(value);
    }).catch(() => undefined);
    const unsubscribe = subscribeBuklodKingdomPreviewProgress((value) => {
      if (mounted) setProgress(value);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const clearedCount = useMemo(
    () => STATIONS.filter((station) => (progress.stations[station.id]?.clears ?? 0) > 0).length,
    [progress],
  );
  const stage = stageFor(clearedCount);
  const stageCopy = STAGE_COPY[stage];
  const worldScaleHint = width < 780 ? 'SWIPE TO EXPLORE' : 'EXPLORE THE KINGDOM';

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#71c9f2', '#d8f3ff']} style={StyleSheet.absoluteFill} />

      <View style={styles.topHud} pointerEvents="box-none">
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.hudButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color="#173f62" />
        </Pressable>
        <View style={styles.progressPill}>
          <MaterialCommunityIcons name="castle" size={18} color="#c28b1d" />
          <Text style={styles.progressPillTitle}>BUKLOD KINGDOM</Text>
          <Text style={styles.progressPillMeta}>{clearedCount}/13 CLEARED • STAGE {stage}</Text>
        </View>
        <View style={styles.explorePill}>
          <MaterialCommunityIcons name="gesture-swipe-horizontal" size={17} color="#173f62" />
          <Text style={styles.exploreText}>{worldScaleHint}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalContent}
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.verticalContent}
        >
          <View style={styles.worldFrame}>
            <LinearGradient colors={['#78d7f7', '#1b93c8']} style={StyleSheet.absoluteFill} />

            <Svg width={WORLD_W} height={WORLD_H} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <SvgLinearGradient id="cliff" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#7d6c55" />
                  <Stop offset="1" stopColor="#433d36" />
                </SvgLinearGradient>
                <SvgLinearGradient id="land" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#9cdc68" />
                  <Stop offset="0.52" stopColor="#5daf54" />
                  <Stop offset="1" stopColor="#3a844f" />
                </SvgLinearGradient>
                <SvgLinearGradient id="river" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#85e7ff" />
                  <Stop offset="1" stopColor="#238fc9" />
                </SvgLinearGradient>
                <SvgLinearGradient id="route" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#fff0a1" />
                  <Stop offset="0.55" stopColor="#f6bd37" />
                  <Stop offset="1" stopColor="#f48d16" />
                </SvgLinearGradient>
              </Defs>

              <Path
                d="M80 690 C35 560 68 380 155 280 C250 170 390 170 485 120 C585 65 735 95 820 150 C910 208 1020 180 1110 245 C1190 300 1170 455 1140 535 C1110 620 1175 720 1060 780 C940 842 790 800 690 842 C565 895 430 840 330 820 C235 800 125 820 80 690 Z"
                fill="url(#cliff)"
                opacity={0.82}
              />
              <Path
                d="M88 655 C48 525 86 375 170 288 C262 193 395 195 490 142 C590 86 720 112 808 168 C900 226 1010 202 1095 262 C1160 308 1146 430 1118 515 C1085 615 1132 695 1038 748 C930 808 790 765 680 810 C565 855 445 800 338 780 C235 760 130 787 88 655 Z"
                fill="url(#land)"
                stroke="#2f7447"
                strokeWidth={8}
              />

              <Path d="M560 152 C610 250 585 350 650 430 C715 510 690 615 760 720" fill="none" stroke="url(#river)" strokeWidth={24} strokeLinecap="round" opacity={0.9} />
              <Path d="M557 155 C610 250 585 350 650 430 C715 510 690 615 760 720" fill="none" stroke="#d8f9ff" strokeWidth={5} strokeLinecap="round" opacity={0.68} />
              <Path d="M840 205 C815 320 850 390 805 470 C770 535 790 620 835 700" fill="none" stroke="url(#river)" strokeWidth={18} strokeLinecap="round" opacity={0.82} />

              {JOURNEY_PATH.map((path, index) => (
                <G key={index}>
                  <Path d={path} fill="none" stroke="#fff7c2" strokeWidth={15} strokeLinecap="round" opacity={0.78} />
                  <Path d={path} fill="none" stroke="url(#route)" strokeWidth={7} strokeLinecap="round" strokeDasharray="1 15" opacity={0.98} />
                </G>
              ))}

              {FOREST_POINTS.map(([x, y], index) => (
                <G key={`tree-${index}`}>
                  <SvgCircle cx={x} cy={y} r={13} fill="#236944" opacity={0.95} />
                  <SvgCircle cx={x - 6} cy={y + 8} r={10} fill="#3f914e" opacity={0.95} />
                  <Rect x={x - 2} y={y + 11} width={4} height={13} rx={2} fill="#725232" />
                </G>
              ))}

              {MOUNTAINS.map(({ x, y, s }, index) => (
                <G key={`mountain-${index}`}>
                  <Path d={`M ${x - 48 * s} ${y + 78 * s} L ${x} ${y} L ${x + 50 * s} ${y + 78 * s} Z`} fill="#66798a" opacity={0.96} />
                  <Path d={`M ${x - 22 * s} ${y + 36 * s} L ${x} ${y} L ${x + 20 * s} ${y + 33 * s} L ${x + 8 * s} ${y + 28 * s} L ${x} ${y + 38 * s} L ${x - 9 * s} ${y + 27 * s} Z`} fill="#f8fbff" opacity={0.9} />
                </G>
              ))}

              <Ellipse cx={610} cy={525} rx={145} ry={92} fill="#bce77c" opacity={stage >= 2 ? 0.68 : 0.34} />
              <Ellipse cx={915} cy={465} rx={120} ry={88} fill="#d9e88d" opacity={stage >= 3 ? 0.64 : 0.24} />
              <Ellipse cx={450} cy={655} rx={125} ry={82} fill="#e6d274" opacity={stage >= 2 ? 0.58 : 0.25} />
            </Svg>

            <View style={styles.brandBoard}>
              <View style={styles.brandShield}>
                <MaterialCommunityIcons name="shield-cross-outline" size={32} color="#f4c64f" />
              </View>
              <View>
                <Text style={styles.brandTitle}>BUKLOD</Text>
                <Text style={styles.brandSubtitle}>KINGDOM</Text>
              </View>
              <View style={styles.stageRibbon}>
                <Text style={styles.stageNumber}>STAGE {stage}</Text>
                <Text style={styles.stageTitle}>{stageCopy.title}</Text>
                <Text style={styles.stageSubtitle}>{stageCopy.subtitle}</Text>
              </View>
            </View>

            <View style={styles.signPost}>
              {['PEOPLE', 'FAITH', 'GROWTH', 'A BRIGHTER TOMORROW'].map((label, index) => (
                <View key={label} style={[styles.signBoard, index % 2 === 0 ? styles.signTiltA : styles.signTiltB]}>
                  <Text style={styles.signText}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.harborDecor}>
              <MaterialCommunityIcons name="sail-boat" size={54} color="#214f8b" />
              <View style={styles.smallPlaque}><Text style={styles.smallPlaqueText}>BUKLOD HARBOR</Text></View>
            </View>

            <View style={[styles.centralTree, { opacity: stage >= 2 ? 1 : 0.58 }]}>
              <View style={styles.treeCanopy} />
              <View style={styles.treeTrunk} />
              <View style={styles.smallPlaque}><Text style={styles.smallPlaqueText}>SCRIPTURE GARDEN</Text></View>
            </View>

            <View style={[styles.castleDecor, { opacity: stage >= 4 ? 1 : 0.48 }]}>
              <MaterialCommunityIcons name={stage >= 4 ? 'castle' : 'lock-outline'} size={68} color={stage >= 4 ? '#f2d072' : '#66747c'} />
              <View style={styles.castlePlaque}>
                <Text style={styles.castleTitle}>{stage >= 4 ? 'BUKLOD CITADEL' : 'HIGH CITADEL'}</Text>
                <Text style={styles.castleCopy}>{stage >= 4 ? 'A brighter world together' : 'Awakens in a later stage'}</Text>
              </View>
            </View>

            <DecorativeLabel left={360} top={185} icon="target" label="TRAINING GROUNDS" stage={stage} minimumStage={2} />
            <DecorativeLabel left={835} top={510} icon="stadium" label="IGPAT ARENA" stage={stage} minimumStage={3} />
            <DecorativeLabel left={735} top={145} icon="tower-fire" label="MENTOR TOWER" stage={stage} minimumStage={3} />

            {STATIONS.map((station, index) => (
              <StationNode key={station.id} station={station} index={index} progress={progress} />
            ))}

            {FUTURE.map((node, index) => <FutureNode key={index} x={node.x} y={node.y} />)}

            <View style={styles.compass}>
              <Text style={styles.compassN}>N</Text>
              <MaterialCommunityIcons name="compass-rose" size={48} color="rgba(34,74,103,0.72)" />
            </View>

            <View style={styles.mottoScroll}>
              <Text style={styles.motto}>BUILD • BELONG • SERVE</Text>
              <Text style={styles.mottoStrong}>TOGETHER FOR A BRIGHTER WORLD</Text>
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#83d7f3' },
  horizontalContent: { minWidth: '100%' },
  verticalContent: { minHeight: '100%' },
  worldFrame: {
    width: WORLD_W,
    height: WORLD_H,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#55bfe9',
  },
  topHud: {
    position: 'absolute',
    zIndex: 50,
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hudButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(30,77,111,0.18)',
    shadowColor: '#16415e',
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  progressPill: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: 22,
    backgroundColor: 'rgba(255,252,238,0.94)',
    borderWidth: 1,
    borderColor: '#d4aa4d',
    shadowColor: '#5d4218',
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  progressPillTitle: { fontSize: 12, fontWeight: '950', color: '#6f4a13', letterSpacing: 0.6 },
  progressPillMeta: { fontSize: 9.5, fontWeight: '900', color: '#5c6570' },
  explorePill: {
    marginLeft: 'auto',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.84)',
  },
  exploreText: { fontSize: 9, fontWeight: '900', color: '#173f62', letterSpacing: 0.7 },

  brandBoard: {
    position: 'absolute',
    left: 30,
    top: 78,
    width: 270,
    minHeight: 112,
    paddingLeft: 76,
    paddingRight: 16,
    paddingTop: 14,
    borderRadius: 18,
    backgroundColor: '#72451f',
    borderWidth: 4,
    borderColor: '#3f2814',
    shadowColor: '#263726',
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  brandShield: {
    position: 'absolute',
    left: 14,
    top: 14,
    width: 52,
    height: 62,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#164a86',
    borderWidth: 3,
    borderColor: '#e0aa34',
  },
  brandTitle: { color: '#f8d783', fontSize: 31, lineHeight: 32, fontWeight: '950', letterSpacing: 1 },
  brandSubtitle: { color: '#fff0bc', fontSize: 13, fontWeight: '950', letterSpacing: 4 },
  stageRibbon: {
    position: 'absolute',
    left: 64,
    right: 22,
    top: 85,
    paddingVertical: 8,
    paddingHorizontal: 13,
    alignItems: 'center',
    backgroundColor: '#f5e6bd',
    borderWidth: 2,
    borderColor: '#8f6a31',
    borderRadius: 8,
  },
  stageNumber: { color: '#50351b', fontSize: 12, fontWeight: '950' },
  stageTitle: { color: '#46301a', fontSize: 10, fontWeight: '950', letterSpacing: 0.5 },
  stageSubtitle: { color: '#725638', fontSize: 7.5, fontWeight: '800', marginTop: 1 },

  signPost: { position: 'absolute', left: 30, top: 235, width: 150, gap: 5 },
  signBoard: {
    minHeight: 31,
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#80502a',
    borderWidth: 2,
    borderColor: '#4e2d16',
    borderRadius: 5,
    shadowColor: '#2b210d',
    shadowOpacity: 0.16,
    shadowRadius: 4,
  },
  signTiltA: { transform: [{ rotate: '-1.5deg' }] },
  signTiltB: { transform: [{ rotate: '1.5deg' }] },
  signText: { color: '#f6deb2', fontSize: 9, fontWeight: '950', textAlign: 'center', letterSpacing: 0.5 },

  stationWrap: {
    position: 'absolute',
    width: 152,
    zIndex: 20,
    alignItems: 'center',
  },
  stationGlow: {
    position: 'absolute',
    top: 0,
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  stationPressable: { width: 152, alignItems: 'center' },
  stationPressed: { transform: [{ scale: 0.965 }] },
  landmarkOrb: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#6d4a1c',
    shadowColor: '#51330f',
    shadowOpacity: 0.32,
    shadowRadius: 7,
  },
  landmarkInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff8de',
    borderWidth: 2,
  },
  numberBadge: {
    position: 'absolute',
    left: -11,
    top: -10,
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d4c8b',
    borderWidth: 3,
    borderColor: '#f5cf63',
  },
  numberBadgeCleared: { backgroundColor: '#2f7a43' },
  numberText: { color: '#fff', fontSize: 12, fontWeight: '950' },
  clearedBadge: {
    position: 'absolute',
    right: -7,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2e8d4d',
    borderWidth: 2,
    borderColor: '#fff7c7',
  },
  parchmentPlaque: {
    marginTop: -3,
    width: 146,
    minHeight: 72,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 6,
    backgroundColor: '#f5e5b8',
    borderWidth: 2,
    borderColor: '#835b29',
    borderRadius: 9,
    shadowColor: '#48351e',
    shadowOpacity: 0.23,
    shadowRadius: 5,
  },
  stationCharacter: { color: '#3e2b18', fontSize: 13, fontWeight: '950', letterSpacing: 0.2 },
  stationRegion: { width: '100%', color: '#5d452d', fontSize: 8.5, fontWeight: '900', textAlign: 'center' },
  stationGame: { width: '100%', marginTop: 1, color: '#7d6038', fontSize: 7.5, fontWeight: '800', textAlign: 'center' },
  progressRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 2 },
  levelText: { color: '#51432f', fontSize: 6.8, fontWeight: '900' },
  progressDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#8b806a', borderWidth: 0.6, borderColor: '#5d513d' },
  progressDotActive: { backgroundColor: '#d8a92f' },
  progressDotCleared: { backgroundColor: '#f1bd2e', borderColor: '#9c6b16' },

  futureNode: { position: 'absolute', width: 86, height: 86, zIndex: 8, alignItems: 'center', justifyContent: 'center' },
  futureFog: { ...StyleSheet.absoluteFillObject, borderRadius: 43, backgroundColor: 'rgba(230,243,246,0.72)' },
  futureLock: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(221,226,224,0.86)',
    borderWidth: 2,
    borderColor: '#818d90',
  },
  futureTitle: { color: '#59646b', fontSize: 10, fontWeight: '950' },
  futureCopy: { color: '#727d82', fontSize: 5.5, fontWeight: '900', letterSpacing: 0.5 },

  decorativeLabel: {
    position: 'absolute',
    zIndex: 9,
    minHeight: 34,
    minWidth: 128,
    paddingHorizontal: 10,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f3e5b9',
    borderWidth: 2,
    borderColor: '#8b6734',
  },
  decorativeLabelText: { color: '#513c24', fontSize: 8.5, fontWeight: '950' },
  decorativeLabelLocked: { color: '#687074' },

  harborDecor: { position: 'absolute', left: 62, bottom: 42, zIndex: 5, alignItems: 'center' },
  centralTree: { position: 'absolute', left: 520, top: 445, zIndex: 5, alignItems: 'center' },
  treeCanopy: { width: 104, height: 82, borderRadius: 52, backgroundColor: '#4f9c45', borderWidth: 6, borderColor: '#36743d' },
  treeTrunk: { width: 18, height: 38, marginTop: -8, backgroundColor: '#754c2c', borderRadius: 8 },
  smallPlaque: { marginTop: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5, backgroundColor: '#f4e4b8', borderWidth: 1.5, borderColor: '#806037' },
  smallPlaqueText: { color: '#4d3820', fontSize: 7.5, fontWeight: '950' },

  castleDecor: { position: 'absolute', right: 62, top: 74, zIndex: 6, alignItems: 'center' },
  castlePlaque: { marginTop: -6, minWidth: 150, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, alignItems: 'center', backgroundColor: '#f5e5b9', borderWidth: 2, borderColor: '#8b6531' },
  castleTitle: { color: '#4d361d', fontSize: 9.5, fontWeight: '950' },
  castleCopy: { color: '#6b5336', fontSize: 6.8, fontWeight: '800' },

  compass: { position: 'absolute', left: 40, bottom: 34, width: 58, height: 66, alignItems: 'center', justifyContent: 'center', opacity: 0.88 },
  compassN: { color: '#315673', fontSize: 8, fontWeight: '900', marginBottom: -2 },
  mottoScroll: { position: 'absolute', right: 28, bottom: 24, width: 210, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 8, backgroundColor: '#e8cc91', borderWidth: 2, borderColor: '#8a6436', transform: [{ rotate: '-1deg' }] },
  motto: { color: '#5c4429', fontSize: 8, fontWeight: '900', textAlign: 'center', letterSpacing: 0.6 },
  mottoStrong: { marginTop: 3, color: '#4a351f', fontSize: 7.6, fontWeight: '950', textAlign: 'center' },
});
