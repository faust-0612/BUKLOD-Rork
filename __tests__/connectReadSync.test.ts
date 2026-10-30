import { createBuklodR4RequestShield } from '@/lib/buklodR4RequestShield';
import { notifyConnectRead, subscribeConnectRead } from '@/lib/connectReadSync';

const prefix = 'https://example.supabase.co/rest/v1/rpc/';
const rpc = (name: string) => prefix + name;
const args = { method: 'POST', headers: { Authorization: 'Bearer user-a' }, body: '{}' };

beforeEach(() => {
  const state = (globalThis as any).__BUKLOD_R4_REQUEST_SHIELD__;
  state?.cache.clear();
  state?.inFlight.clear();
});

describe('Connect read synchronization', () => {
  it('notifies subscribers only after the caller confirms a read and allows cleanup', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeConnectRead(id => seen.push(id));
    notifyConnectRead('profile-a');
    unsubscribe();
    notifyConnectRead('profile-b');
    expect(seen).toEqual(['profile-a']);
  });

  it.each([
    ['buklod_connect_mark_direct_read', 'buklod_connect_personal_threads'],
    ['buklod_connect_mark_scope_read', 'buklod_connect_community_rooms'],
  ])('invalidates cached %s inbox and global unread after confirmed write', async (mark, inbox) => {
    const reads: Record<string, number> = {};
    const fetcher = jest.fn(async (input: RequestInfo | URL) => {
      const name = String(input).split('/').pop()!;
      if (name === mark) return new Response('null', { status: 200 });
      reads[name] = (reads[name] ?? 0) + 1;
      return new Response(String(reads[name]), { status: 200 });
    });
    const shield = createBuklodR4RequestShield(fetcher as typeof fetch);
    await shield(rpc(inbox), args);
    await shield(rpc('buklod_connect_unread_count'), args);
    await shield(rpc(inbox), args);
    await shield(rpc('buklod_connect_unread_count'), args);
    expect(reads[inbox]).toBe(1);
    expect(reads.buklod_connect_unread_count).toBe(1);
    await shield(rpc(mark), args);
    await shield(rpc(inbox), args);
    await shield(rpc('buklod_connect_unread_count'), args);
    expect(reads[inbox]).toBe(2);
    expect(reads.buklod_connect_unread_count).toBe(2);
  });

  it('does not discard an unread snapshot when the mark-read request fails', async () => {
    let reads = 0;
    const fetcher = jest.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('buklod_connect_mark_direct_read')) {
        return new Response('error', { status: 503 });
      }
      reads++;
      return new Response('1', { status: 200 });
    });
    const shield = createBuklodR4RequestShield(fetcher as typeof fetch);
    await shield(rpc('buklod_connect_personal_threads'), args);
    await shield(rpc('buklod_connect_mark_direct_read'), args);
    await shield(rpc('buklod_connect_personal_threads'), args);
    expect(reads).toBe(1);
  });
});
