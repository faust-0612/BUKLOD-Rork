import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import {
  hydratePersonNamesOnRows,
} from '@/lib/buklodPersonDisplay';
import {
  repairMojibakeText,
} from '@/lib/repairMojibakeText';
import { supabase } from '@/lib/supabase';
import { resolveCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import { getAwsWallVideoViewUrl } from '@/lib/buklodAwsWallVideo';
import { attachCommunityPostMedia, discardIncompleteCommunityPost, loadCommunityPostMediaByPostIds } from '@/lib/buklodCommunityPostMedia';
import {
  collectMaritesFeedPages,
  maritesFeedPageArgs,
  maritesFeedPageLimit,
  withMaritesPageDeadline,
} from '@/lib/buklodMaritesFeedPages';

/**
 * Marites Story — compact community stories.
 *
 * Local stories persist per-device via AsyncStorage (offline fallback).
 * Shared Marites stories publish through the public community post RPC
 * with an invisible marker so other accounts can see them on Marites —
 * without mixing in ordinary Community Wall posts.
 */

export const MARITES_MAX_CHARS = 200;
export const MARITES_MAX_PHOTOS = 10;
export const MARITES_STORAGE_KEY =
  'buklod:marites-board:public:v1';

export const MARITES_CARD_WIDTH = 148;
export const MARITES_CARD_HEIGHT = 200;
export const MARITES_CARD_FOOTER_HEIGHT = 36;

export const COMMUNITY_MARITES_ID_PREFIX =
  'community:';

/**
 * Invisible body marker so Marites posts can be filtered out of the
 * general Community Wall feed when loading the Marites Story.
 * (ZWSP + ZWNJ + ZWJ + WJ)
 */
export const MARITES_POST_MARKER =
  '\u200B\u200C\u200D\u2060';

/** Media path segment used when uploading Marites photos. */
export const MARITES_MEDIA_PATH_TOKEN = 'marites-';

export function stripMaritesPostMarker(body: string) {
  return String(body ?? '')
    .split(MARITES_POST_MARKER)
    .join('');
}

export function withMaritesPostMarker(body: string) {
  const cleaned = stripMaritesPostMarker(body).trim();

  if (!cleaned) {
    return MARITES_POST_MARKER;
  }

  if (cleaned.startsWith(MARITES_POST_MARKER)) {
    return cleaned;
  }

  return `${MARITES_POST_MARKER}${cleaned}`;
}

function communityPostHasMaritesMedia(
  post: Record<string, unknown>
) {
  const paths: string[] = [];

  const primary = String(post.media_path ?? '').trim();

  if (primary) {
    paths.push(primary);
  }

  const mediaItems = Array.isArray(post.media_items)
    ? post.media_items
    : [];

  for (const item of mediaItems) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const row = item as Record<string, unknown>;
    const path = String(
      row.media_path ?? row.media_url ?? ''
    ).trim();

    if (path) {
      paths.push(path);
    }
  }

  return paths.some((path) =>
    path.includes(MARITES_MEDIA_PATH_TOKEN)
  );
}

/** True when a community feed row is a Marites story (not a Wall post). */
export function isMaritesCommunityPost(
  post: Record<string, unknown>
) {
  const body = String(post.body ?? '');

  if (body.includes(MARITES_POST_MARKER)) {
    return true;
  }

  return communityPostHasMaritesMedia(post);
}

export type MaritesStorySource =
  | 'local'
  | 'community';

/** True when the story body is emoji/whitespace only (no letters/numbers). */
export function isMaritesEmojiOnlyBody(
  body: string
): boolean {
  const trimmed = body.trim();

  if (!trimmed) {
    return false;
  }

  const withoutEmoji = trimmed.replace(
    /[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F\s]/gu,
    ''
  );

  return withoutEmoji.length === 0;
}

export type MaritesStory = {
  id: string;
  user_id: string;
  author_name: string;
  avatar_url: string | null;
  body: string;
  /** Local device URIs until backend upload exists. */
  photo_uris: string[];
  /** @deprecated Legacy single-photo field — kept for older saves. */
  photo_uri?: string | null;
  mentions: string[];
  /** When true, only the author sees this story on their device feed. */
  author_only?: boolean;
  /** Local device story vs merged community wall post. */
  source?: MaritesStorySource;
  /** Original community post id when source is community. */
  community_post_id?: string | null;
  /** Storage paths aligned with photo_uris for community stories. */
  photo_paths?: string[];
  video_uri?: string | null;
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  created_at: string;
};

