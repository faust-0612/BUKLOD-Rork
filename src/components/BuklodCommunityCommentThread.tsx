import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  BuklodCommunityCommentBubble,
  type BuklodCommunityCommentModel,
} from '@/components/BuklodCommunityCommentBubble';
import type { BuklodReactionOption } from '@/components/BuklodReactionAction';
import { BuklodTappableAvatar } from '@/components/BuklodTappableAvatar';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

export type CommentSortMode = 'newest' | 'oldest';

type ThreadRoot = {
  root: BuklodCommunityCommentModel;
  replies: BuklodCommunityCommentModel[];
};

type Props = {
  comments: BuklodCommunityCommentModel[];
  currentUserId?: string | null;
  reactionOptions: readonly BuklodReactionOption[];
  emptyText?: string;
  sortMode?: CommentSortMode;
  onSortModeChange?: (mode: CommentSortMode) => void;
  formatTime: (iso: string) => string;
  formatMeta?: (comment: BuklodCommunityCommentModel) => string | null;
  onReply: (
    target: BuklodCommunityCommentModel,
    root: BuklodCommunityCommentModel,
  ) => void;
  onReact: (comment: BuklodCommunityCommentModel, key: string) => void;
  onReactionSummaryPress?: (
    comment: BuklodCommunityCommentModel,
    key: string,
  ) => void;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onReport: (commentId: string) => void;
};

const COLLAPSE_AFTER = 2;

function buildThreads(
  comments: BuklodCommunityCommentModel[],
): ThreadRoot[] {
  const byId = new Map(
    comments.map((comment) => [String(comment.id), comment]),
  );
  const roots: BuklodCommunityCommentModel[] = [];
  const repliesByRoot = new Map<string, BuklodCommunityCommentModel[]>();

  for (const comment of comments) {
    const parentId = comment.parent_id
      ? String(comment.parent_id)
      : null;

    if (!parentId) {
      roots.push(comment);
      continue;
    }

    // One-level FB tree: climb to nearest present root.
    let rootId = parentId;
    let guard = 0;
    while (guard < 8) {
      const parent = byId.get(rootId);
      if (!parent?.parent_id) break;
      rootId = String(parent.parent_id);
      guard += 1;
    }

    if (!byId.has(rootId) || byId.get(rootId)?.parent_id) {
      // Orphan reply — treat as root so it stays visible.
      roots.push(comment);
      continue;
    }

    const list = repliesByRoot.get(rootId) ?? [];
    list.push(comment);
    repliesByRoot.set(rootId, list);
  }

  return roots.map((root) => {
    const replies = [...(repliesByRoot.get(String(root.id)) ?? [])].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return { root, replies };
  });
}

