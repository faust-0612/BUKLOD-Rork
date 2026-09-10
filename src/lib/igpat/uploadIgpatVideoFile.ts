import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

export async function uploadIgpatVideoFile(input: {
  path: string;
  uri: string;
  contentType: string;
  sizeBytes: number;
  onProgress?: (ratio: number) => void;
}) {
  const bucket = supabase.storage.from('community-media');
  const { data, error } = await bucket.createSignedUploadUrl(input.path, { upsert: false });
  if (error) throw error;
  const signedUrl = String(data?.signedUrl ?? '').trim();
  if (!signedUrl) throw new Error('Could not prepare IGPAT upload URL.');

  const task = FileSystem.createUploadTask(
    signedUrl,
    input.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'content-type': input.contentType,
        'cache-control': '3600',
        'x-upsert': 'false',
      },
    },
    progress => {
      const sent = Number(progress.totalBytesSent ?? 0);
      const total = Number(progress.totalBytesExpectedToSend ?? input.sizeBytes ?? 0);
      input.onProgress?.(total > 0 ? Math.min(1, sent / total) : 0);
    },
  );

  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(`IGPAT upload failed (${result?.status ?? 'no response'}).`);
  }
  input.onProgress?.(1);
}
