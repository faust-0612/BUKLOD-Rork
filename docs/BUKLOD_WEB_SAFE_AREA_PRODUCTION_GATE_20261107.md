# Production Web safety anchor reconciliation — 2026-11-07

## Failed run

GitHub Actions **Production Web Deploy** run 42355545981 (`1dc2213538bfa55ddf352ea7813b67fa0e9c2c73`) failed in **Verify production safety anchors**. Auth, environment pull, Classroom separation, branding, scoped Community state and TypeScript all passed. Export, hashing and deploy were skipped. No publication occurred from this run.

## Root cause

The workflow still demanded the removed literal `paddingTop: insets.top` inside `src/components/BuklodScopedDashboardHeader.tsx`. Its replacement `scopedTopInset` deliberately avoids duplicate safe-area padding inside the wide Main desktop web chrome while preserving `insets.top` on native/phone. Reverting header code to satisfy an outdated grep would reintroduce the observed oversized Cluster top whitespace.

## Fix and guard

Replace ONLY the obsolete literal grep with a Node focused test guarding the platform+width decision, both scoped header usages, and the existing exact-SHA/hashed-RC/production environment safety gates. All existing downstream positive grep anchors and native OTA checks remain unchanged.

## Source release boundary

Based on the current Main source `eff3a21bcb0018506812a1171f22b42d5836876e` at diagnosis (which advanced after the failed run). Merge only after focused QA and automated CI. The existing manual Expo Production Web Deploy action must still run against a fresh frozen exact Main SHA, verify exported web RC hashes, and confirm actual production publication. Do not rerun the old failed SHA, disable gates, publish Android OTA or alter production data.
