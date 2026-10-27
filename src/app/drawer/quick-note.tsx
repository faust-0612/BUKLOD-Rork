import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  classifySmartDrawerText,
  detectSmartDrawerExpiry,
} from '@/lib/smartDrawer/classify';
import { createSmartDrawerFolder, listSmartDrawerFolders } from '@/lib/smartDrawer/localStore';
import type { SmartDrawerFolder } from '@/lib/smartDrawer/types';
import {
  commitSmartDrawerItem,
} from '@/lib/smartDrawer/service';
import { useAuth } from '@/providers/AuthProvider';

export default function SmartDrawerQuickNote() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [folders, setFolders] = useState<SmartDrawerFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [important, setImportant] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void listSmartDrawerFolders(user.id).then(setFolders).catch(error => setNotice(String(error)));
  }, [user?.id]);

  const classification = useMemo(
    // Keep typing responsive even for book-length notes. Saving examines
    // the entire body; only the live preview is bounded.
    () => classifySmartDrawerText(text.slice(0, 4000)),
    [text],
  );
  const expiresAt = useMemo(() => detectSmartDrawerExpiry(text.slice(0, 4000)), [text]);

  const addFolder = async () => {
    if (!user?.id || !newFolder.trim()) return;
    try {
      const folder = await createSmartDrawerFolder(user.id, newFolder);
      setFolders(await listSmartDrawerFolders(user.id));
      setFolderId(folder.id);
      setNewFolder('');
      setNotice(`Created “${folder.name}”. This note will go there.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create folder.');
    }
  };

  const save = async () => {
    if (!user?.id || !text.trim() || busy) return;

    setBusy(true);
    setNotice('');

    try {
      const fullClassification = classifySmartDrawerText(text);
      const fullExpiry = detectSmartDrawerExpiry(text);
      const result = await commitSmartDrawerItem(
        user.id,
        {
          type: fullClassification.type,
          title: fullClassification.title,
          body: text.trim(),
          dueAt: fullClassification.dueAt,
          eventAt: fullClassification.eventAt,
          listItems: fullClassification.listItems,
          folderId,
          expiresAt: fullExpiry,
          protectedFromExpiry: important || ['DOCUMENT','RECEIPT','WRITING','POEM'].includes(fullClassification.type),
          status: 'ACTIVE',
          syncState: 'LOCAL_ONLY',
        },
      );

      if (result.reminderWarning) {
        setNotice(
          `Saved in ${folders.find(folder => folder.id === folderId)?.name ?? fullClassification.type.replaceAll('_',' ')}. ${result.reminderWarning}`,
        );
      } else {
        setNotice(
          result.reminderScheduled
            ? 'Saved. Reminder scheduled.'
            : `Saved in ${folders.find(folder => folder.id === folderId)?.name ?? fullClassification.type.replaceAll('_',' ')}.`,
        );
      }

      setTimeout(() => {
        router.replace(`/drawer/item/${result.item.id}` as any);
      }, 800);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not save this note. Your existing Drawer items were not affected.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingBottom: Math.max(16, insets.bottom),
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={styles.iconButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color="#173B63"
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Quick Note</Text>
          <Text style={styles.subtitle}>
            Type naturally. BUKLOD will understand and organize it.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          autoFocus
          multiline
          value={text}
          onChangeText={setText}
          placeholder="Type a note, list, task, idea, program…"
          placeholderTextColor="#8899A8"
          style={styles.input}
        />

        <Text style={styles.counter}>
          {text.length.toLocaleString()} characters · No character limit
        </Text>

        {!!text.trim() && (
          <View style={styles.detected}>
            <View style={styles.detectedHeading}>
              <MaterialCommunityIcons
                name="auto-fix"
                size={19}
                color="#0A6EBD"
              />
              <Text style={styles.detectedTitle}>
                Detected as:{' '}
                {classification.type.replaceAll('_', ' ')}
              </Text>
            </View>

            {!!classification.dueAt && (
              <Text style={styles.detectedText}>
                Due:{' '}
                {new Date(
                  classification.dueAt,
                ).toLocaleString()}
              </Text>
            )}

            {!!expiresAt && (
              <Text style={styles.detectedText}>Expires: {new Date(expiresAt).toLocaleString()} · Recoverable in Recently Removed</Text>
            )}

            {!!classification.listItems.length && (
              <View style={styles.listPreview}>
                {classification.listItems
                  .slice(0, 8)
                  .map(item => (
                    <View key={item.id} style={styles.listRow}>
                      <View style={styles.checkbox} />
                      <Text style={styles.listText}>
                        {item.text}
                      </Text>
                    </View>
                  ))}
              </View>
            )}

            <Text style={styles.hint}>
              You can correct the type later. BUKLOD never deletes this note just because classification is uncertain.
            </Text>
          </View>
        )}

        <Text style={styles.detectedTitle}>Save to folder (optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[{ id: '', name: 'Auto-organize' }, ...folders].map(folder => (
            <Pressable key={folder.id} onPress={() => setFolderId(folder.id || null)}
              style={{ padding: 10, borderRadius: 10, backgroundColor: (folderId ?? '') === folder.id ? '#D4EAFB' : '#E9EDF2', marginRight: 8 }}>
              <Text>{folder.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput value={newFolder} onChangeText={setNewFolder} placeholder="New folder name"
            style={[styles.input, { minHeight: 42, flex: 1 }]} />
          <Pressable onPress={() => void addFolder()} style={{ padding: 12, backgroundColor: '#D4EAFB', borderRadius: 10 }}>
            <Text>Create</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setImportant(value => !value)} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialCommunityIcons name={important ? 'shield-check' : 'shield-outline'} size={22} color="#145F94" />
          <Text>{important ? 'Important · Never auto-delete' : 'Mark important · Protect from auto-delete'}</Text>
        </Pressable>

        {!!notice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {notice}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!text.trim() || busy}
          onPress={() => void save()}
          style={[
            styles.save,
            (!text.trim() || busy) && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <MaterialCommunityIcons
              name="content-save-outline"
              size={19}
              color="#FFFFFF"
            />
          )}
          <Text style={styles.saveText}>
            {busy ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7FAFD',
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E9F1',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#173B63',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    color: '#71869A',
    fontSize: 10.5,
  },
  content: {
    padding: 14,
  },
  input: {
    minHeight: 230,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E4EE',
    backgroundColor: '#FFFFFF',
    padding: 14,
    color: '#1F3F5E',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  counter: {
    marginTop: 5,
    alignSelf: 'flex-end',
    color: '#8295A6',
    fontSize: 10,
  },
  detected: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFE1F0',
    backgroundColor: '#EAF4FC',
    padding: 13,
  },
  detectedHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detectedTitle: {
    color: '#173B63',
    fontWeight: '900',
    fontSize: 13,
  },
  detectedText: {
    marginTop: 7,
    color: '#45657E',
    fontSize: 11,
  },
  listPreview: {
    marginTop: 9,
    gap: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#78A3C4',
    backgroundColor: '#FFFFFF',
  },
  listText: {
    color: '#36566F',
    fontSize: 11,
  },
  hint: {
    marginTop: 10,
    color: '#668095',
    fontSize: 10,
    lineHeight: 15,
  },
  notice: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#EEF5FA',
    padding: 11,
  },
  noticeText: {
    color: '#31536D',
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  save: {
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: '#0B70C9',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.48,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
});
