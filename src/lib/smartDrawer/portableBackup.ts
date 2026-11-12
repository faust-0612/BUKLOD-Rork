import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { persistSmartDrawerAsset } from './assets';
import { getSmartDrawerItem, querySmartDrawerItems } from './localStore';
import { commitSmartDrawerItem } from './service';
import type { SmartDrawerItem, SmartDrawerAsset } from './types';

const FORMAT = 'buklod.drawer.portable.v1';
const ENCRYPTED_FORMAT = 'buklod.drawer.encrypted.v1';

export async function generateSmartDrawerRecoveryKey(): Promise<string> {
  const key = await Crypto.AESEncryptionKey.generate();
  return await key.encoded('hex');
}

function validateRecoveryKey(recoveryKey: string): string {
  const trimmed = recoveryKey.replace(/\s+/g, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(trimmed)) {
    throw new Error('Invalid recovery key. Enter the full 64-character backup key.');
  }
  return trimmed;
}

async function encryptBackup(envelope: Envelope, recoveryKey: string) {
  const key = await Crypto.AESEncryptionKey.import(validateRecoveryKey(recoveryKey), 'hex');
  const bytes = new TextEncoder().encode(JSON.stringify(envelope));
  const sealed = await Crypto.aesEncryptAsync(bytes, key);
  const content = await sealed.combined('base64') as string;
  return JSON.stringify({ format: ENCRYPTED_FORMAT, content });
}

async function decryptBackup(raw: string, recoveryKey: string): Promise<Envelope> {
  let encrypted: { format?: string; content?: string };
  try { encrypted = JSON.parse(raw); }
  catch { throw new Error('Invalid encrypted backup format.'); }
  if (encrypted?.format !== ENCRYPTED_FORMAT || typeof encrypted.content !== 'string' ||
      !/^[a-zA-Z0-9+/]+={0,2}$/.test(encrypted.content)) {
    throw new Error('Select an encrypted BUKLOD Drawer backup.');
  }
  try {
    const key = await Crypto.AESEncryptionKey.import(validateRecoveryKey(recoveryKey), 'hex');
    const sealed = Crypto.AESSealedData.fromCombined(encrypted.content);
    const bytes = await Crypto.aesDecryptAsync(sealed, key, { output: 'bytes' });
    return JSON.parse(new TextDecoder().decode(bytes as Uint8Array)) as Envelope;
  } catch {
    throw new Error('Cannot decrypt backup. Check the recovery key and file integrity.');
  }
}
const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;
const MAX_ENCRYPTED_BYTES = 28 * 1024 * 1024;
const MAX_ITEMS = 10000;
const BATCH_SIZE = 100;

type PortableAsset = {
  kind: SmartDrawerAsset['kind'];
  name: string | null;
  mimeType: string | null;
  contentBase64: string;
};
type PortableItem = {
  note: Pick<SmartDrawerItem,
    'id' | 'type' | 'title' | 'body' | 'extractedText' | 'location' |
    'dueAt' | 'eventAt' | 'status' | 'keepOnTop' | 'reminderMuted' |
    'listItems' | 'createdAt' | 'updatedAt'>;
  assets: PortableAsset[];
};
type Payload = {
  format: typeof FORMAT;
  createdAt: string;
  sourceAccountId: string;
  items: PortableItem[];
};
type Envelope = { format: typeof FORMAT; sha256: string; payload: Payload };

function requireMobile() {
  if (Platform.OS === 'web' || !FileSystem.cacheDirectory) {
    throw new Error('Portable backup and restore is currently supported on the BUKLOD mobile app.');
  }
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 90);
}

