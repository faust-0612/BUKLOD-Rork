# v9 dependencies / setup

Install production-hardening dependencies:

```bash
npx expo install @react-native-community/netinfo expo-splash-screen
```

v8 CSV dependencies still apply:

```bash
npx expo install expo-file-system expo-sharing
```

Push dependencies from v4 still apply:

```bash
npx expo install expo-notifications expo-constants
```

Optional crash reporting:
Expo's official Sentry guide currently recommends the React Native Sentry wizard:

```bash
npx @sentry/wizard@latest -i reactNative
```

Do not commit Sentry auth tokens or Supabase secret keys to the repository.