export function getMaritesStoryPhotos(
  story: Pick<MaritesStory, 'photo_uris' | 'photo_uri'>
) {
  if (Array.isArray(story.photo_uris)) {
    const cleaned = story.photo_uris
      .map((uri) => String(uri ?? '').trim())
      .filter(Boolean);

    if (cleaned.length) {
      return cleaned;
    }
  }

  const legacy = String(story.photo_uri ?? '').trim();

  return legacy ? [legacy] : [];
}

export function maritesCollageTileLayout(
  count: number,
  index: number,
  width: number,
  height: number,
  gap = 2
) {
  const visibleCount = Math.min(4, count);

  if (visibleCount <= 1) {
    return { width, height };
  }

  if (visibleCount === 2) {
    return {
      width: (width - gap) / 2,
      height,
    };
  }

  if (visibleCount === 3) {
    if (index === 0) {
      return {
        width,
        height: Math.round((height - gap) * 0.58),
      };
    }

    return {
      width: (width - gap) / 2,
      height: Math.round((height - gap) * 0.42),
    };
  }

  return {
    width: (width - gap) / 2,
    height: (height - gap) / 2,
  };
}

function normalizeStory(row: Record<string, unknown>): MaritesStory | null {
  if (
    !row?.id ||
    typeof row.body !== 'string' ||
    typeof row.user_id !== 'string'
  ) {
    return null;
  }

  const photoUris = Array.isArray(row.photo_uris)
    ? row.photo_uris
        .map((uri) => String(uri ?? '').trim())
        .filter(Boolean)
    : [];
  const legacyPhoto = row.photo_uri
    ? String(row.photo_uri).trim()
    : '';

  const mergedPhotos =
    photoUris.length > 0
      ? photoUris
      : legacyPhoto
        ? [legacyPhoto]
        : [];

  return {
    id: String(row.id),
    user_id: String(row.user_id),
    author_name: String(row.author_name ?? 'Member'),
    avatar_url: row.avatar_url
      ? String(row.avatar_url)
      : null,
    body: String(row.body ?? ''),
    photo_uris: mergedPhotos.slice(0, MARITES_MAX_PHOTOS),
    photo_uri: mergedPhotos[0] ?? null,
    video_uri: row.video_uri ? String(row.video_uri) : null,
    mentions: Array.isArray(row.mentions)
      ? row.mentions.map((item) => String(item))
      : [],
    author_only: Boolean(row.author_only),
    source:
      row.source === 'community'
        ? 'community'
        : 'local',
    community_post_id: row.community_post_id
      ? String(row.community_post_id)
      : null,
    reaction_counts:
      row.reaction_counts &&
      typeof row.reaction_counts === 'object' &&
      !Array.isArray(row.reaction_counts)
        ? Object.fromEntries(
            Object.entries(
              row.reaction_counts as Record<string, unknown>
            ).map(([key, value]) => [
              key,
              Math.max(0, Number(value ?? 0)),
            ])
          )
        : {},
    my_reaction: row.my_reaction
      ? String(row.my_reaction)
      : null,
    created_at: String(
      row.created_at ?? new Date().toISOString()
    ),
  };
}

function parseStories(raw: string | null): MaritesStory[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((row) =>
        row && typeof row === 'object'
          ? normalizeStory(row as Record<string, unknown>)
          : null
      )
      .filter(Boolean) as MaritesStory[];
  } catch {
    return [];
  }
}

export const MARITES_VALIDITY_MS = 72 * 60 * 60 * 1000;

/** Reject expired, invalid and future-dated stories consistently across caches and feeds. */
export function isActiveMaritesStory(story: Pick<MaritesStory, 'created_at'>, now = Date.now()): boolean {
  const created = Date.parse(story.created_at);
  return Number.isFinite(created) && created <= now && now - created < MARITES_VALIDITY_MS;
}

const MARITES_OFFLINE_VIDEO_DIR = 'buklod-marites-offline/';

async function persistLocalMaritesVideo(
  story: MaritesStory,
  mimeType?: string,
): Promise<MaritesStory> {
  if (!story.video_uri) return story;
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    throw new Error('Video could not be shared. Reconnect and try again.');
  }

  const directory = `${FileSystem.documentDirectory}${MARITES_OFFLINE_VIDEO_DIR}`;
  const extension = /quicktime/i.test(mimeType ?? '') ? 'mov'
    : /webm/i.test(mimeType ?? '') ? 'webm' : 'mp4';
  const target = `${directory}${story.id}.${extension}`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  await FileSystem.copyAsync({ from: story.video_uri, to: target });
  const info = await FileSystem.getInfoAsync(target);
  if (!info.exists || (typeof info.size === 'number' && info.size <= 0)) {
    await FileSystem.deleteAsync(target, { idempotent: true }).catch(() => undefined);
    throw new Error('Could not save the offline video. Please select it again.');
  }
  return { ...story, video_uri: target };
}

