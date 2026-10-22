import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';

export type ConnectPickedFile = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const CONNECT_ALBUM_PREFIX = '[[BUKLOD_CONNECT_ALBUM:v1:';
const CONNECT_PHOTO_SELECTION_LIMIT = 12;
const CONNECT_PHOTO_MAX_WIDTH = 1920;
const CONNECT_PHOTO_JPEG_QUALITY = 0.82;

async function optimizeConnectImageFile(
  file: ConnectPickedFile
): Promise<ConnectPickedFile> {
  const mime =
    file.mimeType.toLowerCase();

  if (
    !mime.startsWith('image/') ||
    mime === 'image/gif'
  ) {
    return file;
  }

  const png =
    mime.includes('png');

  const context =
    ImageManipulator.ImageManipulator.manipulate(
      file.uri
    );

  context.resize({
    width: CONNECT_PHOTO_MAX_WIDTH,
    height: null,
  });

  const rendered =
    await context.renderAsync();

  const saved =
    await rendered.saveAsync({
      compress:
        png
          ? 1
          : CONNECT_PHOTO_JPEG_QUALITY,
      format:
        png
          ? ImageManipulator.SaveFormat.PNG
          : ImageManipulator.SaveFormat.JPEG,
    });

  const nativeFile =
    new File(saved.uri);

  const size =
    Number(
      nativeFile.size ?? 0
    );

  if (
    size > MAX_FILE_BYTES
  ) {
    throw new Error(
      'Maximum attachment size is 25 MB.'
    );
  }

  const baseName =
    file.name.replace(
      /\.[^.]+$/,
      ''
    ) || 'photo';

  return {
    uri: saved.uri,
    name: safeName(
      `${baseName}.${png ? 'png' : 'jpg'}`
    ),
    mimeType:
      png
        ? 'image/png'
        : 'image/jpeg',
    size,
  };
}

function safeName(value: string) {
  return (
    value
      .trim()
      .replace(/[^\p{L}\p{N}._()\- ]/gu, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 120) ||
    'attachment'
  );
}

export function formatConnectBytes(value?: number | null) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatConnectTimestamp(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function pickConnectFile(): Promise<ConnectPickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*',
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const file = new File(asset.uri);
  const size = Number(asset.size ?? file.size ?? 0);

  if (size > MAX_FILE_BYTES) {
    throw new Error('Maximum attachment size is 25 MB.');
  }

  return {
    uri: asset.uri,
    name: safeName(asset.name ?? 'attachment'),
    mimeType: asset.mimeType ?? 'application/octet-stream',
    size,
  };
}
function connectPhotoFromAsset(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}): ConnectPickedFile {
  const nativeFile = new File(asset.uri);
  const size = Number(asset.fileSize ?? nativeFile.size ?? 0);

  if (size > MAX_FILE_BYTES) {
    throw new Error('Maximum attachment size is 25 MB.');
  }

  const mimeType =
    asset.mimeType ??
    (String(asset.fileName ?? asset.uri).toLowerCase().endsWith('.png')
      ? 'image/png'
      : 'image/jpeg');

  const extension =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
      ? 'webp'
      : 'jpg';

  return {
    uri: asset.uri,
    name: safeName(asset.fileName ?? `photo-${Date.now()}.${extension}`),
    mimeType,
    size,
  };
}

export function isConnectStoragePath(path?: string | null) {
  const value = String(path ?? '').trim();
  if (!value) return false;
  return !/^(file:|content:|ph:|http:|https:|data:)/i.test(value);
}

export function parseConnectAlbumBody(body?: string | null): {
  paths: string[];
  caption: string;
} {
  const raw = String(body ?? '');
  const match = raw.match(
    /^\[\[BUKLOD_CONNECT_ALBUM:v1:([^\]]*)\]\](?:\n|(?=$))/
  );

  if (!match) {
    return { paths: [], caption: raw };
  }

  const paths = match[1]
    .split('|')
    .map(part => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .map(part => part.trim())
    .filter(Boolean);

  return {
    paths,
    caption: raw.slice(match[0].length),
  };
}

export function encodeConnectAlbumBody(
  paths: string[],
  caption: string
) {
  const trimmed = String(caption ?? '').trim();

  if (paths.length <= 1) {
    return trimmed;
  }

  const packed = paths.map(path => encodeURIComponent(path)).join('|');
  return `${CONNECT_ALBUM_PREFIX}${packed}]]${trimmed ? `\n${trimmed}` : ''}`;
}

