import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type AttendanceMethod =
  | 'qr'
  | 'face'
  | 'device_biometric'
  | 'manual';

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
  allowed_methods: AttendanceMethod[] | null;
  is_active: boolean;
  created_at: string;
};

type ReportRow = {
  user_id: string;
  full_name: string | null;
  status: string;
  method: string;
  checked_in_at: string;
};

const METHOD_OPTIONS: {
  key: AttendanceMethod;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}[] = [
  { key: 'qr', label: 'QR', icon: 'qrcode-scan' },
  { key: 'face', label: 'Face', icon: 'face-recognition' },
  { key: 'device_biometric', label: 'Biometric', icon: 'fingerprint' },
  { key: 'manual', label: 'Manual', icon: 'account-check-outline' },
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
  const { activeScope } = useBuklodScope();
  const { isAdmin } = useBuklodAccess();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(localDateString());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [lateTime, setLateTime] = useState('08:15');
  const [openNow, setOpenNow] = useState(true);
  const [methods, setMethods] = useState<AttendanceMethod[]>([
    'qr',
    'face',
    'device_biometric',
    'manual',
  ]);

  const selected =
    useMemo(
      () => events.find(item => item.id === selectedId) ?? null,
      [events, selectedId]
    );

  const scopeKind =
    activeScope?.scope_type === 'CLUSTER'
      ? 'Cluster'
      : activeScope?.parent_scope_id
        ? 'Sub-organization'
        : 'Organization';

  const loadEvents = useCallback(async () => {
    if (!activeScope?.scope_id) {
      setEvents([]);
      setSelectedId(null);
      return;
    }

    const { data, error } = await supabase
      .from('attendance_events')
      .select(
        'id,scope_id,title,location,starts_at,ends_at,attendance_open_at,attendance_close_at,late_after,allowed_methods,is_active,created_at'
      )
      .eq('scope_id', activeScope.scope_id)
      .order('starts_at', { ascending: false })
      .limit(50);

    if (error) {
      Alert.alert('Attendance', error.message);
      return;
    }

    const rows = (data ?? []) as EventRow[];
    setEvents(rows);

    setSelectedId(current => {
      if (current && rows.some(item => item.id === current)) {
        return current;
      }
      return rows.find(item => item.is_active)?.id ?? rows[0]?.id ?? null;
    });
  }, [activeScope?.scope_id]);

  const loadReport = useCallback(async () => {
    if (!selectedId || !isAdmin) {
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

    setReport((data ?? []) as ReportRow[]);
  }, [selectedId, isAdmin]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadEvents();
      await loadReport();
    } finally {
      setRefreshing(false);
    }
  }, [loadEvents, loadReport]);

  if (
    !activeScope ||
    !['ORGANIZATION', 'CLUSTER'].includes(activeScope.scope_type)
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
    if (!isAdmin) {
      Alert.alert(
        'Attendance',
        'Only an admin of this exact scope can create attendance events.'
      );
      return;
    }

    const scopeId =
      activeScope?.scope_id;

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
      const { data, error } = await supabase.rpc(
        'create_buklod_attendance_event',
        {
          p_scope_id: scopeId,
          p_title: title.trim(),
          p_starts_at: startsAt,
          p_ends_at: endsAt,
          p_location: location.trim() || null,
          p_late_after: lateAfter,
          p_allowed_methods: methods,
          p_open_now: openNow,
        }
      );

      if (error) throw error;

      setTitle('');
      setLocation('');
      setShowCreate(false);
      await loadEvents();

      if (typeof data === 'string') {
        setSelectedId(data);
      }

      Alert.alert(
        'Attendance event created',
        openNow
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
    if (!isAdmin) return;

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
    const url = `buklod-attendance://event/${item.id}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        'BUKLOD Attendance',
        'The event is saved and available to the Attendance Checker. Open the BUKLOD Attendance app and select this event.'
      );
    }
  }

  const present = report.filter(row => row.status === 'present').length;
  const late = report.filter(row => row.status === 'late').length;
  const methodCount = (method: string) =>
    report.filter(row => row.method === method).length;

  return (
    <ScrollView
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
            {scopeKind} • {activeScope.name}
          </Text>
        </View>
      </View>

      {isAdmin && (
        <>
          <Button
            title={showCreate ? 'CLOSE CREATE EVENT' : '+ CREATE ATTENDANCE EVENT'}
            onPress={() => setShowCreate(value => !value)}
          />

          {showCreate && (
            <>
              <SectionTitle>CREATE EVENT</SectionTitle>
              <Card>
                <TextInput
                  style={styles.input}
                  placeholder="Event name"
                  value={title}
                  onChangeText={setTitle}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Location (optional)"
                  value={location}
                  onChangeText={setLocation}
                />

                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChangeText={setDate}
                  autoCapitalize="none"
                />

                <View style={styles.twoCol}>
                  <View style={styles.col}>
                    <Text style={styles.label}>Start</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="08:00"
                      value={startTime}
                      onChangeText={setStartTime}
                    />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>End</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="10:00"
                      value={endTime}
                      onChangeText={setEndTime}
                    />
                  </View>
                </View>

                <Text style={styles.label}>Late after</Text>
                <TextInput
                  style={styles.input}
                  placeholder="08:15"
                  value={lateTime}
                  onChangeText={setLateTime}
                />

                <Text style={styles.label}>Allowed methods</Text>
                <View style={styles.methodWrap}>
                  {METHOD_OPTIONS.map(option => {
                    const on = methods.includes(option.key);
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() =>
                          setMethods(current =>
                            on
                              ? current.filter(item => item !== option.key)
                              : [...current, option.key]
                          )
                        }
                        style={[
                          styles.methodChip,
                          on && styles.methodChipOn,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={option.icon}
                          size={18}
                          color={on ? colors.greenDark : colors.muted}
                        />
                        <Text
                          style={[
                            styles.methodText,
                            on && styles.methodTextOn,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Open attendance now</Text>
                    <Text style={styles.help}>
                      If enabled, the event immediately appears as open in the Attendance Checker.
                    </Text>
                  </View>
                  <Switch value={openNow} onValueChange={setOpenNow} />
                </View>

                <Button
                  title={saving ? 'CREATING...' : 'CREATE EVENT'}
                  onPress={
                    saving
                      ? () => undefined
                      : createEvent
                  }
                />
              </Card>
            </>
          )}
        </>
      )}

      <SectionTitle>EVENTS</SectionTitle>

      {events.length === 0 ? (
        <Card>
          <Text style={shared.h2}>No attendance event yet</Text>
          <Text style={shared.muted}>
            {isAdmin
              ? 'Create the first event for this exact scope.'
              : 'Your scope admin has not created an attendance event yet.'}
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

              {selectedEvent && (
                <View style={styles.eventActions}>
                  {item.is_active && (
                    <Button
                      title="OPEN ATTENDANCE CHECKER"
                      onPress={() => void openChecker(item)}
                    />
                  )}

                  {isAdmin && (
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

      {selected && isAdmin && (
        <>
          <SectionTitle>REPORT</SectionTitle>

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
                    {row.full_name || 'BUKLOD Member'}
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
        </>
      )}

      {!isAdmin && (
        <Card>
          <Text style={shared.h2}>Member access</Text>
          <Text style={shared.muted}>
            You can see the attendance events for this scope. Event creation,
            open/close controls and the detailed attendance report are restricted
            to the exact-scope admin.
          </Text>
        </Card>
      )}
    </ScrollView>
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
});
