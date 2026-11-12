import type { BuklodScope } from '@/lib/buklodScope';
import {bsoNotificationCasePath} from '@/lib/bsocCaseTriage';
import { buklodFormationNotificationTarget } from '@/lib/buklodFormationNotificationTarget';
import { isManagedCommunityScopeType } from '@/lib/buklodScopeRoute';
import {
  buklodNotificationPath,
  buklodNotificationTarget,
  type BuklodNotificationPayload,
  type BuklodNotificationTarget,
} from '@/lib/buklodScopeRoute';

export {
  buklodNotificationPath,
  buklodNotificationTarget,
  type BuklodNotificationPayload,
  type BuklodNotificationTarget,
};

type NotificationData = Record<string, unknown> | null | undefined;

type NotificationTargetOptions = {
  scopes?: BuklodScope[];
  mzbCanonicalScopeId?: string | null;
};

const COMMUNITY_POST_KINDS = new Set([
  'community_post',
  'community_comment',
  'community_reaction',
  'community_mention',
  'community_reply',
  'community_share',
  'community_commented',
  'post_comment',
  'post_reaction',
  'post_reply',
  'post_share_request',
  'post_share_approved',
  'post_share_declined',
]);

const FORMATION_ASSIGNMENT_KINDS = new Set([
  'formation_assigned',
  'formation_reminder',
  'formation_due_soon',
]);

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeInternalPath(value: unknown): string | null {
  const path = clean(value);

  if (
    !path ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('://')
  ) {
    return null;
  }

  return path;
}

function postInItsCommunity(
  postId: string,
  payload: Record<string, unknown>,
  options?: NotificationTargetOptions,
  openComments = false,
): BuklodNotificationTarget {
  const scopeId = clean(payload.scope_id);
  const scope = options?.scopes?.find(item => item.scope_id === scopeId);
  const managed = isManagedCommunityScopeType(
    scope?.scope_type ?? clean(payload.scope_type),
  );
  const query = new URLSearchParams();
  if (managed && scopeId) {
    query.set('section', 'community');
    query.set('scopeId', scopeId);
  }
  query.set('focusPostId', postId);
  if (openComments) query.set('focusComments', '1');
  // Exact comment/message identity from newer producers, while old pushes
  // without these fields still open their post using the proven legacy route.
  const commentId = clean(payload.comment_id) || clean(payload.commentId);
  if (openComments && commentId) query.set('focusCommentId', commentId);

  // A selected public comment with an actual ID should open and locate that
  // comment, not merely the Wall. Legacy notifications retain Wall focus.
  const exactCommentId=clean(payload.comment_id)||clean(payload.commentId);
  if(!managed && openComments && exactCommentId){
    return {path:'/post/'+encodeURIComponent(postId)+
      '?focusCommentId='+encodeURIComponent(exactCommentId)};
  }
  return managed && scopeId
    ? { path: `/scope?${query.toString()}`, scopeId }
    : { path: `/buklod?${query.toString()}` };
}

/**
 * Canonical notification-tap resolver shared by the in-app center and native
 * push responses. Exact record routes win; the existing scope-aware resolver
 * remains the fallback for Connect/community notifications.
 */
