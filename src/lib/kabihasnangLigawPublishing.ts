/**
 * Client helpers are not the publication authority.
 * Readable episodes are decided by kl_* server functions and the gates in
 * src/lib/kabihasnang-ligaw/gates.ts. This wrapper stays fail-closed so a
 * handset clock cannot reveal an unapproved chapter.
 */
export const KL_TIME_ZONE = 'Asia/Manila' as const;
export const KL_RELEASE_HOUR = 6 as const;

export type KlEpisodeStatus = 'draft' | 'approved' | 'paused';
export type KlEpisode = {
  id: string;
  season_id: string;
  episode_number: number;
  title: string;
  release_at: string;
  approved_at: string | null;
  status: KlEpisodeStatus;
  content: Array<{ type: 'paragraph' | 'image' | 'audio' | 'glossary'; text?: string; uri?: string }>;
};

export function isVisiblePreview(): boolean {
  return false;
}

export function validateEpisodeForApproval(episode: KlEpisode): string[] {
  const issues: string[] = ['manuscript is not approved for publication'];
  if (!episode.title.trim()) issues.push('missing title');
  if (!Number.isFinite(Date.parse(episode.release_at))) issues.push('invalid release time');
  return issues;
}
