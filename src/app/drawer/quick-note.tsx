import React, {
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
} from '@/lib/smartDrawer/classify';
import {
  commitSmartDrawerItem,
} from '@/lib/smartDrawer/service';
import { useAuth } from '@/providers/AuthProvider';
import type { SmartDrawerItemType } from '@/lib/smartDrawer/types';

export default function SmartDrawerQuickNote() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [asChecklist, setAsChecklist] = useState(false);
  const [manualType, setManualType] = useState<SmartDrawerItemType | null>(null);
  const [notice, setNotice] = useState('');

  const classification = useMemo(
    () => classifySmartDrawerText(text, new Date(), asChecklist),
    [text, asChecklist],
  );

  const save = async () => {
    if (!user?.id || !text.trim() || busy) return;

    setBusy(true);
    setNotice('');

    try {
      const result = await commitSmartDrawerItem(
        user.id,
        {
          type: manualType ?? classification.type,
          title: classification.title,
          body: text.trim(),
          dueAt: classification.dueAt,
          eventAt: classification.eventAt,
          listItems: classification.listItems,
          status: 'ACTIVE',
          syncState: 'LOCAL_ONLY',
        },
      );

      if (result.reminderWarning) {
        setNotice(
          `Saved to Drawer. ${result.reminderWarning}`,
        );
      } else {
        setNotice(
          result.reminderScheduled
            ? 'Saved to Drawer. Reminder scheduled.'
            : 'Saved to Drawer.',
        );
      }

      setTimeout(() => {
        router.replace(`/drawer/item/${result.item.id}` as any);
      }, 650);
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
            Ordinary text stays a note. Choose checklist only when needed.
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
          maxLength={5000}
          placeholder="Type a note, list, task, idea, program…"
          placeholderTextColor="#8899A8"
          style={styles.input}
        />

        <Text style={styles.counter}>
          {text.length}/5000
        </Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: asChecklist }}
          onPress={() => setAsChecklist(value => !value)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
          <MaterialCommunityIcons
            name={asChecklist ? 'checkbox-marked-outline' : 'checkbox-blank-outline'}
            size={23} color="#173B63" />
          <Text style={{ color: '#173B63', fontWeight: '700' }}>
            Gawing checklist (optional)
          </Text>
        </Pressable>

        {!!text.trim() && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: '#173B63', fontWeight: '800', marginBottom: 6 }}>Category — auto detected, tap to correct</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {([null, 'QUICK_NOTE', 'TASK', 'DUE_TASK', 'SHOPPING_LIST', 'CHECKLIST', 'EVENT', 'APPOINTMENT', 'PROGRAM', 'IDEA', 'WRITING', 'POEM', 'REFERENCE', 'DOCUMENT', 'RECEIPT', 'NOTICE', 'CONTACT_REFERENCE', 'OTHER'] as (SmartDrawerItemType | null)[]).map(category => {
                const active = manualType === category;
                return <Pressable key={category ?? 'AUTO'} onPress={() => setManualType(category)}
                  style={{ paddingHorizontal: 12, paddingVertical: 9, marginRight: 6, borderRadius: 10, backgroundColor: active ? '#0B70C9' : '#E7EFF5' }}>
                  <Text style={{ color: active ? '#FFF' : '#173B63', fontWeight: '700' }}>{category ? category.replaceAll('_', ' ') : 'AUTO'}</Text>
                </Pressable>;
              })}
            </ScrollView>
          </View>
        )}
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
                {(manualType ?? classification.type).replaceAll('_', ' ')}
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
