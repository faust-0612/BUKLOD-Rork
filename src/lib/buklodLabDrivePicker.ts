/**
 * Scoped Android Google Drive integration using the native Storage Access
 * Framework already provided by expo-document-picker.
 * User chooses a document; no OAuth refresh token, app-wide Drive scope,
 * Drive API billing or backend proxy is involved.
 * Drive is available when its Android DocumentsProvider is installed.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export type KingdomLabDriveImage = {
  uri: string;
  name: string;
  mimeType: 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
};
const MAX_SIZE = 25 * 1024 * 1024;
const ACCEPTED = new Set(['image/gif','image/jpeg','image/png','image/webp']);
export function canUseKingdomLabDrivePicker(): boolean {
  return Platform.OS === 'android' &&
    process.env.EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1';
}
export async function pickKingdomLabDriveImage(): Promise<KingdomLabDriveImage | null> {
  if (!canUseKingdomLabDrivePicker()) return null;
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['image/gif', 'image/jpeg', 'image/png', 'image/webp'],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (picked.canceled || picked.assets.length !== 1) return null;
  const asset = picked.assets[0];
  if (!asset.uri?.startsWith('file:')) {
    throw new Error('Google Drive file could not be imported into private app cache.');
  }
  const mime = String(asset.mimeType || '').toLowerCase().trim();
  if (!ACCEPTED.has(mime)) throw new Error('Please select a GIF, PNG, JPEG or WebP image.');
  const size = Number(asset.size ?? new File(asset.uri).size);
  if (!Number.isFinite(size) || size < 1 || size > MAX_SIZE) {
    throw new Error('Selected Drive image must be between 1 byte and 25 MB.');
  }
  return {
    uri: asset.uri,
    name: String(asset.name || 'drive-image').slice(0, 120),
    mimeType: mime as KingdomLabDriveImage['mimeType'],
    size,
  };
}
