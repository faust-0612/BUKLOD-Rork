import { setFirebaseListeners } from './src/utils/setFirebaseListeners';
import { setPushConfig } from './src/utils/setPushConfig';

setPushConfig();
setFirebaseListeners();

import 'expo-router/entry';
