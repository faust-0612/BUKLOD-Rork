import { setFirebaseListeners } from './src/utils/setFirebaseListeners';
import { setPushConfig } from './src/utils/setPushConfig';

setPushConfig();
setFirebaseListeners();

/* BUKLOD_PTT_BOOTSTRAP_R2 */
require('./src/ptt/buklodPttBootstrap');

import 'expo-router/entry';
