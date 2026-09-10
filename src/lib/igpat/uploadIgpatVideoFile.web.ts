import { supabase } from '@/lib/supabase';

export async function uploadIgpatVideoFile(input: {
  path: string;
  uri: string;
  contentType: string;
  sizeBytes: number;
  onProgress?: (ratio: number) => void;
}) {
  input.onProgress?.(0.02);

  const response = await fetch(input.uri);
  if (!response.ok && !input.uri.startsWith('blob:')) {
    throw new Error(`Could not read selected video (${response.status}).`);
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error('Selected IGPAT video is empty.');

  const bucket = supabase.storage.from('community-media');
  const { data, error } = await bucket.createSignedUploadUrl(input.path, { upsert: false });
  if (error) throw error;

  const signedUrl = String(data?.signedUrl ?? '').trim();
  if (!signedUrl) throw new Error('Could not prepare IGPAT upload URL.');

  input.onProgress?.(0.08);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl, true);
    xhr.setRequestHeader('content-type', input.contentType || blob.type || 'video/mp4');
    xhr.setRequestHeader('cache-control', '3600');
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || event.total <= 0) return;
      input.onProgress?.(0.08 + Math.min(0.91, (event.loaded / event.total) * 0.91));
    };

    xhr.onerror = () => reject(new Error('Network error while uploading IGPAT video.'));
    xhr.onabort = () => reject(new Error('IGPAT upload was cancelled.'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`IGPAT upload failed (${xhr.status})${xhr.responseText ? `: ${String(xhr.responseText).slice(0, 220)}` : ''}`));
    };

    xhr.send(blob);
  });

  input.onProgress?.(1);
}
