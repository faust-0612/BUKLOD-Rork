/**
 * Opt-in personal Drive backups, only in separately installed Native QA Android.
 * No Google token or recovery key is persisted. Google identity is verified on
 * every action against a BUKLOD-user-specific binding held in SecureStore.
 * Only files with matching SHA-256 BUKLOD owner binding may be updated/restored.
 */
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { requireNativeModule } from 'expo-modules-core';
import {
  buildEncryptedSmartDrawerBackup,
  restoreSmartDrawerBackupFromEncryptedText,
} from './portableBackup';
import {
  listSmartDrawerDriveBackups,
  uploadEncryptedSmartDrawerBackup,
  downloadEncryptedSmartDrawerBackup,
} from './googleDriveTransport';

const IS_QA = Platform.OS === 'android' && process.env.EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1';
type NativeDrive = {
  authorizeDrive: () => Promise<{ accessToken: string }>;
  clearDriveToken: () => Promise<boolean>;
};
type UserInfo = { sub?: string; email?: string; email_verified?: boolean };
type Binding = { googleSubject: string; googleEmail: string; userIdHash: string };

function ensureQa(userId: string) {
  if (!IS_QA) throw new Error('Direct Google Drive sync is only available in the separate BUKLOD Native QA APK.');
  if (!userId || userId.length > 150) throw new Error('Sign in to your BUKLOD account before using Drive.');
}
function nativeDrive(): NativeDrive {
  return requireNativeModule<NativeDrive>('BuklodNativeDrive');
}
const activeAccountOperations = new Set<string>();
async function withAccountLock<T>(userId: string, action: () => Promise<T>): Promise<T> {
  if (activeAccountOperations.has(userId)) {
    throw new Error('Another Google Drive operation for this account is in progress.');
  }
  activeAccountOperations.add(userId);
  try { return await action(); }
  finally { activeAccountOperations.delete(userId); }
}
async function keys(userId: string) {
  const idHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, userId);
  return { idHash, storeKey: 'buklod.qa.drive.' + idHash.slice(0, 40) };
}
async function getBinding(userId: string): Promise<Binding | null> {
  ensureQa(userId);
  const { idHash, storeKey } = await keys(userId);
  const raw = await SecureStore.getItemAsync(storeKey);
  if (!raw) return null;
  let value: Partial<Binding>;
  try { value = JSON.parse(raw); } catch { throw new Error('Drive connection metadata is invalid; disconnect and reconnect.'); }
  if (value.userIdHash !== idHash || !/^[0-9]+$/.test(String(value.googleSubject ?? '')) ||
    typeof value.googleEmail !== 'string') {
    throw new Error('Drive account binding changed; disconnect and reconnect.');
  }
  return value as Binding;
}
async function requestGoogleIdentity(): Promise<{ subject: string; email: string; accessToken: string }> {
  const response = await nativeDrive().authorizeDrive();
  const token = response?.accessToken;
  if (!token || typeof token !== 'string') throw new Error('Google Drive did not grant an access token.');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 20000);
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + token },
      signal: abort.signal,
    });
    if (!r.ok) throw new Error('Google account identity could not be verified.');
    const json = await r.json() as UserInfo;
    if (!/^[0-9]+$/.test(String(json.sub ?? '')) ||
      !json.email || json.email_verified !== true) {
      throw new Error('Google did not confirm an identifiable, verified Drive account.');
    }
    return { subject: json.sub!, email: json.email, accessToken: token };
  } finally {
    clearTimeout(timer);
  }
}
async function userToken(userId: string): Promise<string> {
  const binding = await getBinding(userId);
  if (!binding) throw new Error('Connect your personal Google Drive first.');
  const info = await requestGoogleIdentity();
  if (binding.googleSubject !== info.subject || binding.googleEmail.toLowerCase() !== info.email.toLowerCase()) {
    throw new Error('A different Google account is selected. No backup or restore was performed.');
  }
  // Tokens live in this call only, never in AsyncStorage, SecureStore or backend.
  return info.accessToken;
}
export async function connectNativeDrawerDrive(userId: string) {
  ensureQa(userId);
  const previous = await getBinding(userId);
  const info = await requestGoogleIdentity();
  if (previous && previous.googleSubject !== info.subject) {
    throw new Error('This BUKLOD account is linked to another Google account. Disconnect first.');
  }
  const { idHash, storeKey } = await keys(userId);
  const binding: Binding = { userIdHash: idHash, googleSubject: info.subject, googleEmail: info.email };
  await SecureStore.setItemAsync(storeKey, JSON.stringify(binding));
  return { email: binding.googleEmail };
}
export async function getNativeDrawerDriveConnection(userId: string) {
  const binding = await getBinding(userId);
  return binding ? { email: binding.googleEmail } : null;
}
export async function disconnectNativeDrawerDrive(userId: string) {
  ensureQa(userId);
  return withAccountLock(userId, async () => {
    const { storeKey } = await keys(userId);
    await SecureStore.deleteItemAsync(storeKey);
    // Local disconnect, not global Google account consent revocation.
    await nativeDrive().clearDriveToken();
  });
}
async function ownBackups(userId: string) {
  const { idHash } = await keys(userId);
  const token = await userToken(userId);
  const getToken = async () => token;
  const files = await listSmartDrawerDriveBackups(getToken);
  // Important when two BUKLOD accounts share one Google Drive.
  const own = files.filter(f => f.appProperties?.buklodDrawer === 'encrypted-v1' &&
    f.appProperties?.buklodOwnerHash === idHash);
  own.sort((a,b) => String(b.modifiedTime ?? '').localeCompare(String(a.modifiedTime ?? '')));
  return { token, getToken, own, idHash };
}
export async function backupNativeDrawerToDrive(userId: string, recoveryKey: string) {
  ensureQa(userId);
  if (!/^[a-fA-F0-9]{64}$/.test(recoveryKey.trim())) throw new Error('Provide the 64-character recovery key.');
  return withAccountLock(userId, async () => {
    // Serialize before Drive API calls; a failed upload leaves local data intact.
    const { count, encrypted } = await buildEncryptedSmartDrawerBackup(userId, recoveryKey);
    const { getToken, own, idHash } = await ownBackups(userId);
    const file = await uploadEncryptedSmartDrawerBackup(getToken, encrypted, own[0]?.id, fetch, idHash);
    return { count, fileId: file.id };
  });
}
export async function restoreNativeDrawerFromDrive(userId: string, recoveryKey: string) {
  ensureQa(userId);
  if (!/^[a-fA-F0-9]{64}$/.test(recoveryKey.trim())) throw new Error('Provide the original 64-character recovery key.');
  return withAccountLock(userId, async () => {
    const { getToken, own } = await ownBackups(userId);
    if (!own[0]?.id) throw new Error('No encrypted backup for this BUKLOD account was found in this Drive.');
    const encrypted = await downloadEncryptedSmartDrawerBackup(getToken, own[0].id);
    // Decryption validates original BUKLOD user ID, SHA-256, duplicate IDs.
    return restoreSmartDrawerBackupFromEncryptedText(userId, recoveryKey, encrypted);
  });
}
