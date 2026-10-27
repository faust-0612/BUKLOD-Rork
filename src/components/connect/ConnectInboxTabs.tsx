import React, {
  useMemo,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  connectTypography,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';
import { HIBLA } from '@/lib/connectHibla';
import type { CommunityFilterKey } from '@/lib/connectTheme';

type Tab = 'personal' | 'community' | 'requests';

type Props = {
  tab: Tab;
  requestCount: number;
  communityFilter: CommunityFilterKey;
  onTabChange: (tab: Tab) => void;
  onCommunityFilterChange: (filter: CommunityFilterKey) => void;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    wrap: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 6,
      backgroundColor: 'transparent',
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      minHeight: 44,
      paddingVertical: 8,
      paddingHorizontal: 5,
      borderRadius: 24,
      backgroundColor: '#ECF5EE',
    },
    tabActive: {
      backgroundColor: HIBLA.pine,
    },
    label: {
      ...connectTypography.tabLabel,
      color: HIBLA.muted,
      fontSize: 12,
    },
    labelActive: {
      color: '#FFFFFF',
    },
    requestsDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#D89B24',
    },
  });
}

export function ConnectInboxTabs({
  tab,
  requestCount,
  communityFilter,
  onTabChange,
  onCommunityFilterChange,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const selectCommunity = (filter: CommunityFilterKey) => {
    onCommunityFilterChange(filter);
    onTabChange('community');
  };

  const clusterSelected = tab === 'community' && communityFilter === 'cluster';
  const orgSelected = tab === 'community' && communityFilter === 'organization';

  return (
    <>
    <View style={styles.wrap}>
      <ConnectPressable
        accessibilityRole="button"
        accessibilityState={{
          selected: tab === 'personal',
        }}
        instant
        nested={false}
        onPress={() => onTabChange('personal')}
        style={[
          styles.tab,
          tab === 'personal' && styles.tabActive,
        ]}
      >
        <MaterialCommunityIcons
          name="message-text-outline"
          size={15}
          color={
            tab === 'personal'
              ? '#FFFFFF'
              : HIBLA.muted
          }
        />
        <Text
          style={[
            styles.label,
            tab === 'personal' && styles.labelActive,
          ]}
        >
          Personal
        </Text>
      </ConnectPressable>

      <ConnectPressable
        accessibilityRole="button"
        accessibilityState={{
          selected: clusterSelected,
        }}
        instant
        nested={false}
        onPress={() => selectCommunity('cluster')}
        style={[
          styles.tab,
          clusterSelected && styles.tabActive,
        ]}
      >
        <MaterialCommunityIcons
          name="account-group-outline"
          size={15}
          color={
            clusterSelected
              ? '#FFFFFF'
              : HIBLA.muted
          }
        />
        <Text
          style={[
            styles.label,
            clusterSelected && styles.labelActive,
          ]}
        >
          Cluster
        </Text>
      </ConnectPressable>

      <ConnectPressable
        accessibilityRole="button"
        accessibilityState={{ selected: orgSelected }}
        instant
        nested={false}
        onPress={() => selectCommunity('organization')}
        style={[styles.tab, orgSelected && styles.tabActive]}
      >
        <MaterialCommunityIcons
          name="account-multiple-outline"
          size={15}
          color={orgSelected ? '#FFFFFF' : HIBLA.muted}
        />
        <Text style={[styles.label, orgSelected && styles.labelActive]}>Org</Text>
      </ConnectPressable>

      <ConnectPressable
        accessibilityRole="button"
        accessibilityLabel={`Message requests, ${requestCount} pending`}
        accessibilityState={{ selected: tab === 'requests' }}
        instant
        nested={false}
        onPress={() => onTabChange('requests')}
        style={[styles.tab, tab === 'requests' && styles.tabActive]}
      >
        <Text style={[styles.label, tab === 'requests' && styles.labelActive]}>
          Requests
        </Text>
        {requestCount > 0 && <View style={styles.requestsDot} />}
      </ConnectPressable>
    </View>
    </>
  );
}

