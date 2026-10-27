import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  detectSmartDrawerDate,
} from '@/lib/smartDrawer/classify';
import { makeGoogleCalendarEventUrl } from '@/lib/smartDrawer/calendar';
import {
  deleteSmartDrawerAsset,
} from '@/lib/smartDrawer/assets';
import {
  getSmartDrawerItem,
  createSmartDrawerFolder,
  listSmartDrawerFolders,
  moveSmartDrawerItemToFolder,
  saveSmartDrawerItem,
  setSmartDrawerKeepOnTop,
  toggleSmartDrawerListEntry,
} from '@/lib/smartDrawer/localStore';
import {
  findRelatedSmartDrawerItems,
} from '@/lib/smartDrawer/related';
import {
  commitSmartDrawerItem,
  transitionSmartDrawerItem,
} from '@/lib/smartDrawer/service';
import type {
  SmartDrawerItem,
  SmartDrawerItemType,
  SmartDrawerFolder,
} from '@/lib/smartDrawer/types';
import { useAuth } from '@/providers/AuthProvider';

const TYPES: SmartDrawerItemType[] = [
  'SHOPPING_LIST',
  'CHECKLIST',
  'TASK',
  'DUE_TASK',
  'EVENT',
  'APPOINTMENT',
  'PROGRAM',
  'WRITING',
  'POEM',
  'IDEA',
  'REFERENCE',
  'DOCUMENT',
  'RECEIPT',
  'NOTICE',
  'CONTACT_REFERENCE',
  'QUICK_NOTE',
  'OTHER',
];

function prettyType(value: string) {
  return value.replaceAll('_', ' ');
}

