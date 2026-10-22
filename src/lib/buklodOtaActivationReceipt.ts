import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
if (Platform.OS !== 'web' && !Updates.isEmbeddedLaunch && Updates.updateId) {
  const receipt = 'BUKLOD_OTA_ACTIVE ' + JSON.stringify({ updateId: Updates.updateId, runtimeVersion: Updates.runtimeVersion, channel: Updates.channel, isEmbeddedLaunch: Updates.isEmbeddedLaunch });
  const nativeLog = (globalThis as any).nativeLoggingHook;
  if (typeof nativeLog === 'function') nativeLog(receipt, 2);
  else console.warn(receipt);
}
