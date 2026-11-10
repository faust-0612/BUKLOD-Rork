import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase, type BuklodPttConnection } from '@/ptt/buklodPttCore';
import {
  hasBuklodPttCaptionConsent,
  listBuklodPttMessages,
  saveBuklodPttCaptionConsent,
  sendBuklodPttText,
  setBuklodPttCaptions,
  type BuklodPttMessage,
} from '@/ptt/buklodPttConversation';

type Props = { scopeId: string; channel: number; connection: BuklodPttConnection | null };

function mergeMessages(a: BuklodPttMessage[], b: BuklodPttMessage[]) {
  const unique = new Map<string, BuklodPttMessage>();
  [...a, ...b].forEach(item => unique.set(item.id, item));
  return [...unique.values()].sort((x, y) =>
    x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id));
}

export default function BuklodPttConversation({ scopeId, channel, connection }: Props) {
  const [messages, setMessages] = useState<BuklodPttMessage[]>([]);
  const [viewerId, setViewerId] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [captionsActive, setCaptionsActive] = useState(false);
  const [captionWorking, setCaptionWorking] = useState(false);
  const [consented, setConsented] = useState(false);
  const [language, setLanguage] = useState<'tl' | 'en'>('tl');
  const scrollRef = useRef<ScrollView>(null);
  const loadedKey = useRef('');

  const refresh = useCallback(async () => {
    if (!scopeId) return;
    const key = `${scopeId}:${channel}`;
    const rows = await listBuklodPttMessages(scopeId, channel);
    if (loadedKey.current !== key) return;
    setMessages(previous => mergeMessages(previous, rows));
    setHasOlder(rows.length === 50);
    setErrorText('');
  }, [scopeId, channel]);

  useEffect(() => {
    const key = `${scopeId}:${channel}`;
    loadedKey.current = key;
    setMessages([]);
    setDraft('');
    setViewerId('');
    setConsented(false);
    setErrorText('');
    setHasOlder(false);
    if (!scopeId) return;
    let mounted = true;
    setLoading(true);
    void Promise.all([
      listBuklodPttMessages(scopeId, channel),
      supabase.auth.getSession(),
    ]).then(async ([rows, auth]) => {
      if (!mounted || loadedKey.current !== key) return;
      setMessages(rows);
      setHasOlder(rows.length === 50);
      const user = auth.data.session?.user;
      if (user) {
        setViewerId(user.id);
        setConsented(await hasBuklodPttCaptionConsent(user.id, scopeId, channel));
      } else {
        setViewerId('');
        setConsented(false);
      }
    }).catch(e => {
      if (mounted) setErrorText(e?.message || 'Cannot load conversation.');
    }).finally(() => { if (mounted) setLoading(false); });

    const sub = supabase.channel(`ptt-history:${scopeId}:${channel}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'buklod_ptt_channel_messages',
        filter: `scope_id=eq.${scopeId}`,
      }, (event: any) => {
        if (!mounted || loadedKey.current !== key) return;
        const item = event.new as BuklodPttMessage;
        if (Number(item.channel) !== channel) return;
        setMessages(previous => mergeMessages(previous, [item]));
      }).subscribe();

    const appSub = AppState.addEventListener('change', value => {
      if (value === 'active' && mounted) {
        void listBuklodPttMessages(scopeId, channel).then(rows => {
          if (mounted && loadedKey.current === key) setMessages(previous => mergeMessages(previous, rows));
        }).catch(() => undefined);
      }
    });
    return () => {
      mounted = false;
      appSub.remove();
      void supabase.removeChannel(sub);
    };
  }, [scopeId, channel]);

  useEffect(() => {
    setCaptionsActive(false);
    if (!connection || connection.scope.id !== scopeId || connection.channel !== channel) return;
    const started = connection.call.on('call.closed_captions_started', () => setCaptionsActive(true));
    const stopped = connection.call.on('call.closed_captions_stopped', () => setCaptionsActive(false));
    const failed = connection.call.on('call.closed_captions_failed', () => {
      setCaptionsActive(false);
      setErrorText('Voice-to-text failed. Text messages are still available.');
    });
    // Covers channels that had captions started by another connected member.
    setCaptionsActive(Boolean((connection.call.state as any).captioning));
    return () => { started(); stopped(); failed(); };
  }, [connection, scopeId, channel]);

  const send = async () => {
    if (!scopeId || sending || !draft.trim()) return;
    const body = draft.trim();
    setSending(true);
    try {
      await sendBuklodPttText(scopeId, channel, body);
      setDraft('');
      await refresh();
    } catch (e: any) {
      setErrorText(e?.message || 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  const loadOlder = async () => {
    if (loadingOlder || !hasOlder || !messages[0]) return;
    setLoadingOlder(true);
    try {
      const rows = await listBuklodPttMessages(scopeId, channel, messages[0].created_at);
      setMessages(previous => mergeMessages(previous, rows));
      setHasOlder(rows.length === 50);
    } catch (e: any) {
      setErrorText(e?.message || 'Unable to load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const toggleCaptions = async (enable: boolean) => {
    if (!connection || connection.scope.id !== scopeId || connection.channel !== channel) {
      Alert.alert('Connect PTT first', 'Join this PTT channel before enabling voice-to-text.');
      return;
    }
    const act = async () => {
      setCaptionWorking(true);
      try {
        await setBuklodPttCaptions(scopeId, channel, enable, language);
        await saveBuklodPttCaptionConsent(connection.userId, scopeId, channel, enable);
        setConsented(enable);
        setCaptionsActive(enable);
        setErrorText('');
      } catch (e: any) {
        setErrorText(e?.message || 'Voice-to-text is not available on this channel.');
      } finally {
        setCaptionWorking(false);
      }
    };
    if (enable) {
      Alert.alert(
        'Enable channel voice-to-text?',
        'The audio of this channel will be processed by Stream while captions are active. Tell other participants first. Only members who opt in will save their own transcript to BUKLOD.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Enable', onPress: () => void act() }],
      );
    } else {
      Alert.alert(
        'Stop channel captions?',
        'This stops live captioning for everyone currently listening to this channel.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Stop captions', onPress: () => void act() }],
      );
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="forum-outline" color="#56DCE5" size={21} />
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>PTT Conversation</Text>
          <Text style={styles.subheading}>CH{String(channel).padStart(2, '0')} · Voice-to-text and messages</Text>
        </View>
        <Pressable onPress={() => void refresh().catch(e => setErrorText(e?.message || 'Refresh failed'))} accessibilityLabel="Refresh conversation" style={styles.actionIcon}>
          <MaterialCommunityIcons name="refresh" size={19} color="#AED5DE" />
        </Pressable>
      </View>
      <View style={styles.captionSection}>
        <View style={styles.captionHeader}>
          <Text style={styles.captionLabel}>{captionsActive ? '● Captions on' : 'Voice-to-text optional'}</Text>
          <View style={styles.langRow}>
            {(['tl', 'en'] as const).map(code =>
              <Pressable key={code} onPress={() => setLanguage(code)} style={[styles.langButton, language === code && styles.langOn]}>
                <Text style={styles.langText}>{code === 'tl' ? 'Tagalog' : 'English'}</Text>
              </Pressable>
            )}
          </View>
        </View>
        <Text style={styles.note}>Channel captions process voice for all listeners. Saving your spoken words requires your consent. Speech recognition can make mistakes.</Text>
        <Pressable
          disabled={captionWorking || !connection}
          accessibilityRole="button"
          onPress={() => void toggleCaptions(!captionsActive || !consented)}
          style={[styles.captionButton, captionWorking && { opacity: 0.5 }]}
        >
          {captionWorking ? <ActivityIndicator color="#071725" size="small" /> :
            <Text style={styles.captionButtonText}>
              {captionsActive && consented ? 'STOP CAPTIONS' : captionsActive ? 'JOIN VOICE-TO-TEXT' : 'ENABLE VOICE-TO-TEXT'}
            </Text>}
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color="#56DCE5" style={{ padding: 10 }} /> : null}
      {hasOlder ? <Pressable onPress={() => void loadOlder()} disabled={loadingOlder} style={styles.older}>
        <Text style={styles.olderText}>{loadingOlder ? 'Loading...' : 'Load earlier messages'}</Text>
      </Pressable> : null}
      <ScrollView
        ref={scrollRef}
        style={styles.history}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => { if (!loadingOlder) scrollRef.current?.scrollToEnd({ animated: false }); }}
      >
        {messages.length === 0 && !loading ? <Text style={styles.empty}>No conversation yet. Send a text or enable captions while talking.</Text> : null}
        {messages.map(m => {
          const mine = m.sender_user_id === viewerId;
          return <View key={m.id} style={[styles.bubble, mine && styles.mine]}>
            <Text style={styles.author}>{mine ? 'You' : m.sender_name} · {new Date(m.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
            <Text style={styles.body}>{m.body}</Text>
            {m.kind === 'CAPTION' ? <Text style={styles.voiceLabel}>Voice → Text · automatic caption</Text> : null}
          </View>;
        })}
      </ScrollView>
      {errorText ? <Text accessibilityRole="alert" style={styles.error}>{errorText}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message..."
          placeholderTextColor="#7A95A2"
          multiline
          maxLength={4000}
          accessibilityLabel="PTT conversation message"
        />
        <Pressable
          accessibilityLabel="Send PTT text message"
          disabled={!draft.trim() || sending || !scopeId}
          onPress={() => void send()}
          style={[styles.send, (!draft.trim() || sending) && { opacity: 0.45 }]}
        >
          {sending ? <ActivityIndicator color="#071725" size="small" /> :
            <MaterialCommunityIcons name="send" color="#071725" size={21} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#081B27', borderColor: '#25424C', borderWidth: 1, borderRadius: 16, marginTop: 14, padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  subheading: { color: '#9CBECA', fontSize: 12 },
  actionIcon: { padding: 7 },
  captionSection: { backgroundColor: '#0B2935', padding: 10, borderRadius: 12, gap: 8 },
  captionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  captionLabel: { color: '#E4FBFF', fontSize: 13, fontWeight: '800' },
  note: { color: '#A6BFCA', fontSize: 12, lineHeight: 17 },
  langRow: { flexDirection: 'row', gap: 5 },
  langButton: { paddingVertical: 5, paddingHorizontal: 8, borderColor: '#29505B', borderWidth: 1, borderRadius: 8 },
  langOn: { backgroundColor: '#175361', borderColor: '#56DCE5' },
  langText: { color: '#E4FBFF', fontWeight: '700', fontSize: 11 },
  captionButton: { backgroundColor: '#56DCE5', borderRadius: 9, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  captionButtonText: { fontSize: 12, fontWeight: '900', color: '#071725' },
  history: { maxHeight: 320, minHeight: 100 },
  empty: { color: '#93AAB4', textAlign: 'center', padding: 20, fontSize: 13 },
  older: { alignSelf: 'center', padding: 6 },
  olderText: { color: '#56DCE5', fontSize: 12, fontWeight: '700' },
  bubble: { maxWidth: '88%', alignSelf: 'flex-start', backgroundColor: '#163341', borderRadius: 11, marginBottom: 7, padding: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#154C49' },
  author: { color: '#B1D4DE', fontSize: 10, marginBottom: 4, fontWeight: '700' },
  body: { color: '#FFFFFF', fontSize: 15, lineHeight: 21 },
  voiceLabel: { color: '#80B9C3', fontSize: 10, marginTop: 5 },
  error: { color: '#FFA6A6', fontSize: 12, lineHeight: 17 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, backgroundColor: '#0B2633', color: '#FFFFFF', fontSize: 16, minHeight: 44, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderColor: '#2A5865', borderWidth: 1 },
  send: { backgroundColor: '#56DCE5', minHeight: 44, width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
