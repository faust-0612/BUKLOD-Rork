/** Canonical Community Wall reaction keys — shared by posts, photos, and comments. */

import {
  supabase,
} from '@/lib/supabase';
import {
  loadPersonDisplayNames,
  resolvePersonDisplayName,
  needsPersonNameHydration,
} from '@/lib/buklodPersonDisplay';

export const BUKLOD_COMMUNITY_REACTION_KEYS = [
  'with_you',
  'love',
  'care',
  'haha',
  'amen',
  'sad',
  'praying',
] as const;

export type BuklodCommunityReactionKey =
  typeof BUKLOD_COMMUNITY_REACTION_KEYS[number];

export type CommunityReactionDetailsTarget = {
  id?: string | null;
  post_id?: string | null;
  comment_id?: string | null;
  media_position?: number | null;
  reaction_counts?: Record<string, number> | null;
  total_reactions?: number | null;
  reaction_count?: number | null;
  known_display_names?: Record<string, string> | null;
};

export function resolveCommunityReactionPostId(
  target: CommunityReactionDetailsTarget | null | undefined,
) {
  if (target?.comment_id) {
    return null;
  }

  const hasMediaPosition =
    target?.media_position !== null &&
    target?.media_position !== undefined;

  const value = String(
    (hasMediaPosition ? target?.post_id : null) ??
      target?.id ??
      target?.post_id ??
      '',
  ).trim();

  return value || null;
}

export function resolveCommunityReactionCommentId(
  target: CommunityReactionDetailsTarget | null | undefined,
) {
  const value = String(
    target?.comment_id ?? ''
  ).trim();

  return value || null;
}

export function resolveCommunityReactionMediaPosition(
  target: CommunityReactionDetailsTarget | null | undefined,
) {
  if (
    target?.media_position === null ||
    target?.media_position === undefined
  ) {
    return null;
  }

  return Number(target.media_position);
}

export function sumCommunityReactionCounts(
  counts?: Record<string, number> | null
) {
  return Object.values(counts ?? {}).reduce(
    (sum, count) => sum + Number(count ?? 0),
    0
  );
}

export type CommunityReactionDetailRow = {
  user_id: string;
  display_name: string;
  reaction: string;
  created_at: string;
};

function isMissingRpcError(
  message: string
) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

function resolveDisplayName(
  userId: string,
  names: Record<string, string>
) {
  return resolvePersonDisplayName(names[userId], userId);
}

async function loadDisplayNames(
  userIds: string[],
  knownDisplayNames?: Record<string, string> | null
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  for (const userId of userIds) {
    const known = resolvePersonDisplayName(
      knownDisplayNames?.[userId],
      userId,
    );

    if (known !== 'Unknown') {
      map[userId] = known;
    }
  }

  const missingIds = Array.from(
    new Set(
      userIds.filter(
        userId =>
          userId && !map[userId]
      )
    )
  );

  if (!missingIds.length) {
    return map;
  }

  const loaded = await loadPersonDisplayNames(missingIds);

  for (const [userId, name] of Object.entries(loaded)) {
    map[userId] = name;
  }

  return map;
}

function mapRowsWithNames(
  rows: Array<{
    user_id: string;
    reaction: string;
    created_at: string;
    display_name?: string | null;
  }>,
  names: Record<string, string>
): CommunityReactionDetailRow[] {
  return rows.map(row => ({
    user_id: row.user_id,
    display_name:
      String(row.display_name ?? '').trim() ||
      resolveDisplayName(
        row.user_id,
        names
      ),
    reaction: String(row.reaction),
    created_at: row.created_at,
  }));
}

async function fetchPostReactionsDirect(options: {
  postId: string;
  reaction?: string | null;
  limit: number;
  offset: number;
  knownDisplayNames?: Record<string, string> | null;
}): Promise<CommunityReactionDetailRow[]> {
  let query = supabase
    .from('reactions')
    .select('user_id, reaction, created_at')
    .eq('post_id', options.postId)
    .order('created_at', {
      ascending: false,
    })
    .range(
      options.offset,
      options.offset + options.limit - 1
    );

  if (options.reaction) {
    query = query.eq(
      'reaction',
      options.reaction
    );
  }

  const result = await query;

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = result.data ?? [];
  const names = await loadDisplayNames(
    rows.map(row => row.user_id),
    options.knownDisplayNames
  );

  return mapRowsWithNames(rows, names);
}

async function fetchPhotoReactionsDirect(options: {
  postId: string;
  mediaPosition: number;
  reaction?: string | null;
  limit: number;
  offset: number;
  knownDisplayNames?: Record<string, string> | null;
}): Promise<CommunityReactionDetailRow[]> {
  let query = supabase
    .from('community_photo_reactions')
    .select('user_id, reaction, created_at')
    .eq('post_id', options.postId)
    .eq(
      'media_position',
      options.mediaPosition
    )
    .order('created_at', {
      ascending: false,
    })
    .range(
      options.offset,
      options.offset + options.limit - 1
    );

  if (options.reaction) {
    query = query.eq(
      'reaction',
      options.reaction
    );
  }

  const result = await query;

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = result.data ?? [];
  const names = await loadDisplayNames(
    rows.map(row => row.user_id),
    options.knownDisplayNames
  );

  return mapRowsWithNames(rows, names);
}

