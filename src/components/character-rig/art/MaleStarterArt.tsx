/**
 * REJECTED for production — generic placeholder art.
 * Do not render while USE_APPROVED_RORK_COMPOSITE is true.
 * Replace with Rork-derived segmented PNG slots after art review.
 */
import React from 'react';

import { Circle, Ellipse, G, Path } from 'react-native-svg';

import type { MouthSlotId } from '@/lib/character-rig/contract';
import { MALE_SKELETON } from '@/lib/character-rig/skeletonMale';

export const MALE_STARTER_PALETTE = {
  skin: '#F3C7A8',
  skinMid: '#E8B391',
  skinShadow: '#D49A76',
  hair: '#1B1310',
  hairMid: '#2C201A',
  hairHi: '#4A3428',
  eyeWhite: '#FFF6EE',
  iris: '#4A2C1C',
  pupil: '#120A08',
  brow: '#2A1810',
  lash: '#1A100C',
  lip: '#C86B64',
  tunic: '#F3E6D0',
  tunicFold: '#E0CDAE',
  tunicGreen: '#1B6B3C',
  tunicGold: '#C9963A',
  pants: '#2E3C34',
  pantsFold: '#24302A',
  shoes: '#6B4330',
  shoesDark: '#4A2E20',
  outline: '#3D261C',
} as const;

const P = MALE_STARTER_PALETTE;
const B = MALE_SKELETON.bones;
const C = MALE_SKELETON.neckCouplerR;

/** Skin disc that keeps HEAD glued to NECK through rotation. */
export function NeckCoupler() {
  return (
    <G>
      <Circle cx={0} cy={0} r={C} fill={P.skinMid} />
      <Circle cx={0} cy={2} r={C * 0.72} fill={P.skin} />
    </G>
  );
}

export function MaleHairBack() {
  return (
    <G>
      <Path
        d="M -30 -28 C -38 -48 -36 -78 -18 -90 C -4 -98 8 -98 22 -90 C 40 -78 40 -48 32 -28 C 28 -18 18 -14 0 -16 C -18 -14 -26 -18 -30 -28 Z"
        fill={P.hair}
      />
      <Path
        d="M -26 -40 C -22 -70 -8 -88 4 -90 C -6 -76 -16 -58 -22 -36 Z"
        fill={P.hairHi}
        opacity={0.35}
      />
    </G>
  );
}

export function MaleHead() {
  return (
    <G>
      <NeckCoupler />
      {/* Youthful jaw — short chin, full cheeks, no heavy mandible */}
      <Path
        d="M -21 -20 C -25 -10 -18 -3 0 -5 C 18 -3 25 -10 21 -20 C 27 -34 26 -54 16 -70 C 8 -82 -8 -82 -16 -70 C -26 -54 -27 -34 -21 -20 Z"
        fill={P.skin}
        stroke={P.outline}
        strokeWidth={1.2}
      />
      <Path
        d="M -16 -22 C -18 -12 -10 -8 0 -9 C 10 -8 18 -12 16 -22"
        fill={P.skinMid}
        opacity={0.45}
      />
      <Ellipse cx={-22} cy={-40} rx={5.2} ry={8.2} fill={P.skinMid} stroke={P.outline} strokeWidth={0.9} />
      <Ellipse cx={22} cy={-40} rx={5.2} ry={8.2} fill={P.skinMid} stroke={P.outline} strokeWidth={0.9} />
      <Path d="M -1 -36 C 3 -32 4 -26 1 -22" stroke={P.skinShadow} strokeWidth={1.25} fill="none" strokeLinecap="round" />
      <Path d="M -12 -56 Q -8 -59 -4 -56" stroke={P.brow} strokeWidth={2.1} fill="none" strokeLinecap="round" />
      <Path d="M 4 -56 Q 8 -59 12 -56" stroke={P.brow} strokeWidth={2.1} fill="none" strokeLinecap="round" />
    </G>
  );
}

export function MaleEyesOpen() {
  return (
    <G>
      <Eye cx={-10.5} cy={-46} dir={1} />
      <Eye cx={10.5} cy={-46} dir={-1} />
    </G>
  );
}

