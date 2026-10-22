import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import * as QRCode from 'qrcode';

type Props = {
  value: string;
  size?: number;
};

export function BuklodQrMatrix({ value, size = 216 }: Props) {
  const matrix = useMemo(() => {
    const created = QRCode.create(value, {
      errorCorrectionLevel: 'M',
    });

    return {
      count: created.modules.size,
      raw: created.modules.data,
    };
  }, [value]);

  const cell = size / matrix.count;
  const blocks: React.ReactNode[] = [];

  for (let row = 0; row < matrix.count; row += 1) {
    for (let col = 0; col < matrix.count; col += 1) {
      const index = row * matrix.count + col;

      if (!matrix.raw[index]) {
        continue;
      }

      blocks.push(
        <Rect
          key={`${row}-${col}`}
          x={col * cell}
          y={row * cell}
          width={cell + 0.15}
          height={cell + 0.15}
          fill="#000000"
        />
      );
    }
  }

  return (
    <View style={styles.frame}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
        {blocks}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E5E2',
  },
});
