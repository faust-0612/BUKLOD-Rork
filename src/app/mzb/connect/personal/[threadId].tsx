import React from 'react';

import {
  useLocalSearchParams,
} from 'expo-router';

import BuklodConnectThread
  from '@/components/BuklodConnectThread';


/* PATCH_169C_MZB_DIRECT_THREAD */

export default function
MzbPersonalThreadScreen() {
  const params =
    useLocalSearchParams<{
      threadId?: string;
    }>();

  const threadId =
    Array.isArray(
      params.threadId
    )
      ? params.threadId[0]
      : params.threadId;

  if (!threadId) {
    return null;
  }

  return (
    
      <BuklodConnectThread
        mode="direct"
        containerId={
          threadId
        }
      />
    
  );
}