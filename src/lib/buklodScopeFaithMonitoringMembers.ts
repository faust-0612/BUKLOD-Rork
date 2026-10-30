import { supabase } from '@/lib/supabase';

export type FaithMonitoringArea = 'daily' | 'devotion' | 'lesson';
export type FaithMonitoringMemberFilter =
  | 'all' | 'approved' | 'submitted' | 'checking' | 'revision'
  | 'missing' | 'weekly' | 'active' | 'completed' | 'in_progress';

export type FaithMonitoringActivity = {
  submitted: boolean;
  approved: boolean;
  checking: boolean;
  revision: boolean;
  weekly: boolean;
  latest_at: string | null;
  latest_reference: string | null;
};

export type FaithMonitoringLessonStage = {
  stage_code: number;
  stage_title: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED';
  approved_lessons: number;
  expected_lessons: number;
  verified_requirements: number;
  required_requirements: number;
};

export type FaithMonitoringMember = {
  user_id: string;
  member_name: string;
  reading: FaithMonitoringActivity;
  devotion: FaithMonitoringActivity;
  lesson: {
    has_activity: boolean;
    stages: FaithMonitoringLessonStage[];
  };
};

export type FaithMonitoringMembersResult = {
  scope_id: string;
  scope_name: string;
  report_date: string;
  members: FaithMonitoringMember[];
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function activity(value: unknown): FaithMonitoringActivity {
  const row = record(value);
  return {
    submitted: row.submitted === true,
    approved: row.approved === true,
    checking: row.checking === true,
    revision: row.revision === true,
    weekly: row.weekly === true,
    latest_at: typeof row.latest_at === 'string' ? row.latest_at : null,
    latest_reference: typeof row.latest_reference === 'string' ? row.latest_reference : null,
  };
}

function parseStage(value: unknown): FaithMonitoringLessonStage | null {
  const row = record(value);
  const stage_code = Number(row.stage_code);
  if (!Number.isInteger(stage_code) || stage_code < 101 || stage_code > 107) return null;
  const status = row.status === 'COMPLETED' || row.status === 'IN_PROGRESS'
    ? row.status : 'NOT_STARTED';
  return {
    stage_code,
    stage_title: String(row.stage_title ?? `Stage ${stage_code}`),
    status,
    approved_lessons: Number(row.approved_lessons ?? 0),
    expected_lessons: Number(row.expected_lessons ?? 0),
    verified_requirements: Number(row.verified_requirements ?? 0),
    required_requirements: Number(row.required_requirements ?? 0),
  };
}

export async function fetchFaithMonitoringMembers(scopeId: string): Promise<FaithMonitoringMembersResult> {
  const { data, error } = await supabase.rpc('buklod_scope_faith_monitoring_members_v1' as any, {
    p_scope_id: scopeId,
  } as any);
  if (error) {
    const message = String(error.message ?? '');
    if (error.code === '42501' || /not authorized|authentication required/i.test(message)) {
      throw new Error('Only authorized workspace leaders can view member progress.');
    }
    if (/could not find the function|function .* does not exist|schema cache/i.test(message)) {
      throw new Error('Member monitoring is being set up for this workspace. Please try again later.');
    }
    throw error;
  }
  const result = record(data);
  if (String(result.scope_id ?? '') !== scopeId || !Array.isArray(result.members)) {
    throw new Error('Member monitoring data is unavailable. Please try again.');
  }
  return {
    scope_id: scopeId,
    scope_name: String(result.scope_name ?? 'Faith Monitoring'),
    report_date: String(result.report_date ?? ''),
    members: result.members.flatMap((value: unknown) => {
      const row = record(value);
      if (typeof row.user_id !== 'string') return [];
      const lesson = record(row.lesson);
      return [{
        user_id: row.user_id,
        member_name: String(row.member_name ?? 'Member'),
        reading: activity(row.reading),
        devotion: activity(row.devotion),
        lesson: {
          has_activity: lesson.has_activity === true,
          stages: Array.isArray(lesson.stages)
            ? lesson.stages.map(parseStage).filter((stage): stage is FaithMonitoringLessonStage => stage !== null)
            : [],
        },
      }];
    }),
  };
}

export function matchesFaithMonitoringMember(
  member: FaithMonitoringMember,
  area: FaithMonitoringArea,
  filter: FaithMonitoringMemberFilter,
  stageCode?: number,
): boolean {
  if (filter === 'all') return true;
  if (area === 'lesson') {
    if (stageCode) {
      const stage = member.lesson.stages.find((item) => item.stage_code === stageCode);
      if (filter === 'completed') return stage?.status === 'COMPLETED';
      if (filter === 'in_progress') return stage?.status === 'IN_PROGRESS';
      if (filter === 'missing') return !stage || stage.status === 'NOT_STARTED';
    }
    if (filter === 'active' || filter === 'in_progress') return member.lesson.has_activity;
    if (filter === 'missing') return !member.lesson.has_activity;
    return false;
  }
  const activityRow = area === 'daily' ? member.reading : member.devotion;
  switch (filter) {
    case 'approved': case 'completed': return activityRow.approved;
    case 'submitted': return activityRow.submitted;
    case 'checking': return activityRow.checking;
    case 'revision': return activityRow.revision;
    case 'weekly': return activityRow.weekly;
    case 'missing': return !activityRow.submitted;
    default: return false;
  }
}

export function memberMonitoringStatus(member: FaithMonitoringMember, area: FaithMonitoringArea, stageCode?: number) {
  if (area === 'lesson') {
    if (stageCode) {
      const stage = member.lesson.stages.find((item) => item.stage_code === stageCode);
      return stage?.status === 'COMPLETED' ? 'Completed'
        : stage?.status === 'IN_PROGRESS' ? 'In progress' : 'Not started';
    }
    return member.lesson.has_activity ? 'Has lesson activity' : 'Not yet started';
  }
  const row = area === 'daily' ? member.reading : member.devotion;
  if (row.revision) return 'Needs revision';
  if (row.checking) return 'Automatic checking';
  if (row.approved) return area === 'daily' ? 'Approved' : 'Completed';
  if (row.submitted) return 'Submitted';
  return area === 'daily' ? 'Not submitted' : 'Not completed';
}
