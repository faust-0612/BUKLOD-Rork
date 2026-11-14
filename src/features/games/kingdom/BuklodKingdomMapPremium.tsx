import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle as SvgCircle, Defs, Ellipse, G,
  LinearGradient as SvgGradient, Path, Rect, Stop,
} from 'react-native-svg';
import { useAuth } from '@/providers/AuthProvider';
import { useRorkGameAmbience } from '@/features/games/runtime/rorkAudio';
import { getRorkGameMedia } from '@/features/games/runtime/rorkMedia';
import BuklodKingdomLivingFX from './BuklodKingdomLivingFX';
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
          <Stop offset="0" stopColor="#4ed8dd" />
          <Stop offset=".33" stopColor="#087ea7" />
          <Stop offset=".68" stopColor="#093b71" />
          <Stop offset="1" stopColor="#071a45" />
        </SvgGradient>
        <SvgGradient id="aurora" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#bdf8da" stopOpacity=".63" />
          <Stop offset=".42" stopColor="#67ddde" stopOpacity=".17" />
          <Stop offset="1" stopColor="#4a72da" stopOpacity="0" />
        </SvgGradient>
        <SvgGradient id="highland" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#f9ecc7" />
          <Stop offset=".48" stopColor="#b4d7c1" />
          <Stop offset="1" stopColor="#467e8e" />
        </SvgGradient>
        <SvgGradient id="cliff" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#a9cfb5" />
          <Stop offset=".6" stopColor="#477f84" />
          <Stop offset="1" stopColor="#1d4269" />
        </SvgGradient>
        <SvgGradient id="meadow" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#d5e8a1" />
          <Stop offset=".34" stopColor="#69bb7c" />
          <Stop offset=".68" stopColor="#328961" />
          <Stop offset="1" stopColor="#1c6159" />
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
          <Stop offset="0" stopColor="#fff4ce" />
          <Stop offset=".5" stopColor="#f1c66b" />
          <Stop offset="1" stopColor="#865b38" />
        </SvgGradient>
      </Defs>
      <Rect width={1200} height={900} fill="url(#sea)" />
      {/* Static layered fantasy realm, fully offline and low-memory. */}
      <Ellipse cx={184} cy={180} rx={450} ry={330} fill="url(#aurora)" opacity=".74" />
      <Ellipse cx={1090} cy={750} rx={420} ry={310} fill="#5e89d4" opacity=".12" />
      <Path d="M 0 420 C 170 365 280 426 413 368 S 735 341 891 402 S 1069 405 1200 345"
        fill="none" stroke="#b3f6ed" strokeWidth={12} opacity=".12" />
      {/* The outer ocean, with lighter shallows around the island. */}
      <Ellipse cx={620} cy={480} rx={595} ry={396} fill="#b8f3ef" opacity=".13" />
      <Path d="M 17 142 C 187 89 282 105 405 65 M 769 72 C 946 49 1037 123 1160 82 M 56 826 C 183 794 299 856 407 828"
        fill="none" stroke="#e5fcf3" strokeWidth={5} strokeLinecap="round" opacity=".27" />
      {Array.from({ length: 18 }, (_, i) => (
        <Path key={i} fill="none" stroke="#bde9eb" strokeWidth={2} opacity=".22"
          d={'M ' + (20 + (i * 163) % 1150) + ' ' + (24 + (i * 91) % 855) + ' c 16 -6 31 -7 48 0 c 11 5 20 4 30 -1'} />
      ))}
      <Path d={LAND_DEEP} fill="#14718d" stroke="#c5f2e3" strokeWidth={21} opacity=".52" />
      <Path d={LAND_DEEP} fill="url(#cliff)" stroke="#2a8098" strokeWidth={10} />
      {/* Sunlit sand along the older island coast, rather than a dark flat outline. */}
      <Path d={LAND_DEEP} fill="none" stroke="#f8e6b4" strokeWidth={6} opacity=".70" />
      <Path d="M 118 726 C 204 794 332 819 456 823 M 872 794 C 963 820 1053 793 1104 724"
        fill="none" stroke="#fff2bf" strokeWidth={5} opacity=".63" />
      <Path d={LAND_FACE} fill="url(#meadow)" stroke="#f6e9ba" strokeWidth={10} />
      <Path d="M 174 373 C 263 247 382 245 475 213 C 558 175 660 155 772 222 M 198 438 C 295 324 418 328 530 283 C 661 225 739 264 856 263 M 244 518 C 326 417 443 406 557 380"
        stroke="#f4ffe0" strokeWidth={6} strokeLinecap="round" opacity=".18" fill="none" />
      <Path d="M 398 182 C 480 117 586 123 675 160 C 660 211 583 253 512 247 C 463 231 426 217 398 182 Z"
        fill="url(#highland)" opacity=".46" />
      <Path d={LAND_FACE} fill="none" stroke="#fff8dd" strokeWidth={2} opacity=".6" />
      <Path d="M 109 432 C 201 260 315 238 466 219 C 410 315 345 395 240 424 C 167 476 146 510 99 590 Z"
        fill="#6d9e6f" opacity=".47" />
      <Path d="M 361 210 C 445 147 604 115 727 180 C 636 250 625 317 492 306 C 448 286 409 251 361 210 Z"
        fill="#d1e5a3" opacity=".50" />
      <Path d="M 778 229 C 921 190 1033 259 1101 350 C 1071 422 977 460 842 426 C 781 344 775 301 778 229 Z"
        fill="#b4dcb4" opacity=".49" />
      <Path d="M 172 628 C 304 559 437 570 532 624 C 557 697 493 792 345 775 C 233 749 141 698 172 628 Z"
        fill="#dbcd81" opacity=".40" />

      {BIOME_REGIONS.map(region => (
        <Ellipse key={region.gameId}
          cx={region.left + region.width / 2} cy={region.top + region.height / 2}
          rx={region.width * .42} ry={region.height * .35}
          fill={region.tint} opacity=".44" />
      ))}

      <Path d="M 552 147 C 582 234 588 290 628 357 C 651 420 662 464 699 515 C 744 597 735 682 772 766"
        fill="none" stroke="#3d95ac" strokeWidth={30} opacity=".55" strokeLinecap="round" />
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
          <Path d={route} fill="none" stroke={stage >= 3 ? "#fffbba" : "#fff9e3"} strokeWidth={stage >= 3 ? 2.5 : 1.5} strokeLinecap="round"
            strokeDasharray="2 16" opacity={stage >= 3 ? .88 : .56} />
        </G>
      ))}

      {/* Luminous stage-aware wayfinding preserves the canonical routes. */}
      {JOURNEY_PATH.map((route, index) => (
        <Path key={'waylight-' + index} d={route} fill="none"
          stroke={stage >= 2 ? '#fff1a5' : '#bcecea'}
          strokeWidth={stage >= 3 ? 3 : 1.5}
          strokeDasharray="1 24" strokeLinecap="round"
          opacity={stage >= 2 ? .86 : .58} />
      ))}
      {/* Bridges reconnect the established roads across the two rivers. */}
      {[
        { x: 614, y: 355, tilt: 17 },
        { x: 677, y: 502, tilt: -10 },
        { x: 811, y: 446, tilt: 24 },
      ].map((bridge, i) => (
        <G key={'bridge-' + i} transform={'rotate(' + bridge.tilt + ' ' + bridge.x + ' ' + bridge.y + ')'}>
          <Rect x={bridge.x - 34} y={bridge.y - 10} width={68} height={20} rx={3}
            fill="#b98752" stroke="#694e36" strokeWidth={3} />
          {Array.from({ length: 7 }, (_, n) => (
            <Path key={n} d={'M ' + (bridge.x - 28 + n * 9) + ' ' + (bridge.y - 8) + ' v 16'}
              stroke="#f9d99a" strokeWidth={2.5} />
          ))}
          <Path d={'M ' + (bridge.x - 35) + ' ' + (bridge.y - 15) + ' h 70 M ' + (bridge.x - 35) + ' ' + (bridge.y + 15) + ' h 70'}
            stroke="#f7dca3" strokeWidth={4} />
        </G>
      ))}

      {/* Waterfalls in the northern highlands and a bright river basin. */}
      <Path d="M 540 146 C 552 184 557 216 570 250"
        fill="none" stroke="#effdff" strokeWidth={11} strokeLinecap="round" opacity=".78" />
      <Path d="M 551 160 C 557 192 562 222 572 255"
        fill="none" stroke="#9fe7f9" strokeWidth={6} strokeLinecap="round" opacity=".92" />
      <Ellipse cx={574} cy={252} rx={27} ry={10} fill="#f2ffff" opacity=".64" />
      <Path d="M 815 230 C 805 252 806 272 800 288"
        fill="none" stroke="#efffff" strokeWidth={5} strokeLinecap="round" opacity=".78" />
      <Ellipse cx={801} cy={293} rx={16} ry={6} fill="#eaffff" opacity=".70" />

      {/* Coastal pier, market boats and 2.5D destination landmarks. */}
      <G>
        <Path d="M 130 686 L 62 718 L 68 731 L 139 701 Z" fill="#af8452" stroke="#795d3d" strokeWidth={3}/>
        {Array.from({ length: 5 }, (_, n) => (
          <Path key={n} d={'M ' + (78 + n * 11) + ' ' + (713 - n * 5) + ' l 6 16'}
            stroke="#efc68a" strokeWidth={3} />
        ))}
        <Path d="M 22 749 Q 54 762 85 745 L 79 759 Q 53 777 28 758 Z" fill="#8c523f" stroke="#f1c391" strokeWidth={3}/>
        <Path d="M 49 750 L 49 699 L 76 734 Z" fill="#fff6dd" stroke="#8dbec6" strokeWidth={2}/>
        <Path d="M 1136 567 Q 1163 580 1191 564 L 1182 577 Q 1159 590 1141 575 Z" fill="#c47850"/>
        <Path d="M 1161 563 L 1161 518 L 1183 552 Z" fill="#f9f1d6"/>
      </G>

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

      {/* Countryside cottages, stone paths and a working windmill replace
          blank schematic zones without changing their canonical stations. */}
      {[
        { x: 146, y: 612, roof: '#be7b50' },
        { x: 327, y: 688, roof: '#cf884f' },
        { x: 758, y: 575, roof: '#c68162' },
        { x: 977, y: 654, roof: '#9876af' },
      ].map((house, i) => (
        <G key={'cottage-' + i}>
          <Ellipse cx={house.x} cy={house.y + 19} rx={28} ry={9} fill="#35756c" opacity=".22"/>
          <Rect x={house.x - 16} y={house.y - 9} width={32} height={28} rx={3}
            fill="#fae2b2" stroke="#ad976c" strokeWidth={2} />
          <Path d={'M ' + (house.x - 22) + ' ' + (house.y - 9) + ' L ' + house.x + ' ' + (house.y - 29) +
            ' L ' + (house.x + 22) + ' ' + (house.y - 9) + ' Z'} fill={house.roof} stroke="#805d4b" strokeWidth={2} />
          <Rect x={house.x - 5} y={house.y + 3} width={10} height={16} rx={2} fill="#8d6b53"/>
          <SvgCircle cx={house.x + 10} cy={house.y} r={4} fill="#fcf4c6" />
        </G>
      ))}
      <G>
        <Rect x={365} y={614} width={19} height={60} rx={4} fill="#f2e4b9" stroke="#9a986d" strokeWidth={2}/>
        <Path d="M 358 616 L 375 582 L 392 616 Z" fill="#b7774c" stroke="#785c41" strokeWidth={2}/>
        <SvgCircle cx={375} cy={618} r={5} fill="#bf9c67"/>
        <Path d="M 335 618 L 415 618 M 375 577 L 375 659" stroke="#fff3cd" strokeWidth={9} strokeLinecap="round"/>
        <Path d="M 335 618 L 415 618 M 375 577 L 375 659" stroke="#8b704f" strokeWidth={2}/>
      </G>
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
          <Ellipse cx={x} cy={y + 21} rx={18} ry={7} fill="#30736a" opacity=".28" />
          <Path d={'M ' + (x - 14) + ' ' + (y + 5) + ' L ' + x + ' ' + (y - 26) +
            ' L ' + (x + 14) + ' ' + (y + 5) + ' Z'}
            fill={i % 2 ? "#32815e" : "#348f67"} />
          <Path d={'M ' + (x - 20) + ' ' + (y + 16) + ' L ' + x + ' ' + (y - 8) +
            ' L ' + (x + 20) + ' ' + (y + 16) + ' Z'}
            fill={i % 3 ? "#52a96f" : "#3e946c"} />
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
          <Ellipse cx={town.x} cy={town.y + 15} rx={72} ry={33} fill="#468e93" opacity=".21" />
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


      {/* R2 inspired scenic biomes: unique illustrated landmarks for canonical
          stations, not static UI text/false progress counters or extra routes. */}
      <G>
        {/* Quin: starlit observatory above the northern discovery cliffs. */}
        <Ellipse cx={1036} cy={160} rx={65} ry={24} fill="#557b9e" opacity=".27" />
        <Rect x={1010} y={110} width={55} height={49} rx={5}
          fill="#f3e6c2" stroke="#8095ac" strokeWidth={3} />
        <Path d="M 1000 112 Q 1037 62 1073 112 Z" fill="#567aca" stroke="#dde4ed" strokeWidth={3} />
        <Path d="M 1037 67 L 1037 43" stroke="#f9e7a0" strokeWidth={5} strokeLinecap="round" />
        <SvgCircle cx={1037} cy={39} r={10} fill="#fff1aa" />
        <Path d="M 1008 149 L 1070 149" stroke="#a5d2e4" strokeWidth={4}/>
        {[1019,1037,1054].map(x=>(
          <Rect key={'sky-window-'+x} x={x-4} y={121} width={8} height={15} rx={3} fill="#80d5fd" />
        ))}

        {/* Music City: colorful acoustic plaza, instruments and glowing lanterns. */}
        <Ellipse cx={965} cy={394} rx={61} ry={28} fill="#b09bb9" stroke="#f1ddbe" strokeWidth={3}/>
        <Ellipse cx={965} cy={390} rx={48} ry={18} fill="#7f74aa" opacity=".90" />
        {Array.from({length:8},(_,i)=>{
          const x=965+Math.cos(i*Math.PI/4)*44,y=390+Math.sin(i*Math.PI/4)*21;
          return <SvgCircle key={'music-lantern-'+i} cx={x} cy={y} r={4}
            fill={i%2?'#f2b5e8':'#ffdc82'} />;
        })}
        <Path d="M 946 381 L 946 360 L 955 356 L 955 379 M 946 366 L 955 362"
          fill="none" stroke="#fff2d4" strokeWidth={4} strokeLinecap="round" />
        <Path d="M 978 395 L 978 370 L 987 365 L 987 391 M 978 375 L 987 370"
          fill="none" stroke="#f8d2ed" strokeWidth={4} strokeLinecap="round" />

        {/* Trudice: flowering safe playground / children's haven. */}
        {[{x:310,y:347},{x:388,y:347},{x:355,y:321}].map((flower,i)=>(
          <G key={'flower-'+i}>
            <Rect x={flower.x-3} y={flower.y-1} width={6} height={28} rx={2} fill="#7b7856"/>
            {Array.from({length:5},(_,petal)=>(
              <SvgCircle key={petal}
                cx={flower.x+Math.cos(petal*Math.PI*2/5)*15}
                cy={flower.y-9+Math.sin(petal*Math.PI*2/5)*15}
                r={12} fill={petal%2?'#f8c7e5':'#eaa6d2'} opacity=".93"/>
            ))}
            <SvgCircle cx={flower.x} cy={flower.y-9} r={10} fill="#ffe7bf"/>
          </G>
        ))}
        <Path d="M 321 396 Q 355 363 388 396" stroke="#f6d99c" strokeWidth={8}
          fill="none" strokeLinecap="round"/>
        <Path d="M 323 397 L 323 422 M 386 397 L 386 422" stroke="#9d845b" strokeWidth={7}/>

        {/* Phan: sunlit coastal lighthouse and pier. */}
        <Rect x={104} y={584} width={19} height={60} rx={2} fill="#fff4d8" stroke="#bf8d73" strokeWidth={3}/>
        <Path d="M 98 588 L 114 564 L 129 588 Z" fill="#cb745d" stroke="#f5d8b4" strokeWidth={2}/>
        <Rect x={107} y={606} width={13} height={8} fill="#99d5e8"/>
        <Path d="M 99 627 L 128 627" stroke="#d7825e" strokeWidth={5}/>
        <SvgCircle cx={114} cy={582} r={5} fill="#fff59c"/>

        {/* Mitch: artistic fountain and painted mural wall. */}
        <Rect x={458} y={510} width={91} height={25} rx={3} fill="#eac3a1" stroke="#a77e6c" strokeWidth={3}/>
        {['#f5a57c','#f6d26e','#7acbb3','#99b0e7','#da9dd4'].map((color,i)=>(
          <Path key={'mural-'+i}
            d={'M '+(463+i*17)+' 531 l 10 -16 l 10 8 l 4 -9'}
            fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"/>
        ))}

        {/* Ace: compact rescue beacon and modular strategy outpost. */}
        <Rect x={697} y={443} width={46} height={29} rx={3} fill="#e6ebdf" stroke="#7e9491" strokeWidth={3}/>
        <Path d="M 693 444 L 720 423 L 748 444 Z" fill="#c77e69" stroke="#fff0c6" strokeWidth={2}/>
        <Path d="M 720 434 L 720 411" stroke="#8b8470" strokeWidth={3}/>
        <SvgCircle cx={720} cy={408} r={6} fill="#fff3a9"/>
        <Rect x={713} y={449} width={14} height={15} rx={3} fill="#6ac8ae"/>

        {/* Angel: treasury vault surrounded by warm gold lanterns. */}
        <Ellipse cx={897} cy={653} rx={53} ry={24} fill="#dfc28b" stroke="#92754a" strokeWidth={3}/>
        <Rect x={871} y={608} width={49} height={41} rx={5} fill="#eecf8d" stroke="#a07c48" strokeWidth={3}/>
        <Path d="M 867 611 L 895 589 L 924 611 Z" fill="#e7a358" stroke="#88603e" strokeWidth={3}/>
        <SvgCircle cx={895} cy={627} r={12} fill="#f6e2a4" stroke="#ad8850" strokeWidth={3}/>
        <Rect x={892} y={622} width={6} height={14} rx={2} fill="#936b36"/>
        {[850,939].map(x=><SvgCircle key={'treasury-light-'+x} cx={x} cy={638} r={5} fill="#ffdf84"/>)}

        {/* Niel: river-crossing frontier campsite with mission pennants. */}
        {[{x:652,y:742},{x:721,y:755}].map((camp,i)=>(
          <G key={'camp-'+i}>
            <Path d={'M '+(camp.x-28)+' '+(camp.y+6)+' L '+camp.x+' '+(camp.y-25)+
              ' L '+(camp.x+28)+' '+(camp.y+6)+' Z'}
              fill={i?'#f0ba7d':'#cf8b77'} stroke="#8f6b52" strokeWidth={3}/>
            <Path d={'M '+camp.x+' '+(camp.y-25)+' L '+camp.x+' '+(camp.y+6)}
              stroke="#f7e3b2" strokeWidth={2}/>
            <Path d={'M '+camp.x+' '+(camp.y-25)+' L '+camp.x+' '+(camp.y-42)+' L '+(camp.x+18)+
              ' '+(camp.y-36)+' L '+camp.x+' '+(camp.y-30)}
              fill="#f5d17a" stroke="#bc875c" strokeWidth={2}/>
          </G>
        ))}

        {/* The eastern highland holds a dormant volcanic/mystery frontier. */}
        <Path d="M 1087 431 L 1132 334 L 1171 414 L 1198 476 L 1078 476 Z"
          fill="#6b6270" stroke="#9d8883" strokeWidth={3} />
        <Path d="M 1113 378 L 1132 334 L 1146 367 Z" fill="#e8d2c5" />
        <Path d="M 1129 353 C 1138 389 1135 419 1155 467"
          stroke="#ff9854" strokeWidth={9} opacity=".89" strokeLinecap="round" fill="none"/>
        <Path d="M 1132 357 C 1136 389 1135 429 1152 462"
          stroke="#ffe2a3" strokeWidth={4} opacity=".93" strokeLinecap="round" fill="none"/>

        {/* Small magic stars and lanterns scale with the SVG and do not animate on
            their own, protecting battery and 3G mode on budget Android devices. */}
        {Array.from({length:18},(_,i)=>(
          <SvgCircle key={'kingdom-world-light-'+i}
            cx={128+(i*173)%995} cy={193+(i*103)%530}
            r={i%3===0?3:2} fill={i%2?'#fff6bc':'#c8f9f7'} opacity=".82"/>
        ))}
      </G>

      <Ellipse cx={607} cy={469} rx={123} ry={65} fill="#3d857a" opacity=".34" />
      <Ellipse cx={607} cy={442} rx={113} ry={65} fill="#e5d2a5" stroke="#73948a" strokeWidth={6} />
      <Ellipse cx={607} cy={436} rx={100} ry={52} fill="#70a599" stroke="#ece8bb" strokeWidth={3} />
      <Path d="M 529 466 L 540 398 L 551 398 L 559 350 L 574 350 L 581 398 L 599 377 L 611 318 L 625 377 L 639 401 L 651 352 L 667 352 L 677 398 L 688 398 L 696 466 Z"
        fill="url(#castle)" stroke="#9b7548" strokeWidth={3} />
      <Path d="M 596 381 L 612 292 L 626 381 Z" fill="#fff4d1" stroke="#b39055" strokeWidth={2} />
      <Path d="M 552 357 L 562 324 L 575 357 Z M 651 356 L 659 324 L 672 356 Z"
        fill="#f9edc6" stroke="#af8555" strokeWidth={1.5} />
      <Rect x={599} y={419} width={25} height={47} rx={12} fill="#417788" stroke="#fff5c7" strokeWidth={3} />
      <SvgCircle cx={612} cy={386} r={6} fill={stage >= 3 ? '#fff9bf' : '#eecf92'} />
      <Path d="M 582 468 Q 609 485 640 468" fill="none" stroke="#fcf1cf" strokeWidth={4} />
      <Ellipse cx={609} cy={509} rx={75} ry={10} fill="#9ad7cb" opacity=".58" />

      <Ellipse cx={591} cy={642} rx={59} ry={36} fill="#75bd7b" stroke="#b9c599" strokeWidth={3} />
      <Rect x={585} y={628} width={12} height={44} rx={4} fill="#806747" />
      <SvgCircle cx={591} cy={620} r={27} fill="#439d65" />
      <SvgCircle cx={575} cy={629} r={22} fill="#62b77b" />
      <SvgCircle cx={610} cy={623} r={22} fill="#83c68b" />

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
  // Smaller, glass-like hotspots reveal the world beneath instead of covering it.
  const diameter = compact ? 29 : 43;
  const w = compact ? 36 : 102;
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
            colors={selected ? ['#f5d79c', '#9d672e', '#324355'] : ['#26455d', '#122b42', '#0b2036']}
            style={[styles.beaconFill, { borderRadius: diameter / 2 }]}
          >
            <MaterialCommunityIcons
              name={station.icon} size={compact ? 15 : 21} color="#f7dd9c" />
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
  const { musicEnabled, toggleMusic } = useRorkGameAmbience('kingdom-map');
  const [progress, setProgress] = useState<BuklodKingdomPreviewProgress>(emptyProgress());
  const [selectedId, setSelectedId] = useState('christian-civic-leadership');
  const [mode, setMode] = useState<'detail' | 'fit'>('detail');
  const [zoomStep, setZoomStep] = useState(0);
  // Start map-first; the station dock remains one tap away.
  const [panelExpanded, setPanelExpanded] = useState(false);
  // Cin­ematic quality is the default; the Lite choice is per account.
  // Operating-system Reduce Motion always overrides visual quality.
  const [cinematicFX, setCinematicFX] = useState(true);
  const fxKey = '@buklod_kingdom_fx_quality_v1_' + (userId ?? 'guest');
  useEffect(() => {
    let live = true;
    setCinematicFX(true);
    void AsyncStorage.getItem(fxKey)
      .then(value => { if (live) setCinematicFX(value !== 'lite'); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [fxKey]);
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
  const clearedFXStations = useMemo(
    () => STATIONS.filter(station => (progress.stations[station.id]?.clears ?? 0) > 0)
      .map(station => ({ x: station.x, y: station.y, accent: station.accent })),
    [progress],
  );
  const selectedStation = STATIONS.find(station => station.id === selectedId) ?? STATIONS[5];
  // Only one selected-station art plate is mounted: preserve the old richer
  // artwork without reinstating 13 always-on thumbnails/animated loops.
  const selectedArt = getRorkGameMedia(selectedStation.id)?.background;

  const detailScale = clamp((screenWidth < 650 ? .86 : screenWidth < 1100 ? 1 : 1.06) * Math.pow(1.2, zoomStep), .55, 1.75);
  const scale = mode === 'fit'
    ? clamp((screenWidth - 20) / WORLD_W, .32, 1)
    : detailScale;
  const mapWidth = WORLD_W * scale;
  const mapHeight = WORLD_H * scale;
  const compact = mode === 'fit';

  const focus = useCallback((station: Station, animated = true) => {
    const currentScale = mode === 'fit'
      ? clamp((screenWidth - 20) / WORLD_W, .32, 1)
      : detailScale;
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
  }, [mode, screenWidth, viewportHeight, detailScale]);

  useEffect(()=>{void getBuklodSoundSettings();},[]);
  // Preserve the chosen station when the user zooms instead of resetting to the Citadel.
  useEffect(() => {
    if (initialFocusRef.current) focus(selectedStation, false);
  }, [zoomStep, mode, focus, selectedStation]);

  const chooseStation = useCallback((station: Station) => {
    setSelectedId(station.id);
    focus(station);
  }, [focus]);

  const enterStation = useCallback((station: Station) => {
    setSelectedId(station.id);
    router.push(station.href as any);
  }, []);

  const initialFocus = useCallback(() => {
    if (initialFocusRef.current) return;
    initialFocusRef.current = true;
    focus(selectedStation, false);
  }, [focus, selectedStation]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0d3b62', '#176b83', '#071e3b']} style={StyleSheet.absoluteFill} />

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
            <BuklodKingdomLivingFX
              stage={stage} scale={scale} mapWidth={mapWidth} mapHeight={mapHeight}
              selected={selectedStation} cleared={clearedFXStations} cinematic={cinematicFX}
            />

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

      <View style={[styles.header, { paddingTop: Math.max(24, insets.top) + 10 }]}>
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
        <Pressable accessibilityRole="button" accessibilityLabel="Open Kingdom Hall of Legacy"
          onPress={() => router.push('/games/legacy' as any)} style={styles.legacyButton}>
          <MaterialCommunityIcons name="shield-crown" size={23} color="#f1d598" />
        </Pressable>
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

      <View style={[styles.zoomTools, { top: Math.max(24, insets.top) + 84 }]}>
         <Pressable accessibilityRole="button"
           accessibilityLabel={cinematicFX ? 'Use Lite Kingdom graphics' : 'Use cinematic Kingdom graphics'}
           accessibilityHint="Switch world effects quality. Reduced Motion is always respected."
           onPress={() => {
             const next = !cinematicFX;
             setCinematicFX(next);
             void AsyncStorage.setItem(fxKey, next ? 'cinematic' : 'lite').catch(() => undefined);
           }}
           style={styles.zoomButton}>
           <MaterialCommunityIcons name={cinematicFX ? 'auto-fix' : 'weather-night'}
             size={20} color="#ffe7b1"/>
         </Pressable>
        <Pressable accessibilityRole="button"
          accessibilityLabel={musicEnabled ? 'Mute Kingdom ambient music' : 'Play Kingdom ambient music'}
          onPress={toggleMusic} style={styles.zoomButton}>
          <MaterialCommunityIcons name={musicEnabled ? 'music-note' : 'music-note-off'}
            size={21} color="#ffe7b1"/>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in on Kingdom map"
          disabled={mode === 'detail' && zoomStep >= 3}
          style={styles.zoomButton}
          onPress={() => { setMode('detail'); setZoomStep(value => Math.min(3, value + 1)); }}>
          <MaterialCommunityIcons name="plus" size={21} color="#ffe7b1" />
        </Pressable>
        <Text style={styles.zoomReadout}>{mode === 'fit' ? 'FIT' : Math.round(detailScale * 100) + '%'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out on Kingdom map"
          disabled={mode === 'detail' && zoomStep <= -2}
          style={styles.zoomButton}
          onPress={() => { setMode('detail'); setZoomStep(value => Math.max(-2, value - 1)); }}>
          <MaterialCommunityIcons name="minus" size={21} color="#ffe7b1" />
        </Pressable>
      </View>

      {panelExpanded ? <View style={[styles.bottomPanel, { bottom: Math.max(insets.bottom + 7, 8) }]}>
        <View style={styles.selectedRow}>
          <View style={styles.selectedIcon}>
            {selectedArt ? <Image source={{ uri: selectedArt }}
              resizeMode="cover" style={styles.selectedArt} /> : null}
            <View style={styles.selectedArtScrim} pointerEvents="none" />
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
          <Pressable accessibilityRole="button" accessibilityLabel="Hide Kingdom station dock to explore full illustrated map"
            onPress={() => setPanelExpanded(false)} style={styles.hideDock}>
            <MaterialCommunityIcons name="chevron-down" size={16} color="#ffe2a4"/>
            <Text style={styles.railHelp}>MAP ONLY</Text>
          </Pressable>
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
      </View> : <Pressable accessibilityRole="button"
        accessibilityLabel="Show Kingdom station dock"
        onPress={() => setPanelExpanded(true)}
        style={[styles.showDock, { bottom: Math.max(insets.bottom + 10, 14) }]}>
        <MaterialCommunityIcons name="map-marker-multiple" size={19} color="#fff2cd" />
        <Text style={styles.showDockText}>EXPLORE 13 STATIONS</Text>
        <MaterialCommunityIcons name="chevron-up" size={18} color="#fff2cd" />
      </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d416b' },
  mapScroll: { flex: 1 },
  verticalScroll: { flex: 1 },
  horizontalContent: { justifyContent: 'center' },
  verticalContent: { alignItems: 'center', justifyContent: 'center' },
  worldFrame: { position: 'relative', overflow: 'hidden', backgroundColor: '#0d416b' },
  stationAnchor: { position: 'absolute', alignItems: 'center' },
  stationPress: { width: '100%', alignItems: 'center' },
  stationPressed: { transform: [{ scale: .95 }] },
  beacon: {
    backgroundColor: '#132d46', borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#071724', shadowOpacity: .42, shadowRadius: 10, elevation: 6,
  },
  beaconSelected: { shadowColor: '#f3dfa0', shadowOpacity: .67, shadowRadius: 13, elevation: 10 },
  beaconFill: {
    width: '100%', height: '100%',
    borderWidth: 1, borderColor: 'rgba(255,225,153,.72)',
    justifyContent: 'center', alignItems: 'center',
  },
  stationNumber: {
    position: 'absolute', top: -7, left: -8,
    width: 21, height: 21, borderRadius: 11,
    borderWidth: 1, borderColor: '#f8e0a7',
    backgroundColor: '#142e48', alignItems: 'center', justifyContent: 'center',
  },
  stationNumberText: { color: '#fff0c9', fontWeight: '900', fontSize: 11 },
  stationCleared: {
    position: 'absolute', bottom: -5, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#327c68', borderWidth: 2, borderColor: '#f4f2c8',
    alignItems: 'center', justifyContent: 'center',
  },
  stationPlaque: {
    marginTop: 3, width: 103, borderWidth: 1, borderColor: 'rgba(184,234,229,.76)',
    backgroundColor: 'rgba(7,31,56,.94)',
    paddingHorizontal: 5, paddingVertical: 4, borderRadius: 12,
    alignItems: 'center', shadowColor: '#07111b', shadowOpacity: .3, shadowRadius: 8,
  },
  stationPlaqueSelected: { borderColor: '#f4cc74', borderWidth: 1.5, backgroundColor: 'rgba(25,43,70,.96)' },
  stationName: { color: '#ffedc0', fontSize: 11, fontWeight: '900' },
  stationZone: { color: '#c6dce5', fontSize: 7.5, fontWeight: '700' },
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
    backgroundColor: 'rgba(5,24,47,.94)',
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
  legacyButton: {
    width: 43, height: 43, borderWidth: 1, borderRadius: 12,
    borderColor: '#af9874', backgroundColor: '#254456',
    alignItems: 'center', justifyContent: 'center',
  },
  fitButton: {
    width: 54, height: 43, borderWidth: 1, borderRadius: 12,
    borderColor: '#af9874', backgroundColor: '#254456',
    alignItems: 'center', justifyContent: 'center',
  },
  fitLabel: { color: '#ffedc5', fontSize: 8, fontWeight: '900' },
  zoomTools: {
    position: 'absolute', zIndex: 81, right: 10, borderRadius: 15,
    backgroundColor: 'rgba(6,26,53,.92)', borderWidth: 1, borderColor: '#d5b678',
    alignItems: 'center', padding: 5, gap: 3, elevation: 5,
  },
  zoomButton: {
    width: 42, height: 39, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#25475a',
  },
  zoomReadout: { color: '#ffe4ac', fontWeight: '800', fontSize: 9 },

  bottomPanel: {
    position: 'absolute', zIndex: 80, left: 8, right: 8,
    borderWidth: 1, borderColor: '#d6b46d',
    borderRadius: 18, paddingTop: 8, paddingBottom: 9, gap: 6,
    backgroundColor: 'rgba(7,24,49,.95)',
    shadowColor: '#07141e', shadowOpacity: .48, shadowRadius: 12,
    elevation: 12,
  },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10 },
  selectedIcon: {
    width: 65, height: 58, backgroundColor: '#29475b', overflow: 'hidden',
    borderWidth: 1, borderColor: '#d4b578', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  selectedArt: { ...StyleSheet.absoluteFillObject },
  selectedArtScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9,23,40,.36)' },
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
  railTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5, paddingHorizontal: 12 },
  hideDock: { flexDirection:'row',alignItems:'center',paddingVertical:5,paddingHorizontal:7,
    borderRadius:8, backgroundColor:'rgba(39,71,86,.6)' },
  showDock: { position:'absolute',zIndex:80,alignSelf:'center',flexDirection:'row',
    alignItems:'center',gap:8,paddingHorizontal:18,paddingVertical:12,
    backgroundColor:'rgba(8,30,58,.94)',borderWidth:1,borderColor:'#f5d393',
    borderRadius:16,elevation:9 },
  showDockText: { color:'#fff2cd',fontSize:12,fontWeight:'900' },
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
