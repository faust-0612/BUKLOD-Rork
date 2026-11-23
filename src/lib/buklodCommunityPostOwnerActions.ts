import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { attachCommunityPostMedia } from '@/lib/buklodCommunityPostMedia';
import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';

export type CommunityEditPhoto = {
  id: string;
  uri: string;
  mediaPath?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export type CommunityPostMediaPatch = {
  body: string;
  media_path: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_size_bytes: number | null;
  media_items: Array<{
    post_id: string;
    media_position: number;
    media_path: string | null;
    media_mime_type: string | null;
    media_size_bytes: number | null;
    media_url: string | null;
  }>;
};

function isVideoMime(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .startsWith('video/');
}

export function communityPostIsVideo(post: {
  media_mime_type?: string | null;
  media_items?: Array<{ media_mime_type?: string | null }> | null;
} | null | undefined) {
  return isVideoMime(post?.media_mime_type) ||
    Boolean(post?.media_items?.some(item => isVideoMime(item?.media_mime_type)));
}

export function communityPostEditPhotos(post: {
  id?: string;
  media_items?: any[];
  media_path?: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_size_bytes?: number | null;
}): CommunityEditPhoto[] {
  const items = Array.isArray(post.media_items) && post.media_items.length
    ? post.media_items
    : post.media_path || post.media_url
      ? [
          {
            media_path: post.media_path,
            media_url: post.media_url,
            media_mime_type: post.media_mime_type,
            media_size_bytes: post.media_size_bytes,
          },
        ]
      : [];

  return items
    .filter(
      (item: any) =>
        !isVideoMime(item?.media_mime_type) &&
        (item?.media_url || item?.media_path)
    )
    .map((item: any, index: number) => ({
      id: String(
        item.media_path ||
          item.media_url ||
          `${post.id ?? 'photo'}-${index}`
      ),
      uri: String(item.media_url ?? '').trim(),
      mediaPath: item.media_path
        ? String(item.media_path)
        : null,
      mimeType: item.media_mime_type
        ? String(item.media_mime_type)
        : 'image/jpeg',
      sizeBytes: Number(item.media_size_bytes ?? 0) || null,
    }))
    .filter(item => item.uri || item.mediaPath);
}

async function encodeEditPhoto(uri: string) {
  const M = await import('expo-image-manipulator');
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
    uri: image.uri,
    base64: image.base64,
    sizeBytes,
  };
}

async function signMediaPath(path: string | null | undefined) {
  const clean = String(path ?? '').trim();
  if (!clean) {
    return null;
  }

  const { data } = await supabase.storage
    .from('community-media')
    .createSignedUrl(clean, 3600);

  return data?.signedUrl ?? null;
}

type CommunityPostEditInput = {
  postId: string;
  userId: string;
  body: string;
  // Undefined means caption-only. [] explicitly removes every photo.
  photos?: CommunityEditPhoto[];
};

export function saveCommunityPostEdit(
  input: CommunityPostEditInput & { photos: CommunityEditPhoto[] }
): Promise<CommunityPostMediaPatch>;
export function saveCommunityPostEdit(
  input: CommunityPostEditInput
): Promise<Pick<CommunityPostMediaPatch, 'body'> & Partial<CommunityPostMediaPatch>>;
export async function saveCommunityPostEdit(
  input: CommunityPostEditInput
): Promise<CommunityPostMediaPatch | Pick<CommunityPostMediaPatch, 'body'>> {
  const body = String(input.body ?? '').trim();
  if (!body || body.length > 12000) {
    throw new Error('A post needs 1–12,000 characters of text.');
  }

  // A text-only edit MUST NOT touch either the legacy media columns or the
  // canonical community_post_media rows (especially external/AWS videos).
  if (input.photos === undefined) {
    await updateCommunityPost(input.postId, body);
    return { body };
  }

  if (!String(input.userId ?? '').trim()) {
    throw new Error('Sign in to edit photos.');
  }

  const photos = input.photos.slice(0, COMMUNITY_MAX_PHOTOS);
  const uploaded: Array<{
    media_path: string;
    media_mime_type: string;
    media_size_bytes: number;
    media_url: string | null;
  }> = [];

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const existingPath = String(photo.mediaPath ?? '').trim();

    if (existingPath) {
      uploaded.push({
        media_path: existingPath,
        media_mime_type: photo.mimeType || 'image/jpeg',
        media_size_bytes: Number(photo.sizeBytes ?? 0) || 0,
        media_url: photo.uri || null,
      });
      continue;
    }

    const encoded = await encodeEditPhoto(photo.uri);
    const path = `${input.userId}/post-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('community-media')
      .upload(path, decode(encoded.base64), {
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
      media_url: encoded.uri,
    });
  }

  if (uploaded.length) {
    // The server media RPC replaces the rows AND updates legacy columns
    // together. Never follow it with an unchecked direct table update.
    await attachCommunityPostMedia(
      input.postId,
      uploaded.map(item => ({
        media_path: item.media_path,
        media_mime_type: item.media_mime_type,
        media_size_bytes: item.media_size_bytes,
      }))
    );
  } else {
    // attachCommunityPostMedia intentionally ignores [] (publish safety).
    // Editing away every photo is different: explicitly clear via the
    // author-checked, transactional media RPC, not a client-side DELETE.
    const { error } = await (supabase as any).rpc(
      'set_buklod_post_media_v7',
      { p_post_id: input.postId, p_media: [] }
    );
    if (error) {
      // Fail closed rather than silently retaining deleted photos.
      throw error;
    }
  }

  // Commit the text only after media preparation succeeds. A failed upload
  // must never publish a new caption while leaving incomplete media.
  await updateCommunityPost(input.postId, body);

  const first = uploaded[0] ?? null;

  const mediaItems = await Promise.all(
    uploaded.map(async (item, index) => ({
      post_id: input.postId,
      media_position: index,
      media_path: item.media_path,
      media_mime_type: item.media_mime_type,
      media_size_bytes: item.media_size_bytes,
      media_url:
        item.media_url ||
        (await signMediaPath(item.media_path)),
    }))
  );

  return {
    body,
    media_path: first?.media_path ?? null,
    media_url: mediaItems[0]?.media_url ?? null,
    media_mime_type: first?.media_mime_type ?? null,
    media_size_bytes: first?.media_size_bytes ?? null,
    media_items: mediaItems,
  };
}


// These RPCs exist on the verified live backend and enforce auth.uid().
// Never fall back to an unchecked direct update: RLS may affect zero rows
// without an error, causing the Wall to falsely report a saved change.
export async function updateCommunityPost(postId: string, body: string) {
  const { error } = await supabase.rpc(
    'update_buklod_community_post_v1',
    { p_post_id: postId, p_body: body }
  );
  if (error) throw error;
}

export async function deleteCommunityPost(postId: string) {
  const { error } = await supabase.rpc(
    'delete_buklod_community_post_v1',
    { p_post_id: postId }
  );
  if (error) throw error;
}

export async function setCommunityPostAuthorOnly(
  postId: string,
  authorOnly: boolean
) {
  const { error } = await supabase.rpc(
    'set_buklod_community_post_author_only_v1',
    { p_post_id: postId, p_author_only: authorOnly }
  );
  if (error) throw error;
}
