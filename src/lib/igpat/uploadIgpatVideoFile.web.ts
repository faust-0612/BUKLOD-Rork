import { supabase } from '@/lib/supabase';

export async function uploadIgpatVideoFile(input: {
  path: string;
  uri: string;
  contentType: string;
  sizeBytes: number;
  onProgress?: (ratio: number) => void;
}) {
  const response = await fetch(input.uri);
  if (!response.ok) throw new Error(`Could not read selected video (${response.status}).`);
  const blob = await response.blob();
  const bucket = supabase.storage.from('community-media');
  const { data, error } = await bucket.createSignedUploadUrl(input.path, { upsert: false });
  if (error) throw error;
  const signedUrl = String(data?.signedUrl ?? '').trim();
  if (!signedUrl) throw new Error('Could not prepare IGPAT upload URL.');

  input.onProgress?.(0.05);
  const upload = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'content-type': input.contentType,
      'cache-control': '3600',
      'x-upsert': 'false',
    },
    body: blob,
  });
  if (!upload.ok) {
    const body = await upload.text().catch(() => '');
    throw new Error(`IGPAT upload failed (${upload.status})${body ? `: ${body.slice(0, 180)}` : ''}`);
  }
  input.onProgress?.(1);
}
