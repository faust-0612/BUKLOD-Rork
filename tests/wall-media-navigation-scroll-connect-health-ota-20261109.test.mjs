import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('navigation-scroll: stale restricted-route checks cannot redirect from patient Health or public Home', async () => {
  const source = read('src/components/BuklodFocusAppRouteGuard.tsx');
  const fnStart = source.indexOf('export default function BuklodFocusAppRouteGuard()');
  assert.ok(fnStart >= 0);
  let pathname = '/profile/buklod-business';
  let resolveDenied = null;
  const redirects = [];
  const checkingRef = { current: '' };
  const verifyFocusApp = () => new Promise(resolve => { resolveDenied = resolve; });
  const runGuard = runInNewContext(
    source.slice(fnStart).replace('export default function', 'function') +
      '\nBuklodFocusAppRouteGuard;',
    {
      useEffect: callback => callback(),
      useRef: () => checkingRef,
      usePathname: () => pathname,
      useBuklodAccess: () => ({ loading: false, verifyFocusApp }),
      focusAppForPathname: path => path === '/profile/buklod-business' ? 'business' : null,
      router: { replace: path => redirects.push(path) },
    },
  );

  runGuard();
  const firstDenied = resolveDenied;
  assert.equal(typeof firstDenied, 'function');
  pathname = '/profile/buklod-health';
  runGuard();
  firstDenied({ canSee: false });
  await Promise.resolve();
  assert.deepEqual(redirects, [], 'patient route must not be bounced out by stale authorization');

  pathname = '/profile/buklod-business';
  runGuard();
  const secondDenied = resolveDenied;
  pathname = '/hub';
  runGuard();
  secondDenied({ canSee: false });
  await Promise.resolve();
  assert.deepEqual(redirects, [], 'public Home must not be bounced out by stale authorization');

  pathname = '/profile/buklod-business';
  runGuard();
  resolveDenied({ canSee: false });
  await Promise.resolve();
  assert.deepEqual(redirects, ['/profile/focus-apps'], 'other privileged routes must still deny access');
});

test('wall-media: compact text preserves primary real photo/video lifecycle and scroll feed', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const card = read('src/components/BuklodCommunityWallPostCard.tsx');
  const marites = read('src/components/BuklodMaritesBoard.tsx');
  assert.match(wall, /<FlashList/);
  assert.match(wall, /<BuklodMaritesBoard/);
  assert.match(wall, /<BuklodCommunityWallPostCard/);
  assert.match(card, /onPressPhoto/);
  assert.match(card, /media\.find\(/);
  assert.match(card, /video\?\.media_url/);
  assert.match(card, /overflow: 'visible'/);
  assert.match(marites, /fontSize:\s*16/);
});

test('connect: font density keeps actual send, attachment and scroll recovery controls', () => {
  const chat = read('src/components/BuklodConnectThread.tsx');
  assert.match(chat, /onSend=\{send\}/);
  assert.match(chat, /onAttachPress=\{handleAttachPress\}/);
  assert.match(chat, /onQuickReaction=\{emoji =>/);
  assert.match(chat, /onScrollToIndexFailed=/);
  assert.match(chat, /listRef\.current\?\.scrollToOffset/);
  assert.match(chat, /body:\s*\{\s*color: theme\.textPrimary,\s*fontSize: 16/);
});