export function BuklodCommunityCommentThread({
  comments,
  currentUserId,
  reactionOptions,
  emptyText = 'No comments yet. Be the first to respond.',
  sortMode: controlledSort,
  onSortModeChange,
  formatTime,
  formatMeta,
  onReply,
  onReact,
  onReactionSummaryPress,
  onEdit,
  onDelete,
  onReport,
}: Props) {
  const { theme } = useBuklodTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [localSort, setLocalSort] = useState<CommentSortMode>('newest');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sortMode = controlledSort ?? localSort;
  const setSortMode = (mode: CommentSortMode) => {
    onSortModeChange?.(mode);
    if (controlledSort == null) setLocalSort(mode);
  };

  const threads = useMemo(() => {
    const built = buildThreads(comments);
    built.sort((a, b) => {
      const aTime = new Date(a.root.created_at).getTime();
      const bTime = new Date(b.root.created_at).getTime();
      return sortMode === 'newest' ? bTime - aTime : aTime - bTime;
    });
    return built;
  }, [comments, sortMode]);

  const renderBubble = (
    comment: BuklodCommunityCommentModel,
    root: BuklodCommunityCommentModel,
    isReply: boolean,
    lastReply = false,
    hasReplies = false,
  ) => (
    <View style={[styles.row, isReply && styles.replyRow]}>
      {!isReply && hasReplies ? <View style={styles.rootReplyRail} /> : null}
      {isReply ? <>
        <View style={[styles.replyRail, lastReply && styles.lastReplyRail]} />
        <View style={styles.replyElbow} />
      </> : null}
      <BuklodTappableAvatar
        userId={comment.user_id}
        name={resolvePersonDisplayName(
          comment.commenter_name,
          comment.user_id,
        )}
        size={isReply ? 28 : 34}
      />
      <View style={styles.bubbleWrap}>
        <BuklodCommunityCommentBubble
          comment={comment}
          currentUserId={currentUserId}
          reactionOptions={reactionOptions}
          isReply={isReply}
          metaLine={formatMeta?.(comment) ?? null}
          timeLabel={formatTime(comment.created_at)}
          onReply={() => onReply(comment, root)}
          onReact={(key) => onReact(comment, key)}
          onReactionSummaryPress={
            onReactionSummaryPress
              ? (key) => onReactionSummaryPress(comment, key)
              : undefined
          }
          onEdit={(body) => onEdit(String(comment.id), body)}
          onDelete={() => onDelete(String(comment.id))}
          onReport={() => onReport(String(comment.id))}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort</Text>
        <Pressable
          onPress={() => setSortMode('newest')}
          style={[styles.sortChip, sortMode === 'newest' && styles.sortChipOn]}
        >
          <Text
            style={[
              styles.sortChipText,
              sortMode === 'newest' && styles.sortChipTextOn,
            ]}
          >
            Newest
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSortMode('oldest')}
          style={[styles.sortChip, sortMode === 'oldest' && styles.sortChipOn]}
        >
          <Text
            style={[
              styles.sortChipText,
              sortMode === 'oldest' && styles.sortChipTextOn,
            ]}
          >
            Oldest
          </Text>
        </Pressable>
      </View>

      {!threads.length ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        threads.map(({ root, replies }) => {
          const rootId = String(root.id);
          const isExpanded = Boolean(expanded[rootId]);
          const hiddenCount = Math.max(0, replies.length - COLLAPSE_AFTER);
          const visibleReplies =
            isExpanded || replies.length <= COLLAPSE_AFTER
              ? replies
              : replies.slice(0, COLLAPSE_AFTER);

          return (
            <View key={rootId} style={styles.thread}>
              {renderBubble(root, root, false, false, replies.length > 0)}

              {visibleReplies.map((reply, index) => (
                <View key={String(reply.id)}>
                  {renderBubble(reply, root, true, index === visibleReplies.length - 1 && (isExpanded || !hiddenCount))}
                </View>
              ))}

              {hiddenCount > 0 && !isExpanded ? (
                <Pressable
                  onPress={() =>
                    setExpanded((prev) => ({ ...prev, [rootId]: true }))
                  }
                  style={styles.toggleReplies}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? 'Hide replies' : 'View ' + hiddenCount + ' more replies'}
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <Text style={styles.toggleRepliesText}>
                    View {hiddenCount} more{' '}
                    {hiddenCount === 1 ? 'reply' : 'replies'}
                  </Text>
                </Pressable>
              ) : null}

              {isExpanded && replies.length > COLLAPSE_AFTER ? (
                <Pressable
                  onPress={() =>
                    setExpanded((prev) => ({ ...prev, [rootId]: false }))
                  }
                  style={styles.toggleReplies}
                  accessibilityRole="button"
                  accessibilityLabel={isExpanded ? 'Hide replies' : 'View ' + hiddenCount + ' more replies'}
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <Text style={styles.toggleRepliesText}>Hide replies</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

function createStyles(theme: {
  textPrimary: string;
  textMuted: string;
  accent: string;
  border: string;
  surfaceMuted: string;
}) {
  return StyleSheet.create({
    root: {
      gap: 10,
    },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    sortLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.textMuted,
      marginRight: 2,
    },
    sortChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceMuted,
    },
    sortChipOn: {
      borderColor: theme.accent,
      backgroundColor: theme.accent + '22',
    },
    sortChipText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.textMuted,
    },
    sortChipTextOn: {
      color: theme.accent,
    },
    empty: {
      paddingVertical: 32,
      textAlign: 'center',
      fontSize: 12,
      color: theme.textMuted,
    },
    thread: {
      gap: 8,
      marginBottom: 6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    replyRow: {
      marginLeft: 18,
      paddingLeft: 8,
    },
    replyRail: {
      position: 'absolute',
      left: -1,
      top: -8,
      bottom: -8,
      width: 2,
      borderRadius: 1,
      backgroundColor: theme.border,
    },
    rootReplyRail: { position: 'absolute', left: 17, top: 34, bottom: -8, width: 2, backgroundColor: theme.border },
    lastReplyRail: { bottom: undefined, height: 23 },
    replyElbow: {
      position: 'absolute', left: -1, top: 13, width: 16, height: 10,
      borderLeftWidth: 2, borderBottomWidth: 2, borderBottomLeftRadius: 8,
      borderColor: theme.border,
    },
    bubbleWrap: {
      flex: 1,
      minWidth: 0,
    },
    toggleReplies: {
      marginLeft: 52,
      paddingVertical: 4,
    },
    toggleRepliesText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.accent,
    },
  });
}

export default BuklodCommunityCommentThread;
