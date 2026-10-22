import React from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PermissionStatus } from 'expo-location';

import {
  getBuklodForegroundLocation,
  requestBuklodForegroundPermission,
} from '@/lib/buklodLocation';

export default function BuklodWorshipLocationPicker({
  label,
  onLabelChange,
  latitude,
  longitude,
  onCoordinatesChange,
  disabled,
  showCard = true,
}: {
  label: string;
  onLabelChange: (value: string) => void;
  latitude: number | null;
  longitude: number | null;
  onCoordinatesChange: (coords: { latitude: number; longitude: number }) => void;
  disabled?: boolean;
  showCard?: boolean;
}) {
  const pin =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
      ? { latitude, longitude }
      : null;

  async function useCurrent() {
    const permission = await requestBuklodForegroundPermission();
    if (permission.status !== PermissionStatus.GRANTED) {
      Alert.alert(
        'Worship location',
        'Allow location to place the worship pin where the church gathers. This is not used as a home address.',
      );
      return;
    }

    const result = await getBuklodForegroundLocation();
    if (!result.ok) {
      Alert.alert('Worship location', result.message);
      return;
    }

    onCoordinatesChange(result.coords);
  }

  const body = (
    <>
      <Text style={styles.label}>PUBLIC-SAFE LOCATION LABEL</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={onLabelChange}
        placeholder="Sta. Ines, Tanay"
        editable={!disabled}
      />
      <Text style={styles.hint}>
        Use a public place name people can recognize. Do not enter a member
        home address or a full street address.
      </Text>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>LATITUDE</Text>
          <TextInput
            style={styles.input}
            value={pin ? String(pin.latitude) : ''}
            onChangeText={(value) => {
              const nextLat = Number(value);
              if (!Number.isFinite(nextLat)) return;
              onCoordinatesChange({
                latitude: nextLat,
                longitude: pin?.longitude ?? 0,
              });
            }}
            keyboardType="decimal-pad"
            editable={!disabled}
          />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>LONGITUDE</Text>
          <TextInput
            style={styles.input}
            value={pin ? String(pin.longitude) : ''}
            onChangeText={(value) => {
              const nextLng = Number(value);
              if (!Number.isFinite(nextLng)) return;
              onCoordinatesChange({
                latitude: pin?.latitude ?? 0,
                longitude: nextLng,
              });
            }}
            keyboardType="decimal-pad"
            editable={!disabled}
          />
        </View>
      </View>

      <Text style={styles.hint}>
        On this device, place the worship pin with current location or by
        entering coordinates. A map preview is available in the phone app.
      </Text>

      <Pressable
        disabled={disabled}
        onPress={() => void useCurrent()}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Text style={styles.buttonText}>USE CURRENT LOCATION</Text>
      </Pressable>
      <Text style={styles.hint}>
        Places the worship pin at this device&apos;s current location. Use this
        at the church gathering place, not at a member&apos;s house.
      </Text>
    </>
  );

  if (!showCard) {
    return <View style={styles.stack}>{body}</View>;
  }

  return <View style={styles.card}>{body}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 15,
    padding: 14,
    gap: 8,
  },
  stack: {
    gap: 8,
  },
  label: {
    color: '#496056',
    fontWeight: '900',
    fontSize: 11,
  },
  hint: {
    color: '#748079',
    fontSize: 12,
    lineHeight: 18,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D8E1DC',
    backgroundColor: '#FAFBFA',
    borderRadius: 11,
    paddingHorizontal: 11,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
    gap: 6,
  },
  map: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
  },
  button: {
    minHeight: 39,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 10,
  },
  disabled: {
    opacity: 0.45,
  },
});
