/**
 * KL_ADMIN_RELEASE_PREFLIGHT_R1
 * Browser/native-safe, side-effect-free eligibility checks.
 * Server RPC remains the final authoritative release/approval gate.
 */
export type KlAdminChapterRow = {
  id: string;
  season_number: number;
  episode_number: number;
  status: string;
  approved_at: string | null;
  release_at: string | null;
  preview_ready: boolean;
  has_manuscript: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseKlAdminChapters(data: unknown): KlAdminChapterRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row: unknown): KlAdminChapterRow[] => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id : '';
    const season = Number(item.season_number);
    const episode = Number(item.episode_number);
    if (!UUID.test(id) || !Number.isInteger(season) || season < 1 ||
        !Number.isInteger(episode) || episode < 0) return [];
    return [{
      id,
      season_number: season,
      episode_number: episode,
      status: String(item.status ?? 'unknown').toLowerCase(),
      approved_at: typeof item.approved_at === 'string' ? item.approved_at : null,
      release_at: typeof item.release_at === 'string' ? item.release_at : null,
      preview_ready: item.preview_ready === true,
      has_manuscript: item.has_manuscript === true,
    }];
  });
}

export function findKlAdminChapter(
  rows: KlAdminChapterRow[],
  seasonNumber: number,
  episodeNumber: number,
): KlAdminChapterRow | null {
  return rows.find(row =>
    row.season_number === seasonNumber && row.episode_number === episodeNumber) ?? null;
}

export function isKlChapterReleased(row: KlAdminChapterRow | null, now = Date.now()): boolean {
  if (!row || row.status !== 'approved' || !row.approved_at || !row.release_at) return false;
  const at = Date.parse(row.release_at);
  return Number.isFinite(at) && at <= now;
}

export function klReleaseBlockers(row: KlAdminChapterRow | null, now = Date.now()): string[] {
  if (!row) return ['Chapter not found in the server. Create or open it in KL Studio first.'];
  if (isKlChapterReleased(row, now)) return ['This chapter has already been released.'];
  const blockers: string[] = [];
  if (!row.has_manuscript) blockers.push('Save the full manuscript in KL Studio.');
  if (!row.preview_ready) blockers.push('Prepare the private preview in KL Studio.');
  if (row.status !== 'approved' || !row.approved_at)
    blockers.push('Approve the chapter in KL Admin before release.');
  // The server separately checks manuscript length and EVERY media approval.
  return blockers;
}
