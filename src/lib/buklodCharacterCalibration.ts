import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_BODY_TRANSFORMS,
  type BodyTransformOverrides,
  type LayerTransformOverride,
} from '@/lib/buklodCharacterFrames';
import type { BodyId } from '@/lib/character-lab-core/types';

export const BUKLOD_CHARACTER_CALIBRATION_KEY =
  'buklod_character_calibration_v1';

export type CalibrationStore = Partial<
  Record<BodyId, BodyTransformOverrides>
>;

export const DEFAULT_CALIBRATION: CalibrationStore = {
  female: { ...DEFAULT_BODY_TRANSFORMS.female },
  male: { ...DEFAULT_BODY_TRANSFORMS.male },
};

export async function loadCharacterCalibration(): Promise<CalibrationStore> {
  try {
    const raw = await AsyncStorage.getItem(
      BUKLOD_CHARACTER_CALIBRATION_KEY
    );
    if (!raw) return { ...DEFAULT_CALIBRATION };

    const parsed = JSON.parse(raw) as CalibrationStore;
    return {
      female: {
        ...DEFAULT_CALIBRATION.female,
        ...parsed.female,
      },
      male: {
        ...DEFAULT_CALIBRATION.male,
        ...parsed.male,
      },
    };
  } catch {
    return { ...DEFAULT_CALIBRATION };
  }
}

export async function saveCharacterCalibration(
  store: CalibrationStore
) {
  await AsyncStorage.setItem(
    BUKLOD_CHARACTER_CALIBRATION_KEY,
    JSON.stringify(store)
  );
}

export async function saveLayerCalibration(
  body: BodyId,
  assetKey: string,
  transform: LayerTransformOverride
) {
  const current = await loadCharacterCalibration();
  const bodyOverrides = { ...(current[body] ?? {}) };
  bodyOverrides[assetKey] = transform;
  await saveCharacterCalibration({
    ...current,
    [body]: bodyOverrides,
  });
}

export function getLayerTransform(
  store: CalibrationStore,
  body: BodyId,
  assetKey: string
): LayerTransformOverride | null {
  return store[body]?.[assetKey] ?? null;
}
