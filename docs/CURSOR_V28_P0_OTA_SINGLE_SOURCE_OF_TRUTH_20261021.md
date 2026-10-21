# BUKLOD V28 P0 OTA — SINGLE AUTHORITATIVE EXECUTION ORDER

**Owner correction 2026-10-21: “v28 ang kailangang i OTA, anung kinalaman ng v25” and “ayusin mo nga lahat ng instruction”.** This file supersedes all conflicting instructions in the prior Cursor R5/P0 order files for THIS release. Read them only for relevant historical evidence, never as overriding release targets or approval requirements.

## Non-negotiable target
- **Target installed app: BUKLOD Android V28**, versionCode **28**, versionName **1.3.4**, Expo runtimeVersion **1.3.4**, update channel **production**. Confirm all values by inspecting actual binary/metadata; treat declared config as provisional until verified.
- **Objective: deliver verified JavaScript-only P0 fixes by OTA to V28 devices**, not V25. The last observed runtime 1.3.2 production OTA is historical context for older users, NOT a V28 publication or test blocker.
- V28 runtime 1.3.4 had no published OTA in the last report. **First** 1.3.4 OTA is valid if EAS channel/project and candidate bundle are correct and an actual V28 client can receive it. No need to publish to 1.3.2 first.
- The owner already supplied **28.apk** in ChatGPT Library (file name `28.apk`). Cursor's cloud environment reportedly already has a 1.3.4 Android emulator installation; inspect that binary and its production update channel. Library presence does **not** mean Cursor can read it: obtain authorized cloud transfer/access if needed, otherwise use verified installed V28 emulator. Never claim a V28 binary is verified merely from filename.
- **Do not request a V25 APK. Do not build a V25 APK. Do not make a V25 OTA.** V25 deprecation/minimum-version policy is a separate future release concern, not this OTA gate.

## P0 execution
1. On the remote GitHub repository `faust-0612/BUKLOD-Rork`, inspect the CURRENT head of `dev/kabihasnang-ligaw-dashboard-r5` (last Cursor reported `58d287da1cba0854b9a6debc6490ea093f12f5d5`), `main`, current branch diff, and actual V28 native config. Do not reset or discard Cursor's completed P0 patches.
2. Enumerate verified pending P0 bugs from code and prior work: weak-network/global loading, Community Wall under poor signal, referral code resolving then Create Account returning Not Found, and other reproducible P0s. Inspect-prove-fix, minimal changes, regression tests; no speculative unrelated refactors.
3. Use the **V28 version 1.3.4 source/native fingerprint and V28 installed test binary** as compatibility target. Reconcile candidate source against verified V28 build lineage and P0 changes. The absence of git SHA in old V25 OTA must not block V28. Do not assume `main` is exact APK source until confirmed.
4. Keep **Kabihasnang Ligaw R5 fully disabled/excluded** while media or performance gates remain blocked. Do not delay P0 OTA for story art, music, or R5 database migrations.
5. Cloud-only validation: TypeScript, focused Jest/contract, referral/RLS isolated DB checks, weak-network tests, protected feature regression (Community Posting, DZAS, PTT, LIFE), and **actual V28 emulator OTA reception**. Prove V28 runtime 1.3.4 / channel production on emulator; verify OTA update is compatible. Never substitute a 1.3.2 client.
6. Freeze exact passing V28 P0 RC with commit SHA, diff, runtime/channel, manifest hash, test logs, rollback. Do not blindly use legacy script targeting runtime 1.3.3.
7. **Standing owner authorization: automatically publish verified RC to Android production OTA for runtime 1.3.4 as soon as ALL gates pass, without asking again.** Validate EAS project credentials/channel, publish, read back real group/manifest, verify on V28 client, record source SHA. If credentials inaccessible (e.g., GitHub secrets 403), seek other authorized cloud EAS access; never expose secrets or claim success. If unavailable, stop at precise blocker.
8. No native APK/AAB rebuild, no Play rollout, no unrelated production SQL, no local PC C:/D: writes, no cross-runtime publish, no fabricated validation, no older-client cutoff before a verified live replacement.

## Final response contract
Do not send repeated plans or generic status. If published, return OTA group ID, runtime 1.3.4, channel production, RC SHA, confirmed device receipt, and tests. If blocked, state ONE exact unresolved gate, what was attempted, and ONE necessary owner action. Never conflate V25 historical OTA with the V28 target.
