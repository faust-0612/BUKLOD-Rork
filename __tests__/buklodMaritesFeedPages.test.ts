import {
  collectMaritesFeedPages,
  MARITES_FEED_MODE,
  maritesFeedPageArgs,
  maritesFeedPageLimit,
  resolveMaritesVisibleRows,
  withMaritesPageDeadline,
} from '@/lib/buklodMaritesFeedPages';

function row(id: string) {
  return { id, body: 'story' };
}

describe('Marites authorized feed pages', () => {
  it('keeps paging after a full 40-row page', async () => {
    expect(maritesFeedPageLimit(40)).toBe(40);
    expect(maritesFeedPageLimit(80)).toBe(80);
    expect(maritesFeedPageLimit(500)).toBe(100);

    const calls: number[] = [];
    const collected = await collectMaritesFeedPages({
      pageSize: 40,
      fetchPage: async (offset, limit) => {
        calls.push(offset);
        expect(limit).toBe(40);
        if (offset >= 80) {
          return { rows: [row('tail')] };
        }
        return {
          rows: Array.from({ length: 40 }, (_, index) =>
            row(`p${offset + index}`),
          ),
        };
      },
    });

    expect(calls).toEqual([0, 40, 80]);
    expect(collected.complete).toBe(true);
    expect(collected.error).toBeNull();
    expect(collected.rows).toHaveLength(81);
  });

  it('keeps earlier pages when a later RPC fails', async () => {
    const collected = await collectMaritesFeedPages({
      pageSize: 2,
      fetchPage: async (offset) => {
        if (offset === 0) {
          return { rows: [row('a'), row('b')] };
        }
        return { rows: [], error: 'rpc down' };
      },
    });

    expect(collected.rows.map((item) => item.id)).toEqual(['a', 'b']);
    expect(collected.complete).toBe(false);
    expect(collected.error).toBe('rpc down');
  });

  it('stops when a repeated page would otherwise loop', async () => {
    let calls = 0;
    const collected = await collectMaritesFeedPages({
      pageSize: 2,
      fetchPage: async () => {
        calls += 1;
        return { rows: [row('a'), row('b')] };
      },
    });

    expect(calls).toBe(2);
    expect(collected.rows).toHaveLength(2);
    expect(collected.complete).toBe(true);
    expect(collected.error).toBeNull();
  });

  it('requests the latest authorized page instead of assuming a 40-row cap', () => {
    expect(MARITES_FEED_MODE).toBe('latest');
    expect(maritesFeedPageArgs('scope-1', 100, 100)).toEqual({
      p_location_scope_id: 'scope-1',
      p_mode: 'latest',
      p_limit: 100,
      p_offset: 100,
    });
    expect(maritesFeedPageArgs('', 0, 100).p_location_scope_id).toBeNull();
  });

  it('applies the 8 second page deadline without dropping earlier rows', async () => {
    await expect(
      withMaritesPageDeadline(new Promise(() => undefined), 20),
    ).rejects.toThrow('Marites shared refresh timed out.');
  });

  it('keeps the longer visible list when refresh fails', () => {
    const current = ['one', 'two', 'three'];
    expect(
      resolveMaritesVisibleRows({
        current,
        incoming: ['local-only'],
        refreshFailed: true,
      }),
    ).toEqual({ rows: current, markFresh: false });

    const partial = resolveMaritesVisibleRows({
      current: ['local-only'],
      incoming: ['a', 'b', 'c'],
      refreshFailed: true,
    });
    expect(partial.rows).toEqual(['a', 'b', 'c']);
    expect(partial.markFresh).toBe(false);

    expect(
      resolveMaritesVisibleRows({
        current,
        incoming: ['newer'],
        refreshFailed: false,
      }),
    ).toEqual({ rows: ['newer'], markFresh: true });

    expect(
      resolveMaritesVisibleRows({
        current,
        incoming: [],
        refreshFailed: false,
      }),
    ).toEqual({ rows: current, markFresh: false });
  });
});
