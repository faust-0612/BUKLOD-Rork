import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AdminGate } from '@/components/AdminGate';
import KlPublishingStudio from '@/components/kabihasnang-ligaw/KlPublishingStudio';
import KlEditorRenderBoundary from '@/components/kabihasnang-ligaw/KlEditorRenderBoundary';
import { colors } from '@/lib/theme';

// The legacy light-background Story Management desk has been retired.
// The sole editor here is the KL Content Creation Studio; manuscript/media
// approval and release remain in the protected Community Wall KL Admin card.
export default function KabihasnangLigawAdminScreen() {
  return (
    <AdminGate>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <KlEditorRenderBoundary><KlPublishingStudio /></KlEditorRenderBoundary>
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, backgroundColor: colors.background, paddingBottom: 40 },
});
