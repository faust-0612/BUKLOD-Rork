# BUKLOD v10 — Bootstrap on Expo SDK 57

As of August 2026, Expo SDK 57 is the current Expo SDK and uses React Native 0.86 with
React 19.2. The safest way to align package versions is to let Expo install compatible
versions instead of manually guessing every Expo-module version.

From the BUKLOD project root:

```bash
npm install
npx expo install expo@^57.0.0 --fix
npx expo install expo-router expo-notifications expo-constants expo-file-system expo-sharing expo-splash-screen @react-native-community/netinfo @react-native-async-storage/async-storage
npm install @supabase/supabase-js
```

Testing packages:

```bash
npx expo install jest-expo jest @types/jest -- --dev
npm install --save-dev @testing-library/react-native
```

Then:

```bash
npx expo-doctor@latest
npm test
```

For Supabase local testing, install/use the current Supabase CLI, start the local stack,
apply the migrations, and run:

```bash
supabase test db
```

Do not use legacy `anon`/`service_role` keys for a new production setup when the project
already provides Supabase publishable/secret keys. The mobile app should use only the
publishable key; secret keys belong only in trusted server/test environments.
