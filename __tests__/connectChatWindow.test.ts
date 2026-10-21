import fs from 'fs';
import path from 'path';

import {
  applyConnectHistoryDirectQuery,
  chooseNewestHistoryPage,
  connectBubbleGrouping,
  connectCollageTiles,
  connectHistoryBeforeFilter,
  connectHistoryQueryPlan,
  connectScrollAction,
  connectSignedUrlNeedsRefresh,
  connectSinglePhotoFrame,
  connectThreadSessionKey,
  mergeConnectHistoryPages,
  mergeConnectServerMessages,
  readersForMessageWindow,
  splitAlbumUpload,
  visibleReaderAvatars,
} from '@/lib/connectChatWindow';
import {
  createConnectHistoryAvailability,
  selectConnectHistoryRows,
} from '@/lib/connectHistoryLoader';
import { encodeConnectAlbumBody, parseConnectAlbumBody } from '@/lib/connectAlbumBody';

type Row = {
  id: string;
  created_at: string;
  sender_id: string;
  body: string;
};

function row(index: number, sender = 'a'): Row {
  const minutes = Math.floor(index / 60);
  const seconds = index % 60;
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    created_at: `2026-10-21T12:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.000Z`,
    sender_id: sender,
    body: `m${index}`,
  };
}

function thread(count: number) {
  return Array.from({ length: count }, (_, index) => row(index + 1));
}

describe('Connect history window', () => {
  it('asks the fallback query for the newest page, not the oldest', () => {
    const plan = connectHistoryQueryPlan(120, null);
    const calls: string[] = [];
    const query = {
      or(filters: string) {
        calls.push(`or:${filters}`);
        return query;
      },
      order(column: string, options: { ascending: boolean }) {
        calls.push(`order:${column}:${options.ascending}`);
        return query;
      },
      limit(count: number) {
        calls.push(`limit:${count}`);
        return query;
      },
    };

    applyConnectHistoryDirectQuery(query, plan);

    expect(calls).toEqual([
      'order:created_at:false',
      'order:id:false',
      'limit:121',
    ]);
    expect(plan.pageSize).toBe(120);
  });

  it('keeps a keyset cursor behind the oldest loaded message', () => {
    const before = {
      createdAt: '2026-10-21T10:00:00.000Z',
      id: '00000000-0000-4000-8000-000000000010',
    };
    const plan = connectHistoryQueryPlan(80, before);
    expect(connectHistoryBeforeFilter(before)).toContain('created_at.lt.');
    expect(connectHistoryBeforeFilter(before)).toContain('id.lt.');
    expect(plan.before).toEqual(before);
    expect(plan.limit).toBe(81);
  });

  it('prefers the newest 120 when the legacy RPC returns the oldest 120', async () => {
    const all = thread(200);
    const availability = createConnectHistoryAvailability();
    let legacyCalls = 0;
    const selected = await selectConnectHistoryRows({
      kind: 'direct',
      containerId: 'thread-1',
      limit: 120,
      availability,
      gateway: {
        pageV2: async () => ({
          data: null,
          error: { message: 'Could not find the function public.buklod_connect_direct_messages_page_v2' },
        }),
        legacyRpc: async () => {
          legacyCalls += 1;
          return { data: all.slice(0, 120), error: null };
        },
        direct: async ({ plan }) => {
          const newestFirst = [...all].sort((a, b) =>
            a.created_at < b.created_at ? 1 : -1
          );
          return {
            data: newestFirst.slice(0, plan.limit),
            error: null,
          };
        },
      },
    });

    expect(legacyCalls).toBe(1);
    expect(selected.source).toBe('direct');
    expect(selected.rows).toHaveLength(120);
    expect(selected.rows[0].id).toBe(all[80].id);
    expect(selected.rows[119].id).toBe(all[199].id);
    expect(selected.hasOlder).toBe(true);
    expect(selected.rows.map(item => item.created_at)).toEqual(
      [...selected.rows.map(item => item.created_at)].sort()
    );
  });

  it('uses the v2 newest page and does not call the legacy RPC', async () => {
    const all = thread(150);
    let legacyCalls = 0;
    const newest = [...all].reverse();
    const selected = await selectConnectHistoryRows({
      kind: 'scope',
      containerId: 'scope-1',
      limit: 120,
      availability: createConnectHistoryAvailability(),
      gateway: {
        pageV2: async ({ plan }) => ({
          data: newest.slice(0, plan.limit),
          error: null,
        }),
        legacyRpc: async () => {
          legacyCalls += 1;
          return { data: all.slice(0, 120), error: null };
        },
        direct: async () => ({ data: null, error: { message: 'unused' } }),
      },
    });

    expect(legacyCalls).toBe(0);
    expect(selected.source).toBe('v2');
    expect(selected.rows[selected.rows.length - 1].id).toBe(all[149].id);
    expect(selected.rows[0].id).toBe(all[30].id);
  });

  it('loads an older page without duplicates and keeps chronological order', () => {
    const all = thread(10);
    const current = all.slice(6);
    const older = all.slice(3, 7);
    const merged = mergeConnectHistoryPages(older, current);
    expect(merged.map(item => item.id)).toEqual(all.slice(3).map(item => item.id));
  });

  it('keeps a failed local send when a newest page replaces the thread', () => {
    const server = [row(2, 'me')];
    const failed = {
      ...row(9, 'me'),
      id: 'local-failed',
      delivery_state: 'not_sent' as const,
      body: 'still here',
    };
    const merged = mergeConnectServerMessages(server, [row(1), failed], 'replace');
    expect(merged.map(item => item.id)).toEqual([server[0].id, failed.id]);
  });

  it('retains already loaded older rows when a newer page arrives', () => {
    const older = row(1);
    const newest = [row(20), row(21)];
    const merged = mergeConnectServerMessages(newest, [older], 'retain-older');
    expect(merged.map(item => item.id)).toEqual([older.id, newest[0].id, newest[1].id]);
  });
});

