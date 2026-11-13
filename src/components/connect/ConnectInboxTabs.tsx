import { buklodVisual } from '@/lib/buklodVisual';
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
import type { CommunityFilterKey } from '@/lib/connectTheme';

type Tab = 'personal' | 'community' | 'requests';

type Props = {
  tab: Tab;
  requestCount: number;
  personalUnread: number;
  clusterUnread: number;
  orgUnread: number;
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
      paddingVertical: 6,
      marginBottom: 2,
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
      borderRadius: buklodVisual.radius.control,
      backgroundColor: theme.inputSurface,
    },
    tabActive: {
      backgroundColor: theme.accent,
    },
    label: {
      ...connectTypography.tabLabel,
      color: theme.textMuted,
      fontSize: 12,
    },
    labelActive: {
      color: '#FFFFFF',
    },
    unreadBadge: {
      position: 'absolute',
      top: -4,
      right: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#C62828',
    },
    unreadBadgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
      lineHeight: 12,
    },
    requestsDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#C62828',
    },
  });
}

export function ConnectInboxTabs({
  tab,
  requestCount,
  personalUnread,
  clusterUnread,
  orgUnread,
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
  const unreadBadge = (count: number) =>
    count > 0 ? (
      <View pointerEvents="none" style={styles.unreadBadge}>
        <Text style={styles.unreadBadgeText}>
          {count > 99 ? '99+' : count}
        </Text>
      </View>
    ) : null;

  return (
    <>
    <View style={styles.wrap}>
      <ConnectPressable
        accessibilityRole="button"
        accessibilityState={{
          selected: tab === 'personal',
        }}
        accessibilityLabel={`Personal, ${personalUnread} unread messages`}
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
              : theme.textMuted
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
        {unreadBadge(personalUnread)}
      </ConnectPressable>

      <ConnectPressable
        accessibilityRole="button"
        accessibilityState={{
          selected: clusterSelected,
        }}
        accessibilityLabel={`Cluster, ${clusterUnread} unread messages`}
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
              : theme.textMuted
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
        {unreadBadge(clusterUnread)}
      </ConnectPressable>

      <ConnectPressable
        accessibilityRole="button"
        accessibilityState={{ selected: orgSelected }}
        accessibilityLabel={`Organization, ${orgUnread} unread messages`}
        instant
        nested={false}
        onPress={() => selectCommunity('organization')}
        style={[styles.tab, orgSelected && styles.tabActive]}
      >
        <MaterialCommunityIcons
          name="account-multiple-outline"
          size={15}
          color={orgSelected ? '#FFFFFF' : theme.textMuted}
        />
        <Text style={[styles.label, orgSelected && styles.labelActive]}>Org</Text>
        {unreadBadge(orgUnread)}
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

