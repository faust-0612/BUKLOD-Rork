import { supabase } from '@/lib/supabase';

export type BuklodClassroomLauncherAccess = {
  can_open: boolean;
  is_faculty: boolean;
  is_student: boolean;
  default_mode: 'FACULTY' | 'STUDENT' | 'CHOOSE' | null;
  faculty_class_count: number;
  student_class_count: number;
  faculty_subscription_required?: boolean;
  student_subscription_required?: boolean;
  classroom_focus_app?: boolean;
  reason?: string;
};

const DENIED: BuklodClassroomLauncherAccess = {
  can_open: false,
  is_faculty: false,
  is_student: false,
  default_mode: null,
  faculty_class_count: 0,
  student_class_count: 0,
  faculty_subscription_required: true,
  student_subscription_required: false,
  classroom_focus_app: true,
  reason: 'NO_CLASSROOM_ROLE',
};

export async function getBuklodClassroomLauncherAccess(): Promise<BuklodClassroomLauncherAccess> {
  const { data, error } = await supabase.rpc('buklod_classroom_launcher_access_v1');

  if (error) {
    console.warn('[BUKLOD Classroom] launcher authority failed', error.message);
    return DENIED;
  }

  const value = (data ?? {}) as Partial<BuklodClassroomLauncherAccess>;
  return {
    can_open: !!value.can_open,
    is_faculty: !!value.is_faculty,
    is_student: !!value.is_student,
    default_mode: value.default_mode ?? null,
    faculty_class_count: Number(value.faculty_class_count ?? 0),
    student_class_count: Number(value.student_class_count ?? 0),
    faculty_subscription_required: value.faculty_subscription_required ?? true,
    student_subscription_required: value.student_subscription_required ?? false,
    classroom_focus_app: value.classroom_focus_app ?? true,
    reason: value.reason,
  };
}
