/**
 * BUKLOD client scale limits — tuned for high concurrency and smaller payloads.
 * Keep hot paths bounded so one device never pulls unbounded server work.
 */

export const SCALE_LIMITS = {
  /** Newest connect history page fetched when a thread opens. */
  connectHistory: 120,
  /**
   * Older-page size when the reader reaches the top of a thread.
   * Kept below the opening page so each scroll-up stays bounded.
   */
  connectOlderPage: 80,
  /**
   * Maximum messages kept in one open thread after paging backward.
   * The list renders every loaded message until this cap; it no longer
   * hides the tail of a fetched page.
   */
  connectRenderWindow: 400,
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
   * Direct/scope inboxes are realtime-first and reload immediately when their
   * shared realtime channels receive a message. Keep only a five-minute
   * fallback for missed reconnect events instead of repeatedly reloading every
   * three minutes while an inbox stays mounted.
   */
  messagesInboxPollMs: 300_000,
  /**
   * Direct peer-read safety refresh while a thread is open (ms).
   *
   * Keep an initial authoritative refresh when the thread opens, then use a
   * one-minute safety poll. This cuts steady-state read-receipt RPC traffic in
   * half versus the previous 30s loop while preserving eventual "seen" state
   * recovery when no dedicated read-receipt realtime event is available.
   */
  connectPeerReadPollMs: 60_000,
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
