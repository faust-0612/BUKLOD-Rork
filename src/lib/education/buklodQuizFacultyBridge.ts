import { supabase } from '@/lib/supabase';

const DEDICATED_QUIZ_BRIDGE_URL =
  'https://cjtehbfspgimyhifnjon.supabase.co/functions/v1/buklod-quiz-faculty-bridge-v1';

export type DedicatedQuizReleasedResult = {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  section_id: string | null;
  section_name: string | null;
  student_user_id: string;
  student_name: string;
  student_no: string | null;
  attempt_no: number;
  total_score: number | null;
  max_score: number | null;
  score_percent: number | null;
  released_at: string;
  integrity_events: number;
};

export type DedicatedQuizSection = {
  id: string;
  exam_id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
};

export type DedicatedQuizExam = {
  id: string;
  title: string;
  status: string;
  total_points: number | null;
  created_at: string;
  updated_at: string;
  sections: DedicatedQuizSection[];
};

async function invokeDedicatedQuizBridge<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('A signed-in BUKLOD session is required.');

  const response = await fetch(DEDICATED_QUIZ_BRIDGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(String(payload?.error ?? `Dedicated BUKLOD Quiz bridge failed (${response.status}).`));
  }
  if (payload?.error) throw new Error(String(payload.error));
  return payload as T;
}

export async function getDedicatedQuizReleasedResults(limit = 1000) {
  const payload = await invokeDedicatedQuizBridge<{ results: DedicatedQuizReleasedResult[] }>({
    action: 'released_results',
    limit,
  });
  return payload.results ?? [];
}

export async function getDedicatedQuizExamCatalog() {
  const payload = await invokeDedicatedQuizBridge<{ exams: DedicatedQuizExam[] }>({
    action: 'exam_catalog',
  });
  return payload.exams ?? [];
}

export type FacultyRosterBridgeStudent = {
  student_user_id: string;
  display_name?: string | null;
  first_name?: string | null;
  surname?: string | null;
  student_no?: string | null;
};

export async function syncFacultyRosterToDedicatedQuiz(input: {
  examId: string;
  sectionId: string;
  students: FacultyRosterBridgeStudent[];
}) {
  return invokeDedicatedQuizBridge<{
    exam_id: string;
    exam_title: string;
    section_id: string;
    section_name: string;
    requested: number;
    synced: number;
    dedicated_profiles_found: number;
  }>({
    action: 'sync_roster',
    exam_id: input.examId,
    section_id: input.sectionId,
    students: input.students,
  });
}
