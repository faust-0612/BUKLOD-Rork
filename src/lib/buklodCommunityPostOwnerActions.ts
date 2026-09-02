import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { attachCommunityPostMedia } from '@/lib/buklodCommunityPostMedia';
import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

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
} | null | undefined) {
  return isVideoMime(post?.media_mime_type);
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

export async function saveCommunityPostEdit(input: {
  postId: string;
  userId: string;
  body: string;
  photos: CommunityEditPhoto[];
}): Promise<CommunityPostMediaPatch> {
  const body = String(input.body ?? '');
  await updateCommunityPost(input.postId, body);

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

  await attachCommunityPostMedia(
    input.postId,
    uploaded.map(item => ({
      media_path: item.media_path,
      media_mime_type: item.media_mime_type,
      media_size_bytes: item.media_size_bytes,
    }))
  );

  const first = uploaded[0] ?? null;

  await supabase
    .from('community_posts')
    .update({
      media_path: first?.media_path ?? null,
      media_mime_type: first?.media_mime_type ?? null,
      media_size_bytes: first?.media_size_bytes ?? null,
    })
    .eq('id', input.postId);

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


export async function updateCommunityPost(
  postId: string,
  body: string
) {
  const { error } = await supabase.rpc(
    'update_buklod_community_post_v1',
    {
      p_post_id: postId,
      p_body: body,
    }
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      const { error: directError } = await supabase
        .from('community_posts')
        .update({ body })
        .eq('id', postId);

      if (directError) {
        throw directError;
      }

      return;
    }

    throw error;
  }
}

export async function deleteCommunityPost(postId: string) {
  const { error } = await supabase.rpc(
    'delete_buklod_community_post_v1',
    { p_post_id: postId }
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      const { error: directError } = await supabase
        .from('community_posts')
        .update({ is_hidden: true })
        .eq('id', postId);

      if (directError) {
        throw directError;
      }

      return;
    }

    throw error;
  }
}

export async function setCommunityPostAuthorOnly(
  postId: string,
  authorOnly: boolean
) {
  const { error } = await supabase.rpc(
    'set_buklod_community_post_author_only_v1',
    {
      p_post_id: postId,
      p_author_only: authorOnly,
    }
  );

  if (error) {
    if (isMissingRpcError(String(error.message ?? ''))) {
      const { error: directError } = await supabase
        .from('community_posts')
        .update({ author_only: authorOnly })
        .eq('id', postId);

      if (directError) {
        throw directError;
      }

      return;
    }

    throw error;
  }
}
