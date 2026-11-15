# Matthew Henry on-device translation: attribution and source provenance

This BUKLOD Android staging reader uses the Google ML Kit on-device Translation API only after a user selects the explicitly labeled **Translate with Google** action. BUKLOD uses Google Translate to power optional on-device translation of the public-domain Matthew Henry Bible Commentary. The original English remains authoritative and visible by default; translations are machine-generated and can be inaccurate. If the optional native module or Wi-Fi-only first-time model download is unavailable, display English rather than guessing a translation.

## Branding
Official, unmodified Google badge: `assets/brands/google-translate/color-regular.png` (176×16 px). Source: https://docs.cloud.google.com/static/translate/images/google-translate-attribution.zip, exact ZIP entry `png/color-regular.png`. SHA-256: `1ce4cf9db4cd6c8ae6f6d49542264f5334f40ac79139d51c145a4e039d26323d`. The app displays it directly adjacent to every successful translated commentary passage and links it to https://translate.google.com/. Do not recolor, crop, distort, or place unrelated logos with this official mark.

The reader offers a dedicated accessible disclaimer/help toggle including Google's required warranty notice, a link to Google Translate and clear machine-translation/source authorship labels. The app's translation feature must also be disclosed in external app descriptions/help documents before non-test production promotion.

## Source and accuracy
Free Use Bible API (https://bible.helloao.org/api/c/matthew-henry/{BOOK}/{CHAPTER}.json) was sampled directly in no-publish Actions job 132898153503: Genesis 1 contains 10 explicit verse anchors, John 3 contains 2, and 3 John 1 contains 4; sample objects contain `chapter.content` with `type:verse`, `number`, and `content`. Uncovered verses have only source-related **context**, not a falsely claimed exact verse commentary, and no future anchor can be used as past verse commentary.

## Release
Signed staging APK metadata checked from Expo build `bc4be208-bfb0-42f3-95cb-358353d0600f` (runtime 1.3.2, channel staging-user, package org.mzbministry.buklod.staging). The native module exists at build source c6804e5..., but direct DEX confirmation and authenticated Expo current-manifest checks are still separate release gates; this document does not claim publication.
