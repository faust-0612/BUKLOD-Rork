/*
 * V26 IGPAT compact Community header candidate.
 * OTA-safe: existing expo-video, expo-router, Supabase and React Native only.
 * One mounted video player; no duplicate blurred video decoders.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Alert, Modal, PanResponder, Pressable,
  ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

type Mode = 'for-you' | 'following' | 'latest';
type Reel = {
  id: string;
  user_id?: string | null;
  author_name: string;
  body?: string | null;
  media_path: string;
  media_url?: string | null;
  reaction_count?: number | null;
  comment_count?: number | null;
  my_reaction?: string | null;
};
type Comment = {
  id: string;
  body?: string | null;
  commenter_name?: string | null;
  parent_id?: string | null;
};
const SAVED_KEY = '@buklod_igpat_saved_ids_v1';
const MAX_ROWS = 8;
const SIGNED_TTL = 1200;

function CompactPlayer({
  uri, active,
}: {
  uri: string;
  active: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    try {
      player.muted = muted;
      if (active && !paused) player.play();
      else player.pause();
    } catch {}
    return () => { try { player.pause(); } catch {} };
  }, [active, muted, paused, player]);

  return (
    <View style={styles.videoInner}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Play IGPAT' : 'Pause IGPAT'}
        onPress={() => setPaused(v => !v)}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={false}
          contentFit="contain"
        />
        {/* Subtle transparent side gutters, not a second video decoder. */}
        <View pointerEvents="none" style={styles.leftGutter} />
        <View pointerEvents="none" style={styles.rightGutter} />
        {paused ? (
          <View pointerEvents="none" style={styles.pauseCue}>
            <MaterialCommunityIcons name="play-circle" size={40} color="#FFFFFF" />
          </View>
        ) : null}
      </Pressable>
      <Pressable
        onPress={() => setMuted(v => !v)}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute IGPAT' : 'Mute IGPAT'}
        style={styles.muteButton}
      >
        <MaterialCommunityIcons
          name={muted ? 'volume-off' : 'volume-high'}
          size={17}
          color="#FFFFFF"
        />
      </Pressable>
    </View>
  );
}

function Action({
  icon, label, count, active, onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  count?: number | null;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
      <MaterialCommunityIcons name={icon} size={19} color={active ? '#008657' : '#253831'} />
      {typeof count === 'number' ? <Text style={styles.actionText}>{count}</Text> : null}
    </Pressable>
  );
}

