# BUKLOD BSOC — Expo reconciliation and release handoff (2026-11-07)

Status: **DEV implemented, production backend schema active, standalone Expo BSOC not deployed by this change.**

## Ownership and compatibility
- Preserve the original `BUKLOD_BSOC_Standalone` Expo application as the canonical BSOC host. The prior local source rescue reports a commit `0f4a6cc` (`recovery/bsoc-rescued-20260921`) with a dedicated router, role-based authorization, Command Center, Ads, Apps, UX Health, Support, Incidents, Notifications, Knowledge Base, Moderation, Audit Log and administration modules.
- That exact source tree was **not found** in accessible `faust-0612` GitHub repositories on November 7, 2026. The `BUKLOD-Migrated-Sources` recovery branch contains Main app BSOC components, but is not proof of the standalone Expo source. Do not reconstruct the standalone app from older screenshots or deploy a support-only replacement.
- No Vercel BSOC static prototype is used as canonical production host. Expo Hosting is the requested release destination.
- Main app feature development is isolated in `faust-0612/BUKLOD-Rork` branch `dev/bsoc-support-recovery-20261107`. Do not merge straight to production without RC reconciliation.

## What was implemented
- Main BUKLOD Expo member routes: `/support/live`, Help search entry, prominent Profile and Login help entry. Includes prelogin concern submission, member cases, messages, evidence uploads, and safety guide.
- Main BUKLOD staff Expo routes: `/admin/bsoc-support`, `/admin/bsoc-conversations`, `/admin/bsoc-notifications`, `/admin/bsoc-gpt-debug`.
- Permission model follows existing `buklod_bsoc_can('bsoc.support.read')` and `buklod_bsoc_can('bsoc.support.manage')`; admin password recovery continues via current `/admin/account-recovery` and `account-recovery-v4`.
- Existing `user_feedback` remains the canonical case parent. Additive tables `bsoc_case_messages` and `bsoc_case_attachments`, private Storage bucket `bsoc-support-evidence`, and permissioned notification triggers were applied to the existing production BUKLOD Supabase project.
- Existing `notifications` push dispatch is reused for support alerts, including active SYSTEM-scope authorized personnel granted support-read. The owner/admin is included. Do not disclose member message text in notification payload.
- `bsoc-gpt-debug-v1` deployed with verified JWT and permission check. Only sanitized, manually entered diagnostics are forwarded. GPT needs a configured server-side `OPENAI_API_KEY` to answer; no key is exposed in client. The GPT result is advisory only.

## Canonical BSOC Expo integration steps
1. Retrieve authoritative standalone BSOC Expo project containing `app/_layout.tsx`, `components/BsocShell.tsx`, `providers/BsocAuthProvider.tsx`, `app/support.tsx`, `app/notifications.tsx`, and original modules, with its Git history/lockfile.
2. Compare the current deployed Expo revision with original rescued branch before editing; preserve every existing module, scope, role and feature.
3. Add **nested Support / Conversations / Password Reset** nav links, notification bell/unread count, and a sanitized GPT diagnostics panel to the existing BSOC shell. Do not replace existing Support, Incidents, Ads, Operations or Command Center implementations.
4. Reuse the production RPC `buklod_bsoc_support_queue_v1`, private `bsoc_case_messages`, `bsoc_case_attachments`, `notifications`, and `account-recovery-v4`. Use the existing BSOC auth provider rather than creating a second sign-in state.
5. Enforce read/manage permissions on every screen and database call; grant eligible personnel via existing BSOC role assignment/training process. Password reset approval remains System Admin only.
6. Run typecheck, Expo web export, EAS build compatibility, support send/receive and evidence on mobile/web, admin response, push notification, unauthenticated-denial, account recovery and cross-account isolation tests.
7. Freeze a verified RC. Confirm the installed APK's channel/runtimeVersion vs OTA payload and deploy web with `npx expo export --platform web` and `eas deploy --prod` from the original BSOC project. Do not point `buklod-bsoc.expo.app` to an unrelated project or unverified HTML shell.
8. Release BUKLOD Main production OTA only from the matching certified APK runtime after its dedicated release gate. Do not infer that a DEV commit updates installed Android clients.
9. Verify deployed Expo host URL and exact deployment artifact, auth, navigation, Notifications, GPT availability, chat attachment fetch, password recovery, and regression checks. Record release/deployment IDs.

## Current verification
- Live Supabase migrations: `bsoc_direct_support_chat_evidence_20261107`, `bsoc_support_notifications_v1_20261107`, `bsoc_support_fk_indexes_20261107`.
- RLS on both new tables enabled; anon SELECT denied. Private bucket exists and Realtime message publication active.
- Three notifications triggers are enabled; existing notification push dispatcher installed.
- GPT diagnostic Edge Function is active, v1, JWT verification on.
- Supabase security advisor found no new findings on `bsoc_case_messages` or `bsoc_case_attachments`.
- **Not verified:** typecheck and OTA compatibility; photo/video upload under weak network; authenticated two-way E2E; staff push delivery; OpenAI API key setup; original standalone BSOC source and Expo deployment.

Release decision: **DO NOT MARK BSOC LIVE / APK-WEB OTA READY** until the above missing gates pass.
