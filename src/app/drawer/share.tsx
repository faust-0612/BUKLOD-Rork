import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import {
  loadConnectSuggestedContacts,
  type ConnectSuggestedContact,
} from '@/lib/buklodConnectSuggestedContacts';
import { getSmartDrawerItem } from '@/lib/smartDrawer/localStore';
import { shareSmartDrawerItem, type SharedDrawerRole } from '@/lib/smartDrawer/shared';
import type { SmartDrawerItem } from '@/lib/smartDrawer/types';

export default function SmartDrawerShareScreen() {
  const { user } = useAuth();
  const { scopes } = useBuklodScope();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ itemId?: string | string[] }>();
  const itemId = Array.isArray(params.itemId) ? params.itemId[0] : params.itemId;
  const [item, setItem] = useState<SmartDrawerItem | null>(null);
  const [contacts, setContacts] = useState<ConnectSuggestedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [kind, setKind] = useState<'PERSON' | 'CLUSTER'>('PERSON');
  const [selectedId, setSelectedId] = useState('');
  const [role, setRole] = useState<SharedDrawerRole>('VIEWER');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    if (!user?.id || !itemId) {
      setLoading(false);
      return;
    }
    void Promise.all([
      getSmartDrawerItem(user.id, itemId),
      loadConnectSuggestedContacts(60),
    ]).then(([saved, peers]) => {
      if (!active) return;
      setItem(saved);
      setContacts(peers.filter(person => person.user_id !== user.id));
    }).catch(error => {
      if (active) setNotice(String(error?.message ?? 'Could not prepare sharing.'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [itemId, user?.id]);

  const groups = useMemo(() => scopes.filter(scope =>
    ['CLUSTER', 'ORGANIZATION', 'CHURCH'].includes(scope.scope_type) &&
    scope.membership_status === 'ACTIVE'
  ), [scopes]);
  const visibleContacts = useMemo(() => contacts.filter(person =>
    person.full_name.toLowerCase().includes(query.trim().toLowerCase())
  ).slice(0, 60), [contacts, query]);
  const selectedName = kind === 'PERSON'
    ? contacts.find(person => person.user_id === selectedId)?.full_name
    : groups.find(scope => scope.scope_id === selectedId)?.name;

  const share = async () => {
    if (!user?.id || !item || !selectedId || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const sharedId = await shareSmartDrawerItem(
        user.id,
        item,
        kind === 'PERSON'
          ? { kind, userId: selectedId, role }
          : { kind, scopeId: selectedId },
      );
      router.replace(`/drawer/shared-item/${sharedId}` as any);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Sharing failed. Nothing else was made public.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={23} color="#183A5D" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Share a Drawer item</Text>
          <Text style={styles.subtitle}>Only the item you choose is copied for collaboration.</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#176DB1" /></View>
      ) : !item ? (
        <View style={styles.center}>
          <Text style={styles.notice}>This private item is no longer available.</Text>
        </View>
      ) : (
        <>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.privateCard}>
              <MaterialCommunityIcons name="shield-lock-outline" color="#287A65" size={22} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.helper}>Your original, photos, scans and other private items stay on this device.</Text>
              </View>
            </View>
            <View style={styles.tabs}>
              {(['PERSON', 'CLUSTER'] as const).map(value => (
                <Pressable key={value} onPress={() => { setKind(value); setSelectedId(''); setQuery(''); }}
                  style={[styles.tab, value === kind && styles.activeTab]}>
                  <Text style={[styles.tabText, value === kind && styles.activeTabText]}>
                    {value === 'PERSON' ? 'Individual' : 'Cluster / Org'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {kind === 'PERSON' ? (
              <>
                <TextInput
                  value={query} onChangeText={setQuery}
                  placeholder="Find an existing BUKLOD contact"
                  placeholderTextColor="#7990A5"
                  style={styles.search}
                />
                <Text style={styles.label}>Permission for this person</Text>
                <View style={styles.tabs}>
                  {(['VIEWER', 'EDITOR'] as const).map(value => (
                    <Pressable key={value} onPress={() => setRole(value)}
                      style={[styles.tab, role === value && styles.activeTab]}>
                      <Text style={[styles.tabText, role === value && styles.activeTabText]}>
                        {value === 'VIEWER' ? 'Can view' : 'Can edit'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {visibleContacts.length ? visibleContacts.map(person => (
                  <Choice key={person.user_id} name={person.full_name}
                    description={person.shared_scope_label ?? 'BUKLOD contact'}
                    selected={selectedId === person.user_id}
                    onPress={() => setSelectedId(person.user_id)} />
                )) : <Text style={styles.helper}>No matching contact. Connect or join a shared scope to discover collaborators.</Text>}
              </>
            ) : (
              <>
                <Text style={styles.helper}>Active cluster and organization members can view this shared copy. Editing remains with the owner or individually invited editors.</Text>
                {groups.length ? groups.map(scope => (
                  <Choice key={scope.scope_id} name={scope.name}
                    description={scope.scope_type}
                    selected={selectedId === scope.scope_id}
                    onPress={() => setSelectedId(scope.scope_id)} />
                )) : <Text style={styles.helper}>No active Cluster or Organization membership is available.</Text>}
              </>
            )}
            {!!notice && <Text style={styles.notice}>{notice}</Text>}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
            <Text style={styles.selected}>{selectedName ? `Sharing with: ${selectedName}` : 'Select a person or cluster'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Share selected Drawer item"
              disabled={!selectedId || busy} onPress={() => void share()}
              style={[styles.primary, (!selectedId || busy) && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color="#FFF" /> : <MaterialCommunityIcons name="share-variant" size={18} color="#FFF" />}
              <Text style={styles.primaryText}>{busy ? 'Sharing…' : 'Share selected item'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function Choice({ name, description, selected, onPress }: {
  name: string; description: string; selected: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }}
      style={[styles.choice, selected && styles.choiceSelected]}>
      <MaterialCommunityIcons name={selected ? 'check-circle' : 'circle-outline'}
        color={selected ? '#148866' : '#8498AA'} size={22} />
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceName}>{name}</Text>
        <Text style={styles.helper}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F9FD' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: '#173B63' },
  subtitle: { fontSize: 10.5, color: '#6C8295', marginTop: 3 },
  content: { padding: 14, paddingBottom: 30 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  privateCard: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, backgroundColor: '#E9F8F2', borderRadius: 16, marginBottom: 14 },
  itemTitle: { color: '#24485D', fontSize: 13, fontWeight: '900' },
  helper: { color: '#657F91', fontSize: 11, lineHeight: 16, marginTop: 3 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 13 },
  tab: { flex: 1, padding: 11, backgroundColor: '#FFF', borderRadius: 13, alignItems: 'center', borderWidth: 1, borderColor: '#D6E3EE' },
  activeTab: { backgroundColor: '#DCEFFA', borderColor: '#2780BB' },
  tabText: { color: '#5E788B', fontSize: 12, fontWeight: '900' },
  activeTabText: { color: '#0B68A7' },
  search: { backgroundColor: '#FFF', paddingHorizontal: 14, minHeight: 44, borderRadius: 12, marginBottom: 13, color: '#193D5E' },
  label: { fontSize: 12, fontWeight: '900', color: '#294B66', marginBottom: 7 },
  choice: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#DFE9F1', padding: 12, marginBottom: 8, gap: 10 },
  choiceSelected: { borderColor: '#38A282', backgroundColor: '#F2FCF8' },
  choiceName: { color: '#244B6A', fontSize: 12, fontWeight: '900' },
  notice: { color: '#AD4939', fontSize: 12, padding: 12 },
  footer: { backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#E2EAF1', padding: 14 },
  selected: { color: '#53728B', fontSize: 11, marginBottom: 8 },
  primary: { backgroundColor: '#0B71B9', minHeight: 48, borderRadius: 13, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
});
