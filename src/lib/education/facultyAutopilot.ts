import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

export type FacultyClassroomRef = {
  id: string;
  name: string;
};

export type FacultyAutopilotModule = {
  key:
    | 'roster'
    | 'materials'
    | 'attendance'
    | 'assessments'
    | 'quickcheck'
    | 'gradingSetup'
    | 'gradebook'
    | 'participation'
    | 'progress'
    | 'exceptions';
  icon: string;
  title: string;
  description: string;
  pathname: string;
};

export const FACULTY_AUTOPILOT_MODULES: FacultyAutopilotModule[] = [
  {
    key: 'roster',
    icon: 'account-group-outline',
    title: 'Roster & Groups',
    description: 'Enroll students, form groups, and track individual contribution.',
    pathname: '/profile/buklod-faculty-roster',
  },
  {
    key: 'materials',
    icon: 'folder-multiple-outline',
    title: 'Materials',
    description: 'Share PDF, PPT, Word, video, and downloadable files.',
    pathname: '/profile/buklod-faculty-materials',
  },
  {
    key: 'attendance',
    icon: 'calendar-check-outline',
    title: 'Attendance',
    description: 'Open class sessions, review time in/out, and send uncertain cases to Exceptions.',
    pathname: '/profile/buklod-faculty-attendance',
  },
  {
    key: 'assessments',
    icon: 'clipboard-text-outline',
    title: 'Assessments',
    description: 'Quizzes, exams, paper scans, rubrics, and review queues.',
    pathname: '/profile/buklod-faculty-assessments',
  },
  {
    key: 'quickcheck',
    icon: 'door-open',
    title: 'QuickCheck',
    description: 'Scan mixed papers, auto-sort, suggest grades, and review only flags. Opens this class with its enrolled roster—no second sign-in.',
    pathname: 'quickcheck',
  },
  {
    key: 'gradingSetup',
    icon: 'tune-variant',
    title: 'Grading Setup',
    description: 'Edit Prelim, Midterm, Semifinals, Finals, category weights, formula, and passing grade.',
    pathname: '/profile/buklod-faculty-grading-setup',
  },
  {
    key: 'gradebook',
    icon: 'chart-box-outline',
    title: 'Gradebook',
    description: 'Term-aware automatic totals, manual entries, release controls, and audit trail.',
    pathname: '/profile/buklod-faculty-final-grades',
  },
  {
    key: 'participation',
    icon: 'account-star-outline',
    title: 'Participation & Conduct',
    description: 'Recitation, engagement, group work, and rubric-based professional conduct.',
    pathname: '/profile/buklod-faculty-participation',
  },
  {
    key: 'progress',
    icon: 'chart-timeline-variant',
    title: 'Progress & Reports',
    description: 'Current standing, final grades, consultation, and Excel-ready reports.',
    pathname: '/profile/buklod-faculty-progress',
  },
  {
    key: 'exceptions',
    icon: 'alert-circle-outline',
    title: 'Exception Queue',
    description: 'Review only uncertain grades, anomalies, and student cases needing attention.',
    pathname: '/profile/buklod-faculty-exceptions',
  },
];

export function facultyClassParams(classroom: FacultyClassroomRef) {
  return {
    id: classroom.id,
    classroomId: classroom.id,
    name: classroom.name,
  };
}

async function openQuickCheck(classroom: FacultyClassroomRef) {
  try {
    const { data, error } = await supabase.functions.invoke('quickcheck-handoff-mint', {
      body: { classroomId: classroom.id },
    });
    if (error) throw error;
    const url = typeof data?.url === 'string' ? data.url : '';
    if (!url) throw new Error('QuickCheck did not return a secure launch link.');
    const supported = await Linking.canOpenURL(url);
    if (!supported) throw new Error('This device cannot open the QuickCheck web app.');
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert(
      'QuickCheck',
      error instanceof Error
        ? error.message
        : 'Could not open QuickCheck. Please try again from this classroom.'
    );
  }
}

export function openFacultyAutopilotModule(
  module: FacultyAutopilotModule,
  classroom: FacultyClassroomRef | null
) {
  if (!classroom?.id) {
    Alert.alert(
      'Select a class',
      'Create or choose a class first. Every Autopilot tool stays inside that classroom.'
    );
    return;
  }

  if (module.key === 'quickcheck') {
    void openQuickCheck(classroom);
    return;
  }

  router.push({
    pathname: module.pathname as any,
    params: facultyClassParams(classroom),
  });
}

export function resolveFacultyClassroom(
  classrooms: FacultyClassroomRef[],
  preferredId?: string | null
) {
  if (preferredId) {
    const match = classrooms.find(item => item.id === preferredId);
    if (match) return match;
  }
  if (classrooms.length === 1) return classrooms[0];
  return null;
}
