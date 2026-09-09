import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';

type Props = {
  intensity: 1 | 2 | 3;
  progress: number;
};

const leftCanopy = Skia.Path.Make();
leftCanopy.moveTo(0, 0);
leftCanopy.lineTo(150, 0);
leftCanopy.cubicTo(115, 105, 125, 210, 58, 330);
leftCanopy.lineTo(0, 380);
leftCanopy.close();

const rightCanopy = Skia.Path.Make();
rightCanopy.moveTo(390, 0);
rightCanopy.lineTo(260, 0);
rightCanopy.cubicTo(294, 105, 280, 220, 346, 335);
rightCanopy.lineTo(390, 385);
rightCanopy.close();

export function ForestEnvironment({ intensity, progress }: Props) {
  const depthOpacity = 0.18 + intensity * 0.05;
  const glowOpacity = 0.08 + Math.min(0.18, progress / 600);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={390} height={780}>
          <LinearGradient
            start={vec(195, 80)}
            end={vec(195, 720)}
            colors={['rgba(11,42,30,0.05)', 'rgba(2,12,8,0.34)', 'rgba(0,4,2,0.62)']}
          />
        </Rect>

        <Group opacity={depthOpacity}>
          <Path path={leftCanopy} color="#04140d" />
          <Path path={rightCanopy} color="#04140d" />
        </Group>

        <Group opacity={0.32}>
          <Rect x={18} y={118} width={18} height={500} color="#2a241b" />
          <Rect x={352} y={96} width={20} height={530} color="#2a241b" />
          <Rect x={66} y={208} width={10} height={370} color="#3b3023" />
          <Rect x={310} y={188} width={11} height={390} color="#3b3023" />
        </Group>

        <Group blendMode="screen" opacity={glowOpacity}>
          <Circle cx={108} cy={260} r={7} color="#eaff9f"><BlurMask blur={9} /></Circle>
          <Circle cx={278} cy={225} r={5} color="#eaff9f"><BlurMask blur={8} /></Circle>
          <Circle cx={325} cy={340} r={6} color="#d8ffab"><BlurMask blur={10} /></Circle>
          <Circle cx={75} cy={390} r={4} color="#f1ffc1"><BlurMask blur={8} /></Circle>
          <Circle cx={205} cy={180} r={4} color="#eaff9f"><BlurMask blur={8} /></Circle>
          <Circle cx={242} cy={410} r={5} color="#eaff9f"><BlurMask blur={9} /></Circle>
        </Group>

        <Group opacity={0.08 + intensity * 0.025}>
          <Rect x={0} y={330} width={390} height={55} color="#d9ffe6"><BlurMask blur={24} /></Rect>
          <Rect x={0} y={470} width={390} height={72} color="#d9ffe6"><BlurMask blur={30} /></Rect>
        </Group>
      </Canvas>
    </View>
  );
}
