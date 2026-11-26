#!/usr/bin/env bash
# Disposable PostgreSQL 17, fictional data only. Never connects to a remote server.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [ "$(id -u)" -eq 0 ]; then echo 'Run as an ordinary Ubuntu user, not root.' >&2; exit 2; fi
PG_BIN="${PG17_BIN:-/usr/lib/postgresql/17/bin}"
for bin in initdb pg_ctl psql; do test -x "$PG_BIN/$bin" || { echo "Missing PostgreSQL 17 binary: $bin" >&2; exit 2; }; done
"$PG_BIN/psql" --version | grep -E 'PostgreSQL\) 17\.'
node --test tests/abaka-doctrine-catalog.test.cjs tests/abaka-doctrine-genesis-integration-20261124.test.cjs tests/abaka-doctrine-unbounded-progression-20261126.test.cjs
umask 077
QA="$(mktemp -d /tmp/buklod-abaka-qa.XXXXXXXX)"
mkdir "$QA/socket"
cleanup() { "$PG_BIN/pg_ctl" -D "$QA/data" -m fast stop >/dev/null 2>&1 || true; rm -rf -- "$QA"; }
trap cleanup EXIT
"$PG_BIN/initdb" -D "$QA/data" --auth=trust --no-locale -U postgres >/dev/null
"$PG_BIN/pg_ctl" -D "$QA/data" -l "$QA/postgres.log" -o "-c listen_addresses='' -c unix_socket_directories=$QA/socket -p 55439" -w start
# env -i and explicit socket/port prevent inherited PG* / Supabase settings.
qa_sql() { env -i PATH=/usr/bin:/bin HOME="$QA" "$PG_BIN/psql" -X -w -h "$QA/socket" -p 55439 -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
qa_sql -Atc "select case when inet_server_addr() is null then 'PRIVATE_SOCKET_ONLY' else 'UNSAFE' end" | grep -Fx PRIVATE_SOCKET_ONLY
for file in \
 tests/fixtures/abaka-doctrine-postgres17-20261126.sql \
 supabase/migrations/20260902095300_show_faith_abc_points_v1.sql \
 supabase/migrations/20261124005500_abaka_continuing_doctrine_rewards.sql \
 supabase/migrations/20261124020500_abaka_doctrine_admin_authoring.sql \
 supabase/tests/abaka_doctrine_rewards_security_20261124.sql \
 supabase/tests/abaka_doctrine_admin_authoring_20261124.sql \
 supabase/tests/abaka_doctrine_behavior_isolated_20261126.sql; do
  qa_sql -f "$file"
done
echo 'ABAKA_ISOLATED_FIXTURE_QA_PASS (NOT production release approval)'
