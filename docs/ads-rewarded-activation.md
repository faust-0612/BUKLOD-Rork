# BUKLOD Rewarded Ads Activation

Rewarded ads are optional and must never auto-award cash, revenue-share credit, Circle Points, Bayanihan value, gift cards, or other transferable/redeemable value.

## Required production variable

Create one dedicated Android Rewarded ad unit in AdMob, then set its ad unit ID in EAS production as:

`EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID`

Example command:

```powershell
npx eas-cli@latest env:set production --name EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID --value "ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY" --visibility plaintext --scope project --non-interactive
```

Verify:

```powershell
npx eas-cli@latest env:list production
```

Then publish Android OTA using the production environment:

```powershell
$env:CI="1"
npx eas-cli@latest update --channel production --platform android --environment production --message "BUKLOD Rewarded Ads production activation"
```

## AdMob setup

Create the ad unit under the existing BUKLOD Android app using the Rewarded format. Use a clear name such as `BUKLOD Android Rewarded Optional`. Configure only a non-cash in-app reward. The app code treats the rewarded callback as opt-in and does not mutate the BUKLOD points/revenue economy automatically.

## Release guard

Do not call production activation complete until:

1. TypeScript passes.
2. `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID` is visible in the EAS production environment list.
3. Android production OTA publishes on runtime 1.3.0.
4. A physical Android device verifies: ad loads, user voluntarily opens it, close-before-earned yields no reward, earned callback fires once after completion, and normal app navigation resumes without blank/white screen.
