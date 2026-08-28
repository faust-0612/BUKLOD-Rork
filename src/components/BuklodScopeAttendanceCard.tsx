import React, { useCallback } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { useAttendancePermissions } from '@/hooks/useAttendancePermissions';
import {
  ATTENDANCE_WORKSPACE_INSTRUCTIONS,
  buildAttendanceWorkspaceUrl,
} from '@/lib/buklodAttendanceLinks';
import {
  openScopedAttendance,
  scopeAttendanceReportRoute,
  scopeRouteParams,
} from '@/lib/buklodScopeManage';
import {
  listBuklodAttendanceEvents,
} from '@/lib/buklodAttendanceEvents';
import { colors } from '@/lib/theme';
import type { BuklodScope } from '@/lib/buklodScope';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type ActiveEvent = {
  id: string;
  title: string;
  starts_at: string;
};

type Props = {
  scopeId?: string;
  scopeType?: string;
};

export default function BuklodScopeAttendanceCard({
  scopeId: scopeIdProp,
  scopeType: scopeTypeProp,
}: Props = {}) {
  const { activeScope, selectScope } = useBuklodScope();
  const scopeId =
    String(scopeIdProp ?? activeScope?.scope_id ?? '').trim();
  const scopeType =
    String(
      scopeTypeProp ??
        (activeScope?.scope_id === scopeId
          ? activeScope.scope_type
          : '')
    ).trim();
  const cardScope = React.useMemo<BuklodScope | null>(() => {
    if (activeScope?.scope_id === scopeId) {
      return activeScope;
    }

    if (!scopeId) {
      return null;
    }

    return {
      ...(activeScope ?? {}),
      scope_id: scopeId,
      scope_type: scopeType,
    } as BuklodScope;
  }, [activeScope, scopeId, scopeType]);
  const { canOperateScope } = useAttendancePermissions(cardScope);

  const [events, setEvents] = React.useState<ActiveEvent[]>([]);

  const load = useCallback(async () => {
    if (!scopeId) {
      setEvents([]);
      return;
    }

    const rows = await listBuklodAttendanceEvents(scopeId);
    const visible = [
      ...rows.filter(item => item.is_active),
      ...rows.filter(item => !item.is_active),
    ]
      .slice(0, 3)
      .map(item => ({
        id: item.id,
        title: item.title,
        starts_at: item.starts_at,
      }));

    setEvents(visible);
  }, [scopeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (
    !scopeId ||
    !scopeType ||
    !['ORGANIZATION', 'CLUSTER'].includes(scopeType)
  ) {
    return null;
  }

  const scopeKind =
    scopeType === 'CLUSTER'
      ? 'Cluster'
      : activeScope?.parent_scope_id
        ? 'Sub-organization'
        : 'Organization';

  const openAttendance = async () => {
    try {
      await openScopedAttendance(selectScope, scopeId);
    } catch (error) {
      console.warn('Open attendance:', String((error as Error)?.message ?? error));
      router.push({
        pathname: '/scope/attendance',
        params: scopeRouteParams(scopeId, {
          scopeType,
        }),
      } as any);
    }
  };

  const openReport = async (event?: ActiveEvent, series = false) => {
    try {
      await selectScope(scopeId);
      router.push(
        scopeAttendanceReportRoute(
          scopeId,
          event
            ? series
              ? {
                  eventSeriesTitle: event.title,
                  anchorEventId: event.id,
                }
              : {
                  eventId: event.id,
                  eventTitle: event.title,
                }
            : {}
        ) as any
      );
    } catch (error) {
      console.warn('Open attendance report:', String((error as Error)?.message ?? error));
    }
  };

  const shareLink = async (event?: ActiveEvent) => {
    const url = buildAttendanceWorkspaceUrl(
      scopeId,
      event
        ? {
            eventId: event.id,
            eventTitle: event.title,
          }
        : {}
    );

    await Share.share({
      title: event
        ? `Attendance: ${event.title}`
        : 'Events & Attendance',
      message: `${ATTENDANCE_WORKSPACE_INSTRUCTIONS}\n\nOpen link:\n${url}`,
    });
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${scopeKind} Attendance`}
        onPress={() => void openAttendance()}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.icon}>
          <MaterialCommunityIcons
            name="clipboard-check-outline"
            size={24}
            color={colors.greenDark}
          />
        </View>

        <View style={styles.body}>
          <Text style={styles.kicker}>
            {scopeKind.toUpperCase()} ATTENDANCE
          </Text>
          <Text style={styles.title}>
            Events & Attendance
          </Text>
          <Text style={styles.subtitle}>
            {events.length > 0
              ? `${events.length} open event${events.length === 1 ? '' : 's'} • ${events[0].title}`
              : 'Create, open and review attendance for this exact scope.'}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color={colors.muted}
        />
      </Pressable>

      {canOperateScope ? (
        <View style={styles.helpRow}>
          <Text style={styles.helpText}>
            Share the workspace link so recorders can open this exact scope
            attendance area.
          </Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => void shareLink()}
          >
            <Text style={styles.linkText}>Share Link</Text>
          </Pressable>
        </View>
      ) : null}

      {events.map(event => (
        <View key={event.id} style={styles.eventRow}>
          <Text numberOfLines={1} style={styles.eventTitle}>
            {event.title}
          </Text>
          {canOperateScope ? (
            <View style={styles.eventLinks}>
              <Pressable
                style={styles.linkBtn}
                onPress={() => void openReport(event)}
              >
                <Text style={styles.linkText}>Report</Text>
              </Pressable>
              <Pressable
                style={styles.linkBtn}
                onPress={() => void openReport(event, true)}
              >
                <Text style={styles.linkText}>Analytics</Text>
              </Pressable>
              <Pressable
                style={styles.linkBtn}
                onPress={() => void shareLink(event)}
              >
                <Text style={styles.linkText}>Share</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.helpText}>
              Ask the event creator or scope admin for attendance access.
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    marginBottom: 4,
    marginHorizontal: 16,
    gap: 8,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  body: {
    flex: 1,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  eventRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.text,
  },
  eventLinks: {
    flexDirection: 'row',
    gap: 8,
  },
  linkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.greenSoft,
  },
  linkText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
  },
  helpRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  helpText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
});
