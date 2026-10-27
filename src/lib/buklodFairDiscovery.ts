/**
 * Fair Discovery is a bounded presentation pass over an already authorized,
 * server-ranked page. It never fetches records, changes permissions, writes
 * impressions, or affects Following/Latest. Each post appears exactly once.
 *
 * The server remains responsible for eligibility and candidate retrieval.
 */
type CommunityCandidate = {
  id?: string | null;
  user_id?: string | null;
  is_following_author?: boolean | null;
  total_reactions?: number | null;
  comment_count?: number | null;
};

type Lane = 'relevant' | 'following' | 'underexposed' | 'discovery';

// Twenty slots: 8 relevant, 5 following, 4 underexposed, 3 discovery.
const LANES: readonly Lane[] = [
  'relevant', 'following', 'underexposed', 'relevant', 'discovery',
  'following', 'relevant', 'underexposed', 'following', 'relevant',
  'discovery', 'relevant', 'following', 'underexposed', 'relevant',
  'discovery', 'following', 'relevant', 'underexposed', 'relevant',
];

function underexposed(post: CommunityCandidate): boolean {
  return Math.max(0, Number(post.total_reactions) || 0) +
    Math.max(0, Number(post.comment_count) || 0) <= 2;
}

function matchesLane(post: CommunityCandidate, lane: Lane): boolean {
  switch (lane) {
    case 'following': return post.is_following_author === true;
    case 'underexposed': return underexposed(post);
    case 'discovery': return post.is_following_author !== true;
    default: return true;
  }
}

export function arrangeCommunityForFairDiscovery<T extends CommunityCandidate>(
  posts: readonly T[],
): T[] {
  if (posts.length < 2) return [...posts];

  const remaining = [...posts];
  const result: T[] = [];

  for (let slot = 0; remaining.length > 0; slot += 1) {
    const lane = LANES[slot % LANES.length];
    const recentAuthors = new Set(
      result.slice(-3).map(post => post.user_id).filter(Boolean),
    );

    // Respect the lane when possible, but never strand eligible posts if a
    // page contains no followed author or no underexposed content.
    let pick = remaining.findIndex(post =>
      matchesLane(post, lane) &&
      (!post.user_id || !recentAuthors.has(post.user_id)),
    );
    if (pick < 0) {
      pick = remaining.findIndex(post =>
        !post.user_id || !recentAuthors.has(post.user_id),
      );
    }
    if (pick < 0) pick = 0;

    result.push(remaining.splice(pick, 1)[0]);
  }

  return result;
}
