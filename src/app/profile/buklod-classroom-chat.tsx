import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';

type Context = { role: 'FACULTY' | 'STUDENT'; allow_student_chat: boolean };
type Thread = { id: string; name: string; thread_type: string };
type Message = { id: string; sender_user_id: string; body: string; created_at: string; edited_at: string | null };
type NameMap = Record<string, string>;

export default function BuklodClassroomChatScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const classroomId = String(params.id ?? '');
  const classroomName = String(params.name ?? 'Classroom');

  const [context, setContext] = useState<Context | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [names, setNames] = useState<NameMap>({});
  const [text, setText] = useState('');
  const [myId, setMyId] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!classroomId) return;
    const [{ data: auth }, contextRes, threadRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc('buklod_classroom_context_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_classroom_threads')
        .select('id,name,thread_type')
        .eq('classroom_id', classroomId)
        .eq('thread_type', 'GENERAL')
        .is('archived_at', null)
        .maybeSingle(),
    ]);
    if (contextRes.error) return Alert.alert('Class Messages', contextRes.error.message);
    if (threadRes.error) return Alert.alert('Class Messages', threadRes.error.message);
    setContext(contextRes.data as Context);
    setThread((threadRes.data ?? null) as Thread | null);
    setMyId(auth.user?.id ?? '');

    const threadId = (threadRes.data as Thread | null)?.id;
    if (!threadId) return;
    const { data, error } = await supabase
      .from('buklod_education_classroom_messages')
      .select('id,sender_user_id,body,created_at,edited_at')
      .eq('classroom_id', classroomId)
      .eq('thread_id', threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(300);
    if (error) return Alert.alert('Class Messages', error.message);
    const rows = (data ?? []) as Message[];
    setMessages(rows);

    const ids = Array.from(new Set(rows.map(row => row.sender_user_id)));
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
  }, [load]);

  useEffect(() => {
    if (!thread?.id) return;
    const channel = supabase
      .channel(`classroom-chat-${thread.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buklod_education_classroom_messages', filter: `thread_id=eq.${thread.id}` }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [thread?.id, load]);

  const canChat = context?.role === 'FACULTY' || context?.allow_student_chat;

  const send = async () => {
    const body = text.trim();
    if (!body || !thread?.id || !myId || sending || !canChat) return;
    setSending(true);
    try {
      const { error } = await supabase.from('buklod_education_classroom_messages').insert({
        classroom_id: classroomId,
        thread_id: thread.id,
        sender_user_id: myId,
        body,
      });
      if (error) throw error;
      setText('');
      await supabase.from('buklod_education_classroom_engagement_events').insert({
        classroom_id: classroomId,
        user_id: myId,
        event_type: 'MESSAGE_SENT',
        source_type: 'CLASS_CHAT',
      });
      await load();
    } catch (error) {
      Alert.alert('Send Message', error instanceof Error ? error.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={23} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{classroomName}</Text>
          <Text style={styles.subtitle}>General class messages</Text>
        </View>
        <MaterialCommunityIcons name="message-text-outline" size={24} color="#fff" />
      </View>

      <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="message-outline" size={32} color="#7c887f" />
            <Text style={styles.emptyTitle}>No class message yet</Text>
            <Text style={styles.emptyText}>Use this room for reminders, clarifications and quick class coordination.</Text>
          </View>
        ) : messages.map(message => {
          const mine = message.sender_user_id === myId;
          return (
            <View key={message.id} style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.otherWrap]}>
              {!mine && <Text style={styles.sender}>{names[message.sender_user_id] || 'BUKLOD Member'}</Text>}
              <View style={[styles.bubble, mine ? styles.mine : styles.other]}>
                <Text style={[styles.body, mine && styles.mineBody]}>{message.body}</Text>
              </View>
              <Text style={styles.time}>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
          );
        })}
      </ScrollView>

      {canChat ? (
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message the class…"
            multiline
            style={styles.input}
          />
          <Pressable disabled={!text.trim() || sending} onPress={send} style={[styles.send, (!text.trim() || sending) && styles.disabled]}>
            <MaterialCommunityIcons name="send" size={20} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.readOnly}><Text style={styles.readOnlyText}>Faculty has set class messages to read-only for students.</Text></View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#edf2ed' },
  header: { backgroundColor: '#174c2b', paddingHorizontal: 16, paddingTop: 43, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontWeight: '900', fontSize: 17 },
  subtitle: { color: '#d6e5d9', fontSize: 11, marginTop: 2 },
  messageList: { flex: 1 },
  messageContent: { padding: 16, paddingBottom: 25 },
  empty: { marginTop: 60, alignItems: 'center', padding: 20 },
  emptyTitle: { color: '#314139', fontWeight: '900', marginTop: 10 },
  emptyText: { color: '#718078', textAlign: 'center', lineHeight: 18, marginTop: 5 },
  bubbleWrap: { marginBottom: 11, maxWidth: '82%' },
  mineWrap: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  otherWrap: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sender: { color: '#617069', fontSize: 10, fontWeight: '800', marginBottom: 3, marginLeft: 6 },
  bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 10 },
  mine: { backgroundColor: '#1f7a3f', borderBottomRightRadius: 5 },
  other: { backgroundColor: '#fff', borderBottomLeftRadius: 5 },
  body: { color: '#35453c', lineHeight: 19 },
  mineBody: { color: '#fff' },
  time: { color: '#8b958e', fontSize: 9, marginTop: 3, marginHorizontal: 5 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#dde5df' },
  input: { flex: 1, maxHeight: 110, backgroundColor: '#f0f4f0', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 9, color: '#26392d' },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1f7a3f', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  readOnly: { padding: 13, backgroundColor: '#fff3dc', alignItems: 'center' },
  readOnlyText: { color: '#7b6044', fontSize: 11, fontWeight: '800' },
});
