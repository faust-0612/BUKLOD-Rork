# Himig Studio — EXPO Hosting
This is a standalone Expo Router SDK54 web app, not a Vercel app.
Status: source, type checking and web production export verified. Live Expo Hosting publication is BLOCKED by Expo authentication; EAS CLI reports "An Expo user account is required to proceed."
To publish to your own Expo account:
1. Sign in to your Expo account using `npx eas-cli login` on a trusted computer; alternatively configure EXPO_TOKEN securely in CI. Never paste tokens or passwords in chat.
2. From project root run `npm ci` and `npm run check`.
3. Publish: `npx eas-cli deploy --prod --dev-domain himig-studio`
4. Open the actual URL output by EAS CLI. Desired production hostname `himig-studio.expo.app` is NOT reserved or confirmed available.
The deployed audio remains a draft; verify the exact source recording and judge Tagalog vocals and harmony before treating it as professional.
