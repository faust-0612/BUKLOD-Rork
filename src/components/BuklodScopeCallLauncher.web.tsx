import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  ensureBuklodStreamVideoClient,
} from '@/lib/buklodStreamVideoClient';
import {
  buildBuklodScopeCallId,
  formatBuklodCallStartError,
} from '@/lib/buklodStreamCall';
import { useStreamVideoClient } from '@/lib/streamVideoSdk';
import { supabase } from '@/lib/supabase';
import { useConnectTheme } from '@/providers/ConnectThemeProvider';

/* BUKLOD_WEB_CALLING_R1 */

type Props = {
  scopeId: string;
  title?: string;
  compact?: boolean;
};

type CallMode = 'audio' | 'video';

type RosterRow = {
  user_id: string;
  is_admin: boolean;
};

const CALLABLE_SCOPE_TYPES = new Set([
  'CLUSTER',
  'ORGANIZATION',
  'SUB_ORGANIZATION',
  'SUB-ORGANIZATION',
  'SUBORGANIZATION',
  'SUB_ORG',
  'SUB-ORG',
]);

export default function BuklodScopeCallLauncher({
  scopeId,
  title,
  compact = false,
}: Props) {
  const { theme } = useConnectTheme();
  const videoClient = useStreamVideoClient();
  const [enabled, setEnabled] = useState(false);
  const [scopeType, setScopeType] = useState('');
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<CallMode | null>(null);

  const label = useMemo(() => {
    if (scopeType === 'CLUSTER') {
      return 'Cluster Call';
    }
    if (scopeType.includes('SUB')) {
      return 'Sub-organization Call';
    }
    return 'Organization Call';
  }, [scopeType]);

  const load = useCallback(async () => {
    if (!scopeId) {
      setEnabled(false);
      setRoster([]);
      return;
    }

    setLoading(true);
    try {
      const details = await (supabase as any).rpc(
        'buklod_connect_room_details',
        { _scope_id: scopeId }
      );

      if (details.error) {
        throw details.error;
      }

      const raw = Array.isArray(details.data)
        ? details.data[0]
        : details.data;
      const type = String(raw?.scope_type ?? '').toUpperCase();
      const canCall = CALLABLE_SCOPE_TYPES.has(type);

      setScopeType(type);
      setEnabled(canCall);

      if (!canCall) {
        setRoster([]);
        return;
      }

      const members = await (supabase as any).rpc(
        'buklod_connect_scope_call_members',
        { _scope_id: scopeId }
      );

      if (members.error) {
        throw members.error;
      }

      setRoster(
        (Array.isArray(members.data) ? members.data : [])
          .filter((row: any) => Boolean(row?.user_id))
          .map((row: any) => ({
            user_id: String(row.user_id),
            is_admin: Boolean(row.is_admin),
          }))
      );
    } catch (error: any) {
      console.warn('Web scope call setup:', error?.message ?? error);
      setEnabled(false);
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCall = useCallback(async (mode: CallMode) => {
    if (starting) {
      return;
    }

    setStarting(mode);
    try {
      const client =
        videoClient ??
        await ensureBuklodStreamVideoClient();

      const membersResult = await (supabase as any).rpc(
        'buklod_connect_scope_call_members',
        { _scope_id: scopeId }
      );

      if (membersResult.error) {
        throw membersResult.error;
      }

      const freshRows: RosterRow[] =
        (Array.isArray(membersResult.data) ? membersResult.data : [])
          .filter((row: any) => Boolean(row?.user_id))
          .map((row: any) => ({
            user_id: String(row.user_id),
            is_admin: Boolean(row.is_admin),
          }));

      setRoster(freshRows);

      if (freshRows.length < 2) {
        Alert.alert(
          'No other member yet',
          'At least two active members are needed to start a group call.'
        );
        return;
      }

      const isVideo = mode === 'video';
      const isLarge = freshRows.length >= 9;
      const call = client.call(
        'default',
        buildBuklodScopeCallId(scopeId)
      );

      await call.getOrCreate({
        ring: true,
        video: isVideo,
        data: {
          members: freshRows.map(row => ({
            user_id: row.user_id,
            role: row.is_admin ? 'admin' : 'call_member',
          })),
          custom: {
            buklod_call_scope: 'SCOPE',
            buklod_scope_id: scopeId,
            buklod_scope_type: scopeType,
            buklod_scope_name: title || label,
            buklod_call_mode: mode,
            buklod_large_group: isLarge,
          },
          settings_override: {
            audio: {
              mic_default_on: true,
            },
            video: {
              camera_default_on: isVideo && !isLarge,
            },
            ring: {
              auto_cancel_timeout_ms: 45000,
              incoming_call_timeout_ms: 30000,
            },
          },
        },
      } as any);
    } catch (error: any) {
      console.warn('BUKLOD browser scope call:', error);
      Alert.alert(
        'Call could not start',
        formatBuklodCallStartError(error)
      );
    } finally {
      setStarting(null);
    }
  }, [label, scopeId, scopeType, starting, title, videoClient]);

  if (!enabled) {
    return null;
  }

  if (compact) {
    return (
      <View style={styles.compactActions}>
        <CallIconButton
          icon="phone-outline"
          label="Start scope audio call"
          loading={starting === 'audio'}
          disabled={Boolean(starting)}
          accent={theme.accent}
          onPress={() => void startCall('audio')}
        />
        <CallIconButton
          icon="video-outline"
          label="Start scope video call"
          loading={starting === 'video'}
          disabled={Boolean(starting)}
          accent={theme.accent}
          onPress={() => void startCall('video')}
        />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons
            name="phone-in-talk-outline"
            size={18}
            color={theme.accent}
          />
          <Text style={styles.title}>{label}</Text>
          {loading ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Text style={styles.count}>
              {roster.length} member{roster.length === 1 ? '' : 's'}
            </Text>
          )}
        </View>
        <Text style={styles.hint}>
          Browser audio/video calling is available for active members.
        </Text>
      </View>

      <View style={styles.actions}>
        <CallButton
          icon="phone"
          label="Audio"
          loading={starting === 'audio'}
          disabled={Boolean(starting)}
          background="#258456"
          onPress={() => void startCall('audio')}
        />
        <CallButton
          icon="video"
          label="Video"
          loading={starting === 'video'}
          disabled={Boolean(starting)}
          background="#245C8A"
          onPress={() => void startCall('video')}
        />
      </View>
    </View>
  );
}

function CallIconButton({
  icon,
  label,
  loading,
  disabled,
  accent,
  onPress,
}: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={accent} />
      ) : (
        <MaterialCommunityIcons name={icon} size={22} color={accent} />
      )}
    </Pressable>
  );
}

function CallButton({
  icon,
  label,
  loading,
  disabled,
  background,
  onPress,
}: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Start ${label.toLowerCase()} call`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <MaterialCommunityIcons name={icon} size={21} color="#FFFFFF" />
      )}
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(100,130,115,0.16)',
  },
  copy: {
    gap: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    color: '#18372C',
  },
  count: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7B74',
  },
  hint: {
    fontSize: 10,
    lineHeight: 15,
    color: '#71827A',
  },
  actions: {
    flexDirection: 'row',
    gap: 9,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.76,
  },
  disabled: {
    opacity: 0.5,
  },
});
