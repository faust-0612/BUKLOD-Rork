import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { SmartDrawerAsset } from './types';

function extensionFromUri(uri: string) {
  const clean = uri.split('?')[0] ?? uri;
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

function safeUserId(userId: string) {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function persistSmartDrawerAsset(input: {
  userId: string;
  uri: string;
  kind: SmartDrawerAsset['kind'];
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  originalName?: string | null;
}): Promise<SmartDrawerAsset> {
  const id = Crypto.randomUUID();

  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    return {
      id,
      uri: input.uri,
      kind: input.kind,
      mimeType: input.mimeType ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      originalName: input.originalName ?? null,
      cloudPath: null,
    };
  }

  const root =
    `${FileSystem.documentDirectory}smart-drawer/${safeUserId(input.userId)}/`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });

  const extension = extensionFromUri(input.uri);
  const destination = `${root}${id}${extension}`;

  if (input.uri !== destination) {
    await FileSystem.copyAsync({
      from: input.uri,
      to: destination,
    });
  }

  return {
    id,
    uri: destination,
    kind: input.kind,
    mimeType: input.mimeType ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    originalName: input.originalName ?? null,
    cloudPath: null,
  };
}

export async function deleteSmartDrawerAsset(asset: SmartDrawerAsset) {
  if (Platform.OS === 'web') return;
  if (!asset.uri.startsWith('file://')) return;
  await FileSystem.deleteAsync(asset.uri, {
    idempotent: true,
  }).catch(() => undefined);
}