describe('Connect scroll decisions', () => {
  it('waits to anchor until the newest page has settled', () => {
    expect(
      connectScrollAction({
        intent: 'open',
        nearBottom: false,
        initialSettled: false,
      })
    ).toBe('wait');
    expect(
      connectScrollAction({
        intent: 'open',
        nearBottom: false,
        initialSettled: true,
      })
    ).toBe('anchor-end');
  });

  it('does not jump to the latest message while the reader is in history', () => {
    expect(
      connectScrollAction({
        intent: 'incoming',
        nearBottom: false,
        initialSettled: true,
      })
    ).toBe('none');
    expect(
      connectScrollAction({
        intent: 'content',
        nearBottom: false,
        initialSettled: true,
      })
    ).toBe('none');
    expect(
      connectScrollAction({
        intent: 'older-prepend',
        nearBottom: false,
        initialSettled: true,
      })
    ).toBe('preserve');
  });

  it('sticks for the sender and for someone already at the latest message', () => {
    expect(
      connectScrollAction({
        intent: 'own-send',
        nearBottom: false,
        initialSettled: true,
      })
    ).toBe('stick-end');
    expect(
      connectScrollAction({
        intent: 'incoming',
        nearBottom: true,
        initialSettled: true,
      })
    ).toBe('stick-end');
  });

  it('changes the thread session when the person or room changes', () => {
    expect(
      connectThreadSessionKey({
        profileId: 'person-a',
        mode: 'direct',
        containerId: 't1',
      })
    ).not.toBe(
      connectThreadSessionKey({
        profileId: 'person-b',
        mode: 'direct',
        containerId: 't1',
      })
    );
  });
});

describe('Connect photos and albums', () => {
  it('sizes a single photo above half of the chat width', () => {
    for (const chatWidth of [320, 390, 768, 1280]) {
      const frame = connectSinglePhotoFrame(chatWidth);
      expect(frame.width).toBeGreaterThan(chatWidth * 0.5);
      expect(frame.width).toBeLessThanOrEqual(Math.round(Math.max(chatWidth, 240) * 0.8));
      expect(frame.height).toBeGreaterThan(120);
      expect(frame.height).toBeLessThanOrEqual(Math.round(Math.max(chatWidth, 240) * 0.95));
    }
  });

  it('builds 2, 3, and 4 tile collages inside the same width', () => {
    const width = connectSinglePhotoFrame(390).width;
    expect(connectCollageTiles(2, width)).toHaveLength(2);
    expect(connectCollageTiles(3, width)).toHaveLength(3);
    expect(connectCollageTiles(4, width)).toHaveLength(4);
    expect(connectCollageTiles(12, width)).toHaveLength(4);
    for (const count of [2, 3, 4, 12]) {
      for (const tile of connectCollageTiles(count, width)) {
        expect(tile.width).toBeGreaterThan(40);
        expect(tile.width).toBeLessThanOrEqual(width);
        expect(tile.height).toBeGreaterThan(40);
      }
    }
  });

  it('keeps a one-message album body and caption', () => {
    const body = encodeConnectAlbumBody(
      ['scope/a/1.jpg', 'scope/a/2.jpg', 'scope/a/3.jpg'],
      'Family day'
    );
    expect(parseConnectAlbumBody(body)).toEqual({
      paths: ['scope/a/1.jpg', 'scope/a/2.jpg', 'scope/a/3.jpg'],
      caption: 'Family day',
    });
  });

  it('refreshes a signed photo before it expires and after an error', () => {
    const signedAt = Date.parse('2026-10-21T12:00:00.000Z');
    expect(
      connectSignedUrlNeedsRefresh(
        signedAt,
        signedAt + 50 * 60 * 1000
      )
    ).toBe(false);
    expect(
      connectSignedUrlNeedsRefresh(
        signedAt,
        signedAt + 56 * 60 * 1000
      )
    ).toBe(true);
    expect(connectSignedUrlNeedsRefresh(0, signedAt)).toBe(true);
  });

  it('retries only the photos that never uploaded', () => {
    const split = splitAlbumUpload([
      { id: 'a', storagePath: 'ok/a.jpg' },
      { id: 'b', storagePath: 'ok/b.jpg' },
      { id: 'c', storagePath: null },
    ]);
    expect(split.ready.map(photo => photo.id)).toEqual(['a', 'b']);
    expect(split.pending.map(photo => photo.id)).toEqual(['c']);
    expect(split.readyToInsert).toBe(false);
    expect(
      splitAlbumUpload([
        { id: 'a', storagePath: 'ok/a.jpg' },
        { id: 'b', storagePath: 'ok/b.jpg' },
      ]).readyToInsert
    ).toBe(true);
  });
});

