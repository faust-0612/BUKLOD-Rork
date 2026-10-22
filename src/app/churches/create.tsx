import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { BUKLOD_ORGANIZATION_TYPE_CHURCH } from '@/lib/buklodCommercialCatalog';

export default function CreateChurchScreen() {
  useEffect(() => {
    router.replace({
      pathname: '/organizations/create' as any,
      params: { type: BUKLOD_ORGANIZATION_TYPE_CHURCH },
    } as any);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
