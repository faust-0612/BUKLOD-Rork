import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { loadConnectSuggestedContacts, type ConnectSuggestedContact } from '@/lib/buklodConnectSuggestedContacts';
import { detectSmartDrawerDate } from '@/lib/smartDrawer/classify';
import { makeGoogleCalendarEventUrl } from '@/lib/smartDrawer/calendar';
import {
  deleteSharedDrawerItem, inviteSharedDrawerCollaborator,
  loadSharedDrawerGrants, loadSharedDrawerItem, revokeSharedDrawerAccess,
  updateSharedDrawerItem, type SharedDrawerGrant,
  type SharedDrawerItem, type SharedDrawerRole, type SharedDrawerFolder,
  loadSharedDrawerFolders,
} from '@/lib/smartDrawer/shared';

export default function SharedDrawerItemScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [item, setItem] = useState<SharedDrawerItem | null>(null);
  const [grants, setGrants] = useState<SharedDrawerGrant[]>([]);
  const [contacts, setContacts] = useState<ConnectSuggestedContact[]>([]);
  const [folders, setFolders] = useState<SharedDrawerFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dueText, setDueText] = useState('');
  const [expiryText, setExpiryText] = useState('');
  const [newListEntry, setNewListEntry] = useState('');
  const [editing, setEditing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteId, setInviteId] = useState('');
  const [inviteRole, setInviteRole] = useState<SharedDrawerRole>('VIEWER');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !id) { setItem(null); setGrants([]); setContacts([]); setLoading(false); return; }
    setLoading(true);
    setNotice('');
    try {
      const [next, peers, nextFolders] = await Promise.all([
        loadSharedDrawerItem(id),
        loadConnectSuggestedContacts(60).catch(() => []),
        loadSharedDrawerFolders(),
      ]);
      setItem(next);
      setContacts(peers);
      setFolders(nextFolders);
      if (next) {
        setTitle(next.title);
        setBody(next.body);
        setDueText(next.due_at ? next.due_at.replace('T', ' ').slice(0, 16) : '');
        setExpiryText(next.expires_at ? next.expires_at.replace('T', ' ').slice(0, 16) : '');
        setGrants(await loadSharedDrawerGrants(id));
      } else setGrants([]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Cannot open shared item.');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const isOwner = !!item && item.owner_id === user?.id;
  const canEdit = isOwner || grants.some(grant =>
    grant.user_id === user?.id && grant.access_role === 'EDITOR'
  );
  const availableContacts = useMemo(() => contacts.filter(contact =>
    contact.user_id !== user?.id &&
    !grants.some(grant => grant.user_id === contact.user_id)
  ).slice(0, 30), [contacts, grants, user?.id]);
  const nameOf = (userId: string) =>
    contacts.find(contact => contact.user_id === userId)?.full_name ??
    `Member · ${userId.slice(0, 8)}`;

  const save = async () => {
    if (!item || !canEdit || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const parsedDue = dueText.trim() ? detectSmartDrawerDate(dueText) : null;
      if (dueText.trim() && !parsedDue) throw new Error('Check the date/time. Example: 2026-11-05 14:00.');
      const parsedExpiry = expiryText.trim() ? detectSmartDrawerDate(expiryText) : null;
      if (isOwner && expiryText.trim() && !parsedExpiry) throw new Error('Check the expiry date/time.');
      const updated = await updateSharedDrawerItem(item, {
        title: title.trim(), body, due_at: parsedDue,
        ...(isOwner ? { expires_at: parsedExpiry } : {}),
      });
      setItem(updated);
      setEditing(false);
      setNotice('Shared changes saved for collaborators.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Save failed. Keep your draft and retry.');
    } finally { setBusy(false); }
  };

  const addChecklist = async () => {
    if (!item || !canEdit || busy || !newListEntry.trim()) return;
    setBusy(true);
    try {
      const next = await updateSharedDrawerItem(item, {
        list_items: [...item.list_items, { id: Crypto.randomUUID(), text: newListEntry.trim(), done: false }],
      });
      setItem(next);
      setNewListEntry('');
      setNotice('Task/checklist entry added.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Cannot add task.'); }
    finally { setBusy(false); }
  };

  const organize = async (changes: { folder_id?: string | null; assigned_to?: string | null }) => {
    if (!item || !isOwner || busy) return;
    setBusy(true);
    try {
      setItem(await updateSharedDrawerItem(item, changes));
      setNotice('Project and assignee updated.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Update conflicted. Reload and retry.'); }
    finally { setBusy(false); }
  };

  const exportCalendar = async () => {
    if (!item?.due_at) return;
    try {
      await Linking.openURL(makeGoogleCalendarEventUrl(item.title, item.due_at, 'Added from BUKLOD Shared Drawer'));
      setNotice('Google Calendar opened. Confirm Save there to add the event. This is not an automatic two-way sync.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not open Google Calendar.'); }
  };

  const toggleProtection = async () => {
    if (!item || !isOwner || busy) return;
    setBusy(true);
    try {
      setItem(await updateSharedDrawerItem(item, { protected_from_expiry: !item.protected_from_expiry }));
      setNotice(item.protected_from_expiry ? 'Protection disabled. Explicitly dated content may auto-expire.' : 'Important copy protected. Automatic deletion disabled.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not change protection.'); }
    finally { setBusy(false); }
  };

  const toggleChecklist = async (listId: string) => {
    if (!item || !canEdit || busy) return;
    setBusy(true);
    try {
      const updated = await updateSharedDrawerItem(item, {
        list_items: item.list_items.map(row =>
          row.id === listId ? { ...row, done: !row.done } : row
        ),
      });
      setItem(updated);
      setNotice('Checklist updated.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update checklist.');
    } finally { setBusy(false); }
  };

  const markDone = async () => {
    if (!item || !canEdit || busy) return;
    setBusy(true);
    try {
      const next = await updateSharedDrawerItem(item, {
        status: item.status === 'DONE' ? 'ACTIVE' : 'DONE',
      });
      setItem(next);
      setNotice('Status updated.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not change status.');
    } finally { setBusy(false); }
  };

  const invite = async () => {
    if (!item || !isOwner || !inviteId || busy) return;
    setBusy(true);
    try {
      await inviteSharedDrawerCollaborator(item, user!.id, inviteId, inviteRole);
      setGrants(await loadSharedDrawerGrants(item.id));
      setInviteOpen(false);
      setInviteId('');
      setNotice('Invitation sent to the selected contact.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Invitation failed.');
    } finally { setBusy(false); }
  };

  const revoke = async (userId: string) => {
    if (!item || !isOwner || busy) return;
    setBusy(true);
    try {
      await revokeSharedDrawerAccess(item.id, userId);
      setGrants(current => current.filter(grant => grant.user_id !== userId));
      if (item.assigned_to === userId) setItem(await updateSharedDrawerItem(item, { assigned_to: null }));
      setNotice('Individual access removed.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not revoke access.');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!item || !isOwner || busy) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await deleteSharedDrawerItem(item.id, user!.id);
      router.replace('/drawer/shared' as any);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove shared copy.');
    } finally { setBusy(false); }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/drawer/shared' as any)} accessibilityLabel="Back to Shared Drawer">
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={styles.headerTitle}>{item?.title ?? 'Shared item'}</Text>
          <Text style={styles.headerSub}>{isOwner ? 'You own this shared copy' : canEdit ? 'Can edit' : 'View only'}</Text>
        </View>
        <Pressable onPress={() => void load()} accessibilityLabel="Refresh shared item">
          <MaterialCommunityIcons name="refresh" size={21} color="#FFF" />
        </Pressable>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color="#0A6EBD" /></View>
        : !item ? <View style={styles.center}><Text style={styles.notice}>Unavailable or access has been removed.</Text></View>
        : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.info}>
            <MaterialCommunityIcons name="account-group-outline" color="#197A65" size={20} />
            <Text style={styles.infoText}>Shared copy. Your original private Drawer is unchanged. Changes are checked for conflicts.</Text>
          </View>
          <Text style={styles.label}>Title</Text>
          <TextInput value={editing ? title : item.title} editable={canEdit && editing}
            onChangeText={setTitle} style={[styles.input, !editing && styles.readOnly]} />
          <Text style={styles.label}>Notes</Text>
          <TextInput value={editing ? body : item.body} editable={canEdit && editing}
            multiline onChangeText={setBody} style={[styles.input, styles.body, !editing && styles.readOnly]} />
          <Text style={styles.label}>Remind at / Due date</Text>
          <TextInput value={editing ? dueText : item.due_at ? new Date(item.due_at).toLocaleString() : 'No scheduled reminder'}
            editable={canEdit && editing} onChangeText={setDueText} style={[styles.input, !editing && styles.readOnly]}
            placeholder="Tomorrow 2 PM or 2026-11-05 14:00" />
          {isOwner && <>
            <Text style={styles.label}>Expires at (optional)</Text>
            <TextInput value={editing ? expiryText : item.expires_at ? new Date(item.expires_at).toLocaleString() : 'Never'}
              editable={editing} onChangeText={setExpiryText} style={[styles.input, !editing && styles.readOnly]}
              placeholder="2026-11-06 14:00" />
            <Pressable style={styles.action} onPress={() => void toggleProtection()} disabled={busy}>
              <MaterialCommunityIcons name={item.protected_from_expiry ? 'shield-check' : 'shield-outline'} size={19} color="#168567" />
              <Text style={styles.actionText}>{item.protected_from_expiry ? 'Important · Cannot auto-delete' : 'Allow auto-expiry · Protect this item'}</Text>
            </Pressable>
          </>}
          {canEdit && (
            <Pressable style={styles.action} disabled={busy} onPress={() => editing ? void save() : setEditing(true)}>
              <MaterialCommunityIcons name={editing ? 'content-save' : 'pencil-outline'} color="#0C70B5" size={19} />
              <Text style={styles.actionText}>{editing ? 'Save shared changes' : 'Edit shared item'}</Text>
            </Pressable>
          )}
          {editing && <Pressable onPress={() => { setTitle(item.title); setBody(item.body); setEditing(false); }} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel editing</Text>
          </Pressable>}
          {!!item.list_items.length && (
            <>
              <Text style={styles.label}>Checklist</Text>
              {item.list_items.map(entry => (
                <Pressable key={entry.id} disabled={!canEdit || busy}
                  onPress={() => void toggleChecklist(entry.id)}
                  style={styles.listRow}>
                  <MaterialCommunityIcons name={entry.done ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={21} color={entry.done ? '#188C65' : '#7497AE'} />
                  <Text style={[styles.listText, entry.done && { textDecorationLine: 'line-through' }]}>{entry.text}</Text>
                </Pressable>
              ))}
            </>
          )}
          {canEdit && <View style={{ flexDirection: 'row', gap: 7, marginTop: 10 }}>
            <TextInput value={newListEntry} onChangeText={setNewListEntry} placeholder="Add a task or checklist step"
              style={[styles.input, { flex: 1 }]} />
            <Pressable onPress={() => void addChecklist()} disabled={busy || !newListEntry.trim()} style={styles.action}>
              <MaterialCommunityIcons name="plus" size={22} color="#0C70B5" />
            </Pressable>
          </View>}
          {!!item.due_at && <Text style={styles.due}>Due: {new Date(item.due_at).toLocaleString()}</Text>}
          {!!item.due_at && <Pressable onPress={() => void exportCalendar()} style={styles.action}>
            <MaterialCommunityIcons name="calendar-plus" size={19} color="#0C70B5" />
            <Text style={styles.actionText}>Add to Google Calendar (optional)</Text>
          </Pressable>}
          {canEdit && <Pressable onPress={() => void markDone()} disabled={busy} style={styles.action}>
            <MaterialCommunityIcons name="check-circle-outline" size={19} color="#17885F" />
            <Text style={styles.actionText}>{item.status === 'DONE' ? 'Reopen task' : 'Mark done'}</Text>
          </Pressable>}
          {isOwner && item.status === 'RECENTLY_REMOVED' && (
            <Pressable disabled={busy} onPress={async () => {
              setBusy(true);
              try { setItem(await updateSharedDrawerItem(item, { status: 'ACTIVE', protected_from_expiry: true })); setNotice('Restored and protected.'); }
              catch (error) { setNotice(error instanceof Error ? error.message : 'Cannot restore.'); }
              finally { setBusy(false); }
            }} style={styles.action}><Text style={styles.actionText}>Restore and protect shared copy</Text></Pressable>
          )}
          <Text style={styles.label}>Shared project folder</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 5 }}>
            {[{ id: '', name: 'Unfiled' }, ...folders.filter(folder =>
              folder.owner_id === item.owner_id && folder.scope_id === item.scope_id
            )].map(folder => (
              <Pressable key={folder.id} disabled={!isOwner || busy} onPress={() => void organize({ folder_id: folder.id || null })}
                style={[styles.roleButton, (item.folder_id ?? '') === folder.id && styles.selected]}>
                <Text>{folder.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.helper}>Create or remove project folders from Shared Drawer. Only the owner manages placement.</Text>
          <Text style={styles.label}>Assigned to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
            {[{ user_id: '', access_role: 'VIEWER' as const, item_id: '', owner_id: '' },
              { user_id: item.owner_id, access_role: 'EDITOR' as const, item_id: item.id, owner_id: item.owner_id }, ...grants.filter(grant => grant.access_role === 'EDITOR')].map(grant => (
              <Pressable key={grant.user_id} disabled={!isOwner || busy}
                onPress={() => void organize({ assigned_to: grant.user_id || null })}
                style={[styles.roleButton, (item.assigned_to ?? '') === grant.user_id && styles.selected]}>
                <Text>{grant.user_id ? nameOf(grant.user_id) : 'Unassigned'}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.label}>Individual access</Text>
          {grants.length ? grants.map(grant => (
            <View key={grant.user_id} style={styles.grant}>
              <View style={{ flex: 1 }}>
                <Text style={styles.grantName}>{nameOf(grant.user_id)}</Text>
                <Text style={styles.grantRole}>{grant.access_role}</Text>
              </View>
              {isOwner && <Pressable disabled={busy} onPress={() => void revoke(grant.user_id)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>}
            </View>
          )) : <Text style={styles.helper}>{item.scope_id ? 'Available to active members of its cluster.' : 'No individual collaborators.'}</Text>}
          {isOwner && (
            <>
              <Pressable style={styles.action} onPress={() => setInviteOpen(value => !value)}>
                <MaterialCommunityIcons name="account-plus-outline" size={19} color="#0A6EBD" />
                <Text style={styles.actionText}>Invite another individual</Text>
              </Pressable>
              {inviteOpen && (
                <View style={styles.invite}>
                  <Text style={styles.helper}>Select an existing BUKLOD contact</Text>
                  <View style={styles.roleRow}>
                    {(['VIEWER', 'EDITOR'] as const).map(role => (
                      <Pressable key={role} style={[styles.roleButton, inviteRole === role && styles.roleActive]}
                        onPress={() => setInviteRole(role)}>
                        <Text style={styles.roleText}>{role === 'VIEWER' ? 'Can view' : 'Can edit'}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {availableContacts.map(contact => (
                    <Pressable key={contact.user_id} onPress={() => setInviteId(contact.user_id)}
                      style={[styles.grant, inviteId === contact.user_id && styles.selected]}>
                      <Text style={styles.grantName}>{contact.full_name}</Text>
                    </Pressable>
                  ))}
                  <Pressable disabled={!inviteId || busy} onPress={() => void invite()}
                    style={[styles.primary, (!inviteId || busy) && { opacity: 0.5 }]}>
                    <Text style={styles.primaryText}>Send invitation</Text>
                  </Pressable>
                </View>
              )}
              <Pressable onPress={() => void remove()} disabled={busy} style={styles.delete}>
                <Text style={styles.deleteText}>{confirmDelete ? 'Confirm: remove shared copy' : 'Remove shared copy'}</Text>
              </Pressable>
              {confirmDelete && <Text style={styles.helper}>This removes collaborative access and the shared copy. The original private item remains.</Text>}
            </>
          )}
          {!!notice && <Text style={styles.notice}>{notice}</Text>}
          {busy && <ActivityIndicator color="#0A6EBD" />}
        </ScrollView>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F9FC' },
  header: { padding: 14, backgroundColor: '#0A5DA8', flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  headerSub: { color: '#D7E9F7', fontSize: 10, marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 38 },
  info: { flexDirection: 'row', backgroundColor: '#E8F7EF', padding: 13, gap: 8, borderRadius: 14, marginBottom: 16 },
  infoText: { flex: 1, color: '#3F785F', fontSize: 11, lineHeight: 17 },
  label: { fontWeight: '900', fontSize: 13, color: '#234969', marginTop: 10, marginBottom: 7 },
  input: { borderRadius: 13, borderWidth: 1, borderColor: '#D3E2EC', backgroundColor: '#FFF', padding: 12, color: '#244665', fontSize: 13 },
  readOnly: { backgroundColor: '#EDF4F9' },
  body: { minHeight: 100, textAlignVertical: 'top' },
  action: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 13, marginTop: 10 },
  actionText: { color: '#176DB0', fontSize: 12, fontWeight: '900' },
  cancel: { padding: 9, alignItems: 'center' },
  cancelText: { color: '#738EA1', fontWeight: '900' },
  listRow: { flexDirection: 'row', gap: 8, padding: 9, alignItems: 'center' },
  listText: { flex: 1, fontSize: 12, color: '#254967' },
  due: { marginTop: 12, color: '#8A611C', fontWeight: '900', fontSize: 11 },
  grant: { backgroundColor: '#FFF', padding: 12, marginBottom: 7, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E2EAF0' },
  grantName: { color: '#254967', fontWeight: '900', fontSize: 11 },
  grantRole: { color: '#7A8FA1', fontSize: 10, marginTop: 2 },
  removeText: { color: '#A64A40', fontWeight: '900', fontSize: 11 },
  helper: { color: '#75899A', fontSize: 10.5, lineHeight: 16, marginTop: 5 },
  invite: { backgroundColor: '#EAF4FB', borderRadius: 14, padding: 12, marginTop: 8 },
  roleRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  roleButton: { flex: 1, backgroundColor: '#FFF', padding: 9, borderRadius: 10, alignItems: 'center' },
  roleActive: { borderWidth: 1, borderColor: '#0A7CBA' },
  roleText: { color: '#315B79', fontWeight: '900', fontSize: 11 },
  selected: { borderColor: '#198867', backgroundColor: '#F0FCF7' },
  primary: { backgroundColor: '#0A6EBD', minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { color: '#FFF', fontWeight: '900' },
  delete: { padding: 14, marginTop: 20, alignItems: 'center' },
  deleteText: { color: '#A13E36', fontWeight: '900', fontSize: 12 },
  notice: { color: '#A1483B', fontSize: 11, marginTop: 13, padding: 10, backgroundColor: '#FFF1EF', borderRadius: 10 },
});
