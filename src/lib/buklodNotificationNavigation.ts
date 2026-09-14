import type { BuklodScope } from '@/lib/buklodScope';
import { buklodFormationNotificationTarget } from '@/lib/buklodFormationNotificationTarget';
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
  const payload = data ?? {};

  const formationTarget = buklodFormationNotificationTarget(
    normalizedKind,
    payload as any,
  );

  if (formationTarget) {
    return formationTarget;
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

  // Producers may provide a canonical internal route (for example Reports).
  const explicitPath = safeInternalPath(
    payload.route ?? payload.href ?? payload.deep_link,
  );
  if (explicitPath) {
    return { path: explicitPath };
  }

  const assignmentId = clean(payload.assignment_id);
  const assignedDate = clean(payload.date);
  if (
    normalizedKind === 'formation_daily_reading_reminder' &&
    assignmentId
  ) {
    const query = new URLSearchParams();
    query.set('source', 'daily_plan');
    query.set('assignment_id', assignmentId);
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

  if (baseTarget) {
    return baseTarget;
  }

  const postId = clean(payload.post_id);
  if (postId && COMMUNITY_POST_KINDS.has(normalizedKind)) {
    return {
      path: `/post/${encodeURIComponent(postId)}`,
    };
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

  if (
    normalizedKind === 'membership_approved' ||
    normalizedKind === 'character_collectible_redeemed'
  ) {
    return {
      path: '/(tabs)/me',
    };
  }

  // Current follow-up payloads carry group/church metadata but no canonical
  // conversation route. Open the BUKLOD hub instead of silently doing nothing.
  if (normalizedKind === 'follow_up_opened') {
    return {
      path: '/buklod',
    };
  }

  return null;
}
