/* BUKLOD_COMMUNITY_EXTERNAL_MEDIA_AWS_R1 */
import { supabase } from '@/lib/supabase';

import {
  COMMUNITY_MAX_PHOTOS,
  COMMUNITY_MEDIA_POSITION_MIN,
} from '@/lib/buklodCommunityMediaLimits';
import {
  clearPendingAwsWallVideo,
  deleteAwsWallVideo,
  getAwsWallVideoViewUrl,
  peekPendingAwsWallVideo,
} from '@/lib/buklodAwsWallVideo';

export type CommunityPostMediaItem = {
  media_path: string;
  media_mime_type: string;
  media_size_bytes: number;
  storage_provider?: 'SUPABASE' | 'AWS';
  external_object_key?: string | null;
};

export type CommunityPostMediaRow = CommunityPostMediaItem & {
  post_id: string;
  media_position: number;
  media_url?: string | null;
};

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache|pgrst202/i.test(
    message,
  );
}

function materializePendingExternalMedia(
  item: CommunityPostMediaItem,
): CommunityPostMediaItem {
  const pending = peekPendingAwsWallVideo(item.media_path);
  if (!pending) {
    return {
      ...item,
      storage_provider: item.storage_provider ?? 'SUPABASE',
      external_object_key: item.external_object_key ?? null,
    };
  }

  return {
    ...item,
    media_path: pending.media_path,
    storage_provider: 'AWS',
    external_object_key: pending.external_object_key,
  };
}

export function buildCommunityPostMediaRows(
  postId: string,
  media: CommunityPostMediaItem[],
  startPosition = COMMUNITY_MEDIA_POSITION_MIN,
) {
  return media.slice(0, COMMUNITY_MAX_PHOTOS).map((item, index) => ({
    post_id: postId,
    media_position: startPosition + index,
    media_path: item.media_path,
    media_mime_type: item.media_mime_type,
    media_size_bytes: item.media_size_bytes,
    storage_provider: item.storage_provider ?? 'SUPABASE',
    external_object_key: item.external_object_key ?? null,
  }));
}

async function insertCommunityPostMediaRows(
  postId: string,
  media: CommunityPostMediaItem[],
) {
  if (!media.length) return;

  const rows = buildCommunityPostMediaRows(postId, media);
  const { error } = await supabase
    .from('community_post_media')
    .insert(rows);

  if (error) throw error;
}

async function invokeSetMedia(
  name: string,
  postId: string,
  media: CommunityPostMediaItem[],
) {
  return (supabase as any).rpc(name, {
    p_post_id: postId,
    p_media: media,
  });
}

/**
 * Replace every media row for a post in one request.
 * Large videos are transparently materialized as AWS media by reading the
 * pending upload mapping created by uploadCommunityVideoFile(). Existing call
 * sites therefore do not need native or screen-level changes.
 */
export async function attachCommunityPostMedia(
  postId: string,
  media: CommunityPostMediaItem[],
) {
  const id = String(postId ?? '').trim();
  const originalItems = media
    .filter(item => String(item.media_path ?? '').trim())
    .slice(0, COMMUNITY_MAX_PHOTOS);
  const items = originalItems.map(materializePendingExternalMedia);

  if (!id || !items.length) return;

  const hasExternal = items.some(
    item => item.storage_provider === 'AWS',
  );

  const rpcNames = [
    'set_buklod_post_media_v5',
    'set_buklod_post_media_v4',
    'set_buklod_post_media_v3',
    'set_buklod_post_media_v2',
    'set_buklod_post_media_v1',
  ];

  let lastError: { message?: string } | null = null;

  for (const name of rpcNames) {
    if (hasExternal && name !== 'set_buklod_post_media_v5') {
      break;
    }

    const { error } = await invokeSetMedia(name, id, items);

    if (!error) {
      for (const original of originalItems) {
        clearPendingAwsWallVideo(original.media_path);
      }
      return;
    }

    lastError = error;
    const message = String(error?.message ?? '');

    if (!isMissingRpcError(message)) {
      throw error;
    }
  }

  if (hasExternal) {
    throw lastError ?? new Error('External Wall video media RPC is unavailable.');
  }

  try {
    await supabase.from('community_post_media').delete().eq('post_id', id);
    await insertCommunityPostMediaRows(id, items);
  } catch (insertError) {
    throw lastError ?? insertError;
  }

  const first = items[0];

  await supabase
    .from('community_posts')
    .update({
      media_path: first.media_path,
      media_mime_type: first.media_mime_type,
      media_size_bytes: first.media_size_bytes,
    })
    .eq('id', id);
}

