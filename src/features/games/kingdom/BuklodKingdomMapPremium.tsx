import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle as SvgCircle, Defs, Ellipse, G,
  LinearGradient as SvgGradient, Path, Rect, Stop,
} from 'react-native-svg';
import { useAuth } from '@/providers/AuthProvider';
import { playRorkSignatureSfx } from '@/features/games/runtime/rorkAudio';
import { playBuklodGameFeedback } from '@/features/games/runtime/BuklodGameFeedback';
import { getBuklodSoundSettings } from '@/lib/buklodSounds';
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

const BIOME_REGIONS = [
  { gameId: 'phan-enterprise-builder', label: 'TIDEWHISPER COAST', left: 18, top: 520, width: 310, height: 270, tint: 'rgba(18,104,139,0.20)', rotate: '-2deg' },
  { gameId: 'jawo-forest-trail', label: 'WHISPERING FOREST', left: 52, top: 250, width: 330, height: 300, tint: 'rgba(25,89,55,0.26)', rotate: '1deg' },
  { gameId: 'vhen-farm-to-market', label: 'HARVEST VALLEY', left: 270, top: 510, width: 360, height: 280, tint: 'rgba(115,119,35,0.18)', rotate: '-1deg' },
  { gameId: 'christian-civic-leadership', label: 'COVENANT HEIGHTS', left: 405, top: 105, width: 365, height: 275, tint: 'rgba(32,65,104,0.20)', rotate: '1.5deg' },
  { gameId: 'lhen-rhythm-journey', label: 'RESONANCE CITY', left: 730, top: 165, width: 360, height: 275, tint: 'rgba(90,45,115,0.22)', rotate: '-1.5deg' },
  { gameId: 'niel-mission-trail', label: 'MISSION FRONTIER', left: 610, top: 500, width: 355, height: 285, tint: 'rgba(47,75,75,0.22)', rotate: '1deg' },
  { gameId: 'angel-kingdom-treasury', label: 'TREASURY QUARTER', left: 830, top: 470, width: 300, height: 250, tint: 'rgba(120,82,28,0.20)', rotate: '-1deg' },
  { gameId: 'quin-discovery-expedition', label: 'SUNSPIRE RUINS', left: 920, top: 40, width: 250, height: 230, tint: 'rgba(128,72,28,0.18)', rotate: '2deg' },
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


/**
 * Premium R6 map within src/app/games/index.tsx of the original BUKLOD App.
 * Original 13 station coordinates and routes are inherited unchanged from R5.
 * Legacy BuklodKingdomMap.tsx is retained for safe rollback. No app split.
 */
type MapMode = 'detail' | 'fit';
const LAND_DEEP = 'M 64 670 C 25 556 46 378 159 270 C 263 155 397 165 485 120 C 590 63 719 77 822 140 C 923 198 1020 176 1117 244 C 1191 303 1173 456 1135 532 C 1109 623 1170 713 1062 790 C 943 848 786 802 678 851 C 548 896 423 838 327 823 C 223 804 102 812 64 670 Z';
const LAND_FACE = 'M 88 654 C 51 532 82 379 169 290 C 261 192 395 195 493 145 C 592 92 713 111 811 166 C 909 222 1014 201 1094 263 C 1160 308 1142 439 1118 515 C 1086 610 1136 694 1041 746 C 929 808 789 767 679 809 C 560 850 442 805 336 784 C 232 759 126 781 88 654 Z';
const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));