function assertPayload(value: unknown): asserts value is Payload {
  if (!value || typeof value !== 'object') throw new Error('Invalid Drawer backup.');
  const p = value as Partial<Payload>;
  if (p.format !== FORMAT || typeof p.sourceAccountId !== 'string' ||
      !Array.isArray(p.items) || p.items.length > MAX_ITEMS) {
    throw new Error('Unsupported or invalid Drawer backup.');
  }
  const allowedTypes = new Set([
    'SHOPPING_LIST', 'CHECKLIST', 'TASK', 'DUE_TASK', 'EVENT', 'APPOINTMENT',
    'PROGRAM', 'WRITING', 'POEM', 'IDEA', 'REFERENCE', 'DOCUMENT', 'RECEIPT',
    'NOTICE', 'CONTACT_REFERENCE', 'QUICK_NOTE', 'OTHER',
  ]);
  const allowedStatuses = new Set(['ACTIVE', 'DONE', 'ARCHIVED', 'RECENTLY_REMOVED']);
  const ids = new Set<string>();
  for (const row of p.items) {
    if (!row || typeof row !== 'object' || !row.note ||
        typeof row.note.id !== 'string' || row.note.id.length > 128 ||
        typeof row.note.title !== 'string' || row.note.title.length > 500 ||
        !allowedTypes.has(row.note.type) || !allowedStatuses.has(row.note.status) ||
        !Array.isArray(row.note.listItems) || row.note.listItems.length > 100 ||
        !Array.isArray(row.assets) || row.assets.length > 30 || ids.has(row.note.id)) {
      throw new Error('Backup contains an invalid or duplicate note.');
    }
    ids.add(row.note.id);
    for (const asset of row.assets) {
      if (!['SCAN', 'PHOTO', 'IMPORT', 'FILE'].includes(asset.kind) ||
          (asset.name !== null && (typeof asset.name !== 'string' || asset.name.length > 255)) ||
          typeof asset.contentBase64 !== 'string' ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.contentBase64) ||
          asset.contentBase64.length > MAX_ARCHIVE_BYTES * 2) {
        throw new Error('Invalid attachment content in backup.');
      }
    }
  }
}

/**
 * User-initiated device-to-personal-cloud encrypted backup. BUKLOD servers
 * never receive the archive or recovery key.
 * An oversized backup fails closed rather than silently dropping attachments.
 */
export async function shareSmartDrawerBackup(userId: string, recoveryKey: string) {
  requireMobile();
  validateRecoveryKey(recoveryKey);
  if (!userId) throw new Error('Sign in to back up your Drawer.');
  const items: PortableItem[] = [];
  let estimatedBytes = 0;
  const views = ['for-you', 'archive', 'recently-removed'];
  const seen = new Set<string>();
  for (const view of views) {
    for (let offset = 0; offset < MAX_ITEMS; offset += BATCH_SIZE) {
      const batch = await querySmartDrawerItems(userId, { view, limit: BATCH_SIZE, offset });
      for (const item of batch) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        const assets: PortableAsset[] = [];
        for (const asset of item.assets) {
          if (!asset.uri.startsWith('file://')) {
            throw new Error('Some attachments are not stored persistently on this device. Import them locally before backup.');
          }
          const info = await FileSystem.getInfoAsync(asset.uri);
          if (!info.exists) throw new Error('Missing original attachment: ' + (asset.originalName ?? item.title));
          const size = ('size' in info ? info.size : 0) ?? 0;
          estimatedBytes += Math.ceil(size * 4 / 3);
          if (estimatedBytes > MAX_ARCHIVE_BYTES) {
            throw new Error('Backup exceeds the 20 MB portable archive limit. No incomplete backup was shared.');
          }
          const contentBase64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          assets.push({
            kind: asset.kind,
            name: asset.originalName ?? null,
            mimeType: asset.mimeType ?? null,
            contentBase64,
          });
        }
        const { id, type, title, body, extractedText, location, dueAt, eventAt, status,
          keepOnTop, reminderMuted, listItems, createdAt, updatedAt } = item;
        items.push({
          note: { id, type, title, body, extractedText, location, dueAt, eventAt, status,
            keepOnTop, reminderMuted, listItems, createdAt, updatedAt },
          assets,
        });
        if (items.length > MAX_ITEMS) throw new Error('Backup exceeds maximum supported notes.');
      }
      if (batch.length < BATCH_SIZE) break;
    }
  }
  const payload: Payload = { format: FORMAT, createdAt: new Date().toISOString(), sourceAccountId: userId, items };
  const raw = JSON.stringify(payload);
  if (raw.length > MAX_ARCHIVE_BYTES) throw new Error('Backup exceeds 20 MB. No incomplete archive was shared.');
  const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  const envelope: Envelope = { format: FORMAT, sha256, payload };
  const uri = FileSystem.cacheDirectory + 'buklod-drawer-' + Date.now() + '.buklodbackup';
  const encrypted = await encryptBackup(envelope, recoveryKey);
  if (encrypted.length > MAX_ENCRYPTED_BYTES) throw new Error('Encrypted backup exceeds 28 MB. Nothing was shared.');
  await FileSystem.writeAsStringAsync(uri, encrypted, { encoding: FileSystem.EncodingType.UTF8 });
  if (!await Sharing.isAvailableAsync()) throw new Error('No compatible app is available to save your backup.');
  await Sharing.shareAsync(uri, { mimeType: 'application/octet-stream', dialogTitle: 'Save encrypted backup to your personal cloud' });
  return { count: items.length, uri };
}

