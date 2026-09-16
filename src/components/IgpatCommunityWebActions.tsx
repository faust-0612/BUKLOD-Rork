import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { IGPAT_RELAY_OPTIONS, igpatRelayPromptLabel, type IgpatRelayPrompt } from '@/lib/igpat/relay';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type DirectTarget = {
  conversation_id: string;
  other_user_id: string;
  other_name: string;
  church_name?: string | null;
};

type ScopeTarget = {
  scope_id: string;
  scope_type: string;
  scope_name: string;
  geo_level?: string | null;
};

type PostContext = {
  id: string;
  user_id: string;
  body?: string | null;
  audience?: string | null;
  authorName: string;
};

type RelayRow = {
  id: string;
  parent_post_id?: string | null;
  relay_prompt?: string | null;
  relay_depth?: number | null;
  user_id?: string | null;
  author_name?: string | null;
  body?: string | null;
  created_at?: string | null;
};

type BondRow = {
  id: string;
  kind: string;
  post_id: string;
  actor_user_id: string;
  actor_name?: string | null;
  target_id?: string | null;
  message?: string | null;
  unlock_at?: string | null;
  status?: string | null;
  created_at?: string | null;
  locked?: boolean | null;
};

function shortDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

async function copyText(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function IgpatCommunityWebActions({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<PostContext | null>(null);
  const [directTargets, setDirectTargets] = useState<DirectTarget[]>([]);
  const [scopeTargets, setScopeTargets] = useState<ScopeTarget[]>([]);
  const [relayRows, setRelayRows] = useState<RelayRow[]>([]);
  const [bondRows, setBondRows] = useState<BondRow[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bondNote, setBondNote] = useState('');

  const link = useMemo(() => `https://buklod.expo.app/post/${postId}`, [postId]);

  const load = useCallback(async () => {
    if (!open || !user?.id || !postId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: postRow, error: postError } = await supabase
        .from('community_posts')
        .select('id,user_id,body,audience,is_reel,is_hidden,deleted_at,media_mime_type')
        .eq('id', postId)
        .maybeSingle();
      if (postError) throw postError;
      if (
        !postRow?.id ||
        !postRow.is_reel ||
        postRow.is_hidden ||
        postRow.deleted_at ||
        !String(postRow.media_mime_type ?? '').startsWith('video/')
      ) {
        setPost(null);
        setDirectTargets([]);
        setScopeTargets([]);
        setRelayRows([]);
        setBondRows([]);
        return;
      }

      const [profileResult, directResult, scopeResult, relayResult, bondResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,full_name,first_name,username')
          .eq('id', postRow.user_id)
          .maybeSingle(),
        (supabase as any).rpc('get_my_connect_inbox_v2'),
        (supabase as any).rpc('buklod_connect_community_rooms'),
        (supabase as any).rpc('get_buklod_igpat_relay_chain_v1', { p_post_id: postId }),
        (supabase as any).rpc('igpat_get_bond_inbox_v2', { p_limit: 40 }),
      ]);

      if (directResult?.error) throw directResult.error;
      if (scopeResult?.error) throw scopeResult.error;
      if (relayResult?.error) throw relayResult.error;
      if (bondResult?.error) throw bondResult.error;

      const profile = profileResult.data as any;
      const rawName =
        profile?.full_name || profile?.first_name || profile?.username || 'BUKLOD Member';
      setPost({
        id: String(postRow.id),
        user_id: String(postRow.user_id),
        body: postRow.body,
        audience: postRow.audience,
        authorName: resolvePersonDisplayName(String(rawName), String(postRow.user_id)),
      });
      setDirectTargets(((directResult?.data ?? []) as DirectTarget[]).filter(row => Boolean(row?.conversation_id)));
      setScopeTargets(((scopeResult?.data ?? []) as ScopeTarget[]).filter(row => Boolean(row?.scope_id)));
      setRelayRows(((relayResult?.data ?? []) as RelayRow[]).filter(row => Boolean(row?.id)));
      setBondRows(((bondResult?.data ?? []) as BondRow[]).filter(row => Boolean(row?.id && row?.post_id)));
    } catch (loadError: any) {
      const message = String(loadError?.message ?? loadError ?? 'IGPAT actions could not load.');
      console.warn('BUKLOD IGPAT Community actions:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [open, postId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!postId) return null;

  const copyLink = async () => {
    try {
      await copyText(link);
      Alert.alert('Copied', 'IGPAT link copied.');
    } catch (copyError: any) {
      Alert.alert('Could Not Copy', String(copyError?.message ?? copyError));
    }
  };

  const externalShare = async () => {
    try {
      const message = `BUKLOD IGPAT${post?.authorName ? ` · ${post.authorName}` : ''}\n${link}`;
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'BUKLOD IGPAT', text: message, url: link });
      } else {
        await copyText(link);
        Alert.alert('Link Copied', 'Browser sharing is not available here, so the IGPAT link was copied instead.');
      }
    } catch (shareError: any) {
      if (String(shareError?.name ?? '') !== 'AbortError') {
        Alert.alert('Could Not Share', String(shareError?.message ?? shareError));
      }
    }
  };

  const startRelay = (prompt: IgpatRelayPrompt) => {
    const author = encodeURIComponent(post?.authorName ?? 'BUKLOD Member');
    router.push(
      `/igpat/create?relayParentPostId=${encodeURIComponent(postId)}&relayPrompt=${encodeURIComponent(prompt)}&relayParentAuthor=${author}` as any,
    );
  };

  const shareDirect = async (target: DirectTarget) => {
    if (!post || busyKey) return;
    const key = `share:${target.conversation_id}`;
    setBusyKey(key);
    try {
      const { error: shareError } = await (supabase as any).rpc('share_buklod_igpat_to_direct_v1', {
        p_post_id: post.id,
        p_conversation_id: target.conversation_id,
      });
      if (shareError) throw shareError;
      Alert.alert('Shared in BUKLOD Connect', `Sent to ${target.other_name}.`);
    } catch (shareError: any) {
      Alert.alert('Could Not Share', String(shareError?.message ?? shareError));
    } finally {
      setBusyKey(null);
    }
  };

  const shareScope = async (target: ScopeTarget) => {
    if (!post || busyKey) return;
    const key = `scope:${target.scope_id}`;
    setBusyKey(key);
    try {
      const { error: shareError } = await (supabase as any).rpc('share_buklod_igpat_to_scope_v1', {
        p_post_id: post.id,
        p_scope_id: target.scope_id,
      });
      if (shareError) throw shareError;
      Alert.alert('Shared in BUKLOD Connect', `Sent to ${target.scope_name}.`);
    } catch (shareError: any) {
      Alert.alert('Could Not Share', String(shareError?.message ?? shareError));
    } finally {
      setBusyKey(null);
    }
  };

  const passBond = async (target: DirectTarget) => {
    if (!post || busyKey || !target.other_user_id) return;
    const key = `bond:${target.other_user_id}`;
    setBusyKey(key);
    try {
      const { error: bondError } = await (supabase as any).rpc('igpat_create_pass_v2', {
        p_post_id: post.id,
        p_target_id: target.other_user_id,
        p_message: bondNote.trim() || null,
      });
      if (bondError) throw bondError;
      Alert.alert('IGPAT Bond Sent', `Passed intentionally to ${target.other_name}.`);
      setBondNote('');
      await load();
    } catch (bondError: any) {
      Alert.alert('Could Not Send Bond', String(bondError?.message ?? bondError));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide IGPAT actions' : 'Open IGPAT actions'}
        style={styles.trigger}
        onPress={() => setOpen(current => !current)}
      >
        <View style={styles.triggerLeft}>
          <MaterialCommunityIcons name="source-branch" size={18} color="#D9FF69" />
          <View>
            <Text style={styles.triggerTitle}>IGPAT ACTIONS</Text>
            <Text style={styles.triggerHint}>Share · Relay · Bond</Text>
          </View>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#FFFFFF" />
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.stateText}>Loading IGPAT actions…</Text>
            </View>
          ) : error ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>{error}</Text>
              <Pressable style={styles.retry} onPress={() => void load()}>
                <Text style={styles.retryText}>RETRY</Text>
              </Pressable>
            </View>
          ) : !post ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>This Community video is not an available IGPAT.</Text>
            </View>
          ) : (
            <>
              <View style={styles.contextCard}>
                <Text style={styles.contextLabel}>ORIGINAL CREATOR</Text>
                <Text style={styles.contextName}>{post.authorName}</Text>
                {!!post.body?.trim() ? (
                  <Text numberOfLines={2} style={styles.contextBody}>{post.body.trim()}</Text>
                ) : null}
                <Text style={styles.contextAudience}>AUDIENCE · {String(post.audience ?? 'public').toUpperCase()}</Text>
              </View>

              <View style={styles.quickRow}>
                <Pressable style={styles.quickButton} onPress={() => void externalShare()}>
                  <MaterialCommunityIcons name="share-variant-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.quickText}>SHARE</Text>
                </Pressable>
                <Pressable style={styles.quickButton} onPress={() => void copyLink()}>
                  <MaterialCommunityIcons name="link-variant" size={18} color="#FFFFFF" />
                  <Text style={styles.quickText}>COPY LINK</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionTitle}>RELAY</Text>
              <Text style={styles.sectionHint}>Reply with another IGPAT while keeping the original bond visible.</Text>
              <View style={styles.relayGrid}>
                {IGPAT_RELAY_OPTIONS.map(prompt => (
                  <Pressable key={prompt} style={styles.relayButton} onPress={() => startRelay(prompt)}>
                    <MaterialCommunityIcons name="source-branch" size={16} color="#D9FF69" />
                    <Text style={styles.relayText}>{igpatRelayPromptLabel(prompt).toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              {relayRows.length ? (
                <View style={styles.chainWrap}>
                  <Text style={styles.sectionTitle}>RELAY CHAIN</Text>
                  {relayRows.slice(0, 12).map(row => (
                    <Pressable
                      key={row.id}
                      style={styles.chainCard}
                      onPress={() => router.push(`/post/${row.id}` as any)}
                    >
                      <View style={styles.chainHead}>
                        <Text style={styles.chainAuthor}>{row.author_name || 'BUKLOD Member'}</Text>
                        <Text style={styles.chainDepth}>#{Math.max(0, Number(row.relay_depth ?? 0)) + 1}</Text>
                      </View>
                      <Text style={styles.chainPrompt}>
                        {row.relay_depth ? igpatRelayPromptLabel(row.relay_prompt) : 'Original IGPAT'}
                      </Text>
                      {!!row.body?.trim() ? <Text numberOfLines={2} style={styles.chainBody}>{row.body.trim()}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>BUKLOD CONNECT · DIRECT</Text>
              <Text style={styles.sectionHint}>Share normally, or PASS as an intentional IGPAT Bond.</Text>
              <TextInput
                value={bondNote}
                onChangeText={setBondNote}
                maxLength={240}
                placeholder="Optional Bond note"
                placeholderTextColor="rgba(255,255,255,0.30)"
                style={styles.noteInput}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                {directTargets.length ? directTargets.slice(0, 20).map(target => (
                  <View key={target.conversation_id} style={styles.personCard}>
                    <Text numberOfLines={1} style={styles.personName}>{target.other_name}</Text>
                    <Text numberOfLines={1} style={styles.personHint}>{target.church_name || 'Direct Connect'}</Text>
                    <View style={styles.personActions}>
                      <Pressable
                        disabled={Boolean(busyKey)}
                        style={styles.smallButton}
                        onPress={() => void shareDirect(target)}
                      >
                        <Text style={styles.smallText}>{busyKey === `share:${target.conversation_id}` ? '…' : 'SEND'}</Text>
                      </Pressable>
                      <Pressable
                        disabled={Boolean(busyKey)}
                        style={[styles.smallButton, styles.bondButton]}
                        onPress={() => void passBond(target)}
                      >
                        <Text style={[styles.smallText, styles.bondText]}>{busyKey === `bond:${target.other_user_id}` ? '…' : 'BOND'}</Text>
                      </Pressable>
                    </View>
                  </View>
                )) : (
                  <View style={styles.stateCard}><Text style={styles.stateText}>No existing direct Connect conversations.</Text></View>
                )}
              </ScrollView>

              <Text style={styles.sectionTitle}>BUKLOD CONNECT · ROOMS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
                {scopeTargets.length ? scopeTargets.slice(0, 20).map(target => (
                  <Pressable
                    key={target.scope_id}
                    disabled={Boolean(busyKey)}
                    style={styles.roomCard}
                    onPress={() => void shareScope(target)}
                  >
                    <MaterialCommunityIcons name="account-group-outline" size={18} color="#D9FF69" />
                    <Text numberOfLines={2} style={styles.roomName}>{target.scope_name}</Text>
                    <Text style={styles.roomHint}>{target.scope_type}{target.geo_level ? ` · ${target.geo_level}` : ''}</Text>
                  </Pressable>
                )) : (
                  <View style={styles.stateCard}><Text style={styles.stateText}>No available Connect rooms.</Text></View>
                )}
              </ScrollView>

              <Text style={styles.sectionTitle}>BOND INBOX</Text>
              <Text style={styles.sectionHint}>Your recent sent and received intentional IGPAT bonds.</Text>
              <View style={styles.bondList}>
                {bondRows.length ? bondRows.slice(0, 12).map(row => {
                  const outgoing = row.actor_user_id === user?.id;
                  const actorName = resolvePersonDisplayName(row.actor_name || 'BUKLOD Member', row.actor_user_id);
                  const locked = Boolean(row.locked);
                  return (
                    <Pressable
                      key={row.id}
                      disabled={locked}
                      style={[styles.bondCard, locked && styles.lockedBondCard]}
                      onPress={() => !locked && router.push(`/post/${row.post_id}` as any)}
                    >
                      <View style={styles.bondHead}>
                        <MaterialCommunityIcons name={locked ? 'lock-outline' : 'link-variant'} size={16} color={locked ? '#D9FF69' : '#FFFFFF'} />
                        <Text style={styles.bondKind}>{String(row.kind).replace(/_/g, ' ').toUpperCase()}</Text>
                      </View>
                      <Text style={styles.bondDirection}>{outgoing ? 'SENT BY YOU' : `FROM ${actorName}`}</Text>
                      {locked ? (
                        <Text style={styles.bondMessage}>Sealed until {shortDate(row.unlock_at)}</Text>
                      ) : row.message?.trim() ? (
                        <Text numberOfLines={2} style={styles.bondMessage}>{row.message.trim()}</Text>
                      ) : null}
                    </Pressable>
                  );
                }) : (
                  <View style={styles.stateCard}><Text style={styles.stateText}>No IGPAT Bonds yet.</Text></View>
                )}
              </View>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 10 },
  trigger: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(217,255,105,0.20)',
    backgroundColor: '#0D120F',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  triggerTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  triggerHint: { marginTop: 2, color: 'rgba(255,255,255,0.44)', fontSize: 8.5 },
  panel: { marginTop: 8, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#080B09', padding: 13 },
  centerState: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8 },
  stateCard: { minWidth: 190, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0D120F', padding: 12 },
  stateText: { color: 'rgba(255,255,255,0.58)', fontSize: 9.5, lineHeight: 14, textAlign: 'center' },
  retry: { marginTop: 10, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  contextCard: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(217,255,105,0.14)', backgroundColor: '#10150D', padding: 12 },
  contextLabel: { color: 'rgba(255,255,255,0.38)', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8 },
  contextName: { marginTop: 4, color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  contextBody: { marginTop: 5, color: 'rgba(255,255,255,0.65)', fontSize: 9.5, lineHeight: 14 },
  contextAudience: { marginTop: 7, color: '#D9FF69', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  quickRow: { marginTop: 9, flexDirection: 'row', gap: 8 },
  quickButton: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center', gap: 5 },
  quickText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  sectionTitle: { marginTop: 17, color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  sectionHint: { marginTop: 3, color: 'rgba(255,255,255,0.40)', fontSize: 8.2, lineHeight: 12 },
  relayGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  relayButton: { width: '48%', minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(217,255,105,0.14)', backgroundColor: '#0D120F', padding: 9, justifyContent: 'center' },
  relayText: { marginTop: 5, color: '#FFFFFF', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.4 },
  chainWrap: { marginTop: 2 },
  chainCard: { marginTop: 7, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0D120F', padding: 10 },
  chainHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chainAuthor: { flex: 1, color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  chainDepth: { color: 'rgba(255,255,255,0.40)', fontSize: 7.5, fontWeight: '900' },
  chainPrompt: { marginTop: 4, color: '#D9FF69', fontSize: 7.8, fontWeight: '900' },
  chainBody: { marginTop: 5, color: 'rgba(255,255,255,0.58)', fontSize: 9, lineHeight: 13 },
  noteInput: { marginTop: 8, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', color: '#FFFFFF', paddingHorizontal: 11, fontSize: 10 },
  horizontalList: { paddingTop: 8, paddingRight: 8, gap: 8 },
  personCard: { width: 176, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#0D120F', padding: 10 },
  personName: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  personHint: { marginTop: 3, color: 'rgba(255,255,255,0.38)', fontSize: 8 },
  personActions: { marginTop: 9, flexDirection: 'row', gap: 6 },
  smallButton: { flex: 1, minHeight: 32, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  bondButton: { backgroundColor: '#D9FF69', borderColor: '#D9FF69' },
  smallText: { color: '#FFFFFF', fontSize: 7.8, fontWeight: '900' },
  bondText: { color: '#07100B' },
  roomCard: { width: 156, minHeight: 78, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#0D120F', padding: 10, justifyContent: 'center' },
  roomName: { marginTop: 7, color: '#FFFFFF', fontSize: 9.5, lineHeight: 13, fontWeight: '900' },
  roomHint: { marginTop: 3, color: 'rgba(255,255,255,0.38)', fontSize: 7.5 },
  bondList: { marginTop: 7, gap: 7 },
  bondCard: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0D120F', padding: 10 },
  lockedBondCard: { borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D' },
  bondHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bondKind: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  bondDirection: { marginTop: 4, color: 'rgba(255,255,255,0.38)', fontSize: 7.5, fontWeight: '800' },
  bondMessage: { marginTop: 6, color: 'rgba(255,255,255,0.62)', fontSize: 9, lineHeight: 13 },
});
