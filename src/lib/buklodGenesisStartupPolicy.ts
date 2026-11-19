import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** BUKLOD Genesis startup is embargoed from production before Season 2 release. */
export function isBuklodGenesisStartupPreview(): boolean {
  const env = String(Constants.expoConfig?.extra?.appEnvironment ?? '').toLowerCase();
  const target = String(Constants.expoConfig?.extra?.appTarget ?? 'main').toLowerCase();
  return Platform.OS === 'android' &&
    target === 'main' &&
    (env === 'staging' || env === 'preview' || env === 'development');
}