/**
 * Explicit restore from a user-selected JSON backup; never silently overwrite
 * existing notes. Foreign-account archives are rejected to prevent accidental
 * cross-account disclosure. Restore is additive and idempotent by item ID.
 */
export async function restoreSmartDrawerBackup(userId: string, recoveryKey: string) {
  requireMobile();
  validateRecoveryKey(recoveryKey);
  if (!userId) throw new Error('Sign in to restore your Drawer.');
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets[0]) return { restored: 0, skipped: 0, canceled: true };
  const uri = picked.assets[0].uri;
  if ((picked.assets[0].size ?? 0) > MAX_ENCRYPTED_BYTES) {
    throw new Error('Encrypted backup file exceeds the 28 MB import limit.');
  }
  const raw = await FileSystem.readAsStringAsync(uri);
  if (raw.length > MAX_ENCRYPTED_BYTES) throw new Error('Backup is too large.');
  const envelope = await decryptBackup(raw, recoveryKey);
  if (envelope?.format !== FORMAT || typeof envelope.sha256 !== 'string') {
    throw new Error('This is not a supported BUKLOD Drawer backup.');
  }
  assertPayload(envelope.payload);
  if (envelope.payload.sourceAccountId !== userId) {
    throw new Error('This backup belongs to a different BUKLOD account. Sign in to the original account.');
  }
  const checksum = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(envelope.payload),
  );
  if (checksum !== envelope.sha256) throw new Error('Backup integrity check failed. No notes were restored.');
  let restored = 0, skipped = 0;
  for (const row of envelope.payload.items) {
    if (await getSmartDrawerItem(userId, row.note.id)) { skipped++; continue; }
    const assets: SmartDrawerAsset[] = [];
    try {
      for (const asset of row.assets) {
        const temp = FileSystem.cacheDirectory + Crypto.randomUUID() + '-' + safeName(asset.name ?? 'attachment.bin');
        await FileSystem.writeAsStringAsync(temp, asset.contentBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        try {
          assets.push(await persistSmartDrawerAsset({
            userId, uri: temp, kind: asset.kind, mimeType: asset.mimeType,
            originalName: asset.name,
          }));
        } finally {
          await FileSystem.deleteAsync(temp, { idempotent: true }).catch(() => undefined);
        }
      }
      await commitSmartDrawerItem(userId, {
        ...row.note, assets, reminderIds: [], syncState: 'LOCAL_ONLY',
      });
      restored++;
    } catch (error) {
      throw new Error('Restore stopped after ' + restored + ' notes. Existing notes were preserved. ' +
        (error instanceof Error ? error.message : 'Unknown file error'));
    }
  }
  return { restored, skipped, canceled: false };
}