function Eye({ cx, cy, dir }: { cx: number; cy: number; dir: number }) {
  return (
    <G x={cx} y={cy}>
      <Ellipse cx={0} cy={0} rx={7.2} ry={6.4} fill={P.eyeWhite} stroke={P.lash} strokeWidth={0.9} />
      <Circle cx={dir * 0.8} cy={0.6} r={3.5} fill={P.iris} />
      <Circle cx={dir * 0.8} cy={0.6} r={1.7} fill={P.pupil} />
      <Circle cx={dir * 0.1} cy={-1.4} r={1.15} fill="#FFFFFF" />
      <Path d="M -7.2 -1.2 C -4 -6.6 4 -6.6 7.2 -1.2" stroke={P.lash} strokeWidth={1.35} fill="none" />
    </G>
  );
}

export function MaleEyesClosed() {
  return (
    <G>
      <Path d="M -17.5 -46 Q -10.5 -41 -3.5 -46" stroke={P.lash} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Path d="M 3.5 -46 Q 10.5 -41 17.5 -46" stroke={P.lash} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </G>
  );
}

export function MaleMouth({ state }: { state: MouthSlotId }) {
  if (state === 'MOUTH_SMALL_OPEN') {
    return <Ellipse cx={0} cy={-18} rx={4.4} ry={3.1} fill={P.lip} />;
  }
  if (state === 'MOUTH_MEDIUM_OPEN') {
    return <Ellipse cx={0} cy={-17.5} rx={5.6} ry={4.4} fill={P.lip} />;
  }
  if (state === 'MOUTH_SMILE') {
    return (
      <Path
        d="M -8.5 -20 Q 0 -13 8.5 -20"
        stroke={P.lip}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  return (
    <Path
      d="M -7.5 -19 Q 0 -16.5 7.5 -19"
      stroke={P.lip}
      strokeWidth={1.7}
      fill="none"
      strokeLinecap="round"
    />
  );
}

export function MaleHairFront() {
  return (
    <G>
      <Path
        d="M -24 -62 C -28 -78 -12 -92 2 -93 C 18 -92 32 -80 28 -62 C 22 -70 10 -76 0 -76 C -12 -76 -20 -70 -24 -62 Z"
        fill={P.hair}
      />
      <Path
        d="M -18 -58 C -16 -72 -4 -80 6 -78"
        stroke={P.hairHi}
        strokeWidth={2.2}
        fill="none"
        opacity={0.55}
        strokeLinecap="round"
      />
      <Path
        d="M -22 -52 C -14 -48 -6 -60 2 -54"
        fill={P.hairMid}
      />
      <Path
        d="M 8 -58 C 16 -50 22 -56 24 -48"
        fill={P.hairMid}
      />
    </G>
  );
}

export function MaleNeck() {
  return (
    <G>
      <Path
        d={`M -9 ${C - 2} C -10 14 -11 22 -10 28 L 10 28 C 11 22 10 14 9 ${C - 2} C 6 2 -6 2 -9 ${C - 2} Z`}
        fill={P.skinMid}
        stroke={P.outline}
        strokeWidth={1}
      />
      <NeckCoupler />
    </G>
  );
}

export function MaleTorso() {
  return (
    <G>
      <Path
        d="M -38 -198 C -44 -170 -40 -120 -28 -70 C -22 -30 -22 -8 -20 4 L 20 4 C 22 -8 22 -30 28 -70 C 40 -120 44 -170 38 -198 C 20 -210 -20 -210 -38 -198 Z"
        fill={P.tunic}
        stroke={P.outline}
        strokeWidth={1.25}
      />
      <Path
        d="M -22 -188 L 22 -188 L 14 -70 L -14 -70 Z"
        fill={P.tunicGreen}
        opacity={0.22}
      />
      <Path
        d="M -36 -196 C -18 -186 18 -186 36 -196 L 28 -176 C 12 -168 -12 -168 -28 -176 Z"
        fill={P.tunicFold}
      />
      <Path
        d="M -16 -198 L -10 -198 L -8 -70"
        stroke={P.tunicFold}
        strokeWidth={1.4}
        fill="none"
      />
      <Path
        d="M -20 2 C -8 12 8 12 20 2"
        fill={P.pants}
      />
      <Path
        d="M -12 -204 L 12 -204 L 10 -190 L -10 -190 Z"
        fill={P.tunicGold}
        opacity={0.85}
      />
    </G>
  );
}

function Limb({
  length,
  topR,
  botR,
  fill,
}: {
  length: number;
  topR: number;
  botR: number;
  fill: string;
}) {
  return (
    <Path
      d={`M ${-topR} 6 C ${-topR - 2} ${length * 0.35}, ${-botR - 1} ${length * 0.7}, ${-botR} ${length - 2}
          C ${-botR * 0.4} ${length + 3}, ${botR * 0.4} ${length + 3}, ${botR} ${length - 2}
          C ${botR + 1} ${length * 0.7}, ${topR + 2} ${length * 0.35}, ${topR} 6
          C ${topR * 0.4} -4, ${-topR * 0.4} -4, ${-topR} 6 Z`}
      fill={fill}
      stroke={P.outline}
      strokeWidth={1.15}
      strokeLinejoin="round"
    />
  );
}

export function MaleUpperArm() {
  return (
    <G>
      <Circle cx={0} cy={0} r={11} fill={P.skinMid} />
      <Limb length={B.upperArm} topR={11.5} botR={8.2} fill={P.skin} />
      <Circle cx={0} cy={B.upperArm} r={7.4} fill={P.skinMid} />
    </G>
  );
}

export function MaleForearm() {
  return (
    <G>
      <Circle cx={0} cy={0} r={7.6} fill={P.skinMid} />
      <Limb length={B.forearm} topR={8.4} botR={6.2} fill={P.skin} />
      <Circle cx={0} cy={B.forearm} r={5.8} fill={P.skinMid} />
    </G>
  );
}

export function MaleHand({ side }: { side: 'left' | 'right' }) {
  const s = side === 'left' ? -1 : 1;
  return (
    <G>
      <Ellipse cx={0} cy={11} rx={9.5} ry={12.5} fill={P.skin} stroke={P.outline} strokeWidth={1.05} />
      <Ellipse
        cx={s * 8.5}
        cy={5}
        rx={4.2}
        ry={6.4}
        fill={P.skin}
        stroke={P.outline}
        strokeWidth={0.95}
      />
      <Path
        d={`M ${-7} 18 C ${-6} 26 ${-2} 28 0 28 C 2 28 6 26 7 18`}
        fill={P.skinMid}
        stroke={P.outline}
        strokeWidth={0.9}
      />
    </G>
  );
}

export function MaleThigh() {
  return (
    <G>
      <Circle cx={0} cy={0} r={13} fill={P.pants} />
      <Limb length={B.thigh} topR={14} botR={9.5} fill={P.pants} />
      <Path
        d={`M -8 20 C -10 ${B.thigh * 0.45} -8 ${B.thigh * 0.75} -6 ${B.thigh - 8}`}
        stroke={P.pantsFold}
        strokeWidth={1.6}
        fill="none"
      />
      <Circle cx={0} cy={B.thigh} r={8.5} fill={P.pantsFold} />
    </G>
  );
}

export function MaleShin() {
  return (
    <G>
      <Circle cx={0} cy={0} r={8.6} fill={P.pantsFold} />
      <Limb length={B.shin} topR={9.2} botR={7} fill={P.pants} />
      <Circle cx={0} cy={B.shin} r={6.4} fill={P.skinMid} />
    </G>
  );
}

export function MaleFoot() {
  return (
    <G>
      <Path
        d="M -6 -7 C -14 -4 -14 6 -6 9 L 22 10 C 32 8 34 1 28 -4 C 18 -9 4 -10 -6 -7 Z"
        fill={P.shoes}
        stroke={P.outline}
        strokeWidth={1.1}
      />
      <Path d="M -2 -2 L 20 -1" stroke={P.shoesDark} strokeWidth={1.3} />
      <Circle cx={0} cy={0} r={5} fill={P.skinMid} />
    </G>
  );
}

export const MALE_SLOT_BOXES = {
  HEAD: { x: -28, y: -94, w: 56, h: 96 },
  NECK: { x: -12, y: -4, w: 24, h: 34 },
  TORSO: { x: -46, y: -214, w: 92, h: 222 },
  UPPER_ARM: { x: -14, y: -8, w: 28, h: B.upperArm + 16 },
  FOREARM: { x: -12, y: -6, w: 24, h: B.forearm + 12 },
  HAND: { x: -12, y: -4, w: 24, h: 32 },
  THIGH: { x: -16, y: -8, w: 32, h: B.thigh + 14 },
  SHIN: { x: -12, y: -6, w: 24, h: B.shin + 12 },
  FOOT: { x: -16, y: -12, w: 50, h: 24 },
} as const;

export type MaleMouthState = MouthSlotId;
