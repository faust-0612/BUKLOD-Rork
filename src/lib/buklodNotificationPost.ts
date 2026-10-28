import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { loadCommunityPostMediaByPostIds } from '@/lib/buklodCommunityPostMedia';
import { resolveCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import { hydratePersonNamesOnRows } from '@/lib/buklodPersonDisplay';
import { getClusterLabels } from '@/lib/clusterLabels';
import { fetchBuklodPostCommentPreviews } from '@/lib/buklodPostCommentPreviews';

/**
 * A notification may point to a post beyond the feed's first page. Fetch that
 * one record through the same access-controlled RPC as the old post screen,
 * then shape it for the existing Wall card and comment sheet.
 * No direct table read or cross-scope fallback is used.
 */
export async function loadBuklodNotificationPost(
  postId: string,
  userId?: string | null,
): Promise<any | null> {
  const id = String(postId ?? '').trim();
  if (!id) return null;

  const { data, error } = await withBuklodTimeout<any>(
    (supabase as any).rpc('get_buklod_post_detail_v3', { p_post_id: id }),
    9000,
    'Notification post',
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || String(row.id) !== id) return null;

  const [mediaMap, personRows, reactionResult, ranksResult, clusterMap, previewMap] =
    await Promise.all([
      withBuklodTimeout(loadCommunityPostMediaByPostIds([id]), 5000, 'Post photos')
        .catch(() => ({} as Record<string, any[]>)),
      withBuklodTimeout(
        hydratePersonNamesOnRows([row], 'user_id', 'author_name'),
        4000,
        'Post author',
      ).catch(() => [row]),
      userId
        ? withBuklodTimeout<any>(
            supabase.from('reactions').select('reaction')
              .eq('post_id', id).eq('user_id', userId).maybeSingle(),
            4000,
            'Post reaction',
          ).catch(() => ({ data: null }))
        : Promise.resolve({ data: null }),
      withBuklodTimeout<any>(
        (supabase as any).rpc('get_member_circle_ranks_v1', {
          p_user_ids: [row.user_id],
        }),
        4000,
        'Post rank',
      ).catch(() => ({ data: [] })),
      withBuklodTimeout(getClusterLabels([row.user_id]), 4000, 'Post cluster')
        .catch(() => ({} as Record<string, string>)),
      withBuklodTimeout(fetchBuklodPostCommentPreviews([id]), 4000, 'Post comments')
        .catch(() => ({} as Record<string, any>)),
    ]);

  const mediaRows = mediaMap[id] ?? [];
  const rawItems = mediaRows.length
    ? mediaRows
    : (row.media_path || row.media_url)
      ? [{
          post_id: id,
          media_position: 0,
          media_path: row.media_path,
          media_url: row.media_url,
          media_mime_type: row.media_mime_type,
          media_size_bytes: row.media_size_bytes,
        }]
      : [];
  const mediaItems = await Promise.all(rawItems.map(async (item: any) => ({
    ...item,
    media_url: await withBuklodTimeout(
      resolveCommunityMediaUrl(item.media_path, item.media_url),
      4500,
      'Post media URL',
    ).catch(() => item.media_url ?? null),
  })));
  mediaItems.sort((a: any, b: any) =>
    Number(a.media_position ?? 0) - Number(b.media_position ?? 0));

  const authorRank = Array.isArray(ranksResult?.data)
    ? ranksResult.data.find((item: any) => item.user_id === row.user_id)?.rank_name
    : null;

  return {
    ...row,
    author_name: personRows[0]?.author_name ?? row.author_name,
    media_items: mediaItems,
    media_url: mediaItems.find((item: any) => item.media_url)?.media_url ?? row.media_url,
    my_reaction: reactionResult?.data?.reaction ?? row.my_reaction ?? null,
    author_rank_name: authorRank ?? row.author_rank_name ?? 'Circle Starter V',
    cluster_name: clusterMap[row.user_id] ?? row.cluster_name ?? null,
    comment_preview: previewMap[id] ?? row.comment_preview ?? null,
  };
}