async function fetchCommentReactionsDirect(options: {
  commentId: string;
  reaction?: string | null;
  limit: number;
  offset: number;
  knownDisplayNames?: Record<string, string> | null;
}): Promise<CommunityReactionDetailRow[]> {
  let query = supabase
    .from('comment_reactions')
    .select('user_id, reaction, created_at')
    .eq('comment_id', options.commentId)
    .order('created_at', {
      ascending: false,
    })
    .range(
      options.offset,
      options.offset + options.limit - 1
    );

  if (options.reaction) {
    query = query.eq(
      'reaction',
      options.reaction
    );
  }

  const result = await query;

  if (result.error) {
    throw new Error(result.error.message);
  }

  const rows = result.data ?? [];
  const names = await loadDisplayNames(
    rows.map(row => row.user_id),
    options.knownDisplayNames
  );

  return mapRowsWithNames(rows, names);
}

async function enrichReactionRows(
  rows: CommunityReactionDetailRow[],
  knownDisplayNames?: Record<string, string> | null
): Promise<CommunityReactionDetailRow[]> {
  if (!rows.length) {
    return rows;
  }

  const needsNames = rows.some(
    row => needsPersonNameHydration(row.display_name),
  );

  if (!needsNames && !knownDisplayNames) {
    return rows;
  }

  const names = await loadDisplayNames(
    rows.map(row => row.user_id),
    knownDisplayNames
  );

  return rows.map(row => ({
    ...row,
    display_name: resolvePersonDisplayName(
      row.display_name ?? names[row.user_id],
      row.user_id,
    ),
  }));
}

async function fetchViaRpc(
  rpcName: string,
  params: Record<string, unknown>
): Promise<CommunityReactionDetailRow[]> {
  const result = await (supabase as any).rpc(
    rpcName,
    params
  );

  if (!result.error) {
    return (result.data ?? []) as CommunityReactionDetailRow[];
  }

  throw new Error(
    String(result.error?.message ?? 'Could not load reactions.')
  );
}

export async function fetchCommunityReactionDetails(options: {
  postId?: string | null;
  commentId?: string | null;
  mediaPosition?: number | null;
  reaction?: string | null;
  limit?: number;
  offset?: number;
  knownDisplayNames?: Record<string, string> | null;
}): Promise<CommunityReactionDetailRow[]> {
  const {
    postId = null,
    commentId = null,
    mediaPosition = null,
    reaction = null,
    limit = 40,
    offset = 0,
    knownDisplayNames = null,
  } = options;

  const safeLimit = Math.min(
    Math.max(limit, 1),
    100
  );
  const safeOffset = Math.max(offset, 0);

  if (commentId) {
    try {
      const rows = await fetchViaRpc(
        'get_buklod_comment_reaction_details_v1',
        {
          p_comment_id: commentId,
          p_reaction: reaction,
          p_limit: safeLimit,
          p_offset: safeOffset,
        }
      );

      return enrichReactionRows(
        rows,
        knownDisplayNames
      );
    } catch (error: any) {
      const message = String(
        error?.message ?? ''
      );

      if (isMissingRpcError(message)) {
        return fetchCommentReactionsDirect({
          commentId,
          reaction,
          limit: safeLimit,
          offset: safeOffset,
          knownDisplayNames,
        });
      }

      throw error;
    }
  }

  if (!postId) {
    throw new Error(
      'Reaction details unavailable.'
    );
  }

  const usePhotoRpc =
    mediaPosition !== null &&
    Number.isFinite(mediaPosition);

  const rpcName = usePhotoRpc
    ? 'get_buklod_photo_reactions_v1'
    : 'get_buklod_post_reactions_v1';

  const rpcParams = usePhotoRpc
    ? {
        p_post_id: postId,
        p_media_position: mediaPosition,
        p_reaction: reaction,
        p_limit: safeLimit,
        p_offset: safeOffset,
      }
    : {
        p_post_id: postId,
        p_reaction: reaction,
        p_limit: safeLimit,
        p_offset: safeOffset,
      };

  try {
    const rows = await fetchViaRpc(
      rpcName,
      rpcParams
    );

    return enrichReactionRows(
      rows,
      knownDisplayNames
    );
  } catch (error: any) {
    const message = String(
      error?.message ?? ''
    );

    if (!isMissingRpcError(message)) {
      throw error;
    }

    if (usePhotoRpc) {
      try {
        return await fetchPhotoReactionsDirect({
          postId,
          mediaPosition: Number(mediaPosition),
          reaction,
          limit: safeLimit,
          offset: safeOffset,
          knownDisplayNames,
        });
      } catch {
        return fetchPostReactionsDirect({
          postId,
          reaction,
          limit: safeLimit,
          offset: safeOffset,
          knownDisplayNames,
        });
      }
    }

    return fetchPostReactionsDirect({
      postId,
      reaction,
      limit: safeLimit,
      offset: safeOffset,
      knownDisplayNames,
    });
  }
}
