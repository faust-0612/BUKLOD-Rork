import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BuklodPressable from '@/components/BuklodPressable';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { supabase } from '@/lib/supabase';
import { pickCommunityPhotos } from '@/lib/buklodPickCommunityPhotos';
import { uploadCommunityPhotoFile } from '@/lib/uploadCommunityVideoFile';
import { resolveCommunityMediaUrl } from '@/lib/buklodMediaUrl';
import {
  BUKLOD_DUGTONG_TYPE_LABELS,
  BUKLOD_DUGTONG_TYPES,
  defaultDugtongTypeForKind,
  primaryDugtongLabelForKind,
  scanBuklodCommunityPrivacy,
  type BuklodDugtongPrivacy,
  type BuklodDugtongType,
} from '@/lib/buklodCommunityLiving';

type Props = { postId: string };
type Summary = {
  post_id: string;
  kind: string;
  status: 'open' | 'growing' | 'resolved';
  quiet_mode: boolean;
  public_count: number;
  private_count: number;
  branch_count: number;
};
type DugtongRow = {
  id: string;
  parent_id?: string | null;
  branch_id?: string | null;
  depth: number;
  body: string;
  dugtong_type: BuklodDugtongType;
  privacy: BuklodDugtongPrivacy;
  user_id?: string | null;
  display_name: string;
  media_path?: string | null;
  is_helpful?: boolean;
};

function DugtongPhoto({ path }: { path?: string | null }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) return setUri(null);
    void resolveCommunityMediaUrl(path).then(value => {
      if (alive) setUri(value);
    });
    return () => { alive = false; };
  }, [path]);
  return uri ? <Image source={{ uri }} style={styles.chainPhoto} /> : null;
}

