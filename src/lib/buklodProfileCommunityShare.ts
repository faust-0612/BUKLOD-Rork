import { decode } from 'base64-arraybuffer';

import { attachCommunityPostMedia } from '@/lib/buklodCommunityPostMedia';
import { supabase } from '@/lib/supabase';

function createdPostIdFromRpc(created: unknown) {
  if (typeof created === 'string') {
    return created;
  }

  if (Array.isArray(created)) {
    const first = created[0];
    if (typeof first === 'string') {
      return first;
    }
    return first?.id ?? null;
  }

  if (created && typeof created === 'object' && 'id' in created) {
    return (created as { id?: string }).id ?? null;
  }

  return null;
}

export async function shareProfileUpdateOnCommunityWall(input: {
  userId: string;
  kind: 'photo' | 'background';
  base64: string;
}) {
  const userId = String(input.userId ?? '').trim();
  const base64 = String(input.base64 ?? '').trim();

  if (!userId || !base64) {
    return;
  }

  const sizeBytes = Math.ceil(base64.length * 0.75);
  const path = `${userId}/profile-${input.kind}-${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('community-media')
    .upload(path, decode(base64), {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const body =
    input.kind === 'photo'
      ? 'Updated my profile photo.'
      : 'Updated my profile background.';

  try {
    const { data: created, error: createError } = await (
      supabase as any
    ).rpc('create_buklod_community_post_v3', {
      p_audience: 'public',
      p_group_id: null,
      p_category: 'reflection',
      p_body: body,
      p_media_path: path,
      p_media_mime_type: 'image/jpeg',
      p_media_size_bytes: sizeBytes,
      p_media_duration_seconds: null,
      p_is_reel: false,
      p_mentioned_user_ids: [],
    });

    if (createError) {
      throw createError;
    }

    const postId = createdPostIdFromRpc(created);

    if (!postId) {
      throw new Error('Post was created but its ID was not returned.');
    }

    await attachCommunityPostMedia(postId, [
      {
        media_path: path,
        media_mime_type: 'image/jpeg',
        media_size_bytes: sizeBytes,
      },
    ]);
  } catch (error) {
    await supabase.storage.from('community-media').remove([path]);
    throw error;
  }
}
