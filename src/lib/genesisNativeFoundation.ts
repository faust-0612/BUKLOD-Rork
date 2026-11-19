import { Platform } from 'react-native';

/** Native capabilities are in the FIRST separate Genesis APK only. JS OTA cannot install them. */
function requireGenesisNative(): {
  openGodotWorld: () => Promise<boolean>;
  transcodeVideo: (uri: string) => Promise<{uri:string;bytes:number;mimeType:string}>;
  cancelTranscode: () => Promise<boolean>;
  getPlayUpdateState: () => Promise<{available:boolean;immediateAllowed:boolean;availableVersionCode?:number}>;
  startImmediatePlayUpdate: () => Promise<boolean>;
  authorizeDrive: (chooseAccount:boolean) => Promise<{accessToken:string;scope:string}>;
  clearDriveToken: () => Promise<boolean>;
} {
  if (Platform.OS !== 'android' || process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true' ||
    process.env.EXPO_PUBLIC_APP_ENV !== 'staging') {
    throw new Error('Genesis native SDK is not installed in this app runtime.');
  }
  const { requireNativeModule } = require('expo-modules-core');
  return requireNativeModule('BuklodGenesisNativeFoundation');
}

export async function enterGenesisGodotKingdom(): Promise<boolean> {
  return requireGenesisNative().openGodotWorld();
}

/** Optional, user-initiated local processing. Original video must be retained on failure. */
export async function transcodeGenesisVideo(uri: string) {
  if (!/^(content:\/\/|file:\/\/)/.test(uri)) throw Error('Select a local video first.');
  return requireGenesisNative().transcodeVideo(uri);
}
export async function cancelGenesisVideoTranscode() {
  return requireGenesisNative().cancelTranscode();
}
export async function checkGenesisPlayUpdate() {
  return requireGenesisNative().getPlayUpdateState();
}
/** Invoke only after an actual Play release is available to the device. */
export async function requestGenesisPlayImmediateUpdate() {
  const sdk = requireGenesisNative();
  const state = await sdk.getPlayUpdateState();
  if (!state.available || !state.immediateAllowed) return false;
  return sdk.startImmediatePlayUpdate();
}

/**
 * Returns a short-lived token only after explicit Android OAuth consent.
 * No token is persisted; caller MUST verify Google's stable userinfo.sub against
 * the current authenticated BUKLOD user before any upload/sync.
 */
export async function authorizeGenesisDriveForUser(
  buklodUserId: string,
  verifyBinding: (googleSubject: string, buklodUserId: string) => Promise<boolean>,
  chooseAccount = false,
): Promise<{googleSubject:string;accessToken:string}> {
  if (!buklodUserId || typeof verifyBinding !== 'function') {
    throw Error('A verified active BUKLOD account binding is required for Google Drive.');
  }
  const sdk = requireGenesisNative();
  const granted = await sdk.authorizeDrive(chooseAccount);
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + granted.accessToken },
    });
    if (!response.ok) throw Error('Google identity verification failed.');
    const identity = await response.json() as {sub?:string};
    if (!identity.sub || !/^[0-9]{6,32}$/.test(identity.sub) ||
      !(await verifyBinding(identity.sub,buklodUserId))) {
      throw Error('Drive Google identity is not authorized for this BUKLOD account.');
    }
    return {googleSubject:identity.sub,accessToken:granted.accessToken};
  } catch (err) {
    await sdk.clearDriveToken().catch(() => undefined);
    throw err;
  }
}
export async function disconnectGenesisDrive() {
  return requireGenesisNative().clearDriveToken();
}
