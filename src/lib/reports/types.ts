export type AnalyticsScope = 'system' | 'church' | 'group';

export type ReportRange = {
  dateFrom: string;
  dateTo: string;
};

export type AnalyticsOverview = {
  scope: AnalyticsScope;
  church_id: string | null;
  group_id: string | null;
  date_from: string;
  date_to: string;
  members: number;
  devotional: {
    members_active: number;
    completions: number;
    average_days_per_member: number;
    member_participation_rate: number;
    period_days: number;
  };
  community: {
    posts: number;
    comments: number;
  };
  prayer: {
    requests: number;
    answered: number;
  };
  learning: {
    active_enrollments: number;
    tracks_completed: number;
    lessons_completed: number;
  };
  events: {
    events: number;
    attendance_present: number;
    attendance_late: number;
    attendance_excused: number;
    attendance_absent: number;
  };
  visitors: {
    new_visitors: number;
    followups_created: number;
    membership_pipeline: number;
  };
  ministry: {
    active_participants: number;
  };
  care: {
    open_followups: number;
  };
};
