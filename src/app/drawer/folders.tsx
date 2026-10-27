import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
import { createSmartDrawerFolder, deleteSmartDrawerFolder, listSmartDrawerFolders, renameSmartDrawerFolder } from '@/lib/smartDrawer/localStore';
import type { SmartDrawerFolder } from '@/lib/smartDrawer/types';

export default function DrawerFolders() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [folders, setFolders] = useState<SmartDrawerFolder[]>([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    if (user?.id) setFolders(await listSmartDrawerFolders(user.id));
  }, [user?.id]);
  useFocusEffect(useCallback(() => { void reload().catch(error => setNotice(String(error))); }, [reload]));

  const save = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    setNotice('');
    try {
      if (editingId) {
        await renameSmartDrawerFolder(user.id, editingId, name);
        setNotice('Folder renamed. All notes remain in the same folder.');
      } else {
        const folder = await createSmartDrawerFolder(user.id, name);
        setNotice(`Created “${folder.name}”. Select it from My Drawer when saving a note.`);
      }
      setName('');
      setEditingId(null);
      await reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save folder.');
    } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!user?.id || busy) return;
    setBusy(true);
    try {
      await deleteSmartDrawerFolder(user.id, id);
      setConfirmDeleteId(null);
      setNotice('Folder removed. Its notes are safe and now Unfiled.');
      await reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove folder.');
    } finally { setBusy(false); }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back"><MaterialCommunityIcons name="arrow-left" size={25} color="#17436D" /></Pressable>
        <Text style={styles.title}>My Folders</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>Create your own destinations. Removing a folder never deletes its notes.</Text>
        <TextInput value={name} onChangeText={setName} placeholder={editingId ? 'Rename folder' : 'Name your new folder'} style={styles.input} />
        <View style={styles.row}>
          <Pressable disabled={busy || !name.trim()} onPress={() => void save()} style={styles.button}>
            {busy && <ActivityIndicator color="#FFFFFF" />}
            <Text style={styles.buttonText}>{editingId ? 'Save new name' : 'Create folder'}</Text>
          </Pressable>
          {editingId && <Pressable onPress={() => { setEditingId(null); setName(''); }} style={styles.outline}><Text>Cancel</Text></Pressable>}
        </View>
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
        {folders.map(folder => (
          <View key={folder.id} style={styles.folder}>
            <Pressable style={{ flex: 1 }} onPress={() => router.replace(`/drawer?folderId=${encodeURIComponent(folder.id)}` as any)}>
              <Text style={styles.folderName}><MaterialCommunityIcons name="folder-outline" size={19} color="#0F79B5" /> {folder.name}</Text>
              <Text style={styles.small}>Browse notes</Text>
            </Pressable>
            <Pressable onPress={() => { setEditingId(folder.id); setName(folder.name); setConfirmDeleteId(null); }} style={styles.outline}><Text>Edit</Text></Pressable>
            {confirmDeleteId === folder.id ? (
              <Pressable disabled={busy} onPress={() => void remove(folder.id)} style={styles.deleteConfirm}><Text style={{ color: '#FFFFFF' }}>Confirm</Text></Pressable>
            ) : (
              <Pressable onPress={() => setConfirmDeleteId(folder.id)} style={styles.outline}><Text>Remove</Text></Pressable>
            )}
          </View>
        ))}
        {!folders.length && <Text style={styles.subtitle}>No custom folders yet. Automatic categories are still available.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F9FD' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, backgroundColor: '#FFFFFF' },
  title: { fontSize: 21, fontWeight: '800', color: '#17436D' },
  content: { padding: 18, gap: 12 },
  subtitle: { color: '#687D8C', fontSize: 13, lineHeight: 21 },
  input: { borderWidth: 1, borderColor: '#D4E0EC', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { backgroundColor: '#0A6EBD', borderRadius: 10, padding: 12, flexDirection: 'row', gap: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  outline: { borderWidth: 1, borderColor: '#BDD0DE', borderRadius: 10, padding: 10 },
  notice: { color: '#176B4D', backgroundColor: '#E7F5E9', padding: 11, borderRadius: 10 },
  folder: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14 },
  folderName: { color: '#173B63', fontWeight: '700', fontSize: 16 },
  small: { fontSize: 12, color: '#789' },
  deleteConfirm: { backgroundColor: '#A13E42', borderRadius: 10, padding: 11 },
});
