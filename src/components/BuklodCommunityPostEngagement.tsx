import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodPressable from '@/components/BuklodPressable';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  BuklodReactionAction,
  type BuklodReactionOption,
} from '@/components/BuklodReactionAction';
import {
  BuklodCommunityCommentPreview,
  type BuklodCommunityCommentPreviewData,
} from '@/components/BuklodCommunityCommentPreview';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

type Props = {
  reactionOptions: readonly BuklodReactionOption[];
  reactionCounts?: Record<string, number> | null;
  myReaction?: string | null;
  commentPreview?: BuklodCommunityCommentPreviewData | null;
  commentCount?: number | null;
  onReact: (key: string) => void;
  onReactionSummaryPress?: (
    reactionKey: string
  ) => void;
  onOpenComments: () => void;
  showCommentAction?: boolean;
  socialActions?: boolean;
  rightAction?: ReactNode;
  onReport?: () => void;
};

export function BuklodCommunityPostEngagement({
  reactionOptions,
  reactionCounts,
  myReaction,
  commentPreview,
  commentCount = 0,
  onReact,
  onReactionSummaryPress,
  onOpenComments,
  showCommentAction = false,
  socialActions = false,
  rightAction = null,
  onReport,
}: Props) {
  const { theme } = useBuklodTheme();
  const totalComments = Number(commentCount ?? 0);
  const activeReactions = reactionOptions.filter(option => Number(reactionCounts?.[option.key] ?? 0) > 0);
  const selectedReaction = reactionOptions.find(option => option.key === myReaction);

  return (
    <View style={styles.wrap}>
      {socialActions && (activeReactions.length > 0 || !!onReport) ? (
        <View style={styles.socialSummary}>
          <View style={styles.socialCounts}>
            {activeReactions.map(option => (
              <BuklodPressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={`View ${Number(reactionCounts?.[option.key] ?? 0)} ${option.label} reactions`}
                nested compact
                disabled={!onReactionSummaryPress}
                onPress={() => onReactionSummaryPress?.(option.key)}
                style={styles.socialCountChip}
              >
                <Text style={styles.socialCountEmoji}>{option.emoji}</Text>
                <Text style={[styles.socialCountText, { color: theme.textMuted }]}>
                  {Number(reactionCounts?.[option.key] ?? 0)}
                </Text>
              </BuklodPressable>
            ))}
          </View>
          {onReport ? (
            <BuklodPressable accessibilityRole="button" accessibilityLabel="Report this post"
              nested compact onPress={onReport} style={styles.socialReport}>
              <MaterialCommunityIcons name="flag-outline" size={16} color={theme.textMuted} />
            </BuklodPressable>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.actionRow, socialActions && styles.socialActionRow]}>
        <View style={[styles.reactions, socialActions && styles.socialReactions]}>
          <BuklodReactionAction
            layout="wall"
            showSummary={!socialActions}
            options={reactionOptions}
            counts={reactionCounts}
            mine={myReaction}
            onSelect={onReact}
            onSummaryPress={onReactionSummaryPress}
          />
          {socialActions ? (
            <Text numberOfLines={1} style={[styles.socialLikeLabel, { color: selectedReaction ? theme.accent : theme.textMuted }]}>
              {selectedReaction?.label ?? 'Like'}
            </Text>
          ) : null}
        </View>

        {showCommentAction ? (
          <BuklodPressable
            accessibilityRole="button"
            accessibilityLabel={`Open comments. ${totalComments} comments`}
            nested
            compact
            onPress={onOpenComments}
            style={[styles.inlineActionBtn, socialActions && styles.socialActionBtn]}
          >
            <MaterialCommunityIcons
              name="comment-outline"
              size={18}
              color={theme.textMuted}
            />
            <Text
              style={[
                styles.inlineActionCount,
                { color: theme.textMuted },
              ]}
            >
              {socialActions ? 'Comment' : totalComments}
            </Text>
          </BuklodPressable>
        ) : null}

        {socialActions && rightAction ? <View style={styles.socialShare}>{rightAction}</View> : rightAction}

        {!socialActions && onReport ? (
          <BuklodPressable
            accessibilityRole="button"
            accessibilityLabel="Report this post"
            nested
            compact
            onPress={onReport}
            style={styles.reportBtn}
          >
            <MaterialCommunityIcons
              name="flag-outline"
              size={15}
              color={theme.textMuted}
            />
            <Text style={[styles.reportText, { color: theme.textMuted }]}>
              Report
            </Text>
          </BuklodPressable>
        ) : null}
      </View>

      {commentPreview ? (
        <BuklodCommunityCommentPreview
          preview={commentPreview}
          onPress={onOpenComments}
        />
      ) : totalComments > 0 ? (
        <BuklodPressable
          accessibilityRole="button"
          accessibilityLabel="Open recent comments"
          nested
          onPress={onOpenComments}
          style={[
            styles.fallbackPreview,
            {
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.fallbackTitle,
              { color: theme.textPrimary },
            ]}
          >
            Recent comment
          </Text>
          <Text
            style={[
              styles.fallbackBody,
              { color: theme.textMuted },
            ]}
          >
            {totalComments}{' '}
            {totalComments === 1
              ? 'comment'
              : 'comments'}{' '}
            — tap to view
          </Text>
        </BuklodPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  socialSummary: { minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 7 },
  socialCounts: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  socialCountChip: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 25 },
  socialCountEmoji: { fontSize: 14 },
  socialCountText: { fontSize: 11, fontWeight: '700' },
  socialReport: { minHeight: 32, minWidth: 32, alignItems: 'center', justifyContent: 'center' },
  socialActionRow: {
    gap: 3,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.22)',
  },
  socialReactions: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  socialLikeLabel: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  socialActionBtn: { flex: 1, minWidth: 0, minHeight: 40, gap: 6 },
  socialShare: { flex: 1, minWidth: 0 },
  actionRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reactions: {
    flex: 1,
    minWidth: 0,
  },
  inlineActionBtn: {
    minHeight: 32,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  inlineActionCount: {
    fontSize: 12,
    fontWeight: '800',
  },
  reportBtn: {
    minHeight: 32,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportText: {
    fontSize: 12,
    fontWeight: '800',
  },
  fallbackPreview: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  fallbackTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  fallbackBody: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
  },
});

export default BuklodCommunityPostEngagement;
