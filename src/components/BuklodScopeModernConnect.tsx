import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';

import BuklodConnectThread from '@/components/BuklodConnectThread';
import type { BuklodScope } from '@/lib/buklodScope';

type Props = {
  scope: BuklodScope;
  onOpenCommunity?: () => void;
};

export default function BuklodScopeModernConnect({
  scope,
}: Props) {
  const scopeType = String(
    scope.scope_type ?? 'COMMUNITY',
  ).toUpperCase();

  return (
    <View style={styles.chatScreen}>
      <BuklodConnectThread
        mode="scope"
        containerId={scope.scope_id}
        initialTitle={scope.name}
        initialSubtitle={`${scopeType} \u2022 AUTOMATIC ROOM`}
        onBackOverride={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chatScreen: {
    flex: 1,
    minHeight: 0,
  },
});
