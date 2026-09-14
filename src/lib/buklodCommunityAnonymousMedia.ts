import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { prepareCommunityJpegUri } from '@/lib/uploadCommunityVideoFile';

export async function uploadBuklodAnonymousCommunityPhoto(
  uri: string,
): Promise<{ storagePath: string; sizeBytes: number }> {
  const prepared = await prepareCommunityJpegUri(uri);
  if (prepared.sizeBytes > 5 * 1024 * 1024) {
    throw new Error('Anonymous Community photos are limited to 5 MB.');
  }

  const { data, error } = await supabase.functions.invoke(
    'buklod-community-ai',
    {
      body: {
        action: 'anonymous_upload_url',
        mime_type: 'image/jpeg',
        size_bytes: prepared.sizeBytes,
      },
    },
  );
  if (error) throw error;

  const signedUrl = String(data?.signed_url ?? '').trim();
  const storagePath = String(data?.storage_path ?? '').trim();
  if (!signedUrl || !storagePath) {
    throw new Error('Could not prepare the anonymous photo upload.');
  }

  if (Platform.OS === 'web') {
    const source = await fetch(prepared.uri);
    if (!source.ok) throw new Error('Could not read the prepared photo.');
    const blob = await source.blob();
    const upload = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': '3600',
        'x-upsert': 'false',
      },
      body: blob,
    });
    if (!upload.ok) {
      throw new Error(`Anonymous photo upload failed (${upload.status}).`);
    }
  } else {
    const result = await FileSystem.uploadAsync(
      signedUrl,
      prepared.uri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'content-type': 'image/jpeg',
          'cache-control': '3600',
          'x-upsert': 'false',
        },
      },
    );
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Anonymous photo upload failed (${result.status}).`);
    }
  }

  return { storagePath, sizeBytes: prepared.sizeBytes };
}