export function getConnectMessageImagePaths(item: {
  body?: string | null;
  attachment_path?: string | null;
  attachment_mime?: string | null;
}) {
  const parsed = parseConnectAlbumBody(item.body);

  if (parsed.paths.length) {
    return parsed.paths;
  }

  if (
    item.attachment_path &&
    String(item.attachment_mime ?? '').startsWith('image/')
  ) {
    return [item.attachment_path];
  }

  return [];
}

export function connectAlbumInboxPreview(body?: string | null) {
  const raw = String(body ?? '');

  if (!/\[\[BUKLOD_CONNECT_ALBUM:/.test(raw)) {
    return null;
  }

  const parsed = parseConnectAlbumBody(raw);
  const caption = parsed.caption.trim();

  if (
    caption &&
    !/\[\[BUKLOD_CONNECT_ALBUM:/.test(caption)
  ) {
    return caption;
  }

  if (parsed.paths.length > 1) {
    return `Photo · ${parsed.paths.length}`;
  }

  return 'Photo';
}

/* PATCH_186B_PHOTO_EDITOR_CONNECT_PICKER */
export async function pickConnectPhotos(): Promise<ConnectPickedFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: CONNECT_PHOTO_SELECTION_LIMIT,
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) {
    return [];
  }

  const picked: ConnectPickedFile[] = [];
  let skippedOversize = 0;

  for (const asset of result.assets) {
    try {
      const raw =
        connectPhotoFromAsset(asset);

      picked.push(
        await optimizeConnectImageFile(
          raw
        )
      );
    } catch {
      skippedOversize += 1;
    }
  }

  if (!picked.length && skippedOversize) {
    throw new Error('Maximum attachment size is 25 MB.');
  }

  return picked;
}

export async function pickConnectPhoto(): Promise<ConnectPickedFile | null> {
  const photos = await pickConnectPhotos();
  return photos[0] ?? null;
}

export async function pickConnectGif(): Promise<ConnectPickedFile | null> {
  const result =
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 1,
    });

  if (
    result.canceled ||
    !result.assets?.[0]
  ) {
    return null;
  }

  const asset =
    result.assets[0];

  const nativeFile =
    new File(asset.uri);

  const size =
    Number(
      asset.fileSize ??
      nativeFile.size ??
      0
    );

  if (size > MAX_FILE_BYTES) {
    throw new Error(
      'Maximum attachment size is 25 MB.'
    );
  }

  const rawName =
    String(
      asset.fileName ??
      asset.uri ??
      ''
    );

  const rawMime =
    String(
      asset.mimeType ??
      ''
    ).toLowerCase();

  const isGif =
    rawMime === 'image/gif' ||
    rawName
      .toLowerCase()
      .endsWith('.gif');

  if (!isGif) {
    throw new Error(
      'Choose an animated GIF file.'
    );
  }

  return {
    uri: asset.uri,
    name: safeName(
      asset.fileName ??
        `reaction-${Date.now()}.gif`
    ),
    mimeType: 'image/gif',
    size,
  };
}

export async function uploadConnectFile(args: {
  mode: 'direct' | 'scope';
  containerId: string;
  file: ConnectPickedFile;
  uniqueKey?: string;
}) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Please sign in again.');

  const prepared =
    await optimizeConnectImageFile(
      args.file
    );

  const nativeFile = new File(prepared.uri);
  const bytes = await nativeFile.bytes();

  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error('Maximum attachment size is 25 MB.');
  }

  const stamp =
    args.uniqueKey ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const path =
    `${args.mode}/${args.containerId}/${data.user.id}/${stamp}-${safeName(prepared.name)}`;

  const upload = await supabase.storage
    .from('connect-files')
    .upload(path, bytes, {
      contentType: prepared.mimeType,
      upsert: false,
    });

  if (upload.error) throw upload.error;

  return {
    path,
    name: prepared.name,
    mimeType: prepared.mimeType,
    size: bytes.byteLength,
  };
}

export async function openConnectAttachment(path: string) {
  const { data, error } = await supabase.storage
    .from('connect-files')
    .createSignedUrl(path, 900);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Attachment is unavailable.');
  await Linking.openURL(data.signedUrl);
}
