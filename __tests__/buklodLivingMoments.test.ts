import {
  buildBuklodLivingMoments,
  buklodManilaDay,
} from '@/lib/buklodLivingMoments';

const account = {
  userId: 'user-123',
  firstName: 'Ana',
  joinedAt: '2026-10-01T00:00:00Z',
  birthDate: null,
  latestKl: null,
  faithEnabled: true,
};

describe('BUKLOD living Wall moments', () => {
  test('uses Philippine date even around UTC midnight', () => {
    expect(buklodManilaDay(new Date('2026-11-07T16:30:00Z')))
      .toBe('2026-11-08');
  });

  test('personal birthday is visible to the owner without exposing age', () => {
    const moments = buildBuklodLivingMoments({
      ...account,
      now: new Date('2026-11-07T16:30:00Z'),
      birthDate: '1995-11-08',
    });
    expect(moments[0].kind).toBe('birthday');
    expect(moments[0].title).toContain('Ana');
    expect(moments[0].message).not.toContain('1995');
    expect(moments[0].key).toBe('birthday:2026-11-08');
  });

  test('new account gets a time-bounded welcome and next action', () => {
    const moments = buildBuklodLivingMoments({
      ...account,
      now: new Date('2026-11-07T14:00:00Z'),
      joinedAt: '2026-11-06T14:00:00Z',
    });
    expect(moments[0]).toMatchObject({
      kind: 'welcome',
      route: '/clusters',
      key: 'welcome:user-123',
    });
  });

  test('approved recent KL release is announced, not a future date', () => {
    const recent = buildBuklodLivingMoments({
      ...account,
      now: new Date('2026-11-07T14:00:00Z'),
      latestKl: {
        id: 'episode-4', episode_number: 4,
        title: 'Daan Patungong Dumalir',
        release_at: '2026-11-07T08:00:00Z',
      },
    });
    expect(recent.some(item => item.key === 'kl:episode-4')).toBe(true);
    const future = buildBuklodLivingMoments({
      ...account,
      now: new Date('2026-11-07T14:00:00Z'),
      latestKl: {
        id: 'episode-5', episode_number: 5, title: 'Future',
        release_at: '2026-11-08T08:00:00Z',
      },
    });
    expect(future.some(item => item.kind === 'kl_release')).toBe(false);
  });

  test('religious holiday greeting honors the existing faith preference', () => {
    const now = new Date('2026-12-24T16:00:00Z');
    const hidden = buildBuklodLivingMoments({ ...account, now, faithEnabled: false });
    const visible = buildBuklodLivingMoments({ ...account, now, faithEnabled: true });
    expect(hidden.some(item => item.kind === 'occasion')).toBe(false);
    expect(visible.some(item => item.kind === 'occasion')).toBe(true);
  });

  test('unread notification activity is actionable, not a duplicate push', () => {
    const moments = buildBuklodLivingMoments({
      ...account, now: new Date('2026-11-07T14:00:00Z'), unreadCount: 3,
    });
    expect(moments.find(item => item.kind === 'activity')).toMatchObject({
      route: '/notifications', key: 'activity:2026-11-07',
    });
  });

  test('stale and malformed personal data never produce private moments', () => {
    const moments = buildBuklodLivingMoments({
      ...account,
      now: new Date('2026-11-07T14:00:00Z'),
      joinedAt: '2025-01-01T00:00:00Z',
      birthDate: 'not-a-birthday',
      latestKl: {
        id: 'old', episode_number: 1,
        title: 'Old release', release_at: '2026-09-01T00:00:00Z',
      },
    });
    expect(moments).toHaveLength(1);
    expect(moments[0].kind).toBe('suggestion');
  });

  test('another user cannot be inferred without that account input', () => {
    const moments = buildBuklodLivingMoments({
      ...account, userId: '', now: new Date('2026-11-07T14:00:00Z'),
    });
    expect(moments).toEqual([]);
  });
});
