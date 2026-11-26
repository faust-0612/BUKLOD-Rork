#!/usr/bin/env bash
# Disposable PostgreSQL 17, fictional data only. Never connects to a remote server.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
if [ "$(id -u)" -eq 0 ]; then echo 'Run as an ordinary Ubuntu user, not root.' >&2; exit 2; fi
PG_BIN="${PG17_BIN:-/usr/lib/postgresql/17/bin}"
for bin in initdb pg_ctl psql; do test -x "$PG_BIN/$bin" || { echo "Missing PostgreSQL 17 binary: $bin" >&2; exit 2; }; done
"$PG_BIN/psql" --version | grep -E 'PostgreSQL\) 17\.'
node --test tests/saliksik-adaptive-mastery-20261112.test.mjs tests/saliksik-auto-research-e2e-20261124.test.mjs tests/saliksik-backend-security-20261112.test.mjs tests/saliksik-cluster-faith-20261112.test.mjs tests/saliksik-cluster-faith-auto-research-20261124.test.mjs tests/saliksik-cluster-faith-manuscript-20261124.test.mjs tests/saliksik-manuscript-unlock-20261124.test.mjs tests/saliksik-sql-pg-qa.test.mjs tests/saliksik-written-master-20261113.test.mjs tests/saliksik-faith-canonical-integration-20261126.test.mjs
umask 077
QA="$(mktemp -d /tmp/buklod-saliksik-qa.XXXXXXXX)"
mkdir "$QA/socket"
cleanup() { "$PG_BIN/pg_ctl" -D "$QA/data" -m fast stop >/dev/null 2>&1 || true; rm -rf -- "$QA"; }
trap cleanup EXIT
"$PG_BIN/initdb" -D "$QA/data" --auth=trust --no-locale -U postgres >/dev/null
"$PG_BIN/pg_ctl" -D "$QA/data" -l "$QA/postgres.log" -o "-c listen_addresses='' -c unix_socket_directories=$QA/socket -p 55439" -w start
# env -i and explicit socket/port prevent inherited PG* / Supabase settings.
qa_sql() { env -i PATH=/usr/bin:/bin HOME="$QA" "$PG_BIN/psql" -X -w -h "$QA/socket" -p 55439 -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
qa_sql -Atc "select case when inet_server_addr() is null then 'PRIVATE_SOCKET_ONLY' else 'UNSAFE' end" | grep -Fx PRIVATE_SOCKET_ONLY
for file in \
 tests/fixtures/saliksik_pg_seed.sql \
 supabase/migrations/20261112221000_saliksik_private_vault_objective_mastery_r1.sql \
 supabase/tests/saliksik_private_vault_objective_mastery_r1.sql \
 supabase/migrations/20261113221000_saliksik_written_master_reward_r2.sql \
 supabase/tests/saliksik_written_master_r2.sql \
 tests/fixtures/saliksik_pg_integration.sql \
 supabase/migrations/20261124035000_saliksik_complete_manuscript_unlock_r3.sql \
 supabase/tests/saliksik_complete_manuscript_unlock_r3.sql \
 supabase/migrations/20261124051000_saliksik_r4_auto_research_corpus.sql \
 supabase/migrations/20261124052000_saliksik_r4_independent_master_grade.sql \
 supabase/tests/saliksik_auto_research_security_r4.sql \
 tests/fixtures/saliksik_faith_bridge_postgres17_20261126.sql \
 supabase/migrations/20261101044500_faith_monitoring_named_period_reports_v1.sql \
 supabase/migrations/20261125141800_faith_accomplishment_report_v2.sql \
 supabase/migrations/20261125142000_faith_accomplishment_named_notifications.sql \
 tests/fixtures/saliksik_r4_auto_pg_integration.sql \
 supabase/tests/saliksik_faith_canonical_integration_20261126.sql; do
  qa_sql -f "$file"
done
echo 'SALIKSIK_ISOLATED_FIXTURE_QA_PASS (NOT production release approval)'