function IllustratedRealm({ mapWidth, mapHeight, stage }: { mapWidth: number; mapHeight: number; stage: number }) {
  return (
    <Svg width={mapWidth} height={mapHeight} viewBox="0 0 1200 900" pointerEvents="none">
      <Defs>
        <SvgGradient id="sea" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#164563" />
          <Stop offset=".5" stopColor="#1b6077" />
          <Stop offset="1" stopColor="#0c2945" />
        </SvgGradient>
        <SvgGradient id="cliff" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#92b1a0" />
          <Stop offset=".6" stopColor="#436f78" />
          <Stop offset="1" stopColor="#173c58" />
        </SvgGradient>
        <SvgGradient id="meadow" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#b9d18f" />
          <Stop offset=".34" stopColor="#80af79" />
          <Stop offset=".68" stopColor="#548975" />
          <Stop offset="1" stopColor="#396f6c" />
        </SvgGradient>
        <SvgGradient id="river" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#bbf7ef" />
          <Stop offset=".45" stopColor="#5bcbd0" />
          <Stop offset="1" stopColor="#318da6" />
        </SvgGradient>
        <SvgGradient id="road" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fff0cd" />
          <Stop offset="1" stopColor="#cbb38e" />
        </SvgGradient>
        <SvgGradient id="peak" x1="0" y1="0" x2=".7" y2="1">
          <Stop offset="0" stopColor="#f2e9d0" />
          <Stop offset=".52" stopColor="#94a4a7" />
          <Stop offset="1" stopColor="#4f6f83" />
        </SvgGradient>
        <SvgGradient id="castle" x1="0" y1="0" x2=".8" y2="1">
          <Stop offset="0" stopColor="#fff7d9" />
          <Stop offset=".5" stopColor="#e0bc79" />
          <Stop offset="1" stopColor="#a97b50" />
        </SvgGradient>
      </Defs>
      <Rect width={1200} height={900} fill="url(#sea)" />
      {Array.from({ length: 18 }, (_, i) => (
        <Path key={i} fill="none" stroke="#bde9eb" strokeWidth={2} opacity=".22"
          d={'M ' + (20 + (i * 163) % 1150) + ' ' + (24 + (i * 91) % 855) + ' c 16 -6 31 -7 48 0 c 11 5 20 4 30 -1'} />
      ))}
      <Path d={LAND_DEEP} fill="#103d55" stroke="#78ccd0" strokeWidth={21} opacity=".52" />
      <Path d={LAND_DEEP} fill="url(#cliff)" stroke="#1b5367" strokeWidth={10} />
      <Path d={LAND_FACE} fill="url(#meadow)" stroke="#f0e6c2" strokeWidth={10} />
      <Path d={LAND_FACE} fill="none" stroke="#fff8dd" strokeWidth={2} opacity=".6" />
      <Path d="M 109 432 C 201 260 315 238 466 219 C 410 315 345 395 240 424 C 167 476 146 510 99 590 Z"
        fill="#275e57" opacity=".47" />
      <Path d="M 361 210 C 445 147 604 115 727 180 C 636 250 625 317 492 306 C 448 286 409 251 361 210 Z"
        fill="#a9c697" opacity=".50" />
      <Path d="M 778 229 C 921 190 1033 259 1101 350 C 1071 422 977 460 842 426 C 781 344 775 301 778 229 Z"
        fill="#a5baa3" opacity=".49" />
      <Path d="M 172 628 C 304 559 437 570 532 624 C 557 697 493 792 345 775 C 233 749 141 698 172 628 Z"
        fill="#dbcd81" opacity=".40" />

      {BIOME_REGIONS.map(region => (
        <Ellipse key={region.gameId}
          cx={region.left + region.width / 2} cy={region.top + region.height / 2}
          rx={region.width * .42} ry={region.height * .35}
          fill={region.tint} opacity=".44" />
      ))}

      <Path d="M 552 147 C 582 234 588 290 628 357 C 651 420 662 464 699 515 C 744 597 735 682 772 766"
        fill="none" stroke="#236079" strokeWidth={30} opacity=".55" strokeLinecap="round" />
      <Path d="M 552 147 C 582 234 588 290 628 357 C 651 420 662 464 699 515 C 744 597 735 682 772 766"
        fill="none" stroke="url(#river)" strokeWidth={18} strokeLinecap="round" />
      <Path d="M 552 147 C 582 234 588 290 628 357 C 651 420 662 464 699 515 C 744 597 735 682 772 766"
        fill="none" stroke="#e9ffff" strokeWidth={3} opacity=".6" strokeLinecap="round" />
      <Path d="M 842 211 C 829 322 852 380 811 462 C 784 531 794 627 834 706"
        fill="none" stroke="url(#river)" strokeWidth={17} strokeLinecap="round" />

      {JOURNEY_PATH.map((route, i) => (
        <G key={i}>
          <Path d={route} fill="none" stroke="#314c4a" strokeWidth={20} strokeLinecap="round" opacity=".40" />
          <Path d={route} fill="none" stroke="#b39a73" strokeWidth={13} strokeLinecap="round" />
          <Path d={route} fill="none" stroke="url(#road)" strokeWidth={8} strokeLinecap="round" />
          <Path d={route} fill="none" stroke="#fff9e3" strokeWidth={1.5} strokeLinecap="round"
            strokeDasharray="2 16" opacity=".56" />
        </G>
      ))}

      {Array.from({ length: 6 }, (_, i) => (
        <G key={'farm-' + i} transform={'rotate(-14 ' + (214 + i * 21) + ' ' + (681 + i * 7) + ')'}>
          <Rect x={164 + i * 26} y={647 + i * 11} width={28} height={86} rx={7}
            fill={i % 2 ? "#bfd17d" : "#dfc57c"} stroke="#839567" strokeWidth={2} opacity=".90" />
          {Array.from({ length: 4 }, (_, j) => (
            <Path key={j} d={'M ' + (168 + i * 26) + ' ' + (664 + i * 11 + j * 16) + ' h 21'}
              stroke="#719359" strokeWidth={2} opacity=".68" />
          ))}
        </G>
      ))}

      {MOUNTAINS.map(({ x, y, s }, i) => (
        <G key={'mountain-' + i}>
          <Path d={'M ' + (x - 56 * s) + ' ' + (y + 81 * s) +
            ' L ' + (x + 2 * s) + ' ' + (y + 3 * s) +
            ' L ' + (x + 57 * s) + ' ' + (y + 81 * s) + ' Z'}
            fill="url(#peak)" stroke="#667e87" strokeWidth={1.5} />
          <Path d={'M ' + (x - 19 * s) + ' ' + (y + 34 * s) +
            ' L ' + (x + 2 * s) + ' ' + (y + 3 * s) +
            ' L ' + (x + 22 * s) + ' ' + (y + 33 * s) +
            ' L ' + (x + 8 * s) + ' ' + (y + 28 * s) +
            ' L ' + x + ' ' + (y + 38 * s) + ' Z'}
            fill="#f7f4e3" opacity=".91" />
        </G>
      ))}

      {FOREST_POINTS.map(([x, y], i) => (
        <G key={'tree-' + i}>
          <Ellipse cx={x} cy={y + 21} rx={18} ry={7} fill="#15434d" opacity=".28" />
          <Path d={'M ' + (x - 14) + ' ' + (y + 5) + ' L ' + x + ' ' + (y - 26) +
            ' L ' + (x + 14) + ' ' + (y + 5) + ' Z'}
            fill={i % 2 ? "#245a53" : "#236d5b"} />
          <Path d={'M ' + (x - 20) + ' ' + (y + 16) + ' L ' + x + ' ' + (y - 8) +
            ' L ' + (x + 20) + ' ' + (y + 16) + ' Z'}
            fill={i % 3 ? "#388b6b" : "#2f745c"} />
          <Rect x={x - 2} y={y + 15} width={5} height={11} rx={2} fill="#796a50" />
        </G>
      ))}

      {[
        { x: 820, y: 265, color: '#e1d2b5' },
        { x: 968, y: 358, color: '#d1bdd4' },
        { x: 908, y: 626, color: '#dbc195' },
        { x: 488, y: 533, color: '#debbb2' },
      ].map((town, i) => (
        <G key={'town-' + i}>
          <Ellipse cx={town.x} cy={town.y + 15} rx={72} ry={33} fill="#255465" opacity=".21" />
          {Array.from({ length: 5 }, (_, j) => {
            const x = town.x - 53 + j * 25;
            const y = town.y - (j % 2) * 8;
            return <G key={j}>
              <Rect x={x} y={y - 37} width={17} height={38} rx={2}
                fill={town.color} stroke="#718179" strokeWidth={2} />
              <Path d={'M ' + (x - 3) + ' ' + (y - 38) + ' L ' + (x + 8) + ' ' + (y - 57) +
                ' L ' + (x + 20) + ' ' + (y - 38) + ' Z'}
                fill="#587589" />
              <Rect x={x + 6} y={y - 13} width={5} height={6} rx={1} fill="#fff4c5" />
            </G>;
          })}
        </G>
      ))}

      <Ellipse cx={607} cy={469} rx={123} ry={65} fill="#204c58" opacity=".34" />
      <Ellipse cx={607} cy={442} rx={113} ry={65} fill="#e5d2a5" stroke="#73948a" strokeWidth={6} />
      <Ellipse cx={607} cy={436} rx={100} ry={52} fill="#70a599" stroke="#ece8bb" strokeWidth={3} />
      <Path d="M 529 466 L 540 398 L 551 398 L 559 350 L 574 350 L 581 398 L 599 377 L 611 318 L 625 377 L 639 401 L 651 352 L 667 352 L 677 398 L 688 398 L 696 466 Z"
        fill="url(#castle)" stroke="#9b7548" strokeWidth={3} />
      <Path d="M 596 381 L 612 292 L 626 381 Z" fill="#fff4d1" stroke="#b39055" strokeWidth={2} />
      <Path d="M 552 357 L 562 324 L 575 357 Z M 651 356 L 659 324 L 672 356 Z"
        fill="#f9edc6" stroke="#af8555" strokeWidth={1.5} />
      <Rect x={599} y={419} width={25} height={47} rx={12} fill="#285564" stroke="#fff5c7" strokeWidth={3} />
      <SvgCircle cx={612} cy={386} r={6} fill={stage >= 3 ? '#fff9bf' : '#eecf92'} />
      <Path d="M 582 468 Q 609 485 640 468" fill="none" stroke="#fcf1cf" strokeWidth={4} />
      <Ellipse cx={609} cy={509} rx={75} ry={10} fill="#9ad7cb" opacity=".58" />

      <Ellipse cx={591} cy={642} rx={59} ry={36} fill="#4b9471" stroke="#b9c599" strokeWidth={3} />
      <Rect x={585} y={628} width={12} height={44} rx={4} fill="#806747" />
      <SvgCircle cx={591} cy={620} r={27} fill="#398766" />
      <SvgCircle cx={575} cy={629} r={22} fill="#4d9e73" />
      <SvgCircle cx={610} cy={623} r={22} fill="#6aae79" />

      <Path d={LAND_FACE} fill="none" stroke="#faf2d6" strokeWidth={2} opacity=".42" />
    </Svg>
  );
}

