import React, { useCallback, useEffect, useState } from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';
import {
  loadCharacterCalibration,
  saveLayerCalibration,
} from '@/lib/buklodCharacterCalibration';
import type { LayerTransformOverride } from '@/lib/buklodCharacterFrames';
import { LAYER_PLACEMENTS } from '@/lib/character-lab-core/assets';
import type { BodyId } from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  selectedAssetKey: string | null;
  onSelectAssetKey: (key: string) => void;
  onSaved?: () => void;
};

const SLIDER_KEYS: (keyof LayerTransformOverride)[] = [
  'scale',
  'offsetX',
  'offsetY',
  'anchorX',
  'anchorY',
];

const DEFAULT_TRANSFORM: LayerTransformOverride = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  anchorX: 50,
  anchorY: 100,
};

function Stepper({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const { theme } = useBuklodPresentation();

  return (
    <View style={styles.stepperRow}>
      <Text style={[styles.stepperLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
          style={[styles.stepBtn, { borderColor: theme.border }]}
        >
          <Text style={{ color: theme.textPrimary }}>−</Text>
        </Pressable>
        <Text style={[styles.stepValue, { color: theme.textPrimary }]}>
          {value.toFixed(2)}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
          style={[styles.stepBtn, { borderColor: theme.border }]}
        >
          <Text style={{ color: theme.textPrimary }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** __DEV__ calibration sliders for per-layer transforms. */
export default function BuklodCharacterCalibrationPanel({
  body,
  selectedAssetKey,
  onSelectAssetKey,
  onSaved,
}: Props) {
  const { theme } = useBuklodPresentation();
  const assetKeys = Object.keys(LAYER_PLACEMENTS).sort();
  const [transform, setTransform] =
    useState<LayerTransformOverride>(DEFAULT_TRANSFORM);

  useEffect(() => {
    if (!selectedAssetKey) return;
    void loadCharacterCalibration().then((store) => {
      setTransform(
        store[body]?.[selectedAssetKey] ?? DEFAULT_TRANSFORM
      );
    });
  }, [body, selectedAssetKey]);

  const update = useCallback(
    (key: keyof LayerTransformOverride, value: number) => {
      setTransform((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const save = async () => {
    if (!selectedAssetKey) return;
    await saveLayerCalibration(body, selectedAssetKey, transform);
    onSaved?.();
  };

  if (!__DEV__) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          borderColor: withAlpha(theme.warning, 0.4),
          backgroundColor: withAlpha(theme.surface, 0.94),
        },
      ]}
    >
      <Text style={[styles.banner, { color: theme.warning }]}>
        DEV CALIBRATION
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.assetRow}
      >
        {assetKeys.map((key) => (
          <Pressable
            key={key}
            onPress={() => onSelectAssetKey(key)}
            style={[
              styles.assetChip,
              {
                borderColor:
                  selectedAssetKey === key
                    ? theme.warning
                    : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.assetChipText,
                {
                  color:
                    selectedAssetKey === key
                      ? theme.warning
                      : theme.textSecondary,
                },
              ]}
            >
              {key}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {selectedAssetKey ? (
        <>
          {SLIDER_KEYS.map((key) => (
            <Stepper
              key={key}
              label={key}
              value={transform[key]}
              step={key === 'scale' ? 0.01 : 0.5}
              min={key === 'scale' ? 0.5 : -20}
              max={key === 'scale' ? 1.5 : 120}
              onChange={(value) => update(key, value)}
            />
          ))}

          <Pressable
            onPress={() => void save()}
            style={[
              styles.saveBtn,
              { backgroundColor: withAlpha(theme.warning, 0.2) },
            ]}
          >
            <Text style={[styles.saveText, { color: theme.warning }]}>
              SAVE CALIBRATION
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Select a layer asset key above.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  banner: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  assetRow: {
    gap: 6,
    paddingVertical: 4,
  },
  assetChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  assetChipText: {
    fontSize: 8,
    fontWeight: '800',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepperLabel: {
    fontSize: 10,
    fontWeight: '800',
    width: 64,
    textTransform: 'uppercase',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontSize: 11,
    fontWeight: '800',
    minWidth: 48,
    textAlign: 'center',
  },
  saveBtn: {
    marginTop: 4,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  hint: {
    fontSize: 10,
    textAlign: 'center',
  },
});
