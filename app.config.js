const googleMapsAndroidApiKey =
  (
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    ''
  ).trim();
module.exports = ({ config }) => {
  /* BUKLOD_CLASSROOM_APP_TARGET_R4 — standalone identity without mutating Main defaults */
  const appTarget = (process.env.BUKLOD_APP_TARGET || 'main').trim().toLowerCase();
  const isClassroom = appTarget === 'classroom';
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
  // The Season 2 Genesis preview is a distinct signed native runtime.
  // Production ignores the flag until a separately authorized Play Store release.
  const genesisNativePreview =
    !isClassroom &&
    isStaging &&
    process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW === 'true';
  // SOS R3 custom native notification sound requires a separate signed APK.
  // Old 2.0.0 staging builds must retain their already-published runtime.
  const sosNativePreview = genesisNativePreview &&
    process.env.EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3 === 'true';
  // New Godot main-pack changes the native APK and must not reuse older OTA runtime.
  const godotArenaNativePreview = genesisNativePreview &&
    process.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED === 'true';
  // One additional compatible native runtime holds Arena and all three
  // guarded Genesis world scene entrypoints. Never changes production.
  const unifiedGodotWorldsPreview = godotArenaNativePreview &&
    process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS === 'true';
  const libraryArenaNativePreview = unifiedGodotWorldsPreview &&
    process.env.EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE === 'true';
  // Native Godot Android changes cannot ship on the old 2.0.4 runtime via OTA.
  const godotLaunchRecoveryPreview = libraryArenaNativePreview &&
    process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205 === 'true';

  const webOutput = (process.env.BUKLOD_WEB_OUTPUT || 'single').trim();

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
    version: isClassroom ? '1.3.4' : (genesisNativePreview ? '2.0.0' : '1.3.6'),
    ...(sosNativePreview ? { version: '2.0.1' } : {}),
    ...(godotArenaNativePreview ? { version: '2.0.2' } : {}),
    ...(unifiedGodotWorldsPreview ? { version: '2.0.3' } : {}),
    ...(libraryArenaNativePreview ? { version: '2.0.4' } : {}),
    ...(godotLaunchRecoveryPreview ? { version: '2.0.5' } : {}),

    orientation: 'default',
    scheme,

    userInterfaceStyle: 'automatic',

    icon: isClassroom
      ? './assets/classroom/app-icon.png'
      : (genesisNativePreview ? './assets/season2/genesis/genesis-green-b-transparent.png' : (isStaging ? './assets/release/buklod-main-canonical.png' : './assets/release/app-icon.png')),

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

      versionCode: isStaging ? (godotLaunchRecoveryPreview ? 17 : undefined) : (isClassroom ? 28 : 30),

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
        'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
        'android.permission.READ_EXTERNAL_STORAGE',
      ],

      adaptiveIcon: {
        foregroundImage: isClassroom
          ? './assets/classroom/adaptive-icon.png'
          : (genesisNativePreview ? './assets/season2/genesis/genesis-green-b-transparent.png' : (isStaging ? './assets/release/buklod-main-canonical.png' : './assets/release/app-icon.png')),

        backgroundColor:
          genesisNativePreview ? '#050A19' : '#FFFFFF',
      },
    },


    web: {
      bundler: 'metro',
      output: webOutput,

      favicon: isClassroom
        ? './assets/classroom/favicon.png'
        : './assets/release/buklod-main-canonical.png',
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
      ...(godotArenaNativePreview ? ['./plugins/withBuklodGodotArenaPack.js'] : []),
      './plugins/withBuklodPttHardwareFoundation.js',


      'expo-router',



      [
        'expo-notifications',
        {
          enableBackgroundRemoteNotifications: true,
          sounds: ['./assets/sounds/buklod_alert.wav'],
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
            genesisNativePreview ? '#050A19' : '#FFFFFF',

          image: isClassroom
            ? './assets/classroom/splash-icon.png'
            : (genesisNativePreview ? './assets/season2/genesis/genesis-green-b-transparent.png' : './assets/release/splash-icon.png'),

          imageWidth: genesisNativePreview ? 220 : 200,

          dark: {
            backgroundColor:
              genesisNativePreview ? '#050A19' : '#0E4F20',

            image: isClassroom
              ? './assets/classroom/splash-icon.png'
              : (genesisNativePreview ? './assets/season2/genesis/genesis-green-b-transparent.png' : './assets/release/splash-icon.png'),
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


    // Main BUKLOD V30 (versionCode 30) removes unused connectedDevice foreground service
    // permission from the manifest, without adding or changing the native JS module ABI.
    // Keep Expo runtime 1.3.2 for existing V28/V29 production OTA compatibility. Classroom has its independent runtime.
    runtimeVersion: isClassroom ? '1.3.0' : (genesisNativePreview ? '2.0.0-genesis-preview' : '1.3.2'),
    ...(sosNativePreview ? { runtimeVersion: '2.0.1-genesis-sos' } : {}),
    ...(godotArenaNativePreview ? { runtimeVersion: '2.0.2-genesis-godot-arena' } : {}),
    ...(unifiedGodotWorldsPreview ? { runtimeVersion: '2.0.3-genesis-unified-godot' } : {}),
    ...(libraryArenaNativePreview ? { runtimeVersion: '2.0.4-genesis-library-godot' } : {}),
    ...(godotLaunchRecoveryPreview ? { runtimeVersion: '2.0.5-genesis-godot-launch' } : {}),
  };
};

