import React from 'react';

import {
  useLocalSearchParams,
} from 'expo-router';

import BuklodConnectThread
  from '@/components/BuklodConnectThread';


/* PATCH_169C_MZB_SCOPE_THREAD */

export default function
MzbCommunityThreadScreen() {
  const params =
    useLocalSearchParams<{
      scopeId?: string;
    }>();

  const scopeId =
    Array.isArray(
      params.scopeId
    )
      ? params.scopeId[0]
      : params.scopeId;

  if (!scopeId) {
    return null;
  }

  return (
    
      <BuklodConnectThread
        mode="scope"
        containerId={
          scopeId
        }
      />
    
  );
}