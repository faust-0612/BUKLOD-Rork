/**
 * Real on-field Arena villagers, not an animated illustration/poster.
 * Stateless SVG rig: only consumes positions/actions from the deterministic
 * practice engine. No local movement, damage, item, or reward authority.
 *
 * Temporary vector character art; the single faction poster cannot supply
 * clean, independently rigged, transparent sprites for all 12 identities.
 */
import React, { memo } from 'react';
import { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

export type ArenaVillagerVisual = {
  id: string;
  x: number;
  y: number;
  team?: 'A' | 'B' | null;
  kind?: string;
  villagerSlot?: number;
  villagerRole?: string;
  villagerName?: string;
  hp: number;
  maxHp: number;
  facing?: number;
  lastMovedAt?: number;
  jobAt?: number;
  attackAt?: number;
  command?: string;
  carry?: { wood?: number; gold?: number; stone?: number };
};

type Props = { actor: ArenaVillagerVisual; elapsed: number; selected?: boolean };
const SKY = '#93e9ff';
const FLAME = '#ff9e9f';
const SKINS = ['#efc09b', '#f4cfad', '#e4b08d', '#f6d5b6', '#e9b68f', '#f7cba0'];
const JOB_ACCENTS = ['#ffe6a1', '#8eedcc', '#b6d8ff', '#fff3bf', '#c6a9ff', '#ffc779'];

export const ArenaVillagerSprite = memo(function ArenaVillagerSprite({ actor, elapsed, selected = false }: Props) {
  if (actor.hp <= 0) return null;
  const slot = Math.max(0, Math.min(5, Math.trunc(actor.villagerSlot ?? 0)));
  const dark = actor.team === 'B';
  const faction = dark ? FLAME : SKY;
  const accent = JOB_ACCENTS[slot];
  const outfit = dark ? ['#772f38','#602a3d','#333743','#6b293e','#663b4a','#88423b'][slot]
    : ['#386e94','#3077ad','#3c6089','#f0ead5','#416e9e','#657ba1'][slot];
  const skin = SKINS[slot];
  const moving = actor.lastMovedAt !== undefined && elapsed - actor.lastMovedAt >= 0 && elapsed - actor.lastMovedAt <= 180;
  const gait = moving ? Math.sin(elapsed * 0.022 + slot * .3) : 0;
  const bob = moving ? Math.abs(gait) * .24 : Math.sin(elapsed * .003 + slot) * .07;
  const recentHit = actor.attackAt !== undefined && elapsed - actor.attackAt >= 0 && elapsed - actor.attackAt < 470;
  const recentWork = actor.jobAt !== undefined && elapsed - actor.jobAt >= 0 && elapsed - actor.jobAt < 850;
  const carrying = Object.values(actor.carry || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  const busy = !moving && (recentHit || recentWork || (actor.command === 'mine' && carrying > 0));
  const handSwing = moving ? gait * 18 : busy ? Math.sin(elapsed * .018) * 24 : Math.sin(elapsed * .002) * 4;
  const facing = actor.facing === -1 ? -1 : 1;
  const hp = Math.max(0, Math.min(1, actor.hp / Math.max(1, actor.maxHp)));
  return (
    <G transform={'translate(' + actor.x + ' ' + actor.y + ')'}>
      <Ellipse cx={0} cy={1.38} rx={2.0} ry={.54} fill="#061524" opacity={.66} />
      {selected ? <Circle cx={0} cy={0} r={3.65} fill="none" stroke="#ffdd8e" strokeWidth={.42} strokeDasharray="1.3 .8" /> : null}
      <G transform={'translate(0 ' + (-bob) + ') scale(' + facing + ' 1)'}>
        {/* Alternating feet and leg pose are tied to actual sim movement, not a decorative GIF. */}
        <Line x1={-.55} y1={-.15} x2={-.7 - gait * .46} y2={1.08} stroke={dark ? '#34232d' : '#354c61'} strokeWidth={.68} strokeLinecap="round" />
        <Line x1={.55} y1={-.15} x2={.7 + gait * .46} y2={1.08} stroke={dark ? '#34232d' : '#354c61'} strokeWidth={.68} strokeLinecap="round" />
        <Line x1={-.7 - gait * .46} y1={1.08} x2={-1.02 - gait * .52} y2={1.18} stroke="#171e2d" strokeWidth={.32} strokeLinecap="round" />
        <Line x1={.7 + gait * .46} y1={1.08} x2={.99 + gait * .5} y2={1.18} stroke="#171e2d" strokeWidth={.32} strokeLinecap="round" />
        {/* Body armor, tunic or utility apron. Lux and Tenebra share gameplay stats. */}
        <Path d="M-1.08 -3.14 Q0 -3.56 1.08 -3.14 L1.2 -.15 Q0 .16 -1.2 -.15 Z"
          fill={outfit} stroke={faction} strokeWidth={.2} />
        <Path d="M-.88 -1.1 L.88 -1.1" fill="none" stroke={accent} strokeWidth={.26}/>
        {slot===0 ? <Path d="M-.78 -2.4 L-.78 -.25 L.8 -.25 L.8 -2.4" fill="none" stroke={accent} strokeWidth={.35} /> : null}
        {slot===2 ? <Path d="M-1.05 -2.83 L-.47 -3.33 L.52 -3.33 L1.07 -2.83" stroke={accent} strokeWidth={.36} fill="none"/> : null}
        {slot===3 ? <Path d="M0 -3.3 L-.62 -.2 L.62 -.2 Z" fill={dark ? '#8c314a' : '#fff0c5'} opacity={.8}/> : null}
        {slot===4 ? <Rect x={-.72} y={-1.18} width={1.44} height={.32} rx={.1} fill={accent} /> : null}
        {/* Independent limbs: actions swing a tool while walking gives alternating arms. */}
        <G transform={'rotate(' + handSwing + ' -1.02 -2.92)'}>
          <Line x1={-1.02} y1={-2.92} x2={-1.61} y2={-1.38} stroke={outfit} strokeWidth={.55} strokeLinecap="round" />
          <Circle cx={-1.61} cy={-1.38} r={.26} fill={skin}/>
          {slot===2 ? <Path d="M-2.02 -1.85 L-1.03 -2.05 L-.97 -.95 L-1.58 -.46 L-2.12 -1.03 Z" fill={dark?'#32373e':'#78add7'} stroke={accent} strokeWidth={.2}/> : null}
        </G>
        <G transform={'rotate(' + (-handSwing) + ' 1.02 -2.92)'}>
          <Line x1={1.02} y1={-2.92} x2={1.58} y2={-1.40} stroke={outfit} strokeWidth={.55} strokeLinecap="round" />
          <Circle cx={1.58} cy={-1.40} r={.26} fill={skin} />
          {slot===0 ? <G><Line x1={1.65} y1={-1.42} x2={2.19} y2={-3.06} stroke="#d6b679" strokeWidth={.25}/><Rect x={1.72} y={-3.21} width={1.04} height={.46} rx={.1} fill="#aeb3b8" stroke={accent} strokeWidth={.12}/></G> : null}
          {slot===1 ? <G><Path d="M1.32 -1.24 L1.86 -2.67 L2.43 -1.69 L1.9 -1.14 Z" fill={dark?'#ff537b':'#6ff6fd'} stroke={accent} strokeWidth={.16}/><Path d="M1.86 -2.67 L1.9 -1.14" stroke="white" strokeWidth={.1}/></G> : null}
          {slot===2 ? <G><Line x1={1.6} y1={-1.44} x2={2.19} y2={-3.14} stroke="#d9dfe7" strokeWidth={.24}/><Line x1={1.85} y1={-2.07} x2={2.35} y2={-1.86} stroke={accent} strokeWidth={.25}/></G> : null}
          {slot===3 ? <G><Line x1={1.7} y1={-1.37} x2={1.93} y2={-3.74} stroke={accent} strokeWidth={.22}/><Circle cx={1.93} cy={-3.74} r={.38} fill={dark?'#ff6a86':'#a8f3ff'} opacity={.92}/><Path d="M1.93 -3.97 L1.93 -3.5 M1.7 -3.74 L2.16 -3.74" stroke="white" strokeWidth={.12}/></G> : null}
          {slot===4 ? <G><Path d="M1.2 -2.1 Q1.7 -2.45 2.14 -2.14 L2.14 -1.18 Q1.65 -1.33 1.2 -1.14 Z" fill={dark?'#4c263e':'#477fae'} stroke={accent} strokeWidth={.18}/><Line x1={1.69} y1={-2.27} x2={1.69} y2={-1.2} stroke={accent} strokeWidth={.09}/></G> : null}
          {slot===5 ? <G><Rect x={1.18} y={-2.14} width={1.34} height={.94} rx={.12} fill={dark?'#814529':'#a37b3c'} stroke={accent} strokeWidth={.2}/><Line x1={1.84} y1={-2.1} x2={1.84} y2={-1.25} stroke="#e8cf88" strokeWidth={.18}/></G> : null}
        </G>
        {/* Consistent identifiable faces with team-specific hair, hoods and equipment. */}
        <Circle cx={0} cy={-4.07} r={.91} fill={skin} stroke="#272b39" strokeWidth={.12} />
        {slot===0 ? <G><Path d="M-.9 -4.23 Q-.9 -5.38 0 -5.3 Q1.0 -5.25 .91 -4.17 L.52 -4.72 L-.4 -4.7 Z" fill={dark?'#37231f':'#f1f3e2'}/><Path d="M-.55 -3.67 Q0 -3.07 .56 -3.7 Q.15 -3.38 -.55 -3.67" fill={dark?'#563c2d':'#f5f5df'}/></G> : null}
        {slot===1 ? <Path d="M-1.02 -4.64 Q-1.05 -5.56 0 -5.38 Q.9 -5.54 1.09 -4.65 L.82 -3.75 L.63 -4.35 Q0 -4.95 -.65 -4.35 L-.82 -3.74 Z" fill={dark?'#a62e43':'#3276c0'} stroke={accent} strokeWidth={.13}/> : null}
        {slot===2 ? <Path d="M-.92 -4.43 L-1.03 -4.85 L-.54 -5.27 L.55 -5.27 L1.04 -4.85 L.93 -4.43" fill={dark?'#232a32':'#819ab2'} stroke={accent} strokeWidth={.2}/> : null}
        {slot===3 ? <Path d="M-1.04 -4.53 L-.88 -5.1 L0 -5.42 L.83 -5.1 L1.04 -4.53 L.81 -3.55 L.57 -4.32 L-.52 -4.32 L-.84 -3.6 Z" fill={dark?'#291e2e':'#2b313f'} stroke={accent} strokeWidth={.17}/> : null}
        {slot===4 ? <G><Path d="M-.91 -4.67 Q0 -5.55 .91 -4.67 L.83 -4.35 Q0 -4.92 -.83 -4.35 Z" fill={dark?'#3b252f':'#453a43'}/><Circle cx={-.39} cy={-4.06} r={.3} stroke="#ecdbb3" strokeWidth={.13} fill="none"/><Circle cx={.39} cy={-4.06} r={.3} stroke="#ecdbb3" strokeWidth={.13} fill="none"/><Line x1={-.08} y1={-4.06} x2={.08} y2={-4.06} stroke="#ecdbb3" strokeWidth={.1}/></G> : null}
        {slot===5 ? <G><Path d="M-1.24 -4.92 Q0 -6.1 1.24 -4.92 Z" fill={dark?'#8f5634':'#e7b45d'} stroke={accent} strokeWidth={.18}/><Rect x={-1.24} y={-4.93} width={2.48} height={.24} rx={.12} fill={dark?'#b9825b':'#e8cc8d'}/></G> : null}
        {slot===2&&dark ? <Rect x={-.8} y={-4.34} width={1.6} height={.42} rx={.08} fill="#212635" stroke="#e5a4b5" strokeWidth={.11}/> :
          <G><Circle cx={-.34} cy={-4.08} r={.065} fill="#253043"/><Circle cx={.34} cy={-4.08} r={.065} fill="#253043"/></G>}
        {busy ? <Circle cx={0} cy={-5.65} r={.18} fill={accent} opacity={.65 + .3*Math.sin(elapsed*.015)}/> : null}
      </G>
      <SvgText x={0} y={-6.15} textAnchor="middle" fontSize={1.3} fontWeight="bold" fill={accent} stroke="#09202e" strokeWidth={.10}>
        {actor.villagerName || (dark ? 'Tenebra' : 'Lux')}
      </SvgText>
      <Rect x={-1.58} y={1.76} width={3.16} height={.31} rx={.09} fill="#171f2e"/>
      <Rect x={-1.58} y={1.76} width={3.16 * hp} height={.31} rx={.09} fill={hp > .3 ? '#9effb1' : '#ff7c83'}/>
      <Rect x={-1.58} y={2.18} width={3.16} height={.075} rx={.03} fill={faction} opacity={.78}/>
    </G>
  );
});