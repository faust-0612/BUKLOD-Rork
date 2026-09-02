import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  BuklodAttendanceEventForm,
  type AttendanceEventMethod,
  type BuklodAttendanceEventFormValues,
} from '@/components/attendance/BuklodAttendanceEventForm';
import BuklodScopedWorkspaceScrollView from '@/components/BuklodScopedWorkspaceScrollView';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { useAttendancePermissions } from '@/hooks/useAttendancePermissions';
import { useAttendanceWorkspaceScope } from '@/hooks/useAttendanceWorkspaceScope';
import {
  ATTENDANCE_CHECKER_INSTRUCTIONS,
  ATTENDANCE_WORKSPACE_INSTRUCTIONS,
  buildAttendanceCheckerUrl,
  buildAttendanceWorkspaceUrl,
} from '@/lib/buklodAttendanceLinks';
import { fetchScopeMembers } from '@/lib/buklodScopeMembers';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { scopeAttendanceReportRoute } from '@/lib/buklodScopeManage';
import {
  createBuklodAttendanceEvent,
  listBuklodAttendanceEvents,
} from '@/lib/buklodAttendanceEvents';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type EventRow = {
  id: string;
  scope_id: string;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  attendance_open_at: string | null;
  attendance_close_at: string | null;
  late_after: string | null;
  allowed_methods: AttendanceEventMethod[] | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
};

type ReportRow = {
  user_id: string;
  full_name: string | null;
  status: string;
  method: string;
  checked_in_at: string;
};

function firstString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }

  return '';
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isoToLocalDate(value: string | null | undefined) {
  if (!value) {
    return localDateString();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return localDateString();
  }

  return localDateString(parsed);
}

