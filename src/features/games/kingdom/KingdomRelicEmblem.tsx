/* BUKLOD Kingdom R1 original vector collectible artwork.
 * Visual finishes reflect server-confirmed Character level only.
 * These do not create independent item tiers or rewards.
 */
import React from 'react';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient as SvgGradient, Path, Polygon,
  Rect, Stop,
} from 'react-native-svg';
import type { CharacterCollectibleRewardKind } from '@/lib/buklodCharacterCollectibles';

type Tier = 'bronze' | 'silver' | 'gold' | 'legendary';
type Palette = { rim: string; light: string; dark: string; gem: string; accent: string };
const PALETTES: Record<Tier, Palette> = {
  bronze: { rim:'#bd8753', light:'#f1d1a6', dark:'#5e3a2d', gem:'#d7aa74', accent:'#fff2ce' },
  silver: { rim:'#a9c4d0', light:'#eff8f9', dark:'#466578', gem:'#a9e1ec', accent:'#f9ffff' },
  gold: { rim:'#efc76b', light:'#fff0a8', dark:'#755130', gem:'#95efdc', accent:'#fff7d5' },
  legendary: { rim:'#efce88', light:'#fff6c4', dark:'#48346e', gem:'#bfa4ff', accent:'#f6e8ff' },
};
export function kingdomVisualFinish(level: number): Tier {
  if (!Number.isFinite(level) || level < 5) return 'bronze';
  if (level < 10) return 'silver';
  if (level < 15) return 'gold';
  return 'legendary';
}
export function kingdomFinishLabel(level: number) {
  const value = kingdomVisualFinish(level);
  return value[0].toUpperCase() + value.slice(1);
}
export type KingdomRelicEmblemProps = {
  index: number;
  level: number;
  rewardKind?: CharacterCollectibleRewardKind | null;
  size?: number;
  locked?: boolean;
};
const KINDS: CharacterCollectibleRewardKind[] =
  ['expression','speech','profile_frame','visual_effect','title_badge'];

