import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';

type Context = { role: 'FACULTY' | 'STUDENT'; allow_student_posts: boolean };
type Post = {
  id: string;
  author_user_id: string;
  post_type: string;
  title: string | null;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
};
type Comment = { id: string; post_id: string; author_user_id: string; body: string; created_at: string };

type NameMap = Record<string, string>;

const FACULTY_TYPES = ['ANNOUNCEMENT', 'DISCUSSION', 'QUESTION', 'RECITATION', 'PRESENTATION'];
const STUDENT_TYPES = ['DISCUSSION', 'QUESTION', 'ACTIVITY_UPDATE'];

function timeLabel(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function BuklodClassroomDiscussScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const classroomId = String(params.id ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [context, setContext] = useState<Context | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [names, setNames] = useState<NameMap>({});
  const [type, setType] = useState('DISCUSSION');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const isFaculty = context?.role === 'FACULTY';
  const allowedTypes = useMemo(() => (isFaculty ? FACULTY_TYPES : STUDENT_TYPES), [isFaculty]);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [contextRes, postRes, commentRes] = await Promise.all([
      supabase.rpc('buklod_classroom_context_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_classroom_posts')
        .select('id,author_user_id,post_type,title,body,is_pinned,is_locked,created_at')
        .eq('classroom_id', classroomId)
        .is('deleted_at', null)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('buklod_education_classroom_comments')
        .select('id,post_id,author_user_id,body,created_at')
        .eq('classroom_id', classroomId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(500),
    ]);
    if (contextRes.error) return Alert.alert('Discussions', contextRes.error.message);
    if (postRes.error) return Alert.alert('Discussions', postRes.error.message);
    if (commentRes.error) return Alert.alert('Comments', commentRes.error.message);

    const postRows = (postRes.data ?? []) as Post[];
    const commentRows = (commentRes.data ?? []) as Comment[];
    setContext(contextRes.data as Context);
    setPosts(postRows);
    setComments(commentRows);

    const ids = Array.from(new Set([...postRows.map(x => x.author_user_id), ...commentRows.map(x => x.author_user_id)]));
    if (ids.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('id,full_name,first_name,surname,username').in('id', ids);
      const map: NameMap = {};
      for (const row of profileRows ?? []) {
        const r = row as any;
        map[r.id] = r.full_name || [r.first_name, r.surname].filter(Boolean).join(' ') || r.username || 'BUKLOD Member';
      }
      setNames(map);
    }
  }, [classroomId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`classroom-discuss-${classroomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buklod_education_classroom_posts', filter: `classroom_id=eq.${classroomId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buklod_education_classroom_comments', filter: `classroom_id=eq.${classroomId}` }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [classroomId, load]);

  useEffect(() => {
    if (!allowedTypes.includes(type)) setType(allowedTypes[0] ?? 'DISCUSSION');
  }, [allowedTypes, type]);

  const createPost = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Please sign in again.');
      const { error } = await supabase.from('buklod_education_classroom_posts').insert({
        classroom_id: classroomId,
        author_user_id: uid,
        post_type: type,
        title: title.trim() || null,
        body: body.trim(),
      });
      if (error) throw error;
      setTitle('');
      setBody('');
      await supabase.from('buklod_education_classroom_engagement_events').insert({ classroom_id: classroomId, user_id: uid, event_type: 'POST_CREATED', source_type: 'DISCUSSION' });
      await load();
    } catch (error) {
      Alert.alert('Post', error instanceof Error ? error.message : 'Could not publish the post.');
    } finally {
      setBusy(false);
    }
  };

  const addComment = async (post: Post) => {
    const text = (commentText[post.id] ?? '').trim();
    if (!text || post.is_locked) return;
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const { error } = await supabase.from('buklod_education_classroom_comments').insert({ classroom_id: classroomId, post_id: post.id, author_user_id: uid, body: text });
    if (error) return Alert.alert('Comment', error.message);
    setCommentText(prev => ({ ...prev, [post.id]: '' }));
    await supabase.from('buklod_education_classroom_engagement_events').insert({ classroom_id: classroomId, user_id: uid, event_type: 'COMMENT_CREATED', source_type: 'DISCUSSION', source_id: post.id });
    await load();
  };

  const togglePinned = async (post: Post) => {
    if (!isFaculty) return;
    const { error } = await supabase.from('buklod_education_classroom_posts').update({ is_pinned: !post.is_pinned }).eq('id', post.id);
    if (error) Alert.alert('Pin Post', error.message);
    else await load();
  };

  const toggleLocked = async (post: Post) => {
    if (!isFaculty) return;
    const { error } = await supabase.from('buklod_education_classroom_posts').update({ is_locked: !post.is_locked }).eq('id', post.id);
    if (error) Alert.alert('Lock Post', error.message);
    else await load();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Pressable style={styles.back} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
        <Text style={styles.backText}>{classroomName}</Text>
      </Pressable>
      <Text style={styles.eyebrow}>CLASS DISCUSSIONS</Text>
      <Text style={styles.title}>Classroom Feed</Text>
      <Text style={styles.subtitle}>Continue the class even after the live session ends.</Text>

      {(isFaculty || context?.allow_student_posts) && (
        <View style={styles.composer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {allowedTypes.map(item => (
              <Pressable key={item} style={[styles.typePill, type === item && styles.typeSelected]} onPress={() => setType(item)}>
                <Text style={[styles.typeText, type === item && styles.typeTextSelected]}>{item.replace('_', ' ')}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput value={title} onChangeText={setTitle} placeholder="Title (optional)" style={styles.input} />
          <TextInput value={body} onChangeText={setBody} placeholder="Share an announcement, question or discussion…" multiline style={[styles.input, styles.bodyInput]} />
          <Pressable disabled={!body.trim() || busy} style={[styles.primary, (!body.trim() || busy) && styles.disabled]} onPress={createPost}>
            <Text style={styles.primaryText}>{busy ? 'Posting…' : 'Post to Class'}</Text>
          </Pressable>
        </View>
      )}

      {posts.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No classroom discussion yet.</Text></View>
      ) : posts.map(post => {
        const postComments = comments.filter(comment => comment.post_id === post.id);
        return (
          <View key={post.id} style={[styles.post, post.is_pinned && styles.pinned]}>
            <View style={styles.postTop}>
              <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{post.post_type}</Text></View>
              {post.is_pinned && <MaterialCommunityIcons name="pin" size={17} color="#1f7a3f" />}
              <View style={{ flex: 1 }} />
              {isFaculty && (
                <>
                  <Pressable onPress={() => togglePinned(post)}><MaterialCommunityIcons name={post.is_pinned ? 'pin-off-outline' : 'pin-outline'} size={19} color="#657169" /></Pressable>
                  <Pressable onPress={() => toggleLocked(post)}><MaterialCommunityIcons name={post.is_locked ? 'lock-open-outline' : 'lock-outline'} size={19} color="#657169" /></Pressable>
                </>
              )}
            </View>
            {!!post.title && <Text style={styles.postTitle}>{post.title}</Text>}
            <Text style={styles.postBody}>{post.body}</Text>
            <Text style={styles.postMeta}>{names[post.author_user_id] || 'BUKLOD Member'} • {timeLabel(post.created_at)}</Text>

            {postComments.map(comment => (
              <View key={comment.id} style={styles.comment}>
                <Text style={styles.commentName}>{names[comment.author_user_id] || 'BUKLOD Member'}</Text>
                <Text style={styles.commentBody}>{comment.body}</Text>
              </View>
            ))}

            {!post.is_locked ? (
              <View style={styles.commentComposer}>
                <TextInput
                  value={commentText[post.id] ?? ''}
                  onChangeText={text => setCommentText(prev => ({ ...prev, [post.id]: text }))}
                  placeholder="Reply to this discussion…"
                  style={styles.commentInput}
                />
                <Pressable style={styles.send} onPress={() => addComment(post)}>
                  <MaterialCommunityIcons name="send" size={18} color="#fff" />
                </Pressable>
              </View>
            ) : <Text style={styles.lockedText}>Discussion locked by faculty.</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f6f2' },
  content: { padding: 20, paddingTop: 43, paddingBottom: 80 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 15 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: '#17311f', fontSize: 28, fontWeight: '900' },
  subtitle: { color: '#6d7970', marginTop: 4, marginBottom: 15 },
  composer: { backgroundColor: '#fff', borderRadius: 19, padding: 14, marginBottom: 16 },
  typeRow: { gap: 6, paddingBottom: 9 },
  typePill: { backgroundColor: '#eff3ef', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  typeSelected: { backgroundColor: '#1f7a3f' },
  typeText: { color: '#5b685f', fontSize: 9, fontWeight: '900' },
  typeTextSelected: { color: '#fff' },
  input: { backgroundColor: '#f4f6f4', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 8, color: '#24362b' },
  bodyInput: { minHeight: 86, textAlignVertical: 'top' },
  primary: { backgroundColor: '#1f7a3f', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.45 },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  emptyText: { color: '#718077' },
  post: { backgroundColor: '#fff', borderRadius: 18, padding: 15, marginBottom: 11 },
  pinned: { borderWidth: 1.5, borderColor: '#a9d1b1' },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeBadge: { backgroundColor: '#eaf3eb', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  typeBadgeText: { color: '#1f7a3f', fontSize: 8, fontWeight: '900' },
  postTitle: { color: '#26392d', fontWeight: '900', fontSize: 16, marginTop: 10 },
  postBody: { color: '#3e4b42', lineHeight: 20, marginTop: 7 },
  postMeta: { color: '#88938b', fontSize: 10, marginTop: 9 },
  comment: { backgroundColor: '#f3f6f3', borderRadius: 11, padding: 10, marginTop: 8 },
  commentName: { color: '#31503a', fontWeight: '900', fontSize: 11 },
  commentBody: { color: '#526057', marginTop: 2, lineHeight: 17 },
  commentComposer: { flexDirection: 'row', gap: 7, marginTop: 9 },
  commentInput: { flex: 1, backgroundColor: '#f3f6f3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 9, color: '#25372b' },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#1f7a3f', alignItems: 'center', justifyContent: 'center' },
  lockedText: { color: '#8c6f52', fontSize: 10, fontWeight: '800', marginTop: 10 },
});
