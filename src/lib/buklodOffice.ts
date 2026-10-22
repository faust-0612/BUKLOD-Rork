import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as ImageManipulator from 'expo-image-manipulator';
import { Linking, Share } from 'react-native';
import { supabase } from '@/lib/supabase';

export type OfficeAccess = 'NONE' | 'VIEWER' | 'EDITOR' | 'ADMIN';

export type OfficePickedFile = {
  uri: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  bytes: Uint8Array;
  checksumSha256: string;
  autoFolderKey: string;
  optimized: boolean;
};

const MB = 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * MB;
const MAX_PRESENTATION_BYTES = 30 * MB;
const MAX_AUDIO_BYTES = 50 * MB;
const MAX_IMAGE_BYTES = 8 * MB;

export function formatOfficeBytes(value?: number | null) {
  const bytes = Math.max(0, Number(value ?? 0) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2)} GB`;
}

export function formatOfficeTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function safeOfficeName(value: string) {
  return (
    value
      .trim()
      .replace(/[^\p{L}\p{N}._()\- ]/gu, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 180) ||
    'file'
  );
}

function ext(name: string) {
  const match = /\.([a-z0-9]{1,10})$/i.exec(name);
  return match?.[1]?.toLowerCase() ?? '';
}

export function autoOfficeFolderKey(name: string, mimeType: string) {
  const n = name.toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  const extension = ext(name);

  if (/(financial|finance|budget|receipt|voucher|expense|income|cash|payroll|ledger)/i.test(n)) {
    return 'financial';
  }
  if (/(minutes|meeting minutes|agenda)/i.test(n)) {
    return 'minutes';
  }
  if (/(certificate|certification|permit|license|accreditation)/i.test(n)) {
    return 'certificates';
  }
  if (/(report|accomplishment|narrative|weekly report|monthly report|annual report)/i.test(n)) {
    return 'reports';
  }
  if (/(form|application|request form|template|questionnaire)/i.test(n)) {
    return 'forms';
  }
  if (mime.startsWith('image/')) return 'photos';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'videos';
  if (mime === 'application/pdf' || extension === 'pdf') return 'pdfs';
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(extension)
  ) {
    return 'spreadsheets';
  }
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ['ppt', 'pptx', 'odp'].includes(extension)
  ) {
    return 'presentations';
  }
  if (
    mime.startsWith('text/') ||
    mime.includes('word') ||
    mime.includes('document') ||
    ['doc', 'docx', 'txt', 'rtf', 'odt', 'md'].includes(extension)
  ) {
    return 'documents';
  }
  return 'other';
}

function bytesToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function checksum(bytes: Uint8Array) {
  /*
   * PATCH_168D_R1_CRYPTO_ARRAYBUFFER
   (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
   * Expo Crypto.digest expects BufferSource.
   * TypeScript can infer incoming Uint8Array.buffer as
   * ArrayBufferLike (ArrayBuffer | SharedArrayBuffer).
   * Copy into a guaranteed ArrayBuffer before hashing.
   */
  const input = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(input).set(bytes);

  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );

  return bytesToHex(digest);
}

async function optimizeImage(uri: string, originalName: string, mimeType: string) {
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  context.resize({ width: 1920, height: null });
  const rendered = await context.renderAsync();

  const png = mimeType.toLowerCase().includes('png');
  const saved = await rendered.saveAsync({
    compress: png ? 1 : 0.78,
    format: png
      ? ImageManipulator.SaveFormat.PNG
      : ImageManipulator.SaveFormat.JPEG,
  });

  const file = new File(saved.uri);
  const bytes = await file.bytes();
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';

  return {
    uri: saved.uri,
    name: safeOfficeName(`${base}.${png ? 'png' : 'jpg'}`),
    mimeType: png ? 'image/png' : 'image/jpeg',
    bytes,
  };
}

function maxBytesFor(name: string, mimeType: string) {
  const key = autoOfficeFolderKey(name, mimeType);
  if (key === 'audio') return MAX_AUDIO_BYTES;
  if (key === 'presentations') return MAX_PRESENTATION_BYTES;
  if (key === 'photos') return MAX_IMAGE_BYTES;
  return MAX_DOCUMENT_BYTES;
}

export async function pickOfficeFile(): Promise<OfficePickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*',
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const assetMime = asset.mimeType || 'application/octet-stream';
  if (autoOfficeFolderKey(asset.name || 'file', assetMime) === 'videos') {
    throw new Error(
      'Video files use the dedicated BUKLOD media flow so Office storage and bandwidth stay controlled.'
    );
  }
  const originalName = safeOfficeName(asset.name ?? 'file');
  let mimeType = asset.mimeType ?? 'application/octet-stream';

  if (mimeType.toLowerCase().startsWith('video/')) {
    throw new Error(
      'Large video storage is intentionally disabled in Organizer Office. Use the dedicated BUKLOD video/media flow instead.'
    );
  }

  let uri = asset.uri;
  let name = originalName;
  let bytes = await new File(uri).bytes();
  let optimized = false;

  if (mimeType.toLowerCase().startsWith('image/') && bytes.byteLength > 700 * 1024) {
    const image = await optimizeImage(uri, originalName, mimeType);
    uri = image.uri;
    name = image.name;
    mimeType = image.mimeType;
    bytes = image.bytes;
    optimized = true;
  }

  const limit = maxBytesFor(name, mimeType);
  if (bytes.byteLength > limit) {
    throw new Error(
      `This file is ${formatOfficeBytes(bytes.byteLength)}. The allowed size for this file type is ${formatOfficeBytes(limit)}.`
    );
  }

  return {
    uri,
    name,
    originalName,
    mimeType,
    size: bytes.byteLength,
    bytes,
    checksumSha256: await checksum(bytes),
    autoFolderKey: autoOfficeFolderKey(name, mimeType),
    optimized,
  };
}

async function signedOfficeUrl(path: string) {
  const { data, error } = await supabase.storage
    .from('buklod-office')
    .createSignedUrl(path, 60 * 60);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('File is unavailable.');

  return data.signedUrl;
}

export async function cacheOfficeFile(path: string, name: string) {
  const signedUrl = await signedOfficeUrl(path);
  const directory = new Directory(Paths.cache, 'buklod-office');
  directory.create({
    idempotent: true,
    intermediates: true,
  });

  const fileKey = path.split('/')[1] || 'office';
  const destination = new File(
    directory,
    safeOfficeName(`${fileKey}-${name}`)
  );

  const output = await File.downloadFileAsync(
    signedUrl,
    destination,
    { idempotent: true }
  );

  return output.uri;
}

export async function openOfficeFile(path: string) {
  await Linking.openURL(await signedOfficeUrl(path));
}

export async function shareOfficeFile(path: string, name: string) {
  const signedUrl = await signedOfficeUrl(path);

  await Share.share({
    title: name,
    message: `${name}\n${signedUrl}`,
  });
}

export function officeFileIcon(name: string, mimeType: string) {
  const key = autoOfficeFolderKey(name, mimeType);
  switch (key) {
    case 'photos':
      return 'file-image-outline';
    case 'audio':
      return 'file-music-outline';
    case 'videos':
      return 'file-video-outline';
    case 'pdfs':
      return 'file-pdf-box';
    case 'spreadsheets':
      return 'file-excel-outline';
    case 'presentations':
      return 'file-powerpoint-outline';
    case 'reports':
      return 'file-chart-outline';
    case 'forms':
      return 'file-document-edit-outline';
    case 'financial':
      return 'file-table-outline';
    default:
      return 'file-document-outline';
  }
}