async function discardSavedMaritesVideo(story: MaritesStory): Promise<void> {
  const directory = FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${MARITES_OFFLINE_VIDEO_DIR}` : '';
  const uri = String(story.video_uri ?? '');
  if (!directory || !uri.startsWith(directory)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

async function appendOfflineMaritesStory(
  story: MaritesStory,
  mimeType?: string,
): Promise<MaritesStory> {
  const safeStory = await persistLocalMaritesVideo(story, mimeType);
  try {
    await appendMaritesStory(safeStory);
    return safeStory;
  } catch (error) {
    await discardSavedMaritesVideo(safeStory);
    throw error;
  }
}

export async function loadMaritesStories(): Promise<MaritesStory[]> {
  const raw = await AsyncStorage.getItem(MARITES_STORAGE_KEY);
  const rows = parseStories(raw);

  // Story URLs from ImagePicker's temporary cache may disappear after restart.
  // Remove only our own expired offline video copies; never touch other files.
  void Promise.all(
    rows.filter((story) => !isActiveMaritesStory(story))
      .map(discardSavedMaritesVideo),
  ).catch(() => undefined);

  return rows
    .filter((story) => isActiveMaritesStory(story))
    .map((story) => ({
      ...story,
      source: story.source ?? 'local',
    }))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
    );
}

export function isCommunityMaritesStory(
  story: Pick<
    MaritesStory,
    'id' | 'source' | 'community_post_id'
  >
) {
  if (story.source === 'community') {
    return true;
  }

  return String(story.id ?? '').startsWith(
    COMMUNITY_MARITES_ID_PREFIX
  );
}

export function parseCommunityMaritesPostId(
  storyId: string
) {
  const value = String(storyId ?? '').trim();

  if (!value.startsWith(COMMUNITY_MARITES_ID_PREFIX)) {
    return null;
  }

  const postId = value.slice(
    COMMUNITY_MARITES_ID_PREFIX.length
  );

  return postId || null;
}

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

async function signCommunityMediaPath(
  mediaPath: string
) {
  const path = String(mediaPath ?? '').trim();

  if (!path) {
    return null;
  }

  const { data } = await supabase.storage
    .from('community-media')
    .createSignedUrl(path, 3600);

  return data?.signedUrl ?? null;
}

function communityPostPhotoUris(post: Record<string, unknown>) {
  const mediaItems = Array.isArray(post.media_items)
    ? post.media_items
    : [];

  const fromItems = mediaItems
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }

      const row = item as Record<string, unknown>;
      const mime = String(
        row.media_mime_type ?? ''
      ).toLowerCase();

      if (mime.startsWith('video/')) {
        return '';
      }

      return String(
        row.media_url ?? row.media_path ?? ''
      ).trim();
    })
    .filter(Boolean);

  if (fromItems.length) {
    return fromItems.slice(0, MARITES_MAX_PHOTOS);
  }

  const mime = String(
    post.media_mime_type ?? ''
  ).toLowerCase();

  if (mime.startsWith('video/')) {
    return [];
  }

  const single = String(
    post.media_url ?? post.media_path ?? ''
  ).trim();

  return single ? [single] : [];
}

function communityPostPhotoPaths(post: Record<string, unknown>) {
  const mediaItems = Array.isArray(post.media_items)
    ? post.media_items
    : [];

  const fromItems = mediaItems
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return '';
      }

      const row = item as Record<string, unknown>;
      const mime = String(
        row.media_mime_type ?? ''
      ).toLowerCase();

      if (mime.startsWith('video/')) {
        return '';
      }

      return String(row.media_path ?? '').trim();
    })
    .filter(Boolean);

  if (fromItems.length) {
    return fromItems.slice(0, MARITES_MAX_PHOTOS);
  }

  const mime = String(
    post.media_mime_type ?? ''
  ).toLowerCase();

  if (mime.startsWith('video/')) {
    return [];
  }

  const path = String(post.media_path ?? '').trim();
  return path ? [path] : [];
}

function mapCommunityPostToMaritesStory(
  post: Record<string, unknown>
): MaritesStory | null {
  const postId = String(post.id ?? '').trim();

  if (!postId) {
    return null;
  }

  const userId = String(post.user_id ?? '').trim();

  if (!userId) {
    return null;
  }

  const photoUris = communityPostPhotoUris(post);
  const videoItem = (Array.isArray(post.media_items) ? post.media_items : []).find((item: any) => String(item?.media_mime_type ?? '').toLowerCase().startsWith('video/'));
  const videoUri = String(videoItem?.media_url || (String(post.media_mime_type ?? '').toLowerCase().startsWith('video/') ? post.media_url : '') || '').trim();
  const body = stripMaritesPostMarker(
    repairMojibakeText(String(post.body ?? ''))
  ).trim();

  if (!body && !photoUris.length && !videoUri) {
    return null;
  }

  return {
    id: `${COMMUNITY_MARITES_ID_PREFIX}${postId}`,
    user_id: userId,
    author_name: String(
      post.author_name ?? 'Member'
    ),
    avatar_url: post.avatar_url
      ? String(post.avatar_url)
      : null,
    body,
    photo_uris: photoUris,
    photo_uri: photoUris[0] ?? null,
    photo_paths: communityPostPhotoPaths(post),
    video_uri: videoUri || null,
    mentions: Array.isArray(post.mentions)
      ? post.mentions.map((item) => String(item))
      : [],
    author_only: Boolean(post.author_only),
    source: 'community',
    community_post_id: postId,
    reaction_counts:
      post.reaction_counts &&
      typeof post.reaction_counts === 'object' &&
      !Array.isArray(post.reaction_counts)
        ? Object.fromEntries(
            Object.entries(
              post.reaction_counts as Record<
                string,
                unknown
              >
            ).map(([key, value]) => [
              key,
              Math.max(0, Number(value ?? 0)),
            ])
          )
        : {},
    my_reaction: post.my_reaction
      ? String(post.my_reaction)
      : null,
    created_at: String(
      post.created_at ?? new Date().toISOString()
    ),
  };
}

export type MaritesCommunityLoad = {
  stories: MaritesStory[];
  refreshFailed: boolean;
};

export async function loadCommunityMaritesStories(
  locationScopeId?: string | null,
  viewerUserId?: string | null,
  pageSize = 100
): Promise<MaritesCommunityLoad> {
  const scopeId = String(
    locationScopeId ?? ''
  ).trim();

  /*
   * PATCH_MARITES_STORY_COMPLETE_FEED
   *
   * Walk every authorized page. A 40-row response is one page,
   * not the end of the story strip. Latest order follows the
   * same feed contract as the Latest tab. A failed or timed-out
   * page keeps the pages already received.
   */
  const requestPageSize = maritesFeedPageLimit(pageSize);

  const collected = await collectMaritesFeedPages({
    pageSize: requestPageSize,
    fetchPage: async (offset, limit) => {
      const pending = Promise.resolve(
        (supabase as any).rpc(
          'get_buklod_public_community_feed_v7_page',
          maritesFeedPageArgs(scopeId, offset, limit),
        ),
      )
        .then(
          ({
            data,
            error,
          }: {
            data: unknown;
            error: { message?: string } | null;
          }) => {
            if (error) {
              const message = String(error.message ?? '');

              if (!isMissingRpcError(message)) {
                console.warn(
                  'Marites Story community feed:',
                  message,
                );
              }

              return {
                rows: [] as Record<string, unknown>[],
                error: message || 'Marites feed request failed.',
              };
            }

            return {
              rows: Array.isArray(data)
                ? (data as Record<string, unknown>[])
                : [],
              error: null,
            };
          },
        )
        .catch((error: unknown) => ({
          rows: [] as Record<string, unknown>[],
          error: String(
            (error as Error)?.message ?? error,
          ),
        }));

      try {
        return await withMaritesPageDeadline(pending);
      } catch (error) {
        const message = String(
          (error as Error)?.message ?? error,
        );
        console.warn(
          'Marites Story community feed:',
          message,
        );
        return {
          rows: [] as Record<string, unknown>[],
          error: message,
        };
      }
    },
  });

  let refreshFailed =
    !collected.complete || Boolean(collected.error);

  const allFeedRows = collected.rows;

  /*
   * Offset pagination can theoretically see the same row
   * twice if the live feed changes during loading.
   * Deduplicate by canonical Community post id.
   */
  const seenPostIds =
    new Set<string>();

  let feedRows =
    allFeedRows.filter(
      (row) => {
        const id =
          String(
            row.id ?? ''
          ).trim();

        if (
          !id ||
          seenPostIds.has(id)
        ) {
          return false;
        }

        seenPostIds.add(id);
        return true;
      }
    );

  feedRows =
    await hydratePersonNamesOnRows(
      feedRows,
      'user_id',
      'author_name'
    );

  /*
   * Marites Story must remain isolated from ordinary
   * Community Wall posts.
   */
  feedRows =
    feedRows.filter(
      (row) =>
        isMaritesCommunityPost(
          row
        )
    );

  const viewerId =
    String(
      viewerUserId ?? ''
    ).trim();

  const postIds =
    feedRows
      .map(
        (row) =>
          String(
            row.id ?? ''
          ).trim()
      )
      .filter(Boolean);

  const myReactionByPost:
    Record<
      string,
      string
    > = {};

  /*
   * Avoid an oversized PostgREST IN request when
   * Marites Story becomes large.
   */
  const QUERY_CHUNK_SIZE =
    100;

  if (
    viewerId &&
    postIds.length
  ) {
    for (
      let index = 0;
      index < postIds.length;
      index += QUERY_CHUNK_SIZE
    ) {
      const chunk =
        postIds.slice(
          index,
          index +
            QUERY_CHUNK_SIZE
        );

      const {
        data:
          myReactionRows,
        error:
          myReactionError,
      } =
        await supabase
          .from('reactions')
          .select(
            'post_id,reaction'
          )
          .eq(
            'user_id',
            viewerId
          )
          .in(
            'post_id',
            chunk
          );

      if (
        !myReactionError
      ) {
        for (
          const row
          of myReactionRows ?? []
        ) {
          myReactionByPost[
            String(
              row.post_id
            )
          ] =
            String(
              row.reaction
            );
        }
      }
    }
  }

  const mediaMap:
    Record<
      string,
      Record<
        string,
        unknown
      >[]
    > = {};

  /*
   * Media lookup is also chunked so the board can
   * scale beyond a few dozen stories.
   */
  if (postIds.length) {
    for (
      let index = 0;
      index < postIds.length;
      index += QUERY_CHUNK_SIZE
    ) {
      const chunk =
        postIds.slice(
          index,
          index +
            QUERY_CHUNK_SIZE
        );

      try {
        const loaded = await loadCommunityPostMediaByPostIds(chunk);
        for (const [postId, rows] of Object.entries(loaded)) {
          mediaMap[postId] = await Promise.all(rows.map(async row => ({
            ...row,
            // The shared loader has already resolved videos by provider.
            // Never re-sign an AWS S3 path as a Supabase Storage object:
            // that replaces a playable S3 URL with a black-screen URL.
            media_url: String(row.media_mime_type ?? '').toLowerCase().startsWith('video/')
              ? (row.media_url || null)
              : (row.media_url || (row.media_path
                ? await signCommunityMediaPath(String(row.media_path)) : null)),
          })));
        }
      } catch {
        refreshFailed = true;
      }
    }
  }

  const hydrated =
    await Promise.all(
      feedRows.map(
        async (row) => {
          const postId =
            String(
              row.id ?? ''
            ).trim();

          const loaded =
            mediaMap[
              postId
            ] ?? [];

          if (loaded.length) {
            // Media rows were already signed during the paged media lookup.
            // Preserve those URLs rather than signing every row a second time.
            row.media_items = loaded.sort((a, b) =>
              Number(a.media_position ?? 0) - Number(b.media_position ?? 0)
            );
          }
          else if (
            row.media_path
          ) {
            const mime =
              String(
                row.media_mime_type ??
                  ''
              ).toLowerCase();

            if (mime.startsWith('video/')) {
              const path = String(row.media_path);
              const mediaUrl = path.startsWith('aws:')
                ? await getAwsWallVideoViewUrl(postId, path.slice(4)).catch(() => null)
                : await resolveCommunityMediaUrl(path, String(row.media_url ?? ''));
              if (mediaUrl) row.media_url = mediaUrl;
            } else if (mime.startsWith('image/')) {
              const mediaUrl = await signCommunityMediaPath(String(row.media_path));
              if (mediaUrl) row.media_url = mediaUrl;
            }
          }

          row.my_reaction =
            myReactionByPost[
              postId
            ] ?? null;

          return row;
        }
      )
    );

  return {
    stories: hydrated
      .filter(
        (row) =>
          isMaritesCommunityPost(
            row
          )
      )
      .map(
        (row) =>
          mapCommunityPostToMaritesStory(
            row
          )
      )
      .filter(
        (story): story is MaritesStory =>
          Boolean(story) && isActiveMaritesStory(story as MaritesStory)
      ),
    refreshFailed,
  };
}

export function mergeMaritesStories(
  localStories: MaritesStory[],
  communityStories: MaritesStory[]
) {
  /*
   * PATCH_MARITES_STORY_CANONICAL_DEDUPE
   *
   * Shared Community post id is the strongest identity.
   * Fall back to local story id for offline-only stories.
   */
  const canonicalKey =
    (
      story:
        MaritesStory
    ) => {
      const postId =
        String(
          story.community_post_id ??
            ''
        ).trim();

      return postId
        ? `community:${postId}`
        : `local:${story.id}`;
    };

  localStories = localStories.filter((story) => isActiveMaritesStory(story));
  communityStories = communityStories.filter((story) => isActiveMaritesStory(story));

  const communityKeys =
    new Set(
      communityStories.map(
        canonicalKey
      )
    );

  const localOnly =
    localStories.filter(
      (story) =>
        !communityKeys.has(
          canonicalKey(
            story
          )
        )
    );

  const unique =
    new Map<
      string,
      MaritesStory
    >();

  for (
    const story
    of [
      ...localOnly,
      ...communityStories,
    ]
  ) {
    unique.set(
      canonicalKey(
        story
      ),
      story
    );
  }

  return [
    ...unique.values(),
  ].sort(
    (a,b) =>
      new Date(
        b.created_at
      ).getTime() -
      new Date(
        a.created_at
      ).getTime()
  );
}

export type MaritesLoadResult = {
  stories: MaritesStory[];
  refreshFailed: boolean;
};

export async function loadAllMaritesStories(
  locationScopeId?: string | null,
  viewerUserId?: string | null
): Promise<MaritesLoadResult> {
  const [localStories, community] =
    await Promise.all([
      loadMaritesStories(),
      loadCommunityMaritesStories(
        locationScopeId,
        viewerUserId,
        100
      ),
    ]);

  const filteredLocal = filterMaritesStoriesForViewer(
    localStories,
    viewerUserId
  );

  return {
    stories: mergeMaritesStories(
      filteredLocal,
      community.stories
    ),
    refreshFailed: community.refreshFailed,
  };
}

export async function saveMaritesStories(
  stories: MaritesStory[]
): Promise<void> {
  await AsyncStorage.setItem(
    MARITES_STORAGE_KEY,
    JSON.stringify(stories)
  );
}

export async function appendMaritesStory(
  story: MaritesStory
): Promise<MaritesStory[]> {
  const existing =
    await loadMaritesStories();

  /*
   * PATCH_MARITES_STORY_NO_LOCAL_40_CAP
   */
  const next = [
    story,
    ...existing.filter(
      (item) =>
        item.id !==
        story.id
    ),
  ].sort(
    (a,b) =>
      new Date(
        b.created_at
      ).getTime() -
      new Date(
        a.created_at
      ).getTime()
  );

  await saveMaritesStories(
    next
  );

  return next;
}

/**
 * Publish a Marites story to the shared community wall so other
 * accounts can see it. Falls back to device-local storage if the
 * community RPC is not deployed yet.
 */
export async function publishMaritesStory(input: {
  userId: string;
  authorName: string;
  avatarUrl?: string | null;
  body: string;
  photoUris: string[];
  video?: { uri: string; durationSeconds: number; mimeType: string } | null;
}): Promise<{
  story: MaritesStory;
  shared: boolean;
}> {
  const body = repairMojibakeText(
    String(input.body ?? '')
  ).trim();
  const photoUris = (input.photoUris ?? [])
    .map((uri) => String(uri ?? '').trim())
    .filter(Boolean)
    .slice(0, MARITES_MAX_PHOTOS);

  if (input.video && (!Number.isFinite(input.video.durationSeconds) || input.video.durationSeconds <= 0 || input.video.durationSeconds > 30)) throw new Error('Quick Video must be 30 seconds or shorter.');
  if (input.video && photoUris.length) throw new Error('Share Quick Video separately from photos.');
  const localStory: MaritesStory = {
    id: `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    user_id: input.userId,
    author_name: input.authorName || 'Member',
    avatar_url: input.avatarUrl ?? null,
    body,
    photo_uris: photoUris,
    photo_uri: photoUris[0] ?? null,
    video_uri: input.video?.uri ?? null,
    mentions: [],
    author_only: false,
    source: 'local',
    reaction_counts: {},
    my_reaction: null,
    created_at: new Date().toISOString(),
  };

  const uploaded: Array<{
    media_path: string;
    media_mime_type: string;
    media_size_bytes: number;
  }> = [];

  let createdPostId: string | null = null;
  let videoPath: string | null = null;

  try {
    if (input.video) {
      const { uploadCommunityVideoFile } = await import('@/lib/uploadCommunityVideoFile');
      videoPath = `${input.userId}/marites-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
      await uploadCommunityVideoFile({ path: videoPath, uri: input.video.uri, contentType: input.video.mimeType });
      uploaded.push({ media_path: videoPath, media_mime_type: input.video.mimeType, media_size_bytes: 0 });
    }
    for (let index = 0; index < photoUris.length; index += 1) {
      const path =
        `${input.userId}/marites-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.jpg`;
      const { uploadCommunityPhotoFile } = await import('@/lib/uploadCommunityVideoFile');
      const prepared = await uploadCommunityPhotoFile({
        path,
        uri: photoUris[index],
      });

      uploaded.push({
        media_path: prepared.path,
        media_mime_type: 'image/jpeg',
        media_size_bytes: prepared.sizeBytes,
      });
    }

    const first = uploaded[0] ?? null;

    const sharedBody = withMaritesPostMarker(
      body ||
        (uploaded.length > 1
          ? 'Shared photos.'
          : uploaded.length
            ? (input.video ? 'Shared a Quick Video.' : 'Shared a photo.')
            : '')
    );

    const { data: created, error: createError } = await (
      supabase as any
    ).rpc('create_buklod_community_post_v3', {
      p_audience: 'public',
      p_group_id: null,
      p_category: 'reflection',
      p_body: sharedBody,
      // The public post RPC intentionally rejects video uploads on the
      // regular Wall. Create the marked Marites post without primary media,
      // then attach the already-uploaded Quick Video through the existing
      // author-verified set_buklod_post_media_v5 RPC.
      p_media_path: input.video ? null : (first?.media_path ?? null),
      p_media_mime_type: input.video ? null : (first?.media_mime_type ?? null),
      p_media_size_bytes: input.video ? null : (first?.media_size_bytes ?? null),
      p_media_duration_seconds: null,
      p_is_reel: false,
      p_mentioned_user_ids: [],
    });

    if (createError) {
      if (isMissingRpcError(String(createError.message ?? ''))) {
        if (uploaded.length) {
          await discardIncompleteCommunityPost({ postId: null, mediaPaths: uploaded.map(item => item.media_path) });
        }
        const saved = await appendOfflineMaritesStory(localStory, input.video?.mimeType);
        return { story: saved, shared: false };
      }

      throw createError;
    }

    createdPostId =
      typeof created === 'string'
        ? created
        : Array.isArray(created)
          ? typeof created[0] === 'string'
            ? created[0]
            : created[0]?.id ?? null
          : created?.id ?? null;

    if (!createdPostId) {
      throw new Error(
        'Post was created but its ID was not returned.'
      );
    }

    if (uploaded.length) {
      await attachCommunityPostMedia(
        createdPostId,
        uploaded
      );
    }

    const signedPhotos = input.video ? [] : await Promise.all(
      uploaded.map(async (item) => {
        const url = await signCommunityMediaPath(item.media_path);
        return url || '';
      })
    );
    // Immediately use the same provider-aware source as feed refreshes.
    // A newly uploaded AWS video has no object in Supabase to sign.
    let publishedVideoUrl: string | null = null;
    if (input.video) {
      try {
        const rows = await loadCommunityPostMediaByPostIds([createdPostId]);
        publishedVideoUrl = rows[createdPostId]?.find(
          (row) => String(row.media_mime_type ?? '').startsWith('video/'),
        )?.media_url ?? null;
      } catch {
        // Publication already committed; next feed refresh can recover URL.
      }
    }

    const sharedStory: MaritesStory = {
      id: `${COMMUNITY_MARITES_ID_PREFIX}${createdPostId}`,
      user_id: input.userId,
      author_name: input.authorName || 'Member',
      avatar_url: input.avatarUrl ?? null,
      body,
      photo_uris: input.video ? [] : signedPhotos.filter(Boolean),
      photo_uri: input.video ? null : (signedPhotos.find(Boolean) ?? null),
      photo_paths: input.video ? [] : uploaded.map((item) => item.media_path),
      video_uri: input.video ? (publishedVideoUrl || input.video.uri) : null,
      mentions: [],
      author_only: false,
      source: 'community',
      community_post_id: createdPostId,
      reaction_counts: {},
      my_reaction: null,
      created_at: new Date().toISOString(),
    };

    return { story: sharedStory, shared: true };
  } catch (error) {
    // Once the RPC commits a post, deleting it on a later signing or
    // attachment failure can erase a successfully shared story.
    // Preserve the committed post and let a refresh recover its state.
    if (!createdPostId && uploaded.length) {
      await discardIncompleteCommunityPost({
        postId: null,
        mediaPaths: uploaded.map((item) => item.media_path),
      });
    }
    if (createdPostId) {
      return {
        story: {
          ...localStory,
          id: `${COMMUNITY_MARITES_ID_PREFIX}${createdPostId}`,
          source: 'community',
          community_post_id: createdPostId,
          photo_paths: uploaded.map((item) => item.media_path),
        },
        shared: true,
      };
    }

    const message = String(
      (error as Error)?.message ?? error
    );

    if (isMissingRpcError(message)) {
      const saved = await appendOfflineMaritesStory(localStory, input.video?.mimeType);
      return { story: saved, shared: false };
    }

    // Offline / unexpected failure — still keep a local copy.
    const saved = await appendOfflineMaritesStory(localStory, input.video?.mimeType);
    console.warn('Marites shared publish failed:', message);
    return { story: saved, shared: false };
  }
}

export function filterMaritesStoriesForViewer(
  stories: MaritesStory[],
  viewerId?: string | null
) {
  return stories.filter((story) => {
    if (!isActiveMaritesStory(story)) return false;
    // Device-only fallback stories are not shared with a different login.
    if (story.source !== 'community' && story.user_id !== viewerId) return false;
    if (!story.author_only) {
      return true;
    }

    return Boolean(
      viewerId && story.user_id === viewerId
    );
  });
}

export async function updateMaritesStory(
  storyId: string,
  body: string,
  photos?: string[]
): Promise<MaritesStory[]> {
  const existing = await loadMaritesStories();
  const next = existing.map((story) =>
    story.id === storyId
      ? {
          ...story,
          body: repairMojibakeText(body).trim(),
          ...(photos
            ? {
                photo_uris: photos
                  .map((uri) => String(uri ?? '').trim())
                  .filter(Boolean)
                  .slice(0, MARITES_MAX_PHOTOS),
                photo_uri:
                  photos
                    .map((uri) => String(uri ?? '').trim())
                    .find(Boolean) ?? null,
              }
            : {}),
        }
      : story
  );

  await saveMaritesStories(next);

  return next;
}

export async function deleteMaritesStory(
  storyId: string
): Promise<MaritesStory[]> {
  const existing = await loadMaritesStories();
  const next = existing.filter((story) => story.id !== storyId);

  await saveMaritesStories(next);
  const removed = existing.find((story) => story.id === storyId);
  if (removed) await discardSavedMaritesVideo(removed);

  return next;
}

export async function setMaritesStoryAuthorOnly(
  storyId: string,
  authorOnly: boolean
): Promise<MaritesStory[]> {
  const existing = await loadMaritesStories();
  const next = existing.map((story) =>
    story.id === storyId
      ? { ...story, author_only: authorOnly }
      : story
  );

  await saveMaritesStories(next);

  return next;
}

export function sumMaritesReactionCounts(
  counts?: Record<string, number> | null
) {
  return Object.values(counts ?? {}).reduce(
    (sum, value) => sum + Math.max(0, Number(value ?? 0)),
    0
  );
}

export function topMaritesReactionKey(
  counts?: Record<string, number> | null
) {
  const entries = Object.entries(counts ?? {}).filter(
    ([, value]) => Number(value ?? 0) > 0
  );

  if (!entries.length) {
    return null;
  }

  return entries.sort(
    (a, b) => Number(b[1] ?? 0) - Number(a[1] ?? 0)
  )[0][0];
}

export async function setMaritesStoryReaction(
  storyId: string,
  _userId: string,
  reaction: string | null
): Promise<MaritesStory[]> {
  const postId = parseCommunityMaritesPostId(storyId);

  if (postId) {
    const { error } = await (supabase as any).rpc(
      'set_buklod_post_reaction_v3',
      {
        p_post_id: postId,
        p_reaction: reaction,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    return [];
  }

  const existing = await loadMaritesStories();
  const next = existing.map((story) => {
    if (story.id !== storyId) {
      return story;
    }

    const counts = {
      ...(story.reaction_counts ?? {}),
    };
    const previous = story.my_reaction ?? null;

    if (previous) {
      counts[previous] = Math.max(
        0,
        Number(counts[previous] ?? 0) - 1
      );
    }

    if (reaction) {
      counts[reaction] = Math.max(
        0,
        Number(counts[reaction] ?? 0) + 1
      );
    }

    return {
      ...story,
      reaction_counts: counts,
      my_reaction: reaction,
    };
  });

  await saveMaritesStories(next);

  return next;
}

export function maritesAgeLabel(value: string): string {
  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) {
    return '';
  }

  const diff = Date.now() - time;
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d`;
  }

  return new Date(value).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}

export const MARITES_QUICK_EMOJI = [
  '🙏',
  '❤️',
  '😊',
  '🎉',
  '✨',
  '😂',
  '👍',
  '🕊️',
] as const;

