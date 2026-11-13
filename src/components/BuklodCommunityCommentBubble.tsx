import * as Clipboard from 'expo-clipboard';
import { Image as ExpoImage } from 'expo-image';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_LONG_PRESS_MS,
} from '@/lib/buklodTouch';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Modal,
  ScrollView,
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
import {
  encodeBuklodCommentMediaBody,
  parseBuklodCommentMediaBody,
} from '@/lib/buklodCommentMediaBody';
import {
  resolveCommunityMediaUrl,
} from '@/lib/buklodMediaUrl';

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
      paddingHorizontal: 8,
      paddingVertical: 8,
      backgroundColor: theme.surfaceElevated,
    },
    replyBubble: {
      backgroundColor: theme.surfaceMuted,
    },
    author: {
      fontSize: 15,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    meta: {
      marginTop: 2,
      fontSize: 12,
      color: theme.textMuted,
    },
    timeInBubble: {
      marginTop: 2,
      fontSize: 12,
      color: theme.textMuted,
    },
    body: {
      marginTop: 6,
      fontSize: 16,
      lineHeight: 23,
      color: theme.textPrimary,
    },
    media: {
      marginTop: 8,
      width: '100%',
      minHeight: 140,
      maxHeight: 220,
      borderRadius: 12,
      backgroundColor: theme.surfaceMuted,
      overflow: 'hidden',
    },
    mediaImage: {
      width: '100%',
      height: 180,
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
      fontSize: 19,
      fontWeight: '800',
      color: theme.textMuted,
      paddingVertical: 2,
    },
    actionLinkActive: {
      color: theme.accent,
    },
    replyLink: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.textMuted,
      paddingVertical: 2,
    },
    footerTime: {
      fontSize: 12,
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
      fontSize: 16,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    modalInput: {
      minHeight: 96,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 9,
      fontSize: 16,
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
      fontSize: 13,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    modalButtonTextPrimary: {
      color: theme.white,
    },
    menuItem: {
      minHeight: 48,
      borderRadius: 10,
      paddingHorizontal: 12,
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
    },
    menuItemText: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    menuItemDanger: {
      color: '#B42318',
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
  // One native Modal for every dialog mode avoids stacked Android modals.
  const [dialogMode, setDialogMode] = useState<
    'actions' | 'edit' | 'reaction' | 'delete' | 'details' | null
  >(null);
  const [editBody, setEditBody] = useState(comment.body);
  const [editBusy, setEditBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const parsedBody = useMemo(
    () => parseBuklodCommentMediaBody(comment.body),
    [comment.body],
  );
  const [mediaUri, setMediaUri] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const media = parsedBody.media;
    if (!media?.ref) {
      setMediaUri(null);
      return;
    }

    // Catalog GIFs are HTTPS; phone GIFs need a signed private Storage URL.
    if (/^https?:\/\//i.test(media.ref)) {
      setMediaUri(media.ref);
      return;
    }

    void resolveCommunityMediaUrl(media.ref).then(url => {
      if (alive) setMediaUri(url || null);
    });

    return () => {
      alive = false;
    };
  }, [parsedBody.media]);

  // Client visibility is a convenience; RPC authorization remains authoritative.
  // Derive author permissions from the authenticated ID even if is_owner
  // from a cached response is stale or absent.
  const isAuthor = Boolean(currentUserId && comment.user_id === currentUserId);
  const canEdit = isAuthor;
  const canDelete = isAuthor || Boolean(comment.can_manage);
  const canReport = Boolean(currentUserId && !isAuthor);

  const openEdit = () => {
    setEditBody(parsedBody.caption);
    setDialogMode('edit');
  };

  const confirmDelete = () => {
    setDeleteError(null);
    setDialogMode('delete');
  };

  const performDelete = async () => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDelete();
      setDialogMode(null);
    } catch (error: any) {
      setDeleteError(error?.message ?? 'Could not delete this comment. Please retry.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const openMenu = () => setDialogMode('actions');
  const actions: {
    label: string;
    onPress: () => void;
    destructive?: boolean;
  }[] = [
    {
      label: 'Reply',
      onPress: () => { setDialogMode(null); onReply(); },
    },
    {
      label: 'Copy Text',
      onPress: () => {
        setDialogMode(null);
        void Clipboard.setStringAsync(parsedBody.caption || comment.body);
      },
    },
    {
      label: 'React',
      onPress: () => setDialogMode('reaction'),
    },
    ...(canEdit ? [{ label: 'Edit', onPress: openEdit }] : []),
    ...(canDelete ? [{
      label: 'Delete',
      destructive: true,
      onPress: confirmDelete,
    }] : []),
    ...(canReport ? [{
      label: 'Report',
      onPress: () => { setDialogMode(null); onReport(); },
    }] : []),
    ...(comment.user_id ? [{
      label: 'Visit Profile',
      onPress: () => {
        setDialogMode(null);
        visitMemberProfile(
          comment.user_id,
          resolvePersonDisplayName(comment.commenter_name, comment.user_id),
        );
      },
    }] : []),
    {
      label: 'View Details',
      onPress: () => setDialogMode('details'),
    },
  ];

  const saveEdit = async () => {
    const trimmed = editBody.trim();

    if (!trimmed && !parsedBody.media) {
      Alert.alert(
        'Edit comment',
        'Comment cannot be empty.'
      );

      return;
    }

    setEditBusy(true);

    try {
      await onEdit(
        encodeBuklodCommentMediaBody(
          parsedBody.media,
          trimmed,
        ),
      );
      setDialogMode(null);
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

        {!!mediaUri && (
          <View style={styles.media}>
            <ExpoImage
              source={{ uri: mediaUri }}
              style={styles.mediaImage}
              contentFit="cover"
            />
          </View>
        )}

        {!!parsedBody.caption.trim() && (
          <BuklodMentionText
            text={parsedBody.caption}
            style={styles.body}
            mentionStyle={styles.mention}
          />
        )}
      </Pressable>

      <View style={styles.footer}>
        <View style={styles.footerActions}>
          <Pressable
            onPress={() => onReact(comment.my_reaction || reactionOptions[0]?.key || 'with_you')}
            onLongPress={() => setDialogMode('reaction')}
            delayLongPress={BUKLOD_LONG_PRESS_MS}
            hitSlop={BUKLOD_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="React to comment"
            accessibilityHint="Long press to choose a different reaction"
            style={{minWidth:38,minHeight:38,alignItems:'center',justifyContent:'center'}}
          >
            <Text
              style={[
                styles.actionLink,
                comment.my_reaction ===
                  (reactionOptions[0]?.key ?? 'with_you') &&
                  styles.actionLinkActive,
              ]}
            >
              {reactionOptions.find(option => option.key === comment.my_reaction)?.emoji ??
                reactionOptions[0]?.emoji ?? '\uD83D\uDC4D'}
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

          <Pressable
            onPress={openMenu}
            hitSlop={BUKLOD_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="More comment actions"
            accessibilityHint="Open Reply, Edit, Delete, and other available comment actions"
            style={{ minWidth: 38, minHeight: 38, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[styles.actionLink, { fontSize: 22 }]}>•••</Text>
          </Pressable>

          <Text style={styles.footerTime}>
            {timeLabel}
          </Text>
        </View>

        <View style={styles.footerReactions}>
          <BuklodReactionAction
            layout="comment"
            showAction={false}
            options={reactionOptions}
            counts={comment.reaction_counts}
            mine={comment.my_reaction}
            onSelect={onReact}
            onSummaryPress={onReactionSummaryPress}
          />
        </View>
      </View>

      <Modal
        visible={dialogMode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!editBusy && !deleteBusy) setDialogMode(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {dialogMode === 'actions' && (
              <>
                <Text style={styles.modalTitle}>Comment actions</Text>
                <ScrollView
                  style={{ maxHeight: 420 }}
                  contentContainerStyle={{ gap: 8 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {actions.map(action => (
                    <Pressable
                      key={action.label}
                      accessibilityRole="button"
                      accessibilityLabel={action.label + ' comment'}
                      onPress={action.onPress}
                      style={styles.menuItem}
                    >
                      <Text style={[
                        styles.menuItemText,
                        action.destructive && styles.menuItemDanger,
                      ]}>
                        {action.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close comment actions"
                  onPress={() => setDialogMode(null)}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
              </>
            )}

            {dialogMode === 'edit' && (
              <>
                <Text style={styles.modalTitle}>Edit comment</Text>
                <TextInput
                  value={editBody}
                  onChangeText={setEditBody}
                  multiline
                  accessibilityLabel="Edit comment text"
                  style={styles.modalInput}
                />
                <View style={styles.modalActions}>
                  <Pressable
                    disabled={editBusy}
                    onPress={() => setDialogMode(null)}
                    style={styles.modalButton}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={editBusy}
                    onPress={() => { void saveEdit(); }}
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                  >
                    <Text style={[
                      styles.modalButtonText,
                      styles.modalButtonTextPrimary,
                    ]}>
                      {editBusy ? 'Saving…' : 'Save'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {dialogMode === 'reaction' && (
              <>
                <Text style={styles.modalTitle}>React to comment</Text>
                <View style={styles.pickerRow}>
                  {reactionOptions.map(option => (
                    <Pressable
                      key={option.key}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      onPress={() => {
                        setDialogMode(null);
                        onReact(option.key);
                      }}
                      style={styles.pickerOption}
                    >
                      <Text style={styles.pickerEmoji}>{option.emoji}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => setDialogMode(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reaction"
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </Pressable>
              </>
            )}

            {dialogMode === 'delete' && (
              <>
                <Text style={styles.modalTitle}>Delete comment?</Text>
                <Text style={{ fontSize: 15, color: theme.textPrimary }}>
                  This comment will be permanently removed.
                </Text>
                {!!deleteError && (
                  <Text accessibilityRole="alert" style={styles.menuItemDanger}>
                    {deleteError}
                  </Text>
                )}
                <View style={styles.modalActions}>
                  <Pressable
                    disabled={deleteBusy}
                    onPress={() => setDialogMode(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel deletion"
                    style={styles.modalButton}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={deleteBusy}
                    onPress={() => { void performDelete(); }}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm delete comment"
                    style={styles.modalButton}
                  >
                    <Text style={styles.menuItemDanger}>
                      {deleteBusy ? 'Deleting…' : 'Delete'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {dialogMode === 'details' && (
              <>
                <Text style={styles.modalTitle}>Comment details</Text>
                <Text style={{ color: theme.textPrimary, fontSize: 14 }}>
                  {[
                    'Author: ' + resolvePersonDisplayName(
                      comment.commenter_name,
                      comment.user_id,
                    ),
                    'Posted: ' + timeLabel,
                    'ID: ' + comment.id,
                  ].join('\n')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close comment details"
                  onPress={() => setDialogMode(null)}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
