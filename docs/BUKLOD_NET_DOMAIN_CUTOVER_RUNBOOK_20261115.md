# BUKLOD Main — buklod.net custom-domain cutover runbook

**Prepared:** 2026-11-15 (Asia/Manila)  
**Status:** PREPARATION ONLY — NOT PURCHASED, NOT LIVE, NO RELEASE  
**Owner decision:** `buklod.net` selected as official domain; **no purchase without separate explicit approval**.

## Authoritative target

- Product: `APP_ID=buklod-main` (root hub app).
- Source: `faust-0612/BUKLOD-Rork`.
- Expo project ID: `23dad7d0-389a-406e-8dec-08965dab85d8`.
- Existing web production alias: `https://buklod.expo.app`, hosted on **Expo Hosting**.
- Intended apex custom domain: `https://buklod.net`.
- Intended `www.buklod.net`: redirect to `https://buklod.net` (do not create an Expo alias named `www`).
- **Do not** attach the apex to Vercel's Classroom/Connect/Report/FBC projects. The Vercel registrar/DNS account may own the domain, but **Expo Hosting** must serve the main application.
- Preserve `buklod.expo.app` as an existing compatibility address until tested. Never break old public QR, policy, referral, invitation or Play Store URLs.
- Standalone Focus Apps retain their own deployment identity and hosting; use dedicated subdomains later only after their target and auth contracts are verified.

## Cost and purchase gate (read-only checks performed)

- Registry availability for `buklod.net`: **available at check time**; availability can change until actual registration.
- Vercel read-only quote on 2026-11-15: **USD 13.50 for the first year**, **USD 13.50 stated renewal price**, excluding applicable taxes and processing fees.
- Quote was previewed with **auto-renew OFF**; do not assume a future purchase defaults to OFF. If OFF, registration **expires after one year** without manual renewal.
- Domain registrations are **non-refundable**. Vercel purchase uses the team default payment card; owner should inspect `https://vercel.com/efmagaj-6311s-projects/~/settings/billing`.
- The quote token is short-lived; request a fresh quote at approval time. **Do not store or replay quote/payment tokens.**
- Expo Hosting custom domains require an eligible **paid Expo plan**; public Starter list price at time of review is **USD 19/month plus any usage charges**. Check actual BUKLOD Expo account billing/eligibility before any commitment.
- No domain purchase, paid plan change or recurring charge is authorized by the present selection.

## After explicit owner purchase approval

1. Refresh domain availability, current registration price, renewal details, applicable taxes, registrant contact, privacy/WHOIS options, selected billing card, and auto-renew setting; request fresh explicit approval for those exact terms.
2. Register in the **approved** account only; confirm domain ownership and registrar verification. Enforce registrar MFA, domain transfer lock, and limited billing/DNS administrative access.
3. Check the **actual Expo project and Expo plan** are eligible and that `buklod.expo.app` is correctly attached to the **current production deployment**, without promoting/rebuilding anything.
4. In Expo project **Hosting settings → Custom domain**, enter `buklod.net`. Expo supports exactly one custom domain per project; ensure none must be displaced.
5. In the purchased domain's DNS control panel, add precisely the **current dashboard-generated** DNS records **in this order**:
   a. Verification TXT at `_cf-custom-hostname.buklod.net`; refresh until verified.
   b. SSL / ACME CNAME at `_acme-challenge.buklod.net`; refresh until verified.
   c. Apex A record for `buklod.net` to the exact address provided by Expo dashboard (**the docs currently show 172.66.0.241 as a typical value, not a guaranteed value**).
   d. `www` CNAME → `origin.expo.app` for Expo's documented 308 redirect to the apex, without a `www` alias.
   Use low TTL during the cutover. Do **not** use Vercel's suggested `76.76.21.21` A record for the Expo-hosted main site.
6. Wait for Expo's ownership, SSL certificate and routing checks to succeed. Enable domain renewal reminders even when auto-renew is disabled.

## Release and compatibility review BEFORE any link/code changes

