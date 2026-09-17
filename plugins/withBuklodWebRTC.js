const {
  AndroidConfig,
  withAndroidManifest,
  withGradleProperties,
  withInfoPlist,
} = require('expo/config-plugins');

function withBuklodWebRTC(config) {
  /* BUKLOD_ANDROID_GOOGLE_MAPS_MANIFEST_R1
   * The Play Store 1.3.0 binary crashed when react-native-maps mounted because
   * com.google.android.geo.API_KEY was absent from AndroidManifest.xml.
   * Keep the react-native-maps plugin as the primary config path, then harden
   * Main production builds here by explicitly writing the same metadata item.
   */
  const googleMapsAndroidApiKey = (
    process.env.GOOGLE_MAPS_ANDROID_API_KEY || ''
  ).trim();
  const isBuklodMainProduction =
    config.android?.package === 'org.mzbministry.buklod';

  if (isBuklodMainProduction && googleMapsAndroidApiKey) {
    config = withAndroidManifest(config, (config) => {
      const mainApplication =
        AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        'com.google.android.geo.API_KEY',
        googleMapsAndroidApiKey,
      );

      return config;
    });
  }

  config = withGradleProperties(config, (config) => {
    const key =
      'android.enableDexingArtifactTransform.desugaring';

    // Remove obsolete Android Gradle Plugin property if present.
    config.modResults =
      config.modResults.filter(
        (item) =>
          !(
            item.type === 'property' &&
            item.key === key
          )
      );

    return config;
  });

  config = withInfoPlist(config, (config) => {
    config.modResults.NSCameraUsageDescription =
      config.modResults.NSCameraUsageDescription ||
      'Allow BUKLOD to use your camera for video calls and Reels.';

    config.modResults.NSMicrophoneUsageDescription =
      config.modResults.NSMicrophoneUsageDescription ||
      'Allow BUKLOD to use your microphone for voice and video calls.';

    return config;
  });

  return config;
}

module.exports = withBuklodWebRTC;
