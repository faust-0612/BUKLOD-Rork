import {
  applyConnectInboxRealtimeActivity,
  sortConnectInboxByActivity,
} from '../src/lib/connectInboxActivity';

describe('Connect latest conversation activity', () => {
  const older = '2026-11-23T10:00:00.000Z';
  const newer = '2026-11-23T10:03:00.000Z';

  it('sorts personal chats, requests, and community rooms by newest message', () => {
    const rooms = [
      { id: 'cluster', last_message_at: older },
      { id: 'org', last_message_at: newer },
      { id: 'empty', last_message_at: null },
    ];
    const result = sortConnectInboxByActivity(rooms);
    expect(result.map(row => row.id)).toEqual(['org', 'cluster', 'empty']);
    expect(rooms[0].id).toBe('cluster');
  });

  it('keeps stable backend ordering for rooms with missing or tied timestamps', () => {
    const rows = [
      { id: 'a', last_message_at: null },
      { id: 'b', last_message_at: 'invalid' },
      { id: 'c', last_message_at: older },
      { id: 'd', last_message_at: older },
    ];
    expect(sortConnectInboxByActivity(rows).map(row => row.id))
      .toEqual(['c', 'd', 'a', 'b']);
  });

  it('moves a known direct thread to the front immediately on an INSERT', () => {
    const rows = [
      { thread_id: 'first', last_message: 'Hello', last_message_at: newer, unread_count: 0 },
      { thread_id: 'second', last_message: 'Old', last_message_at: older, unread_count: 2 },
    ];
    const next = applyConnectInboxRealtimeActivity(
      rows,
      row => row.thread_id === 'second',
      { created_at: '2026-11-23T10:04:00.000Z', body: 'New!' },
    );
    expect(sortConnectInboxByActivity(next).map(row => row.thread_id))
      .toEqual(['second', 'first']);
    expect(next[1].last_message).toBe('New!');
    expect(next[1].unread_count).toBe(2); // server alone owns unread counts
    expect(rows[1].last_message).toBe('Old');
  });

  it('supports attachment-only room activity without changing other rooms', () => {
    const rows = [
      { scope_id: 'cluster', last_message: null, last_message_at: older },
      { scope_id: 'org', last_message: 'Hi', last_message_at: newer },
    ];
    const next = applyConnectInboxRealtimeActivity(
      rows,
      row => row.scope_id === 'cluster',
      { created_at: '2026-11-23T10:05:00.000Z', attachment_name: 'photo.jpg' },
    );
    expect(sortConnectInboxByActivity(next)[0].scope_id).toBe('cluster');
    expect(next[0].last_message).toBe('Attachment: photo.jpg');
    expect(next[1]).toBe(rows[1]);
  });

  it('does not regress on older or invalid realtime events or fabricate threads', () => {
    const rows = [{ thread_id: 'known', last_message: 'Latest', last_message_at: newer }];
    expect(applyConnectInboxRealtimeActivity(
      rows, row => row.thread_id === 'known', { created_at: older, body: 'Old event' },
    )).toBe(rows);
    expect(applyConnectInboxRealtimeActivity(
      rows, row => row.thread_id === 'known', { created_at: 'bad', body: 'Bad event' },
    )).toBe(rows);
    expect(applyConnectInboxRealtimeActivity(
      rows, row => row.thread_id === 'unknown', { created_at: newer, body: 'Unknown' },
    )).toBe(rows);
  });
});
