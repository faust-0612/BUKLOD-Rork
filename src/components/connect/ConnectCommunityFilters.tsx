import React, {
  useMemo,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  COMMUNITY_FILTER_LABELS,
  connectRadii,
  connectSpacing,
  connectTypography,
  type CommunityFilterKey,
  type ConnectThemeRoles,
} from '@/lib/connectTheme';
import {
  useConnectTheme,
} from '@/providers/ConnectThemeProvider';
import {
  ConnectPressable,
} from '@/components/connect/ConnectPressable';

const FILTER_ORDER: CommunityFilterKey[] = [
  'all',
  'organization',
  'sub_org',
  'cluster',
  'location',
];

type Props = {
  active: CommunityFilterKey;
  onChange: (filter: CommunityFilterKey) => void;
};

function createStyles(theme: ConnectThemeRoles) {
  return StyleSheet.create({
    wrap: {
      paddingBottom: 6,
    },
    scroll: {
      paddingHorizontal: connectSpacing.screenHorizontal,
      gap: 8,
    },
    pill: {
      minHeight: 36,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: connectRadii.filterPill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillActive: {
      borderColor: theme.accent,
      backgroundColor: theme.filterPillActive,
    },
    pillText: {
      ...connectTypography.filterPill,
      color: theme.textSecondary,
    },
    pillTextActive: {
      color: theme.filterPillActiveText,
    },
  });
}

export function ConnectCommunityFilters({
  active,
  onChange,
}: Props) {
  const { theme } = useConnectTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {FILTER_ORDER.map(key => {
          const selected = active === key;

          return (
            <ConnectPressable
              key={key}
              onPress={() => onChange(key)}
              style={[
                styles.pill,
                selected && styles.pillActive,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  selected && styles.pillTextActive,
                ]}
              >
                {COMMUNITY_FILTER_LABELS[key]}
              </Text>
            </ConnectPressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
