# BUKLOD all-change protection (2026-11-11)

## Lock implemented in this PR
- Production app files, assets, scripts, GitHub workflows, configs, dependency manifests, and regression tests must all be changed within a fresh version-2 scope manifest, with an exact changed-path allowlist and accompanying focused tests for runtime code.
- Every PR runs the existing required Engineering Accountability / objective-scope-gate. The CLI fails closed when runtime or test changes have no scope manifest. A consolidated RC still needs its exact enumerated manifest and cannot claim approval just because a branch name matches.
- The legacy PowerShell `npm run ota:main` direct publisher is blocked. Android and Expo Web production workflows cannot be manually dispatched. Only the existing explicit release-marker merge on `main` can trigger the canonical frozen-RC workflows.
- No production publish, production DB migration, app runtime, permissions, user data, or application screens are changed here.

## Verified existing GitHub settings at inspection
- Ruleset `BUKLOD Engineering Protection.` (ID 25668992): active, targets default branch, denies deletion and non-fast-forward, requires a PR and `objective-scope-gate`, no bypass actors.
- Its `strict_required_status_checks_policy` is **false**, and required approval count is **0**. These settings cannot be modified using the available GitHub connector. The owner must turn on up-to-date checks and optionally require independent approval if needed; retain the existing required gate.
- Do not assume a status from a skipped compiled RC job means verified build. Before any production release, require exact-head Android/Web compile, security/data/RLS checks, frozen RC identity, and published artifact/readback.

## Owner GitHub ruleset settings
1. In repository Settings → Rules → Rulesets → `BUKLOD Engineering Protection.`, enable **Require branches to be up to date before merging** under required status checks (if appropriate for merge workflow).
2. Preserve `objective-scope-gate` as required. Add specific reliable compile/security checks only when they are guaranteed to run (not skip) on the selected release candidates. Prevent ruleset bypass.
3. Enable the `production` Actions environment with required reviewer(s), if supported, for release workflows. Do not configure secrets or bypass permissions from this document.
4. Check other active release channels/scripts before declaring the full release system locked. The direct local OTA path and primary Android/Web workflows are guarded by this PR, but external EAS account permissions and third-party deploys still require independent controls.

## Safe release state
DEV branch / protected PR only. No merge, no OTA, no web publish. Physical device testing remains unperformed, not 'passed'.