export default function BuklodDugtongAction({ postId }: Props) {
  const { user } = useAuth();
  const { theme } = useBuklodTheme();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<DugtongRow[]>([]);
  const [compose, setCompose] = useState(false);
  const [settings, setSettings] = useState(false);
  const [body, setBody] = useState('');
  const [parent, setParent] = useState<DugtongRow | null>(null);
  const [privacy, setPrivacy] = useState<BuklodDugtongPrivacy>('public');
  const [kind, setKind] = useState<BuklodDugtongType>('continuation');
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);

  const count = Number(summary?.public_count ?? 0) + Number(summary?.private_count ?? 0);
  const label = primaryDugtongLabelForKind(summary?.kind);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        (supabase as any).rpc('get_buklod_dugtong_summary_v1', { p_post_id: postId }),
        (supabase as any).rpc('get_buklod_dugtong_chain_v1', { p_post_id: postId }),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      const next = (a.data ?? null) as Summary | null;
      setSummary(next);
      setRows((b.data ?? []) as DugtongRow[]);
      setKind(defaultDugtongTypeForKind(next?.kind));
    } catch (error: any) {
      const message = String(error?.message ?? error ?? 'Could not load this chain.');
      if (!/could not find the function|schema cache/i.test(message)) {
        Alert.alert('Dugtong', message);
      }
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // Deliberately do not fetch one summary per feed card on mount. The mature
  // Community Wall can render many posts at once; loading the chain lazily on
  // interaction avoids an N+1 RPC burst and keeps casual scrolling lightweight.

  const startCompose = (nextParent: DugtongRow | null = null) => {
    setParent(nextParent);
    setBody('');
    setPhoto(null);
    setPrivacy('public');
    setSettings(false);
    setKind(nextParent?.dugtong_type ?? defaultDugtongTypeForKind(summary?.kind));
    setCompose(true);
  };

  const pickPhoto = async () => {
    try {
      const picked = await pickCommunityPhotos({ remaining: 1, maxPhotos: 1 });
      if (picked[0]) {
        setPhoto({ uri: picked[0].uri });
        if (summary?.kind === 'moment') setKind('moment');
      }
    } catch (error: any) {
      Alert.alert('Photo', String(error?.message ?? 'Could not select a photo.'));
    }
  };

  const submit = async () => {
    if (!user?.id || saving) return;
    const text = body.trim();
    if (!text && !photo) return Alert.alert('Dugtong', 'Write something or add a photo.');

    const shield = scanBuklodCommunityPrivacy(text);
    if (shield.hardBlock) return Alert.alert('Cannot post', shield.warnings.join('\n'));
    if (privacy !== 'public' && shield.suggestedText !== text) {
      setBody(shield.suggestedText);
      return Alert.alert('Privacy Shield', 'BUKLOD hid a detected contact detail. Review, then post again.');
    }

    setSaving(true);
    try {
      let mediaPath: string | null = null;
      let mediaSize: number | null = null;
      if (photo) {
        mediaPath = `${user.id}/dugtong-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const uploaded = await uploadCommunityPhotoFile({ path: mediaPath, uri: photo.uri });
        mediaSize = uploaded.sizeBytes;
      }
      const { error } = await (supabase as any).rpc('create_buklod_dugtong_v1', {
        p_post_id: postId,
        p_parent_id: parent?.id ?? null,
        p_body: text || 'Added a photo.',
        p_type: kind,
        p_privacy: privacy,
        p_media_path: mediaPath,
        p_media_mime_type: mediaPath ? 'image/jpeg' : null,
        p_media_size_bytes: mediaSize,
      });
      if (error) throw error;
      setCompose(false);
      await load();
    } catch (error: any) {
      Alert.alert('Could Not Add Dugtong', String(error?.message ?? error ?? 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const types = useMemo(
    () => summary?.kind === 'moment'
      ? BUKLOD_DUGTONG_TYPES.filter(value => ['moment', 'experience', 'continuation'].includes(value))
      : [...BUKLOD_DUGTONG_TYPES],
    [summary?.kind],
  );

  return <>
    <BuklodPressable
      accessibilityRole="button"
      accessibilityLabel={summary ? `${label}. ${count} Dugtongs` : 'Dugtong'}
      nested compact
      onPress={() => { setOpen(true); setCompose(false); void load(); }}
      style={styles.action}
    >
      <MaterialCommunityIcons name="link-variant" size={18} color={theme.textMuted} />
      {summary && count > 0 ? <Text style={[styles.actionCount, { color: theme.textMuted }]}>{count}</Text> : null}
    </BuklodPressable>

    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>DUGTONG</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                {summary?.status === 'resolved' ? 'Resolved · chain stays traceable' : `${summary?.branch_count ?? 0} branches · ${count} Dugtongs`}
              </Text>
            </View>
            <Pressable onPress={() => setOpen(false)} style={styles.close}>
              <MaterialCommunityIcons name="close" size={22} color={theme.textPrimary} />
            </Pressable>
          </View>

          {loading ? <View style={styles.loading}><ActivityIndicator /></View> : compose ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.composeContent}>
              {parent ? <View style={[styles.replyContext, { backgroundColor: theme.surfaceMuted }]}>
                <Text style={[styles.replyLabel, { color: theme.textMuted }]}>Dugtong to</Text>
                <Text numberOfLines={2} style={[styles.replyText, { color: theme.textPrimary }]}>{parent.display_name}: {parent.body}</Text>
              </View> : null}

              <TextInput
                autoFocus multiline value={body} onChangeText={setBody}
                placeholder={summary?.kind === 'moment' ? 'Add your side of this moment…' : 'Continue this chain…'}
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.inputSurface }]}
              />
              {photo ? <View style={styles.photoWrap}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                <Pressable style={styles.removePhoto} onPress={() => setPhoto(null)}>
                  <MaterialCommunityIcons name="close" size={18} color="#fff" />
                </Pressable>
              </View> : null}

              <View style={styles.composeBar}>
                <Pressable onPress={() => void pickPhoto()} style={styles.iconAction}>
                  <MaterialCommunityIcons name="image-plus" size={21} color={theme.textMuted} />
                </Pressable>
                <Pressable onPress={() => setSettings(value => !value)} style={styles.settingsLine}>
                  <MaterialCommunityIcons name="tune-variant" size={18} color={theme.textMuted} />
                  <Text style={[styles.settingsText, { color: theme.textMuted }]}>Settings</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable disabled={saving} onPress={() => void submit()} style={[styles.primary, { backgroundColor: theme.accent }]}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryText}>Dugtong</Text>}
                </Pressable>
              </View>

              {settings ? <View style={[styles.settingsPanel, { borderColor: theme.border }]}>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>TYPE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {types.map(value => <Pressable key={value} onPress={() => setKind(value)}
                    style={[styles.chip, { borderColor: kind === value ? theme.accent : theme.border }, kind === value && { backgroundColor: theme.accentSoft }]}
                  ><Text style={[styles.chipText, { color: kind === value ? theme.accent : theme.textMuted }]}>{BUKLOD_DUGTONG_TYPE_LABELS[value]}</Text></Pressable>)}
                </ScrollView>
                <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PRIVACY</Text>
                <View style={styles.privacyRow}>
                  {([
                    ['public', 'Public', 'earth'],
                    ['anonymous', 'Anonymous', 'incognito'],
                    ['private_poster', 'Poster only', 'lock-outline'],
                  ] as const).map(([value, text, icon]) => <Pressable key={value} onPress={() => setPrivacy(value)}
                    style={[styles.privacyChoice, { borderColor: privacy === value ? theme.accent : theme.border }]}
                  ><MaterialCommunityIcons name={icon} size={17} color={privacy === value ? theme.accent : theme.textMuted} />
                    <Text style={[styles.privacyText, { color: privacy === value ? theme.accent : theme.textMuted }]}>{text}</Text>
                  </Pressable>)}
                </View>
              </View> : null}
            </ScrollView>
          ) : <>
            <ScrollView style={styles.chainScroll} contentContainerStyle={styles.chainContent} showsVerticalScrollIndicator={false}>
              {!rows.length ? <View style={styles.empty}>
                <MaterialCommunityIcons name="link-variant-plus" size={29} color={theme.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Needs a Dugtong</Text>
                <Text style={[styles.emptyBody, { color: theme.textMuted }]}>Be the first to continue this post.</Text>
              </View> : rows.map(row => <Pressable key={row.id} onPress={() => startCompose(row)}
                style={[styles.node, {
                  marginLeft: Math.min(Math.max(Number(row.depth || 1) - 1, 0), 3) * 17,
                  borderColor: row.is_helpful ? theme.accent : theme.border,
                  backgroundColor: theme.surface,
                }]}
              >
                <View style={styles.nodeTop}>
                  <Text style={[styles.nodeAuthor, { color: theme.textPrimary }]}>{row.display_name}</Text>
                  {row.privacy === 'private_poster' ? <MaterialCommunityIcons name="lock-outline" size={13} color={theme.textMuted} /> : null}
                  {row.privacy === 'anonymous' ? <MaterialCommunityIcons name="incognito" size={13} color={theme.textMuted} /> : null}
                  <Text style={[styles.nodeType, { color: theme.textMuted }]}>{BUKLOD_DUGTONG_TYPE_LABELS[row.dugtong_type] ?? 'Dugtong'}</Text>
                </View>
                <Text style={[styles.nodeBody, { color: theme.textPrimary }]}>{row.body}</Text>
                <DugtongPhoto path={row.media_path} />
                <Text style={[styles.continueHint, { color: theme.textMuted }]}>Tap to Dugtong here</Text>
              </Pressable>)}
            </ScrollView>
            {summary?.status !== 'resolved' ? <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
              <Pressable onPress={() => startCompose()} style={[styles.primaryWide, { backgroundColor: theme.accent }]}>
                <MaterialCommunityIcons name="link-variant-plus" size={18} color="#fff" />
                <Text style={styles.primaryText}>{label}</Text>
              </Pressable>
            </View> : null}
          </>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  action: { minHeight: 32, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  actionCount: { fontSize: 12, fontWeight: '800' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,12,9,.38)' },
  sheet: { maxHeight: '88%', minHeight: '52%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingTop: 8, overflow: 'hidden' },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 14, fontWeight: '900', letterSpacing: .6 },
  subtitle: { marginTop: 2, fontSize: 10.5, fontWeight: '600' },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  chainScroll: { flex: 1 },
  chainContent: { paddingHorizontal: 14, paddingBottom: 22, gap: 8 },
  node: { borderLeftWidth: 2, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 9 },
  nodeTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nodeAuthor: { flex: 1, fontSize: 11.5, fontWeight: '900' },
  nodeType: { fontSize: 9, fontWeight: '700' },
  nodeBody: { marginTop: 5, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  continueHint: { marginTop: 6, fontSize: 9.5, fontWeight: '700' },
  chainPhoto: { marginTop: 8, width: '100%', aspectRatio: 1.45, borderRadius: 12, backgroundColor: '#E7ECE9' },
  empty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { marginTop: 9, fontSize: 14, fontWeight: '900' },
  emptyBody: { marginTop: 4, fontSize: 11.5, textAlign: 'center' },
  footer: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 24 : 14, borderTopWidth: StyleSheet.hairlineWidth },
  primaryWide: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primary: { minWidth: 86, minHeight: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  composeContent: { paddingHorizontal: 14, paddingBottom: 26 },
  input: { minHeight: 124, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, lineHeight: 20, textAlignVertical: 'top' },
  composeBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  iconAction: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  settingsLine: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5 },
  settingsText: { fontSize: 10.5, fontWeight: '700' },
  settingsPanel: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  sectionLabel: { marginTop: 4, marginBottom: 6, fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  chipRow: { gap: 6, paddingBottom: 8 },
  chip: { minHeight: 31, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 10, fontWeight: '800' },
  privacyRow: { flexDirection: 'row', gap: 6 },
  privacyChoice: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: 2 },
  privacyText: { fontSize: 9, fontWeight: '800' },
  replyContext: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  replyLabel: { fontSize: 9, fontWeight: '900' },
  replyText: { marginTop: 2, fontSize: 11, fontWeight: '600' },
  photoWrap: { marginTop: 8, position: 'relative' },
  photoPreview: { width: '100%', aspectRatio: 1.5, borderRadius: 14 },
  removePhoto: { position: 'absolute', right: 8, top: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,.55)', alignItems: 'center', justifyContent: 'center' },
});