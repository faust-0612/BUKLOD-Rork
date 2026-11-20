/* BUKLOD_GENESIS_RENDER_QA_OFFLINE_ENTRY_R1
 * A distinct, non-OTA visual QA app: never bootstrap production auth,
 * notifications, Firebase listeners, PTT, router or remote data.
 */
if (process.env.EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA === 'true' &&
    process.env.EXPO_PUBLIC_APP_ENV === 'staging' &&
    process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW === 'true') {
  const { registerRootComponent } = require('expo');
  const GenesisRenderQaEntry = require('./src/features/season2/genesis/GenesisRenderQaEntry').default;
  registerRootComponent(GenesisRenderQaEntry);
} else {
  const { setFirebaseListeners } = require('./src/utils/setFirebaseListeners');
  const { setPushConfig } = require('./src/utils/setPushConfig');
  setPushConfig();
  setFirebaseListeners();
  /* BUKLOD_PTT_BOOTSTRAP_R2 */
  require('./src/ptt/buklodPttBootstrap');
  require('expo-router/entry');
}
