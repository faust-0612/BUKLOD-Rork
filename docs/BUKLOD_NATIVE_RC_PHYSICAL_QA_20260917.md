# BUKLOD Main — Native RC Physical QA Gate (2026-09-17)

Target: **BUKLOD Main Android** only  
Package: `org.mzbministry.buklod`  
Version: `1.3.0`  
Version code: `21`  
RC branch: `release/native-rc-apk-20260917`

This checklist is release-blocking. Do not build or upload the Play Production AAB until every REQUIRED item below passes on a real Android phone using the exact APK produced from the RC commit that will later be frozen.

## A. Cold start / account / recovery — REQUIRED

- [ ] Clean cold start has no white/blank screen.
- [ ] Existing signed-in session restores without asking for the BUKLOD password again.
- [ ] Trusted-device lock accepts fingerprint / face / Android device authentication.
- [ ] Device PIN fallback works when offered by Android.
- [ ] Cancelling trusted-device unlock does not expose normal BUKLOD content.
- [ ] Password sign-in fallback still works.
- [ ] Email recovery sends the canonical 6-digit OTP flow and can reset the password.

## B. Highest-practical SOS trigger system — REQUIRED

Perform these with a controlled test account and with nearby test recipients only. Do **not** use an uncontrolled live emergency broadcast for QA.

- [ ] In-app SOS opens the canonical Verified SOS screen.
- [ ] Android Quick Settings contains/adds `BUKLOD SOS`; tapping it from a closed app opens `/sos`.
- [ ] Long-pressing the BUKLOD launcher icon exposes `BUKLOD Emergency SOS`; tapping it opens `/sos`.
- [ ] `SOS Ready` can be armed from Emergency Alert Mode and creates the optional lock-screen/notification shortcut.
- [ ] Tapping the lock-screen/notification SOS shortcut from a closed/background app opens `/sos`.
- [ ] SOS entry does not demand two consecutive app-unlock prompts. Identity verification happens at the final dispatch boundary.
- [ ] Holding `HOLD TO VERIFY & SEND SOS` for ~2 seconds opens Android local authentication on a phone with enrolled device security.
- [ ] Fingerprint/face/device-PIN success permits dispatch.
- [ ] Cancelling/failing local authentication creates **no** emergency request.
- [ ] Phone with no enrolled local authentication can still use an authenticated BUKLOD session and the backend marks assurance as `DEVICE_AUTH_UNAVAILABLE`.
- [ ] Foreground high-accuracy location is captured; no background location permission/service is requested.
- [ ] Backend request row records the signed-in creator plus trigger source, identity verification level, client platform, pseudonymous installation hash, and location accuracy.
- [ ] Exact GPS coordinates remain server-side; nearby recipients receive approximate distance, not raw coordinates.
- [ ] Same active emergency cannot be created repeatedly; cooldown/active-emergency protection remains effective.
- [ ] Emergency fan-out is idempotent: retrying dispatch does not duplicate recipient notifications.

## C. Emergency receiving / notification — REQUIRED

- [ ] `BUKLOD Emergency Alerts` Android channel exists at MAX priority.
- [ ] Strong vibration + alarm-style notification behavior is visible/audible when allowed by the device.
- [ ] Lock-screen visibility works.
- [ ] Notification Policy / DND access is explicitly opt-in.
- [ ] After granting DND access, Emergency Alert Mode can rebuild/recheck the channel and reports DND override active where Android permits it.
- [ ] Test with app foregrounded.
- [ ] Test with app backgrounded.
- [ ] Test after swiping/killing the app.
- [ ] Tapping a real `community_emergency` notification opens the exact emergency/community record.
- [ ] `ACKNOWLEDGE` records the response once and does not duplicate on repeated notification callbacks.

## D. Closed/killed incoming call — REQUIRED

Use two real Android devices/accounts.

- [ ] Receiver app foreground: incoming BUKLOD call rings and can answer/decline.
- [ ] Receiver app background: incoming call rings and can answer/decline.
- [ ] Receiver app swiped/killed: incoming call still triggers the native ringing flow.
- [ ] Screen locked: incoming-call presentation remains usable under Android's allowed behavior.
- [ ] Answer opens correct audio/video call.
- [ ] Decline terminates cleanly.
- [ ] Microphone/camera permission denial shows a recoverable state instead of a crash/blank screen.
- [ ] Speaker/Bluetooth audio path remains usable.

## E. BUKLOD IGPAT native video — REQUIRED

- [ ] IGPAT feed opens without white/blank screen.
- [ ] Video uses a stable frame and is not awkwardly cropped; full content remains visible where intended.
- [ ] Swipe-to-next is smooth and next-video preload works.
- [ ] Record/camera flow opens successfully.
- [ ] Front/rear camera behavior available from the active camera flow behaves correctly on the test device; if the OS picker owns this UI, verify its normal switch-camera control.
- [ ] Recorded video preview is correctly oriented.
- [ ] Upload/post completes and the same IGPAT item plays afterward.
- [ ] Community Wall IGPAT preview opens the exact IGPAT item.

## F. Animated character / BUKLOD Kingdom — REQUIRED

- [ ] Native Rive character renders on Android; web fallback is not accidentally used.
- [ ] Character animation/state changes do not crash after background → foreground.
- [ ] Character change/reset rules remain correct.
- [ ] Native Skia Kingdom/game scene renders.
- [ ] Gestures/input work.
- [ ] No obvious frame stalls, runaway memory, black canvas, or missing textures during several minutes of use.
- [ ] Leaving and reopening Kingdom/game restores expected state.

## G. Native Community Map / travel — REQUIRED

- [ ] Native Google map loads using the production Maps key.
- [ ] Default HYBRID imagery renders.
- [ ] HYBRID → SATELLITE → STANDARD switching works.
- [ ] Live foreground GPS user position updates while the map is open.
- [ ] My Location recenters correctly.
- [ ] BUKLOD place pins load and selecting a pin shows the correct destination.
- [ ] `START NAVIGATION` hands off the selected destination to Google Maps turn-by-turn navigation on Android.
- [ ] Google Maps receives the exact destination coordinates.
- [ ] If Google Maps cannot open, universal Maps fallback works.
- [ ] No background-location service is started by BUKLOD.

> Note: satellite/hybrid imagery is provider imagery, not a real-time satellite camera feed. The device GPS position is the live component. Current RC uses a native BUKLOD map plus Google Maps turn-by-turn handoff; it does not claim an embedded Google Navigation SDK engine.

## H. Production regression / release safety — REQUIRED

- [ ] Community Wall/public root loads.
- [ ] Profile opens and Android Back returns correctly.
- [ ] Organization and Cluster scopes open and do not leak permissions.
- [ ] Focus Apps gates still work.
- [ ] Slow network gives visible loading/retry states rather than a blank screen.
- [ ] Offline → reconnect recovers.
- [ ] Expired/stale session recovers without an unrecoverable loop.
- [ ] App reopen after OTA/cache state remains usable.
- [ ] No unrelated Classroom standalone identity/package is present in the Main build.

## PASS / FREEZE RULE

Only when every REQUIRED item above passes:

1. Record the exact RC Git SHA tested on the phone.
2. Do not merge unrelated `main` work into the frozen RC.
3. Run the final AAB script from that exact SHA.
4. Verify package `org.mzbministry.buklod`, version `1.3.0`, versionCode `21`.
5. Upload that AAB to Google Play Production only after final AAB identity checks pass.

Any failure returns the RC to FIX → REBUILD APK → RETEST. Never patch after physical approval and reuse the old approval.
