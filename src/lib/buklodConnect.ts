import * as DocumentPicker from 'expo-document-picker';
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
/* PATCH_186B_PHOTO_EDITOR_CONNECT_PICKER */
export async function pickConnectPhoto(): Promise<ConnectPickedFile | null> {
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

  const mimeType =
    asset.mimeType ??
    (
      String(
        asset.fileName ??
        asset.uri
      )
        .toLowerCase()
        .endsWith('.png')
        ? 'image/png'
        : 'image/jpeg'
    );

  const extension =
    mimeType === 'image/png'
      ? 'png'
      : mimeType === 'image/webp'
      ? 'webp'
      : 'jpg';

  return {
    uri: asset.uri,
    name: safeName(
      asset.fileName ??
        `photo-${Date.now()}.${extension}`
    ),
    mimeType,
    size,
  };
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
}) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Please sign in again.');

  const nativeFile = new File(args.file.uri);
  const bytes = await nativeFile.bytes();

  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error('Maximum attachment size is 25 MB.');
  }

  const path =
    `${args.mode}/${args.containerId}/${data.user.id}/${Date.now()}-${safeName(args.file.name)}`;

  const upload = await supabase.storage
    .from('connect-files')
    .upload(path, bytes, {
      contentType: args.file.mimeType,
      upsert: false,
    });

  if (upload.error) throw upload.error;

  return {
    path,
    name: args.file.name,
    mimeType: args.file.mimeType,
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
