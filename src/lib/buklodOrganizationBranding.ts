import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

export type BuklodOrganizationBrandAsset =
  | 'logo'
  | 'cover';

function extensionFor(
  fileName: string,
  mimeType: string,
) {
  const ext = fileName
    .split('?')[0]
    .split('.')
    .pop()
    ?.toLowerCase();

  if (ext && ['jpg','jpeg','png','webp'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadOrganizationBranding(input: {
  scopeId: string;
  kind: BuklodOrganizationBrandAsset;
  uri: string;
  fileName: string;
  mimeType: string;
}) {
  const scopeId = input.scopeId.trim();
  if (!scopeId) {
    throw new Error('Organization context is missing.');
  }

  const extension = extensionFor(
    input.fileName,
    input.mimeType,
  );
  const path =
    `${scopeId}/${input.kind}-${Date.now()}.${extension}`;

  let body: ArrayBuffer;
  if (Platform.OS === 'web') {
    const response = await fetch(input.uri);
    if (!response.ok) {
      throw new Error(
        'BUKLOD could not read the selected image.',
      );
    }
    body = await response.arrayBuffer();
  } else {
    const base64 =
      await FileSystem.readAsStringAsync(
        input.uri,
        {
          encoding:
            FileSystem.EncodingType.Base64,
        },
      );
    body = decode(base64);
  }

  if (body.byteLength > 5 * 1024 * 1024) {
    throw new Error(
      'Organization branding images must be 5 MB or smaller.',
    );
  }

  const { error } = await supabase.storage
    .from('organization-branding')
    .upload(path, body, {
      contentType: input.mimeType,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('organization-branding')
    .getPublicUrl(path);

  const publicUrl = String(
    data.publicUrl ?? '',
  ).trim();

  if (!publicUrl) {
    throw new Error(
      'Organization image upload was not confirmed.',
    );
  }

  return {
    path,
    publicUrl,
  };
}
