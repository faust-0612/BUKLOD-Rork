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
  focusCommentId?: string | null;
  onFocusedCommentLayout?: (y:number)=>void;
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
  /** Optional labelled native-sponsored banner after organic conversation. */
  inlineAd?: React.ReactNode;
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
  focusCommentId,
  onFocusedCommentLayout,
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
  inlineAd,
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
  ) => (
    <View style={[styles.row, isReply && styles.replyRow,
      String(comment.id)===String(focusCommentId)&&{
        backgroundColor:'rgba(27,153,97,0.09)',borderRadius:12,
        borderWidth:1,borderColor:'#28AA76',
      }]}>
      {isReply ? <View style={styles.replyRail} /> : null}
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
        threads.map(({ root, replies }, threadIndex) => {
          const rootId = String(root.id);
          const focusInside=!!focusCommentId&&(rootId===String(focusCommentId)||
            replies.some(row=>String(row.id)===String(focusCommentId)));
          const isExpanded = focusInside||Boolean(expanded[rootId]);
          const hiddenCount = Math.max(0, replies.length - COLLAPSE_AFTER);
          const visibleReplies =
            isExpanded || replies.length <= COLLAPSE_AFTER
              ? replies
              : replies.slice(0, COLLAPSE_AFTER);

          return (
            <React.Fragment key={rootId}>
            <View style={styles.thread}
              onLayout={event=>{
                if(focusInside)onFocusedCommentLayout?.(event.nativeEvent.layout.y);
              }}>
              {renderBubble(root, root, false)}

              {visibleReplies.map((reply) => (
                <View key={String(reply.id)}>
                  {renderBubble(reply, root, true)}
                </View>
              ))}

              {hiddenCount > 0 && !isExpanded ? (
                <Pressable
                  onPress={() =>
                    setExpanded((prev) => ({ ...prev, [rootId]: true }))
                  }
                  style={styles.toggleReplies}
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
                >
                  <Text style={styles.toggleRepliesText}>Hide replies</Text>
                </Pressable>
              ) : null}
            </View>
            {inlineAd && threadIndex === (threads.length === 1 ? 0 : 1) ? (
              <View style={styles.inlineAd}>{inlineAd}</View>
            ) : null}
            </React.Fragment>
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
      gap: 8,
    },
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    sortLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.textMuted,
      marginRight: 2,
    },
    sortChip: {
      paddingHorizontal: 8,
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
      fontSize: 13,
      fontWeight: '800',
      color: theme.textMuted,
    },
    sortChipTextOn: {
      color: theme.accent,
    },
    empty: {
      paddingVertical: 32,
      textAlign: 'center',
      fontSize: 14,
      color: theme.textMuted,
    },
    thread: {
      gap: 8,
      marginBottom: 6,
    },
    inlineAd: { marginVertical: 9 },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
    },
    replyRow: {
      marginLeft: 12,
      paddingLeft: 8,
    },
    replyRail: {
      position: 'absolute',
      left: -10,
      top: 4,
      bottom: 8,
      width: 2,
      borderRadius: 1,
      backgroundColor: theme.border,
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
      fontSize: 13,
      fontWeight: '800',
      color: theme.accent,
    },
  });
}

export default BuklodCommunityCommentThread;
