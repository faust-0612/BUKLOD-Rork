import React from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { readScopeIdFromParams } from '@/lib/buklodScopeManage';
import {
  ATTENDANCE_WORKSPACE_INSTRUCTIONS,
  buildAttendanceWorkspaceUrl,
} from '@/lib/buklodAttendanceLinks';
import {
  openScopedAttendance,
  scopeAttendanceReportRoute,
} from '@/lib/buklodScopeManage';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

export default function EventsAttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { selectScope } = useBuklodScope();

  const scopeId = readScopeIdFromParams(
    params as Record<string, unknown>,
  );

  const openAttendance = async () => {
    if (!scopeId) {
      Alert.alert(
        'Events & Attendance',
        'Open this screen from your Organization or Cluster manage area so the scope link is included.'
      );
      return;
    }

    try {
      await openScopedAttendance(selectScope, scopeId);
    } catch (error) {
      console.warn(
        'Events & Attendance:',
        String((error as Error)?.message ?? error)
      );
    }
  };

  const openAnalytics = async () => {
    if (!scopeId) {
      Alert.alert(
        'Attendance Analytics',
        'Open this screen from your Organization or Cluster manage area so the scope link is included.'
      );
      return;
    }

    try {
      await selectScope(scopeId);
      router.push(scopeAttendanceReportRoute(scopeId) as any);
    } catch (error) {
      console.warn(
        'Attendance analytics:',
        String((error as Error)?.message ?? error)
      );
    }
  };

  const shareWorkspaceLink = async () => {
    if (!scopeId) {
      Alert.alert(
        'Share attendance link',
        'Open this screen from your Organization or Cluster manage area first.'
      );
      return;
    }

    const url = buildAttendanceWorkspaceUrl(scopeId);

    await Share.share({
      title: 'Events & Attendance',
      message: `${ATTENDANCE_WORKSPACE_INSTRUCTIONS}\n\nOpen link:\n${url}`,
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Events & Attendance',
        }}
      />

      <BuklodPortalScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>EXACT-SCOPE ATTENDANCE</Text>
        <Text style={styles.heading}>
          Events & Attendance
        </Text>
        <Text style={styles.lead}>
          Open the attendance workspace for this Organization, Sub-organization,
          or Cluster. Share the workspace link only with active members who will
          record or review attendance.
        </Text>

        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>How to open attendance</Text>
          <Text style={styles.instructionBody}>
            {ATTENDANCE_WORKSPACE_INSTRUCTIONS}
          </Text>
        </View>

        <Pressable
          onPress={() => void shareWorkspaceLink()}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}>
          <View style={styles.icon}>
            <MaterialCommunityIcons
              name="share-variant-outline"
              size={22}
              color={colors.greenDark}
            />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.title}>
              Share Attendance Link
            </Text>
            <Text style={styles.subtitle}>
              Send the exact-scope link to recorders and event creators.
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => void openAttendance()}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}>
          <View style={styles.icon}>
            <MaterialCommunityIcons
              name="clipboard-check-outline"
              size={22}
              color={colors.greenDark}
            />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.title}>
              Open Events & Attendance
            </Text>
            <Text style={styles.subtitle}>
              Create events, open the Attendance Checker, and review check-ins.
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => void openAnalytics()}
          style={({ pressed }) => [
            styles.card,
            pressed && styles.pressed,
          ]}>
          <View style={styles.icon}>
            <MaterialCommunityIcons
              name="chart-box-outline"
              size={22}
              color={colors.greenDark}
            />
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.title}>
              Attendance Analytics
            </Text>
            <Text style={styles.subtitle}>
              Scope-wide charts, narrative, and attendance log.
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: '#F4F7F5',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.greenDark,
  },
  heading: {
    fontSize: 24,
    fontWeight: '900',
    color: '#173B2F',
  },
  lead: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5F6F68',
    marginBottom: 4,
  },
  instructions: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 6,
  },
  instructionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#173B2F',
  },
  instructionBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#5F6F68',
  },
  card: {
    minHeight: 78,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: '#173B2F',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#5F6F68',
    fontSize: 12,
    lineHeight: 17,
  },
  chevron: {
    color: '#176B4A',
    fontSize: 25,
  },
  pressed: {
    opacity: 0.7,
  },
});
