import React from 'react';
import { View } from 'react-native';

import { BuklodSystemAnnouncementBoard } from '@/components/BuklodSystemAnnouncementBoard';
import BuklodHomeScopeBulletins from '@/components/BuklodHomeScopeBulletins';

/**
 * The former Public Home's announcement/Quiz and bulletin features live here.
 * Mounted only when the user expands Updates on the lightweight /hub Home.
 * Daily encouragement is already displayed by BuklodDashboardContextBar.
 */
export default function BuklodHomeMergedUpdates() {
  return (
    <View style={{ gap: 10 }}>
      <BuklodSystemAnnouncementBoard slot="public_home" />
      <BuklodHomeScopeBulletins />
    </View>
  );
}