- **Auth:** confirm Supabase Auth Site URL, redirect allow list and any external OAuth provider allowed domains for both `https://buklod.net` and the original `https://buklod.expo.app`; allow only exact app-approved origins; do not broaden to `*`. Validate password login, recovery, magic links, third-party login if enabled, and logout. Existing web localStorage sessions are origin-scoped; new site may require a fresh login.
- **Deep links/invites:** inspect `src/lib/buklodClusterInviteUrl.ts`, `src/lib/buklodReferralV2.ts`, `src/lib/buklodLifeImpact.ts` and all existing public sharing code. Permit both old and new trusted hosts; do not change new share origin until verified, and retain legacy path/query parsing.
- **Public/legal:** privacy policy, delete-account, Google Play listing, public legal notice in `src/lib/legal.ts`, media embeds, AdSense site verification/canonical domain, link previews and social sharing metadata must continue to work at both hosts. Update external registrations only after new links pass.
- **Mobile:** preserve Android/iOS app links and installed OTA runtime `1.3.2`; do not trigger Android build or OTA for a DNS change. If new verified app-link ownership/deep linking requires native intent filters or Digital Asset Links, handle as a **separate gated native release**, not a surprise side effect.
- **Focus Apps:** `fis.buklod.net`, `connect.buklod.net`, `school.buklod.net`, `health.buklod.net` are **proposed**, not activated. Point each only to its independently verified project, with its own auth callback, cookie and SSL review. No wildcard-to-main catch-all for independent Focus Apps.
- **Security:** use registrar MFA, DNS change audit, HTTPS and safe redirect rules; never publish credentials or Supabase service-role keys. Keep browser CORS, CSP, trusted-host checks and account isolation intact. Domain ownership alone is not proof the app works.
- **Release isolation:** a custom domain mapping is routing configuration, **not a code deploy**. Do not dispatch `.github/workflows/production_web_deploy.yml`, Expo web deployment, Android OTA, or production migrations solely for this domain preparation. Honor the independent DEV → RC → production gates for any eventual code changes.

## Acceptance and rollback gates

- Confirm apex DNS resolves to Expo-hosting destination, TLS cert valid, `https://buklod.net` serves the **same verified Expo production deployment** as the original alias (not a Vercel focus app).
- Check `/hub`, `/buklod`, `/privacy`, `/delete-account`, `/register?ref=...`, Cluster invite links and auth login/recovery flows; test unauthenticated and authenticated browsers, narrow phone and desktop.
- Verify `https://www.buklod.net` redirects **308** to `https://buklod.net`, preserving paths/query where applicable; verify `https://buklod.expo.app` remains accessible and old links work.
- Verify media, ads/AdSense placement, navigation, redirects, cookie scope, authentication, and privacy rules. No app traffic migration before these pass.
- On mismatch: **stop promotion of the new domain**; restore prior new-domain DNS entry or remove custom domain mapping without touching `buklod.expo.app`. Recheck TLS/DNS propagation and any non-domain regression.
- Final release report must name exact Expo project, production deployment ID, DNS record state, certificate state, verified routes/auth scenarios, new URL, and rollback condition. No success claim on a TXT record alone.

## Verified preparation evidence and blockers

- Domain availability and Vercel registration-price lookup succeeded, **not reserved**.
- Vercel account inspected: its `buklod-*` projects are standalone/miscellaneous, **not** BUKLOD Main Expo Hosting.
- Canonical project identity and deployment target confirmed from `.buklod/app-boundaries.json`, `docs/BUKLOD_APP_BOUNDARIES.md`, and `docs/BUKLOD_DESKTOP_WEB_SOURCE.md`.
- Expo docs: https://docs.expo.dev/eas/hosting/custom-domain/
- Expo pricing: https://expo.dev/pricing
- BLOCKERS: domain is not yet owned; current BUKLOD Expo plan and Hosting settings have not been verified from an authenticated Expo connection; domain-specific challenge tokens and certificate status cannot exist before ownership/mapping. No production change is authorized.

**Stop state:** PREPARED / NO PURCHASE / NO DNS CUTOVER / NO PRODUCTION DEPLOYMENT.
