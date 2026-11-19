# BUKLOD Season 2 Genesis — Creation Cosmos DEV
Date: 2026-11-20 | APP_ID=buklod-main | DEV ONLY | NOT RELEASED

## Owner's approved direction
Genesis is Creation: radiant origin of light, outer space, planets, nebulae, galaxies, orbits, angular flying light fragments and the biblical words “Let there be light” (Genesis 1:3). Symbolism reveals the Creator by His act of Creation, not by guessing God's appearance.
The previous botanical/vine/forest proposal is **superseded**.

## Actual source included on isolated DEV branch
- Home /hub hero and background with hand-authored scalable multi-layer SVG cosmic lighting/planets/orbits/nebulae and animated light-fragment streaks, native+web.
- Existing reward ceremony uses the same Creation motif, with verified reward display still controlled by the caller.
- Release-controlled season theme authority overrides all global theme colors in Season 2 preview, and hides global, profile accent and personal Home theme selectors. Season 1 remains unchanged when preview is off.
- Compact responsive native motion-enabled button leading to Kingdom (existing route).
- Native Rive character slot for a licensed, approved rig: only a real .riv file animates. No unapproved bobbing thumbnail substitute.
- Low-motion, app-background, screen-focus safeguards. Social media surfaces do not autoplay cosmetic ambience.

## Things NOT complete and not to call 'ML/COD quality'
- No 13 approved character Rive rigs or high-res segmented art yet: real moving characters NOT demonstrated.
- No licensed high-quality ambient soundtrack, cinematic reward SFX, or verified audio mastering; no cheap beeps substituted.
- No actual device FPS, graphics test, memory/ad first-view, navigation smoke, dark/readability, or production evidence.
- Full app-wide screen-by-screen visual reconciliation still pending.
- No SDK upgrade, native build, staging OTA, production, or economy change.

## Activation and embargo
Requires EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW=true and non-production EXPO_PUBLIC_APP_ENV. Release still blocked before December 6 and until exact approved RC and owner authorization. No changes to runtimeVersion, app.config, EAS channel, auth, rewards or RLS.

## Source validation
node --experimental-strip-types --test tests/buklod-genesis-living-engine.test.mjs
npx tsc --noEmit
Actual Android render and AdMob/nav regressions are mandatory before declaring quality accepted.

## Native runtime preparation (isolated)
New staging-only EAS profile: `season2-genesis-preview`, OTA channel of same name, app package `org.mzbministry.buklod.staging`, runtime `2.0.0-genesis-preview` when build-time flag is true. Existing production EAS profile, package and runtime are unchanged. Cosmic splash background is native config only on this preview. No APK built or released.

## Asset quality gate
`genesisAssetRegistry.ts` explicitly defaults to no approved Rive rigs or audio. Original licensed rigs require SHA-256, license ID, character/rig revision; mastered audio requires checksum, license, approved bit, sample rate and loudness metadata. Both remain intentionally empty. `GenesisRiveCharacter.native.tsx` accepts only manifest rig IDs, not arbitrary URLs. The existing Character engine stays authoritative. No fake full-resolution animations are claimed.

## Verification evidence
Source readback at commit `aa51bad6c0eab27851b67dc24644a196220f8585` verified 14/14 static wiring/preview/audio/asset-related assertions earlier in the DEV sequence; this **does not** claim TypeScript compilation, test execution, Android rendering or a release. Following edits need revalidation. No CI/build was requested or started.

## Season lock reconciliation — continued
- ConnectThemeProvider is forced to Season 2's blue/celestial/teal messages palette; old Connect overrides remain stored but do not apply. ConnectThemeSelectorButton is hidden only on the Season 2 native preview.
- ChatBackgroundProvider renders the cosmic theme canvas, ignores legacy personal/thread wallpapers without deleting them, and blocks seasonal background writes.
- Scope workspace colors/card surfaces, background images and customization actions defer to Season Theme Authority; historical organization settings are preserved for pre-Season-2 runtime.
- Home, Profile, Connect, and Scope now share season-owned colors. Rich celestial animated backdrops are implemented on Home/Profile, a bounded static scene in Scope; complete visual/audio acceptance for every other routed screen is still pending.

## Engineering readback, 2026-11-20
- Isolated branch against exact main baseline `551e54602addd6f7bbe7bcdddd1589d35424c964`; no production/main branch mutation.
- 18/18 focused source assertions passed on the earlier commit `85d1ec4403ead12991086a4117c6d0c41e99a81d` (native runtime gating, creator verses, cosmic scene, assets, audio suppression, Home/Profile wiring). Additional Connect/Scope source readback confirmed guards after that point.
- No GitHub Actions run on branch at inspection. No automated Jest/Node test, TS compile, signed APK, Expo OTA receipt, device screenshots or performance evidence. Branch is **DEV candidate only**.
- Existing Expo SDK 57 and pinned Skia must be compatibility-tested before adoption of additional shader APIs. Do not change production dependencies opportunistically.
