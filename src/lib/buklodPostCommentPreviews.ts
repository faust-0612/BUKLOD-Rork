import { supabase } from '@/lib/supabase';
import {
  loadPersonDisplayNames,
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';

export type BuklodPostCommentPreview = {
  post_id: string;
  comment_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

function isMissingRpcError(
  message: string
) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

async function fetchCommentPreviewsDirect(
  postIds: string[]
): Promise<Record<string, BuklodPostCommentPreview>> {
  const result = await supabase
    .from('comments')
    .select(
      'id, post_id, user_id, body, created_at'
    )
    .in('post_id', postIds)
    .eq('is_hidden', false)
    .order('created_at', {
      ascending: false,
    });

  if (result.error) {
    throw new Error(result.error.message);
  }

  const latestByPost = new Map<
    string,
    any
  >();

  for (const row of result.data ?? []) {
    const postId = String(row.post_id ?? '');

    if (!postId || latestByPost.has(postId)) {
      continue;
    }

    latestByPost.set(postId, row);
  }

  const rows = [...latestByPost.values()];
  const names = await loadPersonDisplayNames(
    rows.map(row => row.user_id)
  );

  const map: Record<string, BuklodPostCommentPreview> =
    {};

  for (const row of rows) {
    const postId = String(row.post_id ?? '');
    const userId = String(row.user_id ?? '');

    map[postId] = {
      post_id: postId,
      comment_id: String(row.id),
      user_id: userId,
      author_name: resolvePersonDisplayName(
        names[userId],
        userId,
      ),
      body: String(row.body ?? ''),
      created_at: String(row.created_at),
    };
  }

  return map;
}

export async function fetchBuklodPostCommentPreviews(
  postIds: string[]
): Promise<Record<string, BuklodPostCommentPreview>> {
  const ids = postIds.filter(Boolean);

  if (!ids.length) {
    return {};
  }

  const { data, error } = await (supabase as any).rpc(
    'get_buklod_post_comment_previews_v1',
    {
      p_post_ids: ids,
    }
  );

  if (!error) {
    const map: Record<string, BuklodPostCommentPreview> =
      {};
    const rows = (data ?? []) as BuklodPostCommentPreview[];
    const names = await loadPersonDisplayNames(
      rows.map((row) => row.user_id),
    );

    for (const row of rows) {
      if (!row?.post_id) {
        continue;
      }

      map[row.post_id] = {
        ...row,
        author_name: resolvePersonDisplayName(
          row.author_name ?? names[row.user_id],
          row.user_id,
        ),
      };
    }

    return map;
  }

  const message = String(error?.message ?? '');

  console.warn(
    'BUKLOD comment previews:',
    message
  );

  if (isMissingRpcError(message)) {
    try {
      return await fetchCommentPreviewsDirect(ids);
    } catch (fallbackError: any) {
      console.warn(
        'BUKLOD comment preview fallback:',
        fallbackError?.message ??
          fallbackError
      );
      return {};
    }
  }

  return {};
}

export function toCommunityCommentPreview(
  preview?: BuklodPostCommentPreview | null
) {
  if (!preview) {
    return null;
  }

  return {
    comment_id: preview.comment_id,
    user_id: preview.user_id,
    author_name: resolvePersonDisplayName(
      preview.author_name,
      preview.user_id,
    ),
    body: preview.body,
    created_at: preview.created_at,
  };
}
