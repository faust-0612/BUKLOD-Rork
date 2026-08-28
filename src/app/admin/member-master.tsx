import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { shareWorkbook, loadXlsxModule } from '@/lib/reports/export';

import { AdminGate } from '@/components/AdminGate';
import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { AppRole, useAuth } from '@/providers/AuthProvider';

type Row = Record<string, any>;
type FilterRole = 'all' | AppRole;

const ROLE_LABELS: Record<AppRole, string> = {
  member: 'Member',
  leader: 'Leader',
  mentor: 'Mentor',
  pastor: 'Pastor',
  local_admin: 'Local Admin',
  system_admin: 'System Admin',
};

const ROLE_OPTIONS: FilterRole[] = [
  'all',
  'member',
  'leader',
  'mentor',
  'pastor',
  'local_admin',
  'system_admin',
];

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;

const today = () => isoDate(new Date());
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  return isoDate(d);
};

const manilaToday = () =>
  new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

const datePart = (value?: string | null) =>
  value ? String(value).slice(0, 10) : '';

const inPeriod = (
  value: string | null | undefined,
  from: string,
  to: string
) => {
  if (!value) return false;
  const d = datePart(value);
  return d >= from && d <= to;
};

function safeSheet(
  rows: Row[],
  XLSX: Awaited<ReturnType<typeof loadXlsxModule>>
) {
  const source = rows.length ? rows : [{ Info: 'No records found for this filter.' }];
  const sheet = XLSX.utils.json_to_sheet(source);
  const headers = Object.keys(source[0] ?? {});

  (sheet as any)['!cols'] = headers.map((header) => {
    let width = Math.max(12, header.length + 2);
    for (const row of source.slice(0, 300)) {
      width = Math.max(width, String(row?.[header] ?? '').length + 2);
    }
    return { wch: Math.min(width, 42) };
  });

  if (headers.length > 1) {
    (sheet as any)['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: Math.max(0, source.length), c: headers.length - 1 },
      }),
    };
  }

  return sheet;
}

async function fetchAll(table: string, select: string): Promise<Row[]> {
  const result: Row[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const page = (data ?? []) as Row[];
    result.push(...page);

    if (page.length < pageSize) break;
  }

  return result;
}

