import React from 'react';
import { Redirect } from 'expo-router';
import BuklodConnectStandaloneHome from '@/components/BuklodConnectStandaloneHome';
import { isBuklodConnectStandalone } from '@/lib/buklodConnectStandalone';

export default function ConnectIndexRedirect() {
  if (isBuklodConnectStandalone) return <BuklodConnectStandaloneHome />;
  return <Redirect href="/messages" />;
}
