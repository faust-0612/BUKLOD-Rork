import React, {
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';
import {
  type BuklodThemeRoles,
} from '@/lib/buklodTheme';
import {
  COMMUNITY_MAX_PHOTOS,
} from '@/lib/buklodCommunityMediaLimits';
import {
  type CommunityEditPhoto,
} from '@/lib/buklodCommunityPostOwnerActions';
import { pickCommunityPhotos } from '@/lib/buklodPickCommunityPhotos';

type Props = {
  title?: string;
  body?: string;
  authorOnly?: boolean;
  iconColor?: string;
  iconSize?: number;
  maxChars?: number;
  maxPhotos?: number;
  allowPhotoEdit?: boolean;
  photos?: CommunityEditPhoto[];
  style?: StyleProp<ViewStyle>;
  onEdit?: (
    body: string,
    photos?: CommunityEditPhoto[]
  ) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onToggleAuthorOnly?: () => Promise<void> | void;
  onReport?: () => void;
};

export function BuklodContentOverflowMenu({
  title = 'Your post',
  body = '',
  authorOnly = false,
  iconColor,
  iconSize = 20,
  maxChars,
  maxPhotos = COMMUNITY_MAX_PHOTOS,
  allowPhotoEdit = false,
  photos = [],
  style,
  onEdit,
  onDelete,
  onToggleAuthorOnly,
  onReport,
}: Props) {
  const { theme } = useBuklodTheme();
  const styles = useMemo(
    () => createStyles(theme),
    [theme]
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState(body);
  const [editPhotos, setEditPhotos] =
    useState<CommunityEditPhoto[]>(photos);
  const [editBusy, setEditBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const canManage = Boolean(
    onEdit || onDelete || onToggleAuthorOnly
  );

  if (!canManage && !onReport) {
    return null;
  }

  const color = iconColor ?? theme.textMuted;

  const openEdit = () => {
    setEditBody(body);
    setEditPhotos(photos);
    setEditOpen(true);
  };

  const confirmDelete = () => {
    if (!onDelete) {
      return;
    }

    Alert.alert(
      title,
      'Remove this permanently?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void Promise.resolve(onDelete()).catch(
              (error: any) => {
                Alert.alert(
                  title,
                  error?.message ||
                    'Could not delete this.'
                );
              }
            );
          },
        },
      ]
    );
  };

  const openMenu = () => {
    const actions: {
      text: string;
      onPress?: () => void;
      style?: 'cancel' | 'destructive';
    }[] = [];

    if (onEdit) {
      actions.push({
        text: 'Edit',
        onPress: openEdit,
      });
    }

    if (onToggleAuthorOnly) {
      actions.push({
        text: authorOnly
          ? 'Show to everyone'
          : 'Ako lang (only me)',
        onPress: () => {
          void Promise.resolve(
            onToggleAuthorOnly()
          ).catch((error: any) => {
            Alert.alert(
              title,
              error?.message ||
                'Could not update visibility.'
            );
          });
        },
      });
    }

    if (onDelete) {
      actions.push({
        text: 'Delete',
        style: 'destructive',
        onPress: confirmDelete,
      });
    }

    if (onReport) {
      actions.push({
        text: 'Report',
        style: 'destructive',
        onPress: onReport,
      });
    }

    actions.push({
      text: 'Cancel',
      style: 'cancel',
    });

    Alert.alert(title, undefined, actions);
  };

  const addPhotos = async () => {
    const remaining = Math.max(
      0,
      maxPhotos - editPhotos.length
    );

    if (remaining <= 0) {
      Alert.alert(
        'Photos',
        `Maximum of ${maxPhotos} photos per post.`
      );
      return;
    }

    try {
      setPhotoBusy(true);
      const picked = await pickCommunityPhotos({
        remaining,
        maxPhotos,
      });

      if (!picked.length) {
        return;
      }

      setEditPhotos(current =>
        [...current, ...picked].slice(0, maxPhotos)
      );
    } catch (error: any) {
      Alert.alert(
        'Photos',
        error?.message || 'Could not select photos.'
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!onEdit) {
      return;
    }

    const next = editBody.trim();

    if (typeof maxChars === 'number' && next.length > maxChars) {
      Alert.alert(
        'Edit',
        `Please keep this within ${maxChars} characters.`
      );
      return;
    }

    setEditBusy(true);

    try {
      await onEdit(
        next,
        allowPhotoEdit ? editPhotos : undefined
      );
      setEditOpen(false);
    } catch (error: any) {
      Alert.alert(
        'Edit',
        error?.message || 'Could not save this.'
      );
    } finally {
      setEditBusy(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          canManage
            ? `${title} options`
            : 'Report this post'
        }
        hitSlop={BUKLOD_HIT_SLOP}
        onPress={(event) => {
          event.stopPropagation?.();
          openMenu();
        }}
        style={style}
      >
        <MaterialCommunityIcons
          name={
            canManage
              ? 'dots-vertical'
              : 'flag-outline'
          }
          size={iconSize}
          color={color}
        />
      </Pressable>

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setEditOpen(false)
        }
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
        >
          <View style={styles.card}>
            <Text style={styles.modalTitle}>
              Edit
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.editScroll}
            >
              <TextInput
                value={editBody}
                onChangeText={(value) => {
                  if (
                    typeof maxChars === 'number' &&
                    value.length > maxChars
                  ) {
                    setEditBody(
                      value.slice(0, maxChars)
                    );
                    return;
                  }

                  setEditBody(value);
                }}
                multiline
                style={styles.input}
              />

              {typeof maxChars === 'number' ? (
                <Text style={styles.charCount}>
                  {editBody.trim().length}/{maxChars}
                </Text>
              ) : null}

              {allowPhotoEdit ? (
                <View style={styles.photoSection}>
                  <View style={styles.photoHeader}>
                    <Text style={styles.photoLabel}>
                      Photos
                    </Text>
                    <Pressable
                      disabled={
                        photoBusy ||
                        editBusy ||
                        editPhotos.length >= maxPhotos
                      }
                      onPress={() => void addPhotos()}
                      style={styles.addPhotoBtn}
                    >
                      {photoBusy ? (
                        <ActivityIndicator
                          color={theme.accent}
                        />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="image-plus"
                            size={16}
                            color={theme.accent}
                          />
                          <Text style={styles.addPhotoText}>
                            Add
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {editPhotos.length ? (
                    <View style={styles.photoRow}>
                      {editPhotos.map(photo => (
                        <View
                          key={photo.id}
                          style={styles.photoWrap}
                        >
                          {photo.uri ? (
                            <Image
                              source={{ uri: photo.uri }}
                              style={styles.photo}
                            />
                          ) : (
                            <View
                              style={[
                                styles.photo,
                                styles.photoFallback,
                              ]}
                            >
                              <MaterialCommunityIcons
                                name="image-outline"
                                size={18}
                                color={theme.textMuted}
                              />
                            </View>
                          )}
                          <Pressable
                            accessibilityLabel="Remove photo"
                            disabled={editBusy}
                            onPress={() =>
                              setEditPhotos(current =>
                                current.filter(
                                  item => item.id !== photo.id
                                )
                              )
                            }
                            style={styles.photoRemove}
                          >
                            <MaterialCommunityIcons
                              name="close"
                              size={14}
                              color="#FFFFFF"
                            />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.photoEmpty}>
                      No photos. Tap Add to include one.
                    </Text>
                  )}
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.actions}>
              <Pressable
                disabled={editBusy}
                onPress={() => setEditOpen(false)}
                style={styles.button}
              >
                <Text style={styles.buttonText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={editBusy}
                onPress={() => void saveEdit()}
                style={[
                  styles.button,
                  styles.buttonPrimary,
                ]}
              >
                {editBusy ? (
                  <ActivityIndicator
                    color={theme.white}
                  />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      styles.buttonTextPrimary,
                    ]}
                  >
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function createStyles(theme: BuklodThemeRoles) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.42)',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
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
    input: {
      minHeight: 96,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: theme.textPrimary,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textMuted,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    button: {
      minHeight: 38,
      minWidth: 72,
      paddingHorizontal: 14,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surfaceMuted,
    },
    buttonPrimary: {
      backgroundColor: theme.accent,
    },
    buttonText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    buttonTextPrimary: {
      color: theme.white,
    },
    editScroll: {
      maxHeight: 360,
    },
    photoSection: {
      marginTop: 12,
      gap: 8,
    },
    photoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    photoLabel: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.textMuted,
      letterSpacing: 0.5,
    },
    addPhotoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 28,
      paddingHorizontal: 8,
    },
    addPhotoText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.accent,
    },
    photoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    photoWrap: {
      width: 72,
      height: 72,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: theme.surfaceMuted,
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    photoFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoRemove: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.62)',
    },
    photoEmpty: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.textMuted,
    },
  });
}
