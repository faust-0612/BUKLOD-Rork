/** Cosmetic story journey. This module never creates a points source key. */

export type JourneyMark = {
  kind: 'story_journey';
  episodeId: string;
  progressPercent: number;
  ledgerSourceKey: null;
};

export function journeyMark(episodeId: string, progressPercent: number, readable: boolean): JourneyMark | null {
  if (!readable) return null;
  const percent = Math.max(0, Math.min(100, Math.round(progressPercent)));
  return {
    kind: 'story_journey',
    episodeId,
    progressPercent: percent,
    ledgerSourceKey: null,
  };
}

export function journeySummary(completedReadableEpisodes: number, seasonEpisodeCount: number): {
  completed: number;
  total: number;
  percent: number;
} {
  const total = Math.max(0, seasonEpisodeCount);
  const completed = Math.max(0, Math.min(total, completedReadableEpisodes));
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
