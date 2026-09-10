import { supabase } from '@/lib/supabase';

export async function uploadIgpatVideoFile(input: {
  path: string;
  uri: string;
  contentType: string;
  sizeBytes: number;
  onProgress?: (ratio: number) => void;
}) {
  input.onProgress?.(0.02);

  const source = await fetch(input.uri);
  if (!source.ok && !input.uri.startsWith('blob:')) {
    throw new Error(`Could not read selected video (${source.status}).`);
  }

  const blob = await source.blob();
  if (!blob.size) throw new Error('Selected IGPAT video is empty.');
  input.onProgress?.(0.12);

  const bucket = supabase.storage.from('community-media');
  const { data: signed, error: signError } = await bucket.createSignedUploadUrl(input.path, { upsert: false });
  if (signError) throw new Error(signError.message || 'Could not prepare IGPAT upload.');

  const token = String((signed as any)?.token ?? '').trim();
  if (!token) throw new Error('The IGPAT upload token was not returned by Storage.');

  input.onProgress?.(0.25);
  const { error: uploadError } = await bucket.uploadToSignedUrl(input.path, token, blob, {
    contentType: input.contentType || blob.type || 'video/mp4',
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message || 'IGPAT video upload failed.');
  }

  input.onProgress?.(1);
}