async function loadMediaRpc(ids: string[]) {
  const v2 = await (supabase as any).rpc('get_buklod_post_media_v2', {
    p_post_ids: ids,
  });

  if (v2?.error) {
    throw v2.error;
  }

  return v2.data ?? [];
}

export async function loadCommunityPostMediaByPostIds(
  postIds: string[],
) {
  const ids = [
    ...new Set(
      postIds
        .map(id => String(id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  const mediaMap: Record<string, CommunityPostMediaRow[]> = {};

  if (!ids.length) return mediaMap;

  const rows: any[] = await loadMediaRpc(ids);

  await Promise.all(
    rows.map(async row => {
      const postId = String(row?.post_id ?? '').trim();
      if (!postId) return;

      const provider = String(
        row?.storage_provider ?? 'SUPABASE',
      ).toUpperCase();
      const externalKey = String(
        row?.external_object_key ?? '',
      ).trim();

      let mediaUrl = row?.media_url ?? null;
      if (provider === 'AWS' && externalKey) {
        mediaUrl = await getAwsWallVideoViewUrl(
          postId,
          externalKey,
        ).catch(() => null);
      }

      const normalized: CommunityPostMediaRow = {
        ...row,
        post_id: postId,
        storage_provider:
          provider === 'AWS' ? 'AWS' : 'SUPABASE',
        external_object_key: externalKey || null,
        media_url: mediaUrl,
      };

      if (!mediaMap[postId]) mediaMap[postId] = [];
      mediaMap[postId].push(normalized);
    }),
  );

  for (const postId of Object.keys(mediaMap)) {
    mediaMap[postId].sort(
      (a, b) =>
        Number(a.media_position ?? 0) -
        Number(b.media_position ?? 0),
    );
  }

  return mediaMap;
}

export async function discardIncompleteCommunityPost(options: {
  postId?: string | null;
  mediaPaths?: string[];
  scopeId?: string | null;
}) {
  const postId = String(options.postId ?? '').trim();
  const scopeId = String(options.scopeId ?? '').trim();
  const mediaPaths = (options.mediaPaths ?? [])
    .map(path => String(path ?? '').trim())
    .filter(Boolean);

  if (postId) {
    try {
      if (scopeId) {
        const scoped = await (supabase as any).rpc(
          'buklod_scope_social_delete_post_v1',
          {
            p_scope_id: scopeId,
            p_post_id: postId,
          },
        );

        if (scoped?.error) {
          await (supabase as any).rpc(
            'delete_buklod_community_post_v1',
            { p_post_id: postId },
          );
        }
      } else {
        const { error } = await (supabase as any).rpc(
          'delete_buklod_community_post_v1',
          { p_post_id: postId },
        );

        if (error) {
          await supabase
            .from('community_posts')
            .update({ is_hidden: true })
            .eq('id', postId);
        }
      }
    } catch {
      // Best-effort rollback. Caller surfaces the original error.
    }
  }

  const supabasePaths: string[] = [];

  for (const path of mediaPaths) {
    const pending = peekPendingAwsWallVideo(path);
    if (pending?.external_object_key) {
      await deleteAwsWallVideo(
        pending.external_object_key,
      ).catch(() => undefined);
      clearPendingAwsWallVideo(path);
    } else {
      supabasePaths.push(path);
    }
  }

  if (supabasePaths.length) {
    try {
      await supabase.storage
        .from('community-media')
        .remove(supabasePaths);
    } catch {
      // Storage cleanup is best-effort.
    }
  }
}

export function extractCreatedRecordId(data: unknown): string | null {
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (typeof data === 'string') {
    const value = data.trim();
    return uuid.test(value) ? value : null;
  }

  if (Array.isArray(data)) {
    return extractCreatedRecordId(data[0]);
  }

  if (data && typeof data === 'object') {
    const row = data as Record<string, unknown>;
    return extractCreatedRecordId(
      row.id ??
        row.post_id ??
        row.event_id ??
        row.create_buklod_community_post_v3 ??
        row.create_buklod_community_post_v4 ??
        row.buklod_scope_social_create_post_v1 ??
        null,
    );
  }

  return null;
}
