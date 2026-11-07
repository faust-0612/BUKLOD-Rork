# BUKLOD Desktop Web — fixed center and contextual detail dock (2026-11-07)

## Root causes corrected

The 2026-11-07 desktop screenshot showed a narrow Community Wall while its left/right `ScrollView` rails grew to occupy much of the monitor. Fixed widths were insufficient because React Native Web's `ScrollView` retained default flex-growing behavior. The side rails now have **flexGrow=0, flexShrink=0, explicit basis/min/max widths**. At 1200–1399px they use 198px/270px, at 1400+ 240px/318px; the center flexes and remains readable. The external tall left banner stays removed.

The approved BUKLOD web mark is the existing green B logo art, **not** the unapproved three-person concept from the earlier dashboard mockup. The existing image includes the BUKLOD wordmark, so the top header should show it once at readable size, with no duplicated separately rendered BUKLOD text. This change does not alter the canonical image, PWA or native artwork.

## Secondary view policy

The Main Web shell is persistent. **Opening conversations and profiles does not navigate out of Home/Wall/Connect.** Instead the right-side overlay panel opens over the Connect rail, maintaining the entire underlying routed workspace. Header controls are **Close** (dismiss without changing current route) and **Expand** (user explicitly chooses the full route).

The shared `BuklodConnectThread` engine is rendered directly in the dock for personal and community threads. No iframe, second messaging database or fabricated conversation state. Any thread failure/back action closes the dock rather than navigating the background page.

A member profile uses the existing privacy-aware `loadMemberPublicProfile` service. Locked profiles have no avatar retrieval or private detail access; the user may explicitly Expand to the existing member profile. The existing message action opens the same Connect dock.

Supported entrypoints: recent personal chats/contacts in the right rail, Connect inbox personal/community threads and search, Connect web avatar taps, shared `buklodInstantPush` secondary route navigation, and member visit/message actions. Deep links to the actual full conversation/profile URLs still work; they are explicit full-page requests. Primary Home/Cluster/Wall/Connect navigation remains route-based.

## Release boundaries

Changes scoped to Main desktop web behavior and shared navigation fallback. On Android/phone, the new dock has no active registration and original Expo Router navigation remains intact. Existing auth/account isolation, Connect RPC and call engine, ad placement, Wall content, SOS and Cluster code remain untouched.

**Release:** DEV → passing CI → reviewed Main merge → separately verified web RC → Expo Hosting publication. Do not claim live from source merge. Manual device/browser verification may be skipped by owner instruction, but automated production gates and exact release SHA still apply.
