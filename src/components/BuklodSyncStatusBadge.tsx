import { StyleSheet, Text, View } from 'react-native';

import {
  buklodSyncStatusLabel,
  type BuklodSyncStatus,
} from '@/lib/buklodOfflineSync';

type Props = {
  status: BuklodSyncStatus;
  compact?: boolean;
};

function toneFor(status: BuklodSyncStatus) {
  switch (status) {
    case 'saved_offline':
      return {
        bg: '#5C4A00',
        fg: '#FFF4C2',
      };
    case 'waiting_to_sync':
      return {
        bg: '#0F4C75',
        fg: '#D7EEFF',
      };
    case 'syncing':
      return {
        bg: '#1B4D3E',
        fg: '#C9F7E6',
      };
    case 'synced':
      return {
        bg: '#1F4D2B',
        fg: '#D8F5DF',
      };
    case 'failed_to_sync':
      return {
        bg: '#6B1D1D',
        fg: '#FFD9D9',
      };
    default:
      return {
        bg: '#333333',
        fg: '#FFFFFF',
      };
  }
}

export function BuklodSyncStatusBadge({
  status,
  compact = false,
}: Props) {
  const tone = toneFor(status);

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: tone.bg },
      ]}
    >
      <Text
        style={[
          styles.text,
          compact && styles.textCompact,
          { color: tone.fg },
        ]}
      >
        {buklodSyncStatusLabel(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  textCompact: {
    fontSize: 10,
  },
});
