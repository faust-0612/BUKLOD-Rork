import {
  formatFaithMonitoringRate,
  type ScopeFaithMonitoringSummary,
} from '@/lib/buklodScopeFaithMonitoring';

export type FaithMonitoringAnalysisSection = {
  key: string;
  body: string;
};

export function buildFaithMonitoringAnalysis(
  summary: ScopeFaithMonitoringSummary
): FaithMonitoringAnalysisSection[] {
  const members = summary.active_members;
  const daily = summary.daily_reading;
  const devotion = summary.devotion;
  const lesson = summary.buklod_lesson;

  const sections: FaithMonitoringAnalysisSection[] = [
    {
      key: 'OVERVIEW',
      body: `Report date ${summary.summary_date}. ${members} active member${
        members === 1 ? '' : 's'
      } tracked for Daily Reading, Devotion, and Buklod Lesson in ${
        summary.scope_name
      }.`,
    },
    {
      key: 'DAILY READING',
      body: `${daily.approved_today} of ${members} (${formatFaithMonitoringRate(
        daily.approved_today,
        members
      )}) approved today. ${daily.submitted_today} submitted, ${
        daily.pending_review
      } pending review, and ${daily.not_submitted_today} not yet submitted. This week: ${
        daily.approved_this_week
      } approved.`,
    },
    {
      key: 'DEVOTION',
      body: `${devotion.completed_today} of ${members} (${formatFaithMonitoringRate(
        devotion.completed_today,
        members
      )}) completed today. ${devotion.not_completed_today} not completed today. This week: ${
        devotion.completed_this_week
      } completed.`,
    },
    {
      key: 'BUKLOD LESSON',
      body: `${lesson.members_active} members have lesson activity. ${
        lesson.members_not_started
      } have not started yet.${
        lesson.stages.length
          ? ` Stage progress: ${lesson.stages
              .map(
                (stage) =>
                  `BUKLOD ${stage.stage_code} (${stage.completed_count} done, ${stage.in_progress_count} in progress)`
              )
              .join('; ')}.`
          : ''
      }`,
    },
  ];

  if (members > 0 && daily.not_submitted_today > members * 0.4) {
    sections.push({
      key: 'ATTENTION',
      body: 'More than 40% of members have not submitted Daily Reading today. Consider a gentle reminder before end of day.',
    });
  }

  if (members > 0 && devotion.not_completed_today > members * 0.5) {
    sections.push({
      key: 'DEVOTION FOLLOW-UP',
      body: 'Over half of members have not completed Devotion today. A short encouragement post may help.',
    });
  }

  return sections;
}

export function faithMonitoringSummaryToCsvRows(
  summary: ScopeFaithMonitoringSummary
) {
  const rows: Record<string, string | number>[] = [
    {
      section: 'Summary',
      metric: 'Scope',
      value: summary.scope_name,
    },
    {
      section: 'Summary',
      metric: 'Report date',
      value: summary.summary_date,
    },
    {
      section: 'Summary',
      metric: 'Active members',
      value: summary.active_members,
    },
    {
      section: 'Daily Reading',
      metric: 'Approved today',
      value: summary.daily_reading.approved_today,
    },
    {
      section: 'Daily Reading',
      metric: 'Submitted today',
      value: summary.daily_reading.submitted_today,
    },
    {
      section: 'Daily Reading',
      metric: 'Pending review',
      value: summary.daily_reading.pending_review,
    },
    {
      section: 'Daily Reading',
      metric: 'Not submitted today',
      value: summary.daily_reading.not_submitted_today,
    },
    {
      section: 'Daily Reading',
      metric: 'Approved this week',
      value: summary.daily_reading.approved_this_week,
    },
    {
      section: 'Devotion',
      metric: 'Completed today',
      value: summary.devotion.completed_today,
    },
    {
      section: 'Devotion',
      metric: 'Not completed today',
      value: summary.devotion.not_completed_today,
    },
    {
      section: 'Devotion',
      metric: 'Completed this week',
      value: summary.devotion.completed_this_week,
    },
    {
      section: 'Buklod Lesson',
      metric: 'Members with activity',
      value: summary.buklod_lesson.members_active,
    },
    {
      section: 'Buklod Lesson',
      metric: 'Not yet started',
      value: summary.buklod_lesson.members_not_started,
    },
  ];

  for (const stage of summary.buklod_lesson.stages) {
    rows.push(
      {
        section: `BUKLOD ${stage.stage_code}`,
        metric: 'Stage title',
        value: stage.stage_title,
      },
      {
        section: `BUKLOD ${stage.stage_code}`,
        metric: 'Completed',
        value: stage.completed_count,
      },
      {
        section: `BUKLOD ${stage.stage_code}`,
        metric: 'In progress',
        value: stage.in_progress_count,
      }
    );
  }

  return rows;
}
