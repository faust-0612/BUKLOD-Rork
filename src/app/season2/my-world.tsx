import React from 'react';
import {Redirect} from 'expo-router';
import Season2DevelopmentMap from '@/features/season2/world/Season2DevelopmentMap';
import {isGenesisPreviewBuild} from '@/features/season2/genesis/genesisContract';
export default function MyWorld() {
  return isGenesisPreviewBuild() ? <Season2DevelopmentMap world="home" /> : <Redirect href="/personal-home" />;
}
