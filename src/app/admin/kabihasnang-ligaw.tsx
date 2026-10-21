import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AdminGate } from '@/components/AdminGate';
import KlLivingFixture from '@/components/kabihasnang-ligaw/KlLivingFixture';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import {
  buildAssetGate,
  buildCatalogEpisodes,
  buildStoryboard,
  KL_CHAPTER_ONE_LIVING_SCOPE,
  KL_MANUSCRIPT_SEARCH_PATHS,
  KL_UNRESOLVED_NAME,
} from '@/lib/kabihasnang-ligaw/catalog';
import { mediaGateFor, publicationBlockers } from '@/lib/kabihasnang-ligaw/gates';
import { splitCanonicalParagraphs } from '@/lib/kabihasnang-ligaw/manuscript';
import { adminActionArgs, KL_RPC, type AdminAction } from '@/lib/kabihasnang-ligaw/rpc';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const EPISODES = buildCatalogEpisodes();
const STORYBOARD = buildStoryboard();
const ASSETS = buildAssetGate();

export default function KabihasnangLigawAdminScreen() {
  const reduceMotion = useBuklodReduceMotion();
  const [episodeId, setEpisodeId] = useState(EPISODES[1]?.id ?? EPISODES[0].id);
  const [notes, setNotes] = useState('');
  const [manilaDate, setManilaDate] = useState('2026-10-22');
  const [result, setResult] = useState('Nothing has been approved.');
  const [busy, setBusy] = useState(false);
  const episode = EPISODES.find((item) => item.id === episodeId) ?? EPISODES[0];
  const episodeAssets = ASSETS.filter((asset) =>
    asset.episodeId === episode.id || (asset.episodeId == null && asset.required));
  const blockers = useMemo(
    () => publicationBlockers(episode, episodeAssets),
    [episode, episodeAssets],
  );
  const shots = STORYBOARD.filter((row) => row.episodeId === episode.id);

  const run = async (action: AdminAction) => {
    setBusy(true);
    try {
      const args = adminActionArgs({
        action,
        episodeId: episode.id,
        notes,
        manilaDate: action === 'schedule' ? manilaDate : null,
      });
      const { data, error } = await supabase.rpc(KL_RPC.adminAction, args);
      if (error) {
        setResult('The server refused this action. Nothing was approved or published.');
        return;
      }
      const payload = data as { ok?: boolean } | null;
      setResult(payload?.ok === true
        ? 'The server accepted the action.'
        : 'The server did not publish this episode.');
    } catch {
      setResult('Story admin could not reach the server. Nothing was approved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminGate>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.kicker}>BUKLOD ADMIN</Text>
        <Text style={styles.title}>Kabihasnang Ligaw — Story Management</Text>
        <Text style={styles.body}>
          Preview, revision notes, schedule, pause, and audit stay on the server.
          This screen cannot mark a manuscript, image, or sound approved.
        </Text>
        <Text style={styles.warning}>Owner creative approval is still pending. Release candidate is not frozen.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manuscript</Text>
          <Text style={styles.body}>
            Panimula and Kabanata 1 are the saved text. Members do not see them until approval, art, sound, and the 6:00 a.m. release all pass. Nothing here is published.
          </Text>
          {KL_MANUSCRIPT_SEARCH_PATHS.map((path) => (
            <Text key={path} style={styles.meta}>{path}</Text>
          ))}
          <Text style={styles.meta}>Jawo/Javvo: {KL_UNRESOLVED_NAME.blocker}. Not published.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Episodes</Text>
          {EPISODES.map((item) => (
            <Pressable key={item.id} onPress={() => setEpisodeId(item.id)} style={styles.row}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.meta}>{item.status} · {item.manuscriptStatus} · {item.mediaGate}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preview · {episode.title}</Text>
          <Text style={styles.meta}>
            {episode.prose ? `${splitCanonicalParagraphs(episode.prose, episode.episodeNumber).length} paragraphs` : 'No prose'}
            {episode.proseSha256 ? ` · ${episode.proseSha256}` : ''}
          </Text>
          <Text style={styles.meta}>Media gate: {mediaGateFor(episodeAssets)}</Text>
          <Text style={styles.meta}>Blockers: {blockers.join(', ') || 'none'}</Text>
          {episode.prose ? splitCanonicalParagraphs(episode.prose, episode.episodeNumber).map((paragraph) => (
            <Text key={paragraph.id} style={styles.body}>{paragraph.id} {paragraph.text}</Text>
          )) : (
            <Text style={styles.body}>No approved prose is stored for this episode.</Text>
          )}
          {shots.map((shot) => (
            <View key={shot.sceneId} style={styles.shot}>
              <Text style={styles.rowTitle}>{shot.sceneId}{shot.spoiler ? ' · closing reveal' : ''}</Text>
              <Text style={styles.meta}>{shot.status}</Text>
              <Text style={styles.meta}>
                {shot.paragraphRange
                  ? `Paragraphs ${shot.paragraphRange.startId}–${shot.paragraphRange.endId}`
                  : 'Paragraph range: not bound'}
              </Text>
              <Text style={styles.body}>{shot.editorialIntent ?? 'No scene prose. Outline only.'}</Text>
              <Text style={styles.meta}>Artwork: {shot.artworkStatus}. Approval: {shot.approvalStatus}. Not approved.</Text>
            </View>
          ))}
          <Text style={styles.cardTitle}>Chapter 1 living layers</Text>
          {KL_CHAPTER_ONE_LIVING_SCOPE.map((layer) => (
            <Text key={layer.layer} style={styles.meta}>
              {layer.layer}: {layer.activation}
              {layer.paragraphRange ? ` ${layer.paragraphRange.startId}–${layer.paragraphRange.endId}` : ''}. Not approved.
            </Text>
          ))}
          <KlLivingFixture
            visible
            appActive
            reduceMotion={reduceMotion}
            userMotionEnabled
            batterySaver={false}
            lowBandwidth={false}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Actions</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Revision notes"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TextInput
            value={manilaDate}
            onChangeText={setManilaDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.input}
          />
          <View style={styles.actions}>
            {(['approve', 'revise', 'schedule', 'pause', 'resume', 'pause_season', 'resume_season', 'emergency_stop', 'emergency_clear'] as AdminAction[]).map((action) => (
              <Pressable
                key={action}
                disabled={busy || (action === 'approve' && blockers.length > 0)}
                onPress={() => void run(action)}
                style={[styles.button, (busy || (action === 'approve' && blockers.length > 0)) && styles.disabled]}
              >
                <Text style={styles.buttonText}>{action.split('_').join(' ')}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.body}>{result}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Asset gate</Text>
          {ASSETS.filter((asset) => asset.sceneId == null).map((asset) => (
            <Text key={asset.id} style={styles.meta}>
              {asset.classification} · {asset.kind} · {asset.path ?? asset.sceneId ?? asset.id}
            </Text>
          ))}
        </View>
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 14, backgroundColor: colors.background },
  kicker: { color: colors.greenDark, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  warning: { color: '#8A5A00', fontSize: 14, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowTitle: { color: colors.text, fontWeight: '700' },
  shot: { gap: 4, paddingVertical: 8 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: colors.green, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  disabled: { opacity: 0.45 },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 12 },
});
