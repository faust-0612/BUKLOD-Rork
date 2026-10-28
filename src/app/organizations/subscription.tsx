import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodOrganizationFocusSubscriptionCard from '@/components/BuklodOrganizationFocusSubscriptionCard';
import { readOrganizationScopeId } from '@/lib/buklodOrganization';
import {
  formatBuklodAddressQuery,
  geocodeBuklodAddress,
} from '@/lib/buklodGeocode';
import { supabase } from '@/lib/supabase';

export default function OrganizationSubscriptionScreen() {
  const params = useLocalSearchParams();
  const scopeId = readOrganizationScopeId(params as Record<string, unknown>);
  const name =
    typeof params.organizationName === 'string'
      ? params.organizationName
      : 'Organization';

  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);

  const saveLocation = useCallback(async () => {
    if (!scopeId) return;
    const query = formatBuklodAddressQuery({
      addressLine: address,
      cityMunicipality: city,
      country: 'Philippines',
    });
    setBusy(true);
    try {
      const coords = await geocodeBuklodAddress(query);
      const { error } = await (supabase as any).rpc(
        'buklod_upsert_organization_location_v1',
        {
          p_scope_id: scopeId,
          p_address_line: address.trim() || null,
          p_city: city.trim() || null,
          p_safe_label: [city.trim(), address.trim()].filter(Boolean).join(', ') || null,
          p_latitude: coords?.latitude ?? null,
          p_longitude: coords?.longitude ?? null,
          p_geocode_status: coords ? 'ok' : 'failed',
          p_geocode_query: query,
        },
      );
      if (error) throw error;
      Alert.alert(
        'Location',
        coords
          ? 'Church coordinates were saved for Find a Church.'
          : 'Address saved. Coordinates could not be geocoded yet. You can retry.',
      );
    } catch (error: any) {
      Alert.alert('Location', String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  }, [address, city, scopeId]);

  return (
    <>
      <Stack.Screen options={{ title: 'Organization Location & Focus Apps' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <BuklodOrganizationFocusSubscriptionCard
          organizationId={scopeId}
          organizationName={name}
        />

        <View style={styles.card}>
          <Text style={styles.title}>Church location (optional)</Text>
          <Text style={styles.hint}>
            For Church Organizations, save or retry geocoding here. Missing
            coordinates will not crash Find a Church; the church just stays out
            of Nearby until a valid location exists.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="City / Municipality"
            value={city}
            onChangeText={setCity}
          />
          <TextInput
            style={styles.input}
            placeholder="Street / barangay / landmark"
            value={address}
            onChangeText={setAddress}
          />
          <Pressable
            disabled={busy}
            onPress={() => void saveLocation()}
            style={[styles.button, busy && { opacity: 0.55 }]}
          >
            <Text style={styles.buttonText}>
              {busy ? 'SAVING...' : 'SAVE / RETRY GEOCODING'}
            </Text>
          </Pressable>
        </View>
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: '900', color: '#173B2F' },
  hint: { fontSize: 11, lineHeight: 16, color: '#6E7E76' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 12,
    paddingHorizontal: 11,
    color: '#173B2F',
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A4F',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
});
