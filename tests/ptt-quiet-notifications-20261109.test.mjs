import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(path, 'utf8');

test('routine PTT is excluded from the notification inbox and both unread counters', () => {
  const inbox = read('src/app/notifications/index.tsx');
  const native = read('src/providers/NotificationProvider.tsx');
  const web = read('src/providers/NotificationProvider.web.tsx');

  assert.match(inbox, /\.eq\('user_id',user\.id\)\.neq\('kind','ptt_incoming'\)/);
  assert.match(native, /\.is\('read_at',null\)\.neq\('kind','ptt_incoming'\)/);
  assert.match(web, /\.neq\('kind', 'ptt_incoming'\)/);
  assert.match(native, /if\(kind==='ptt_incoming'\)return;/);
  assert.match(native, /&& kind!=='ptt_incoming'/);

  // User-requested mark-all still clears old invisible entries without
  // deleting records or modifying the push-receive transport.
  assert.match(native, /\.update\(\{read_at:new Date\(\)\.toISOString\(\)\}\)/);
});

test('only normal PTT is quiet; Priority, SOS and other alerts remain visible', async () => {
  const source = read('src/lib/pushNotifications.ts');
  const marker = 'handleNotification: async notification => {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1);
  const bodyStart = start + marker.length;
  const bodyEnd = source.indexOf('\n  },\n});', bodyStart);
  assert.ok(bodyEnd > bodyStart);
  const handler = vm.runInNewContext(
    '(async function(notification) {' + source.slice(bodyStart, bodyEnd) + '\n})'
  );
  const notice = kind => handler({ request: { content: { data: { kind } } } });

  const normal = await notice('ptt_incoming');
  for (const key of ['shouldShowBanner','shouldShowList','shouldSetBadge','shouldPlaySound']) {
    assert.equal(normal[key], false, key);
  }
  for (const kind of ['ptt_sos','ptt_priority','community_emergency']) {
    const urgent = await notice(kind);
    for (const key of ['shouldShowBanner','shouldShowList','shouldSetBadge','shouldPlaySound']) {
      assert.equal(urgent[key], true, kind + ':' + key);
    }
  }
  const chat = await notice('direct_message');
  assert.equal(chat.shouldShowBanner, true);
  assert.equal(chat.shouldSetBadge, true);
});

test('PTT receive, background task and emergency transport are untouched by notification filtering', () => {
  const background = read('src/ptt/buklodPttBootstrap.ts');
  const runtime = read('src/ptt/buklodPttRuntime.ts');
  const duty = read('src/ptt/buklodPttDutyNotification.ts');
  const push = read('supabase/functions/push/index.ts');

  assert.match(background, /TaskManager\.defineTask\(TASK/);
  assert.match(background, /await handleBuklodPttPush\(payload\)/);
  assert.match(runtime, /export async function pttDown/);
  assert.match(runtime, /export async function pttUp/);
  assert.match(duty, /kind: 'ptt_duty'/);
  assert.match(push, /buklod_ptt_delivery: 'visible'/);
  assert.match(push, /buklod_ptt_delivery: 'headless'/);
  assert.match(push, /'ptt_incoming', 'ptt_priority', 'ptt_sos'/);
});
