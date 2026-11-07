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
