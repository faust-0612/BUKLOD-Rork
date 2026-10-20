// Testing Library 13 registers its matchers from the public entry point.
import '@testing-library/react-native';

jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'test-project-id' } } },
  easConfig: { projectId: 'test-project-id' },
}));

// Offline unit tests must never initialize native storage or contact production.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://jest-tests.example.invalid';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
