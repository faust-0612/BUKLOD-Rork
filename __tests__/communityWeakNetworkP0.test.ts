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
  applyAuthoritativeCommunityMedia,
  beginCommunityFeedLoad,
  communityFeedStatusMessage,
  communityRetryAllowed,
  createCommunityFeedSession,
  dropWarmCommunityFeedForUser,
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
    expect(session.pageOneReady).toBe(true);

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
      concurrency: 1,
      burst: 2,
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
    const imageTypes = path.join(
      process.cwd(),
      'node_modules/expo-image/build/Image.d.ts',
    );
    if (fs.existsSync(imageTypes)) {
      const source = fs.readFileSync(imageTypes, 'utf8');
      expect(source).toContain('loadAsync');
      expect(source).toContain('cacheKey');
      expect(source).toContain('getCachePathAsync');
    }
    const delays = [0, 1, 2].map(attempt =>
      communityMediaResignDelayMs(attempt, 0),
    );
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1]);
  });

  test('video cache policy model requests missing ranges and blocks IMA byte reuse', () => {
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

    // Policy model only. These byte counts are not a device packet capture.
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

  test('hung name enrichment still paginates and does not drop page 2', async () => {
    const session = createCommunityFeedSession();
    let posts: any[] = [];
    const names = deferred<void>();
    const paint = (rows: any[], meta: any) => {
      posts = mergePaintedCommunityPosts(posts, rows, meta);
    };
    const shared = {
      session,
      online: true,
      readMemory: () => null,
      readDisk: async () => null,
      paint,
      onState: () => undefined,
    };

    const first = executeProgressiveCommunityFeed({
      ...shared,
      append: false,
      identity: 'user-a:all:for_you',
      fetchFeed: async () => ({
        ok: true,
        rows: [{ id: 'p1', body: 'Page one', user_id: 'author-1' }],
      }),
      toCanonical: rows =>
        rows.map(row => withCanonicalCommunityAuthor(row, () => 'Member')),
      enrich: async rows => {
        await names.promise;
        return {
          mediaLookup: 'authoritative' as const,
          rows: rows.map(row => ({ ...row, author_name: 'Later Name' })),
        };
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(posts.map(row => row.body)).toEqual(['Page one']);
    expect(session.pageOneReady).toBe(true);

    const pageTwo = await executeProgressiveCommunityFeed({
      ...shared,
      append: true,
      identity: 'user-a:all:for_you',
      fetchFeed: async () => ({
        ok: true,
        rows: [{ id: 'p2', body: 'Page two', user_id: 'author-2' }],
      }),
      toCanonical: rows => rows,
      enrich: async rows => ({ rows, mediaLookup: 'failed' as const }),
    });

    expect(pageTwo).toBe(1);
    expect(posts.map(row => row.id)).toEqual(['p1', 'p2']);
    await expect(Promise.race([
      first.then(() => 'done'),
      Promise.resolve('pending'),
    ])).resolves.toBe('pending');

    names.resolve();
    await first;
    expect(posts.map(row => row.id)).toEqual(['p1', 'p2']);
    expect(posts[0].author_name).toBe('Later Name');
  });

  test('a newer account replaces the screen before an old enrichment returns', async () => {
    const session = createCommunityFeedSession();
    let posts: any[] = [];
    const oldNames = deferred<void>();
    const memory = new Map<string, any[]>();
    const paint = (rows: any[], meta: any) => {
      posts = mergePaintedCommunityPosts(posts, rows, meta);
    };

    const oldLoad = executeProgressiveCommunityFeed({
      session,
      append: false,
      identity: 'user-a:all:for_you',
      online: true,
      readMemory: () => memory.get('user-a') ?? null,
      readDisk: async () => null,
      fetchFeed: async () => ({
        ok: true,
        rows: [{ id: 'a1', body: 'Account A', user_id: 'user-a' }],
      }),
      toCanonical: rows => rows,
      enrich: async rows => {
        await oldNames.promise;
        return { rows, mediaLookup: 'authoritative' as const };
      },
      paint,
      onState: () => undefined,
      onIdentityChange: (previous, next) => {
        const previousUser = previous?.split(':')[0];
        const nextUser = next.split(':')[0];
        if (previousUser && previousUser !== nextUser) {
          dropWarmCommunityFeedForUser(memory, previousUser);
        }
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    memory.set('community_feed:user-a:all:mode:for_you:v2', posts.slice());

    const nextLoad = executeProgressiveCommunityFeed({
      session,
      append: false,
      identity: 'user-b:all:for_you',
      online: true,
      readMemory: () => null,
      readDisk: async () => null,
      fetchFeed: async () => ({
        ok: true,
        rows: [{ id: 'b1', body: 'Account B', user_id: 'user-b' }],
      }),
      toCanonical: rows => rows,
      enrich: async rows => ({ rows, mediaLookup: 'failed' as const }),
      paint,
      onState: () => undefined,
      onIdentityChange: (previous, next) => {
        const previousUser = previous?.split(':')[0];
        const nextUser = next.split(':')[0];
        if (previousUser && previousUser !== nextUser) {
          dropWarmCommunityFeedForUser(memory, previousUser);
        }
      },
    });
    await nextLoad;
    expect(posts.map(row => row.body)).toEqual(['Account B']);
    expect(memory.has('community_feed:user-a:all:mode:for_you:v2')).toBe(false);

    oldNames.resolve();
    await oldLoad;
    expect(posts.map(row => row.body)).toEqual(['Account B']);
  });

  test('authoritative empty media removes a revoked photo and a failed lookup keeps it', () => {
    const visible = [{
      id: 'post-1',
      body: 'Hello',
      media_path: 'private/photo.jpg',
      media_url: 'https://cdn.example/private?token=old',
      media_items: [{ media_path: 'private/photo.jpg' }],
    }];
    const removed = mergePaintedCommunityPosts<any>(
      visible,
      [{ id: 'post-1', body: 'Hello', media_items: [] }],
      { append: false, preserveEmptyMedia: false, keepUnmentioned: true },
    );
    expect(removed[0].media_items).toEqual([]);
    expect(removed[0].media_url).toBeNull();
    expect(removed[0].media_path).toBeNull();

    const kept = mergePaintedCommunityPosts<any>(
      visible,
      [{ id: 'post-1', body: 'Hello', media_items: [] }],
      { append: false, preserveEmptyMedia: true, keepUnmentioned: true },
    );
    expect(kept[0].media_items).toEqual([{ media_path: 'private/photo.jpg' }]);

    const unchanged = mergePaintedCommunityPosts<any>(
      visible,
      [{
        id: 'post-1',
        body: 'Hello',
        media_items: [{ media_path: 'private/photo.jpg', media_url: 'https://cdn.example/private?token=new' }],
      }],
      { append: false, preserveEmptyMedia: false },
    );
    expect(unchanged[0].media_items[0].media_path).toBe('private/photo.jpg');

    const page = applyAuthoritativeCommunityMedia(
      [
        ...visible,
        { id: 'post-2', body: 'Next page', media_items: [{ media_path: 'other.jpg' }] },
      ],
      ['post-1'],
      {},
    );
    expect(page[0].media_items).toEqual([]);
    expect(page[1].media_items).toEqual([{ media_path: 'other.jpg' }]);
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
