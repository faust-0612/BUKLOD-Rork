import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import BuklodConnectThread from '@/components/BuklodConnectThread';

export default function PersonalConnectThreadRoute() {
  const params = useLocalSearchParams<{ threadId?: string | string[] }>();
  const threadId = Array.isArray(params.threadId) ? params.threadId[0] : params.threadId;
  if (!threadId) return null;
  return <BuklodConnectThread mode="direct" containerId={threadId} />;
}
