import '@testing-library/react-native';

jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'test-project-id' } } },
  easConfig: { projectId: 'test-project-id' },
}));
