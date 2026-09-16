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
  relay_prompt?: string | null;
  relay_depth?: number | null;
  author_name?: string | null;
  body?: string | null;
};

type BondRow = {
  id: string;
  kind: string;
  post_id: string;
  actor_user_id: string;
  actor_name?: string | null;
  message?: string | null;
  unlock_at?: string | null;
  locked?: boolean | null;
};

function shortDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
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
        !postRow?.id || !postRow.is_reel || postRow.is_hidden || postRow.deleted_at ||
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
        supabase.from('profiles').select('id,full_name,first_name,username').eq('id', postRow.user_id).maybeSingle(),
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
      const rawName = profile?.full_name || profile?.first_name || profile?.username || 'BUKLOD Member';
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

  useEffect(() => { void load(); }, [load]);

  if (!postId) return null;

  const externalShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'BUKLOD IGPAT', text: `BUKLOD IGPAT${post?.authorName ? ` · ${post.authorName}` : ''}`, url: link });
      } else {
        await copyText(link);
        Alert.alert('Link Copied', 'Browser sharing is unavailable here, so the IGPAT link was copied.');
      }
    } catch (shareError: any) {
      if (String(shareError?.name ?? '') !== 'AbortError') {
        Alert.alert('Could Not Share', String(shareError?.message ?? shareError));
      }
    }
  };

  const startRelay = (prompt: IgpatRelayPrompt) => {
    const author = encodeURIComponent(post?.authorName ?? 'BUKLOD Member');
    router.push(`/igpat/create?relayParentPostId=${encodeURIComponent(postId)}&relayPrompt=${encodeURIComponent(prompt)}&relayParentAuthor=${author}` as any);
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
      setBondNote('');
      Alert.alert('IGPAT Bond Sent', `Passed intentionally to ${target.other_name}.`);
      await load();
    } catch (bondError: any) {
      Alert.alert('Could Not Send Bond', String(bondError?.message ?? bondError));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.trigger} onPress={() => setOpen(current => !current)}>
        <View style={styles.row}>
          <MaterialCommunityIcons name="source-branch" size={18} color="#D9FF69" />
          <View>
            <Text style={styles.triggerTitle}>IGPAT ACTIONS</Text>
            <Text style={styles.hint}>Share · Relay · Bond</Text>
          </View>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#FFFFFF" />
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color="#FFFFFF" /><Text style={styles.hint}>Loading IGPAT actions…</Text></View>
          ) : error ? (
            <View style={styles.card}><Text style={styles.hint}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.linkText}>RETRY</Text></Pressable></View>
          ) : !post ? (
            <View style={styles.card}><Text style={styles.hint}>This Community video is not an available IGPAT.</Text></View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.kicker}>ORIGINAL CREATOR</Text>
                <Text style={styles.name}>{post.authorName}</Text>
                {!!post.body?.trim() ? <Text numberOfLines={2} style={styles.body}>{post.body.trim()}</Text> : null}
                <Text style={styles.audience}>AUDIENCE · {String(post.audience ?? 'public').toUpperCase()}</Text>
              </View>

              <View style={styles.twoCol}>
                <Pressable style={styles.action} onPress={() => void externalShare()}><Text style={styles.actionText}>SHARE</Text></Pressable>
                <Pressable style={styles.action} onPress={() => void copyText(link).then(() => Alert.alert('Copied', 'IGPAT link copied.'))}><Text style={styles.actionText}>COPY LINK</Text></Pressable>
              </View>

              <Text style={styles.section}>RELAY</Text>
              <View style={styles.twoCol}>
                {IGPAT_RELAY_OPTIONS.map(option => (
                  <Pressable key={option.key} style={styles.action} onPress={() => startRelay(option.key)}>
                    <Text style={styles.actionText}>{option.label.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              {relayRows.length ? <>
                <Text style={styles.section}>RELAY CHAIN</Text>
                {relayRows.slice(0, 10).map(row => (
                  <Pressable key={row.id} style={styles.card} onPress={() => router.push(`/post/${row.id}` as any)}>
                    <View style={styles.rowBetween}><Text style={styles.name}>{row.author_name || 'BUKLOD Member'}</Text><Text style={styles.kicker}>#{Math.max(0, Number(row.relay_depth ?? 0)) + 1}</Text></View>
                    <Text style={styles.audience}>{row.relay_depth ? igpatRelayPromptLabel(row.relay_prompt).toUpperCase() : 'ORIGINAL IGPAT'}</Text>
                    {!!row.body?.trim() ? <Text numberOfLines={2} style={styles.body}>{row.body.trim()}</Text> : null}
                  </Pressable>
                ))}
              </> : null}

              <Text style={styles.section}>BUKLOD CONNECT · DIRECT</Text>
              <TextInput value={bondNote} onChangeText={setBondNote} maxLength={240} placeholder="Optional Bond note" placeholderTextColor="rgba(255,255,255,0.30)" style={styles.input} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
                {directTargets.length ? directTargets.slice(0, 20).map(target => (
                  <View key={target.conversation_id} style={styles.person}>
                    <Text numberOfLines={1} style={styles.name}>{target.other_name}</Text>
                    <Text numberOfLines={1} style={styles.hint}>{target.church_name || 'Direct Connect'}</Text>
                    <View style={styles.twoCol}>
                      <Pressable disabled={Boolean(busyKey)} style={styles.small} onPress={() => void shareDirect(target)}><Text style={styles.smallText}>{busyKey === `share:${target.conversation_id}` ? '…' : 'SEND'}</Text></Pressable>
                      <Pressable disabled={Boolean(busyKey)} style={[styles.small, styles.bond]} onPress={() => void passBond(target)}><Text style={[styles.smallText, styles.bondText]}>{busyKey === `bond:${target.other_user_id}` ? '…' : 'BOND'}</Text></Pressable>
                    </View>
                  </View>
                )) : <View style={styles.card}><Text style={styles.hint}>No existing direct Connect conversations.</Text></View>}
              </ScrollView>

              <Text style={styles.section}>BUKLOD CONNECT · ROOMS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
                {scopeTargets.length ? scopeTargets.slice(0, 20).map(target => (
                  <Pressable key={target.scope_id} disabled={Boolean(busyKey)} style={styles.room} onPress={() => void shareScope(target)}>
                    <MaterialCommunityIcons name="account-group-outline" size={18} color="#D9FF69" />
                    <Text numberOfLines={2} style={styles.name}>{target.scope_name}</Text>
                    <Text style={styles.hint}>{target.scope_type}{target.geo_level ? ` · ${target.geo_level}` : ''}</Text>
                  </Pressable>
                )) : <View style={styles.card}><Text style={styles.hint}>No available Connect rooms.</Text></View>}
              </ScrollView>

              <Text style={styles.section}>BOND INBOX</Text>
              {bondRows.length ? bondRows.slice(0, 10).map(row => {
                const locked = Boolean(row.locked);
                const outgoing = row.actor_user_id === user?.id;
                const actorName = resolvePersonDisplayName(row.actor_name || 'BUKLOD Member', row.actor_user_id);
                return (
                  <Pressable key={row.id} disabled={locked} style={[styles.card, locked && styles.locked]} onPress={() => !locked && router.push(`/post/${row.post_id}` as any)}>
                    <View style={styles.row}><MaterialCommunityIcons name={locked ? 'lock-outline' : 'link-variant'} size={16} color={locked ? '#D9FF69' : '#FFFFFF'} /><Text style={styles.name}>{String(row.kind).replace(/_/g, ' ').toUpperCase()}</Text></View>
                    <Text style={styles.hint}>{outgoing ? 'SENT BY YOU' : `FROM ${actorName}`}</Text>
                    {locked ? <Text style={styles.body}>Sealed until {shortDate(row.unlock_at)}</Text> : row.message?.trim() ? <Text numberOfLines={2} style={styles.body}>{row.message.trim()}</Text> : null}
                  </Pressable>
                );
              }) : <View style={styles.card}><Text style={styles.hint}>No IGPAT Bonds yet.</Text></View>}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 10 },
  trigger: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(217,255,105,0.20)', backgroundColor: '#0D120F', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panel: { marginTop: 8, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#080B09', padding: 13 },
  center: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  triggerTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  card: { marginTop: 8, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0D120F', padding: 11 },
  locked: { borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D' },
  kicker: { color: 'rgba(255,255,255,0.38)', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8 },
  name: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  body: { marginTop: 5, color: 'rgba(255,255,255,0.62)', fontSize: 9, lineHeight: 13 },
  audience: { marginTop: 6, color: '#D9FF69', fontSize: 7.5, fontWeight: '900' },
  hint: { marginTop: 2, color: 'rgba(255,255,255,0.42)', fontSize: 8.2, lineHeight: 12 },
  linkText: { marginTop: 8, color: '#D9FF69', fontSize: 8.5, fontWeight: '900', textAlign: 'center' },
  section: { marginTop: 17, color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  twoCol: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  action: { width: '48%', minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center', padding: 8 },
  actionText: { color: '#FFFFFF', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.4 },
  input: { marginTop: 8, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', color: '#FFFFFF', paddingHorizontal: 11, fontSize: 10 },
  horizontal: { paddingTop: 8, paddingRight: 8, gap: 8 },
  person: { width: 176, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#0D120F', padding: 10 },
  room: { width: 156, minHeight: 78, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#0D120F', padding: 10, justifyContent: 'center', gap: 6 },
  small: { flex: 1, minHeight: 32, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  bond: { backgroundColor: '#D9FF69', borderColor: '#D9FF69' },
  smallText: { color: '#FFFFFF', fontSize: 7.8, fontWeight: '900' },
  bondText: { color: '#07100B' },
});
