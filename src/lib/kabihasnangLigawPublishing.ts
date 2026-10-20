export const KL_TIME_ZONE = 'Asia/Manila' as const;
export const KL_RELEASE_HOUR = 6 as const;
export const KL_EPISODE_POINTS = 2 as const;
export const KL_SEASON_POINTS = 10 as const;
export type KlEpisodeStatus = 'draft' | 'approved' | 'paused';
export type KlEpisode = {
  id: string; season_id: string; episode_number: number; title: string;
  release_at: string; approved_at: string | null; status: KlEpisodeStatus;
  content: Array<{ type: 'paragraph' | 'image' | 'audio' | 'glossary'; text?: string; uri?: string }>;
};
/** Time comparisons must be repeated on the server; this is display-only. */
export function isVisiblePreview(episode: KlEpisode, now = new Date()): boolean {
  return episode.status === 'approved' && !!episode.approved_at &&
    Number.isFinite(Date.parse(episode.release_at)) &&
    Date.parse(episode.release_at) <= now.getTime();
}
export function validateEpisodeForApproval(episode: KlEpisode): string[] {
  const issues: string[] = [];
  if (!episode.title.trim()) issues.push('missing title');
  if (!episode.content.some(b => b.type === 'paragraph' && !!b.text?.trim())) issues.push('missing story paragraphs');
  if (!Number.isFinite(Date.parse(episode.release_at))) issues.push('invalid release time');
  else {
    const localHour = new Intl.DateTimeFormat('en-GB', {timeZone: KL_TIME_ZONE, hour: '2-digit', hourCycle: 'h23'}).format(new Date(episode.release_at));
    if (localHour !== '06') issues.push('release must be 06:00 Asia/Manila');
  }
  return issues;
}
