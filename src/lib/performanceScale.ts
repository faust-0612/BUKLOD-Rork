/**
 * BUKLOD client scale limits — tuned for high concurrency and smaller payloads.
 * Keep hot paths bounded so one device never pulls unbounded server work.
 */

export const SCALE_LIMITS = {
  /** Initial connect history fetch per open thread. */
  connectHistory: 120,
  /** Max messages rendered in the connect FlatList at once. */
  connectRenderWindow: 100,
  /** Reaction rows fetched per thread. */
  connectReactions: 800,
  /** Community feed first page. */
  communityPage: 40,
  /** Community feed hard page cap. */
  communityMaxPage: 100,
  /** Scope member list default page. */
  scopeMembersPage: 30,
  /** Cluster/org member admin list cap. */
  scopeMembersAdminCap: 200,
  /** Unread badge safety poll (ms). */
  connectUnreadPollMs: 90_000,
  /**
   * Inbox list safety poll (ms).
   *
   * Direct/scope inboxes are realtime-first. Keep a slower fallback poll for
   * missed reconnect events without making every mounted inbox hit Supabase
   * every 90 seconds indefinitely.
   */
  messagesInboxPollMs: 180_000,
  /** Direct peer-read refresh while thread open (ms). */
  connectPeerReadPollMs: 8_000,
  /** Supabase realtime events per second cap. */
  realtimeEventsPerSecond: 8,
  /** Max community posts kept in local cache. */
  offlineCommunityCachePosts: 50,
  /** Background refresh while online (ms). */
  offlineBackgroundRefreshMs: 120_000,
  /** Pending sync retry backoff base (ms). */
  offlineSyncRetryBaseMs: 5_000,
  /** Max pending sync retries before failed_to_sync. */
  offlineSyncMaxRetries: 5,
} as const;

export const FLASHLIST_ESTIMATES = {
  communityPost: 420,
  connectMessage: 88,
  inboxRow: 76,
  scopedCommunityPost: 400,
} as const;