function isoToLocalTime(
  value: string | null | undefined,
  fallback = '08:00'
) {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function upcomingAttendanceWindow(now = new Date()) {
  const start = new Date(now.getTime() + 60 * 1000);
  const date = localDateString(start);
  const endOfDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    23,
    59,
    0
  );
  const late = new Date(
    Math.min(start.getTime() + 15 * 60 * 1000, endOfDay.getTime())
  );
  const end = new Date(
    Math.min(start.getTime() + 2 * 60 * 60 * 1000, endOfDay.getTime())
  );

  return {
    date,
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    lateTime: `${pad(late.getHours())}:${pad(late.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  };
}

function parseLocal(date: string, time: string) {
  const raw = `${date.trim()}T${time.trim()}:00`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ScopeAttendanceScreen() {
  const params = useLocalSearchParams();
  const showCreateParam =
    firstString(params.showCreate) || firstString(params.create);

  const { workspaceScope, access, scopesLoading } =
    useAttendanceWorkspaceScope();
  const { canOperateScope, canManageEvent } =
    useAttendancePermissions(workspaceScope);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshSourceEvent, setRefreshSourceEvent] =
    useState<EventRow | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<
    Array<{ user_id: string; full_name: string | null }>
  >([]);
  const [manualBusy, setManualBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(() => upcomingAttendanceWindow().date);
  const [startTime, setStartTime] = useState(
    () => upcomingAttendanceWindow().startTime
  );
  const [endTime, setEndTime] = useState(
    () => upcomingAttendanceWindow().endTime
  );
  const [lateTime, setLateTime] = useState(
    () => upcomingAttendanceWindow().lateTime
  );
  const [openNow, setOpenNow] = useState(true);
  const [methods, setMethods] = useState<AttendanceEventMethod[]>([
    'qr',
    'face',
    'device_biometric',
    'manual',
  ]);

  const createFormValues = useMemo<BuklodAttendanceEventFormValues>(
    () => ({
      title,
      location,
      date,
      startTime,
      endTime,
      lateTime,
      openNow,
      methods,
    }),
    [
      title,
      location,
      date,
      startTime,
      endTime,
      lateTime,
      openNow,
      methods,
    ]
  );

  const resetCreateForm = useCallback(() => {
    const next = upcomingAttendanceWindow();
    setTitle('');
    setLocation('');
    setDate(next.date);
    setStartTime(next.startTime);
    setEndTime(next.endTime);
    setLateTime(next.lateTime);
    setOpenNow(true);
    setMethods(['qr', 'face', 'device_biometric', 'manual']);
    setRefreshSourceEvent(null);
  }, []);

  const prefillRefreshAttendance = useCallback((item: EventRow) => {
    setTitle(item.title);
    setLocation(item.location ?? '');
    setDate(localDateString());
    setStartTime(isoToLocalTime(item.starts_at, '08:00'));
    setEndTime(
      isoToLocalTime(
        item.ends_at ?? item.starts_at,
        '10:00'
      )
    );
    setLateTime(
      isoToLocalTime(
        item.late_after ?? item.starts_at,
        '08:15'
      )
    );
    setMethods(
      item.allowed_methods?.length
        ? [...item.allowed_methods]
        : ['qr', 'face', 'device_biometric', 'manual']
    );
    setOpenNow(false);
    setRefreshSourceEvent(item);
    setSelectedId(item.id);
    setShowCreate(true);
  }, []);

  const handleCreateFormChange = useCallback(
    <K extends keyof BuklodAttendanceEventFormValues>(
      key: K,
      value: BuklodAttendanceEventFormValues[K]
    ) => {
      switch (key) {
        case 'title':
          setTitle(String(value));
          break;
        case 'location':
          setLocation(String(value));
          break;
        case 'date':
          setDate(String(value));
          break;
        case 'startTime':
          setStartTime(String(value));
          break;
        case 'endTime':
          setEndTime(String(value));
          break;
        case 'lateTime':
          setLateTime(String(value));
          break;
        case 'openNow':
          setOpenNow(Boolean(value));
          break;
        case 'methods':
          setMethods(value as AttendanceEventMethod[]);
          break;
        default:
          break;
      }
    },
    []
  );

  useEffect(() => {
    if (showCreateParam === '1' || showCreateParam === 'true') {
      setShowCreate(true);
    }
  }, [showCreateParam]);

  const selected =
    useMemo(
      () => events.find(item => item.id === selectedId) ?? null,
      [events, selectedId]
    );

  const canManageSelected = canManageEvent(selected);

  const scopeKind =
    workspaceScope?.scope_type === 'CLUSTER'
      ? 'Cluster'
      : workspaceScope?.parent_scope_id
        ? 'Sub-organization'
        : 'Organization';

  const loadEvents = useCallback(async () => {
    if (!workspaceScope?.scope_id) {
      setEvents([]);
      setSelectedId(null);
      return;
    }

    const rows = (await listBuklodAttendanceEvents(
      workspaceScope.scope_id
    )) as EventRow[];

    setEvents(current => {
      if (!rows.length && current.length) {
        return current;
      }

      const extras = current.filter(
        item => !rows.some(row => row.id === item.id)
      );

      return extras.length ? [...extras, ...rows] : rows;
    });

    setSelectedId(current => {
      if (current && rows.some(item => item.id === current)) {
        return current;
      }

      if (current && !rows.length) {
        return current;
      }

      return rows.find(item => item.is_active)?.id ?? rows[0]?.id ?? current;
    });
  }, [workspaceScope?.scope_id]);

  const loadReport = useCallback(async () => {
    if (!selectedId || !canManageSelected) {
      setReport([]);
      return;
    }

    const { data, error } = await supabase.rpc(
      'get_buklod_attendance_event_report',
      { p_event_id: selectedId }
    );

    if (error) {
      Alert.alert('Attendance report', error.message);
      return;
    }

    setReport(
      ((data ?? []) as ReportRow[]).sort(
        (a, b) =>
          new Date(b.checked_in_at).getTime() -
          new Date(a.checked_in_at).getTime()
      )
    );
  }, [selectedId, canManageSelected]);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
      void loadReport();
    }, [loadEvents, loadReport])
  );

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!workspaceScope?.scope_id) {
      return;
    }

    const channel = supabase
      .channel(
        `scope-attendance:${workspaceScope.scope_id}:${(0)}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_events',
          filter: `scope_id=eq.${workspaceScope.scope_id}`,
        },
        () => {
          void loadEvents();
          void loadReport();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [workspaceScope?.scope_id, loadEvents, loadReport]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadEvents();
      await loadReport();
    } finally {
      setRefreshing(false);
    }
  }, [loadEvents, loadReport]);

  if (scopesLoading) {
    return (
      <View style={styles.center}>
        <Text style={shared.muted}>Loading attendance workspace...</Text>
      </View>
    );
  }

  if (
    access !== 'authorized' ||
    !workspaceScope ||
    !['ORGANIZATION', 'CLUSTER'].includes(workspaceScope.scope_type)
  ) {
    return (
      <View style={styles.center}>
        <Text style={shared.h2}>Attendance unavailable</Text>
        <Text style={shared.muted}>
          Open an Organization, Sub-organization or Cluster first.
        </Text>
        <Button title="BACK" onPress={() => router.back()} />
      </View>
    );
  }

  async function createEvent() {
    if (!canOperateScope) {
      Alert.alert(
        'Attendance',
        'Only a scope attendance operator or admin can create attendance events.'
      );
      return;
    }

    const scopeId =
      workspaceScope?.scope_id;

    if (!scopeId) {
      Alert.alert(
        'Attendance',
        'No active Organization, Sub-organization or Cluster is selected.'
      );
      return;
    }

    const startsAt = parseLocal(date, startTime);
    const endsAt = parseLocal(date, endTime);
    const lateAfter = parseLocal(date, lateTime);

    if (!title.trim()) {
      return Alert.alert('Create event', 'Event name is required.');
    }

    if (!startsAt || !endsAt || !lateAfter) {
      return Alert.alert(
        'Create event',
        'Use YYYY-MM-DD for date and HH:MM for time.'
      );
    }

    if (new Date(endsAt) <= new Date(startsAt)) {
      return Alert.alert(
        'Create event',
        'End time must be later than start time.'
      );
    }

    if (methods.length === 0) {
      return Alert.alert(
        'Create event',
        'Choose at least one attendance method.'
      );
    }

    setSaving(true);
    try {
      const created = await createBuklodAttendanceEvent({
        scopeId,
        title: title.trim(),
        startsAt,
        endsAt,
        location: location.trim() || null,
        lateAfter,
        allowedMethods: methods,
        openNow,
      });

      const refreshedFrom = refreshSourceEvent;

      if (refreshedFrom?.is_active) {
        const { error: closeError } = await supabase.rpc(
          'set_buklod_attendance_event_active',
          {
            p_event_id: refreshedFrom.id,
            p_active: false,
          }
        );

        if (closeError) {
          console.warn(
            'Close previous attendance session:',
            closeError.message
          );
        }
      }

      resetCreateForm();
      setShowCreate(false);
      setEvents(current => {
        const next = current.filter(item => item.id !== created.id);
        return [created as EventRow, ...next];
      });
      setSelectedId(created.id);
      await loadEvents();
      setSelectedId(created.id);

      Alert.alert(
        refreshedFrom
          ? 'Attendance refreshed'
          : 'Attendance event created',
        refreshedFrom
          ? `A new session for "${refreshedFrom.title}" was created. The previous session was closed automatically and its check-in data is preserved. Use Analytics to review all sessions by date range.`
          : openNow
            ? 'The event is now available in BUKLOD Attendance.'
            : 'The event was saved closed. Open it when attendance should begin.'
      );
    } catch (error: any) {
      Alert.alert(
        'Could not create event',
        error?.message ?? 'Unknown error'
      );
    } finally {
      setSaving(false);
    }
  }

  async function setEventOpen(item: EventRow, next: boolean) {
    if (!canManageEvent(item)) return;

    const { error } = await supabase.rpc(
      'set_buklod_attendance_event_active',
      {
        p_event_id: item.id,
        p_active: next,
      }
    );

    if (error) {
      return Alert.alert('Attendance', error.message);
    }

    await loadEvents();
  }

  async function openChecker(item: EventRow) {
    const url = buildAttendanceCheckerUrl(item.id);

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'BUKLOD Attendance',
        `${ATTENDANCE_CHECKER_INSTRUCTIONS}\n\nEvent link:\n${url}`
      );
    }
  }

  async function shareWorkspaceLink(item?: EventRow) {
    if (!workspaceScope?.scope_id) {
      return;
    }

    const url = buildAttendanceWorkspaceUrl(
      workspaceScope.scope_id,
      item
        ? {
            eventId: item.id,
            eventTitle: item.title,
          }
        : {}
    );

    await Share.share({
      title: item
        ? `Attendance: ${item.title}`
        : `Attendance: ${workspaceScope.name}`,
      message: `${ATTENDANCE_WORKSPACE_INSTRUCTIONS}\n\nOpen link:\n${url}`,
    });
  }

  async function copyWorkspaceLink(item?: EventRow) {
    if (!workspaceScope?.scope_id) {
      return;
    }

    const url = buildAttendanceWorkspaceUrl(
      workspaceScope.scope_id,
      item
        ? {
            eventId: item.id,
            eventTitle: item.title,
          }
        : {}
    );

    await Clipboard.setStringAsync(url);
    Alert.alert(
      'Attendance link copied',
      'Share this link with recorders who are active members of this scope.'
    );
  }

  async function copyCheckerLink(item: EventRow) {
    const url = buildAttendanceCheckerUrl(item.id);

    await Clipboard.setStringAsync(url);
    Alert.alert(
      'Checker link copied',
      `${ATTENDANCE_CHECKER_INSTRUCTIONS}\n\n${url}`
    );
  }

  async function searchMembers(query: string) {
    if (!workspaceScope?.scope_id) {
      return;
    }

    const rows = await fetchScopeMembers({
      scopeId: workspaceScope.scope_id,
      query,
      limit: 12,
    });

    setMemberResults(
      rows.map(row => ({
        user_id: row.user_id,
        full_name: row.full_name,
      }))
    );
  }

  async function manualCheckIn(
    memberId: string,
    memberName: string | null
  ) {
    if (!selected || !canManageSelected) {
      return;
    }

    if (!selected.allowed_methods?.includes('manual')) {
      Alert.alert(
        'Manual check-in',
        'Manual attendance is not enabled for this event.'
      );
      return;
    }

    setManualBusy(true);

    try {
      const { error } = await supabase.rpc(
        'record_buklod_attendance',
        {
          p_event_id: selected.id,
          p_member_id: memberId,
          p_method: 'manual',
          p_status: 'present',
          p_metadata: {
            source: 'buklod_main_app',
          },
        }
      );

      if (error) {
        throw error;
      }

      Alert.alert(
        'Checked in',
        `${resolvePersonDisplayName(memberName, memberId)} was marked present.`
      );

      setMemberQuery('');
      setMemberResults([]);
      await loadReport();
    } catch (error: any) {
      Alert.alert(
        'Manual check-in',
        error?.message ?? 'Could not record attendance.'
      );
    } finally {
      setManualBusy(false);
    }
  }

  async function openEventReport(item: EventRow) {
    if (!workspaceScope?.scope_id) {
      return;
    }

    router.push(
      scopeAttendanceReportRoute(workspaceScope.scope_id, {
        eventId: item.id,
        eventTitle: item.title,
      }) as any
    );
  }

  async function openEventSeriesReport(item: EventRow) {
    if (!workspaceScope?.scope_id) {
      return;
    }

    router.push(
      scopeAttendanceReportRoute(workspaceScope.scope_id, {
        eventSeriesTitle: item.title,
        anchorEventId: item.id,
      }) as any
    );
  }

  const present = report.filter(row => row.status === 'present').length;
  const late = report.filter(row => row.status === 'late').length;
  const methodCount = (method: string) =>
    report.filter(row => row.method === method).length;

  return (
    <BuklodScopedWorkspaceScrollView
      style={shared.screen}
      contentContainerStyle={shared.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <View style={styles.headerRow}>
        <Pressable
          style={styles.back}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.greenDark}
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>Attendance</Text>
          <Text style={shared.muted}>
            {scopeKind} • {workspaceScope.name}
          </Text>
        </View>

        {canOperateScope && (
          <Pressable
            style={styles.reportLink}
            onPress={() =>
              workspaceScope?.scope_id
                ? router.push(
                    scopeAttendanceReportRoute(
                      workspaceScope.scope_id
                    ) as any
                  )
                : undefined
            }
            accessibilityLabel="Open attendance report"
          >
            <MaterialCommunityIcons
              name="chart-box-outline"
              size={20}
              color={colors.greenDark}
            />
          </Pressable>
        )}
      </View>

      <Card>
        <Text style={styles.instructionTitle}>
          How to use attendance links
        </Text>
        <Text style={styles.instructionBody}>
          {ATTENDANCE_WORKSPACE_INSTRUCTIONS}
        </Text>
        {canOperateScope ? (
          <View style={styles.linkActions}>
            <Pressable
              style={styles.linkBtn}
              onPress={() => void shareWorkspaceLink()}
            >
              <Text style={styles.linkBtnText}>SHARE WORKSPACE LINK</Text>
            </Pressable>
            <Pressable
              style={styles.linkBtn}
              onPress={() => void copyWorkspaceLink()}
            >
              <Text style={styles.linkBtnText}>COPY WORKSPACE LINK</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      {canOperateScope && (
        <>
          <Button
            title={
              showCreate
                ? refreshSourceEvent
                  ? 'CLOSE REFRESH ATTENDANCE'
                  : 'CLOSE CREATE EVENT'
                : '+ CREATE ATTENDANCE EVENT'
            }
            onPress={() => {
              if (showCreate) {
                resetCreateForm();
              }

              setShowCreate(value => !value);
            }}
          />

          {showCreate ? (
            <BuklodAttendanceEventForm
              values={createFormValues}
              saving={saving}
              submitTitle={
                refreshSourceEvent
                  ? 'REFRESH ATTENDANCE'
                  : 'CREATE EVENT'
              }
              savingTitle={
                refreshSourceEvent
                  ? 'REFRESHING...'
                  : 'CREATING...'
              }
              contextNote={
                refreshSourceEvent
                  ? `Same event as "${refreshSourceEvent.title}". Update the date and time, then tap Refresh Attendance. The current open session will close automatically. All past check-ins stay saved.`
                  : null
              }
              onChange={handleCreateFormChange}
              onSubmit={createEvent}
            />
          ) : null}
        </>
      )}

      <SectionTitle>EVENTS</SectionTitle>

      {events.length === 0 ? (
        <Card>
          <Text style={shared.h2}>No attendance event yet</Text>
          <Text style={shared.muted}>
            {canOperateScope
              ? 'Create the first event for this exact scope.'
              : 'Your scope attendance operator has not created an attendance event yet.'}
          </Text>
        </Card>
      ) : (
        events.map(item => {
          const selectedEvent = selectedId === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setSelectedId(item.id)}
              style={[
                styles.eventCard,
                selectedEvent && styles.eventCardOn,
              ]}
            >
              <View style={styles.eventTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  <Text style={styles.eventMeta}>
                    {formatDateTime(item.starts_at)}
                  </Text>
                  {!!item.location && (
                    <Text style={styles.eventMeta}>{item.location}</Text>
                  )}
                </View>

                <View
                  style={[
                    styles.status,
                    item.is_active ? styles.statusOpen : styles.statusClosed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      item.is_active
                        ? styles.statusOpenText
                        : styles.statusClosedText,
                    ]}
                  >
                    {item.is_active ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>

              {canManageEvent(item) && (
                <View style={styles.eventReportLinks}>
                  <Pressable
                    style={styles.eventReportBtn}
                    onPress={() => void openEventReport(item)}
                  >
                    <MaterialCommunityIcons
                      name="clipboard-text-outline"
                      size={16}
                      color={colors.greenDark}
                    />
                    <Text style={styles.eventReportText}>
                      Report Attendance
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.eventReportBtn}
                    onPress={() => void openEventSeriesReport(item)}
                  >
                    <MaterialCommunityIcons
                      name="chart-box-outline"
                      size={16}
                      color={colors.greenDark}
                    />
                    <Text style={styles.eventReportText}>
                      Analytics
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.eventReportBtn}
                    onPress={() => void shareWorkspaceLink(item)}
                  >
                    <MaterialCommunityIcons
                      name="share-variant-outline"
                      size={16}
                      color={colors.greenDark}
                    />
                    <Text style={styles.eventReportText}>
                      Share Link
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.eventReportBtn}
                    onPress={() => prefillRefreshAttendance(item)}
                  >
                    <MaterialCommunityIcons
                      name="calendar-refresh"
                      size={16}
                      color={colors.greenDark}
                    />
                    <Text style={styles.eventReportText}>
                      Refresh Attendance
                    </Text>
                  </Pressable>
                </View>
              )}

              {selectedEvent && (
                <View style={styles.eventActions}>
                  {item.is_active && (
                    <>
                      <Button
                        title="OPEN ATTENDANCE CHECKER"
                        onPress={() => void openChecker(item)}
                      />
                      {canManageEvent(item) ? (
                        <Button
                          title="COPY CHECKER LINK"
                          outline
                          onPress={() => void copyCheckerLink(item)}
                        />
                      ) : null}
                    </>
                  )}

                  {canManageEvent(item) && (
                    <Button
                      title={item.is_active ? 'CLOSE ATTENDANCE' : 'OPEN ATTENDANCE'}
                      onPress={() => void setEventOpen(item, !item.is_active)}
                    />
                  )}
                </View>
              )}
            </Pressable>
          );
        })
      )}

      {selected && canManageSelected && (
        <>
          <SectionTitle>REPORT</SectionTitle>

          <Button
            title="OPEN FULL REPORT & ANALYTICS"
            outline
            onPress={() => void openEventReport(selected)}
          />

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{report.length}</Text>
              <Text style={styles.statLabel}>CHECKED IN</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{present}</Text>
              <Text style={styles.statLabel}>PRESENT</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{late}</Text>
              <Text style={styles.statLabel}>LATE</Text>
            </View>
          </View>

          <Card>
            <Text style={styles.breakdown}>
              QR {methodCount('qr')}  •  Face {methodCount('face')}  •  Biometric {methodCount('device_biometric')}  •  Manual {methodCount('manual')}
            </Text>
          </Card>

          {report.length === 0 ? (
            <Card>
              <Text style={shared.muted}>No check-ins yet.</Text>
            </Card>
          ) : (
            report.map(row => (
              <View
                key={`${row.user_id}-${row.checked_in_at}`}
                style={styles.person}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName}>
                    {resolvePersonDisplayName(
                      row.full_name,
                      row.user_id,
                    )}
                  </Text>
                  <Text style={styles.personMeta}>
                    {row.status.toUpperCase()} • {row.method.replaceAll('_', ' ')}
                  </Text>
                </View>
                <Text style={styles.personTime}>
                  {new Date(row.checked_in_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            ))
          )}

          {selected.is_active &&
          selected.allowed_methods?.includes('manual') ? (
            <>
              <SectionTitle>MANUAL CHECK-IN</SectionTitle>
              <Card>
                <Text style={styles.help}>
                  Search an active member, then tap their name to mark them
                  present manually.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Search member name..."
                  value={memberQuery}
                  onChangeText={value => {
                    setMemberQuery(value);
                    void searchMembers(value);
                  }}
                />
                {memberResults.map(member => (
                  <Pressable
                    key={member.user_id}
                    disabled={manualBusy}
                    onPress={() =>
                      void manualCheckIn(
                        member.user_id,
                        member.full_name
                      )
                    }
                    style={styles.person}
                  >
                    <Text style={styles.personName}>
                      {resolvePersonDisplayName(
                        member.full_name,
                        member.user_id
                      )}
                    </Text>
                    <Text style={styles.linkBtnText}>CHECK IN</Text>
                  </Pressable>
                ))}
              </Card>
            </>
          ) : null}
        </>
      )}

      {!canOperateScope && (
        <Card>
          <Text style={shared.h2}>Member access</Text>
          <Text style={shared.muted}>
            You can see attendance events for this scope. Creating events,
            opening or closing attendance, reports, and manual check-in are
            limited to the event creator, attendance operator, or scope admin.
          </Text>
        </Card>
      )}
    </BuklodScopedWorkspaceScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  reportLink: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 9,
    color: colors.text,
    backgroundColor: colors.white,
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 5,
  },
  help: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  methodWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  methodChip: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  methodChipOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
  },
  methodTextOn: {
    color: colors.greenDark,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  eventCard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
  },
  eventCardOn: {
    borderWidth: 2,
    borderColor: colors.green,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
  eventMeta: {
    marginTop: 3,
    fontSize: 12,
    color: colors.muted,
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusOpen: {
    backgroundColor: colors.greenSoft,
  },
  statusClosed: {
    backgroundColor: colors.line,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  statusOpenText: {
    color: colors.greenDark,
  },
  statusClosedText: {
    color: colors.muted,
  },
  eventActions: {
    marginTop: 10,
    gap: 5,
  },
  eventReportLinks: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.greenSoft,
  },
  eventReportText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.greenDark,
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statValue: {
    fontSize: 21,
    fontWeight: '900',
    color: colors.greenDark,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '900',
    color: colors.muted,
  },
  breakdown: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  person: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 7,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  personName: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  personMeta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'capitalize',
  },
  personTime: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.greenDark,
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 8,
  },
  instructionBody: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: 10,
  },
  linkActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.greenSoft,
  },
  linkBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.greenDark,
  },
});
