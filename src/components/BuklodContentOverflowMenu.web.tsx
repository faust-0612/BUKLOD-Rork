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

import {
  pickCommunityPhotos,
} from '@/lib/buklodPickCommunityPhotos';

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

/*
 * BUKLOD_WEB_POST_OVERFLOW_MENU_R1
 *
 * React Native Alert action arrays are native-oriented. On web they do not
 * provide the same multi-action behavior, which made the post three-dot
 * control appear non-functional. Web uses an explicit modal action sheet;
 * native continues using BuklodContentOverflowMenu.tsx unchanged.
 */
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

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [deleteOpen, setDeleteOpen] =
    useState(false);

  const [editOpen, setEditOpen] =
    useState(false);

  const [editBody, setEditBody] =
    useState(body);

  const [editPhotos, setEditPhotos] =
    useState<CommunityEditPhoto[]>(
      photos
    );

  const [editBusy, setEditBusy] =
    useState(false);

  const [photoBusy, setPhotoBusy] =
    useState(false);

  const [actionBusy, setActionBusy] =
    useState(false);

  const canManage = Boolean(
    onEdit ||
    onDelete ||
    onToggleAuthorOnly
  );

  if (!canManage && !onReport) {
    return null;
  }

  const color =
    iconColor ??
    theme.textMuted;

  const showError = (
    message: string,
  ) => {
    Alert.alert(
      title,
      message,
    );
  };

  const openEdit = () => {
    setMenuOpen(false);
    setEditBody(body);
    setEditPhotos(photos);
    setEditOpen(true);
  };

  const runToggleVisibility =
    async () => {
      if (!onToggleAuthorOnly) {
        return;
      }

      setMenuOpen(false);
      setActionBusy(true);

      try {
        await onToggleAuthorOnly();
      } catch (error: any) {
        showError(
          error?.message ||
            'Could not update visibility.',
        );
      } finally {
        setActionBusy(false);
      }
    };

  const runDelete =
    async () => {
      if (!onDelete) {
        return;
      }

      setDeleteOpen(false);
      setActionBusy(true);

      try {
        await onDelete();
      } catch (error: any) {
        showError(
          error?.message ||
            'Could not delete this.',
        );
      } finally {
        setActionBusy(false);
      }
    };

  const runReport = () => {
    setMenuOpen(false);

    try {
      onReport?.();
    } catch (error: any) {
      showError(
        error?.message ||
          'Could not open report options.',
      );
    }
  };

  const addPhotos =
    async () => {
      const remaining =
        Math.max(
          0,
          maxPhotos -
            editPhotos.length,
        );

      if (remaining <= 0) {
        Alert.alert(
          'Photos',
          `Maximum of ${maxPhotos} photos per post.`,
        );
        return;
      }

      try {
        setPhotoBusy(true);

        const picked =
          await pickCommunityPhotos({
            remaining,
            maxPhotos,
          });

        if (!picked.length) {
          return;
        }

        setEditPhotos(
          current =>
            [
              ...current,
              ...picked,
            ].slice(
              0,
              maxPhotos,
            ),
        );
      } catch (error: any) {
        Alert.alert(
          'Photos',
          error?.message ||
            'Could not select photos.',
        );
      } finally {
        setPhotoBusy(false);
      }
    };

  const saveEdit =
    async () => {
      if (!onEdit) {
        return;
      }

      const next =
        editBody.trim();

      if (
        typeof maxChars ===
          'number' &&
        next.length >
          maxChars
      ) {
        Alert.alert(
          'Edit',
          `Please keep this within ${maxChars} characters.`,
        );
        return;
      }

      setEditBusy(true);

      try {
        await onEdit(
          next,
          allowPhotoEdit
            ? editPhotos
            : undefined,
        );

        setEditOpen(false);
      } catch (error: any) {
        Alert.alert(
          'Edit',
          error?.message ||
            'Could not save this.',
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
        hitSlop={
          BUKLOD_HIT_SLOP
        }
        disabled={
          actionBusy
        }
        onPress={(event) => {
          event.stopPropagation?.();
          setMenuOpen(true);
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
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setMenuOpen(false)
        }
      >
        <View
          style={
            styles.menuBackdrop
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close post options"
            onPress={() =>
              setMenuOpen(false)
            }
            style={
              StyleSheet.absoluteFill
            }
          />

          <View
            style={
              styles.menuCard
            }
          >
            <View
              style={
                styles.menuHeader
              }
            >
              <Text
                style={
                  styles.menuTitle
                }
                numberOfLines={1}
              >
                {title}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() =>
                  setMenuOpen(false)
                }
                style={
                  styles.menuClose
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={
                    theme.textMuted
                  }
                />
              </Pressable>
            </View>

            {onEdit ? (
              <MenuAction
                icon="pencil-outline"
                label="Edit"
                theme={theme}
                styles={styles}
                onPress={openEdit}
              />
            ) : null}

            {onToggleAuthorOnly ? (
              <MenuAction
                icon={
                  authorOnly
                    ? 'earth'
                    : 'lock-outline'
                }
                label={
                  authorOnly
                    ? 'Show to everyone'
                    : 'Ako lang (only me)'
                }
                theme={theme}
                styles={styles}
                onPress={() =>
                  void runToggleVisibility()
                }
              />
            ) : null}

            {onDelete ? (
              <MenuAction
                icon="delete-outline"
                label="Delete"
                destructive
                theme={theme}
                styles={styles}
                onPress={() => {
                  setMenuOpen(false);
                  setDeleteOpen(true);
                }}
              />
            ) : null}

            {onReport ? (
              <MenuAction
                icon="flag-outline"
                label="Report"
                destructive
                theme={theme}
                styles={styles}
                onPress={runReport}
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setMenuOpen(false)
              }
              style={
                styles.cancelButton
              }
            >
              <Text
                style={
                  styles.cancelText
                }
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setDeleteOpen(false)
        }
      >
        <View
          style={
            styles.menuBackdrop
          }
        >
          <Pressable
            onPress={() =>
              setDeleteOpen(false)
            }
            style={
              StyleSheet.absoluteFill
            }
          />

          <View
            style={
              styles.confirmCard
            }
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Delete post?
            </Text>

            <Text
              style={
                styles.confirmText
              }
            >
              Remove this permanently?
            </Text>

            <View
              style={
                styles.actions
              }
            >
              <Pressable
                disabled={
                  actionBusy
                }
                onPress={() =>
                  setDeleteOpen(false)
                }
                style={
                  styles.button
                }
              >
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  actionBusy
                }
                onPress={() =>
                  void runDelete()
                }
                style={[
                  styles.button,
                  styles.deleteButton,
                ]}
              >
                {actionBusy ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      styles.deleteButtonText,
                    ]}
                  >
                    Delete
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setEditOpen(false)
        }
      >
        <KeyboardAvoidingView
          style={
            styles.backdrop
          }
          behavior="height"
        >
          <View
            style={
              styles.card
            }
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              Edit
            </Text>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={
                styles.editScroll
              }
            >
              <TextInput
                value={editBody}
                onChangeText={(
                  value,
                ) => {
                  if (
                    typeof maxChars ===
                      'number' &&
                    value.length >
                      maxChars
                  ) {
                    setEditBody(
                      value.slice(
                        0,
                        maxChars,
                      ),
                    );
                    return;
                  }

                  setEditBody(
                    value,
                  );
                }}
                multiline
                style={
                  styles.input
                }
              />

              {typeof maxChars ===
              'number' ? (
                <Text
                  style={
                    styles.charCount
                  }
                >
                  {editBody.trim().length}/{maxChars}
                </Text>
              ) : null}

              {allowPhotoEdit ? (
                <View
                  style={
                    styles.photoSection
                  }
                >
                  <View
                    style={
                      styles.photoHeader
                    }
                  >
                    <Text
                      style={
                        styles.photoLabel
                      }
                    >
                      Photos
                    </Text>

                    <Pressable
                      disabled={
                        photoBusy ||
                        editBusy ||
                        editPhotos.length >=
                          maxPhotos
                      }
                      onPress={() =>
                        void addPhotos()
                      }
                      style={
                        styles.addPhotoBtn
                      }
                    >
                      {photoBusy ? (
                        <ActivityIndicator
                          color={
                            theme.accent
                          }
                        />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="image-plus"
                            size={16}
                            color={
                              theme.accent
                            }
                          />

                          <Text
                            style={
                              styles.addPhotoText
                            }
                          >
                            Add
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  {editPhotos.length ? (
                    <View
                      style={
                        styles.photoRow
                      }
                    >
                      {editPhotos.map(
                        photo => (
                          <View
                            key={
                              photo.id
                            }
                            style={
                              styles.photoWrap
                            }
                          >
                            {photo.uri ? (
                              <Image
                                source={{
                                  uri: photo.uri,
                                }}
                                style={
                                  styles.photo
                                }
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
                                  color={
                                    theme.textMuted
                                  }
                                />
                              </View>
                            )}

                            <Pressable
                              accessibilityLabel="Remove photo"
                              disabled={
                                editBusy
                              }
                              onPress={() =>
                                setEditPhotos(
                                  current =>
                                    current.filter(
                                      item =>
                                        item.id !==
                                        photo.id,
                                    ),
                                )
                              }
                              style={
                                styles.photoRemove
                              }
                            >
                              <MaterialCommunityIcons
                                name="close"
                                size={14}
                                color="#FFFFFF"
                              />
                            </Pressable>
                          </View>
                        ),
                      )}
                    </View>
                  ) : (
                    <Text
                      style={
                        styles.photoEmpty
                      }
                    >
                      No photos. Tap Add to include one.
                    </Text>
                  )}
                </View>
              ) : null}
            </ScrollView>

            <View
              style={
                styles.actions
              }
            >
              <Pressable
                disabled={
                  editBusy
                }
                onPress={() =>
                  setEditOpen(false)
                }
                style={
                  styles.button
                }
              >
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  editBusy
                }
                onPress={() =>
                  void saveEdit()
                }
                style={[
                  styles.button,
                  styles.buttonPrimary,
                ]}
              >
                {editBusy ? (
                  <ActivityIndicator
                    color={
                      theme.white
                    }
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

function MenuAction({
  icon,
  label,
  destructive = false,
  onPress,
  theme,
  styles,
}: {
  icon: React.ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];
  label: string;
  destructive?: boolean;
  onPress: () => void;
  theme: BuklodThemeRoles;
  styles: ReturnType<
    typeof createStyles
  >;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuAction,
        pressed &&
          styles.menuActionPressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={
          destructive
            ? '#A43A3A'
            : theme.textPrimary
        }
      />

      <Text
        style={[
          styles.menuActionText,
          destructive &&
            styles.menuActionDestructive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(
  theme: BuklodThemeRoles,
) {
  return StyleSheet.create({
    menuBackdrop: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.32)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    },
    menuCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 18,
      padding: 10,
      backgroundColor:
        theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      boxShadow:
        '0 16px 48px rgba(0,0,0,0.18)',
    } as any,
    menuHeader: {
      minHeight: 42,
      paddingLeft: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },
    menuTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    menuClose: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuAction: {
      minHeight: 48,
      borderRadius: 12,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    menuActionPressed: {
      backgroundColor:
        theme.surfaceMuted,
    },
    menuActionText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '800',
      color: theme.textPrimary,
    },
    menuActionDestructive: {
      color: '#A43A3A',
    },
    cancelButton: {
      minHeight: 42,
      marginTop: 5,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textMuted,
    },
    confirmCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 18,
      padding: 18,
      backgroundColor:
        theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    confirmText: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.textMuted,
    },
    backdrop: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.42)',
      justifyContent: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 640,
      alignSelf: 'center',
      borderRadius: 16,
      padding: 16,
      backgroundColor:
        theme.surfaceElevated,
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
      backgroundColor:
        theme.surfaceMuted,
    },
    buttonPrimary: {
      backgroundColor:
        theme.accent,
    },
    deleteButton: {
      backgroundColor: '#A43A3A',
    },
    buttonText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    buttonTextPrimary: {
      color: theme.white,
    },
    deleteButtonText: {
      color: '#FFFFFF',
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
      justifyContent:
        'space-between',
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
      backgroundColor:
        theme.surfaceMuted,
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
      backgroundColor:
        'rgba(0,0,0,0.62)',
    },
    photoEmpty: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.textMuted,
    },
  });
}
