import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';

type PhotoComment = { id: string; user_id: string; author_name: string; body: string; created_at: string };
type Props = {
 open: boolean; postId: string; mediaPosition: number;
 onClose: () => void; onCountChange: (count: number) => void; onSaved?: () => void;
};
const panel = {
 backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
 padding: 16, gap: 10, maxHeight: '82%', minHeight: 340,
} as const;

export default function BuklodPhotoCommentsSheet({ open, postId, mediaPosition, onClose, onCountChange, onSaved }: Props) {
 const [rows, setRows] = useState<PhotoComment[]>([]);
 const [total, setTotal] = useState(0);
 const [draft, setDraft] = useState('');
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState('');
 const pendingKey = useRef('');
 const sequence = useRef(0);
 const countCallback = useRef(onCountChange);
 countCallback.current = onCountChange;

 useEffect(() => {
  if (!open || !postId) return;
  const request = ++sequence.current;
  setRows([]); setTotal(0); setError(''); setDraft(''); pendingKey.current = '';
  setLoading(true);
  void (async () => {
   try {
    const result = await (supabase as any).rpc('get_buklod_photo_comment_summary_v1', {
     p_post_id: postId, p_media_position: mediaPosition,
    });
    if (request !== sequence.current) return;
    if (result.error) throw result.error;
    const data = result.data ?? {};
    const count = Math.max(0, Number(data.comment_count ?? 0));
    setRows(Array.isArray(data.comments) ? data.comments : []);
    setTotal(count); countCallback.current(count);
   } catch (e: any) {
    if (request === sequence.current) setError(String(e?.message ?? 'Photo comments unavailable.'));
   } finally {
    if (request === sequence.current) setLoading(false);
   }
  })();
  return () => { sequence.current += 1; };
 }, [open, postId, mediaPosition]);

 async function refresh() {
  const result = await (supabase as any).rpc('get_buklod_photo_comment_summary_v1', {
   p_post_id: postId, p_media_position: mediaPosition,
  });
  if (result.error) throw result.error;
  const data = result.data ?? {};
  const count = Math.max(0, Number(data.comment_count ?? 0));
  setRows(Array.isArray(data.comments) ? data.comments : []);
  setTotal(count); countCallback.current(count);
 }

 async function send() {
  const body = draft.trim();
  if (!body || saving || !open || !postId) return;
  if (body.length > 2000) { setError('Maximum 2,000 characters.'); return; }
  const key = pendingKey.current || (Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 14));
  pendingKey.current = key;
  setSaving(true); setError('');
  try {
   const result = await (supabase as any).rpc('add_buklod_photo_comment_v1', {
    p_post_id: postId, p_media_position: mediaPosition, p_body: body, p_request_key: key,
   });
   if (result.error) throw result.error;
   setDraft(''); pendingKey.current = '';
   onSaved?.();
   try { await refresh(); }
   catch { setTotal(value => { countCallback.current(value + 1); return value + 1; }); setError('Saved. Refresh to see the latest comments.'); }
  } catch (e: any) {
   setError(String(e?.message ?? 'Could not save comment. Tap Send to retry.'));
  } finally { setSaving(false); }
 }

 return (
  <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
   <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
     <Pressable accessibilityRole="button" accessibilityLabel="Close photo comments" onPress={onClose} style={{ flex: 1 }} />
     <View style={panel}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
       <Text style={{ fontSize: 17, fontWeight: '800', color: '#192B3A' }}>Photo comments ({total})</Text>
       <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#216B7C' }}>Close</Text>
       </Pressable>
      </View>
      {loading ? <ActivityIndicator accessibilityLabel="Loading photo comments" /> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: '#A22626', fontSize: 13 }}>{error}</Text> : null}
      <ScrollView style={{ flexGrow: 0, flex: 1 }} keyboardShouldPersistTaps="handled">
       {rows.length === 0 && !loading ? <Text style={{ color: '#53626C' }}>No comments yet for this photo.</Text> : null}
       {rows.map(row => (
        <View key={String(row.id)} style={{ borderBottomWidth: 1, borderColor: '#E7EBEF', paddingVertical: 9, gap: 4 }}>
         <Text style={{ fontWeight: '700', color: '#192B3A' }}>{row.author_name || 'BUKLOD member'}</Text>
         <Text style={{ color: '#203846', fontSize: 15 }}>{row.body}</Text>
         <Text style={{ color: '#627482', fontSize: 11 }}>{new Date(row.created_at).toLocaleString()}</Text>
        </View>
       ))}
       {total > rows.length ? <Text style={{ color: '#53626C', paddingVertical: 8 }}>Showing the latest {rows.length} of {total} comments.</Text> : null}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
       <TextInput accessibilityLabel="Write a comment on this photo" value={draft}
        onChangeText={text => { setDraft(text); pendingKey.current = ''; }}
        placeholder="Comment on this photo…" placeholderTextColor="#63737D" multiline maxLength={2000}
        style={{ flex: 1, minHeight: 45, maxHeight: 100, borderRadius: 12, borderWidth: 1, borderColor: '#C8D3DB', padding: 10, color: '#192B3A', fontSize: 16 }} />
       <Pressable accessibilityRole="button" accessibilityLabel="Send photo comment"
        disabled={saving || !draft.trim()} onPress={() => { void send(); }}
        style={{ paddingHorizontal: 15, minHeight: 44, justifyContent: 'center', borderRadius: 12, backgroundColor: saving || !draft.trim() ? '#A5B1B9' : '#1F778A' }}>
        <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{saving ? 'Saving' : 'Send'}</Text>
       </Pressable>
      </View>
     </View>
    </View>
   </KeyboardAvoidingView>
  </Modal>
 );
}
