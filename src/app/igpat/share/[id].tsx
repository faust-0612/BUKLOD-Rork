import * as Clipboard from 'expo-clipboard';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

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
  scope_id?: string | null;
  authorName: string;
};

export default function IgpatShareScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const postId = (Array.isArray(params.id) ? params.id[0] : params.id ?? '').trim();
  const [post, setPost] = useState<PostContext | null>(null);
  const [directTargets, setDirectTargets] = useState<DirectTarget[]>([]);
  const [scopeTargets, setScopeTargets] = useState<ScopeTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const link = useMemo(() => postId ? `https://buklod.expo.app/post/${postId}` : '', [postId]);
  const relayLink = useMemo(() => postId ? `https://buklod.expo.app/igpat/relay/${postId}` : '', [postId]);

  const load = useCallback(async () => {
    if (!postId) {
      setError('IGPAT share target is missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: postRow, error: postError } = await supabase
        .from('community_posts')
        .select('id,user_id,body,audience,scope_id,is_reel,is_hidden,deleted_at,media_mime_type')
        .eq('id', postId)
        .maybeSingle();
      if (postError) throw postError;
      if (!postRow?.id || !postRow.is_reel || postRow.is_hidden || postRow.deleted_at || !String(postRow.media_mime_type ?? '').startsWith('video/')) {
        throw new Error('IGPAT is unavailable for this account.');
      }

      const [{ data: profile }, direct, scopes] = await Promise.all([
        supabase.from('profiles').select('id,full_name,first_name,username').eq('id', postRow.user_id).maybeSingle(),
        (supabase as any).rpc('get_my_connect_inbox_v2'),
        (supabase as any).rpc('buklod_connect_community_rooms'),
      ]);
      if (direct?.error) throw direct.error;
      if (scopes?.error) throw scopes.error;
      const rawName = profile?.full_name || profile?.first_name || profile?.username || 'BUKLOD Member';
      setPost({
        id: String(postRow.id),
        user_id: String(postRow.user_id),
        body: postRow.body,
        audience: postRow.audience,
        scope_id: postRow.scope_id,
        authorName: resolvePersonDisplayName(String(rawName), String(postRow.user_id)),
      });
      setDirectTargets((direct?.data ?? []) as DirectTarget[]);
      setScopeTargets((scopes?.data ?? []) as ScopeTarget[]);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT share:', String(loadError?.message ?? loadError));
      setPost(null);
      setDirectTargets([]);
      setScopeTargets([]);
      setError(String(loadError?.message ?? 'IGPAT sharing is unavailable.'));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void load(); }, [load]);

  const trackShare = () => {
    if (!post) return;
    void (supabase as any).rpc('igpat_track_event_v2', {
      p_event_name: 'share',
      p_post_id: post.id,
      p_creator_id: post.user_id,
      p_feed_source: 'share_sheet',
      p_watch_ms: 0,
      p_meta: {},
    }).catch(() => undefined);
  };

  const externalShare = async (relay = false) => {
    if (!post) return;
    const targetLink = relay ? relayLink : link;
    const title = relay ? 'BUKLOD IGPAT Relay' : 'BUKLOD IGPAT';
    const message = `${title} · ${post.authorName}\n${post.body?.trim() ? `${post.body.trim().slice(0, 220)}\n` : ''}${targetLink}`;
    const result = await Share.share({ message });
    if (result.action === Share.sharedAction) trackShare();
  };

  const copy = async (relay = false) => {
    if (!post) return;
    const targetLink = relay ? relayLink : link;
    await Clipboard.setStringAsync(targetLink);
    trackShare();
    Alert.alert('Copied', relay ? 'Relay thread link copied.' : 'IGPAT link copied.');
  };

  const shareDirect = async (target: DirectTarget) => {
    if (!post || busyKey) return;
    const key = `direct:${target.conversation_id}`;
    setBusyKey(key);
    try {
      const { error: shareError } = await (supabase as any).rpc('share_buklod_igpat_to_direct_v1', {
        p_post_id: post.id,
        p_conversation_id: target.conversation_id,
      });
      if (shareError) throw shareError;
      trackShare();
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
      trackShare();
      Alert.alert('Shared in BUKLOD Connect', `Sent to ${target.scope_name}.`);
    } catch (shareError: any) {
      Alert.alert('Could Not Share', String(shareError?.message ?? shareError));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>Share</Text>
          <Text style={styles.subtitle}>Creator attribution stays attached. The original IGPAT privacy rules still decide who can open it.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading share options…</Text></View>
      ) : error || !post ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error || 'IGPAT is unavailable.'}</Text></View>
      ) : (
        <>
          <View style={styles.contextCard}>
            <Text style={styles.contextLabel}>ORIGINAL CREATOR</Text>
            <Text style={styles.contextName}>{post.authorName}</Text>
            {!!post.body?.trim() && <Text style={styles.contextBody} numberOfLines={3}>{post.body.trim()}</Text>}
            <Text style={styles.contextAudience}>AUDIENCE · {String(post.audience ?? 'public').toUpperCase()}</Text>
          </View>

          <View style={styles.quickGrid}>
            <Pressable style={styles.quickButton} onPress={() => void externalShare(false)}>
              <MaterialCommunityIcons name="share-variant-outline" size={19} color="#FFFFFF" />
              <Text style={styles.quickTitle}>SHARE LINK</Text>
            </Pressable>
            <Pressable style={styles.quickButton} onPress={() => void copy(false)}>
              <MaterialCommunityIcons name="link-variant" size={19} color="#FFFFFF" />
              <Text style={styles.quickTitle}>COPY LINK</Text>
            </Pressable>
            <Pressable style={styles.quickButton} onPress={() => void externalShare(true)}>
              <MaterialCommunityIcons name="source-branch" size={19} color="#FFFFFF" />
              <Text style={styles.quickTitle}>SHARE RELAY</Text>
            </Pressable>
            <Pressable style={styles.quickButton} onPress={() => void copy(true)}>
              <MaterialCommunityIcons name="content-copy" size={19} color="#FFFFFF" />
              <Text style={styles.quickTitle}>COPY RELAY</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>BUKLOD CONNECT · DIRECT</Text>
          <Text style={styles.sectionHint}>Only destinations that still satisfy original IGPAT access will be accepted by the server.</Text>
          <View style={styles.list}>
            {directTargets.length ? directTargets.slice(0, 30).map(target => {
              const key = `direct:${target.conversation_id}`;
              return (
                <Pressable key={target.conversation_id} disabled={Boolean(busyKey)} style={styles.targetCard} onPress={() => void shareDirect(target)}>
                  <MaterialCommunityIcons name="account-outline" size={19} color="#D9FF69" />
                  <View style={styles.targetCopy}>
                    <Text style={styles.targetTitle}>{target.other_name}</Text>
                    <Text style={styles.targetHint}>{target.church_name || 'Direct conversation'}</Text>
                  </View>
                  {busyKey === key ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="send-outline" size={17} color="#FFFFFF" />}
                </Pressable>
              );
            }) : <View style={styles.stateCard}><Text style={styles.stateText}>No existing direct Connect conversations.</Text></View>}
          </View>

          <Text style={styles.sectionTitle}>BUKLOD CONNECT · SCOPE ROOMS</Text>
          <Text style={styles.sectionHint}>Public IGPATs may be shared broadly. Restricted IGPATs are accepted only in their exact authorized Scope room.</Text>
          <View style={styles.list}>
            {scopeTargets.length ? scopeTargets.slice(0, 30).map(target => {
              const key = `scope:${target.scope_id}`;
              return (
                <Pressable key={target.scope_id} disabled={Boolean(busyKey)} style={styles.targetCard} onPress={() => void shareScope(target)}>
                  <MaterialCommunityIcons name="account-group-outline" size={19} color="#D9FF69" />
                  <View style={styles.targetCopy}>
                    <Text style={styles.targetTitle}>{target.scope_name}</Text>
                    <Text style={styles.targetHint}>{target.scope_type}{target.geo_level ? ` · ${target.geo_level}` : ''}</Text>
                  </View>
                  {busyKey === key ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="send-outline" size={17} color="#FFFFFF" />}
                </Pressable>
              );
            }) : <View style={styles.stateCard}><Text style={styles.stateText}>No available Connect scope rooms.</Text></View>}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.46)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.58)', fontSize: 11, lineHeight: 17 },
  centerState: { marginTop: 40, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 16 },
  stateText: { color: 'rgba(255,255,255,0.58)', fontSize: 9.5, lineHeight: 15, textAlign: 'center' },
  contextCard: { marginTop: 20, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D', padding: 15 },
  contextLabel: { color: 'rgba(255,255,255,0.40)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  contextName: { marginTop: 5, color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  contextBody: { marginTop: 7, color: 'rgba(255,255,255,0.68)', fontSize: 10.5, lineHeight: 16 },
  contextAudience: { marginTop: 10, color: '#D9FF69', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  quickGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickButton: { width: '48%', minHeight: 66, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 12, justifyContent: 'center' },
  quickTitle: { marginTop: 8, color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.6 },
  sectionTitle: { marginTop: 24, color: '#FFFFFF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
  sectionHint: { marginTop: 4, color: 'rgba(255,255,255,0.42)', fontSize: 8.5, lineHeight: 13 },
  list: { marginTop: 9, gap: 7 },
  targetCard: { minHeight: 60, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  targetCopy: { flex: 1 },
  targetTitle: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900' },
  targetHint: { marginTop: 3, color: 'rgba(255,255,255,0.42)', fontSize: 8.3 },
});
