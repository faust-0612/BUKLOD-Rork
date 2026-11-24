import React from 'react';
import { Tabs } from 'expo-router';
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Android-only persistent dashboard navigator.
 *
 * A Stack pops previously visited dashboards on a return to an older entry,
 * causing Wall/Connect/Profile to cold-mount again. Tabs retain each mounted
 * screen across direct switches. Unvisited screens stay lazy; blurred ones are
 * frozen and native-detached to avoid offscreen video / AdMob work.
 *
 * The one visible BUKLOD bottom bar remains owned by BuklodNavSafeShell.
 * No route is preloaded offscreen: doing so could start ad/media network work.
 */
export default function BuklodAndroidDashboardTabs({
  showPrayer,
  sceneStyle,
}: {
  showPrayer: boolean;
  sceneStyle: StyleProp<ViewStyle>;
}) {
  return (
    <Tabs
      initialRouteName={isGenesisPreviewBuild() ? 'hub' : 'buklod'}
      tabBar={() => null}
      backBehavior="history"
      detachInactiveScreens
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        animation: 'none',
        sceneStyle,
      }}
    >
      <Tabs.Screen name="buklod" options={{ title: 'Wall' }} />
      <Tabs.Screen name="home" options={{ title: 'Home (legacy)' }} />
      <Tabs.Screen name="hub" options={{ title: 'Home' }} />
      <Tabs.Screen name="messages" options={{ title: 'Connect' }} />
      {showPrayer ? <Tabs.Screen name="prayer" options={{ title: 'Prayer' }} /> : null}
      <Tabs.Screen name="me" options={{ title: 'Profile' }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn' }} />
    </Tabs>
  );
}
