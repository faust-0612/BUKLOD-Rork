const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const health = read('src/lib/buklodMainHealth.ts');
const agent = read('src/components/BuklodMainHealthAgent.tsx');
const layout = read('src/app/_layout.tsx');

const failures = [];

function requireText(source, token, label) {
  if (!source.includes(token)) failures.push(label + ': missing ' + token);
}

function forbidText(source, token, label) {
  if (source.includes(token)) failures.push(label + ': forbidden ' + token);
}

requireText(
  health,
  "'buklod_record_health_event_v1'",
  'Health event ingestion uses canonical BSOC RPC',
);
requireText(
  health,
  "'buklod_poll_recovery_commands_v1'",
  'Remote recovery polling uses canonical BSOC RPC',
);
requireText(
  health,
  "'buklod_record_recovery_verification_v1'",
  'Recovery result must be verified server-side',
);
requireText(
  health,
  'DEDUPE_WINDOW_MS = 5 * 60_000',
  'Client health signals have storm dedupe',
);
requireText(
  health,
  'MAX_QUEUE = 20',
  'Offline health queue is bounded',
);
requireText(
  health,
  'MAX_QUEUE_AGE_MS = 30 * 60_000',
  'Stale queued events expire',
);
requireText(
  health,
  "const QUEUE_PREFIX = '@buklod/main-health-v1/queue/'",
  'Health queue is user-scoped',
);
requireText(
  health,
  "privateContentFields: 'NOT_SUPPORTED'",
  'Health transport rejects private-content payload design',
);

for (const action of [
  'REQUEST_CLIENT_SESSION_REFRESH',
  'REQUEST_CLIENT_SYNC_RESUME',
  'REQUEST_CLIENT_ROUTE_RECOVERY',
  'REQUEST_CLIENT_PUSH_REFRESH',
  'REQUEST_CLIENT_ORG_RERESOLVE',
]) {
  requireText(
    health,
    action,
    'Remote action allowlist includes only named safe playbooks',
  );
}

for (const forbidden of [
  'ACCOUNT_DELETE',
  'PAYOUT',
  'COMMUNITY_FUND_RELEASE',
  'ROLE_GRANT',
  'OWNERSHIP_CHANGE',
  'BREAK_GLASS',
]) {
  forbidText(
    health.match(/remoteActionAllowlist:[\s\S]*?\] as const/)?.[0] ?? '',
    forbidden,
    'Remote action allowlist excludes destructive/risky mutation',
  );
}

requireText(
  agent,
  'ROUTE_RECOVERY_REQUIRES_LOCAL_CONTEXT',
  'Route recovery refuses blind reset/navigation',
);
requireText(
  agent,
  'PUSH_REFRESH_EXECUTOR_NOT_READY',
  'Push recovery fails closed until executor is proven',
);
requireText(
  agent,
  'if (!(await stillSameAccount()))',
  'Remote recovery guards account switching',
);
requireText(
  agent,
  'SYNC_STUCK_MS = 60_000',
  'Sync queue has stuck detection threshold',
);
requireText(
  agent,
  'LOCAL_RETRY_COOLDOWN_MS = 5 * 60_000',
  'Local self-heal has cooldown',
);
requireText(
  agent,
  'BSOC is optional. Main must continue to operate when it is down.',
  'Main has no BSOC runtime dependency',
);

requireText(
  layout,
  '<BuklodMainHealthAgent />',
  'Main health agent is mounted',
);
requireText(
  layout,
  'ROUTE_LOAD_TIMEOUT',
  'Root loading timeout is detected',
);
requireText(
  layout,
  '12_000',
  'Root loading is bounded',
);
requireText(
  layout,
  "router.replace('/buklod' as any)",
  'Loading failure has safe Community Wall fallback',
);
requireText(
  layout,
  "pathname: '/help' as any",
  'Unresolved loading has Help path',
);

for (const source of [health, agent]) {
  forbidText(source, 'C:\\', 'Active self-heal source must not write to C:');
}

if (failures.length) {
  console.error('BUKLOD MAIN CLOSED-LOOP SELF-HEAL R1 CONTRACT FAILED');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}

console.log('BUKLOD MAIN CLOSED-LOOP SELF-HEAL R1 CONTRACT PASS');
console.log('DETECT -> DIAGNOSE -> HEAL -> VERIFY -> ESCALATE');
console.log('PRIVATE_CONTENT_TRANSPORT=BLOCKED_BY_DESIGN');
console.log('REMOTE_PLAYBOOKS=SHADOW_UNTIL_NATIVE_E2E');
console.log('BSOC_RUNTIME_DEPENDENCY=NO');
