import * as Clipboard from 'expo-clipboard';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';

import React, {
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  BuklodReactionAction,
  type BuklodReactionOption,
} from '@/components/BuklodReactionAction';
import BuklodTappablePersonName from '@/components/BuklodTappablePersonName';
import BuklodMentionText from '@/components/BuklodMentionText';
import {
  visitMemberProfile,
} from '@/lib/buklodMemberProfile';
import {
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';
import {
  type BuklodThemeRoles,
} from '@/lib/buklodTheme';

export type BuklodCommunityCommentModel = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  commenter_name?: string | null;
  parent_id?: string | null;
  is_owner?: boolean;
  can_manage?: boolean;
  reaction_counts?: Record<string, number> | null;
  my_reaction?: string | null;
};

type Props = {
  comment: BuklodCommunityCommentModel;
  currentUserId?: string | null;
  reactionOptions: readonly BuklodReactionOption[];
  metaLine?: string | null;
  replyingToLabel?: string | null;
  isReply?: boolean;
  bubbleStyle?: object;
  timeLabel: string;
  onReply: () => void;
  onReact: (key: string) => void;
  onReactionSummaryPress?: (
    reactionKey: string
  ) => void;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onReport: () => void;
};

function createStyles(theme: BuklodThemeRoles) {
  return StyleSheet.create({
    root: {
      flex: 1,
      minWidth: 0,
    },
    bubble: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.surfaceElevated,
    },
    replyBubble: {
      backgroundColor: theme.surfaceMuted,
    },
    author: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    meta: {
      marginTop: 2,
      fontSize: 10,
      color: theme.textMuted,
    },
    timeInBubble: {
      marginTop: 2,
      fontSize: 10,
      color: theme.textMuted,
    },
    body: {
      marginTop: 8,
      fontSize: 15,
      lineHeight: 21,
      color: theme.textPrimary,
    },
    mention: {
      fontWeight: '800',
      color: theme.accent,
    },
    footer: {
      marginTop: 4,
      paddingLeft: 4,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
    },
    footerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    footerReactions: {
      flexGrow: 1,
      minWidth: 0,
    },
    actionLink: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.textMuted,
      paddingVertical: 2,
    },
    actionLinkActive: {
      color: theme.accent,
    },
    replyLink: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.textMuted,
      paddingVertical: 2,
    },
    footerTime: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textMuted,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.42)',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      borderRadius: 16,
      padding: 16,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    modalTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    modalInput: {
      minHeight: 96,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: theme.textPrimary,
      textAlignVertical: 'top',
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    modalButton: {
      minHeight: 38,
      paddingHorizontal: 14,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
    },
    modalButtonPrimary: {
      backgroundColor: theme.accent,
    },
    modalButtonText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    modalButtonTextPrimary: {
      color: theme.white,
    },
    pickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    pickerOption: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pickerEmoji: {
      fontSize: 22,
      lineHeight: 26,
    },
  });
}

