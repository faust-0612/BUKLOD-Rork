import React, {
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  classifySmartDrawerText,
  detectSmartDrawerDate,
} from '@/lib/smartDrawer/classify';
import {
  persistSmartDrawerAsset,
} from '@/lib/smartDrawer/assets';
import {
  commitSmartDrawerItem,
} from '@/lib/smartDrawer/service';
import type {
  SmartDrawerItemType,
} from '@/lib/smartDrawer/types';
import { useAuth } from '@/providers/AuthProvider';

const TYPES: SmartDrawerItemType[] = [
  'DOCUMENT',
  'EVENT',
  'APPOINTMENT',
  'NOTICE',
  'RECEIPT',
  'REFERENCE',
  'TASK',
  'OTHER',
];

export default function SmartDrawerReview() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    source?: string | string[];
    uri?: string | string[];
    width?: string | string[];
    height?: string | string[];
  }>();

  const source = String(
    Array.isArray(params.source)
      ? params.source[0] ?? 'scan'
      : params.source ?? 'scan',
  );
  const uri = String(
    Array.isArray(params.uri)
      ? params.uri[0] ?? ''
      : params.uri ?? '',
  );
  const width = Number(
    Array.isArray(params.width)
      ? params.width[0] ?? 0
      : params.width ?? 0,
  );
  const height = Number(
    Array.isArray(params.height)
      ? params.height[0] ?? 0
      : params.height ?? 0,
  );

  const [title, setTitle] = useState(
    source === 'camera' ? 'Photo Reference' : 'Scanned Document',
  );
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<SmartDrawerItemType>(
    source === 'camera' ? 'REFERENCE' : 'DOCUMENT',
  );
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState('');
  const [notice, setNotice] = useState('');

  const suggested = useMemo(
    () => classifySmartDrawerText(
      [title, dateText, timeText, location, notes]
        .filter(Boolean)
        .join('\n'),
    ),
    [dateText, location, notes, timeText, title],
  );

  if (!uri) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          No captured image was provided.
        </Text>
        <Pressable
          onPress={() => router.replace('/drawer' as any)}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>
            Back to Drawer
          </Text>
        </Pressable>
      </View>
    );
  }

  if (savedId) {
    return (
      <View
        style={[
          styles.saved,
          {
            paddingTop: Math.max(insets.top, 30),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <View style={styles.check}>
          <MaterialCommunityIcons
            name="check"
            size={42}
            color="#FFFFFF"
          />
        </View>
        <Text style={styles.savedTitle}>
          Saved to your Drawer!
        </Text>
        <Text style={styles.savedText}>
          {notice ||
            'BUKLOD saved it locally. Important dates can remind you automatically.'}
        </Text>

        <Pressable
          onPress={() =>
            router.replace(
              `/drawer/item/${savedId}` as any,
            )
          }
          style={styles.savedPrimary}
        >
          <Text style={styles.savedPrimaryText}>
            View Item
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.replace(
              source === 'camera'
                ? '/drawer/capture?mode=camera'
                : '/drawer/capture?mode=scan',
              as any,
            )
          }
          style={styles.savedSecondary}
        >
          <Text style={styles.savedSecondaryText}>
            Add Another
          </Text>
        </Pressable>
      </View>
    );
  }

  const save = async () => {
    if (!user?.id || busy) return;
    setBusy(true);
    setNotice('');

    try {
      const dueAt =
        dateText.trim() || timeText.trim()
          ? detectSmartDrawerDate(
              `${dateText.trim()} ${timeText.trim()}`,
            )
          : suggested.dueAt;

      const asset = await persistSmartDrawerAsset({
        userId: user.id,
        uri,
        kind: source === 'camera' ? 'PHOTO' : 'SCAN',
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
        mimeType: 'image/jpeg',
      });

      const result = await commitSmartDrawerItem(
        user.id,
        {
          title: title.trim() || suggested.title,
          body: notes.trim(),
          extractedText: notes.trim(),
          location: location.trim(),
          type,
          dueAt,
          eventAt:
            ['EVENT', 'APPOINTMENT'].includes(type)
              ? dueAt
              : null,
          assets: [asset],
          status: 'ACTIVE',
          syncState: 'LOCAL_ONLY',
        },
      );

      const messages = ['Saved locally.'];
      if (result.reminderScheduled) {
        messages.push('Reminder scheduled.');
      }
      if (result.reminderWarning) {
        messages.push(result.reminderWarning);
      }
      if (!notes.trim()) {
        messages.push(
          'Text extraction was not required to preserve this image; you can add details anytime.',
        );
      }

      setNotice(messages.join(' '));
      setSavedId(result.item.id);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not save this capture. Your existing Drawer items were not affected.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
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
          <Text style={styles.headerTitle}>
            Review Detected Details
          </Text>
          <Text style={styles.headerSub}>
            Confirm or edit before saving.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(26, insets.bottom + 18) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={{ uri }}
          style={styles.preview}
          resizeMode="cover"
        />

        <Text style={styles.sectionTitle}>
          Detected Information
        </Text>

        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
        />
        <Field
          label="Date"
          value={dateText}
          onChangeText={setDateText}
          placeholder="October 5, 2026"
        />
        <Field
          label="Time"
          value={timeText}
          onChangeText={setTimeText}
          placeholder="2:00 PM"
        />
        <Field
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="Room 101"
        />

        <Text style={styles.label}>Type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.types}
        >
          {TYPES.map(value => (
            <Pressable
              key={value}
              onPress={() => setType(value)}
              style={[
                styles.typeChip,
                type === value && styles.typeChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.typeText,
                  type === value && styles.typeTextSelected,
                ]}
              >
                {value.replaceAll('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>
          Notes / extracted text
        </Text>
        <TextInput
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Add or correct any text BUKLOD should remember."
          placeholderTextColor="#8A9BAA"
          style={[styles.input, styles.notes]}
        />

        <View style={styles.willBe}>
          <Text style={styles.willTitle}>
            This will be:
          </Text>
          <CheckLine text="Saved privately to your Drawer" />
          <CheckLine
            text={
              dateText.trim() || suggested.dueAt
                ? 'Reminder attempted automatically if a valid future date is detected'
                : 'Saved without a reminder until a date is added'
            }
          />
          <CheckLine
            text="Sorted into the matching smart view"
          />
        </View>

        {!!notice && !savedId && (
          <Text style={styles.errorText}>{notice}</Text>
        )}

        <Pressable
          disabled={busy}
          onPress={() => void save()}
          style={[styles.primary, busy && { opacity: 0.55 }]}
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
          <Text style={styles.primaryText}>
            {busy ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#8A9BAA"
        style={styles.input}
      />
    </View>
  );
}

function CheckLine({ text }: { text: string }) {
  return (
    <View style={styles.checkLine}>
      <MaterialCommunityIcons
        name="check-circle"
        size={17}
        color="#2C9A64"
      />
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7FAFD',
  },
  center: {
    flex: 1,
    backgroundColor: '#F7FAFD',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: {
    color: '#173B63',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E9F1',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#173B63',
    fontSize: 17,
    fontWeight: '900',
  },
  headerSub: {
    marginTop: 2,
    color: '#72879A',
    fontSize: 10.5,
  },
  content: {
    padding: 14,
  },
  preview: {
    width: '100%',
    height: 190,
    borderRadius: 16,
    backgroundColor: '#E8EEF4',
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    color: '#173B63',
    fontSize: 14,
    fontWeight: '900',
  },
  field: {
    marginBottom: 9,
  },
  label: {
    marginBottom: 5,
    color: '#365B79',
    fontSize: 10.5,
    fontWeight: '900',
  },
  input: {
    minHeight: 43,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D4E1EC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    color: '#21425F',
    fontSize: 12.5,
  },
  notes: {
    minHeight: 100,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  types: {
    gap: 6,
    paddingBottom: 11,
  },
  typeChip: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: '#D5E2EC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeChipSelected: {
    backgroundColor: '#E6F2FD',
    borderColor: '#6FA8D6',
  },
  typeText: {
    color: '#647D91',
    fontSize: 9.5,
    fontWeight: '800',
  },
  typeTextSelected: {
    color: '#0A6EBD',
  },
  willBe: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4E5F1',
    backgroundColor: '#EAF5FD',
    padding: 12,
    gap: 7,
  },
  willTitle: {
    marginBottom: 2,
    color: '#173B63',
    fontSize: 11.5,
    fontWeight: '900',
  },
  checkLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  checkText: {
    flex: 1,
    color: '#47677F',
    fontSize: 10.5,
    lineHeight: 15,
  },
  errorText: {
    marginTop: 10,
    color: '#9A433C',
    fontSize: 11,
    lineHeight: 16,
  },
  primary: {
    marginTop: 14,
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: '#0B70C9',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  saved: {
    flex: 1,
    backgroundColor: '#F7FAFD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  check: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#37B879',
    borderWidth: 7,
    borderColor: '#DDF5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedTitle: {
    marginTop: 18,
    color: '#173B63',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  savedText: {
    marginTop: 8,
    color: '#6B8194',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  savedPrimary: {
    marginTop: 24,
    width: '100%',
    maxWidth: 360,
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: '#0B70C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  savedSecondary: {
    marginTop: 10,
    width: '100%',
    maxWidth: 360,
    minHeight: 47,
    borderRadius: 14,
    backgroundColor: '#E9F0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedSecondaryText: {
    color: '#244B69',
    fontWeight: '900',
  },
});
