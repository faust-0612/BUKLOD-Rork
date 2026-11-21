# BUKLOD Classroom Web

Independent web portal built against the canonical BUKLOD Connect database and existing Supabase RLS/RPC security. This source is isolated under classroom-web on a nonproduction Git branch. BUKLOD Main routes, Android OTA, Expo deployments, and Supabase schema are intentionally unchanged.

## Required browser build variables
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY (public, never a service-role/secret key)

## Build and test
npm install
npm test
npm run build

## Limitations before full release approval
- Supports login, role-bound class discovery, discussions, chat, activities, text submissions, faculty scoring, materials, attendance history, released student grades, faculty roster gradebook, assessments list, notices, and participation history.
- Does not silently create exam attempts, bypass official attendance gates, expose draft grades, or implement an insecure token-in-URL SSO.
- Native live calls, official roster import, syllabus approval, automatic grade transmutation, and Quiz handoff remain on existing approved BUKLOD modules until integration testing.
- Never attach unfinished BUKLOD Faculty navigation to the production Main app.

Production-ready status requires observed auth/RLS tests using authorized test accounts, deployment proof, and smoke tests on the final URL.

## Classroom navigation and permanent deletion (2026-11-07)
- Classroom banner exposes **Back to My Classes**, independent of horizontally scrollable module tabs.
- Faculty roster uses `buklod_classroom_roster_members_v2` (a scoped authenticated RPC) because `buklod_education_roster_members` is intentionally not directly selectable by browser users. Do not grant blanket roster table access.
- Switching modules resets stale error banners. This prevents old permission failures from remaining visible in Overview.
- Only the original assigned faculty owner sees the **Delete Class** control. Deletion asks for the exact classroom name.
- The UI calls `buklod_classroom_delete_empty_guarded_v1`, introduced by canonical Supabase migration `20261107032407`. The backend independently checks authorization and all class-scoped records, including forum/chat/QuickCheck content, under a classroom row lock. It accepts one default General thread, one initial faculty assignment and default grading categories.
- Existing classes with academic or communication history are NOT deleteable using this action; export and archive through the existing authorized Faculty workflow.
- No class is deleted automatically during deployments or tests; manual signed-in user confirmation is required.
