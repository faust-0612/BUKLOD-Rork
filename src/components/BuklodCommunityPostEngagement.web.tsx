import type { ReactNode } from 'react';
import {
  Pressable,
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
  rightAction?: ReactNode;
  onReport?: () => void;
};

/*
 * BUKLOD_WEB_REPORT_BUTTON_R1
 *
 * The scoped Wall Report action is a nested feed control. Native uses the
 * canonical BuklodPressable; web/PWA uses a direct Pressable for Report only
 * so browser responder/movement cancellation cannot swallow the click.
 * The existing report sheet and submit flow remain unchanged.
 */
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
  rightAction = null,
  onReport,
}: Props) {
  const { theme } =
    useBuklodTheme();

  const totalComments =
    Number(commentCount ?? 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.actionRow}>
        <View style={styles.reactions}>
          <BuklodReactionAction
            layout="wall"
            options={
              reactionOptions
            }
            counts={
              reactionCounts
            }
            mine={
              myReaction
            }
            onSelect={
              onReact
            }
            onSummaryPress={
              onReactionSummaryPress
            }
          />
        </View>

        {showCommentAction ? (
          <BuklodPressable
            accessibilityRole="button"
            accessibilityLabel={
              `Open comments. ${totalComments} comments`
            }
            nested
            compact
            onPress={
              onOpenComments
            }
            style={
              styles.inlineActionBtn
            }
          >
            <MaterialCommunityIcons
              name="comment-outline"
              size={18}
              color={
                theme.textMuted
              }
            />

            <Text
              style={[
                styles.inlineActionCount,
                {
                  color:
                    theme.textMuted,
                },
              ]}
            >
              {totalComments}
            </Text>
          </BuklodPressable>
        ) : null}

        {rightAction}

        {onReport ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report this post"
            onPress={(event) => {
              event.stopPropagation?.();
              onReport();
            }}
            style={({ pressed }) => [
              styles.reportBtn,
              pressed &&
                styles.reportBtnPressed,
            ]}
          >
            <MaterialCommunityIcons
              name="flag-outline"
              size={15}
              color={
                theme.textMuted
              }
            />

            <Text
              style={[
                styles.reportText,
                {
                  color:
                    theme.textMuted,
                },
              ]}
            >
              Report
            </Text>
          </Pressable>
        ) : null}
      </View>

      {commentPreview ? (
        <BuklodCommunityCommentPreview
          preview={
            commentPreview
          }
          onPress={
            onOpenComments
          }
        />
      ) : totalComments > 0 ? (
        <BuklodPressable
          accessibilityRole="button"
          accessibilityLabel="Open recent comments"
          nested
          onPress={
            onOpenComments
          }
          style={[
            styles.fallbackPreview,
            {
              backgroundColor:
                theme.surfaceMuted,
              borderColor:
                theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.fallbackTitle,
              {
                color:
                  theme.textPrimary,
              },
            ]}
          >
            Recent comment
          </Text>

          <Text
            style={[
              styles.fallbackBody,
              {
                color:
                  theme.textMuted,
              },
            ]}
          >
            {totalComments}{' '}
            {totalComments === 1
              ? 'comment'
              : 'comments'}{' '}
            - tap to view
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
    minHeight: 34,
    paddingHorizontal: 7,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  reportBtnPressed: {
    opacity: 0.58,
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
