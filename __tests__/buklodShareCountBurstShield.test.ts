import { createBuklodR4RequestShield } from '@/lib/buklodR4RequestShield';

const countUrl = 'https://example.supabase.co/rest/v1/rpc/buklod_internal_share_count_v2';
const mutationUrl = 'https://example.supabase.co/rest/v1/rpc/buklod_internal_share_post_v2';
function countRequest(token = 'user-A', postId = 'post-1') {
  return {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_post_id: postId }),
  };
}

beforeEach(() => {
  const globalState = (globalThis as any).__BUKLOD_R4_REQUEST_SHIELD__;
  globalState?.cache.clear();
  globalState?.inFlight.clear();
});

describe('BUKLOD share count RPC surge shield', () => {
  it('collapses 40 simultaneous same-session, same-post reads', async () => {
    const base = jest.fn(async () => new Response('3', { status: 200 }));
    const request = createBuklodR4RequestShield(base as typeof fetch);
    const replies = await Promise.all(
      Array.from({ length: 40 }, () => request(countUrl, countRequest())),
    );
    expect(replies.every(reply => reply.ok)).toBe(true);
    expect(base).toHaveBeenCalledTimes(1);
    expect(await (await request(countUrl, countRequest())).text()).toBe('3');
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('isolates another signed-in user and different post', async () => {
    const base = jest.fn(async () => new Response('2', { status: 200 }));
    const request = createBuklodR4RequestShield(base as typeof fetch);
    await request(countUrl, countRequest('user-A', 'post-1'));
    await request(countUrl, countRequest('user-B', 'post-1'));
    await request(countUrl, countRequest('user-A', 'post-2'));
    expect(base).toHaveBeenCalledTimes(3);
  });

  it('does not cache a share mutation and refetches the count after success', async () => {
    let reads = 0;
    let writes = 0;
    const base = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input) === mutationUrl) {
        writes += 1;
        return new Response('1', { status: 200 });
      }
      reads += 1;
      return new Response(String(reads), { status: 200 });
    });
    const request = createBuklodR4RequestShield(base as typeof fetch);
    await request(countUrl, countRequest());
    await request(countUrl, countRequest());
    expect(reads).toBe(1);
    await request(mutationUrl, { method: 'POST', body: '{}' });
    await request(countUrl, countRequest());
    expect(writes).toBe(1);
    expect(reads).toBe(2);
  });

  it('keeps safe cached presentation count if mutation failed', async () => {
    let reads = 0;
    const base = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input) === mutationUrl) return new Response('bad', { status: 500 });
      reads += 1;
      return new Response('5', { status: 200 });
    });
    const request = createBuklodR4RequestShield(base as typeof fetch);
    await request(countUrl, countRequest());
    await request(mutationUrl, { method: 'POST', body: '{}' });
    await request(countUrl, countRequest());
    expect(reads).toBe(1);
  });
});
