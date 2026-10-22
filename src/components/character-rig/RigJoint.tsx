import React from 'react';

import { Animated } from 'react-native';
import { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import type { SlotBox } from '@/lib/character-rig/contract';

const AnimatedG = Animated.createAnimatedComponent(G);

type Props = {
  /** Pivot in parent-local space. */
  x: number;
  y: number;
  /** Degrees. Interpolated onto SVG rotate(a 0 0) around THIS joint. */
  angle: Animated.Value;
  children: React.ReactNode;
  debug?: boolean;
  debugLabel?: string;
  debugBox?: SlotBox;
  /** Child bone endpoint in this joint's rest local space (before rotation). */
  debugBoneTo?: { x: number; y: number };
};

/**
 * Canonical joint:
 *   translate to pivot  →  rotate around local (0,0)  →  children in local space
 *
 * Never uses react-native-svg `rotation`/`originX` (those orbit the bbox center
 * and detach the head from the neck).
 */
export default function RigJoint({
  x,
  y,
  angle,
  children,
  debug = false,
  debugLabel,
  debugBox,
  debugBoneTo,
}: Props) {
  const transform = angle.interpolate({
    inputRange: [-180, 180],
    outputRange: ['rotate(-180 0 0)', 'rotate(180 0 0)'],
  });

  return (
    <G x={x} y={y}>
      <AnimatedG transform={transform}>
        {children}
        {debug ? (
          <G pointerEvents="none">
            {debugBox ? (
              <Rect
                x={debugBox.x}
                y={debugBox.y}
                width={debugBox.w}
                height={debugBox.h}
                fill="none"
                stroke="rgba(80,200,255,0.55)"
                strokeWidth={1}
                strokeDasharray="3 2"
              />
            ) : null}
            {debugBoneTo ? (
              <Line
                x1={0}
                y1={0}
                x2={debugBoneTo.x}
                y2={debugBoneTo.y}
                stroke="rgba(255,210,70,0.9)"
                strokeWidth={1.6}
              />
            ) : null}
            <Circle
              cx={0}
              cy={0}
              r={4}
              fill="#FF3B30"
              stroke="#FFFFFF"
              strokeWidth={1}
            />
            {debugLabel ? (
              <SvgText
                x={6}
                y={-6}
                fill="#FFE08A"
                fontSize={7}
                fontWeight="700"
              >
                {`${debugLabel} (${Math.round(x)},${Math.round(y)})`}
              </SvgText>
            ) : null}
          </G>
        ) : null}
      </AnimatedG>
    </G>
  );
}
