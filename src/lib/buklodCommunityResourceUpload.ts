import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

export const BUKLOD_RESOURCE_MAX_BYTES =
  20 * 1024 * 1024;

export const BUKLOD_RESOURCE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type PickedResource = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

export function validateBuklodResource(
  resource: PickedResource,
): string | null {
  if (!resource.uri) return 'Resource file is missing.';
  if (!resource.name) return 'Resource filename is missing.';
  if (!BUKLOD_RESOURCE_MIME_TYPES.has(resource.mimeType)) {
    return 'Use PDF, DOCX, PPTX, XLSX, TXT, CSV, JPG, PNG, or WEBP.';
  }
  if (!resource.size || resource.size < 1) {
    return 'BUKLOD could not read this file size.';
  }
  if (resource.size > BUKLOD_RESOURCE_MAX_BYTES) {
    return 'Helpful files are limited to 20 MB.';
  }
  if (/\.(?:exe|dll|bat|cmd|com|msi|apk|aab|jar|js|sh|ps1)$/i.test(resource.name)) {
    return 'Executable or script files cannot be posted as Community Resources.';
  }
  return null;
}

async function readBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read the selected Resource.');
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the selected Resource.'));
      reader.onload = () => {
        const value = String(reader.result ?? '');
        resolve(value.includes(',') ? value.split(',')[1] ?? '' : value);
      };
      reader.readAsDataURL(blob);
    });
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function sha256BuklodResource(
  uri: string,
): Promise<string> {
  const base64 = await readBase64(uri);
  if (!base64) throw new Error('Could not fingerprint this Resource.');

  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    decode(base64),
  );

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeFilename(name: string) {
  return String(name ?? 'resource')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'resource';
}

export async function uploadBuklodResource({
  userId,
  uri,
  name,
  mimeType,
  sha256: suppliedSha256,
}: {
  userId: string;
  uri: string;
  name: string;
  mimeType: string;
  sha256?: string;
}): Promise<{
  storagePath: string;
  sha256: string;
}> {
  // The composer normally fingerprints once before checking for an existing
  // object. Reuse that digest instead of reading a large local file twice.
  const normalizedSupplied = String(suppliedSha256 ?? '').trim().toLowerCase();
  const sha256 = /^[a-f0-9]{64}$/.test(normalizedSupplied)
    ? normalizedSupplied
    : await sha256BuklodResource(uri);
  const path = `${userId}/resources/${sha256.slice(0, 16)}-${safeFilename(name)}`;
  const storage = supabase.storage.from('community-media');

  const { data: signed, error: signedError } =
    await storage.createSignedUploadUrl(path, { upsert: false });

  if (signedError) {
    const message = String(signedError.message ?? signedError);
    if (/already exists|duplicate/i.test(message)) {
      return { storagePath: path, sha256 };
    }
    throw signedError;
  }

  const signedUrl = String(signed?.signedUrl ?? '').trim();
  if (!signedUrl) throw new Error('Could not prepare the Resource upload.');

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read the selected Resource.');
    const blob = await response.blob();
    const upload = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'content-type': mimeType,
        'cache-control': '3600',
        'x-upsert': 'false',
      },
      body: blob,
    });
    if (!upload.ok) {
      throw new Error(`Resource upload failed (${upload.status}).`);
    }
  } else {
    const result = await FileSystem.uploadAsync(
      signedUrl,
      uri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'content-type': mimeType,
          'cache-control': '3600',
          'x-upsert': 'false',
        },
      },
    );
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Resource upload failed (${result.status}).`);
    }
  }

  return { storagePath: path, sha256 };
}
