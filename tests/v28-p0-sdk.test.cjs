// Locked SDK integration with fake HTTP + memory storage. Never contacts production.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const root = path.resolve(__dirname, '..');
const tick = () => new Promise(r => setImmediate(r));
function source(file, imports = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const context = { module: { exports: {} }, exports: null, console, process, Promise, Date, Map, Set,
    Error, Response, Headers, URL, AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
    require: name => { if (name in imports) return imports[name]; throw new Error(`Unmocked import: ${name}`); }, ...globals };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context, { filename: file });
  return context.module.exports;
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function response(id) {
  const encode = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated' })}.test-signature`;
  return new Response(JSON.stringify({ access_token: token, refresh_token: `test-refresh-${id}`, token_type: 'bearer', expires_in: 3600,
    user: { id, aud: 'authenticated', role: 'authenticated', email: 'integration@example.invalid' } }), { status: 200, headers: { 'content-type': 'application/json' } });
}
async function setup(fetcher) {
  const transport = source('src/lib/buklodPerformanceFetch.ts', {}, { setTimeout: (f, ms) => setTimeout(f, ms === 10000 ? 25 : ms) });
  const values = new Map(), events = [], codes = [];
  const storage = { getItem: async k => values.get(k) ?? null, setItem: async (k,v) => { values.set(k,v); }, removeItem: async k => { values.delete(k); } };
  const client = createClient('https://sdk-integration.invalid', 'test-publishable-key', {
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, storage, storageKey: 'v28-sdk-integration' },
    global: { fetch: transport.createBuklodPerformanceFetch(fetcher) },
  });
  await client.auth.initialize();
  const listener = client.auth.onAuthStateChange((event, session) => { events.push({ event, userId: session?.user?.id }); });
  const timeout = source('src/lib/buklodAsyncTimeout.ts');
  const auth = source('src/lib/buklodAuthResilience.ts', {
    '@react-native-async-storage/async-storage': storage,
    '@/lib/buklodAsyncTimeout': timeout,
    '@/lib/supabase': { supabase: client },
    '@/lib/buklodDeferredHealth': { enqueueDeferredBuklodFailure: async code => { codes.push(code); } },
    '@/lib/buklodPerformanceFetch': transport,
    '@/lib/performance': { clearInflight() {}, clearRealtimeRegistry() {}, invalidateCache() {} },
  });
  return { client, auth, codes, values, events, close: async () => { listener.data.subscription.unsubscribe(); await client.auth.dispose(); } };
}
test('locked auth-js 2.112.2: hung grant times out, next credentials succeed, late grant cannot replace session', async () => {
  const late = deferred(); let calls = 0;
  const x = await setup(async () => ++calls === 1 ? late.promise : response('user-b'));
  try {
    const first = x.auth.signInWithPasswordResilient({ email: 'a@example.invalid', password: 'SECRET-A' });
    const concurrent = await x.auth.signInWithPasswordResilient({ email: 'b@example.invalid', password: 'SECRET-B' });
    assert.equal(concurrent.error.code, 'auth_in_progress');
    assert.match((await first).error.message, /timed out/); await tick();
    const second = await x.auth.signInWithPasswordResilient({ email: 'b@example.invalid', password: 'SECRET-B' });
    assert.equal(second.error, null); assert.equal(second.data.user.id, 'user-b');
    late.resolve(response('user-a')); await tick();
    assert.equal((await x.client.auth.getSession()).data.session.user.id, 'user-b');
    assert.equal(x.events.some(e => e.event === 'SIGNED_IN' && e.userId === 'user-a'), false);
    assert.equal(calls, 2); assert.deepEqual(x.codes, ['AUTH_REQUEST_TIMEOUT']);
  } finally { await x.close(); }
});
test('locked SDK: hanging password body cannot save partial/late session', async () => {
  const body = deferred(); let calls = 0;
  const x = await setup(async () => { calls++; return calls === 1 ? {
    status: 200, statusText: 'OK', headers: new Headers({ 'content-type': 'application/json' }), text: () => body.promise,
  } : response('user-b'); });
  try {
    const first = await x.auth.signInWithPasswordResilient({ email: 'a@example.invalid', password: 'SECRET-A' });
    assert.ok(first.error); assert.equal((await x.client.auth.getSession()).data.session, null); await tick();
    assert.equal((await x.auth.signInWithPasswordResilient({ email: 'b@example.invalid', password: 'SECRET-B' })).data.user.id, 'user-b');
    body.resolve(await response('user-a').text()); await tick();
    assert.equal((await x.client.auth.getSession()).data.session.user.id, 'user-b');
  } finally { await x.close(); }
});
test('locked SDK: explicit sign-out cancels pending grant and prevents resurrection', async () => {
  const late = deferred(); let grants = 0;
  const x = await setup(async url => String(url).includes('/logout') ? new Response(null, { status: 204 }) : ++grants === 1 ? late.promise : response('user-b'));
  try {
    const first = x.auth.signInWithPasswordResilient({ email: 'a@example.invalid', password: 'SECRET-A' });
    await tick(); await x.auth.signOutBuklodResilient(); assert.ok((await first).error);
    late.resolve(response('user-a')); await tick();
    assert.equal((await x.client.auth.getSession()).data.session, null);
    assert.equal((await x.auth.signInWithPasswordResilient({ email: 'b@example.invalid', password: 'SECRET-B' })).data.user.id, 'user-b');
  } finally { await x.close(); }
});
test('locked SDK: invalid credentials release login gate, retain safe reporting only', async () => {
  let calls = 0; const x = await setup(async () => ++calls === 1 ? new Response(JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }), {
    status: 400, headers: { 'content-type': 'application/json' },
  }) : response('user-b'));
  try {
    const first = await x.auth.signInWithPasswordResilient({ email: 'a@example.invalid', password: 'SECRET-A' });
    assert.equal(x.auth.isBuklodInvalidCredentialsError(first.error), true); await tick();
    assert.equal((await x.auth.signInWithPasswordResilient({ email: 'b@example.invalid', password: 'SECRET-B' })).data.user.id, 'user-b');
    assert.deepEqual(x.codes, ['AUTH_REQUEST_FAILED']); assert.equal(JSON.stringify(x.codes).includes('SECRET'), false);
  } finally { await x.close(); }
});
test('locked PostgREST SDK: signed-out queue waits for auth and for a server receipt', async () => {
  const payloads = []; let accepted = false;
  const x = await setup(async (url, init) => {
    if (String(url).includes('/auth/v1/token')) return response('user-b');
    if (String(url).includes('/rest/v1/rpc/buklod_record_health_event_v1')) {
      payloads.push(JSON.parse(init.body));
      assert.match(new Headers(init.headers).get('authorization'), /^Bearer /);
      return new Response(JSON.stringify(accepted ? { event_id: 'test-event-id' } : { pending: true }), { headers: { 'content-type': 'application/json' } });
    }
    throw new Error('Unexpected fake endpoint');
  });
  try {
    const values = new Map();
    const storage = { getItem: async k => values.get(k) ?? null, setItem: async (k,v) => { values.set(k,v); } };
    const queue = source('src/lib/buklodDeferredHealth.ts', { '@react-native-async-storage/async-storage': storage });
    const health = source('src/lib/buklodMainHealth.ts', {
      '@react-native-async-storage/async-storage': storage,
      'expo-constants': { expoConfig: { version: '1.3.4' } },
      'react-native': { Platform: { OS: 'android' } },
      '@/lib/supabase': { supabase: x.client },
      '@/lib/buklodAsyncTimeout': source('src/lib/buklodAsyncTimeout.ts'),
      '@/lib/buklodDeferredHealth': queue,
    });
    await health.reportBuklodMainHealthIssue({ category: 'LOADING', errorSignature: 'SECRET', safeErrorCode: 'PERSON' });
    await health.flushDeferredBuklodHealth('user-b'); assert.equal(payloads.length, 0);
    await x.auth.signInWithPasswordResilient({ email: 'b@example.invalid', password: 'SECRET-B' });
    await health.flushDeferredBuklodHealth('user-b'); assert.equal(payloads.length, 1);
    accepted = true; await health.flushDeferredBuklodHealth('user-b'); assert.equal(payloads.length, 2);
    assert.equal(payloads[0].p_client_event_id, payloads[1].p_client_event_id);
    await health.flushDeferredBuklodHealth('user-b'); assert.equal(payloads.length, 2);
    assert.equal(JSON.stringify(payloads).includes('SECRET'), false); assert.equal(JSON.stringify(payloads).includes('PERSON'), false);
  } finally { await x.close(); }
});