function KingdomStation({
  station, index, scale, compact, selected, cleared, onEnter, onFocus,
}: {
  station: Station; index: number; scale: number;
  compact: boolean; selected: boolean; cleared: boolean;
  onEnter: (station: Station) => void;
  onFocus: (station: Station) => void;
}) {
  const diameter = compact ? 43 : 68;
  const w = compact ? 48 : 121;
  return (
    <View style={[
      styles.stationAnchor, {
        width: w, left: station.x * scale - w / 2,
        top: station.y * scale - (compact ? 22 : 40),
        zIndex: selected ? 22 : 10,
      },
    ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={'Enter ' + station.character + ' Game Center'}
        accessibilityHint="Opens the character games inside BUKLOD"
        onPress={() => onEnter(station)}
        onLongPress={() => onFocus(station)}
        hitSlop={compact ? 3 : 6}
        style={({ pressed }) => [styles.stationPress, pressed && styles.stationPressed]}
      >
        <View style={[
          styles.beacon, { width: diameter, height: diameter, borderRadius: diameter / 2 },
          { borderColor: selected ? '#ffedab' : station.accent },
          selected && styles.beaconSelected,
        ]}>
          <LinearGradient
            colors={selected ? ['#fff7cd', '#d6aa5f'] : ['#fff9ed', '#e0d2b5', '#adbcb2']}
            style={[styles.beaconFill, { borderRadius: diameter / 2 }]}
          >
            <MaterialCommunityIcons
              name={station.icon} size={compact ? 20 : 26} color="#27495a" />
          </LinearGradient>
          {!compact && <View style={styles.stationNumber}><Text style={styles.stationNumberText}>{index + 1}</Text></View>}
          {cleared && <View style={styles.stationCleared}>
            <MaterialCommunityIcons name="check-bold" size={11} color="#fff" />
          </View>}
        </View>
        {!compact && <View style={[styles.stationPlaque, selected && styles.stationPlaqueSelected]}>
          <Text style={styles.stationName} numberOfLines={1}>{station.character}</Text>
          <Text style={styles.stationZone} numberOfLines={1}>{station.region}</Text>
        </View>}
      </Pressable>
    </View>
  );
}

export default function BuklodKingdomMapPremium() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState<BuklodKingdomPreviewProgress>(emptyProgress());
  const [selectedId, setSelectedId] = useState('christian-civic-leadership');
  const [mode, setMode] = useState<'detail' | 'fit'>('detail');
  const [viewportHeight, setViewportHeight] = useState(550);
  const horizontalRef = useRef<ScrollView>(null);
  const verticalRef = useRef<ScrollView>(null);
  const initialFocusRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    // A shared device must never show the previous BUKLOD account's game clears.
    setProgress(emptyProgress());
    const unsubscribe = subscribeBuklodKingdomPreviewProgress(userId, value => {
      if (mounted) setProgress(value);
    });
    loadBuklodKingdomPreviewProgress(userId)
      .then(value => { if (mounted) setProgress(value); })
      .catch(() => { if (mounted) setProgress(emptyProgress()); });
    return () => { mounted = false; unsubscribe(); };
  }, [userId]);

  const clearedCount = useMemo(
    () => STATIONS.filter(station => (progress.stations[station.id]?.clears ?? 0) > 0).length,
    [progress],
  );
  const stage = stageFor(clearedCount);
  const stageCopy = STAGE_COPY[stage];
  const selectedStation = STATIONS.find(station => station.id === selectedId) ?? STATIONS[5];

  const scale = mode === 'fit'
    ? clamp((screenWidth - 20) / WORLD_W, .32, 1)
    : screenWidth < 650 ? .86 : screenWidth < 1100 ? 1 : 1.06;
  const mapWidth = WORLD_W * scale;
  const mapHeight = WORLD_H * scale;
  const compact = mode === 'fit';

  const focus = useCallback((station: Station, animated = true) => {
    const currentScale = mode === 'fit'
      ? clamp((screenWidth - 20) / WORLD_W, .32, 1)
      : screenWidth < 650 ? .86 : screenWidth < 1100 ? 1 : 1.06;
    horizontalRef.current?.scrollTo({
      x: clamp(station.x * currentScale - screenWidth / 2, 0,
        Math.max(0, WORLD_W * currentScale - screenWidth)),
      animated,
    });
    verticalRef.current?.scrollTo({
      y: clamp(station.y * currentScale - viewportHeight * .48, 0,
        Math.max(0, WORLD_H * currentScale - viewportHeight)),
      animated,
    });
  }, [mode, screenWidth, viewportHeight]);

  useEffect(()=>{void getBuklodSoundSettings();},[]);

  const chooseStation = useCallback((station: Station) => {
    void playBuklodGameFeedback('move');
    setSelectedId(station.id);
    focus(station);
  }, [focus]);

  const enterStation = useCallback((station: Station) => {
    setSelectedId(station.id);
    if (!playRorkSignatureSfx(station.id, .20)) void playBuklodGameFeedback('unlock');
    router.push(station.href as any);
  }, []);

  const initialFocus = useCallback(() => {
    if (initialFocusRef.current) return;
    initialFocusRef.current = true;
    focus(STATIONS[5], false);
  }, [focus]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0d2d43', '#103b4b', '#081e30']} style={StyleSheet.absoluteFill} />

      <ScrollView
        ref={horizontalRef} horizontal bounces={false} showsHorizontalScrollIndicator={false}
        style={styles.mapScroll} contentContainerStyle={[styles.horizontalContent, { minWidth: screenWidth }]}
        onContentSizeChange={initialFocus}
      >
        <ScrollView
          ref={verticalRef} bounces={false} nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={[styles.verticalScroll, { width: Math.max(screenWidth, mapWidth) }]}
          contentContainerStyle={[styles.verticalContent, { minHeight: mapHeight }]}
          onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}
        >
          <View style={[styles.worldFrame, { width: mapWidth, height: mapHeight }]}>
            <IllustratedRealm mapWidth={mapWidth} mapHeight={mapHeight} stage={stage} />

            <View pointerEvents="none" style={[styles.realmTitle, {
              left: 68 * scale, top: 88 * scale,
            }]}>
              <Text style={styles.realmTitleSmall}>BUKLOD • A LIVING WORLD</Text>
              <Text style={styles.realmTitleMain}>EXPLORE • GROW • BELONG</Text>
            </View>

            <View pointerEvents="none" style={[styles.citadelSign, {
              left: 607 * scale - (compact ? 38 : 84), top: 517 * scale,
              width: compact ? 76 : 168,
            }]}>
              <Text style={[styles.citadelText, compact && styles.citadelCompact]}>BUKLOD CITADEL</Text>
              {!compact && <Text style={styles.citadelSub}>HEART OF THE KINGDOM</Text>}
            </View>
            {!compact && <View pointerEvents="none" style={[styles.scriptureSign, {
              left: 520 * scale, top: 693 * scale,
            }]}>
              <Text style={styles.scriptureText}>SCRIPTURE GARDEN</Text>
            </View>}

            {STATIONS.map((station, index) => (
              <KingdomStation
                key={station.id} station={station} index={index}
                scale={scale} compact={compact}
                selected={station.id === selectedId}
                cleared={(progress.stations[station.id]?.clears ?? 0) > 0}
                onEnter={enterStation} onFocus={chooseStation}
              />
            ))}
            {FUTURE.map((spot, index) => (
              <View key={'future-' + index} pointerEvents="none"
                style={[styles.futureMarker, {
                  left: spot.x * scale - 22, top: spot.y * scale - 19,
                }]}>
                <MaterialCommunityIcons name="map-marker-question-outline"
                  size={compact ? 18 : 22} color="#d1ded7" />
                {!compact && <Text style={styles.futureText}>COMING SOON</Text>}
              </View>
            ))}
            <View pointerEvents="none" style={[styles.compass, {
              right: 28 * scale, bottom: 27 * scale,
            }]}>
              <Text style={styles.compassN}>N</Text>
              <MaterialCommunityIcons name="compass-outline"
                size={compact ? 22 : 41} color="#eae0c4" />
            </View>
          </View>
        </ScrollView>
      </ScrollView>

      <View style={[styles.header, { paddingTop: Math.max(8, insets.top) + 7 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to BUKLOD App"
          onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={21} color="#ffedbf" />
        </Pressable>
        <View style={styles.headerTitleBox}>
          <MaterialCommunityIcons name="castle" size={29} color="#f2d18c" />
          <View style={styles.headerText}>
            <Text style={styles.headerEyebrow}>INSIDE THE BUKLOD APP</Text>
            <Text style={styles.headerTitle}>BUKLOD KINGDOM</Text>
            <Text style={styles.headerMeta}>{clearedCount}/13 LOCAL CLEARS • STAGE {stage}</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button"
          accessibilityLabel={compact ? 'Detailed kingdom map' : 'Fit kingdom map'}
          onPress={() => {
            initialFocusRef.current = false;
            setMode(current => current === 'detail' ? 'fit' : 'detail');
          }}
          style={styles.fitButton}>
          <MaterialCommunityIcons name={compact ? 'magnify-plus-outline' : 'fit-to-screen-outline'}
            size={20} color="#fbeac2" />
          <Text style={styles.fitLabel}>{compact ? 'DETAIL' : 'FIT'}</Text>
        </Pressable>
      </View>

      <View style={[styles.bottomPanel, { bottom: Math.max(insets.bottom + 7, 8) }]}>
        <View style={styles.selectedRow}>
          <View style={styles.selectedIcon}>
            <MaterialCommunityIcons name={selectedStation.icon} size={24} color="#ffe1a2" />
          </View>
          <View style={styles.selectedDetails}>
            <Text style={styles.selectedEyebrow}>{stageCopy.title}</Text>
            <Text style={styles.selectedName}>{selectedStation.character}</Text>
            <Text numberOfLines={1} style={styles.selectedSubtitle}>{selectedStation.region} • {selectedStation.game}</Text>
          </View>
          <Pressable accessibilityRole="button"
            accessibilityLabel={'Enter ' + selectedStation.character + ' games'}
            onPress={() => enterStation(selectedStation)} style={styles.enter}>
            <Text style={styles.enterText}>ENTER</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#283e47" />
          </Pressable>
        </View>
        <View style={styles.railTitleRow}>
          <Text style={styles.railTitle}>EXPLORE THE KINGDOM</Text>
          <Text style={styles.railHelp}>SWIPE • FIND • ENTER</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}>
          {STATIONS.map(station => (
            <Pressable key={station.id} accessibilityRole="button"
              accessibilityLabel={'Find ' + station.character + ' on the map'}
              onPress={() => chooseStation(station)}
              style={[styles.chip, selectedId === station.id && styles.chipActive]}>
              <MaterialCommunityIcons name={station.icon} size={15}
                color={selectedId === station.id ? '#59432b' : '#d5e3e9'} />
              <Text style={[styles.chipText, selectedId === station.id && styles.chipTextActive]}>
                {station.character}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b293a' },
  mapScroll: { flex: 1 },
  verticalScroll: { flex: 1 },
  horizontalContent: { justifyContent: 'center' },
  verticalContent: { alignItems: 'center', justifyContent: 'center' },
  worldFrame: { position: 'relative', overflow: 'hidden', backgroundColor: '#154c5d' },
  stationAnchor: { position: 'absolute', alignItems: 'center' },
  stationPress: { width: '100%', alignItems: 'center' },
  stationPressed: { transform: [{ scale: .95 }] },
  beacon: {
    backgroundColor: '#1b3b4f', borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#071724', shadowOpacity: .42, shadowRadius: 10, elevation: 6,
  },
  beaconSelected: { shadowColor: '#f3dfa0', shadowOpacity: .67, shadowRadius: 13, elevation: 10 },
  beaconFill: {
    width: '100%', height: '100%',
    borderWidth: 2, borderColor: '#fff9e0',
    justifyContent: 'center', alignItems: 'center',
  },
  stationNumber: {
    position: 'absolute', top: -9, left: -11,
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderColor: '#f8e0a7',
    backgroundColor: '#284358', alignItems: 'center', justifyContent: 'center',
  },
  stationNumberText: { color: '#fff0c9', fontWeight: '900', fontSize: 11 },
  stationCleared: {
    position: 'absolute', bottom: -5, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#327c68', borderWidth: 2, borderColor: '#f4f2c8',
    alignItems: 'center', justifyContent: 'center',
  },
  stationPlaque: {
    marginTop: 3, width: 118, borderWidth: 1, borderColor: '#c2ad83',
    backgroundColor: 'rgba(13,37,52,.93)',
    paddingHorizontal: 6, paddingVertical: 6, borderRadius: 9,
    alignItems: 'center', shadowColor: '#07111b', shadowOpacity: .3, shadowRadius: 8,
  },
  stationPlaqueSelected: { borderColor: '#fff0b7', borderWidth: 1.5, backgroundColor: '#263b4e' },
  stationName: { color: '#fff1ce', fontSize: 12, fontWeight: '900' },
  stationZone: { color: '#cddbdc', fontSize: 8, fontWeight: '800' },
  futureMarker: {
    position: 'absolute', width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(29,58,65,.58)',
    borderWidth: 1, borderColor: '#d6d9be',
    alignItems: 'center', justifyContent: 'center',
  },
  futureText: { fontSize: 6, color: '#f5edcd', fontWeight: '900' },
  compass: { position: 'absolute', alignItems: 'center', opacity: .90 },
  compassN: { color: '#f9ecc4', fontSize: 11, fontWeight: '900' },
  realmTitle: {
    position: 'absolute', backgroundColor: 'rgba(16,50,61,.58)',
    borderLeftWidth: 3, borderLeftColor: '#f0cf7c', paddingVertical: 8, paddingHorizontal: 13,
  },
  realmTitleSmall: { color: '#e7e3c6', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  realmTitleMain: { color: '#fff3d4', fontSize: 14, fontWeight: '900', letterSpacing: .7, marginTop: 4 },
  citadelSign: {
    position: 'absolute', alignItems: 'center', padding: 6,
    borderRadius: 8, borderWidth: 1, borderColor: '#f3db9c',
    backgroundColor: 'rgba(23,48,55,.90)',
  },
  citadelText: { fontSize: 12, color: '#fff0b8', fontWeight: '900', letterSpacing: .7 },
  citadelCompact: { fontSize: 7, letterSpacing: 0 },
  citadelSub: { color: '#d9efe1', fontSize: 7, fontWeight: '900', marginTop: 3 },
  scriptureSign: { position: 'absolute' },
  scriptureText: { color: '#f0f3d5', fontSize: 9, letterSpacing: 1, fontWeight: '900' },

  header: {
    position: 'absolute', zIndex: 80, top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 71,
    paddingHorizontal: 11, paddingBottom: 9,
    borderBottomWidth: 1, borderBottomColor: '#8c835f',
    backgroundColor: 'rgba(7,26,42,.95)',
  },
  back: {
    width: 41, height: 41, borderRadius: 12, borderWidth: 1,
    borderColor: '#aa9167', backgroundColor: '#263f54',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitleBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { flexShrink: 1 },
  headerEyebrow: { color: '#b2c6c9', fontSize: 8, fontWeight: '900', letterSpacing: .9 },
  headerTitle: { color: '#ffe8b1', fontWeight: '900', fontSize: 17, letterSpacing: .3 },
  headerMeta: { fontSize: 9, color: '#dbc6a3', fontWeight: '800' },
  fitButton: {
    width: 54, height: 43, borderWidth: 1, borderRadius: 12,
    borderColor: '#af9874', backgroundColor: '#254456',
    alignItems: 'center', justifyContent: 'center',
  },
  fitLabel: { color: '#ffedc5', fontSize: 8, fontWeight: '900' },

  bottomPanel: {
    position: 'absolute', zIndex: 80, left: 8, right: 8,
    borderWidth: 1, borderColor: '#c0a977',
    borderRadius: 17, paddingTop: 9, paddingBottom: 11, gap: 7,
    backgroundColor: 'rgba(8,28,43,.96)',
    shadowColor: '#07141e', shadowOpacity: .48, shadowRadius: 12,
    elevation: 12,
  },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10 },
  selectedIcon: {
    width: 43, height: 43, backgroundColor: '#29475b',
    borderWidth: 1, borderColor: '#d4b578', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  selectedDetails: { flex: 1, minWidth: 0 },
  selectedEyebrow: { color: '#bad0d2', fontSize: 8, fontWeight: '900' },
  selectedName: { fontSize: 18, color: '#fff3cf', fontWeight: '900', marginTop: 1 },
  selectedSubtitle: { color: '#d6dfd9', fontSize: 10, fontWeight: '700' },
  enter: {
    minWidth: 83, height: 43, borderRadius: 11,
    backgroundColor: '#eed093', paddingHorizontal: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  enterText: { color: '#283e47', fontSize: 12, fontWeight: '900' },
  railTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, paddingHorizontal: 12 },
  railTitle: { color: '#f1d597', fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  railHelp: { color: '#b7cbce', fontSize: 8, fontWeight: '800' },
  rail: { paddingHorizontal: 10, paddingBottom: 2, gap: 6 },
  chip: {
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#60808a', backgroundColor: '#253f55',
  },
  chipActive: { backgroundColor: '#f2d69f', borderColor: '#fff0ca' },
  chipText: { color: '#dce9eb', fontSize: 10.5, fontWeight: '900' },
  chipTextActive: { color: '#4d3d27' },
});
