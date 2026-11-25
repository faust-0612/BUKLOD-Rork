# Independent Genesis 2.0.6 local QA (temporary, no publication)

Billing lock prevents GitHub-hosted jobs from starting. Do not re-run unchanged CI or change production, account billing, shared Supabase, or Expo channel mappings. This helper is on a separate tools branch. It is **not** a publishable OTA and does not run automatically.

## Prerequisites

A Linux/WSL machine with Git, Node 22, npm, Python 3, curl, unzip and sha256sum; network access to GitHub, npm and the Godot release host, adequate disk and memory, and (for --export) an authorized Expo account authenticated locally. No new cloud service, Supabase project, subscription, or payment is required by this script itself. Expo usage allowances still apply to any later upload.

Download the script outside the app checkout, clone/fetch the existing repository, and check out the exact candidate in a fresh worktree. Execute:

```bash
git clone --branch integration/genesis-206-backlog-staging-20261125 https://github.com/faust-0612/BUKLOD-Rork.git
cd BUKLOD-Rork
git checkout --detach 71e33b4cfa202a6e02bfb479b89504e7729b363e
bash /path/to/local-genesis-206-staging-qa.sh --qa
# On an authenticated local environment, after the first run, use a fresh clean checkout:
bash /path/to/local-genesis-206-staging-qa.sh --export
```

The launcher validates component scopes, protected-feature contracts, exact native/source identity, original signed APK proof, original staging release tests, Health tests, additional regression tests, TypeScript, public Godot pack integrity and headless smoke tests. --export also checks Expo preview project/package/runtime, channel mapping separation, latest staging group, and Android export with the exact public Godot pack. Secrets are not printed, and the temporary preview env file is removed. Keep evidence private. A failure stops immediately. No publish command exists in this launcher. It has not been executed in a full Linux environment yet. Local execution is not a substitute for all mandatory source, runtime and release gates until their evidence is reconciled. The backlog is still incomplete; never publish this candidate as complete.

Faith QA branch `qa/genesis-206-faith-accomplishments-20261125` requires a local disposable PostgreSQL 17 instance using only its fictional fixtures. Do not run its migrations against shared Supabase. Exact isolated workflow is `.github/workflows/genesis-206-faith-accomplishments-isolated-qa.yml`.

Direct EAS publication is a separate subsequent action: only after full exact-candidate verification and owner-authorized staging release, with provider mapping, prior update, Android runtime, and post-publish readback checked. Never use production channel. No action on GitHub billing is required to use local QA.