export function BuklodCommunityCommentBubble({
  comment,
  currentUserId,
  reactionOptions,
  metaLine,
  isReply = false,
  bubbleStyle,
  timeLabel,
  onReply,
  onReact,
  onReactionSummaryPress,
  onEdit,
  onDelete,
  onReport,
}: Props) {
  const { theme } = useBuklodTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [editBusy, setEditBusy] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] =
    useState(false);
  const menuOpenRef = useRef(false);

  const canEdit =
    Boolean(comment.is_owner) &&
    currentUserId &&
    comment.user_id === currentUserId;

  const canDelete =
    Boolean(comment.is_owner || comment.can_manage);

  const canReport =
    currentUserId &&
    comment.user_id !== currentUserId;

  const openEdit = () => {
    setEditBody(comment.body);
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Edit comment',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (value?: string) => {
              const trimmed = String(value ?? '').trim();
              if (!trimmed) {
                return;
              }

              void onEdit(trimmed);
            },
          },
        ],
        'plain-text',
        comment.body
      );

      return;
    }

    setEditOpen(true);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete Comment',
      'Remove this comment permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void onDelete().catch(
              (error: any) => {
                Alert.alert(
                  'Delete Comment',
                  error?.message ??
                    'Could not delete this comment.'
                );
              }
            );
          },
        },
      ]
    );
  };

  const showDetails = () => {
    Alert.alert(
      'Comment details',
      [
        `Author: ${resolvePersonDisplayName(
          comment.commenter_name,
          comment.user_id,
        )}`,
        `Posted: ${timeLabel}`,
        `ID: ${comment.id}`,
      ].join('\n')
    );
  };

  const openMenu = () => {
    if (menuOpenRef.current) {
      return;
    }

    menuOpenRef.current = true;

    const actions: {
      text: string;
      onPress?: () => void;
      style?: 'cancel' | 'destructive';
    }[] = [
      {
        text: 'Reply',
        onPress: onReply,
      },
      {
        text: 'Copy Text',
        onPress: () => {
          void Clipboard.setStringAsync(
            comment.body
          );
        },
      },
      {
        text: 'React',
        onPress: () =>
          setReactionPickerOpen(true),
      },
    ];

    if (canEdit) {
      actions.push({
        text: 'Edit',
        onPress: openEdit,
      });
    }

    if (canDelete) {
      actions.push({
        text: 'Delete',
        style: 'destructive',
        onPress: confirmDelete,
      });
    }

    if (canReport) {
      actions.push({
        text: 'Report',
        onPress: onReport,
      });
    }

    if (comment.user_id) {
      actions.push({
        text: 'Visit Profile',
        onPress: () => {
          visitMemberProfile(
            comment.user_id,
            resolvePersonDisplayName(
              comment.commenter_name,
              comment.user_id,
            ),
          );
        },
      });
    }

    actions.push({
      text: 'View Details',
      onPress: showDetails,
    });

    actions.push({
      text: 'Cancel',
      style: 'cancel',
    });

    Alert.alert(
      'Comment',
      undefined,
      actions,
      {
        cancelable: true,
        onDismiss: () => {
          menuOpenRef.current = false;
        },
      }
    );

    setTimeout(() => {
      menuOpenRef.current = false;
    }, 500);
  };

  const saveEdit = async () => {
    const trimmed = editBody.trim();

    if (!trimmed) {
      Alert.alert(
        'Edit comment',
        'Comment cannot be empty.'
      );

      return;
    }

    setEditBusy(true);

    try {
      await onEdit(trimmed);
      setEditOpen(false);
    }
    catch (error: any) {
      Alert.alert(
        'Edit comment',
        error?.message ?? 'Could not save this comment.'
      );
    }
    finally {
      setEditBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Comment actions. Long press for menu."
        delayLongPress={BUKLOD_LONG_PRESS_MS}
        onLongPress={openMenu}
        style={[
          styles.bubble,
          isReply && styles.replyBubble,
          bubbleStyle,
        ]}
      >
        <BuklodTappablePersonName
          userId={comment.user_id}
          displayName={resolvePersonDisplayName(
            comment.commenter_name,
            comment.user_id,
          )}
          style={styles.author}
        >
          {resolvePersonDisplayName(
            comment.commenter_name,
            comment.user_id,
          )}
        </BuklodTappablePersonName>

        {!!metaLine && (
          <Text style={styles.meta}>
            {metaLine}
          </Text>
        )}

        <BuklodMentionText
          text={comment.body}
          style={styles.body}
          mentionStyle={styles.mention}
        />
      </Pressable>

      <View style={styles.footer}>
        <View style={styles.footerActions}>
          <Pressable
            onPress={() =>
              onReact(
                reactionOptions[0]?.key ?? 'with_you'
              )
            }
            hitSlop={BUKLOD_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Like comment"
          >
            <Text
              style={[
                styles.actionLink,
                comment.my_reaction ===
                  (reactionOptions[0]?.key ?? 'with_you') &&
                  styles.actionLinkActive,
              ]}
            >
              Like
            </Text>
          </Pressable>

          <Pressable
            onPress={onReply}
            hitSlop={BUKLOD_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Reply"
          >
            <Text style={styles.replyLink}>
              Reply
            </Text>
          </Pressable>

          <Text style={styles.footerTime}>
            {timeLabel}
          </Text>
        </View>

        <View style={styles.footerReactions}>
          <BuklodReactionAction
            layout="comment"
            options={reactionOptions}
            counts={comment.reaction_counts}
            mine={comment.my_reaction}
            onSelect={onReact}
            onSummaryPress={onReactionSummaryPress}
          />
        </View>
      </View>

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setEditOpen(false)
        }
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Edit comment
            </Text>

            <TextInput
              value={editBody}
              onChangeText={setEditBody}
              multiline
              style={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <Pressable
                disabled={editBusy}
                onPress={() =>
                  setEditOpen(false)
                }
                style={styles.modalButton}
              >
                <Text style={styles.modalButtonText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={editBusy}
                onPress={() =>
                  void saveEdit()
                }
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                ]}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    styles.modalButtonTextPrimary,
                  ]}
                >
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reactionPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setReactionPickerOpen(false)
        }
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() =>
            setReactionPickerOpen(false)
          }
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              React to comment
            </Text>

            <View style={styles.pickerRow}>
              {reactionOptions.map(option => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  onPress={() => {
                    setReactionPickerOpen(false);
                    onReact(option.key);
                  }}
                  style={styles.pickerOption}
                >
                  <Text style={styles.pickerEmoji}>
                    {option.emoji}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
