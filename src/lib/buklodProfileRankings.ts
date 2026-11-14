/** Restrict Profile rankings to the canonical signed-in Points Top 10 RPC. */
export type BuklodProfileTopRank = {
  rank_position: number;
  user_id: string;
  full_name: string | null;
  total_points: number;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeInteger(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * A missing/bad response is not a ranking. In particular, never invent ranks
 * 1–10 or substitute an array index for the server's rank_position.
 */
export function parseBuklodProfileTopTen(value: unknown): BuklodProfileTopRank[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > 10) return null;
  const seenPositions = new Set<number>();
  const seenUsers = new Set<string>();
  const parsed: BuklodProfileTopRank[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const rank = safeInteger(row.rank_position);
    const points = safeInteger(row.total_points);
    const userId = typeof row.user_id === 'string' ? row.user_id.trim() : '';
    if (rank === null || rank < 1 || rank > 10 || points === null || !uuid.test(userId)
      || seenPositions.has(rank) || seenUsers.has(userId)) return null;
    seenPositions.add(rank);
    seenUsers.add(userId);
    parsed.push({
      rank_position: rank,
      user_id: userId,
      full_name: typeof row.full_name === 'string' ? row.full_name : null,
      total_points: points,
    });
  }
  return parsed.sort((a, b) => a.rank_position - b.rank_position);
}
