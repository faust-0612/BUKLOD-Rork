#!/usr/bin/env bash
# Disposable PostgreSQL 17, fictional data only. Never connects to a remote server.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [ "$(id -u)" -eq 0 ]; then echo 'Run as an ordinary Ubuntu user, not root.' >&2; exit 2; fi
PG_BIN="${PG17_BIN:-/usr/lib/postgresql/17/bin}"
for bin in initdb pg_ctl psql; do test -x "$PG_BIN/$bin" || { echo "Missing PostgreSQL 17 binary: $bin" >&2; exit 2; }; done
"$PG_BIN/psql" --version | grep -E 'PostgreSQL\) 17\.'
node --test tests/children-teaching-faith-security-20261126.test.mjs tests/faith-accomplishment-report-v2.test.mjs tests/faith-monitoring-named-period.test.cjs
umask 077
QA="$(mktemp -d /tmp/buklod-children-teaching-qa.XXXXXXXX)"
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
 supabase/migrations/20261101044500_faith_monitoring_named_period_reports_v1.sql \
 supabase/migrations/20261125141700_children_story_verified_accomplishments.sql \
 supabase/migrations/20261125141800_faith_accomplishment_report_v2.sql \
 supabase/migrations/20261125142000_faith_accomplishment_named_notifications.sql \
 supabase/migrations/20261126113000_children_teaching_verified_sessions_v1.sql \
 supabase/migrations/20261126113100_faith_children_teaching_report_v3.sql \
 tests/fixtures/faith-accomplishment-postgres17-verification-20261125.sql \
 supabase/tests/children_teaching_behavior_isolated_20261126.sql; do
  qa_sql -f "$file"
done
echo 'FAITH_ACCOMPLISHMENT_AND_CHILDREN_TEACHING_ISOLATED_FIXTURE_QA_PASS (NOT production release approval)'
