import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  Stack,
  useLocalSearchParams,
} from 'expo-router';
import ClusterManageGate from '@/components/ClusterManageGate';
import {
  type ClusterVisibility,
  updateCluster,
} from '@/lib/buklodClusters';
import { readClusterScopeId } from '@/lib/buklodCluster';

export default function ClusterSettingsScreen() {
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(
    params as Record<string, unknown>
  );

  return (
  <>
    <Stack.Screen options={{ title: 'Cluster Settings' }} />
    <ClusterManageGate scopeId={scopeId}>
      {(cluster) => (
        <ClusterSettingsForm
          scopeId={scopeId}
          cluster={cluster}
        />
      )}
    </ClusterManageGate>
  </>
  );
}

function ClusterSettingsForm({
  scopeId,
  cluster,
}: {
  scopeId: string;
  cluster: {
    name: string;
    description: string | null;
    category: string | null;
    visibility: ClusterVisibility;
  };
}) {
  const [name, setName] = useState(cluster.name || '');
  const [category, setCategory] = useState(cluster.category || '');
  const [description, setDescription] = useState(
    cluster.description || ''
  );
  const [visibility, setVisibility] = useState<ClusterVisibility>(
    cluster.visibility
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(cluster.name || '');
    setCategory(cluster.category || '');
    setDescription(cluster.description || '');
    setVisibility(cluster.visibility);
  }, [cluster]);

  const save = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Cluster Settings', 'Cluster name is required.');
      return;
    }

    setBusy(true);
    try {
      await updateCluster(scopeId, {
        name,
        description,
        category,
        visibility,
      });
      Alert.alert('Cluster Settings', 'Cluster settings saved.');
    } catch (error: any) {
      Alert.alert(
        'Cluster Settings',
        error?.message || 'Could not save settings.'
      );
    } finally {
      setBusy(false);
    }
  }, [scopeId, name, description, category, visibility]);

  return (
    <BuklodPortalScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>CLUSTER NAME</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        maxLength={120}
      />

      <Text style={styles.label}>CATEGORY</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder="Association, Friends, School..."
        maxLength={80}
      />

      <Text style={styles.label}>DESCRIPTION</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        multiline
        textAlignVertical="top"
        maxLength={1000}
      />

      <Text style={styles.label}>VISIBILITY / JOIN POLICY</Text>
      {(['PUBLIC', 'PRIVATE', 'INVITE_ONLY'] as ClusterVisibility[]).map(
        (option) => (
          <Pressable
            key={option}
            onPress={() => setVisibility(option)}
            style={[
              styles.choice,
              visibility === option && styles.choiceOn,
            ]}
          >
            <Text style={styles.choiceText}>
              {option.replace('_', ' ')}
            </Text>
            {visibility === option && (
              <Text style={styles.check}>SELECTED</Text>
            )}
          </Pressable>
        )
      )}

      <Pressable
        disabled={busy}
        onPress={() => void save()}
        style={[styles.save, busy && styles.disabled]}
      >
        <Text style={styles.saveText}>SAVE SETTINGS</Text>
      </Pressable>
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 10,
    backgroundColor: '#F4F7F5',
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    color: '#496056',
    marginTop: 4,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D8E1DC',
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: '#1C362B',
  },
  multiline: {
    minHeight: 110,
    paddingTop: 11,
  },
  choice: {
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DFE6E2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  choiceOn: {
    borderColor: '#2D6A4F',
    backgroundColor: '#F0F7F3',
  },
  choiceText: {
    flex: 1,
    fontWeight: '800',
    color: '#40544A',
  },
  check: {
    color: '#2D6A4F',
    fontWeight: '900',
    fontSize: 10,
  },
  save: {
    marginTop: 8,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.5,
  },
});
