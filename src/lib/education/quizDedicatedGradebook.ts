import { supabase } from '@/lib/supabase';

const QUIZ_URL =
  process.env.EXPO_PUBLIC_BUKLOD_QUIZ_URL ||
  'https://cjtehbfspgimyhifnjon.supabase.co';
const QUIZ_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_BUKLOD_QUIZ_PUBLISHABLE_KEY ||
  'sb_publishable_06d3QBjV_26E8Rk9rS4GMw_SCJ6P8sO';
const GRADEBOOK_EXPORT_URL = `${QUIZ_URL}/functions/v1/buklod-quiz-gradebook-export-v1`;

type QuizSection = {
  id: string;
  exam_id: string;
  name: string;
  sort_order: number;
};

export type QuizDedicatedExam = {
  id: string;
  title: string;
  status: string;
  total_points: number;
  updated_at: string;
  sections: QuizSection[];
};

export type QuizDedicatedReleasedRow = {
  student_user_id: string;
  attempt_no: number;
  total_score: number;
  max_score: number;
  released_at: string;
};

export type QuizDedicatedExport = {
  exam_id: string;
  exam_title: string;
  points_possible: number;
  section_id: string | null;
  section_name: string | null;
  released_rows: QuizDedicatedReleasedRow[];
  released_count: number;
  source_system: 'BUKLOD_QUIZ_DEDICATED';
};

async function callBridge<T>(body: Record<string, unknown>): Promise<T> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error('Please sign in to BUKLOD Main again.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(GRADEBOOK_EXPORT_URL, {
      method: 'POST',
      headers: {
        apikey: QUIZ_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `Quiz Dedicated bridge failed (${response.status}).`);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Quiz Dedicated bridge timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getQuizDedicatedExamCatalog() {
  const payload = await callBridge<{ exams?: QuizDedicatedExam[] }>({ action: 'catalog' });
  return Array.isArray(payload.exams) ? payload.exams : [];
}

export async function exportQuizDedicatedReleasedResults(
  examId: string,
  sectionId?: string | null
) {
  return callBridge<QuizDedicatedExport>({
    action: 'export',
    exam_id: examId,
    section_id: sectionId || null,
  });
}
