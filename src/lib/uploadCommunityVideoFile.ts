import * as FileSystem
  from 'expo-file-system/legacy';

import {
  supabase,
} from '@/lib/supabase';

/*
 * PATCH_173F_R3_MEMORY_SAFE_REEL_UPLOAD
 *
 * IMPORTANT:
 * Do NOT read video files with readAsStringAsync(Base64).
 * A 35-50 MB Reel can expand dramatically in JS/Java memory and
 * crash Android with OutOfMemoryError before Supabase upload starts.
 *
 * Flow:
 * 1. Ask Supabase Storage for a signed upload URL.
 * 2. Let Expo FileSystem upload the local file directly as binary.
 * 3. No full video base64 string and no ArrayBuffer copy in JS memory.
 */
export async function
uploadCommunityVideoFile({
  path,
  uri,
  contentType,
}: {
  path: string;
  uri: string;
  contentType: string;
}): Promise<void> {
  const bucket =
    supabase.storage.from(
      'community-media',
    );

  const {
    data: signed,
    error:
      signedError,
  } =
    await bucket
      .createSignedUploadUrl(
        path,
        {
          upsert: false,
        },
      );

  if (
    signedError
  ) {
    throw signedError;
  }

  const signedUrl =
    String(
      signed?.signedUrl ??
        '',
    );

  if (!signedUrl) {
    throw new Error(
      'Could not prepare the Reel upload URL.',
    );
  }

  const result =
    await FileSystem
      .uploadAsync(
        signedUrl,
        uri,
        {
          httpMethod:
            'PUT',
          uploadType:
            FileSystem
              .FileSystemUploadType
              .BINARY_CONTENT,
          headers: {
            'content-type':
              contentType,
            'cache-control':
              '3600',
            'x-upsert':
              'false',
          },
        },
      );

  if (
    result.status < 200 ||
    result.status >= 300
  ) {
    const serverBody =
      String(
        result.body ??
          '',
      )
        .replace(
          /\s+/g,
          ' ',
        )
        .trim()
        .slice(
          0,
          300,
        );

    throw new Error(
      serverBody
        ? `Reel upload failed (${result.status}): ${serverBody}`
        : `Reel upload failed (${result.status}).`,
    );
  }
}