export default function SmartDrawerItemScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();
  const itemId = String(
    Array.isArray(params.id)
      ? params.id[0] ?? ''
      : params.id ?? '',
  );

  const [item, setItem] =
    useState<SmartDrawerItem | null>(null);
  const [related, setRelated] =
    useState<SmartDrawerItem[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [busy, setBusy] =
    useState(false);
  const [notice, setNotice] =
    useState('');
  const [actionsOpen, setActionsOpen] =
    useState(false);
  const [editing, setEditing] =
    useState(false);
  const [folders, setFolders] = useState<SmartDrawerFolder[]>([]);
  const [folderName, setFolderName] = useState('');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [location, setLocation] = useState('');
  const [dateText, setDateText] = useState('');
  const [type, setType] =
    useState<SmartDrawerItemType>('QUICK_NOTE');

  const syncFields = useCallback(
    (next: SmartDrawerItem) => {
      setItem(next);
      setTitle(next.title);
      setBody(next.body);
      setLocation(next.location);
      setDateText(
        next.dueAt
          ? new Date(next.dueAt).toLocaleString()
          : '',
      );
      setType(next.type);
    },
    [],
  );

  const load = useCallback(async () => {
    if (!user?.id || !itemId) {
      setItem(null);
      setRelated([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const next =
        await getSmartDrawerItem(
          user.id,
          itemId,
        );
      if (!next) {
        setItem(null);
        return;
      }

      syncFields(next);
      setFolders(await listSmartDrawerFolders(user.id));
      setRelated(
        await findRelatedSmartDrawerItems(
          user.id,
          next,
          3,
        ),
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not load this Drawer item.',
      );
    } finally {
      setLoading(false);
    }
  }, [itemId, syncFields, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const dueLabel = useMemo(() => {
    if (!item?.dueAt) return '';
    const date = new Date(item.dueAt);
    return Number.isNaN(date.getTime())
      ? item.dueAt
      : date.toLocaleString();
  }, [item?.dueAt]);

  const saveEdit = async () => {
    if (!user?.id || !item || busy) return;

    setBusy(true);
    setNotice('');

    try {
      const dueAt =
        dateText.trim()
          ? detectSmartDrawerDate(dateText) ??
            item.dueAt
          : null;

      const result =
        await commitSmartDrawerItem(
          user.id,
          {
            ...item,
            id: item.id,
            title: title.trim() || 'Untitled',
            body,
            extractedText:
              item.extractedText || body,
            location: location.trim(),
            dueAt,
            eventAt:
              ['EVENT', 'APPOINTMENT', 'PROGRAM'].includes(type)
                ? dueAt
                : item.eventAt,
            type,
            syncState: 'LOCAL_ONLY',
          },
        );

      syncFields(result.item);
      setEditing(false);

      setNotice(
        result.reminderWarning
          ? `Saved. ${result.reminderWarning}`
          : result.reminderScheduled
            ? 'Saved. Reminder scheduled.'
            : 'Saved to Drawer.',
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not save this change.',
      );
    } finally {
      setBusy(false);
    }
  };

  const moveFolder = async (folderId: string | null) => {
    if (!user?.id || !item || busy) return;
    setBusy(true);
    try {
      syncFields(await moveSmartDrawerItemToFolder(user.id, item.id, folderId));
      setNotice(`Filed in ${folders.find(folder => folder.id === folderId)?.name ?? prettyType(item.type)}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Move failed.'); }
    finally { setBusy(false); }
  };

  const addFolder = async () => {
    if (!user?.id || !folderName.trim()) return;
    setBusy(true);
    try {
      const folder = await createSmartDrawerFolder(user.id, folderName);
      setFolders(await listSmartDrawerFolders(user.id));
      setFolderName('');
      syncFields(await moveSmartDrawerItemToFolder(user.id, item!.id, folder.id));
      setNotice(`Created “${folder.name}” and moved note into it.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create folder.'); }
    finally { setBusy(false); }
  };

  const toggleImportant = async () => {
    if (!user?.id || !item || busy) return;
    setBusy(true);
    try {
      const next = await saveSmartDrawerItem(user.id, { ...item, protectedFromExpiry: !item.protectedFromExpiry });
      syncFields(next);
      setNotice(next.protectedFromExpiry ? 'Important. Automatic cleanup will not delete this note.' : 'Important protection removed. Only explicitly dated content can auto-expire.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not update protection.'); }
    finally { setBusy(false); }
  };

  const openAsset = async (asset: SmartDrawerItem['assets'][number]) => {
    try {
      if (Platform.OS === 'web') await Linking.openURL(asset.uri);
      else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(asset.uri, { mimeType: asset.mimeType ?? undefined });
      else setNotice('No compatible file app is installed. Original remains safe in the Drawer.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not open file.'); }
  };

  const addCalendarEvent = async () => {
    if (!item?.dueAt) return;
    try {
      await Linking.openURL(makeGoogleCalendarEventUrl(item.title, item.dueAt, item.body));
      setNotice('Review and save in Google Calendar. This is a manual export, not automatic sync.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not open Calendar.'); }
  };

  const exportNote = async () => {
    if (!item) return;
    try {
      await Share.share({
        title: item.title,
        message: [item.title, item.body, item.dueAt ? `Due: ${item.dueAt}` : '',
          ...item.listItems.map(row => `${row.done ? '[x]' : '[ ]'} ${row.text}`)]
          .filter(Boolean).join('\n\n'),
      });
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not export note.'); }
  };

  const runStatus = async (
    status: SmartDrawerItem['status'],
    success: string,
  ) => {
    if (!user?.id || !item || busy) return;

    setBusy(true);
    setActionsOpen(false);
    setNotice('');

    try {
      const next =
        await transitionSmartDrawerItem(
          user.id,
          item.id,
          status,
        );
      syncFields(next);
      setNotice(success);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not update this item.',
      );
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async () => {
    if (!user?.id || !item || busy) return;

    setBusy(true);
    try {
      const next =
        await setSmartDrawerKeepOnTop(
          user.id,
          item.id,
          !item.keepOnTop,
        );
      syncFields(next);
      setActionsOpen(false);
      setNotice(
        next.keepOnTop
          ? 'Kept on top.'
          : 'Removed from Keep on Top.',
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not update Keep on Top.',
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleMute = async () => {
    if (!user?.id || !item || busy) return;

    setBusy(true);
    try {
      const result =
        await commitSmartDrawerItem(
          user.id,
          {
            ...item,
            id: item.id,
            reminderMuted:
              !item.reminderMuted,
            syncState: 'LOCAL_ONLY',
          },
        );
      syncFields(result.item);
      setActionsOpen(false);
      setNotice(
        result.item.reminderMuted
          ? 'Reminder muted.'
          : result.reminderScheduled
            ? 'Reminder restored.'
            : result.reminderWarning ||
              'Reminder unmuted. No future due date is available to schedule.',
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not change reminder setting.',
      );
    } finally {
      setBusy(false);
    }
  };

  const removeOriginalImages = () => {
    if (!user?.id || !item || !item.assets.length || busy) {
      return;
    }

    Alert.alert(
      'Remove Original Image?',
      'BUKLOD will keep the note, but its original local files cannot be restored after removal.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'REMOVE FILES',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            setActionsOpen(false);
            void (async () => {
              try {
                const updated = await saveSmartDrawerItem(user.id, {
                  ...item, assets: [], syncState: 'LOCAL_ONLY',
                });
                syncFields(updated);
                await Promise.all(item.assets.map(asset => deleteSmartDrawerAsset(asset)));
                setNotice(
                  'Original files removed. The saved note remains in your Drawer.',
                );
              } catch (error) {
                setNotice(
                  error instanceof Error
                    ? error.message
                    : 'Could not remove the original file.',
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const toggleList = async (listId: string) => {
    if (!user?.id || !item || busy) return;
    setBusy(true);
    try {
      const next =
        await toggleSmartDrawerListEntry(
          user.id,
          item.id,
          listId,
        );
      syncFields(next);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0A6EBD" />
        <Text style={styles.centerText}>
          Opening your saved item…
        </Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons
          name="archive-alert-outline"
          size={42}
          color="#7D9AAF"
        />
        <Text style={styles.notFoundTitle}>
          This Drawer item is not available.
        </Text>
        <Text style={styles.centerText}>
          It may belong to another signed-in account or may already have been permanently removed.
        </Text>
        <Pressable
          onPress={() =>
            router.replace('/drawer' as any)
          }
          style={styles.primarySmall}
        >
          <Text style={styles.primaryText}>
            Back to Drawer
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace('/drawer' as any)
          }
          accessibilityLabel="Back"
          style={styles.headerButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color="#173B63"
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={styles.headerTitle}
          >
            {item.title}
          </Text>
          <Text style={styles.headerSub}>
            {prettyType(item.type)}
          </Text>
        </View>

        <Pressable
          onPress={() => setActionsOpen(true)}
          accessibilityLabel="Item actions"
          style={styles.headerButton}
        >
          <MaterialCommunityIcons
            name="dots-horizontal"
            size={23}
            color="#173B63"
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              Math.max(34, insets.bottom + 20),
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {!!notice && (
          <View style={styles.notice}>
            <MaterialCommunityIcons
              name="information-outline"
              size={18}
              color="#0A6EBD"
            />
            <Text style={styles.noticeText}>
              {notice}
            </Text>
          </View>
        )}

        {editing ? (
          <>
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.input}
            />

            <Text style={styles.label}>
              Notes / text
            </Text>
            <TextInput
              multiline
              value={body}
              onChangeText={setBody}
              style={[
                styles.input,
                styles.multiline,
              ]}
            />

            <Text style={styles.label}>
              Date / due date
            </Text>
            <TextInput
              value={dateText}
              onChangeText={setDateText}
              placeholder="October 5, 2026 2:00 PM"
              placeholderTextColor="#8799A8"
              style={styles.input}
            />

            <Text style={styles.label}>
              Location
            </Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              style={styles.input}
            />

            <Text style={styles.label}>
              Type
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typeRow}
            >
              {TYPES.map(value => (
                <Pressable
                  key={value}
                  onPress={() => setType(value)}
                  style={[
                    styles.typeChip,
                    type === value &&
                      styles.typeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeText,
                      type === value &&
                        styles.typeTextActive,
                    ]}
                  >
                    {prettyType(value)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.editActions}>
              <Pressable
                onPress={() => {
                  syncFields(item);
                  setEditing(false);
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryText}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => void saveEdit()}
                style={styles.primaryButton}
              >
                {busy && (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.primaryText}>
                  Save
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            {!!item.assets.length && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.assets}
              >
                {item.assets.map(asset => (
                  <Pressable key={asset.id} onPress={() => void openAsset(asset)}>
                    {asset.kind === 'FILE' || (asset.mimeType && !asset.mimeType.startsWith('image/')) ? (
                      <View style={[styles.asset, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#DFECF7' }]}>
                        <MaterialCommunityIcons name="file-document-outline" size={30} color="#125A91" />
                        <Text numberOfLines={2} style={{ maxWidth: 110, fontSize: 11, textAlign: 'center' }}>{asset.originalName ?? 'Open file'}</Text>
                      </View>
                    ) : <Image source={{ uri: asset.uri }} style={styles.asset} resizeMode="cover" />}
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <View style={styles.titleBlock}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {item.title}
                </Text>
                <Text style={styles.type}>
                  {prettyType(item.type)}
                </Text>
              </View>
              {item.keepOnTop && (
                <View style={styles.pinned}>
                  <MaterialCommunityIcons
                    name="pin"
                    size={14}
                    color="#B56D00"
                  />
                  <Text style={styles.pinnedText}>
                    Keep on Top
                  </Text>
                </View>
              )}
            </View>

            <View style={{ gap: 8, paddingVertical: 12 }}>
              <Text style={styles.label}>Saved in: {folders.find(folder => folder.id === item.folderId)?.name ?? prettyType(item.type)}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[{ id: '', name: 'Auto-organize' }, ...folders].map(folder => (
                  <Pressable key={folder.id} disabled={busy} onPress={() => void moveFolder(folder.id || null)}
                    style={{ backgroundColor: (item.folderId ?? '') === folder.id ? '#D1EBFA' : '#ECF1F5', padding: 9, borderRadius: 9, marginRight: 8 }}>
                    <Text>{folder.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput value={folderName} onChangeText={setFolderName} placeholder="Create folder & move here" style={[styles.input, { flex: 1 }]} />
                <Pressable disabled={busy} onPress={() => void addFolder()} style={{ alignSelf: 'center', padding: 9, borderRadius: 8, backgroundColor: '#D1EBFA' }}><Text>Create</Text></Pressable>
              </View>
              <Pressable onPress={() => void toggleImportant()} disabled={busy} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 8 }}>
                <MaterialCommunityIcons name={item.protectedFromExpiry ? 'shield-check' : 'shield-outline'} size={20} color="#178267" />
                <Text>{item.protectedFromExpiry ? 'Important · Protected from auto-delete' : 'Protect this note from auto-delete'}</Text>
              </Pressable>
              {!!item.expiresAt && <Text style={styles.label}>Expires: {new Date(item.expiresAt).toLocaleString()} · Recoverable after expiry</Text>}
            </View>

            {!!dueLabel && (
              <InfoRow
                icon="calendar-clock-outline"
                label={dueLabel}
              />
            )}
            {!!item.dueAt && <Pressable onPress={() => void addCalendarEvent()} style={{ padding: 10 }}>
              <Text style={{ color: '#166EAC' }}>Add to Google Calendar (optional)</Text>
            </Pressable>}
            {!!item.location && (
              <InfoRow
                icon="map-marker-outline"
                label={item.location}
              />
            )}
            <InfoRow
              icon={
                item.reminderMuted
                  ? 'bell-off-outline'
                  : 'bell-outline'
              }
              label={
                item.reminderMuted
                  ? 'Reminder muted'
                  : item.reminderIds.length
                    ? 'Local reminder scheduled'
                    : 'No active reminder'
              }
            />

            {!!item.body && (
              <View style={styles.bodyCard}>
                <Text style={styles.body}>
                  {item.body}
                </Text>
              </View>
            )}

            {!!item.listItems.length && (
              <View style={styles.listCard}>
                <Text style={styles.sectionTitle}>
                  List
                </Text>
                {item.listItems.map(entry => (
                  <Pressable
                    key={entry.id}
                    onPress={() =>
                      void toggleList(entry.id)
                    }
                    style={styles.listRow}
                  >
                    <MaterialCommunityIcons
                      name={
                        entry.done
                          ? 'checkbox-marked'
                          : 'checkbox-blank-outline'
                      }
                      size={22}
                      color={
                        entry.done
                          ? '#2B9B63'
                          : '#7A99B1'
                      }
                    />
                    <Text
                      style={[
                        styles.listText,
                        entry.done &&
                          styles.listTextDone,
                      ]}
                    >
                      {entry.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {!!related.length && (
              <View style={styles.relatedCard}>
                <Text style={styles.sectionTitle}>
                  Related from your Drawer
                </Text>
                <Text style={styles.relatedHint}>
                  Resurfaced only — BUKLOD does not auto-merge.
                </Text>
                {related.map(row => (
                  <Pressable
                    key={row.id}
                    onPress={() =>
                      router.push(
                        `/drawer/item/${row.id}` as any,
                      )
                    }
                    style={styles.relatedRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={styles.relatedTitle}
                      >
                        {row.title}
                      </Text>
                      <Text style={styles.relatedType}>
                        {prettyType(row.type)}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={19}
                      color="#8196A8"
                    />
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={styles.privateNote}>
              Private to this BUKLOD account. Organization admins and ordinary BSOC operators do not receive Drawer content.
            </Text>
          </>
        )}
      </ScrollView>

      <Modal
        visible={actionsOpen}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setActionsOpen(false)
        }
      >
        <Pressable
          style={styles.scrim}
          onPress={() =>
            setActionsOpen(false)
          }
        >
          <Pressable
            onPress={event =>
              event.stopPropagation()
            }
            style={[
              styles.sheet,
              {
                paddingBottom:
                  Math.max(
                    16,
                    insets.bottom + 8,
                  ),
              },
            ]}
          >
            <Text style={styles.sheetTitle}>
              {item.title}
            </Text>

            <SheetAction
              icon="eye-outline"
              label="View"
              onPress={() =>
                setActionsOpen(false)
              }
            />
            <SheetAction
              icon="pencil-outline"
              label="Edit"
              onPress={() => {
                setActionsOpen(false);
                setEditing(true);
              }}
            />
            {item.status !== 'RECENTLY_REMOVED' && (
              <SheetAction
                icon="account-group-outline"
                label="Share / Collaborate"
                onPress={() => {
                  setActionsOpen(false);
                  router.push(`/drawer/share?itemId=${encodeURIComponent(item.id)}` as any);
                }}
              />
            )}

            <SheetAction icon="export-variant" label="Export / Back up Note" onPress={() => {
              setActionsOpen(false);
              void exportNote();
            }} />

            {item.status === 'ACTIVE' && (
              <SheetAction
                icon="check-circle-outline"
                label="Mark as Done"
                onPress={() =>
                  void runStatus(
                    'DONE',
                    'Marked as done.',
                  )
                }
              />
            )}

            <SheetAction
              icon={
                item.keepOnTop
                  ? 'pin-off-outline'
                  : 'pin-outline'
              }
              label={
                item.keepOnTop
                  ? 'Remove from Top'
                  : 'Keep on Top'
              }
              onPress={() => void togglePin()}
            />

            {!!item.assets.length && (
              <SheetAction
                icon="image-remove-outline"
                label="Manage Original File"
                onPress={removeOriginalImages}
              />
            )}

            {!!item.dueAt && (
              <SheetAction
                icon={
                  item.reminderMuted
                    ? 'bell-outline'
                    : 'bell-off-outline'
                }
                label={
                  item.reminderMuted
                    ? 'Unmute Reminder'
                    : 'Mute Reminder'
                }
                onPress={() => void toggleMute()}
              />
            )}

            {item.status ===
            'RECENTLY_REMOVED' ? (
              <SheetAction
                icon="restore"
                label="Restore"
                onPress={() =>
                  void runStatus(
                    'ACTIVE',
                    'Restored to Drawer.',
                  )
                }
              />
            ) : (
              <>
                {item.status !== 'ARCHIVED' && (
                  <SheetAction
                    icon="archive-outline"
                    label="Move to Archive"
                    onPress={() =>
                      void runStatus(
                        'ARCHIVED',
                        'Moved to Archive.',
                      )
                    }
                  />
                )}
                <SheetAction
                  icon="delete-outline"
                  label="Delete"
                  destructive
                  onPress={() =>
                    void runStatus(
                      'RECENTLY_REMOVED',
                      'Moved to Recently Removed. It can still be restored before the retention window ends.',
                    )
                  }
                />
              </>
            )}

            <Pressable
              onPress={() =>
                setActionsOpen(false)
              }
              style={styles.sheetCancel}
            >
              <Text style={styles.sheetCancelText}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function InfoRow({
  icon,
  label,
}: {
  icon: string;
  label: string;
}) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons
        name={icon as any}
        size={19}
        color="#0A6EBD"
      />
      <Text style={styles.infoText}>
        {label}
      </Text>
    </View>
  );
}

function SheetAction({
  icon,
  label,
  destructive = false,
  onPress,
}: {
  icon: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.sheetAction}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={21}
        color={
          destructive
            ? '#D83A34'
            : '#173B63'
        }
      />
      <Text
        style={[
          styles.sheetActionText,
          destructive &&
            styles.destructiveText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F9FD',
  },
  center: {
    flex: 1,
    backgroundColor: '#F5F9FD',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 26,
    gap: 9,
  },
  centerText: {
    maxWidth: 340,
    color: '#70879A',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  notFoundTitle: {
    color: '#173B63',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  header: {
    minHeight: 66,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DFE8F0',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#173B63',
    fontWeight: '900',
    fontSize: 15,
  },
  headerSub: {
    marginTop: 2,
    color: '#7A8FA1',
    fontSize: 9.5,
  },
  content: {
    padding: 14,
  },
  notice: {
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#EAF4FC',
    padding: 10,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
  },
  noticeText: {
    flex: 1,
    color: '#365A76',
    fontSize: 10.5,
    lineHeight: 15,
  },
  assets: {
    gap: 8,
    paddingBottom: 12,
  },
  asset: {
    width: 230,
    height: 180,
    borderRadius: 15,
    backgroundColor: '#E5EDF4',
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    color: '#173B63',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  type: {
    marginTop: 4,
    color: '#6D8497',
    fontSize: 10,
    fontWeight: '800',
  },
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#FFF3D8',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pinnedText: {
    color: '#A06400',
    fontSize: 8.5,
    fontWeight: '900',
  },
  infoRow: {
    marginTop: 10,
    minHeight: 38,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0EAF2',
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    color: '#41617A',
    fontSize: 11,
  },
  bodyCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E9F1',
    backgroundColor: '#FFFFFF',
    padding: 13,
  },
  body: {
    color: '#294B66',
    fontSize: 13,
    lineHeight: 20,
  },
  listCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE8F1',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  sectionTitle: {
    color: '#173B63',
    fontSize: 13,
    fontWeight: '900',
  },
  listRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7EEF4',
  },
  listText: {
    flex: 1,
    color: '#36556E',
    fontSize: 12,
  },
  listTextDone: {
    color: '#8A9AA7',
    textDecorationLine: 'line-through',
  },
  relatedCard: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: '#EAF4FC',
    padding: 12,
  },
  relatedHint: {
    marginTop: 3,
    marginBottom: 6,
    color: '#70879A',
    fontSize: 9.5,
  },
  relatedRow: {
    minHeight: 48,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  relatedTitle: {
    color: '#294E6A',
    fontWeight: '900',
    fontSize: 11.5,
  },
  relatedType: {
    marginTop: 2,
    color: '#7B90A1',
    fontSize: 9,
  },
  privateNote: {
    marginTop: 16,
    color: '#788C9C',
    fontSize: 9.5,
    lineHeight: 15,
    textAlign: 'center',
  },
  label: {
    marginTop: 10,
    marginBottom: 5,
    color: '#365A76',
    fontSize: 10.5,
    fontWeight: '900',
  },
  input: {
    minHeight: 43,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D6E2EC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    color: '#22435F',
    fontSize: 12,
  },
  multiline: {
    minHeight: 150,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  typeRow: {
    gap: 6,
    paddingBottom: 6,
  },
  typeChip: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4E1EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipActive: {
    backgroundColor: '#E6F3FD',
    borderColor: '#73A8D0',
  },
  typeText: {
    color: '#6F8495',
    fontSize: 9,
    fontWeight: '800',
  },
  typeTextActive: {
    color: '#0A6EBD',
  },
  editActions: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 9,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 47,
    borderRadius: 13,
    backgroundColor: '#E9F0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#31536E',
    fontWeight: '900',
  },
  primaryButton: {
    flex: 1,
    minHeight: 47,
    borderRadius: 13,
    backgroundColor: '#0B70C9',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primarySmall: {
    marginTop: 8,
    minHeight: 45,
    borderRadius: 13,
    backgroundColor: '#0B70C9',
    paddingHorizontal: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11.5,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(19,35,47,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    margin: 10,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    paddingTop: 12,
  },
  sheetTitle: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    color: '#173B63',
    fontWeight: '900',
    fontSize: 13,
  },
  sheetAction: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E9EF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetActionText: {
    color: '#173B63',
    fontSize: 12,
    fontWeight: '800',
  },
  destructiveText: {
    color: '#D83A34',
  },
  sheetCancel: {
    margin: 10,
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: '#E9F0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    color: '#294C67',
    fontWeight: '900',
  },
});
