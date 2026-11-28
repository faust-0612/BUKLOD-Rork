#!/usr/bin/env bash
# Cumulative QA only: no EAS, Supabase network, deployment, or package downloads.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
expected="${1:?Pass the exact expected candidate SHA}"
actual="$(git rev-parse HEAD)"
test "$actual" = "$expected" || { echo "Wrong HEAD: $actual" >&2; exit 2; }
git diff --quiet && git diff --cached --quiet || { echo "Tracked worktree changes; abort." >&2; exit 2; }
echo "GENESIS_QA_SHA=$actual"
node --version
# Reuse existing matching dependency installation; never install automatically.
if [ ! -x node_modules/.bin/tsc ]; then
  deps="${BUKLOD_QA_DEPS_ROOT:-$HOME/projects/BUKLOD-staging-QA}"
  if [ ! -x "$deps/node_modules/.bin/tsc" ] || ! cmp -s package-lock.json "$deps/package-lock.json" || ! cmp -s package.json "$deps/package.json"; then
    echo "Matching installed dependencies required: set BUKLOD_QA_DEPS_ROOT to the existing verified checkout." >&2
    exit 2
  fi
  if [ -e node_modules ] || [ -L node_modules ]; then echo "Existing incomplete node_modules; no overwrite." >&2; exit 2; fi
  ln -s "$(realpath "$deps/node_modules")" node_modules
fi
# Independent groups all run even if one fails. Never report an aggregate pass on a failure.
failures=()
export PAGER=cat PSQL_PAGER=cat
run_check() {
  local name="$1"; shift
  if "$@"; then echo "QA_PASS=$name"; else local rc=$?; echo "QA_FAIL=$name exit=$rc" >&2; failures+=("$name:$rc"); fi
}
run_check source-regression node --test \
 tests/admin-privacy-moderation-ui-source.test.cjs \
 tests/kl-dictionary-expansion-20261119.test.mjs \
 tests/kl-series-auto-dictionary-20261126.test.mjs \
 tests/kl-generator-supabase-security-failover.test.mjs \
 tests/genesis-206-staging-points-readonly-20261124.test.mjs \
 tests/buklod-points-live-backend-compatible-staging-20261124.test.mjs \
 tests/cluster-connect-notifications-points-20261108.test.mjs \
 tests/buklod-ad-opportunities.test.cjs \
 tests/connect-inbox-ads-guard-20261123.test.mjs \
 tests/connect-inbox-notification-navigation-20261123.test.mjs \
 tests/connect-inbox-realtime-staging-20261123.test.mjs \
 tests/messenger-inbox-density-20261117.test.mjs \
 tests/marites-wall-upload-behavior-20261124.test.mjs \
 tests/marites-wall-upload-fastpath-20261124.test.mjs \
 tests/word-bible-navigation-20261123.test.cjs \
 tests/word-scripture-link-20261123.test.cjs \
 tests/genesis-main-home-no-empire-20261124.test.mjs \
 tests/genesis-navigation-auth-kingdom-retirement-20261124.test.mjs \
 tests/navigation-v2-ads-preservation.test.mjs \
 tests/dashboard-ad-navigation-prewarm-20261116.test.mjs \
 tests/dashboard-navigation-auth-20261117.test.mjs \
 tests/buklod-native-ad-navigation-scroll.test.mjs \
 tests/admob-native-video-prefetch-20261114.test.mjs \
 tests/genesis-wall-connect-ads-navigation-quiz-20261120.test.mjs \
 tests/children-stories-navigation-ad-safety.test.mjs \
 tests/protected-feature-lock.test.mjs \
 tests/health-center-consultation-card-20261110.test.mjs \
 tests/nov14-imci-health-flow.test.mjs \
 tests/abaka-doctrine-catalog.test.cjs \
 tests/abaka-doctrine-genesis-integration-20261124.test.cjs \
 tests/abaka-doctrine-unbounded-progression-20261126.test.cjs \
 tests/academy-auth-navigation-security-20261126.test.mjs \
 tests/buklod-academy-automated-oversight.test.mjs \
 tests/buklod-academy-genesis-isolation.test.mjs \
 tests/buklod-academy-iso21001-evidence-gate.test.mjs \
 tests/buklod-academy-iso21001-quality-pack.test.mjs \
 tests/buklod-academy-owner-quality-overview.test.mjs \
 tests/buklod-academy-rework-pdf-recovery.test.mjs \
 tests/buklod-academy-staging-contract.test.mjs \
 tests/buklod-university-completion-motion.test.mjs \
 tests/children-teaching-faith-security-20261126.test.mjs \
 tests/faith-accomplishment-named-notifications-20261125.test.mjs \
 tests/faith-accomplishment-report-v2.test.mjs \
 tests/faith-monitoring-named-period.test.cjs \
 tests/named-formation-submission-notifications-20261125.test.mjs \
 tests/saliksik-adaptive-mastery-20261112.test.mjs \
 tests/saliksik-auto-research-e2e-20261124.test.mjs \
 tests/saliksik-backend-security-20261112.test.mjs \
 tests/saliksik-cluster-faith-20261112.test.mjs \
 tests/saliksik-cluster-faith-auto-research-20261124.test.mjs \
 tests/saliksik-cluster-faith-manuscript-20261124.test.mjs \
 tests/saliksik-faith-canonical-integration-20261126.test.mjs \
 tests/saliksik-manuscript-unlock-20261124.test.mjs \
 tests/saliksik-sql-pg-qa.test.mjs \
 tests/saliksik-written-master-20261113.test.mjs \
 tests/genesis-206-cumulative-runtime-boundary-20261126.test.mjs
run_check kl-postgres-fixture bash scripts/test-kl-series-dictionary-local.sh "$actual"
run_check typescript env NODE_OPTIONS=--max-old-space-size=4096 node_modules/.bin/tsc --noEmit
if [ "${#failures[@]}" -ne 0 ]; then printf 'GENESIS_CUMULATIVE_QA_FAILED %s\n' "${failures[@]}" >&2; exit 1; fi
echo 'GENESIS_CUMULATIVE_SOURCE_QA_PASS (NOT production or staging release approval)'