describe('Connect scope seen avatars', () => {
  const readers = [
    {
      userId: 'member-1',
      name: 'Ana',
      avatarUrl: null,
      lastReadAt: '2026-10-21T12:05:00.000Z',
    },
    {
      userId: 'member-2',
      name: 'Ben',
      avatarUrl: 'https://example.invalid/ben.png',
      lastReadAt: '2026-10-21T12:09:00.000Z',
    },
    {
      userId: 'member-3',
      name: 'Cora',
      avatarUrl: null,
      lastReadAt: '2026-10-21T12:09:30.000Z',
    },
    {
      userId: 'self',
      name: 'Me',
      avatarUrl: null,
      lastReadAt: '2026-10-21T12:09:30.000Z',
    },
  ];

  it('places each reader on the latest message they have actually read', () => {
    const early = readersForMessageWindow({
      messageCreatedAt: '2026-10-21T12:04:00.000Z',
      nextMessageCreatedAt: '2026-10-21T12:08:00.000Z',
      readers,
      selfUserId: 'self',
    });
    const latest = readersForMessageWindow({
      messageCreatedAt: '2026-10-21T12:08:00.000Z',
      nextMessageCreatedAt: null,
      readers,
      selfUserId: 'self',
    });

    expect(early.map(reader => reader.userId)).toEqual(['member-1']);
    expect(latest.map(reader => reader.userId)).toEqual(['member-2', 'member-3']);
  });

  it('shows three avatars and a count for the rest', () => {
    const visible = visibleReaderAvatars(
      [
        { userId: '1' },
        { userId: '2' },
        { userId: '3' },
        { userId: '4' },
        { userId: '5' },
      ],
      3
    );
    expect(visible.shown).toHaveLength(3);
    expect(visible.extra).toBe(2);
  });

  it('groups consecutive messages from the same person', () => {
    const grouped = connectBubbleGrouping({
      senderId: 'a',
      createdAt: '2026-10-21T12:01:00.000Z',
      previous: {
        senderId: 'a',
        createdAt: '2026-10-21T12:00:30.000Z',
      },
      next: {
        senderId: 'b',
        createdAt: '2026-10-21T12:02:00.000Z',
      },
    });
    expect(grouped).toEqual({ startsGroup: false, endsGroup: true });
  });
});

describe('Connect scope read review migration', () => {
  const sqlPath = path.join(
    process.cwd(),
    'supabase/review-only/20261021160000_connect_history_page_and_scope_reads.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');

  it('stays out of the live migrations folder', () => {
    expect(
      fs.existsSync(
        path.join(
          process.cwd(),
          'supabase/migrations/20261021160000_connect_history_page_and_scope_reads.sql'
        )
      )
    ).toBe(false);
    expect(sql).toMatch(/REVIEW ONLY/);
  });

  it('authorizes scope reads only for active members of that scope', () => {
    expect(sql).toContain('buklod_connect_scope_reads');
    expect(sql).toContain("membership_status = 'ACTIVE'");
    expect(sql).toContain('sm.scope_id = buklod_connect_scope_reads.scope_id');
    expect(sql).toContain('r.scope_id = _scope_id');
    expect(sql).toContain('r.user_id <> auth.uid()');
    expect(sql).toMatch(/revoke all on function public\.buklod_connect_scope_readers_v1\(uuid\) from public, anon/i);
    expect(sql).not.toMatch(/grant execute[\s\S]{0,120}to anon/i);
  });

  it('returns the newest history page for direct and scope rooms', () => {
    expect(sql).toContain('order by m.created_at desc, m.id desc');
    expect(sql).toContain('t.user_one = auth.uid()');
    expect(sql).toContain('t.user_two = auth.uid()');
    expect(sql).toContain('Active membership in this Connect room is required');
  });
});
