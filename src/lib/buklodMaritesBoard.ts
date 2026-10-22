import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOfflineCache, setOfflineCache } from '@/lib/offlineCache';

import {
  hydratePersonNamesOnRows,
} from '@/lib/buklodPersonDisplay';
import {
  repairMojibakeText,
} from '@/lib/repairMojibakeText';
import { supabase } from '@/lib/supabase';
import { attachCommunityPostMedia, discardIncompleteCommunityPost } from '@/lib/buklodCommunityPostMedia';
import { maritesFeedPageLimit, withMaritesPageDeadline } from '@/lib/buklodMaritesFeedPages';

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

export async function loadMaritesStories(): Promise<MaritesStory[]> {
  const raw = await AsyncStorage.getItem(MARITES_STORAGE_KEY);
  const rows = parseStories(raw);

  return rows
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

  const rawUserId = String(post.user_id ?? '').trim();
  const anonymous = String(post.author_name ?? '').trim() === 'Anonymous BUKLOD Member';
  if (!rawUserId && !anonymous) return null;
  const userId = rawUserId || `anonymous-story:${postId}`;

  const photoUris = communityPostPhotoUris(post);
  const body = stripMaritesPostMarker(
    repairMojibakeText(String(post.body ?? ''))
  ).trim();

  if (!body && !photoUris.length) {
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
  pageSize = 20,
  onStories?: (stories: MaritesStory[]) => void,
): Promise<MaritesCommunityLoad> {
  const limit = maritesFeedPageLimit(pageSize);
  let stories: MaritesStory[] = [];
  const seen = new Set<string>();
  let offset = 0;
  // The dedicated endpoint filters stories BEFORE paging, and includes media paths.
  // No Community ranking window, names, ranks or reaction queries gate story text.
  for (let page = 0; page < 125; page++) {
    const controller = new AbortController();
    let result: any;
    try {
      result = await withMaritesPageDeadline(Promise.resolve(
        (supabase as any).rpc('get_buklod_marites_feed_v1', {
          p_location_scope_id: locationScopeId || null,
          p_limit: limit, p_offset: offset,
        }).abortSignal(controller.signal),
      ), 12_000);
    } catch {
      controller.abort();
      return { stories, refreshFailed: true };
    }
    if (result.error || !Array.isArray(result.data)) {
      return { stories, refreshFailed: true };
    }
    const rows = result.data as Record<string, unknown>[];
    const fresh = rows.filter(row => {
      const id = String(row.id ?? '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    const pageStories = fresh.filter(isMaritesCommunityPost)
      .map(mapCommunityPostToMaritesStory).filter(Boolean) as MaritesStory[];
    stories = mergeMaritesStories(stories, pageStories);
    onStories?.(stories);

    // Paint paths/text first. Signing cannot prevent a photo-only story being found.
    const signed = await Promise.all(pageStories.map(async story => {
      const uris = await Promise.all((story.photo_paths ?? []).map(path =>
        withMaritesPageDeadline(signCommunityMediaPath(path), 4000).catch(() => null),
      ));
      return {
        ...story,
        photo_uris: uris.map((uri, index) => uri || story.photo_uris[index]),
        photo_uri: uris[0] || story.photo_uri || null,
      };
    }));
    stories = mergeMaritesStories(stories, signed);
    onStories?.(stories);
    if (rows.length < limit) return { stories, refreshFailed: false };
    if (!fresh.length) return { stories, refreshFailed: true };
    offset += rows.length;
  }
  return { stories, refreshFailed: true };
}

function sharedStoryCacheKey(scopeId?: string | null) {
  return `marites-shared:v2:${scopeId || 'public'}`;
}

export async function loadCachedMaritesStories(
  scopeId: string | null | undefined,
  viewerId: string,
): Promise<MaritesStory[]> {
  const cached = await getOfflineCache<MaritesStory[]>(sharedStoryCacheKey(scopeId), {
    userId: viewerId, allowStale: true,
  });
  return Array.isArray(cached?.data) ? cached.data : [];
}

export async function cacheSharedMaritesStories(
  scopeId: string | null | undefined,
  viewerId: string,
  stories: MaritesStory[],
) {
  await setOfflineCache(sharedStoryCacheKey(scopeId), stories, {
    userId: viewerId, ttlMs: 30 * 60 * 1000,
  });
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
  viewerUserId?: string | null,
  onStories?: (stories: MaritesStory[]) => void,
): Promise<MaritesLoadResult> {
  const local = filterMaritesStoriesForViewer(await loadMaritesStories(), viewerUserId);
  const community = await loadCommunityMaritesStories(
    locationScopeId, viewerUserId, 20,
    rows => onStories?.(mergeMaritesStories(local, rows)),
  );
  return {
    stories: mergeMaritesStories(local, community.stories),
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

async function encodeMaritesPhotoBase64(uri: string) {
  const M = await import('expo-image-manipulator');
  const { decode } = await import('base64-arraybuffer');

  const context = M.ImageManipulator.manipulate(uri);
  context.resize({ width: 1600 });

  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({
    format: M.SaveFormat.JPEG,
    compress: 0.86,
    base64: true,
  });

  if (!image.base64) {
    throw new Error('Could not prepare this photo.');
  }

  const sizeBytes = Math.ceil(image.base64.length * 0.75);

  if (sizeBytes > 5 * 1024 * 1024) {
    throw new Error('Photo is too large.');
  }

  return {
    base64: image.base64,
    sizeBytes,
    decode,
  };
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

  try {
    for (let index = 0; index < photoUris.length; index += 1) {
      const encoded = await encodeMaritesPhotoBase64(
        photoUris[index]
      );
      const path =
        `${input.userId}/marites-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('community-media')
        .upload(path, encoded.decode(encoded.base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      uploaded.push({
        media_path: path,
        media_mime_type: 'image/jpeg',
        media_size_bytes: encoded.sizeBytes,
      });
    }

    const first = uploaded[0] ?? null;

    const sharedBody = withMaritesPostMarker(
      body ||
        (uploaded.length > 1
          ? 'Shared photos.'
          : uploaded.length
            ? 'Shared a photo.'
            : '')
    );

    const { data: created, error: createError } = await (
      supabase as any
    ).rpc('create_buklod_community_post_v3', {
      p_audience: 'public',
      p_group_id: null,
      p_category: 'reflection',
      p_body: sharedBody,
      p_media_path: first?.media_path ?? null,
      p_media_mime_type: first?.media_mime_type ?? null,
      p_media_size_bytes: first?.media_size_bytes ?? null,
      p_media_duration_seconds: null,
      p_is_reel: false,
      p_mentioned_user_ids: [],
    });

    if (createError) {
      if (isMissingRpcError(String(createError.message ?? ''))) {
        await appendMaritesStory(localStory);
        return { story: localStory, shared: false };
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

    const signedPhotos = await Promise.all(
      uploaded.map(async (item) => {
        const url = await signCommunityMediaPath(
          item.media_path
        );
        return url || '';
      })
    );

    const sharedStory: MaritesStory = {
      id: `${COMMUNITY_MARITES_ID_PREFIX}${createdPostId}`,
      user_id: input.userId,
      author_name: input.authorName || 'Member',
      avatar_url: input.avatarUrl ?? null,
      body,
      photo_uris: signedPhotos.filter(Boolean),
      photo_uri: signedPhotos.find(Boolean) ?? null,
      photo_paths: uploaded.map((item) => item.media_path),
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
    if (createdPostId || uploaded.length) {
      await discardIncompleteCommunityPost({
        postId: createdPostId,
        mediaPaths: uploaded.map((item) => item.media_path),
      });
    }

    const message = String(
      (error as Error)?.message ?? error
    );

    if (isMissingRpcError(message)) {
      await appendMaritesStory(localStory);
      return { story: localStory, shared: false };
    }

    // Offline / unexpected failure — still keep a local copy.
    await appendMaritesStory(localStory);
    console.warn('Marites shared publish failed:', message);
    return { story: localStory, shared: false };
  }
}

export function filterMaritesStoriesForViewer(
  stories: MaritesStory[],
  viewerId?: string | null
) {
  return stories.filter((story) => {
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