function Symbol({ kind, palette }: { kind: CharacterCollectibleRewardKind; palette: Palette }) {
  const fg = palette.accent, jewel = palette.gem;
  if (kind === 'title_badge') return <G>
    <Path d="M50 23 L72 31 L69 59 Q61 73 50 80 Q39 73 31 59 L28 31 Z"
      fill={palette.dark} stroke={fg} strokeWidth={3}/>
    <Path d="M50 33 L54 43 L65 44 L57 51 L59 62 L50 56 L41 62 L43 51 L35 44 L46 43 Z" fill={jewel} stroke={fg} strokeWidth={1}/>
    <Path d="M39 69 Q50 76 61 69" fill="none" stroke={fg} strokeWidth={2}/>
  </G>;
  if (kind === 'speech') return <G>
    <Path d="M26 34 Q50 21 74 34 L71 57 Q60 69 48 64 L34 75 L37 60 Q24 51 26 34 Z"
      fill={palette.dark} stroke={fg} strokeWidth={3}/>
    <Path d="M35 39 H65 M35 47 H59 M35 55 H52" stroke={jewel} strokeWidth={3} strokeLinecap="round"/>
    <Circle cx={67} cy={62} r={5} fill={jewel}/>
  </G>;
  if (kind === 'profile_frame') return <G>
    <Rect x={29} y={26} width={42} height={49} rx={5} fill={palette.dark} stroke={fg} strokeWidth={3}/>
    <Rect x={35} y={32} width={30} height={37} rx={3} fill="#1e4e59" stroke={jewel} strokeWidth={1.5}/>
    <Circle cx={50} cy={45} r={7} fill={fg}/>
    <Path d="M38 63 Q50 47 62 63" fill={jewel}/>
    <Path d="M27 28 L35 28 L35 35 M73 28 L65 28 L65 35 M27 74 L35 74 L35 67 M73 74 L65 74 L65 67"
      stroke={jewel} strokeWidth={2} fill="none"/>
  </G>;
  if (kind === 'visual_effect') return <G>
    <Path d="M55 20 C19 48 47 57 38 80 C70 66 82 45 55 20 Z"
      fill={palette.dark} stroke={fg} strokeWidth={3}/>
    <Path d="M52 34 Q37 53 50 67 Q63 53 52 34" fill={jewel}/>
    <Path d="M32 26 L35 33 L42 36 L35 39 L32 47 L29 39 L22 36 L29 33 Z" fill={fg}/>
    <Circle cx={72} cy={30} r={4} fill={jewel}/>
    <Circle cx={71} cy={70} r={3} fill={fg}/>
  </G>;
  return <G>
    <Path d="M50 26 C64 26 74 36 74 50 C74 64 64 74 50 74 C36 74 26 64 26 50 C26 36 36 26 50 26 Z"
      fill={palette.dark} stroke={fg} strokeWidth={3}/>
    <Path d="M39 46 Q44 42 49 46 M55 46 Q60 42 65 46" stroke={jewel} strokeWidth={3} fill="none" strokeLinecap="round"/>
    <Path d="M39 57 Q50 69 62 57" stroke={fg} strokeWidth={3} fill="none" strokeLinecap="round"/>
    <Path d="M50 17 L53 24 L60 26 L53 29 L50 36 L47 29 L40 26 L47 24 Z" fill={fg}/>
  </G>;
}
export default function KingdomRelicEmblem({
  index, level, rewardKind, size = 70, locked = false,
}: KingdomRelicEmblemProps) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g,'');
  const tier = kingdomVisualFinish(level);
  const palette = locked
    ? { rim:'#60727b', light:'#c0cad0', dark:'#334954', gem:'#8297a3', accent:'#d5e0e0' }
    : PALETTES[tier];
  const kind = rewardKind ?? KINDS[Math.max(0,Math.min(4,index-1))];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={locked ? 'Locked Kingdom item' : kingdomFinishLabel(level) + ' Kingdom collectible'}>
      <Defs>
        <SvgGradient id={'plate'+id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.light}/>
          <Stop offset=".45" stopColor={palette.rim}/>
          <Stop offset="1" stopColor={palette.dark}/>
        </SvgGradient>
        <SvgGradient id={'gem'+id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={palette.light}/>
          <Stop offset="1" stopColor={palette.gem}/>
        </SvgGradient>
      </Defs>
      <Ellipse cx={50} cy={87} rx={31} ry={7} fill="#06151e" opacity={.35}/>
      <G>
        {Array.from({length:10},(_,i)=>(
          <Path key={i} d="M45 12 L50 3 L55 12" transform={'rotate('+(i*36)+' 50 50)'}
            fill={palette.rim} stroke={palette.light} strokeWidth={1}/>
        ))}
      </G>
      <Circle cx={50} cy={50} r={40} fill={palette.dark} stroke={palette.light} strokeWidth={2}/>
      <Circle cx={50} cy={50} r={36} fill={'url(#plate'+id+')'} stroke={palette.rim} strokeWidth={4}/>
      <Circle cx={50} cy={50} r={30} fill="#193b4b" stroke={palette.light} strokeWidth={1.5}/>
      <Circle cx={50} cy={50} r={26} fill="#0b2638" opacity={.5}/>
      {Array.from({length:8},(_,i)=>(
        <G key={i} transform={'rotate('+(i*45)+' 50 50)'}>
          <Path d="M50 10 L53 15 L50 20 L47 15 Z" fill={palette.gem}/>
          <Circle cx={50} cy={22} r={1.5} fill={palette.light}/>
        </G>
      ))}
      {tier === 'legendary' && !locked ? <G>
        <Polygon points="50,3 60,15 50,23 40,15" fill={'url(#gem'+id+')'} stroke={palette.accent} strokeWidth={2}/>
        <Circle cx={50} cy={14} r={3} fill={palette.accent}/>
      </G> : null}
      <Symbol kind={kind} palette={palette}/>
    </Svg>
  );
}
