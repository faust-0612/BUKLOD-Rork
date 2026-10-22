import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { setChurchMapLocation } from '@/lib/buklodChurchFinder';
import BuklodWorshipLocationPicker from '@/components/BuklodWorshipLocationPicker';

export default function BuklodChurchMapLocationEditor({
  scopeId,
  initialLabel,
  initialLatitude,
  initialLongitude,
  disabled,
  onSaved,
}: {
  scopeId: string;
  initialLabel?: string | null;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  disabled?: boolean;
  onSaved?: () => void;
}) {
  const [label, setLabel] = useState(initialLabel ?? '');
  const [latitude, setLatitude] = useState<number | null>(
    initialLatitude ?? null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    initialLongitude ?? null,
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    if (
      latitude == null ||
      longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      Alert.alert(
        'Church location',
        'Place the worship pin on the map, or use current location.',
      );
      return;
    }

    if (!label.trim()) {
      Alert.alert(
        'Church location',
        'Add a public-safe location label, such as Sta. Ines, Tanay.',
      );
      return;
    }

    setBusy(true);
    try {
      await setChurchMapLocation({
        scopeId,
        latitude,
        longitude,
        safeLocationLabel: label,
      });
      onSaved?.();
      Alert.alert('Church location', 'Worship location saved.');
    } catch (error: unknown) {
      Alert.alert(
        'Church location',
        error instanceof Error ? error.message : 'Could not save location.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <BuklodWorshipLocationPicker
        label={label}
        onLabelChange={setLabel}
        latitude={latitude}
        longitude={longitude}
        onCoordinatesChange={(coords) => {
          setLatitude(coords.latitude);
          setLongitude(coords.longitude);
        }}
        disabled={disabled || busy}
      />
      <Pressable
        disabled={disabled || busy}
        onPress={() => void save()}
        style={[styles.save, (disabled || busy) && styles.disabled]}
      >
        <Text style={styles.saveText}>SAVE WORSHIP LOCATION</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  save: {
    minHeight: 39,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D6A4F',
    alignSelf: 'flex-start',
  },
  saveText: {
    color: '#2D6A4F',
    fontWeight: '900',
    fontSize: 10,
  },
  disabled: {
    opacity: 0.45,
  },
});
