import { decode as decodeBase64, encode as encodeBase64 } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Supabase TUS currently requires 6 MiB chunks. */
export const BUKLOD_TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

export function supabaseProjectRef(supabaseUrl: string): string | null {
  const match = String(supabaseUrl ?? '').match(
    /^https:\/\/([a-z0-9-]+)\.(?:storage\.)?supabase\.co/i
  );
  return match?.[1] ?? null;
}

export function toDirectStorageUrl(url: string): string {
  const value = String(url ?? '').trim();
  if (!value) {
    return value;
  }

  return value.replace(
    /^(https:\/\/[a-z0-9-]+)\.supabase\.co(?=\/|$)/i,
    '$1.storage.supabase.co'
  );
}

export function resumableUploadEndpoint(supabaseUrl: string): string | null {
  const ref = supabaseProjectRef(supabaseUrl);
  if (!ref) {
    const origin = String(supabaseUrl ?? '').replace(/\/$/, '');
    return origin ? `${origin}/storage/v1/upload/resumable` : null;
  }

  return `https://${ref}.storage.supabase.co/storage/v1/upload/resumable`;
}

export function shouldUseResumableUpload(sizeBytes: number): boolean {
  return Number(sizeBytes) >= BUKLOD_TUS_CHUNK_SIZE_BYTES;
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return encodeBase64(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
}

export function encodeTusMetadata(fields: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([, value]) => value != null && String(value).length > 0)
    .map(([key, value]) => `${key} ${utf8ToBase64(String(value))}`)
    .join(',');
}

async function readWebBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Could not read selected media (${response.status}).`);
  }
  return response.blob();
}

async function readFileSlice(
  uri: string,
  position: number,
  length: number,
  webBlob?: Blob | null
): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const blob = webBlob ?? (await readWebBlob(uri));
    return blob.slice(position, position + length).arrayBuffer();
  }

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  } as any);

  return decodeBase64(base64);
}

type TusAuth = {
  accessToken: string;
  apiKey: string;
};

async function readTusAuth(): Promise<TusAuth> {
  const { data } = await supabase.auth.getSession();
  const accessToken = String(data?.session?.access_token ?? '').trim();
  const apiKey = String(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
  ).trim();

  if (!accessToken) {
    throw new Error('Please sign in again before uploading this video.');
  }

  if (!apiKey) {
    throw new Error('Storage is not configured for this install.');
  }

  return { accessToken, apiKey };
}

function headerValue(
  headers: Headers | Record<string, string> | undefined,
  name: string
): string {
  if (!headers) {
    return '';
  }

  if (typeof (headers as Headers).get === 'function') {
    return String((headers as Headers).get(name) ?? '').trim();
  }

  const record = headers as Record<string, string>;
  const match = Object.keys(record).find(
    key => key.toLowerCase() === name.toLowerCase()
  );
  return String(match ? record[match] : '').trim();
}

function resolveLocation(location: string, endpoint: string): string {
  const value = String(location ?? '').trim();
  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return toDirectStorageUrl(value);
  }

  try {
    return toDirectStorageUrl(new URL(value, endpoint).toString());
  } catch {
    return value;
  }
}

async function tusFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const timeoutMs = Number(init.timeoutMs ?? 120000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error: any) {
    if (controller.signal.aborted || /abort/i.test(String(error?.name ?? ''))) {
      const timeout = new Error('timeout');
      (timeout as any).aborted = true;
      throw timeout;
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function uploadCommunityFileResumableTus({
  path,
  uri,
  contentType,
  sizeBytes,
  onProgress,
}: {
  path: string;
  uri: string;
  contentType: string;
  sizeBytes: number;
  onProgress?: (progress: {
    sentBytes: number;
    totalBytes: number;
    ratio: number;
  }) => void;
}): Promise<void> {
  const endpoint = resumableUploadEndpoint(
    String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')
  );

  if (!endpoint) {
    throw new Error('Storage is not configured for resumable uploads.');
  }

  let webBlob: Blob | null = null;
  let totalSize = Math.max(0, Number(sizeBytes ?? 0));

  if (Platform.OS === 'web') {
    webBlob = await readWebBlob(uri);
    if (!totalSize) {
      totalSize = Number(webBlob.size ?? 0);
    }
  }

  if (!totalSize) {
    throw new Error('Could not determine the selected media size.');
  }

  const auth = await readTusAuth();
  const metadata = encodeTusMetadata({
    bucketName: 'community-media',
    objectName: path,
    contentType,
    cacheControl: '3600',
  });

  const createResponse = await tusFetch(endpoint, {
    method: 'POST',
    timeoutMs: 60000,
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(totalSize),
      'Upload-Metadata': metadata,
      authorization: `Bearer ${auth.accessToken}`,
      apikey: auth.apiKey,
      'x-upsert': 'false',
    },
  });

  if (createResponse.status < 200 || createResponse.status >= 300) {
    const body = await createResponse.text().catch(() => '');
    const error = new Error(body || `TUS create failed (${createResponse.status})`);
    (error as any).status = createResponse.status;
    (error as any).body = body;
    throw error;
  }

  const uploadUrl = resolveLocation(
    headerValue(createResponse.headers, 'location'),
    endpoint
  );

  if (!uploadUrl) {
    throw new Error('Could not start a resumable video upload.');
  }

  let offset = 0;
  const offsetHeader = headerValue(createResponse.headers, 'upload-offset');
  if (offsetHeader) {
    offset = Math.max(0, Number(offsetHeader) || 0);
  }

  const report = (sent: number) => {
    onProgress?.({
      sentBytes: sent,
      totalBytes: totalSize,
      ratio: totalSize > 0 ? Math.min(1, sent / totalSize) : 0,
    });
  };

  report(offset);

  while (offset < totalSize) {
    const chunkLength = Math.min(
      BUKLOD_TUS_CHUNK_SIZE_BYTES,
      totalSize - offset
    );
    const chunk = await readFileSlice(
      uri,
      offset,
      chunkLength,
      webBlob
    );

    const patchResponse = await tusFetch(uploadUrl, {
      method: 'PATCH',
      timeoutMs: 180000,
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': String(offset),
        'Content-Type': 'application/offset+octet-stream',
        authorization: `Bearer ${auth.accessToken}`,
        apikey: auth.apiKey,
        'x-upsert': 'false',
      },
      body: chunk,
    });

    if (patchResponse.status === 409 || patchResponse.status === 412) {
      const headResponse = await tusFetch(uploadUrl, {
        method: 'HEAD',
        timeoutMs: 30000,
        headers: {
          'Tus-Resumable': '1.0.0',
          authorization: `Bearer ${auth.accessToken}`,
          apikey: auth.apiKey,
        },
      });
      offset = Math.max(
        0,
        Number(headerValue(headResponse.headers, 'upload-offset')) || 0
      );
      report(offset);
      continue;
    }

    if (patchResponse.status < 200 || patchResponse.status >= 300) {
      const body = await patchResponse.text().catch(() => '');
      const error = new Error(body || `TUS patch failed (${patchResponse.status})`);
      (error as any).status = patchResponse.status;
      (error as any).body = body;
      throw error;
    }

    const nextOffset = Number(
      headerValue(patchResponse.headers, 'upload-offset')
    );
    offset =
      Number.isFinite(nextOffset) && nextOffset > offset
        ? nextOffset
        : offset + chunkLength;
    report(offset);
  }
}
