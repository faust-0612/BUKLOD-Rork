import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { decode, encode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

const TUS_VERSION = '1.0.0';
const TUS_CHUNK_BYTES = 6 * 1024 * 1024;
const DIRECT_UPLOAD_BYTES = 6 * 1024 * 1024;
const SAF_BASE64_LIMIT = 24 * 1024 * 1024;
const TRANSFER_PREFIX = 'buklod-classroom-transfer-v1:';

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

type PersistedTransfer = {
  uploadUrl: string;
  bucket: string;
  path: string;
  uri: string;
  size: number;
  offset: number;
  updatedAt: string;
};

function safeBase64Metadata(value: string) {
  const bytes = new TextEncoder().encode(value);
  return encode(bytes.buffer as ArrayBuffer);
}

function transferKey(bucket: string, path: string) {
  return `${TRANSFER_PREFIX}${bucket}:${path}`;
}

function resumableEndpoint() {
  const raw = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  if (!raw) throw new Error('Supabase URL is unavailable.');
  try {
    const url = new URL(raw);
    const hostParts = url.hostname.split('.');
    const projectRef = hostParts[0];
    if (projectRef && url.hostname.endsWith('.supabase.co')) {
      return `${url.protocol}//${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
    }
  } catch {
    // Fall back to the project gateway URL below.
  }
  return `${raw.replace(/\/$/, '')}/storage/v1/upload/resumable`;
}

async function fileSize(uri: string, supplied?: number | null) {
  if (Number.isFinite(supplied) && Number(supplied) >= 0) return Number(supplied);
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists) throw new Error('Selected file is no longer available.');
  return Number((info as any).size ?? 0);
}

async function readChunk(uri: string, position: number, length: number) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  return decode(base64);
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again before uploading.');
  return token;
}

async function directUpload(input: ClassroomUploadInput, total: number): Promise<ClassroomUploadResult> {
  if (input.signal?.aborted) throw new Error('Upload cancelled.');
  const body = await readChunk(input.uri, 0, total);
  if (input.signal?.aborted) throw new Error('Upload cancelled.');
  const { error } = await supabase.storage.from(input.bucket).upload(input.path, body, {
    contentType: input.mimeType ?? 'application/octet-stream',
    cacheControl: input.cacheControl ?? '3600',
    upsert: false,
  });
  if (error) throw error;
  input.onProgress?.({ sent: total, total, percent: 100 });
  return { bucket: input.bucket, path: input.path, size: total, resumable: false };
}

async function createTusUpload(input: ClassroomUploadInput, total: number, token: string) {
  const metadata = [
    ['bucketName', input.bucket],
    ['objectName', input.path],
    ['contentType', input.mimeType ?? 'application/octet-stream'],
    ['cacheControl', input.cacheControl ?? '3600'],
  ]
    .map(([key, value]) => `${key} ${safeBase64Metadata(value)}`)
    .join(',');

  const response = await fetch(resumableEndpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Tus-Resumable': TUS_VERSION,
      'Upload-Length': String(total),
      'Upload-Metadata': metadata,
      'x-upsert': 'false',
    },
    signal: input.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Could not start resumable upload (${response.status})${text ? `: ${text.slice(0, 180)}` : ''}`);
  }
  const location = response.headers.get('location');
  if (!location) throw new Error('Resumable upload did not return an upload location.');
  return location.startsWith('http') ? location : new URL(location, resumableEndpoint()).toString();
}

async function discoverOffset(uploadUrl: string, token: string, signal?: AbortSignal) {
  const response = await fetch(uploadUrl, {
    method: 'HEAD',
    headers: { Authorization: `Bearer ${token}`, 'Tus-Resumable': TUS_VERSION },
    signal,
  });
  if (!response.ok) return null;
  const raw = response.headers.get('upload-offset');
  const offset = raw == null ? NaN : Number(raw);
  return Number.isFinite(offset) && offset >= 0 ? offset : null;
}

async function resumableUpload(input: ClassroomUploadInput, total: number): Promise<ClassroomUploadResult> {
  const token = await getAccessToken();
  const key = transferKey(input.bucket, input.path);
  const existingRaw = await AsyncStorage.getItem(key);
  let existing: PersistedTransfer | null = null;
  try {
    existing = existingRaw ? (JSON.parse(existingRaw) as PersistedTransfer) : null;
  } catch {
    existing = null;
  }

  let uploadUrl = existing?.uri === input.uri && existing?.size === total ? existing.uploadUrl : '';
  let offset = 0;
  if (uploadUrl) {
    const serverOffset = await discoverOffset(uploadUrl, token, input.signal);
    if (serverOffset == null || serverOffset > total) uploadUrl = '';
    else offset = serverOffset;
  }
  if (!uploadUrl) {
    uploadUrl = await createTusUpload(input, total, token);
    offset = 0;
  }

  while (offset < total) {
    if (input.signal?.aborted) throw new Error('Upload paused/cancelled. You can retry the same file to resume safely.');
    const length = Math.min(TUS_CHUNK_BYTES, total - offset);
    const chunk = await readChunk(input.uri, offset, length);
    const response = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Tus-Resumable': TUS_VERSION,
        'Upload-Offset': String(offset),
        'Content-Type': 'application/offset+octet-stream',
      },
      body: chunk,
      signal: input.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      await AsyncStorage.setItem(key, JSON.stringify({ uploadUrl, bucket: input.bucket, path: input.path, uri: input.uri, size: total, offset, updatedAt: new Date().toISOString() } satisfies PersistedTransfer));
      throw new Error(`Upload paused at ${Math.round((offset / total) * 100)}% (${response.status})${text ? `: ${text.slice(0, 160)}` : ''}. Retry to resume.`);
    }
    const next = Number(response.headers.get('upload-offset'));
    offset = Number.isFinite(next) && next > offset ? next : offset + length;
    const state: PersistedTransfer = { uploadUrl, bucket: input.bucket, path: input.path, uri: input.uri, size: total, offset, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(key, JSON.stringify(state));
    input.onProgress?.({ sent: offset, total, percent: Math.min(100, Math.round((offset / total) * 100)) });
  }

  await AsyncStorage.removeItem(key);
  return { bucket: input.bucket, path: input.path, size: total, resumable: true };
}

