import {
  classifyNetworkQuality,
  communityFirstPageLimit,
  communityMediaResignDelayMs,
  communityPhotoPrefetchBudget,
  noteMeasuredRead,
  noteNetInfoHint,
  resetNetworkQualityForTests,
} from '@/lib/buklodNetworkQuality';
import {
  beginCommunityFeedLoad,
  communityFeedStatusMessage,
  communityRetryAllowed,
  createCommunityFeedSession,
  executeProgressiveCommunityFeed,
  isCommunityFeedTokenCurrent,
  mergePaintedCommunityPosts,
  versionedCommunityFeedCacheKey,
  withCanonicalCommunityAuthor,
} from '@/lib/communityFeedAvailability';
import {
  communityFeedMetricSnapshot,
  resetCommunityFeedTelemetryForTests,
  shouldReportCommunityFeedFailure,
} from '@/lib/communityFeedTelemetry';
import {
  planCommunityMediaPrefetch,
  resetCommunityMediaPrefetchForTests,
  runCommunityMediaPrefetch,
} from '@/lib/communityMediaPrefetch';
import {
  COMMUNITY_VIDEO_CACHE_BUDGET_BYTES,
  communityVideoCachePlan,
  replayDownloadedBytes,
  shouldMountCommunityVideoPlayer,
} from '@/lib/communityVideoPlayback';
import fs from 'fs';
import path from 'path';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(next => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('community weak-network feed', () => {
  beforeEach(() => {
    resetNetworkQualityForTests();
    resetCommunityFeedTelemetryForTests();
    resetCommunityMediaPrefetchForTests();
  });

  test('paints canonical post text before name and media enrichment', async () => {
    const session = createCommunityFeedSession();
    const events: string[] = [];
    const paints: any[][] = [];
    const names = deferred<void>();

    const loadPromise = executeProgressiveCommunityFeed({
      session,
      append: false,
      identity: 'user-a:all:for_you',
      online: true,
      readMemory: () => null,
      readDisk: async () => null,
      fetchFeed: async () => ({
        ok: true,
        rows: [
          {
            id: 'post-1',
            body: 'Visible on a weak signal',
            user_id: 'author-1',
            created_at: '2026-10-21T00:00:00Z',
          },
        ],
      }),
      toCanonical: rows =>
        rows.map(row =>
          withCanonicalCommunityAuthor(row, () => 'Member author'),
        ),
      enrich: async rows => {
        events.push('enrich');
        await names.promise;
        return rows.map(row => ({
          ...row,
          author_name: 'Real Name',
          media_items: [{ media_path: 'photo.jpg' }],
        }));
      },
      paint: rows => {
        events.push('paint');
        paints.push(rows);
      },
      onState: state => events.push(state),
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(events).toContain('LOADED');
    const canonical = paints.find(rows => rows[0]?.body === 'Visible on a weak signal');
    expect(canonical?.[0].author_name).toBe('Member author');
    expect(events.indexOf('paint')).toBeLessThan(events.indexOf('enrich'));
    expect(paints.at(-1)?.[0].media_items ?? []).toHaveLength(0);

    names.resolve();
    await loadPromise;
    expect(paints.at(-1)?.[0].author_name).toBe('Real Name');
    expect(session.pageOneReady).toBe(true);
    expect(
      communityFeedMetricSnapshot().some(
        metric => metric.stage === 'first_text_paint' && metric.rowCount === 1,
      ),
    ).toBe(true);
  });

  test('append cannot invalidate an in-flight first page', async () => {
    const session = createCommunityFeedSession();
    const first = beginCommunityFeedLoad(session, {
      append: false,
      identity: 'user-a:all:for_you',
    });
    expect(beginCommunityFeedLoad(session, {
      append: true,
      identity: 'user-a:all:for_you',
    })).toBeNull();

    const appended = createCommunityFeedSession();
    const refresh = beginCommunityFeedLoad(appended, {
      append: false,
      identity: 'user-a:all:for_you',
    });
    appended.pageOneReady = true;
    const append = beginCommunityFeedLoad(appended, {
      append: true,
      identity: 'user-a:all:for_you',
    });
    expect(isCommunityFeedTokenCurrent(appended, refresh)).toBe(true);
    expect(isCommunityFeedTokenCurrent(appended, append)).toBe(true);
    expect(first).not.toBeNull();
  });

  test('failed network is not labeled as an empty wall', async () => {
    const session = createCommunityFeedSession();
    const states: string[] = [];
    const count = await executeProgressiveCommunityFeed({
      session,
      append: false,
      identity: 'user-a:all:for_you',
      online: true,
      readMemory: () => null,
      readDisk: async () => null,
      fetchFeed: async () => ({ ok: false, error: new Error('timeout') }),
      toCanonical: rows => rows,
      enrich: async rows => rows,
      paint: () => undefined,
      onState: state => states.push(state),
    });

    expect(count).toBe(-1);
    expect(states).toContain('RETRYABLE_ERROR');
    expect(communityFeedStatusMessage('RETRYABLE_ERROR', 'for_you').message)
      .not.toMatch(/No Public posts/i);
    expect(communityFeedStatusMessage('EMPTY_CONFIRMED', 'for_you').message)
      .toMatch(/No Public posts/);
    expect(communityFeedStatusMessage('LOADING', 'for_you').showRetry).toBe(false);
    expect(communityFeedStatusMessage('RETRYABLE_ERROR', 'following').showRetry)
      .toBe(true);
  });

  test('keeps saved posts when refresh fails and isolates accounts', async () => {
    const session = createCommunityFeedSession();
    const painted: any[] = [];
    const saved = [{ id: 'saved', body: 'Saved text', user_id: 'author' }];
    const count = await executeProgressiveCommunityFeed({
      session,
      append: false,
      identity: 'user-a:scope:for_you',
      online: true,
      readMemory: () => null,
      readDisk: async () => saved,
      fetchFeed: async () => ({ ok: false, error: new Error('offline') }),
      toCanonical: rows => rows,
      enrich: async rows => rows,
      paint: rows => painted.push(rows),
      onState: () => undefined,
    });

    expect(count).toBe(1);
    expect(painted.at(-1)).toEqual(saved);
    expect(versionedCommunityFeedCacheKey('community_feed:user-a:all:mode:for_you'))
      .not.toBe(versionedCommunityFeedCacheKey('community_feed:user-b:all:mode:for_you'));
    expect(session.pageOneReady).toBe(true);
  });

  test('degraded network uses a short first page and throttles retry', () => {
    noteNetInfoHint({
      isConnected: true,
      isInternetReachable: true,
      type: 'cellular',
      cellularGeneration: '3g',
    });
    expect(classifyNetworkQuality()).toBe('degraded');
    expect(communityFirstPageLimit('degraded')).toBe(8);
    expect(communityPhotoPrefetchBudget('degraded')).toEqual({
      concurrency: 2,
      burst: 8,
    });

    noteMeasuredRead(4000, false);
    noteNetInfoHint({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      cellularGeneration: null,
    });
    expect(classifyNetworkQuality()).toBe('degraded');
    expect(communityFirstPageLimit('normal')).toBe(40);
    expect(communityRetryAllowed(1_000, 2_000)).toBe(false);
    expect(communityRetryAllowed(1_000, 3_000)).toBe(true);
    expect(shouldReportCommunityFeedFailure('community_feed_failed', 10)).toBe(true);
    expect(shouldReportCommunityFeedFailure('community_feed_failed', 20)).toBe(false);
  });

  test('photo prefetch reuses one stable cache key for rotated signed urls', async () => {
    const plan = planCommunityMediaPrefetch(
      [
        {
          uri: 'https://cdn.example/photo.jpg?token=one',
          cacheKey: 'community-media:photos/a.jpg',
        },
        {
          uri: 'https://cdn.example/photo.jpg?token=two',
          cacheKey: 'community-media:photos/a.jpg',
        },
        {
          uri: 'https://cdn.example/other.jpg?token=three',
          cacheKey: 'community-media:photos/b.jpg',
        },
      ],
      'normal',
    );
    expect(plan.jobs).toHaveLength(2);
    expect(plan.concurrency).toBe(4);

    const loaded: string[] = [];
    await runCommunityMediaPrefetch(plan.jobs, {
      quality: 'degraded',
      deps: {
        getCachePath: async key =>
          key.endsWith('a.jpg') ? '/cache/a.jpg' : null,
        load: async item => {
          loaded.push(item.cacheKey ?? item.uri);
        },
      },
    });

    expect(loaded).toEqual(['community-media:photos/b.jpg']);
    const delays = [0, 1, 2].map(attempt =>
      communityMediaResignDelayMs(attempt, 0),
    );
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1]);
  });

  test('video cache reuses retained ranges and does not bypass authorization or IMA', () => {
    expect(shouldMountCommunityVideoPlayer({
      active: false,
      fullscreen: false,
      degraded: true,
      playIntent: true,
    })).toBe(false);
    expect(shouldMountCommunityVideoPlayer({
      active: true,
      fullscreen: false,
      degraded: true,
      playIntent: false,
    })).toBe(false);
    expect(shouldMountCommunityVideoPlayer({
      active: true,
      fullscreen: false,
      degraded: true,
      playIntent: true,
    })).toBe(true);
    expect(shouldMountCommunityVideoPlayer({
      active: true,
      fullscreen: false,
      degraded: false,
      playIntent: false,
    })).toBe(true);

    const needed = [{ start: 0, end: 999 }];
    expect(replayDownloadedBytes({
      player: 'expo-video',
      authorized: true,
      sameMediaIdentity: true,
      cacheRetained: true,
      needed,
      cached: [{ start: 0, end: 399 }],
    })).toMatchObject({ bytes: 600, blocked: false });
    expect(replayDownloadedBytes({
      player: 'expo-video',
      authorized: true,
      sameMediaIdentity: true,
      cacheRetained: true,
      needed,
      cached: needed,
    })).toMatchObject({ bytes: 0 });
    expect(replayDownloadedBytes({
      player: 'expo-video',
      authorized: false,
      sameMediaIdentity: true,
      cacheRetained: true,
      needed,
      cached: needed,
    })).toMatchObject({ bytes: 0, blocked: true });
    expect(replayDownloadedBytes({
      player: 'google-ima',
      authorized: true,
      sameMediaIdentity: true,
      cacheRetained: true,
      needed,
      cached: needed,
    }).cacheSupported).toBe(false);

    expect(communityVideoCachePlan('expo-video')).toMatchObject({
      useCaching: true,
      preDownload: false,
      budgetBytes: COMMUNITY_VIDEO_CACHE_BUDGET_BYTES,
      reuseAcrossSignedUrlRotation: false,
    });
    expect(COMMUNITY_VIDEO_CACHE_BUDGET_BYTES).toBeLessThan(1024 * 1024 * 1024);
    expect(communityVideoCachePlan('google-ima').persistentByteCache).toBe(false);
  });

  test('refresh keeps already visible photos when the next text payload has no media yet', () => {
    const merged = mergePaintedCommunityPosts(
      [{ id: 'post-1', body: 'Old', media_items: [{ media_path: 'a.jpg' }] }],
      [{ id: 'post-1', body: 'New', media_items: [] }],
      { append: false, preserveEmptyMedia: true },
    );
    expect(merged[0].body).toBe('New');
    expect(merged[0].media_items).toEqual([{ media_path: 'a.jpg' }]);
  });

  test('wall source paints canonical rows before name hydration', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/(tabs)/buklod.tsx'),
      'utf8',
    );
    const canonical = source.indexOf('withCanonicalCommunityAuthor');
    const hydration = source.indexOf('hydratePersonNamesOnRows(');
    expect(canonical).toBeGreaterThan(0);
    expect(hydration).toBeGreaterThan(canonical);
    expect(source).toContain('executeProgressiveCommunityFeed');
    expect(source).toContain('pageOneReady');
    expect(source).not.toContain('communityLoadSeqRef');
  });
});
