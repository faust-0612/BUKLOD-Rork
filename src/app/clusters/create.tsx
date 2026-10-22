import React, { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import BuklodActionFeedback, { type BuklodActionStatus } from '@/components/BuklodActionFeedback';

import { router } from 'expo-router';

import {
  ClusterVisibility,
  createCluster,
} from '@/lib/buklodClusters';
import { supabase } from '@/lib/supabase';

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

type OrgOption = {
  scope_id: string;
  name: string;
};

export default function CreateClusterScreen() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [visibility, setVisibility] =
    useState<ClusterVisibility>('PUBLIC');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [createdId, setCreatedId] = useState('');
  const [feedback, setFeedback] = useState<{ status: BuklodActionStatus; message: string }>({ status: 'idle', message: '' });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await (supabase as any).rpc(
          'buklod_my_manageable_organizations_v2',
        );
        if (error) throw error;
        if (!active) return;
        const rows = (Array.isArray(data) ? data : []).map((row: {
          scope_id?: string;
          id?: string;
          name?: string;
        }) => ({
          scope_id: String(row.scope_id ?? row.id ?? ''),
          name: String(row.name ?? 'Organization'),
        })).filter((row: OrgOption) => row.scope_id);
        setOrganizations(rows);
        if (rows.length === 1) {
          setOrganizationId(rows[0].scope_id);
        }
      } catch {
        if (active) setOrganizations([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    if (inFlight.current || createdId) return;
    if (!name.trim()) {
      setFeedback({ status: 'error', message: 'Enter a Cluster name.' });
      return;
    }
    if (!organizationId) {
      setFeedback({ status: 'error', message: 'Select an Organization before creating a Cluster.' });
      return;
    }

    inFlight.current = true;
    setBusy(true);
    setFeedback({ status: 'pending', message: 'Creating Cluster. Please do not close this page or tap again.' });
    try {
      const id = await createCluster({
        name,
        category,
        description,
        visibility,
        organizationId,
      });
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('The server did not confirm a Cluster ID. Check your Cluster list before retrying.');
      }
      setCreatedId(id);
      setFeedback({ status: 'success', message: `Cluster "${name.trim()}" created successfully. Open your new Cluster below.` });
    } catch (error) {
      setFeedback({ status: 'error', message: `Cluster creation could not be confirmed: ${messageOf(error)}` });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <BuklodPortalScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>NEW COMMUNITY</Text>
        <Text style={styles.title}>Create a Cluster</Text>
        <Text style={styles.subtitle}>
          Clusters belong to an Organization. Organization registration stays
          free. You become Cluster Admin of this Cluster only.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>PARENT ORGANIZATION *</Text>
        {organizations.length === 0 ? (
          <>
            <Text style={styles.help}>
              Create an Organization first. Clusters cannot be created without one.
            </Text>
            <Pressable
              onPress={() => router.push('/organizations/create' as any)}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>CREATE ORGANIZATION</Text>
            </Pressable>
          </>
        ) : (
          organizations.map((org) => {
            const selected = organizationId === org.scope_id;
            return (
              <Pressable
                key={org.scope_id}
                onPress={() => setOrganizationId(org.scope_id)}
                style={[styles.orgRow, selected && styles.orgRowOn]}
              >
                <Text style={[styles.orgName, selected && styles.orgNameOn]}>
                  {org.name}
                </Text>
              </Pressable>
            );
          })
        )}

        <Text style={styles.label}>CLUSTER NAME *</Text>
        <TextInput
          style={styles.input}
          placeholder="Example: Tanay Nurses Network"
          value={name}
          onChangeText={setName}
          maxLength={120}
        />

        <Text style={styles.label}>CATEGORY</Text>
        <TextInput
          style={styles.input}
          placeholder="Friends, Association, School, Ministry..."
          value={category}
          onChangeText={setCategory}
          maxLength={80}
        />

        <Text style={styles.label}>DESCRIPTION</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="What is this Cluster for?"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
          maxLength={1000}
        />
      </View>

      <Text style={styles.sectionTitle}>PRIVACY</Text>
      {visibilityOptions.map((option) => {
        const active = visibility === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => setVisibility(option.value)}
            style={[styles.choice, active && styles.choiceOn]}
          >
            <Text style={[styles.choiceTitle, active && styles.choiceTitleOn]}>
              {option.title}
            </Text>
            <Text style={styles.choiceBody}>{option.description}</Text>
          </Pressable>
        );
      })}

      <BuklodActionFeedback status={feedback.status} message={feedback.message} />
      {createdId ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace({ pathname: '/clusters/[id]' as any, params: { id: createdId } } as any)}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>OPEN CREATED CLUSTER</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          disabled={busy || !organizationId}
          onPress={() => void submit()}
          style={[styles.primary, (busy || !organizationId) && { opacity: 0.55 }]}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
          <Text style={styles.primaryText}>
            {busy ? 'CREATING...' : 'CREATE CLUSTER'}
          </Text>
        </Pressable>
      )}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F5' },
  content: { padding: 16, paddingBottom: 24, gap: 10 },
  hero: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#1F4D3A',
    marginBottom: 6,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: 'rgba(255,255,255,0.72)' },
  title: { marginTop: 4, fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { marginTop: 7, fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.82)' },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  label: { marginTop: 6, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: '#2D6A4F' },
  help: { fontSize: 11, lineHeight: 16, color: '#6E7E76' },
  input: {
    minHeight: 45,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: '#173B2F',
    backgroundColor: '#FFFFFF',
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  orgRow: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    borderRadius: 11,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  orgRowOn: { borderColor: '#2D6A4F', backgroundColor: '#E8F5EE' },
  orgName: { fontSize: 12, fontWeight: '800', color: '#6E7E76' },
  orgNameOn: { color: '#173B2F' },
  sectionTitle: { marginTop: 8, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: '#2D6A4F' },
  choice: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
  },
  choiceOn: { borderColor: '#2D6A4F', backgroundColor: '#E8F5EE' },
  choiceTitle: { fontSize: 13, fontWeight: '900', color: '#173B2F' },
  choiceTitleOn: { color: '#1F4D3A' },
  choiceBody: { marginTop: 3, fontSize: 11, color: '#6E7E76' },
  primary: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F4D3A',
    marginTop: 8,
  },
  primaryText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.55, color: '#FFFFFF' },
  secondary: {
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D6A4F',
  },
  secondaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
});