export default function MemberMasterRecordsScreen() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'general' | 'full' | null>(null);

  const [profiles, setProfiles] = useState<Row[]>([]);
  const [churches, setChurches] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [groupMembers, setGroupMembers] = useState<Row[]>([]);
  const [userRoles, setUserRoles] = useState<Row[]>([]);
  const [mentorAssignments, setMentorAssignments] = useState<Row[]>([]);
  const [pastorAssignments, setPastorAssignments] = useState<Row[]>([]);

  const [tracks, setTracks] = useState<Row[]>([]);
  const [lessons, setLessons] = useState<Row[]>([]);
  const [enrollments, setEnrollments] = useState<Row[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Row[]>([]);

  const [bibleAssignments, setBibleAssignments] = useState<Row[]>([]);
  const [bibleMembers, setBibleMembers] = useState<Row[]>([]);
  const [bibleSubmissions, setBibleSubmissions] = useState<Row[]>([]);

  const [pointsLedger, setPointsLedger] = useState<Row[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [attendance, setAttendance] = useState<Row[]>([]);

  const [churchFilter, setChurchFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [
        profileRows,
        churchRows,
        groupRows,
        groupMemberRows,
        roleRows,
        mentorRows,
        trackRows,
        lessonRows,
        enrollmentRows,
        progressRows,
        bibleAssignmentRows,
        bibleMemberRows,
        bibleSubmissionRows,
        pointRows,
        eventRows,
        attendanceRows,
        pastorAssignmentResult,
      ] = await Promise.all([
        fetchAll(
          'profiles',
          'id,full_name,mobile,birth_date,sex,avatar_url,church_id,role,is_active,created_at'
        ),
        fetchAll('churches', 'id,name,is_active'),
        fetchAll('buklod_groups', 'id,name,church_id,leader_id,is_active'),
        fetchAll('group_members', 'group_id,user_id,is_active'),
        fetchAll(
          'user_roles',
          'user_id,role,is_active,granted_by,granted_at,revoked_by,revoked_at'
        ),
        fetchAll(
          'mentor_assignments',
          'mentor_id,disciple_id,assigned_by,is_active,assigned_at'
        ),
        fetchAll('learning_tracks', 'id,title,slug'),
        fetchAll(
          'learning_lessons',
          'id,track_id,lesson_number,title,is_required'
        ),
        fetchAll(
          'track_enrollments',
          'id,user_id,track_id,mentor_id,status,enrolled_at,completed_at'
        ),
        fetchAll(
          'lesson_progress',
          'id,enrollment_id,lesson_id,user_id,started_at,completed_at,reflection_text,updated_at'
        ),
        fetchAll(
          'daily_bible_assignments',
          'id,reading_date,bible_reference,is_published'
        ),
        fetchAll(
          'daily_bible_assignment_members',
          'assignment_id,user_id,assigned_at'
        ),
        fetchAll(
          'daily_bible_submissions',
          'id,assignment_id,user_id,answer_text,answer_language,submitted_at,submitted_on_time,reward_amount,status,reviewed_by,reviewed_at,admin_note'
        ),
        fetchAll(
          'buklod_points_ledger',
          'id,user_id,direction,points,activity_type,source_key,source_id,description,awarded_by,created_at'
        ),
        fetchAll(
          'church_events',
          'id,scope,church_id,group_id,event_type,title,starts_at,ends_at,is_cancelled'
        ),
        fetchAll(
          'event_attendance',
          'event_id,user_id,status,checked_in_at,recorded_by,note'
        ),
        (supabase as any).rpc('admin_get_pastor_church_assignments'),
      ]);

      if (pastorAssignmentResult.error) throw pastorAssignmentResult.error;

      setProfiles(profileRows);
      setChurches(churchRows);
      setGroups(groupRows);
      setGroupMembers(groupMemberRows);
      setUserRoles(roleRows);
      setMentorAssignments(mentorRows);
      setPastorAssignments(pastorAssignmentResult.data ?? []);
      setTracks(trackRows);
      setLessons(lessonRows);
      setEnrollments(enrollmentRows);
      setLessonProgress(progressRows);
      setBibleAssignments(bibleAssignmentRows);
      setBibleMembers(bibleMemberRows);
      setBibleSubmissions(bibleSubmissionRows);
      setPointsLedger(pointRows);
      setEvents(eventRows);
      setAttendance(attendanceRows);
    } catch (error: any) {
      Alert.alert('Member Master Records', error?.message ?? 'Could not load records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const churchMap = useMemo(
    () => new Map(churches.map((row) => [row.id, row.name])),
    [churches]
  );

  const groupMap = useMemo(
    () => new Map(groups.map((row) => [row.id, row])),
    [groups]
  );

  const profileMap = useMemo(
    () => new Map(profiles.map((row) => [row.id, row])),
    [profiles]
  );

  const trackMap = useMemo(
    () => new Map(tracks.map((row) => [row.id, row])),
    [tracks]
  );

  const lessonMap = useMemo(
    () => new Map(lessons.map((row) => [row.id, row])),
    [lessons]
  );

  const enrollmentMap = useMemo(
    () => new Map(enrollments.map((row) => [row.id, row])),
    [enrollments]
  );

  const bibleAssignmentMap = useMemo(
    () => new Map(bibleAssignments.map((row) => [row.id, row])),
    [bibleAssignments]
  );

  const eventMap = useMemo(
    () => new Map(events.map((row) => [row.id, row])),
    [events]
  );

  const rolesMap = useMemo(() => {
    const map = new Map<string, AppRole[]>();

    for (const person of profiles) {
      map.set(person.id, ['member']);
    }

    for (const row of userRoles) {
      if (!row.is_active) continue;
      const role = row.role as AppRole;
      const current = map.get(row.user_id) ?? ['member'];
      if (!current.includes(role)) current.push(role);
      map.set(row.user_id, current);
    }

    for (const person of profiles) {
      const legacy = person.role as AppRole;
      const current = map.get(person.id) ?? ['member'];
      if (legacy && !current.includes(legacy)) current.push(legacy);
      map.set(person.id, current);
    }

    return map;
  }, [profiles, userRoles]);

  const groupNamesFor = useCallback(
    (userId: string) =>
      groupMembers
        .filter((row) => row.user_id === userId && row.is_active)
        .map((row) => groupMap.get(row.group_id)?.name)
        .filter(Boolean)
        .join(' | '),
    [groupMembers, groupMap]
  );

  const visibleGroups = useMemo(
    () =>
      groups.filter(
        (row) =>
          row.is_active &&
          (churchFilter === 'all' || row.church_id === churchFilter)
      ),
    [groups, churchFilter]
  );

  useEffect(() => {
    if (
      groupFilter !== 'all' &&
      !visibleGroups.some((group) => group.id === groupFilter)
    ) {
      setGroupFilter('all');
    }
  }, [groupFilter, visibleGroups]);

  const filteredProfiles = useMemo(() => {
    return profiles
      .filter((person) => !activeOnly || person.is_active)
      .filter(
        (person) => churchFilter === 'all' || person.church_id === churchFilter
      )
      .filter((person) => {
        if (groupFilter === 'all') return true;
        return groupMembers.some(
          (membership) =>
            membership.user_id === person.id &&
            membership.group_id === groupFilter &&
            membership.is_active
        );
      })
      .filter((person) => {
        if (roleFilter === 'all') return true;
        return (rolesMap.get(person.id) ?? ['member']).includes(roleFilter);
      })
      .sort((a, b) =>
        String(a.full_name ?? '').localeCompare(String(b.full_name ?? ''))
      );
  }, [
    profiles,
    activeOnly,
    churchFilter,
    groupFilter,
    groupMembers,
    roleFilter,
    rolesMap,
  ]);

  const memberIds = useMemo(
    () => new Set(filteredProfiles.map((person) => person.id)),
    [filteredProfiles]
  );

  const buildWorkbook = async (full: boolean) => {
    const XLSX = await loadXlsxModule();

    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      throw new Error('Enter a valid date range in YYYY-MM-DD format.');
    }

    const masterRows = filteredProfiles.map((person, index) => ({
      'No.': index + 1,
      'Member Name': person.full_name || 'Unnamed Member',
      Local: churchMap.get(person.church_id) || 'Unassigned',
      Group: groupNamesFor(person.id) || '',
      'Member ID': person.id,
      Mobile: person.mobile || '',
      'Birth Date': person.birth_date || '',
      Sex: person.sex || '',
      'Active Roles': (rolesMap.get(person.id) ?? ['member'])
        .map((role) => ROLE_LABELS[role])
        .join(' | '),
      'Legacy Primary Role': person.role || '',
      'Account Status': person.is_active ? 'Active' : 'Inactive',
      'Created At': person.created_at || '',
    }));

    const assignmentRows: Row[] = [];

    for (const role of userRoles) {
      if (!memberIds.has(role.user_id)) continue;
      const person = profileMap.get(role.user_id);
      assignmentRows.push({
        'Record Type': 'Role',
        'Member ID': role.user_id,
        'Member Name': person?.full_name || '',
        Assignment: ROLE_LABELS[role.role as AppRole] || role.role,
        Scope: '',
        Status: role.is_active ? 'Active' : 'Inactive',
        'Started / Granted': role.granted_at || '',
        'Ended / Revoked': role.revoked_at || '',
        Notes: '',
      });
    }

    for (const membership of groupMembers) {
      if (!memberIds.has(membership.user_id)) continue;
      assignmentRows.push({
        'Record Type': 'BUKLOD Cluster Membership',
        'Member ID': membership.user_id,
        'Member Name': profileMap.get(membership.user_id)?.full_name || '',
        Assignment: groupMap.get(membership.group_id)?.name || membership.group_id,
        Scope:
          churchMap.get(groupMap.get(membership.group_id)?.church_id) || '',
        Status: membership.is_active ? 'Active' : 'Inactive',
        'Started / Granted': '',
        'Ended / Revoked': '',
        Notes: '',
      });
    }

    for (const group of groups) {
      if (!group.leader_id || !memberIds.has(group.leader_id)) continue;
      assignmentRows.push({
        'Record Type': 'BUKLOD Cluster Leader',
        'Member ID': group.leader_id,
        'Member Name': profileMap.get(group.leader_id)?.full_name || '',
        Assignment: group.name,
        Scope: churchMap.get(group.church_id) || '',
        Status: group.is_active ? 'Active' : 'Inactive',
        'Started / Granted': '',
        'Ended / Revoked': '',
        Notes: '',
      });
    }

    for (const row of mentorAssignments) {
      if (!memberIds.has(row.mentor_id) && !memberIds.has(row.disciple_id)) continue;
      assignmentRows.push({
        'Record Type': 'Mentor Assignment',
        'Member ID': row.disciple_id,
        'Member Name': profileMap.get(row.disciple_id)?.full_name || '',
        Assignment: `Mentor: ${profileMap.get(row.mentor_id)?.full_name || row.mentor_id}`,
        Scope: churchMap.get(profileMap.get(row.disciple_id)?.church_id) || '',
        Status: row.is_active ? 'Active' : 'Inactive',
        'Started / Granted': row.assigned_at || '',
        'Ended / Revoked': '',
        Notes: '',
      });
    }

    for (const row of pastorAssignments) {
      if (!memberIds.has(row.pastor_id)) continue;
      assignmentRows.push({
        'Record Type': 'Pastor Local Assignment',
        'Member ID': row.pastor_id,
        'Member Name': row.pastor_name || '',
        Assignment: row.church_name || '',
        Scope: row.church_name || '',
        Status: row.is_active ? 'Active' : 'Ended',
        'Started / Granted': row.assigned_at || '',
        'Ended / Revoked': row.ended_at || '',
        Notes: row.assignment_note || row.end_note || '',
      });
    }

    const learningRows: Row[] = [];

    for (const enrollment of enrollments) {
      if (!memberIds.has(enrollment.user_id)) continue;
      if (
        !inPeriod(enrollment.enrolled_at, dateFrom, dateTo) &&
        !inPeriod(enrollment.completed_at, dateFrom, dateTo)
      ) {
        continue;
      }

      const person = profileMap.get(enrollment.user_id);
      const track = trackMap.get(enrollment.track_id);
      learningRows.push({
        'Record Type': 'Track Enrollment',
        'Member ID': enrollment.user_id,
        'Member Name': person?.full_name || '',
        'Local Church': churchMap.get(person?.church_id) || '',
        Track: track?.title || enrollment.track_id,
        Lesson: '',
        Status: enrollment.status,
        'Started / Enrolled': enrollment.enrolled_at || '',
        Completed: enrollment.completed_at || '',
        Mentor: profileMap.get(enrollment.mentor_id)?.full_name || '',
        ...(full ? { Reflection: '' } : {}),
      });
    }

    for (const progress of lessonProgress) {
      if (!memberIds.has(progress.user_id)) continue;
      if (
        !inPeriod(progress.started_at, dateFrom, dateTo) &&
        !inPeriod(progress.completed_at, dateFrom, dateTo) &&
        !inPeriod(progress.updated_at, dateFrom, dateTo)
      ) {
        continue;
      }

      const person = profileMap.get(progress.user_id);
      const lesson = lessonMap.get(progress.lesson_id);
      const enrollment = enrollmentMap.get(progress.enrollment_id);
      const track = trackMap.get(enrollment?.track_id || lesson?.track_id);

      learningRows.push({
        'Record Type': 'Lesson Progress',
        'Member ID': progress.user_id,
        'Member Name': person?.full_name || '',
        'Local Church': churchMap.get(person?.church_id) || '',
        Track: track?.title || '',
        Lesson: lesson
          ? `${lesson.lesson_number}. ${lesson.title}`
          : progress.lesson_id,
        Status: progress.completed_at ? 'Completed' : 'In Progress',
        'Started / Enrolled': progress.started_at || '',
        Completed: progress.completed_at || '',
        Mentor: profileMap.get(enrollment?.mentor_id)?.full_name || '',
        ...(full ? { Reflection: progress.reflection_text || '' } : {}),
      });
    }

    const submissionMap = new Map(
      bibleSubmissions.map((row) => [
        `${row.assignment_id}:${row.user_id}`,
        row,
      ])
    );

    const currentManilaDate = manilaToday();
    const bibleRows: Row[] = [];

    for (const membership of bibleMembers) {
      if (!memberIds.has(membership.user_id)) continue;
      const assignment = bibleAssignmentMap.get(membership.assignment_id);
      if (!assignment || !inPeriod(assignment.reading_date, dateFrom, dateTo)) continue;

      const submission = submissionMap.get(
        `${membership.assignment_id}:${membership.user_id}`
      );

      let memberStatus = 'NOT STARTED';
      if (submission?.status === 'approved') memberStatus = 'VALID';
      else if (submission?.status === 'pending_admin') memberStatus = 'SUBMITTED';
      else if (submission?.status === 'rejected') memberStatus = 'REVIEW REQUIRED';
      else if (assignment.reading_date < currentManilaDate) memberStatus = 'MISSED';

      const person = profileMap.get(membership.user_id);
      bibleRows.push({
        'Reading Date': assignment.reading_date,
        'Member ID': membership.user_id,
        'Member Name': person?.full_name || '',
        'Local Church': churchMap.get(person?.church_id) || '',
        'Bible Reference': assignment.bible_reference,
        Status: memberStatus,
        'Submission Status': submission?.status || '',
        'Submitted At': submission?.submitted_at || '',
        'On Time': submission ? (submission.submitted_on_time ? 'Yes' : 'No') : '',
        'Reviewed At': submission?.reviewed_at || '',
        ...(full
          ? {
              'Reflection Answer': submission?.answer_text || '',
              'Admin Note': submission?.admin_note || '',
            }
          : {}),
      });
    }

    const pointRows = pointsLedger
      .filter((row) => memberIds.has(row.user_id))
      .filter((row) => inPeriod(row.created_at, dateFrom, dateTo))
      .map((row) => {
        const person = profileMap.get(row.user_id);
        const signed = row.direction === 'debit' ? -Number(row.points || 0) : Number(row.points || 0);
        return {
          Date: row.created_at || '',
          'Member ID': row.user_id,
          'Member Name': person?.full_name || '',
          'Local Church': churchMap.get(person?.church_id) || '',
          Direction: row.direction,
          Points: signed,
          Activity: row.activity_type,
          Description: row.description || '',
          'Source Key': row.source_key || '',
        };
      });

    const churchLifeRows = attendance
      .filter((row) => memberIds.has(row.user_id))
      .map((row) => ({ attendance: row, event: eventMap.get(row.event_id) }))
      .filter(({ event }) => event && inPeriod(event.starts_at, dateFrom, dateTo))
      .map(({ attendance: row, event }) => {
        const person = profileMap.get(row.user_id);
        return {
          'Event Date': event?.starts_at || '',
          'Member ID': row.user_id,
          'Member Name': person?.full_name || '',
          'Local Church': churchMap.get(person?.church_id) || '',
          Event: event?.title || '',
          'Event Type': event?.event_type || '',
          Scope: event?.scope || '',
          'Event Church': event?.church_id ? (churchMap.get(event.church_id) || '') : '',
          'BUKLOD Cluster': event?.group_id ? (groupMap.get(event.group_id)?.name || '') : '',
          Attendance: row.status || '',
          'Checked In At': row.checked_in_at || '',
          Note: row.note || '',
        };
      });

    let givingRows: Row[] = [];

    if (full) {
      const relevantChurches = churches.filter(
        (church) =>
          churchFilter === 'all' || church.id === churchFilter
      );

      for (const church of relevantChurches) {
        const { data, error } = await (supabase as any).rpc(
          'get_church_giving_masterlist',
          { p_church_id: church.id }
        );
        if (error) throw error;

        for (const row of data ?? []) {
          if (!memberIds.has(row.user_id)) continue;
          if (!inPeriod(row.payment_date || row.created_at, dateFrom, dateTo)) continue;

          givingRows.push({
            'Payment Date': row.payment_date || '',
            'Member ID': row.user_id,
            'Member Name': row.full_name || '',
            'Local Church': church.name,
            'Giving Type': row.giving_type || '',
            Amount: Number(row.amount || 0),
            'Payment Method': row.payment_method || '',
            'Reference Number': row.reference_number || '',
            Status: row.status || '',
            'Submitted At': row.created_at || '',
            'Verified At': row.verified_at || '',
            'Verified By': row.verifier_name || '',
          });
        }
      }
    }

    const netPoints = pointRows.reduce(
      (sum, row) => sum + Number(row.Points || 0),
      0
    );
    const completedLessons = learningRows.filter(
      (row) => row['Record Type'] === 'Lesson Progress' && row.Status === 'Completed'
    ).length;
    const bibleValid = bibleRows.filter((row) => row.Status === 'VALID').length;
    const presentAttendance = churchLifeRows.filter((row) =>
      ['present', 'late'].includes(String(row.Attendance).toLowerCase())
    ).length;
    const verifiedGiving = givingRows
      .filter((row) => row.Status === 'verified')
      .reduce((sum, row) => sum + Number(row.Amount || 0), 0);

    const dashboardRows: Row[] = [
      { Metric: 'Export Type', Value: full ? 'Full Admin Master Record' : 'General Member Masterlist' },
      { Metric: 'Period', Value: `${dateFrom} to ${dateTo}` },
      { Metric: 'Members in Filter', Value: filteredProfiles.length },
      { Metric: 'Active Members', Value: filteredProfiles.filter((p) => p.is_active).length },
      { Metric: 'Completed Lessons in Period', Value: completedLessons },
      { Metric: 'Valid Daily Bible Entries', Value: bibleValid },
      { Metric: 'Net BUKLOD Points in Period', Value: netPoints },
      { Metric: 'Present/Late Attendance Records', Value: presentAttendance },
    ];

    for (const role of ROLE_OPTIONS.filter((role) => role !== 'all') as AppRole[]) {
      dashboardRows.push({
        Metric: `${ROLE_LABELS[role]} Accounts`,
        Value: filteredProfiles.filter((person) =>
          (rolesMap.get(person.id) ?? ['member']).includes(role)
        ).length,
      });
    }

    for (const church of churches.filter((c) => c.is_active)) {
      dashboardRows.push({
        Metric: `Members - ${church.name}`,
        Value: filteredProfiles.filter((person) => person.church_id === church.id).length,
      });
    }

    if (full) {
      dashboardRows.push({
        Metric: 'Verified Giving in Period',
        Value: verifiedGiving,
      });
    }

    const exportInfoRows: Row[] = [
      { Field: 'Generated At', Value: new Date().toISOString() },
      { Field: 'Generated By', Value: profile?.full_name || profile?.id || 'System Admin' },
      { Field: 'Export Type', Value: full ? 'Full Admin Master Record' : 'General Member Masterlist' },
      { Field: 'Church Filter', Value: churchFilter === 'all' ? 'All Churches' : churchMap.get(churchFilter) || churchFilter },
      { Field: 'Group Filter', Value: groupFilter === 'all' ? 'All Groups' : groupMap.get(groupFilter)?.name || groupFilter },
      { Field: 'Role Filter', Value: roleFilter === 'all' ? 'All Roles' : ROLE_LABELS[roleFilter] },
      { Field: 'Active Only', Value: activeOnly ? 'Yes' : 'No' },
      { Field: 'Period Start', Value: dateFrom },
      { Field: 'Period End', Value: dateTo },
      {
        Field: 'Privacy Note',
        Value: full
          ? 'Restricted System Admin export. Contains financial and reflection details. Handle as confidential ministry records.'
          : 'General administrative masterlist. Financial details and reflection text are excluded.',
      },
      {
        Field: 'Excluded Data',
        Value: 'Passwords, auth tokens, secrets, proof-image files and private storage objects are never exported.',
      },
    ];

    const workbook = XLSX.utils.book_new();
    workbook.Props = {
      Title: full ? 'BUKLOD Full Admin Master Record' : 'Member Masterlist',
      Subject: 'BUKLOD member administrative records',
      Author: 'MZB Ministry Inc. - BUKLOD',
      CreatedDate: new Date(),
    };

    XLSX.utils.book_append_sheet(workbook, safeSheet(dashboardRows, XLSX), 'Summary Dashboard');
    XLSX.utils.book_append_sheet(workbook, safeSheet(masterRows, XLSX), 'Member Masterlist');
    XLSX.utils.book_append_sheet(workbook, safeSheet(assignmentRows, XLSX), 'Roles & Assignments');
    XLSX.utils.book_append_sheet(workbook, safeSheet(learningRows, XLSX), 'Learning Records');
    XLSX.utils.book_append_sheet(workbook, safeSheet(bibleRows, XLSX), 'Daily Bible');
    XLSX.utils.book_append_sheet(workbook, safeSheet(pointRows, XLSX), 'BUKLOD Points');
    XLSX.utils.book_append_sheet(workbook, safeSheet(churchLifeRows, XLSX), 'Church Life');
    if (full) {
      XLSX.utils.book_append_sheet(workbook, safeSheet(givingRows, XLSX), 'Giving Summary');
    }
    XLSX.utils.book_append_sheet(workbook, safeSheet(exportInfoRows, XLSX), 'Export Info');

    return workbook;
  };

  const exportWorkbook = async (full: boolean) => {
    const kind = full ? 'full' : 'general';
    setExporting(kind);

    try {
      const workbook = await buildWorkbook(full);
      const stamp = today();
      await shareWorkbook(
        full
          ? `buklod-full-admin-master-record-${stamp}.xlsx`
          : `buklod-member-masterlist-${stamp}.xlsx`,
        workbook
      );
    } catch (error: any) {
      Alert.alert('Excel Export', error?.message ?? 'Could not create workbook.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <AdminGate>
      <ScrollView
        style={shared.screen}
        contentContainerStyle={[shared.content, styles.content]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>PEOPLE | RECORDS | EXPORT</Text>
        <Text style={shared.h1}>Member Master Records</Text>
        <Text style={shared.muted}>
          Live BUKLOD records assembled into downloadable Excel workbooks. No duplicate
          master-record database is created.
        </Text>

        <View style={styles.notice}>
          <MaterialCommunityIcons name="shield-lock-outline" size={22} color="#275D45" />
          <Text style={styles.noticeText}>
            Full Admin export is restricted to System Administration and includes giving
            details and reflection text. Proof files, passwords, tokens and secrets are excluded.
          </Text>
        </View>

        <SectionTitle>FILTERS</SectionTitle>
        <Card>
          <Text style={styles.label}>LOCAL CHURCH</Text>
          <View style={styles.wrap}>
            <Chip label="All Churches" on={churchFilter === 'all'} onPress={() => setChurchFilter('all')} />
            {churches
              .filter((church) => church.is_active)
              .map((church) => (
                <Chip
                  key={church.id}
                  label={church.name}
                  on={churchFilter === church.id}
                  onPress={() => setChurchFilter(church.id)}
                />
              ))}
          </View>

          <Text style={[styles.label, styles.topGap]}>BUKLOD GROUP</Text>
          <View style={styles.wrap}>
            <Chip label="All Groups" on={groupFilter === 'all'} onPress={() => setGroupFilter('all')} />
            {visibleGroups.map((group) => (
              <Chip
                key={group.id}
                label={group.name}
                on={groupFilter === group.id}
                onPress={() => setGroupFilter(group.id)}
              />
            ))}
          </View>

          <Text style={[styles.label, styles.topGap]}>ROLE</Text>
          <View style={styles.wrap}>
            {ROLE_OPTIONS.map((role) => (
              <Chip
                key={role}
                label={role === 'all' ? 'All Roles' : ROLE_LABELS[role]}
                on={roleFilter === role}
                onPress={() => setRoleFilter(role)}
              />
            ))}
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>ACTIVE ACCOUNTS ONLY</Text>
              <Text style={styles.help}>Turn off to include inactive historical accounts.</Text>
            </View>
            <Switch value={activeOnly} onValueChange={setActiveOnly} />
          </View>

          <Text style={[styles.label, styles.topGap]}>ACTIVITY PERIOD</Text>
          <View style={styles.dateRow}>
            <TextInput
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
        </Card>

        <SectionTitle>MASTER RECORD STATUS</SectionTitle>
        <View style={styles.metrics}>
          <Metric label="Members" value={filteredProfiles.length} />
          <Metric label="Roles" value={userRoles.filter((r) => r.is_active && memberIds.has(r.user_id)).length} />
          <Metric label="Learning" value={lessonProgress.filter((r) => memberIds.has(r.user_id)).length} />
          <Metric label="Bible" value={bibleSubmissions.filter((r) => memberIds.has(r.user_id)).length} />
          <Metric label="Points" value={pointsLedger.filter((r) => memberIds.has(r.user_id)).length} />
          <Metric label="Attendance" value={attendance.filter((r) => memberIds.has(r.user_id)).length} />
        </View>

        <Button
          title={loading ? 'LOADING MASTER RECORDS...' : 'REFRESH MASTER RECORDS'}
          outline
          onPress={load}
        />

        <SectionTitle>EXCEL EXPORT</SectionTitle>
        <Card>
          <Text style={styles.exportTitle}>General Member Masterlist</Text>
          <Text style={styles.help}>
            Masterlist, roles and assignments, learning, Daily Bible status, BUKLOD Points,
            Church Life and dashboard. Financial details and reflection text are excluded.
          </Text>
          <Button
            title={exporting === 'general' ? 'CREATING EXCEL...' : 'EXPORT GENERAL MASTERLIST (.XLSX)'}
            onPress={() => exportWorkbook(false)}
          />
        </Card>

        <Card>
          <Text style={styles.exportTitle}>Full Admin Master Record</Text>
          <Text style={styles.help}>
            Adds reflection text and Giving Summary for restricted System Admin recordkeeping.
          </Text>
          <Button
            title={exporting === 'full' ? 'CREATING SECURE EXCEL...' : 'EXPORT FULL ADMIN MASTER RECORD (.XLSX)'}
            onPress={() => exportWorkbook(true)}
          />
        </Card>

        <View style={{ height: 80 }} />
      </ScrollView>
    </AdminGate>
  );
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 120 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#78857E',
    marginBottom: 4,
  },
  notice: {
    marginTop: 6,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,93,69,0.13)',
    backgroundColor: 'rgba(39,93,69,0.065)',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  noticeText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#526159',
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    color: colors.muted,
  },
  topGap: { marginTop: 16 },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
  },
  chipOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.text,
  },
  chipTextOn: { color: colors.green },
  switchRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  help: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
  },
  dateRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
    color: colors.text,
    fontSize: 12,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  metric: {
    minWidth: '30%',
    flexGrow: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.green,
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.muted,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
  },
});
