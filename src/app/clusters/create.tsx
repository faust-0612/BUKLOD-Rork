import React, { useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  ClusterVisibility,
  createCluster,
} from '@/lib/buklodClusters';

function messageOf(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error
  ) {
    return String(
      (error as { message?: unknown })
        .message || 'Unknown error'
    );
  }

  return String(error || 'Unknown error');
}

const visibilityOptions: {
  value: ClusterVisibility;
  title: string;
  description: string;
}[] = [
  {
    value: 'PUBLIC',
    title: 'Public',
    description:
      'Anyone can discover and join instantly.',
  },
  {
    value: 'PRIVATE',
    title: 'Private',
    description:
      'People can discover it, but Admin approval is required.',
  },
  {
    value: 'INVITE_ONLY',
    title: 'Invitation Only',
    description:
      'Hidden from normal discovery. Members enter by invitation.',
  },
];

export default function CreateClusterScreen() {
  const [name, setName] = useState('');
  const [category, setCategory] =
    useState('');
  const [description, setDescription] =
    useState('');

  const [visibility, setVisibility] =
    useState<ClusterVisibility>('PUBLIC');

  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert(
        'Cluster',
        'Enter a Cluster name.'
      );
      return;
    }

    setBusy(true);

    try {
      const id = await createCluster({
        name,
        category,
        description,
        visibility,
      });

      router.replace({
        pathname: '/clusters/[id]' as any,
        params: { id },
      } as any);
    } catch (error) {
      Alert.alert(
        'Create Cluster',
        messageOf(error)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          NEW COMMUNITY
        </Text>

        <Text style={styles.title}>
          Create a Cluster
        </Text>

        <Text style={styles.subtitle}>
          Any registered BUKLOD user may create
          a Cluster. You become its Cluster Admin.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>
          CLUSTER NAME *
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Example: Tanay Nurses Network"
          value={name}
          onChangeText={setName}
          maxLength={120}
        />

        <Text style={styles.label}>
          CATEGORY
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Friends, Association, School, Ministry..."
          value={category}
          onChangeText={setCategory}
          maxLength={80}
        />

        <Text style={styles.label}>
          DESCRIPTION
        </Text>

        <TextInput
          style={[
            styles.input,
            styles.multiline,
          ]}
          placeholder="What is this Cluster for?"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />
      </View>

      <Text style={styles.sectionTitle}>
        PRIVACY
      </Text>

      {visibilityOptions.map((option) => {
        const active =
          visibility === option.value;

        return (
          <Pressable
            key={option.value}
            onPress={() =>
              setVisibility(option.value)
            }
            style={[
              styles.option,
              active && styles.optionActive,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.optionTitle,
                  active &&
                    styles.optionTitleActive,
                ]}
              >
                {option.title}
              </Text>

              <Text style={styles.optionText}>
                {option.description}
              </Text>
            </View>

            <View
              style={[
                styles.radio,
                active && styles.radioActive,
              ]}
            />
          </Pressable>
        );
      })}

      <Pressable
        disabled={busy}
        onPress={() => void submit()}
        style={[
          styles.createButton,
          busy && styles.disabled,
        ]}
      >
        <Text style={styles.createText}>
          {busy
            ? 'CREATING...'
            : 'CREATE CLUSTER'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={styles.cancelButton}
      >
        <Text style={styles.cancelText}>
          CANCEL
        </Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F7F6',
  },

  content: {
    padding: 16,
    gap: 12,
  },

  hero: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1E7E3',
  },

  eyebrow: {
    color: '#2D6A4F',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '900',
  },

  title: {
    color: '#19362A',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },

  subtitle: {
    color: '#66756D',
    lineHeight: 20,
    marginTop: 6,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    padding: 15,
    gap: 8,
  },

  label: {
    marginTop: 6,
    color: '#365347',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.7,
  },

  input: {
    backgroundColor: '#FAFBFA',
    borderWidth: 1,
    borderColor: '#D9E2DD',
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    color: '#1A3329',
  },

  multiline: {
    minHeight: 120,
    paddingTop: 12,
  },

  sectionTitle: {
    marginTop: 5,
    fontWeight: '900',
    color: '#365347',
    fontSize: 13,
    letterSpacing: 1,
  },

  option: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE6E2',
    borderRadius: 15,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  optionActive: {
    borderColor: '#2D6A4F',
    backgroundColor: '#F1F8F4',
  },

  optionTitle: {
    fontWeight: '900',
    color: '#34463D',
  },

  optionTitleActive: {
    color: '#23543E',
  },

  optionText: {
    marginTop: 3,
    color: '#748079',
    lineHeight: 18,
    fontSize: 12,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#A6B2AB',
  },

  radioActive: {
    borderWidth: 6,
    borderColor: '#2D6A4F',
  },

  createButton: {
    marginTop: 8,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A4F',
  },

  createText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  cancelButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B7C2BC',
    backgroundColor: '#FFFFFF',
  },

  cancelText: {
    color: '#506058',
    fontWeight: '900',
  },

  disabled: {
    opacity: 0.5,
  },
});
