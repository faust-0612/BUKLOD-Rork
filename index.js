import 'expo-dev-client';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import * as SplashScreen from 'expo-splash-screen';
import './src/lib/buklodSentry';
import { setFirebaseListeners } from './src/utils/setFirebaseListeners';
import { setPushConfig } from './src/utils/setPushConfig';

if (Platform.OS !== 'web') {
  SplashScreen.setOptions({ duration: 0, fade: false });
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

if (Platform.OS !== 'web') {
  console.info('BUKLOD_RUNTIME', {
    updateId: Updates.updateId,
    runtimeVersion: Updates.runtimeVersion,
    channel: Updates.channel,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  });
}

setPushConfig();
setFirebaseListeners();

require('./src/lib/buklodLegacyRadioCleanup');
require('./src/lib/buklodOtaActivationReceipt');

import './buklod-router-root-entry';
