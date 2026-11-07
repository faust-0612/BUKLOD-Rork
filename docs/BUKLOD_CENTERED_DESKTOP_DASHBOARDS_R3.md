# BUKLOD Main desktop consistency R3 — 2026-11-07

## Source diagnosis

- User screenshot shows /scope (Cluster) escaping the Main Desktop chrome and reserving excessive white space before the Cluster header.
- /points and secondary /profile routes were excluded from the desktop public presentation policy, so Points opened in a different full-width shell and Back could return with a different layout.
- Left rail was narrower than requested; fixed responsive widths are now 220px at 1200-1399 and 280px at >=1400, with right rail unchanged and center >=635px.
- Connect composer is multiline, with no Enter-to-send web handler; it now uses the SAME onSend pathway as the button, guarding duplicate key + submit events and IME composition.
- Character Customize's historical global SYS-500 error is a render exception whose precise underlying stack is not available from the screenshot. Heavy editor rendering is lazy; failures are contained with retry/close, leaving Profile usable. Its modal is desktop-centered with maximum width 880. The actual render failure needs a runtime reproduction/log before the root cause can be declared fixed.

## Policy

At widths >=1200, public Home/Wall, Cluster/Organization scope, Points, settings, personal dashboards, Bible/Word, prayer, member profiles and Connect detail routes remain inside the persistent centered BUKLOD desktop chrome. This does not make them a separate browser fullscreen view. Explicit immersive Focus/Full Screen remains a separate user action.

At phone widths and native Android, routes retain existing shell and keyboard behavior. Cluster scope access and account isolation are not bypassed; only the presentation shell changes. The scoped header no longer adds the native safe-area inset when rendered inside wide desktop chrome.

## Release

Source-only DEV. Run focused navigation, Connect keyboard and source integrity tests, CI TypeScript/integration, RC verification and immutable SHA promotion before web production. No Android OTA, DB migration or unmerged Classroom feature changes.
