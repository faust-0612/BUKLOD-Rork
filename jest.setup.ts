import '@testing-library/react-native/matchers';

jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'test-project-id' } } },
  easConfig: { projectId: 'test-project-id' },
}));

// Keep unit tests isolated from native storage and production services.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://jest-tests.example.invalid';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
