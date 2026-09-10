import { supabase } from '@/lib/supabase';

export type ClassroomUploadInput = {
  uri: string;
  bucket: string;
  path: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  cacheControl?: string;
  onProgress?: (progress: { sent: number; total: number; percent: number }) => void;
  signal?: AbortSignal;
};

export type ClassroomUploadResult = {
  bucket: string;
  path: string;
  size: number;
  resumable: boolean;
};

function isBlobUrl(uri: string) {
  return uri.startsWith('blob:') || uri.startsWith('data:');
}

async function uriToBlob(uri: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(uri, { signal });
  if (!response.ok) throw new Error(`Could not read selected file (${response.status}).`);
  return response.blob();
}

/**
 * Web-safe Classroom upload implementation.
 * The native implementation lives in classroomTransfer.ts and uses
 * expo-file-system / expo-media-library. This file intentionally avoids those
 * native-only modules so Expo Router can build the web route tree safely.
 */
export async function uploadClassroomObject(
  input: ClassroomUploadInput,
): Promise<ClassroomUploadResult> {
  if (input.signal?.aborted) throw new Error('Upload cancelled.');

  const blob = await uriToBlob(input.uri, input.signal);
  const total = Number.isFinite(input.size) && Number(input.size) >= 0
    ? Number(input.size)
    : blob.size;

  if (total <= 0) throw new Error('The selected file is empty.');
  input.onProgress?.({ sent: 0, total, percent: 0 });

  const { error } = await supabase.storage.from(input.bucket).upload(input.path, blob, {
    contentType: input.mimeType ?? blob.type || 'application/octet-stream',
    cacheControl: input.cacheControl ?? '3600',
    upsert: false,
  });

  if (error) throw error;
  input.onProgress?.({ sent: total, total, percent: 100 });

  return {
    bucket: input.bucket,
    path: input.path,
    size: total,
    resumable: false,
  };
}

export async function createClassroomSignedUrl(
  bucket: string,
  path: string,
  expiresSeconds = 600,
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresSeconds);

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Could not authorize this file.');
  }

  return data.signedUrl;
}

export async function saveClassroomFileToDevice(input: {
  bucket: string;
  path: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
}) {
  const signedUrl = await createClassroomSignedUrl(input.bucket, input.path, 900);

  if (typeof window !== 'undefined') {
    window.open(signedUrl, '_blank', 'noopener,noreferrer');
  }

  return { mode: 'browser' as const };
}