export function resolveBuklodNotificationTarget(
  kind: string,
  data: NotificationData,
  options?: NotificationTargetOptions,
): BuklodNotificationTarget | null {
  const normalizedKind = clean(kind).toLowerCase();
  // New producers and older push gateways differ in field casing and nesting.
  // Normalize only known IDs, never treat arbitrary payload strings as routes.
  const raw = data ?? {};
  const nested = raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
    ? raw.data as Record<string, unknown> : {};
  const payload: Record<string, unknown> = { ...nested, ...raw };
  for (const [canonical, aliases] of Object.entries({
    post_id: ['postId', 'community_post_id', 'target_post_id'],
    comment_id: ['commentId', 'target_comment_id'],
    conversation_id: ['conversationId', 'thread_id', 'threadId'],
    message_id: ['messageId', 'target_message_id'],
    scope_id: ['scopeId', 'cluster_id', 'organization_id'],
    actor_id: ['actorId'],
  })) {
    if (!clean(payload[canonical])) {
      const candidate = aliases.map(key => clean(payload[key])).find(Boolean);
      if (candidate) payload[canonical] = candidate;
    }
  }

  // BSOC links carry a case ID but only fixed support routes are accepted.
  // The inbox/member screen independently verifies role and case ownership.
  if (normalizedKind === 'bsoc_support') {
    const casePath = bsoNotificationCasePath(payload.route, payload.case_id);
    if (casePath) return { path: casePath };
  }

  const formationTarget = buklodFormationNotificationTarget(
    normalizedKind,
    payload as any,
  );

  if (formationTarget) {
    return formationTarget;
  }

  if (
    normalizedKind === 'cluster_join_request' ||
    normalizedKind === 'cluster_invite' ||
    normalizedKind === 'cluster_join_result' ||
    normalizedKind === 'cluster_home'
  ) {
    const clusterScopeId = clean(payload.scope_id);

    if (clusterScopeId) {
      const id = encodeURIComponent(clusterScopeId);
      const approved = ['approved', 'accepted', 'active'].includes(
        clean(payload.resolved).toLowerCase(),
      );

      // An approved member's notification goes to this exact Cluster Home.
      // /scope still checks active membership; this is never an auth bypass.
      if (
        normalizedKind === 'cluster_home' ||
        (normalizedKind === 'cluster_join_result' && approved)
      ) {
        return {
          path: `/scope?section=home&scopeId=${id}`,
          scopeId: clusterScopeId,
        };
      }

      return {
        path:
          normalizedKind === 'cluster_join_request'
            ? `/clusters/join-requests?cluster=${id}`
            : normalizedKind === 'cluster_invite'
              ? `/clusters/${id}?fromInvite=1`
              : `/clusters/${id}`,
        scopeId: clusterScopeId,
      };
    }
  }

  const helpRequestId = clean(payload.help_request_id);
  if (helpRequestId) {
    return {
      path: `/buklod?help_request_id=${encodeURIComponent(helpRequestId)}`,
    };
  }

  const prayerRequestId =
    clean(payload.prayer_request_id) || clean(payload.prayer_id);
  if (prayerRequestId) {
    return {
      path: `/prayer/${encodeURIComponent(prayerRequestId)}`,
    };
  }

  // Focus the exact record inside its own feed instead of opening the
  // standalone post-detail screen. The feed fetches older posts by id through
  // the existing access-controlled post detail RPC.
  const postId = clean(payload.post_id);
  if (postId && COMMUNITY_POST_KINDS.has(normalizedKind)) {
    return postInItsCommunity(
      postId,
      payload,
      options,
      ['community_comment', 'community_commented', 'community_reply', 'post_comment', 'post_reply'].includes(normalizedKind),
    );
  }

  // Producers may provide a canonical internal route (for example Reports).
  const explicitPath = safeInternalPath(
    payload.route ?? payload.href ?? payload.deep_link,
  );
  if (explicitPath) {
    const oldPostLink = /^\/post\/([^/?#]+)\/?(?:\?.*)?$/.exec(explicitPath);
    if (oldPostLink) {
      try {
        return postInItsCommunity(
          decodeURIComponent(oldPostLink[1]),
          payload,
          options,
        );
      } catch {
        // Malformed old links retain the existing safe internal route.
      }
    }
    return { path: explicitPath };
  }

  const assignmentId = clean(payload.assignment_id);
  const assignedDate = clean(payload.date);
  if (normalizedKind === 'formation_daily_reading_reminder') {
    /*
     * DAILY_READING_NOTIFICATION_ROUTE_R1
     *
     * Keep notification entry identical to the canonical Daily Reading
     * doorway used by the Cluster/Organization Home card.
     *
     * Do NOT pass assignment_id into /bible/read here. BibleLayout treats
     * a bare source=daily_plan doorway as a request for the current Daily
     * Reading dashboard and redirects to /bible?mode=respond. Passing an
     * assignment id bypasses that doorway and can reopen stale reader state.
     *
     * The producer may continue carrying assignment_id in the notification
     * payload for identity/audit purposes; navigation intentionally ignores it.
     */
    const query = new URLSearchParams();
    query.set('source', 'daily_plan');
    if (assignedDate) query.set('assignedDate', assignedDate);

    return {
      path: `/bible/read?${query.toString()}`,
    };
  }

  // Lesson reminder producer intentionally has no track/lesson id because a
  // member may have more than one active incomplete Formation track. The Learn
  // dashboard is therefore the canonical chooser/continue destination.
  if (normalizedKind === 'formation_lesson_reminder') {
    return {
      path: '/learn',
    };
  }

  // If an older notification lacks a record id, stay in Community instead of
  // incorrectly opening the Connect chat room.
  const communityScopeId = clean(payload.scope_id);
  if (COMMUNITY_POST_KINDS.has(normalizedKind) && communityScopeId) {
    return {
      path: `/scope?section=community&scopeId=${encodeURIComponent(communityScopeId)}`,
      scopeId: communityScopeId,
    };
  }

  const baseTarget = buklodNotificationTarget(
    normalizedKind,
    {
      post_id: clean(payload.post_id) || undefined,
      conversation_id: clean(payload.conversation_id) || undefined,
      scope_id: clean(payload.scope_id) || undefined,
      sender_id: clean(payload.sender_id) || undefined,
      message_id: clean(payload.message_id) || undefined,
      scope_type: clean(payload.scope_type) || undefined,
      is_mzb:
        typeof payload.is_mzb === 'boolean' ||
        typeof payload.is_mzb === 'string'
          ? payload.is_mzb
          : undefined,
    },
    options,
  );

  if (baseTarget && (clean(payload.conversation_id) ||
    ['direct_message','connect_message','scope_message','community_message','ptt_message'].includes(normalizedKind))) {
    // The thread opens at the exact message if the producer provided its ID.
    // Existing thread routes without an ID retain legacy behavior.
    const messageId = clean(payload.message_id);
    if (messageId && clean(payload.conversation_id)) {
      const joiner = baseTarget.path.includes('?') ? '&' : '?';
      return { ...baseTarget, path: baseTarget.path+joiner+
        'focusMessageId='+encodeURIComponent(messageId) };
    }
    return baseTarget;
  }

  const devotionalId = clean(payload.devotional_id);
  if (normalizedKind === 'devotional_reminder' && devotionalId) {
    return {
      path: `/devotional/${encodeURIComponent(devotionalId)}`,
    };
  }

  const rowType = clean(payload.row_type).toLowerCase();
  const rowId = clean(payload.row_id);
  const trackId = clean(payload.track_id);

  if (FORMATION_ASSIGNMENT_KINDS.has(normalizedKind)) {
    if (rowType === 'devotional' && rowId) {
      return {
        path: `/devotional/${encodeURIComponent(rowId)}`,
      };
    }

    if (trackId) {
      return {
        path: `/learn/${encodeURIComponent(trackId)}`,
      };
    }
  }

  if (normalizedKind === 'community_learning_started' && trackId) {
    return {
      path: `/learn/${encodeURIComponent(trackId)}`,
    };
  }

  if (normalizedKind === 'membership_approved' && clean(payload.scope_id)) {
    const id=clean(payload.scope_id);
    return { path:'/scope?section=home&scopeId='+encodeURIComponent(id),scopeId:id };
  }
  if (normalizedKind === 'character_collectible_redeemed')
    return {path:'/points'};
  if (normalizedKind === 'membership_approved')
    return {path:'/(tabs)/me'};

  const ledgerId = clean(payload.ledger_id) || clean(payload.points_ledger_id);
  if (ledgerId && ['points_earned','points_claimed','reward_approved',
      'points_reward','reward_claimed'].includes(normalizedKind)) {
    return {path:'/points?focusLedgerId='+encodeURIComponent(ledgerId)};
  }

  // Current follow-up payloads carry group/church metadata but no canonical
  // conversation route. Open the BUKLOD hub instead of silently doing nothing.
  if (normalizedKind === 'follow_up_opened') {
    // Do not disguise a missing record destination as a generic Wall visit.
    const threadId = clean(payload.conversation_id);
    return threadId
      ? {path:'/connect/personal/'+encodeURIComponent(threadId)}
      : null;
  }

  return null;
}

