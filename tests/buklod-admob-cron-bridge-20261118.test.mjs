import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const db = read('supabase/migrations/20261118015337_buklod_admob_internal_cron_bridge_20261118.sql');
const edge = read('supabase/functions/buklod-admob-cron-bridge-v1/index.ts');
const old = read('supabase/functions/buklod-admob-revenue-preview-sync/index.ts');
const workflow = read('.github/workflows/buklod_admob_provisional_sync.yml');

test('DB securely generates dedicated random token only in encrypted Vault; never checks it into source',()=>{
  assert.match(db,/extensions\.gen_random_bytes\(32\)/);
  assert.match(db,/vault\.create_secret\(/);
  assert.match(db,/pg_catalog\.sha256/);
  assert.match(db,/vault\.decrypted_secrets/);
  assert.match(db,/BUKLOD_ADMOB_INTERNAL_SCHEDULER_KEY/);
  assert.match(db,/revoke all on function public\.buklod_authorize_admob_cron_token_v1\(text\) from public,anon,authenticated/);
  assert.match(db,/revoke all on function private\.buklod_admob_internal_cron_dispatch_v1\(\) from public,anon,authenticated,service_role/);
  assert.match(db,/net\.http_post/);
  assert.doesNotMatch(db,/cash_ledger|credit_wallet|admin_finalize_buklod|withdrawal_enabled/i);
});
test('non-JWT bridge validates dedicated Vault token BEFORE forwarding trusted service request',()=>{
  assert.match(edge,/verify_jwt=false/);
  assert.match(edge,/\^\[0-9a-f\]\{64\}\$/);
  assert.match(edge,/buklod_authorize_admob_cron_token_v1/);
  assert.match(edge,/if \(authError \|\| allowed !== true\) return json\(\{ error: 'Unauthorized' \}, 401\)/);
  assert.match(edge,/buklod-admob-revenue-preview-sync/);
  assert.match(old,/verify_jwt=true/);
  assert.match(old,/hasGatewayVerifiedServiceRoleClaims\(token\)/);
  assert.match(edge,/report\?\.cash_credited !== false/);
  assert.doesNotMatch(edge,/admin_set_buklod|payout_processing|credit_wallet|process_withdrawal/);
});
test('after enabling internal DB cron, GitHub is manual recovery only; no duplicate polling',()=>{
  assert.doesNotMatch(workflow,/^\s*schedule:\s*$/m);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/BUKLOD_ADMOB_SYNC_ENABLED == 'true'/);
});

test('trusted scheduler exposes only safe AdMob failure stage/status and never OAuth bodies',()=>{
  assert.match(edge,/source_stage:/);
  assert.match(edge,/source_http_status:/);
  assert.match(edge,/fault\?\.stage/);
  assert.doesNotMatch(edge,/JSON\.stringify\(fault\)/);
});

test('only authenticated cron caller receives allowlisted OAuth failure class',()=>{
  assert.match(edge,/oauth_error_code:/);
  assert.match(edge,/invalid_grant/);
  assert.match(edge,/fault\?\.oauth_error_code/);
  assert.doesNotMatch(edge,/error_description|JSON\.stringify\(fault\)/);
});
