import { createBuklodR4RequestShield } from '@/lib/buklodR4RequestShield';

const mediaUrl = 'https://example.supabase.co/rest/v1/rpc/get_buklod_post_media_v2';
const updateUrl = 'https://example.supabase.co/rest/v1/rpc/set_buklod_post_media_v5';

function mediaRequest(token = 'session-a', ids = ['post-a', 'post-b']) {
  return {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_post_ids: ids }),
  };
}

beforeEach(() => {
  const state = (globalThis as any).__BUKLOD_R4_REQUEST_SHIELD__;
  state?.cache.clear();
  state?.inFlight.clear();
});

describe('BUKLOD Community Wall burst-read shield', () => {
  it('coalesces 30 simultaneous v2 reads and a near-immediate remount', async () => {
    const upstream = jest.fn(async () => new Response('[]', { status: 200 }));
    const wrapped = createBuklodR4RequestShield(upstream as typeof fetch);
    const replies = await Promise.all(
      Array.from({ length: 30 }, () => wrapped(mediaUrl, mediaRequest())),
    );
    expect(replies.every(result => result.ok)).toBe(true);
    expect(upstream).toHaveBeenCalledTimes(1);
    await wrapped(mediaUrl, mediaRequest());
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('never shares user-scoped reactions across bearer tokens or post sets', async () => {
    const upstream = jest.fn(async () => new Response('[]', { status: 200 }));
    const wrapped = createBuklodR4RequestShield(upstream as typeof fetch);
    await wrapped(mediaUrl, mediaRequest('session-a'));
    await wrapped(mediaUrl, mediaRequest('session-b'));
    await wrapped(mediaUrl, mediaRequest('session-a', ['post-c']));
    expect(upstream).toHaveBeenCalledTimes(3);
  });

  it('invalidates after successful media writes without caching the write', async () => {
    let readCount = 0;
    let writeCount = 0;
    const upstream = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input) === updateUrl) {
        writeCount += 1;
        return new Response('1', { status: 200 });
      }
      readCount += 1;
      return new Response('[]', { status: 200 });
    });
    const wrapped = createBuklodR4RequestShield(upstream as typeof fetch);
    await wrapped(mediaUrl, mediaRequest());
    await wrapped(mediaUrl, mediaRequest());
    expect(readCount).toBe(1);
    await wrapped(updateUrl, { method: 'POST', body: '{}' });
    await wrapped(mediaUrl, mediaRequest());
    expect(writeCount).toBe(1);
    expect(readCount).toBe(2);
  });

  it('does not let a slow pre-mutation response replace fresher media', async () => {
    let resolveSlow!: (value: Response) => void;
    let reads = 0;
    const upstream = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input) === updateUrl) return new Response('1', { status: 200 });
      reads += 1;
      if (reads === 1) {
        return new Promise<Response>(resolve => { resolveSlow = resolve; });
      }
      return new Response('fresh', { status: 200 });
    });
    const wrapped = createBuklodR4RequestShield(upstream as typeof fetch);
    const slow = wrapped(mediaUrl, mediaRequest());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(reads).toBe(1);

    await wrapped(updateUrl, { method: 'POST', body: '{}' });
    expect(await (await wrapped(mediaUrl, mediaRequest())).text()).toBe('fresh');
    resolveSlow(new Response('stale', { status: 200 }));
    expect(await (await slow).text()).toBe('stale');
    expect(await (await wrapped(mediaUrl, mediaRequest())).text()).toBe('fresh');
    expect(reads).toBe(2);
  });
});
