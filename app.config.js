const reportProjectId = (
  process.env.REPORT_EAS_PROJECT_ID ||
  process.env.EXPO_PUBLIC_REPORT_EAS_PROJECT_ID ||
  ''
).trim();
const reportGoogleServicesFile = (process.env.REPORT_GOOGLE_SERVICES_FILE || '').trim();

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || process.env.EXPO_PUBLIC_APP_ENV || 'production';
  const isStaging = variant === 'staging' || variant === 'preview' || variant === 'development';

  const appName = isStaging ? 'BUKLOD Report Staging' : 'BUKLOD Report';
  const packageId = isStaging
    ? 'org.mzbministry.buklod.report.staging'
    : 'org.mzbministry.buklod.report';

  return {
    ...config,
    name: appName,
    slug: 'buklod-report',
    version: '1.0.0',
    orientation: 'default',
    scheme: isStaging ? 'buklod-report-staging' : 'buklod-report',
    userInterfaceStyle: 'automatic',

    // Temporary shared artwork only. Native identity is already isolated; a
    // dedicated Report icon can replace this asset without changing package ID.
    icon: './assets/release/app-icon.png',
    assetBundlePatterns: ['assets/**'],

    ios: {
      supportsTablet: true,
      bundleIdentifier: packageId,
    },

    android: {
      package: packageId,
      versionCode: isStaging ? undefined : 1,
      // Never fall back to Main Firebase credentials. Configure a dedicated
      // Report Firebase app before enabling native FCM credentials.
      googleServicesFile: reportGoogleServicesFile || undefined,
      permissions: [
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.WAKE_LOCK',
      ],
      blockedPermissions: [
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.READ_EXTERNAL_STORAGE',
      ],
      adaptiveIcon: {
        foregroundImage: './assets/release/app-icon.png',
        backgroundColor: '#FFFFFF',
      },
    },

    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/release/app-icon.png',
    },

    plugins: [
      'expo-router',
      [
        'expo-notifications',
        { enableBackgroundRemoteNotifications: true },
      ],
      [
        'expo-secure-store',
        {
          configureAndroidBackup: true,
          faceIDPermission: 'Allow BUKLOD Report to use Face ID to protect your account.',
        },
      ],
      [
        'expo-local-authentication',
        { faceIDPermission: 'Allow BUKLOD Report to use Face ID for secure authentication.' },
      ],
      [
        'expo-web-browser',
        { experimentalLauncherActivity: true },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 24,
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
          ios: { deploymentTarget: '16.4' },
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#FFFFFF',
          image: './assets/release/splash-icon.png',
          imageWidth: 200,
          dark: {
            backgroundColor: '#0E4F20',
            image: './assets/release/splash-icon.png',
          },
        },
      ],
    ],

    extra: {
      ...config.extra,
      appEnvironment: process.env.EXPO_PUBLIC_APP_ENV || variant,
      appTarget: 'report',
      ...(reportProjectId ? { eas: { projectId: reportProjectId } } : {}),
    },

    updates: reportProjectId
      ? { url: `https://u.expo.dev/${reportProjectId}`, fallbackToCacheTimeout: 0 }
      : undefined,
    runtimeVersion: '1.0.0',
  };
};
