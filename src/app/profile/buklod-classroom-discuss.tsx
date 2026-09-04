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
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';

import { ClassroomDrawer } from '@/components/classroom/ClassroomDrawer';
import { useClassroomTheme } from '@/hooks/useClassroomTheme';
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
type Comment = {
  id: string;
  post_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
};
type ReactionKey = 'LIKE' | 'LOVE' | 'APPLAUSE' | 'INSIGHTFUL' | 'AMEN' | 'QUESTION';
type ReactionRow = {
  target_type: 'POST' | 'COMMENT';
  target_id: string;
  reaction_key: ReactionKey;
  reaction_count: number;
  user_reacted: boolean;
};
type NameMap = Record<string, string>;

const FACULTY_TYPES = ['ANNOUNCEMENT', 'DISCUSSION', 'QUESTION', 'RECITATION', 'PRESENTATION'];
const STUDENT_TYPES = ['DISCUSSION', 'QUESTION', 'ACTIVITY_UPDATE'];
const REACTIONS: { key: ReactionKey; emoji: string; label: string }[] = [
  { key: 'LIKE', emoji: '👍', label: 'Like' },
  { key: 'LOVE', emoji: '♥', label: 'Love' },
  { key: 'APPLAUSE', emoji: '👏', label: 'Applause' },
  { key: 'INSIGHTFUL', emoji: '💡', label: 'Insightful' },
  { key: 'AMEN', emoji: '🙏', label: 'Amen' },
  { key: 'QUESTION', emoji: '🤔', label: 'Question' },
];

function timeLabel(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'B';
}

export default function BuklodClassroomDiscussScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme, themeId, setThemeId } = useClassroomTheme();

  const [context, setContext] = useState<Context | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [names, setNames] = useState<NameMap>({});
  const [type, setType] = useState('DISCUSSION');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reactionShelf, setReactionShelf] = useState<string | null>(null);

  const isFaculty = context?.role === 'FACULTY';
  const role = context?.role ?? 'STUDENT';
  const allowedTypes = useMemo(() => (isFaculty ? FACULTY_TYPES : STUDENT_TYPES), [isFaculty]);

  const loadReactionSummary = useCallback(async () => {
    if (!classroomId) return;
    const { data, error } = await supabase.rpc('buklod_classroom_reaction_summary_v1', {
      p_classroom_id: classroomId,
    });
    if (!error) setReactions((data ?? []) as ReactionRow[]);
  }, [classroomId]);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [contextRes, postRes, commentRes, reactionRes] = await Promise.all([
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
      supabase.rpc('buklod_classroom_reaction_summary_v1', { p_classroom_id: classroomId }),
    ]);
    if (contextRes.error) return Alert.alert('Discussions', contextRes.error.message);
    if (postRes.error) return Alert.alert('Discussions', postRes.error.message);
    if (commentRes.error) return Alert.alert('Comments', commentRes.error.message);

    const postRows = (postRes.data ?? []) as Post[];
    const commentRows = (commentRes.data ?? []) as Comment[];
    setContext(contextRes.data as Context);
    setPosts(postRows);
    setComments(commentRows);
    if (!reactionRes.error) setReactions((reactionRes.data ?? []) as ReactionRow[]);

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

  const react = async (targetType: 'POST' | 'COMMENT', targetId: string, reactionKey: ReactionKey) => {
    const { error } = await supabase.rpc('buklod_classroom_toggle_reaction_v1', {
      p_classroom_id: classroomId,
      p_target_type: targetType,
      p_target_id: targetId,
      p_reaction_key: reactionKey,
    });
    if (error) return Alert.alert('Reaction', error.message);
    setReactionShelf(null);
    await loadReactionSummary();
  };

  const summaryFor = (targetType: 'POST' | 'COMMENT', targetId: string) =>
    reactions.filter(row => row.target_type === targetType && row.target_id === targetId);

  const renderReactions = (targetType: 'POST' | 'COMMENT', targetId: string, compact = false) => {
    const rows = summaryFor(targetType, targetId);
    const shelfKey = `${targetType}:${targetId}`;
    const open = reactionShelf === shelfKey;
    return (
      <View style={compact ? styles.reactionCompactWrap : styles.reactionWrap}>
        <View style={styles.reactionSummaryRow}>
          {rows.map(row => {
            const def = REACTIONS.find(item => item.key === row.reaction_key)!;
            return (
              <Pressable
                key={row.reaction_key}
                onPress={() => react(targetType, targetId, row.reaction_key)}
                style={[
                  styles.reactionCount,
                  { backgroundColor: row.user_reacted ? `${theme.accent}2B` : theme.chip, borderColor: row.user_reacted ? theme.accent : theme.border },
                ]}
              >
                <Text style={styles.reactionEmoji}>{def.emoji}</Text>
                <Text style={[styles.reactionNumber, { color: theme.ink }]}>{Number(row.reaction_count)}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setReactionShelf(open ? null : shelfKey)}
            style={[styles.reactButton, { backgroundColor: theme.chip }]}
          >
            <MaterialCommunityIcons name="emoticon-outline" size={15} color={theme.ink} />
            {!compact && <Text style={[styles.reactButtonText, { color: theme.ink }]}>React</Text>}
          </Pressable>
        </View>
        {open && (
          <View style={[styles.reactionShelf, { backgroundColor: theme.drawer, borderColor: theme.border }]}>
            {REACTIONS.map(item => {
              const mine = rows.some(row => row.reaction_key === item.key && row.user_reacted);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => react(targetType, targetId, item.key)}
                  style={[styles.reactionOption, mine && { backgroundColor: `${theme.accent}33` }]}
                >
                  <Text style={styles.reactionOptionEmoji}>{item.emoji}</Text>
                  {!compact && <Text style={[styles.reactionOptionLabel, { color: theme.drawerInk }]}>{item.label}</Text>}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl tintColor={theme.primary} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => setDrawerOpen(true)} style={[styles.menuButton, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="menu" size={22} color={theme.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.topKicker, { color: theme.muted }]}>CLASSROOM FEED</Text>
            <Text numberOfLines={1} style={[styles.topName, { color: theme.ink }]}>{classroomName}</Text>
          </View>
          <Pressable onPress={() => router.back()} style={[styles.backButton, { borderColor: theme.border }]}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={theme.ink} />
          </Pressable>
        </View>

        <LinearGradient colors={[theme.heroStart, theme.heroEnd]} style={styles.headerCard}>
          <View style={[styles.headerMark, { backgroundColor: theme.accent }]}>
            <MaterialCommunityIcons name="forum-outline" size={24} color={theme.drawer} />
          </View>
          <Text style={styles.headerKicker}>THE CLASS DOESN'T END AT DISMISSAL</Text>
          <Text style={styles.headerTitle}>Classroom Feed</Text>
          <Text style={styles.headerText}>Announcements, questions, recitation threads and quick reactions in one running class conversation.</Text>
        </LinearGradient>

        {(isFaculty || context?.allow_student_posts) && (
          <View style={[styles.composer, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <View style={styles.composerHeading}>
              <View>
                <Text style={[styles.composerKicker, { color: theme.secondary }]}>NEW NOTE</Text>
                <Text style={[styles.composerTitle, { color: theme.ink }]}>Put something on the class board</Text>
              </View>
              <View style={[styles.roleStamp, { borderColor: theme.secondary }]}>
                <Text style={[styles.roleStampText, { color: theme.secondary }]}>{role}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {allowedTypes.map(item => (
                <Pressable key={item} style={[styles.typePill, { backgroundColor: type === item ? theme.primary : theme.chip }]} onPress={() => setType(item)}>
                  <Text style={[styles.typeText, { color: type === item ? '#fff' : theme.ink }]}>{item.replace('_', ' ')}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput value={title} onChangeText={setTitle} placeholder="Heading (optional)" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.ink, backgroundColor: theme.background, borderColor: theme.border }]} />
            <TextInput value={body} onChangeText={setBody} placeholder="Write it like you would on the classroom board…" placeholderTextColor={theme.muted} multiline style={[styles.input, styles.bodyInput, { color: theme.ink, backgroundColor: theme.background, borderColor: theme.border }]} />
            <Pressable disabled={!body.trim() || busy} style={[styles.publishButton, { backgroundColor: theme.secondary }, (!body.trim() || busy) && styles.disabled]} onPress={createPost}>
              <Text style={styles.publishText}>{busy ? 'Posting…' : 'Post to the class board'}</Text>
              <MaterialCommunityIcons name="arrow-up-right" size={18} color="#fff" />
            </Pressable>
          </View>
        )}

        <View style={styles.feedHeading}>
          <Text style={[styles.feedKicker, { color: theme.muted }]}>RECENT BOARD NOTES</Text>
          <Text style={[styles.feedCount, { color: theme.ink }]}>{posts.length}</Text>
        </View>

        {posts.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surfaceRaised, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="note-outline" size={30} color={theme.muted} />
            <Text style={[styles.emptyText, { color: theme.muted }]}>The class board is still empty.</Text>
          </View>
        ) : posts.map((post, index) => {
          const postComments = comments.filter(comment => comment.post_id === post.id);
          const authorName = names[post.author_user_id] || 'BUKLOD Member';
          const edge = index % 2 === 0 ? theme.secondary : theme.primary;
          return (
            <View key={post.id} style={[styles.post, { backgroundColor: theme.surfaceRaised, borderColor: post.is_pinned ? theme.accent : theme.border }]}>
              <View style={[styles.postEdge, { backgroundColor: post.is_pinned ? theme.accent : edge }]} />
              <View style={styles.postTop}>
                <View style={[styles.avatar, { backgroundColor: `${edge}22` }]}>
                  <Text style={[styles.avatarText, { color: edge }]}>{initials(authorName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.authorName, { color: theme.ink }]}>{authorName}</Text>
                  <Text style={[styles.postMeta, { color: theme.muted }]}>{timeLabel(post.created_at)}</Text>
                </View>
                <View style={[styles.typeBadge, { backgroundColor: theme.chip }]}>
                  <Text style={[styles.typeBadgeText, { color: theme.ink }]}>{post.post_type.replace('_', ' ')}</Text>
                </View>
              </View>

              {post.is_pinned && (
                <View style={[styles.pinNote, { backgroundColor: `${theme.accent}24` }]}>
                  <MaterialCommunityIcons name="pin" size={13} color={theme.accent} />
                  <Text style={[styles.pinText, { color: theme.ink }]}>Pinned by faculty</Text>
                </View>
              )}

              {!!post.title && <Text style={[styles.postTitle, { color: theme.ink }]}>{post.title}</Text>}
              <Text style={[styles.postBody, { color: theme.ink }]}>{post.body}</Text>

              <View style={styles.postActions}>
                {renderReactions('POST', post.id)}
                {isFaculty && (
                  <View style={styles.facultyActions}>
                    <Pressable onPress={() => togglePinned(post)} style={[styles.iconAction, { backgroundColor: theme.chip }]}>
                      <MaterialCommunityIcons name={post.is_pinned ? 'pin-off-outline' : 'pin-outline'} size={16} color={theme.ink} />
                    </Pressable>
                    <Pressable onPress={() => toggleLocked(post)} style={[styles.iconAction, { backgroundColor: theme.chip }]}>
                      <MaterialCommunityIcons name={post.is_locked ? 'lock-open-outline' : 'lock-outline'} size={16} color={theme.ink} />
                    </Pressable>
                  </View>
                )}
              </View>

              {postComments.length > 0 && (
                <View style={[styles.commentThread, { borderTopColor: theme.border }]}>
                  {postComments.map(comment => {
                    const commentAuthor = names[comment.author_user_id] || 'BUKLOD Member';
                    return (
                      <View key={comment.id} style={styles.commentLine}>
                        <View style={[styles.commentAvatar, { backgroundColor: theme.chip }]}>
                          <Text style={[styles.commentAvatarText, { color: theme.ink }]}>{initials(commentAuthor)}</Text>
                        </View>
                        <View style={[styles.commentBubble, { backgroundColor: theme.background }]}>
                          <Text style={[styles.commentName, { color: theme.ink }]}>{commentAuthor}</Text>
                          <Text style={[styles.commentBody, { color: theme.ink }]}>{comment.body}</Text>
                          <View style={styles.commentBottom}>
                            <Text style={[styles.commentTime, { color: theme.muted }]}>{timeLabel(comment.created_at)}</Text>
                            {renderReactions('COMMENT', comment.id, true)}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {!post.is_locked ? (
                <View style={styles.commentComposer}>
                  <TextInput
                    value={commentText[post.id] ?? ''}
                    onChangeText={text => setCommentText(prev => ({ ...prev, [post.id]: text }))}
                    placeholder="Add to the discussion…"
                    placeholderTextColor={theme.muted}
                    style={[styles.commentInput, { backgroundColor: theme.background, color: theme.ink, borderColor: theme.border }]}
                  />
                  <Pressable style={[styles.send, { backgroundColor: theme.primary }]} onPress={() => addComment(post)}>
                    <MaterialCommunityIcons name="arrow-up" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={[styles.locked, { backgroundColor: theme.chip }]}>
                  <MaterialCommunityIcons name="lock-outline" size={14} color={theme.muted} />
                  <Text style={[styles.lockedText, { color: theme.muted }]}>Faculty closed replies for this note.</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <ClassroomDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        classroomId={classroomId}
        classroomName={classroomName}
        role={role}
        theme={theme}
        themeId={themeId}
        onThemeChange={setThemeId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 42, paddingBottom: 80 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  menuButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  topKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  topName: { fontSize: 14, fontWeight: '900', marginTop: 1 },
  backButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: { borderRadius: 22, padding: 17, marginBottom: 12 },
  headerMark: { width: 42, height: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] },
  headerKicker: { color: 'rgba(255,255,255,0.65)', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginTop: 14 },
  headerTitle: { color: '#fff', fontSize: 25, fontWeight: '900', marginTop: 2 },
  headerText: { color: 'rgba(255,255,255,0.76)', fontSize: 10, lineHeight: 16, marginTop: 6 },
  composer: { borderRadius: 18, borderWidth: 1, padding: 13, marginBottom: 16 },
  composerHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  composerKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  composerTitle: { fontSize: 15, fontWeight: '900', marginTop: 2 },
  roleStamp: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, transform: [{ rotate: '2deg' }] },
  roleStampText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  typeRow: { gap: 6, paddingVertical: 10 },
  typePill: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  typeText: { fontSize: 8, fontWeight: '900' },
  input: { borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10, marginBottom: 7 },
  bodyInput: { minHeight: 82, textAlignVertical: 'top' },
  publishButton: { minHeight: 42, borderRadius: 11, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  publishText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  disabled: { opacity: 0.42 },
  feedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  feedKicker: { fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  feedCount: { fontSize: 18, fontWeight: '900' },
  empty: { borderRadius: 17, borderWidth: 1, padding: 20, alignItems: 'center', gap: 7 },
  emptyText: { fontSize: 11 },
  post: { position: 'relative', overflow: 'hidden', borderRadius: 18, borderWidth: 1, padding: 14, paddingLeft: 17, marginBottom: 11 },
  postEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '900', fontSize: 11 },
  authorName: { fontWeight: '900', fontSize: 12 },
  postMeta: { fontSize: 8, marginTop: 1 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 },
  typeBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  pinNote: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, marginTop: 9 },
  pinText: { fontSize: 8, fontWeight: '900' },
  postTitle: { fontSize: 17, fontWeight: '900', lineHeight: 21, marginTop: 11 },
  postBody: { fontSize: 12, lineHeight: 19, marginTop: 6 },
  postActions: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  facultyActions: { flexDirection: 'row', gap: 5 },
  iconAction: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  reactionWrap: { flex: 1 },
  reactionCompactWrap: { flexShrink: 1 },
  reactionSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  reactionCount: { minHeight: 29, borderRadius: 9, borderWidth: 1, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 3 },
  reactionEmoji: { fontSize: 13 },
  reactionNumber: { fontSize: 9, fontWeight: '900' },
  reactButton: { minHeight: 29, borderRadius: 9, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 4 },
  reactButtonText: { fontSize: 9, fontWeight: '900' },
  reactionShelf: { alignSelf: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 3, borderWidth: 1, borderRadius: 12, padding: 5, marginTop: 5 },
  reactionOption: { minWidth: 34, minHeight: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  reactionOptionEmoji: { fontSize: 17 },
  reactionOptionLabel: { fontSize: 7, fontWeight: '800', marginTop: 1 },
  commentThread: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 8 },
  commentLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 7 },
  commentAvatar: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { fontSize: 8, fontWeight: '900' },
  commentBubble: { flex: 1, borderRadius: 12, padding: 9 },
  commentName: { fontSize: 10, fontWeight: '900' },
  commentBody: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  commentBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginTop: 6 },
  commentTime: { fontSize: 7, flex: 1 },
  commentComposer: { flexDirection: 'row', gap: 7, marginTop: 10 },
  commentInput: { flex: 1, borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 9, fontSize: 10 },
  send: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, marginTop: 10 },
  lockedText: { fontSize: 8, fontWeight: '800' },
});
