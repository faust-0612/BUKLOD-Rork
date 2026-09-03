module.exports = ({ config }) => ({
  ...config,
  name: 'BUKLOD Classroom',
  slug: 'buklod-classroom',
  scheme: 'buklodclassroom',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.buklod.classroom',
  },
  android: {
    package: 'com.buklod.classroom',
    adaptiveIcon: {
      backgroundColor: '#F4F7F2',
    },
  },
  plugins: [
    'expo-router',
    ['expo-image-picker', { photosPermission: 'Allow BUKLOD Classroom to upload school work and profile photos.', cameraPermission: 'Allow BUKLOD Classroom to capture school work and video recitations.' }],
    '@stream-io/video-react-native-sdk',
  ],
  experiments: { typedRoutes: true },
  extra: {
    mainSupabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    mainSupabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    quizSupabaseUrl: process.env.EXPO_PUBLIC_QUIZ_SUPABASE_URL || 'https://cjtehbfspgimyhifnjon.supabase.co',
  },
});
