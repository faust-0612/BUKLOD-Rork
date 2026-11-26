#!/usr/bin/env bash
# Disposable PostgreSQL 17, fictional data only. Never connects to a remote server.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [ "$(id -u)" -eq 0 ]; then echo 'Run as an ordinary Ubuntu user, not root.' >&2; exit 2; fi
PG_BIN="${PG17_BIN:-/usr/lib/postgresql/17/bin}"
for bin in initdb pg_ctl psql; do test -x "$PG_BIN/$bin" || { echo "Missing PostgreSQL 17 binary: $bin" >&2; exit 2; }; done
"$PG_BIN/psql" --version | grep -E 'PostgreSQL\) 17\.'
node --test tests/academy-auth-navigation-security-20261126.test.mjs tests/buklod-academy-automated-oversight.test.mjs tests/buklod-academy-genesis-isolation.test.mjs tests/buklod-academy-iso21001-evidence-gate.test.mjs tests/buklod-academy-iso21001-quality-pack.test.mjs tests/buklod-academy-owner-quality-overview.test.mjs tests/buklod-academy-rework-pdf-recovery.test.mjs tests/buklod-academy-staging-contract.test.mjs tests/buklod-university-completion-motion.test.mjs
umask 077
QA="$(mktemp -d /tmp/buklod-academy-qa.XXXXXXXX)"
mkdir "$QA/socket"
cleanup() { "$PG_BIN/pg_ctl" -D "$QA/data" -m fast stop >/dev/null 2>&1 || true; rm -rf -- "$QA"; }
trap cleanup EXIT
"$PG_BIN/initdb" -D "$QA/data" --auth=trust --no-locale -U postgres >/dev/null
"$PG_BIN/pg_ctl" -D "$QA/data" -l "$QA/postgres.log" -o "-c listen_addresses='' -c unix_socket_directories=$QA/socket -p 55439" -w start
# env -i and explicit socket/port prevent inherited PG* / Supabase settings.
qa_sql() { env -i PATH=/usr/bin:/bin HOME="$QA" "$PG_BIN/psql" -X -w -P pager=off -h "$QA/socket" -p 55439 -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
qa_sql -Atc "select case when inet_server_addr() is null then 'PRIVATE_SOCKET_ONLY' else 'UNSAFE' end" | grep -Fx PRIVATE_SOCKET_ONLY
for file in \
 tests/fixtures/faith-accomplishment-postgres17-20261125.sql \
 tests/fixtures/children_teaching_postgres17_20261126.sql \
 tests/fixtures/academy_postgres17_20261126.sql \
 supabase/migrations/20261124020000_buklod_university_internal_academic_r1.sql \
 supabase/migrations/20261124021000_buklod_academy_saliksik_research_bridge.sql \
 supabase/migrations/20261124022000_buklod_academy_private_signature_policy.sql \
 supabase/migrations/20261124023000_buklod_academy_verified_uc_events_r1.sql \
 supabase/migrations/20261124024000_buklod_academy_completion_on_uc_r1.sql \
 supabase/migrations/20261124025000_buklod_academy_uc_realtime_r1.sql \
 supabase/migrations/20261124030000_buklod_academy_source_validator_registry.sql \
 supabase/migrations/20261124033000_buklod_academy_automatic_research_faculty_v2.sql \
 supabase/migrations/20261124034000_buklod_academy_quality_overview_v1.sql \
 supabase/tests/academy_verified_uc_isolated_20261126.sql; do
  qa_sql -f "$file"
done
echo 'ACADEMY_ISOLATED_FIXTURE_QA_PASS (NOT production release approval)'
