import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import BuklodConnectThread from '@/components/BuklodConnectThread';

export default function CommunityConnectThreadRoute() {
  const params = useLocalSearchParams<{ scopeId?: string | string[] }>();
  const scopeId = Array.isArray(params.scopeId) ? params.scopeId[0] : params.scopeId;
  if (!scopeId) return null;
  return <BuklodConnectThread mode="scope" containerId={scopeId} />;
}
