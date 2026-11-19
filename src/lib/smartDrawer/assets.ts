import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { SmartDrawerAsset } from './types';

/** Approved PDF and image formats only; SAF content:// URIs can have no suffix. */
const MAX_DRAWER_FILE_BYTES = 15 * 1024 * 1024;
const EXT: Record<string, string> = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png',
  'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic',
};
const VALID_EXTENSIONS = new Set(['.pdf','.jpg','.jpeg','.png','.webp','.gif','.heic']);
function safeExtension(name: string | null | undefined): string | null {
  const leaf = (name ?? '').split(/[\\/]/).pop() ?? '';
  const match = leaf.match(/\.([a-z0-9]{2,5})$/i);
  const ext = match ? '.' + match[1].toLowerCase() : '';
  return VALID_EXTENSIONS.has(ext) ? ext : null;
}
export function isSupportedSmartDrawerImport(mime?: string | null, name?: string | null): boolean {
  const type = (mime ?? '').toLowerCase().trim();
  return type ? Object.prototype.hasOwnProperty.call(EXT,type) : !!safeExtension(name);
}
function extensionFromAsset(uri: string, mime?: string | null, name?: string | null): string {
  return EXT[(mime ?? '').toLowerCase().trim()] ?? safeExtension(name) ??
    safeExtension(uri.split('?')[0]) ?? '.jpg';
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
  if (input.kind === 'IMPORT' && !isSupportedSmartDrawerImport(input.mimeType, input.originalName ?? input.uri)) {
    throw new Error('Only PDF and supported images may be imported.');
  }
  if (Platform.OS !== 'web') {
    const info = await FileSystem.getInfoAsync(input.uri, { size: true }).catch(() => null);
    if (info?.exists && 'size' in info &&
        typeof info.size === 'number' && info.size > MAX_DRAWER_FILE_BYTES) {
      throw new Error('The file exceeds the 15 MB Drawer limit.');
    }
  }

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

  const extension = extensionFromAsset(input.uri, input.mimeType, input.originalName);
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