/**
 * Binary/private upload with 6 MB TUS chunks for larger files. It persists the
 * upload URL/offset, so a temporary network/app interruption can safely resume
 * without creating a second Classroom object path.
 */
export async function uploadClassroomObject(input: ClassroomUploadInput): Promise<ClassroomUploadResult> {
  const total = await fileSize(input.uri, input.size);
  if (total <= 0) throw new Error('The selected file is empty.');
  input.onProgress?.({ sent: 0, total, percent: 0 });
  return total <= DIRECT_UPLOAD_BYTES ? directUpload(input, total) : resumableUpload(input, total);
}

export async function createClassroomSignedUrl(bucket: string, path: string, expiresSeconds = 600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresSeconds);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not authorize this file.');
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
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.open(signedUrl, '_blank', 'noopener,noreferrer');
    return { mode: 'browser' as const };
  }

  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'classroom-file';
  const localUri = `${FileSystem.cacheDirectory}buklod-${Date.now()}-${safeName}`;
  const downloaded = await FileSystem.downloadAsync(signedUrl, localUri);
  const mime = input.mimeType ?? '';

  if (mime.startsWith('image/') || mime.startsWith('video/')) {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (permission.granted) {
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
      return { mode: 'media-library' as const, uri: downloaded.uri };
    }
  }

  if (Platform.OS === 'android' && Number(input.fileSize ?? 0) <= SAF_BASE64_LIMIT) {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permission.granted) {
      const destination = await FileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        safeName,
        mime || 'application/octet-stream',
      );
      const payload = await FileSystem.readAsStringAsync(downloaded.uri, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.writeAsStringAsync(destination, payload, { encoding: FileSystem.EncodingType.Base64 });
      return { mode: 'android-saf' as const, uri: destination };
    }
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(downloaded.uri, { mimeType: mime || undefined, dialogTitle: 'Save or share Classroom file' });
    return { mode: 'share-sheet' as const, uri: downloaded.uri };
  }

  throw new Error('This device does not expose a supported save destination.');
}
