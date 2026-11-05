# BUKLOD Staging ↔ Production Reconciliation

## Non-negotiable source rules

- `main` is the canonical integrated product source and only production release base.
- A staging workspace, staging build, OTA candidate, or old branch is not automatically authoritative.
- Never promote a staging candidate merely because it builds or can receive OTA.
- Never replace the live Production environment, production data, or credentials as part of source reconciliation.
- Never whole-merge an old staging branch into current `main` just to recover one desired feature.
- Preserve all approved production behaviors and every newer verified main change, including current branding/assets, Wall/media rendering, ads, navigation, authentication, and scoped workspace behavior.

## Required reconciliation procedure

1. **Freeze promotion, not development.** Continue isolated DEV work; do not publish a stale staging candidate.
2. **Record the canonical baseline.** Resolve the exact current `main` SHA and record the known production OTA/source/runtime evidence separately. A Git SHA is not proof that it is the live production artifact.
3. **Identify the exact staging artifact.** Record its branch/ref, commit SHA, EAS project, channel, branch, runtime version, update group, and installed-client compatibility. Do not infer a branch from a workflow name.
4. **Compare ancestry.** Run:
   `node scripts/staging-reconciliation-gate.mjs main <staging-ref>`
   The gate blocks if staging is behind or diverged from `main`.
5. **Reconcile without regression.** Create a fresh candidate from current `main`. Forward-port only individually reviewed, still-needed staging-only commits. Do not merge the old staging branch wholesale. Resolve branding/assets from the canonical current source unless a newer approved design explicitly supersedes them.
6. **Verify source and behavior.** Review the full diff and run focused tests for every impacted area, plus engineering accountability, TypeScript, Expo export/build checks as applicable. Compare key screens/assets against the approved baseline. Test media/photo/video/audio, ads, auth/routing, scoped Community/Connect, and other affected contracts.
7. **Create a verified RC.** Record exact SHA, scope manifest, test results, runtime, EAS channel/branch, update group, and device verification. Missing evidence is a failed gate, not an assumed pass.
8. **Production promotion is separate.** Only the verified RC may be promoted through the approved production OTA/build workflow. Verify the exact published artifact and actual live behavior. No production deploy is performed by this reconciliation audit.

## Current audit evidence (2026-11-06)

Repository: `faust-0612/BUKLOD-Rork`

- Canonical `main` resolved to `0f72907afa515831a14f429312d1c55af0c4dfd3` during this audit.
- `dev/staging-user-fast-ota-20261101` compared with `main`: **diverged**, 4 commits candidate-only and 31 commits canonical-only.
- `dev/staging-user-live-backend-apk-20261101` compared with `main`: **diverged**, 9 commits candidate-only and 23 commits canonical-only.
- `dev/staging-user-apk-build-20261101` compared with `main`: **diverged**, 1 commit candidate-only and 25 commits canonical-only.

### Staging configuration drift found

- Canonical `main` defines the `staging-user` EAS build profile with EAS environment `preview`.
- The older `dev/staging-user-live-backend-apk-20261101` branch changes that profile to EAS environment `production`; its staging OTA workflow also explicitly runs `eas env:exec production` and publishes using `--environment production`.
- Its app variant/package remains a staging identity, but the environment selection is materially different. Do not publish a `main`-built update to the existing `staging-user` channel until the installed staging build's environment, channel branch, runtime, and backend target are confirmed. Matching channel names alone do not prove backend compatibility.
- Do not silently switch a live-backend staging installation to preview credentials, or the reverse. This is an explicit compatibility decision requiring exact installed-artifact evidence.

These are Git/configuration findings, not proof of which artifact is currently installed in the staging workspace or live in Production. Exact deployed staging identity and visual branding still require artifact/device verification.

## Release decision

**BLOCK STAGING PROMOTION** for the three compared staging-user branches above. Their history is stale/diverged relative to canonical `main`. Preserve their unique commits for review, but do not merge or publish them as-is.

A clean RC branch `release/staging-current-main-rc-20261106` has been created from canonical `main` at the audited baseline. It is a source candidate only: no build, OTA, or backend/environment change has been made.

This gate checks Git ancestry only. A candidate that is not behind still requires full scope, regression, RC, runtime/channel compatibility, and visible verification before Production.
