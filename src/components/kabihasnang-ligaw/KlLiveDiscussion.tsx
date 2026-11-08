import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { klCopy, klLiveReadersCountLabel } from '@/lib/kabihasnang-ligaw/copy';
import {
  addKlComment,
  formatReaderStamp,
  listKlComments,
  listKlReaders,
  pingKlReading,
  type KlEpisodeComment,
  type KlReaderPresence,
} from '@/lib/kabihasnang-ligaw/readerSocial';
import { useAuth } from '@/providers/AuthProvider';

type Props = {
  episodeId: string;
  live: boolean;
};

export default function KlLiveDiscussion({ episodeId, live }: Props) {
  const { user, profile } = useAuth();
  const [readers, setReaders] = useState<KlReaderPresence[]>([]);
  const [readerCount, setReaderCount] = useState(0);
  const [comments, setComments] = useState<KlEpisodeComment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!live || !episodeId) return;
    if (user?.id) {
      await pingKlReading(episodeId);
    }
    const [presence, thread] = await Promise.all([
      listKlReaders(episodeId),
      listKlComments(episodeId),
    ]);
    let nextReaders = presence.readers;
    let nextCount = presence.count;
    if (user?.id && nextReaders.every((reader) => !reader.isSelf)) {
      const selfName = profile?.full_name?.trim() || klCopy.youLabel;
      nextReaders = [
        {
          userId: user.id,
          displayName: selfName,
          lastSeenAt: new Date().toISOString(),
          isSelf: true,
        },
        ...nextReaders,
      ];
      nextCount = Math.max(nextCount, nextReaders.length);
    }
    setReaders(nextReaders.slice(0, 12));
    setReaderCount(nextCount);
    setComments(thread);
    setLoading(false);
  }, [episodeId, live, profile?.full_name, user?.id]);

  useEffect(() => {
    if (!live) return;
    setLoading(true);
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 20000);
    return () => clearInterval(timer);
  }, [live, refresh]);

  if (!live) return null;

  const send = async () => {
    if (!user?.id) {
      setNotice(klCopy.commentNeedSignIn);
      return;
    }
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setNotice(null);
    const result = await addKlComment(episodeId, text);
    setBusy(false);
    if (!result.ok || !result.comment) {
      setNotice(result.error && result.error !== 'server' ? result.error : klCopy.commentFailed);
      return;
    }
    setDraft('');
    setComments((current) => [result.comment as KlEpisodeComment, ...current]);
  };

  return (
    <View style={styles.wrap} accessibilityLabel="Reading reactions and reflections">
      <View style={styles.card}>
        <Text style={styles.title}>{klCopy.liveReaders}</Text>
        {loading ? (
          <ActivityIndicator color="#e5c891" />
        ) : (
          <>
            <Text style={styles.meta}>
              {readerCount > 0 ? klLiveReadersCountLabel(readerCount) : klCopy.liveReadersEmpty}
            </Text>
            {readers.length > 0 ? (
              <View style={styles.names}>
                {readers.map((reader) => (
                  <Text key={`${reader.userId}-${reader.lastSeenAt}`} style={styles.nameChip}>
                    {reader.isSelf ? klCopy.youLabel : reader.displayName}
                    {reader.lastSeenAt ? ` · ${formatReaderStamp(reader.lastSeenAt)}` : ''}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{klCopy.commentsTitle}</Text>
        <Text style={styles.meta}>{klCopy.commentsHint}</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={klCopy.commentPlaceholder}
          placeholderTextColor="#8d8374"
          multiline
          maxLength={500}
          style={styles.input}
          textAlignVertical="top"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={klCopy.commentSend}
          disabled={busy || draft.trim().length < 12}
          onPress={() => void send()}
          style={[styles.send, (busy || draft.trim().length < 12) && styles.sendOff]}
        >
          <Text style={styles.sendText}>{klCopy.commentSend}</Text>
        </Pressable>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {comments.length === 0 ? (
          <Text style={styles.meta}>{klCopy.commentsEmpty}</Text>
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <Text style={styles.commentName}>
                {comment.isSelf ? klCopy.youLabel : comment.displayName}
                {comment.createdAt ? ` · ${formatReaderStamp(comment.createdAt)}` : ''}
              </Text>
              <Text style={styles.commentBody}>{comment.body}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 8 },
  card: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#31443d',
    backgroundColor: '#142226',
  },
  title: { color: '#f6dfb0', fontSize: 16, fontWeight: '800' },
  meta: { color: '#d6c8ad', fontSize: 13, lineHeight: 20 },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nameChip: {
    color: '#f1ece3',
    fontSize: 13,
    lineHeight: 18,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#78613c',
    backgroundColor: '#1a2c2a',
    overflow: 'hidden',
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#78613c',
    borderRadius: 12,
    padding: 10,
    color: '#f1ece3',
    backgroundColor: '#101a20',
  },
  send: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5c891',
  },
  sendOff: { opacity: 0.4 },
  sendText: { color: '#e5c891', fontSize: 14, fontWeight: '700' },
  notice: { color: '#f1d39b', fontSize: 13, lineHeight: 18 },
  comment: {
    gap: 2,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#31443d',
  },
  commentName: { color: '#e5c891', fontSize: 12, fontWeight: '700' },
  commentBody: { color: '#f1ece3', fontSize: 15, lineHeight: 22 },
});
