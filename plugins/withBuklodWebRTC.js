const {
  withGradleProperties,
  withInfoPlist,
} = require('expo/config-plugins');

function withBuklodWebRTC(config) {
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
