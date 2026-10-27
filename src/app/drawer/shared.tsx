import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { createSharedDrawerFolder, createSharedDrawerWorkItem, deleteSharedDrawerFolder, loadSharedDrawerFolders, loadSharedDrawerItems, type SharedDrawerFolder, type SharedDrawerItem } from '@/lib/smartDrawer/shared';

export default function SharedDrawerScreen() {
  const { user } = useAuth();
  const { scopes } = useBuklodScope();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<SharedDrawerItem[]>([]);
  const [folders, setFolders] = useState<SharedDrawerFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectScopeId, setProjectScopeId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setFolders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextItems, nextFolders] = await Promise.all([
        loadSharedDrawerItems(100), loadSharedDrawerFolders(),
      ]);
      setItems(nextItems);
      setFolders(nextFolders);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load shared items.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const addProject = async () => {
    if (!user?.id || !projectName.trim() || creating) return;
    setCreating(true);
    setError('');
    try {
      const folder = await createSharedDrawerFolder(user.id, projectName, projectScopeId);
      setFolderId(folder.id);
      setProjectName('');
      setFolders(await loadSharedDrawerFolders());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create project.'); }
    finally { setCreating(false); }
  };
  const removeProject = async (id: string) => {
    if (!user?.id) return;
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setCreating(true);
    try {
      await deleteSharedDrawerFolder(id, user.id);
      setFolderId(null);
      setConfirmDelete(null);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Cannot remove project folder.'); }
    finally { setCreating(false); }
  };
  const visibleItems = folderId ? items.filter(item => item.folder_id === folderId) : items;
  const canCreateHere = !folderId || folders.find(folder => folder.id === folderId)?.owner_id === user?.id;

  const addWorkItem = async () => {
    if (!user?.id || !newTitle.trim() || creating || !canCreateHere) return;
    setCreating(true);
    setError('');
    try {
      const folder = folders.find(row => row.id === folderId);
      const id = await createSharedDrawerWorkItem(user.id, {
        title: newTitle, body: newBody, folderId,
        scopeId: folder?.scope_id ?? null,
      });
      router.push(`/drawer/shared-item/${id}` as any);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create shared task.'); }
    finally { setCreating(false); }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/drawer' as any)} style={styles.back} accessibilityLabel="Back to private Drawer">
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Shared Drawer</Text>
          <Text style={styles.sub}>Collaborative copies only · Private Drawer stays private</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.info}>
          <MaterialCommunityIcons name="shield-check-outline" size={22} color="#1B8064" />
          <Text style={styles.infoText}>An item appears here only if you shared it, someone invited you, or an active cluster shared it with members.</Text>
        </View>
        <Text style={styles.itemTitle}>Project folders · Mini workplace</Text>
        <Text style={styles.subDark}>Choose a folder to focus on its tasks, or create one. Removing a folder only unfiles its shared items.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 12 }}>
          {[{ id: '', name: 'All projects' }, ...folders].map(folder => (
            <Pressable key={folder.id} onPress={() => setFolderId(folder.id || null)}
              style={[styles.projectChip, (folderId ?? '') === folder.id && { backgroundColor: '#CDECF9' }]}>
              <Text>{folder.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <TextInput placeholder="New project folder" value={projectName} onChangeText={setProjectName} style={styles.projectInput} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 8 }}>
          {[{ scope_id: '', name: 'Individual project' }, ...scopes.filter(scope =>
            ['CLUSTER','ORGANIZATION','CHURCH'].includes(scope.scope_type) && scope.membership_status === 'ACTIVE'
          )].map(scope => (
            <Pressable key={scope.scope_id} onPress={() => setProjectScopeId(scope.scope_id || null)}
              style={[styles.projectChip, (projectScopeId ?? '') === scope.scope_id && { backgroundColor: '#D4EEDF' }]}>
              <Text>{scope.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable disabled={creating || !projectName.trim()} onPress={() => void addProject()} style={styles.projectButton}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Create shared project</Text>
        </Pressable>
        {folderId && folders.find(folder => folder.id === folderId)?.owner_id === user?.id && (
          <Pressable onPress={() => void removeProject(folderId)} style={{ padding: 12 }}>
            <Text style={{ color: '#A54D45' }}>{confirmDelete === folderId ? 'Confirm remove folder (items are kept)' : 'Remove this project folder'}</Text>
          </Pressable>
        )}
        <Pressable disabled={!canCreateHere} onPress={() => setNewOpen(value => !value)} style={[styles.projectButton, { backgroundColor: '#158462', opacity: canCreateHere ? 1 : 0.55 }]}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>+ New shared note / task</Text>
        </Pressable>
        {!canCreateHere && <Text style={styles.subDark}>Only the project owner can create a new item here. Invited editors can update existing tasks.</Text>}
        {newOpen && <View style={{ backgroundColor: '#E9F4FB', borderRadius: 12, padding: 12, gap: 8, marginBottom: 12 }}>
          <Text style={styles.subDark}>Your new item belongs to {folders.find(folder => folder.id === folderId)?.name ?? 'your personal shared workspace'}. Invite editors from the item itself.</Text>
          <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Task or note title" style={styles.projectInput} />
          <TextInput multiline value={newBody} onChangeText={setNewBody} placeholder="Description, steps, reminders… (no character limit)"
            style={[styles.projectInput, { minHeight: 90 }]} />
          <Pressable disabled={!newTitle.trim() || creating} onPress={() => void addWorkItem()} style={styles.projectButton}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Create in workspace</Text>
          </Pressable>
        </View>}
        {loading && <ActivityIndicator style={{ marginTop: 25 }} color="#0A6EBD" />}
        {!!error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()}><Text style={styles.retry}>Retry</Text></Pressable>
          </View>
        )}
        {!loading && !error && !visibleItems.length && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-group-outline" size={38} color="#8BA8BC" />
            <Text style={styles.emptyTitle}>{folderId ? 'No items in this project' : 'No shared items yet'}</Text>
            <Text style={styles.subDark}>Create a shared task above, or open a private Drawer note and choose Share.</Text>
          </View>
        )}
        {!loading && visibleItems.map(item => (
          <Pressable key={item.id} onPress={() => router.push(`/drawer/shared-item/${item.id}` as any)}
            accessibilityLabel={`Open shared item ${item.title}`} style={styles.item}>
            <View style={styles.itemIcon}>
              <MaterialCommunityIcons name={item.scope_id ? 'account-group' : 'account-multiple-outline'} size={20} color="#126CB0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemMeta}>{item.owner_id === user?.id ? 'Shared by you' : 'Shared with you'} · {item.status}{item.assigned_to === user?.id ? ' · Assigned to you' : ''}{item.folder_id ? ` · ${folders.find(folder => folder.id === item.folder_id)?.name ?? 'Project'}` : ''}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#91A8B9" />
          </Pressable>
        ))}
        {!loading && items.length === 100 && <Text style={styles.subDark}>Showing the latest 100 shared items. Older items remain saved; pagination is needed for larger workspaces.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F9FC' },
  header: { backgroundColor: '#0A5DA8', flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  sub: { color: '#DCEBFA', fontSize: 10.5 },
  content: { padding: 13, paddingBottom: 36 },
  info: { flexDirection: 'row', gap: 9, padding: 13, backgroundColor: '#E8F7F0', borderRadius: 15, marginBottom: 15 },
  infoText: { color: '#3E715E', flex: 1, fontSize: 11, lineHeight: 16 },
  item: { backgroundColor: '#FFF', borderRadius: 14, padding: 11, marginBottom: 8, flexDirection: 'row', gap: 9, alignItems: 'center', borderWidth: 1, borderColor: '#E0EAF2' },
  itemIcon: { height: 37, width: 37, borderRadius: 12, backgroundColor: '#E5F3FD', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: '#1C3D5B', fontWeight: '900', fontSize: 13 },
  itemMeta: { color: '#6A8091', fontSize: 10, marginTop: 3 },
  error: { backgroundColor: '#FFF1EE', borderRadius: 13, padding: 13 },
  errorText: { color: '#994B42', fontSize: 12 },
  retry: { color: '#096CAE', fontWeight: '900', marginTop: 10 },
  empty: { padding: 36, gap: 7, alignItems: 'center' },
  emptyTitle: { color: '#244965', fontWeight: '900', fontSize: 16 },
  subDark: { color: '#73899A', fontSize: 11, lineHeight: 17, textAlign: 'center' },
  projectChip: { borderRadius: 11, backgroundColor: '#E9F0F5', padding: 10 },
  projectInput: { borderWidth: 1, borderColor: '#D9E4ED', backgroundColor: '#FFFFFF', borderRadius: 11, padding: 12 },
  projectButton: { padding: 12, backgroundColor: '#1374AD', borderRadius: 11, alignSelf: 'flex-start', marginBottom: 11 },
});
