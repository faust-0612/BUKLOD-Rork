import React, {
  useMemo,
  useState,
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

type Tab = 'personal' | 'community';

type Props = {
  tab: Tab;
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
    requestsInfo: {
      paddingHorizontal: 20,
      paddingBottom: 8,
      color: HIBLA.muted,
      fontSize: 11,
      lineHeight: 16,
    },
  });
}

export function ConnectInboxTabs({
  tab,
  communityFilter,
  onTabChange,
  onCommunityFilterChange,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const [requestsInfo, setRequestsInfo] = useState(false);
  const selectCommunity = (filter: CommunityFilterKey) => {
    setRequestsInfo(false);
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
        onPress={() => { setRequestsInfo(false); onTabChange('personal'); }}
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
        accessibilityLabel="Message requests information"
        onPress={() => setRequestsInfo(current => !current)}
        style={styles.tab}
      >
        <Text style={styles.label}>Requests</Text>
        <View style={styles.requestsDot} />
      </ConnectPressable>
    </View>
    {requestsInfo && (
      <Text style={styles.requestsInfo}>
        Hindi pa available ang hiwalay na Requests inbox. Nasa aktuwal na Personal at group conversations ang mga mensahe mo.
      </Text>
    )}
    </>
  );
}

