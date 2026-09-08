const googleMapsAndroidApiKey =
  (
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    ''
  ).trim();
module.exports = ({ config }) => {
  /* BUKLOD_CLASSROOM_APP_TARGET_R4 — standalone identity without mutating Main defaults */
  const appTarget = (process.env.BUKLOD_APP_TARGET || 'main').trim().toLowerCase();
  const isClassroom = appTarget === 'classroom';
  const classroomIdentityRequired = process.env.CLASSROOM_IDENTITY_REQUIRED === '1';

  if (classroomIdentityRequired && !isClassroom) {
    throw new Error('BUKLOD Classroom identity guard: BUKLOD_APP_TARGET must be classroom.');
  }

  const classroomProjectId = '14100ed1-7f25-4551-9627-09d280498241';
  const classroomGoogleServicesFile = (process.env.CLASSROOM_GOOGLE_SERVICES_FILE || '').trim();
  const projectId = isClassroom
    ? classroomProjectId
    : (process.env.EAS_PROJECT_ID ||
       process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
       '23dad7d0-389a-406e-8dec-08965dab85d8');

  const variant =
    process.env.APP_VARIANT ||
    process.env.EXPO_PUBLIC_APP_ENV ||
    'production';

  const isStaging =
    variant === 'staging' ||
    variant === 'preview' ||
    variant === 'development';

  const appName = isClassroom
    ? (isStaging ? 'BUKLOD Classroom Staging' : 'BUKLOD Classroom')
    : (isStaging ? 'BUKLOD Staging' : 'BUKLOD');

  const packageId = isClassroom
    ? 'org.mzbministry.buklod.classroom'
    : (isStaging ? 'org.mzbministry.buklod.staging' : 'org.mzbministry.buklod');

  const scheme = isClassroom
    ? 'buklod-classroom'
    : (isStaging ? 'buklod-staging' : 'buklod');

  return {
    ...config,

    name: appName,
    slug: isClassroom ? 'buklod-classroom' : 'buklod',
    version: '1.3.0',

    orientation: 'default',
    scheme,

    userInterfaceStyle: 'automatic',

    icon: isClassroom ? './assets/classroom/app-icon.png' : './assets/release/app-icon.png',

    assetBundlePatterns: [
      'assets/**',
    ],


    ios: {
      supportsTablet: true,

      bundleIdentifier: packageId,

      infoPlist: {
        NSCameraUsageDescription:
          'Allow BUKLOD to use your camera for photos, Reels, QR check-in, and video calls.',

        NSMicrophoneUsageDescription:
          'Allow BUKLOD to use your microphone for voice messages, recordings, videos, and calls.',

        NSLocalNetworkUsageDescription:
          'Allow BUKLOD to use network connections for voice and video communication.',
      },
    },


    android: {
      package: packageId,

      versionCode: isStaging ? undefined : 20,

      // Never silently reuse Main Firebase credentials for the standalone Classroom package.
      googleServicesFile: isClassroom
        ? (classroomGoogleServicesFile || undefined)
        : (isStaging ? './google-services.staging.json' : './google-services.production.json'),

      permissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.WAKE_LOCK',
        'android.permission.CHANGE_NETWORK_STATE',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_CONNECT',
      ],

      blockedPermissions: [
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.READ_EXTERNAL_STORAGE',
      ],

      adaptiveIcon: {
        foregroundImage: isClassroom
          ? './assets/classroom/adaptive-icon.png'
          : './assets/release/app-icon.png',

        backgroundColor:
          '#FFFFFF',
      },
    },


    web: {
      bundler: 'metro',

      favicon: isClassroom
        ? './assets/classroom/favicon.png'
        : './assets/release/app-icon.png',
    },


    plugins: [
      'expo-background-task',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId:
            isStaging
              ? 'ca-app-pub-3940256099942544~3347511713'
              : (
                  process.env.ADMOB_ANDROID_APP_ID ||
                  ''
                ).trim(),

          delayAppMeasurementInit: true,
          optimizeInitialization: true,
          optimizeAdLoading: true,
        },
      ],


      [


        'react-native-maps',


        {


          androidGoogleMapsApiKey: googleMapsAndroidApiKey,


        },


      ],
      [
        '@stream-io/video-react-native-sdk',
        {
        enableScreenshare: true,
          androidKeepCallAlive: true,
          addNoiseCancellation: true,
        

          ringing: true,

          androidMessagingServiceBaseClass: 'io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService',
},
      ],
      '@react-native-firebase/app',
      '@react-native-firebase/messaging',

      './plugins/withBuklodWebRTC.js',


      'expo-router',



      [
        'expo-notifications',
        {
          enableBackgroundRemoteNotifications: true,
        },
      ],


      'expo-status-bar',

      /* BUKLOD_SHARE_TARGET_187A */
      [
        'expo-sharing',
        {
          android: {
            enabled: true,
            singleShareMimeTypes: [
              'image/*',
              'video/*',
              'text/*',
            ],
            multipleShareMimeTypes: [
              'image/*',
            ],
          },
        },
      ],


      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow BUKLOD to choose photos and videos for posts, messages, profiles, and Reels.',

          cameraPermission:
            'Allow BUKLOD to use your camera for photos, Reels, and video calls.',

          microphonePermission:
            'Allow BUKLOD to use your microphone when recording videos.',
        },
      ],


      [
        'expo-media-library',
        {
          savePhotosPermission:
            'Allow BUKLOD to save photos to your device gallery.',

          granularPermissions: [],
        },
      ],


      [
        'expo-camera',
        {
          cameraPermission:
            'Allow BUKLOD to use your camera for photos, Reels, QR check-in, and video calls.',

          microphonePermission:
            'Allow BUKLOD to use your microphone for recorded video and calls.',

          recordAudioAndroid: true,

          barcodeScannerEnabled: true,
        },
      ],


      [
        'expo-video',
        {
          supportsBackgroundPlayback: true,

          supportsPictureInPicture: true,
        },
      ],


      [
        'expo-audio',
        {
          microphonePermission: false,
          recordAudioAndroid: false,
          enableBackgroundPlayback: true,
          enableBackgroundRecording: false,
        },
      ],


      [
        'expo-secure-store',
        {
          configureAndroidBackup: true,

          faceIDPermission:
            'Allow BUKLOD to use Face ID to protect your account.',
        },
      ],


      [
        'expo-local-authentication',
        {
          faceIDPermission:
            'Allow BUKLOD to use Face ID for secure authentication.',
        },
      ],


      [
        'expo-web-browser',
        {
          experimentalLauncherActivity: true,
        },
      ],


      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow BUKLOD to use your location for church check-ins and location-based ministry features.',

          isIosBackgroundLocationEnabled: false,

          isAndroidBackgroundLocationEnabled: false,

          isAndroidForegroundServiceEnabled: false,
        },
      ],


      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 24,
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            extraProguardRules: '-keep class com.google.android.gms.internal.consent_sdk.** { *; }',
          },

          ios: {
            deploymentTarget: '16.4',
          },
        },
      ],


      [
        'expo-splash-screen',
        {
          backgroundColor:
            '#FFFFFF',

          image: isClassroom
            ? './assets/classroom/splash-icon.png'
            : './assets/release/splash-icon.png',

          imageWidth: 200,

          dark: {
            backgroundColor:
              '#0E4F20',

            image: isClassroom
              ? './assets/classroom/splash-icon.png'
              : './assets/release/splash-icon.png',
          },
        },
      ],
    ],


    extra: {
      ...config.extra,

      appEnvironment:
        process.env.EXPO_PUBLIC_APP_ENV ||
        variant,

      appTarget: isClassroom ? 'classroom' : 'main',

      eas:
        projectId
          ? { projectId }
          : config.extra?.eas,
    },


    updates:
      projectId
        ? {
            url:
              `https://u.expo.dev/${projectId}`,

            fallbackToCacheTimeout: 0,
          }
        : undefined,


    runtimeVersion: isClassroom ? '1.3.0' : (isStaging ? '1.3.2' : '1.3.0'),
  };
};

