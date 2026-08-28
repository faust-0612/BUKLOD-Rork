# BUKLOD Release Commands

## 1. Configure Expo/EAS

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

Set `EAS_PROJECT_ID` in the build environment to the project UUID returned by EAS.

## 2. Build internal preview

```bash
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

Use preview/production builds to verify the final splash screen and app icon.

## 3. Production build

```bash
eas build --platform all --profile production
```

Android store builds normally use AAB. iOS production builds create an IPA for App
Store Connect/TestFlight submission.

## 4. Submit

```bash
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

Store listing metadata, screenshots, privacy declarations, content rating, and review
questions still need to be completed in the relevant store consoles.

## 5. Supabase function deployment

```bash
supabase functions deploy push
supabase functions deploy delete-account
```

## 6. Database migrations

Existing v8 database:
```text
Run supabase/14_production_hardening.sql
```

Fresh database:
```text
Run SQL migrations 01 → 14 in order.
```