export default function BuklodIgpatCompactCard({ nearTop = true }: { nearTop?: boolean }) {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [rows, setRows] = useState<Reel[]>([]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('for-you');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [commentsBusy, setCommentsBusy] = useState(false);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const requestId = useRef(0);
  const latestRows = useRef<Reel[]>([]);
  const latestIndex = useRef(0);
  latestRows.current = rows;
  latestIndex.current = index;
  const current = rows[index];
  const canPlay = isFocused && nearTop && appActive && !commentOpen;

  useEffect(() => {
    const sub = AppState.addEventListener('change', status => {
      setAppActive(status === 'active');
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(SAVED_KEY).then(value => {
      if (!alive) return;
      try {
        const ids = JSON.parse(value || '[]');
        setSavedIds(new Set(Array.isArray(ids) ? ids.map(String) : []));
      } catch { setSavedIds(new Set()); }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const loadFollowing = useCallback(async () => {
    if (!user?.id) { setFollowing(new Set()); return; }
    const { data, error } = await supabase
      .from('buklod_user_follows')
      .select('followed_user_id')
      .eq('follower_id', user.id);
    if (!error) setFollowing(new Set((data ?? []).map(x => String(x.followed_user_id))));
  }, [user?.id]);

  const load = useCallback(async () => {
    const token = ++requestId.current;
    if (!user?.id) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setErrorText('');
    try {
      const { data, error } = await (supabase as any).rpc('get_buklod_igpat_feed_v2', {
        p_mode: mode, p_limit: MAX_ROWS,
      });
      if (error) throw error;
      const list = ((data ?? []) as Reel[]).filter(x => Boolean(x.media_path)).slice(0, MAX_ROWS);
      const signed = await Promise.all(list.map(async row => {
        const { data: file, error: signError } = await supabase.storage
          .from('community-media').createSignedUrl(row.media_path, SIGNED_TTL);
        return signError ? null : { ...row, media_url: file?.signedUrl ?? null };
      }));
      if (token !== requestId.current) return;
      setRows(signed.filter((x): x is Reel => Boolean(x?.media_url)));
      setIndex(0);
    } catch (e) {
      if (token !== requestId.current) return;
      setErrorText(String((e as Error)?.message || 'Could not load IGPAT.'));
      setRows([]);
    } finally {
      if (token === requestId.current) setLoading(false);
    }
  }, [mode, user?.id]);

  useEffect(() => {
    if (isFocused) {
      void load();
      void loadFollowing();
    }
    return () => { requestId.current += 1; };
  }, [isFocused, load, loadFollowing]);

  const move = useCallback((direction: number) => {
    setIndex(i => Math.min(Math.max(i + direction, 0), latestRows.current.length - 1));
  }, []);
  const gesture = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dy) > 13 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3,
    onPanResponderRelease: (_, g) => {
      if (g.dy < -45 || g.vy < -0.7) move(1);
      else if (g.dy > 45 || g.vy > 0.7) move(-1);
    },
    onPanResponderTerminationRequest: () => true,
  }), [move]);

  const love = useCallback(async () => {
    const reel = latestRows.current[latestIndex.current];
    if (!reel || reactionBusy || reel.my_reaction === 'love') return;
    setReactionBusy(true);
    setRows(old => old.map(x => x.id === reel.id ? {
      ...x, my_reaction: 'love',
      reaction_count: Number(x.reaction_count ?? 0) + (x.my_reaction ? 0 : 1),
    } : x));
    try {
      let res = await (supabase as any).rpc('set_buklod_post_reaction_v4', {
        p_post_id: reel.id, p_reaction: 'love',
      });
      if (res.error) res = await (supabase as any).rpc('set_buklod_post_reaction_v3', {
        p_post_id: reel.id, p_reaction: 'love',
      });
      if (res.error) throw res.error;
    } catch (e) {
      setRows(old => old.map(x => x.id === reel.id ? reel : x));
      Alert.alert('IGPAT', String((e as Error)?.message || 'Like failed.'));
    } finally { setReactionBusy(false); }
  }, [reactionBusy]);

  const save = useCallback(async () => {
    if (!current) return;
    const copy = new Set(savedIds);
    if (copy.has(current.id)) copy.delete(current.id); else copy.add(current.id);
    setSavedIds(copy);
    try { await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...copy])); }
    catch { setSavedIds(savedIds); }
  }, [current, savedIds]);

  const toggleFollow = useCallback(async () => {
    if (!user?.id || !current?.user_id || current.user_id === user.id) return;
    const creator = current.user_id;
    const wasFollowing = following.has(creator);
    const result = wasFollowing
      ? await supabase.from('buklod_user_follows').delete()
          .eq('follower_id', user.id).eq('followed_user_id', creator)
      : await supabase.from('buklod_user_follows').insert({
          follower_id: user.id, followed_user_id: creator,
        });
    if (result.error) Alert.alert('IGPAT', result.error.message);
    else setFollowing(old => {
      const next = new Set(old);
      if (wasFollowing) next.delete(creator); else next.add(creator);
      return next;
    });
  }, [user?.id, current, following]);

  const readComments = useCallback(async (id: string) => {
    setCommentsBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_buklod_post_comments_v4', {
        p_post_id: id,
      });
      if (error) throw error;
      setComments((data ?? []) as Comment[]);
    } catch (e) { Alert.alert('IGPAT comments', String((e as Error)?.message ?? e)); }
    finally { setCommentsBusy(false); }
  }, []);

  const openComments = useCallback(() => {
    if (!current) return;
    setCommentText('');
    setReplyId(null);
    setComments([]);
    setCommentOpen(true);
    void readComments(current.id);
  }, [current, readComments]);

  const submitComment = useCallback(async () => {
    if (!current || !commentText.trim() || commentsBusy) return;
    setCommentsBusy(true);
    const { error } = await (supabase as any).rpc('add_buklod_post_comment_v4', {
      p_post_id: current.id, p_body: commentText.trim(), p_parent_id: replyId,
    });
    setCommentsBusy(false);
    if (error) { Alert.alert('IGPAT comment', error.message); return; }
    setCommentText('');
    setReplyId(null);
    setRows(old => old.map(x => x.id === current.id ? {
      ...x, comment_count: Number(x.comment_count ?? 0) + 1,
    } : x));
    await readComments(current.id);
  }, [current, commentText, commentsBusy, replyId, readComments]);

  const share = useCallback(() => {
    if (!current) return;
    void Share.share({
      message: 'BUKLOD IGPAT — An Instant Bond.\nhttps://buklod.expo.app/post/' + current.id,
    }).catch(() => {});
  }, [current]);

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.brand}>
          <MaterialCommunityIcons name="play-box-multiple" size={22} color="#008657" />
          <View>
            <Text style={styles.title}>IGPAT</Text>
            <Text style={styles.subtitle}>An Instant Bond · Swipe pataas</Text>
          </View>
        </View>
        <View style={styles.headingActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Upload IGPAT"
            style={styles.upload} onPress={() => router.push('/igpat/create' as any)}>
            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.uploadText}>Upload</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Refresh IGPAT"
            onPress={() => void load()} style={styles.refresh}>
            <MaterialCommunityIcons name="refresh" size={20} color="#008657" />
          </Pressable>
        </View>
      </View>
      <View style={styles.modeRow}>
        {([['for-you', 'For You'], ['following', 'Following'], ['latest', 'Latest']] as const)
          .map(([key, label]) => (
            <Pressable key={key} onPress={() => setMode(key)}
              style={[styles.mode, mode === key && styles.selectedMode]}>
              <Text style={[styles.modeText, mode === key && styles.selectedModeText]}>{label}</Text>
            </Pressable>
          ))}
      </View>
      <View style={styles.stage} {...gesture.panHandlers}>
        {canPlay && current?.media_url ? (
          <CompactPlayer key={current.id} uri={current.media_url} active />
        ) : (
          <View style={styles.placeholder}>
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <MaterialCommunityIcons name="play-circle-outline" size={34} color="#D5E4DC" />}
            <Text style={styles.placeholderText}>
              {loading ? 'Loading IGPAT…' :
                !user?.id ? 'Sign in to see IGPAT' :
                errorText ? 'IGPAT unavailable · Tap refresh' :
                !current ? 'No IGPAT videos yet' : 'IGPAT paused'}
            </Text>
          </View>
        )}
        {current && !loading ? (
          <View pointerEvents="none" style={styles.stageCaption}>
            <Text numberOfLines={1} style={styles.videoAuthor}>
              {resolvePersonDisplayName(current.author_name, current.user_id)}
            </Text>
            <Text style={styles.counter}>{index + 1} / {rows.length}  ↑↓</Text>
          </View>
        ) : null}
      </View>
      {current ? (
        <>
          {current.body ? <Text numberOfLines={2} style={styles.bodyText}>{current.body}</Text> : null}
          <View style={styles.footer}>
            <Action icon={current.my_reaction === 'love' ? 'heart' : 'heart-outline'}
              label="Like IGPAT" count={current.reaction_count}
              active={current.my_reaction === 'love'} onPress={() => void love()} />
            <Action icon="comment-outline" label="Comment on IGPAT"
              count={current.comment_count} onPress={openComments} />
            <Action icon="share-variant-outline" label="Share IGPAT" onPress={share} />
            <Action icon={savedIds.has(current.id) ? 'bookmark' : 'bookmark-outline'}
              label="Save IGPAT" active={savedIds.has(current.id)} onPress={() => void save()} />
            {current.user_id && current.user_id !== user?.id ? (
              <Pressable style={styles.follow} onPress={() => void toggleFollow()}>
                <Text style={styles.followText}>
                  {following.has(current.user_id) ? 'Following' : '+ Follow'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
      <Modal transparent visible={commentOpen} animationType="slide"
        onRequestClose={() => setCommentOpen(false)}>
        <View style={styles.modalShade}>
          <View style={styles.commentSheet}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>IGPAT Comments</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close comments"
                onPress={() => setCommentOpen(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#253831" />
              </Pressable>
            </View>
            <ScrollView style={styles.commentList} keyboardShouldPersistTaps="handled">
              {commentsBusy && !comments.length ? <ActivityIndicator color="#008657" /> : null}
              {comments.map(x => (
                <View key={x.id} style={[styles.comment, x.parent_id ? styles.reply : null]}>
                  <Text style={styles.commentName}>{x.commenter_name || 'BUKLOD member'}</Text>
                  <Text style={styles.commentBody}>{x.body || ''}</Text>
                  <Pressable onPress={() => setReplyId(x.id)}>
                    <Text style={styles.replyText}>Reply</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            {replyId ? (
              <Pressable onPress={() => setReplyId(null)}>
                <Text style={styles.replyText}>Replying to comment · Cancel</Text>
              </Pressable>
            ) : null}
            <View style={styles.commentComposer}>
              <TextInput
                style={styles.commentInput} value={commentText}
                onChangeText={setCommentText} placeholder="Write a comment…"
                multiline maxLength={2000}
              />
              <Pressable disabled={commentsBusy || !commentText.trim()}
                onPress={() => void submitComment()} style={styles.sendButton}>
                <MaterialCommunityIcons name="send" size={21}
                  color={commentsBusy || !commentText.trim() ? '#A3B9AF' : '#008657'} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#DCE9E1', borderWidth: 1, borderRadius: 15,
    marginHorizontal: 0, marginVertical: 8, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 7 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontWeight: '900', fontSize: 16, color: '#13291C' },
  subtitle: { color: '#648071', fontSize: 10, fontWeight: '600' },
  headingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  upload: { backgroundColor: '#008657', paddingHorizontal: 9, paddingVertical: 7,
    borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 2 },
  uploadText: { fontWeight: '800', color: '#FFFFFF', fontSize: 11 },
  refresh: { padding: 4 },
  modeRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 16, paddingBottom: 8 },
  mode: { paddingVertical: 3 },
  selectedMode: { borderBottomWidth: 2, borderColor: '#008657' },
  modeText: { fontSize: 11, fontWeight: '700', color: '#7C9187' },
  selectedModeText: { color: '#008657' },
  stage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#101B18',
    justifyContent: 'center', overflow: 'hidden' },
  videoInner: { flex: 1, width: '100%', backgroundColor: '#101B18' },
  leftGutter: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '10%',
    backgroundColor: 'rgba(255,255,255,0.06)' },
  rightGutter: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '10%',
    backgroundColor: 'rgba(255,255,255,0.06)' },
  pauseCue: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  muteButton: { position: 'absolute', right: 8, top: 8, padding: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  placeholderText: { color: '#FFFFFF', fontSize: 11 },
  stageCaption: { position: 'absolute', left: 9, right: 9, bottom: 7, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center' },
  videoAuthor: { fontSize: 11, color: '#FFFFFF', fontWeight: '800', maxWidth: '75%',
    textShadowColor: '#000000', textShadowRadius: 6 },
  counter: { color: '#FFFFFF', fontSize: 10, fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 3, borderRadius: 4 },
  bodyText: { color: '#253831', paddingHorizontal: 12, paddingTop: 8, fontSize: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7,
    paddingVertical: 9, gap: 5 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 5 },
  actionText: { color: '#40574C', fontSize: 11, fontWeight: '700' },
  follow: { marginLeft: 'auto', paddingHorizontal: 6, paddingVertical: 5 },
  followText: { color: '#008657', fontSize: 11, fontWeight: '800' },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  commentSheet: { maxHeight: '80%', minHeight: '48%', backgroundColor: '#FFFFFF',
    padding: 15, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12 },
  commentTitle: { fontWeight: '900', fontSize: 17, color: '#13291C' },
  commentList: { flexGrow: 0, flex: 1 },
  comment: { borderBottomWidth: 1, borderBottomColor: '#EAF0EC', paddingVertical: 10 },
  reply: { paddingLeft: 20 },
  commentName: { fontWeight: '800', fontSize: 12, color: '#13291C' },
  commentBody: { fontSize: 13, color: '#253831', marginTop: 3 },
  replyText: { color: '#008657', fontWeight: '700', fontSize: 11, paddingVertical: 4 },
  commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 7 },
  commentInput: { flex: 1, borderColor: '#CBDAD1', borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 10, minHeight: 42, maxHeight: 100, color: '#13291C' },
  sendButton: { padding: 8 },
});
