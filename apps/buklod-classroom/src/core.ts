import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, type Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const MAIN_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.mainSupabaseUrl || '';
const MAIN_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || extra.mainSupabaseKey || '';
export const QUIZ_URL = process.env.EXPO_PUBLIC_QUIZ_SUPABASE_URL || extra.quizSupabaseUrl || 'https://cjtehbfspgimyhifnjon.supabase.co';

if (!MAIN_URL || !MAIN_KEY) console.warn('BUKLOD Classroom: missing Main Supabase environment variables.');

export const supabase = createClient(MAIN_URL, MAIN_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 6 } },
  global: { headers: { 'x-buklod-client': 'classroom-native' } },
});

AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
    supabase.realtime.connect();
  } else {
    supabase.auth.stopAutoRefresh();
    supabase.realtime.disconnect();
  }
});

export type ClassroomCard = {
  classroom_id: string;
  class_name: string;
  subject_code: string | null;
  section_name: string | null;
  term: string | null;
  program_key: string | null;
  subject_type: string | null;
  faculty_name: string;
  faculty_avatar: string | null;
  current_percent: number | null;
  final_grade: number | null;
  final_status: string | null;
  pending_requirements: number;
  unread_notices: number;
  open_interventions: number;
  next_due_at: string | null;
};

export function normalizePhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, '');
  if (/^\+639\d{9}$/.test(cleaned)) return cleaned;
  if (/^639\d{9}$/.test(cleaned)) return `+${cleaned}`;
  if (/^09\d{9}$/.test(cleaned)) return `+63${cleaned.slice(1)}`;
  return null;
}
function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  return /^(?=.*[a-z])[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(username) && username.length >= 3 && username.length <= 30 ? username : null;
}
function mobileInternalEmail(phone: string) { return `m.${phone.replace(/\D/g, '')}@buklod.invalid`; }
function legacyMobileInternalEmail(phone: string) { return `${phone.replace(/\D/g, '')}@buklod.invalid`; }
function usernameInternalEmail(username: string) { return `u.${username}@buklod.invalid`; }

export async function loginBuklod(identifier: string, password: string) {
  const raw = identifier.trim();
  if (!raw || !password) throw new Error('Enter your Mobile Number, Username, or Email and password.');
  if (raw.includes('@')) {
    const r = await supabase.auth.signInWithPassword({ email: raw.toLowerCase(), password });
    if (r.error) throw r.error;
    return r.data;
  }
  const phone = normalizePhone(raw);
  if (phone) {
    let r = await supabase.auth.signInWithPassword({ email: mobileInternalEmail(phone), password });
    if (r.error) r = await supabase.auth.signInWithPassword({ email: legacyMobileInternalEmail(phone), password });
    if (r.error) throw r.error;
    return r.data;
  }
  const username = normalizeUsername(raw);
  if (!username) throw new Error('Enter a valid Mobile Number, Username, or Email.');
  const r = await supabase.auth.signInWithPassword({ email: usernameInternalEmail(username), password });
  if (r.error) throw r.error;
  return r.data;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function loadClassrooms(): Promise<ClassroomCard[]> {
  const { data, error } = await supabase.rpc('buklod_classroom_student_home_v2');
  if (error) throw error;
  return (data ?? []) as ClassroomCard[];
}

export async function loadGradeHealth(classroomId: string) {
  const { data, error } = await supabase.rpc('buklod_classroom_student_grade_health_v2', { p_classroom_id: classroomId });
  if (error) throw error;
  return data as any;
}

export async function loadAttendance(classroomId: string) {
  const { data, error } = await supabase.rpc('buklod_classroom_student_attendance_v1', { p_classroom_id: classroomId });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function loadReleasedGradeItems(classroomId: string) {
  const { data, error } = await supabase.rpc('buklod_classroom_student_released_grade_items_v1', { p_classroom_id: classroomId });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function loadReleasedQuizResults() {
  const session = await getSession();
  if (!session?.access_token) throw new Error('Sign in required.');
  const response = await fetch(`${QUIZ_URL}/functions/v1/buklod-quiz-student-bridge-v1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'released_results', limit: 500 }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'Could not load BUKLOD Quiz records.');
  return (body?.results ?? []) as any[];
}

export async function loadAssignments(classroomId: string) {
  const { data, error } = await supabase.from('buklod_education_classroom_assignments').select('id,title,description,instructions,points_possible,submission_types,auto_grading_mode,available_from,due_at,closes_at,status,term_key,visibility_mode,video_recitation').eq('classroom_id', classroomId).eq('status', 'PUBLISHED').order('due_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadMySubmissions(classroomId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user?.id) return [];
  const { data, error } = await supabase.from('buklod_education_classroom_submissions').select('*').eq('classroom_id', classroomId).eq('student_user_id', user.user.id).order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function loadMaterials(classroomId: string) {
  const { data, error } = await supabase.from('buklod_education_classroom_files').select('id,entity_type,entity_id,file_kind,original_name,mime_type,file_size,external_url,caption,storage_bucket,storage_path,created_at').eq('classroom_id', classroomId).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return data ?? [];
}

export async function loadPosts(classroomId: string) {
  const { data, error } = await supabase.from('buklod_education_classroom_posts').select('id,author_user_id,post_type,title,body,is_pinned,is_locked,created_at').eq('classroom_id', classroomId).is('deleted_at', null).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function loadGroups(classroomId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user?.id) return [];
  const { data, error } = await supabase.from('buklod_education_group_members_v2').select('group_id,group_role,buklod_education_groups_v2(id,name,group_type,description,privacy_mode,public_showcase)').eq('classroom_id', classroomId).eq('student_user_id', user.user.id);
  if (error) throw error;
  return data ?? [];
}

export async function loadRle(classroomId: string) {
  const [rot, hrs, comp, journals] = await Promise.all([
    supabase.from('buklod_education_rle_rotations').select('*').eq('classroom_id', classroomId).order('starts_at'),
    supabase.from('buklod_education_rle_hours').select('*').eq('classroom_id', classroomId).order('duty_date', { ascending: false }),
    supabase.from('buklod_education_competency_records').select('*,buklod_education_competencies(title,completion_required,minimum_attempts)').eq('classroom_id', classroomId).order('created_at', { ascending: false }),
    supabase.from('buklod_education_journals').select('*').eq('classroom_id', classroomId).order('journal_date', { ascending: false }),
  ]);
  const e = rot.error || hrs.error || comp.error || journals.error; if (e) throw e;
  return { rotations: rot.data ?? [], hours: hrs.data ?? [], competencies: comp.data ?? [], journals: journals.data ?? [] };
}

export async function loadNotices(classroomId: string) {
  const { data, error } = await supabase.from('buklod_education_notices').select('*').eq('classroom_id', classroomId).lte('visible_from', new Date().toISOString()).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function recordFocus(classroomId: string, sessionId: string | null, eventType: string, metadata: Record<string, unknown> = {}) {
  await supabase.from('buklod_education_focus_events').insert({ classroom_id: classroomId, live_session_id: sessionId, student_user_id: (await supabase.auth.getUser()).data.user?.id, event_type: eventType, metadata });
}
