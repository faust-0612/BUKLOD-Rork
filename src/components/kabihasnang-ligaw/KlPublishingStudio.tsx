import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { importKlClipboard, splitKlItalics, toggleKlItalic } from '@/lib/kabihasnang-ligaw/italicFormatting';
import { splitKlManuscriptBlocks } from '@/lib/kabihasnang-ligaw/paragraphBlocks';
import { supabase } from '@/lib/supabase';
import KlAdminMediaUpload from './KlAdminMediaUpload';
import KlAdminPreview from './KlAdminPreview';
import { klPreviewReadyForEpisode } from '@/lib/kabihasnang-ligaw/mediaApprovalState';
import { useAuth } from '@/providers/AuthProvider';
import {
  type KlEditorDraft,
  buildKlEditorDraft,
  hasUnsavedKlDraft,
} from '@/lib/kabihasnang-ligaw/editorDraftRecovery';
import { readKlEditorDraft, writeKlEditorDraft, removeKlEditorDraft } from '@/lib/kabihasnang-ligaw/editorDraftStorage';
import { klPublishingErrorMessage } from '@/lib/kabihasnang-ligaw/publishingErrors';

type Episode = {
  id: string;
  title: string;
  season_number: number;
  episode_number: number;
  status: string;
  preview_ready?: boolean;
};
type Feedback = { tone: 'success' | 'error' | 'info'; text: string };
type Preview = { manuscript?: string | null; title?: string | null; editorial_revision?: boolean; revision_id?: string | null };
type EditorialResult = { ok?: boolean; changed?: boolean; editorial_revision?: boolean; revision_id?: string | null; published?: boolean; reason?: string; quiz_evidence_conflicts?: number; media_conflicts?: number };

const field = {
  color: '#fff',
  borderColor: '#718096',
  borderWidth: 1,
  padding: 12,
  borderRadius: 9,
} as const;

function Action({ label, onPress, disabled = false }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        paddingVertical: 12, paddingHorizontal: 14, minHeight: 44,
        justifyContent: 'center', borderRadius: 9,
        backgroundColor: disabled ? '#45505d' : '#385c55',
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: disabled ? '#ced3d9' : '#ffe0a8', fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export default function KlPublishingStudio() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [manuscript, setManuscript] = useState('');
  const [formatPreview, setFormatPreview] = useState(false);
  const [pasteBusy, setPasteBusy] = useState(false);
  const selectionRef = useRef({ start: 0, end: 0 });
  const pasteLock = useRef(false);
  const [season, setSeason] = useState('1');
  const [chapter, setChapter] = useState('2');
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [lastSaved, setLastSaved] = useState<{ id: string; title: string; manuscript: string } | null>(null);
  const [panel, setPanel] = useState<'manuscript' | 'media'>('manuscript');
  const [mediaKind, setMediaKind] = useState<'illustration' | 'cover' | 'music' | 'ambient'>('illustration');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editorialRevisionId, setEditorialRevisionId] = useState('');
  const [editorialReviewOpen, setEditorialReviewOpen] = useState(false);
  const [reviewedEditorialId, setReviewedEditorialId] = useState('');
  const [confirmedPreviewId, setConfirmedPreviewId] = useState('');
  const [approvalRefreshToken, setApprovalRefreshToken] = useState(0);
  const lock = useRef(false);
  const { user } = useAuth();
  const [recoveryDraft, setRecoveryDraft] = useState<KlEditorDraft | null>(null);
  const [localBackupStatus, setLocalBackupStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const latestDraftRef = useRef<KlEditorDraft | null>(null);
  const valuesRef = useRef({ id, title, manuscript });
  valuesRef.current = { id, title, manuscript };
  const localWrites = useRef<Promise<unknown>>(Promise.resolve());
  const queueLocal = (operation: () => Promise<void>) => {
    const next = localWrites.current.catch(() => undefined).then(operation);
    localWrites.current = next.catch(() => undefined);
    return next;
  };

  const refresh = async () => {
    const { data, error } = await supabase.rpc('kl_admin_list_v1');
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Hindi nabasa ang chapter list.');
    setEpisodes(data as Episode[]);
  };

  useEffect(() => {
    let active = true;
    void supabase.rpc('kl_admin_list_v1').then(({ data, error }) => {
      if (!active) return;
      if (error) setFeedback({ tone: 'error', text: 'Hindi na-load ang chapters: ' + error.message });
      else if (Array.isArray(data)) setEpisodes(data as Episode[]);
      else setFeedback({ tone: 'error', text: 'Hindi nabasa ang chapter list.' });
    });
    return () => { active = false; };
  }, []);

  const perform = async (label: string, task: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusyAction(label);
    setFeedback({ tone: 'info', text: label + '…' });
    try {
      await task();
    } catch (error) {
      setFeedback({ tone: 'error', text: klPublishingErrorMessage(error) });
    } finally {
      lock.current = false;
      setBusyAction('');
    }
  };

  const workspaceBusy = !!busyAction || mediaBusy || pasteBusy;
  const dirty = !!id && !!lastSaved && lastSaved.id === id
    && (lastSaved.title !== title || lastSaved.manuscript !== manuscript);
  const saved = !!id && !!lastSaved && lastSaved.id === id && !dirty;
  const previewReady = klPreviewReadyForEpisode(episodes, id, confirmedPreviewId);

  // Only the authenticated admin's current chapter can be recovered. Debounced
  // writes avoid storage churn while typing; unmount queues the latest edit.
  useEffect(() => {
    const draft = dirty && lastSaved
      ? buildKlEditorDraft(user?.id, id, title, manuscript, lastSaved.title, lastSaved.manuscript)
      : null;
    latestDraftRef.current = draft;
    if (!draft) {
      setLocalBackupStatus('idle');
      return;
    }
    setLocalBackupStatus('saving');
    let active = true;
    const timer = setTimeout(() => {
      void queueLocal(() => writeKlEditorDraft(draft))
        .then(() => { if (active) setLocalBackupStatus('saved'); })
        .catch(() => { if (active) setLocalBackupStatus('error'); });
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [dirty, id, title, manuscript, lastSaved, user?.id]);

  useEffect(() => () => {
    const draft = latestDraftRef.current;
    if (draft) void queueLocal(() => writeKlEditorDraft(draft)).catch(() => undefined);
  }, []);

  const findRecovery = async (episodeId: string, serverTitle: string, serverText: string) => {
    const draft = await readKlEditorDraft(user?.id, episodeId).catch(() => null);
    setRecoveryDraft(hasUnsavedKlDraft(draft, serverTitle, serverText) ? draft : null);
  };

  const open = async (episode: Episode, force = false) => {
    if (!force && dirty && episode.id !== id) {
      setFeedback({ tone: 'error', text: 'May hindi pa na-save na pagbabago. I-save muna ang manuscript bago lumipat ng chapter.' });
      return;
    }
    await perform('Binubuksan ang chapter', async () => {
      const { data, error } = await supabase.rpc('kl_admin_preview_v1', { p_episode_id: episode.id });
      if (error) throw error;
      if (!data || typeof data !== 'object') throw new Error('Walang server record ng chapter.');
      const preview = data as Preview;
      setEditorialRevisionId(preview.editorial_revision ? preview.revision_id ?? '' : '');
      setEditorialReviewOpen(false); setReviewedEditorialId('');
      const nextTitle = preview.title ?? episode.title;
      const nextText = preview.manuscript ?? '';
      setId(episode.id);
      setTitle(nextTitle);
      setManuscript(nextText); setFormatPreview(false); selectionRef.current = { start: 0, end: 0 };
      setSeason(String(episode.season_number));
      setChapter(String(episode.episode_number));
      setLastSaved({ id: episode.id, title: nextTitle, manuscript: nextText });
      setPanel('manuscript');
      setPreviewOpen(false);
      setConfirmedPreviewId('');
      await findRecovery(episode.id, nextTitle, nextText);
      setFeedback({ tone: 'success', text: 'Chapter loaded from server. ' + (nextText ? 'Maaari nang mag-edit.' : 'Wala pang manuscript.') });
    });
  };

  const create = () => {
    const seriesNumber = Number(season);
    const chapterNumber = Number(chapter);
    if (!Number.isInteger(seriesNumber) || seriesNumber < 1 || seriesNumber > 12 ||
        !Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 30 ||
        title.trim().length < 3) {
      setFeedback({ tone: 'error', text: 'Ilagay ang Series 1–12, Chapter 1–30, at title na hindi bababa sa 3 characters.' });
      return;
    }
    if (dirty) {
      setFeedback({ tone: 'error', text: 'I-save muna ang kasalukuyang manuscript bago magbukas ng ibang chapter.' });
      return;
    }
    const existing = episodes.find((entry) => entry.season_number === seriesNumber && entry.episode_number === chapterNumber);
    if (existing) { void open(existing); return; }
    void perform('Ginagawa ang chapter', async () => {
      const { data, error } = await supabase.rpc('kl_admin_create_chapter_v1', {
        p_season: seriesNumber, p_episode: chapterNumber, p_title: title.trim(),
      });
      if (error) throw error;
      const newId = (data as { id?: string } | null)?.id;
      if (!newId) throw new Error('Walang chapter ID na ibinalik ng server.');
      // An existing chapter can be returned on conflict: always load its text.
      const previewResult = await supabase.rpc('kl_admin_preview_v1', { p_episode_id: newId });
      if (previewResult.error) throw previewResult.error;
      const preview = previewResult.data as Preview | null;
      setEditorialRevisionId(preview?.editorial_revision ? preview.revision_id ?? '' : '');
      setEditorialReviewOpen(false); setReviewedEditorialId('');
      const nextTitle = preview?.title ?? title.trim();
      const nextText = preview?.manuscript ?? '';
      setId(newId);
      setTitle(nextTitle);
      setManuscript(nextText); setFormatPreview(false); selectionRef.current = { start: 0, end: 0 };
      setLastSaved({ id: newId, title: nextTitle, manuscript: nextText });
      setPanel('manuscript');
      setPreviewOpen(false);
      setConfirmedPreviewId('');
      await findRecovery(newId, nextTitle, nextText);
      // A temporary list refresh failure must not turn a confirmed create into a failure.
      await refresh().catch(() => undefined);
      setFeedback({ tone: 'success', text: nextText ? 'Existing chapter opened; manuscript preserved.' : 'Chapter created on server. Add its manuscript.' });
    });
  };

  const save = () => {
    if (!id) { setFeedback({ tone: 'error', text: 'Pumili o gumawa muna ng chapter.' }); return; }
    if (title.trim().length < 3 || manuscript.trim().length < 30) {
      setFeedback({ tone: 'error', text: 'Kailangan ng title (3+ characters) at manuscript (30+ characters) bago mag-save.' });
      return;
    }
    const snapshot = { id, title, manuscript };
    void perform('Sine-save ang manuscript', async () => {
      const { data, error } = await supabase.rpc('kl_admin_save_content_v1', {
        p_episode_id: snapshot.id, p_title: snapshot.title, p_manuscript: snapshot.manuscript,
      });
      if (error) throw error;
      const result = data as EditorialResult | null;
      if (!result?.ok) throw new Error('Hindi nakumpirma ng server ang save.');
      setEditorialRevisionId(result.editorial_revision ? result.revision_id ?? '' : '');
      setEditorialReviewOpen(false); setReviewedEditorialId('');
      if ((data as { changed?: boolean }).changed !== false) {
        setPreviewOpen(false);
        setConfirmedPreviewId('');
        setEpisodes((previous) => previous.map((entry) => entry.id === snapshot.id ? { ...entry, preview_ready: false } : entry));
      }
      setLastSaved(snapshot);
      // Do not remove a newer unsaved edit entered while the RPC was in flight.
      const current = valuesRef.current;
      if (current.id === snapshot.id && current.title === snapshot.title &&
          current.manuscript === snapshot.manuscript && user?.id) {
        latestDraftRef.current = null;
        await queueLocal(() => removeKlEditorDraft(user.id, snapshot.id)).catch(() => undefined);
        setRecoveryDraft(null);
      }
      setFeedback({ tone: 'success', text: result.editorial_revision ? 'Editorial revision saved. Ang dating released version, quiz at rewards ay hindi nabago.' : 'Manuscript saved on server.' });
      await refresh().catch(() => undefined); // A failed list refresh must not undo a confirmed save.
    });
  };

  const prepare = () => {
    if (!id) { setFeedback({ tone: 'error', text: 'Pumili muna ng chapter.' }); return; }
    if (!saved) {
      setFeedback({ tone: 'error', text: 'I-save muna ang manuscript bago gumawa ng preview.' });
      return;
    }
    void perform('Inihahanda ang private preview', async () => {
      const { data, error } = await supabase.rpc('kl_admin_prepare_preview_v1', { p_episode_id: id });
      if (error) throw error;
      if (!(data as { ready?: boolean } | null)?.ready) throw new Error('Hindi nakumpirma ng server ang preview.');
      setConfirmedPreviewId(id);
      // Avoid mounting all full-resolution scene artwork during manuscript editing.
      setPreviewOpen(false);
      setFeedback({ tone: 'success', text: 'Private preview prepared on server. Tap Open Private Preview & Media Approvals below; hindi pa public.' });
      await refresh().catch(() => undefined);
    });
  };

  const reviewEditorial = () => {
    if (!saved || !editorialRevisionId) return;
    const revision = editorialRevisionId;
    void perform('Preparing editorial preview', async () => {
      const { data, error } = await supabase.rpc('kl_admin_prepare_preview_v1', { p_episode_id: id });
      if (error) throw error;
      const result = data as { ready?: boolean; editorial_revision?: boolean; revision_id?: string };
      if (!result?.ready || !result.editorial_revision || result.revision_id !== revision)
        throw new Error('Nagbago ang saved revision. Buksan muli ang chapter.');
      setReviewedEditorialId('');
      setEditorialReviewOpen(true);
      setFeedback({ tone: 'info', text: 'Suriin ang buong editorial preview. Ang dating version ay public pa rin.' });
    });
  };
  const publishEditorial = () => {
    if (!saved || !editorialReviewOpen || !editorialRevisionId || reviewedEditorialId !== editorialRevisionId) return;
    const revision = editorialRevisionId;
    void perform('Publishing reviewed editorial revision', async () => {
      const { data, error } = await supabase.rpc('kl_admin_publish_editorial_revision_v1', {
        p_episode_id: id, p_revision_id: revision,
      });
      if (error) throw error;
      const result = data as EditorialResult | null;
      if (result?.reason === 'compatibility_review_required') {
        setFeedback({ tone: 'error', text: 'Saved ang revision, ngunit kailangan ng compatibility review: quiz passages ' + (result.quiz_evidence_conflicts ?? 0) + ', illustration/media ' + (result.media_conflicts ?? 0) + '. Hindi binago ang public version.' });
        return;
      }
      if (!result?.ok || !result.published) throw new Error('Hindi nakumpirma ang publication.');
      setEditorialRevisionId(''); setEditorialReviewOpen(false); setReviewedEditorialId('');
      setFeedback({ tone: 'success', text: 'Editorial revision published. Napanatili ang dating assessment, reading progress at rewards.' });
      await refresh().catch(() => undefined);
    });
  };

  const invalidatePreparedPreview = () => {
    setPreviewOpen(false);
    setConfirmedPreviewId('');
    setEpisodes((previous) => previous.map((entry) => entry.id === id ? { ...entry, preview_ready: false } : entry));
    void refresh().catch(() => undefined);
  };

  return (
    <View style={{ gap: 12, padding: 16, backgroundColor: '#182537', borderRadius: 12 }}>
      <Text style={{ color: '#f1d39b', fontWeight: 'bold', fontSize: 18 }}>KL · Content Creation Studio</Text>
      <Text style={{ color: '#e3e8ef' }}>Create, edit and review private media here. Chapter approval and public release remain in Community Wall KL Admin.</Text>
      {feedback ? (
        <Text accessibilityRole="alert" style={{
          padding: 10, borderRadius: 8,
          backgroundColor: feedback.tone === 'error' ? '#543037' : feedback.tone === 'success' ? '#284d43' : '#293e57',
          color: '#fff',
        }}>{feedback.text}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {episodes.map((episode) => (
          <Pressable key={episode.id} accessibilityRole="button" disabled={workspaceBusy}
            onPress={() => void open(episode)}
            style={{ padding: 10, minHeight: 44, borderRadius: 8, backgroundColor: episode.id === id ? '#426b5c' : '#344a55' }}>
            <Text style={{ color: '#fff' }}>S{episode.season_number} Ch{episode.episode_number} · {episode.title}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: '#fff', fontWeight: '700' }}>Create / Open Chapter</Text>
      <TextInput style={field} keyboardType="numeric" value={season} onChangeText={setSeason} placeholder="Series 1–12" placeholderTextColor="#aeb4bb" />
      <TextInput style={field} keyboardType="numeric" value={chapter} onChangeText={setChapter} placeholder="Chapter 1–30" placeholderTextColor="#aeb4bb" />
      <TextInput style={field} value={title} onChangeText={(text) => { setTitle(text); setRecoveryDraft(null); }} placeholder="Chapter title" placeholderTextColor="#aeb4bb" />
      <Action label={busyAction === 'Ginagawa ang chapter' ? 'Opening…' : 'Create / Open Chapter'} disabled={workspaceBusy} onPress={create} />
      {id ? (
        <>
          <Text style={{ color: '#f1d39b', fontWeight: '700' }}>Chapter workspace · S{season} Ch{chapter}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Action label="Manuscript" disabled={workspaceBusy}
              onPress={() => setPanel('manuscript')} />
            <Action label="Illustrations & Animation" disabled={workspaceBusy}
              onPress={() => { setMediaKind('illustration'); setPanel('media'); }} />
            <Action label="Music ♫" disabled={workspaceBusy}
              onPress={() => { setMediaKind('music'); setPanel('media'); }} />
            <Action label="Ambience" disabled={workspaceBusy}
              onPress={() => { setMediaKind('ambient'); setPanel('media'); }} />
          </View>
          <Text style={{ color: '#b7c8cd' }}>
            {panel === 'media' ? 'Audio, illustrations and animated effects are private until separately approved and released.' :
              'I-save muna ang manuscript bago magtakda ng eksaktong illustration placement.'}
          </Text>
          {panel === 'manuscript' ? (
          <>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Full manuscript · S{season} Ch{chapter}</Text>
          {recoveryDraft ? (
            <View style={{ backgroundColor: '#384a53', borderRadius: 8, padding: 12, gap: 8 }}>
              <Text style={{ color: '#fff' }}>
                May natagpuang local unsaved copy para sa chapter na ito.
                {recoveryDraft.baseTitle !== lastSaved?.title || recoveryDraft.baseManuscript !== lastSaved?.manuscript
                  ? ' Nagbago ang server copy; suriin muna bago mag-save.' : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Action label="Restore local edits" disabled={workspaceBusy} onPress={() => {
                  setTitle(recoveryDraft.title);
                  setManuscript(recoveryDraft.manuscript);
                  setRecoveryDraft(null);
                  setFeedback({ tone: 'info', text: 'Local edits restored. Hindi pa saved sa server; pindutin ang Save Manuscript.' });
                }} />
                <Action label="Discard local copy" disabled={workspaceBusy} onPress={() => {
                  if (user?.id) void queueLocal(() => removeKlEditorDraft(user.id, id)).catch(() => undefined);
                  setRecoveryDraft(null);
                  setFeedback({ tone: 'info', text: 'Local copy discarded. Hindi binago ang server manuscript.' });
                }} />
              </View>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Action label="Italic (I)" disabled={workspaceBusy || formatPreview} onPress={() => {
              const { start, end } = selectionRef.current;
              const next = toggleKlItalic(manuscript, start, end);
              if (next === manuscript) {
                setFeedback({ tone: 'info', text: 'Pumili muna ng salita o pangungusap sa isang linya. Gumamit ng *salita* para sa italic.' });
                return;
              }
              setManuscript(next); setRecoveryDraft(null);
            }} />
            <Action label={pasteBusy ? 'Pasting…' : 'Paste with formatting'} disabled={workspaceBusy || formatPreview} onPress={() => {
              if (pasteLock.current) return;
              pasteLock.current = true; setPasteBusy(true);
              const snapshot = { ...valuesRef.current };
              const range = { ...selectionRef.current };
              void (async () => {
                try {
                  const plain = await Clipboard.getStringAsync();
                  if (!plain) return;
                  const html = await Clipboard.getStringAsync({ preferredFormat: Clipboard.StringFormat.HTML }).catch(() => '');
                  const result = importKlClipboard(plain, html);
                  const current = valuesRef.current;
                  if (current.id !== snapshot.id || current.manuscript !== snapshot.manuscript) {
                    setFeedback({ tone: 'info', text: 'Nagbago ang manuscript habang nagpa-paste. Subukan muli.' });
                    return;
                  }
                  const start = Math.max(0, Math.min(range.start, snapshot.manuscript.length));
                  const end = Math.max(start, Math.min(range.end, snapshot.manuscript.length));
                  setManuscript(snapshot.manuscript.slice(0,start)+result.text+snapshot.manuscript.slice(end));
                  setRecoveryDraft(null); setFormatPreview(true);
                  setFeedback({ tone: 'success', text: result.formatted ? 'Na-paste kasama ang italic formatting.' : 'Na-paste ang text. Walang recoverable na rich-text italic mula sa clipboard.' });
                } catch {
                  setFeedback({ tone: 'error', text: 'Hindi mabasa ang clipboard. Maaaring mag-paste ng Markdown (*salita*) sa editor.' });
                } finally { pasteLock.current = false; setPasteBusy(false); }
              })();
            }} />
            <Action label={formatPreview ? 'Edit text' : 'Formatted preview'} disabled={workspaceBusy} onPress={() => setFormatPreview(current => !current)} />
          </View>
          <Text style={{ color: '#b7c8cd' }}>Gamitin ang Paste with formatting upang mapanatili ang italic mula sa rich-text clipboard. Ang ordinaryong paste ay maaaring plain text lamang.</Text>
          {formatPreview ? (
            <View style={{ gap: 10, padding: 10, backgroundColor: '#243849', borderRadius: 8 }}>
              {splitKlManuscriptBlocks(manuscript).map((p,i) => {
                const runs=splitKlItalics(p, Number(season), Number(chapter));
                return <Text key={i} style={{color:'#fff',fontSize:17,lineHeight:27}}>{runs.some(run=>run.italic) ? runs.map((run,j)=><Text key={j} style={run.italic ? {fontStyle:'italic'} : undefined}>{run.text}</Text>) : p}</Text>;
              })}
            </View>
          ) : (
          <TextInput
            editable={!workspaceBusy}
            onSelectionChange={event => { selectionRef.current = event.nativeEvent.selection; }}
            style={[field, { minHeight: 240, textAlignVertical: 'top' }]}
            multiline
            value={manuscript}
            onChangeText={(text) => { setManuscript(text); setRecoveryDraft(null); }}
            placeholder="Paste complete manuscript here"
            placeholderTextColor="#aeb4bb"
          />
          )}
          <Text style={{ color: dirty ? '#ffe0a8' : '#b7c8cd' }}>
            {dirty ? 'Unsaved changes' : saved ? 'Loaded/saved on server' : 'New draft'}
            {' · '}{manuscript.trim().length} characters (minimum 30 to save)
            {dirty ? ' · Local copy: ' + (localBackupStatus === 'saved' ? 'saved' : localBackupStatus === 'error' ? 'unavailable' : 'saving…') : ''}
          </Text>
          <Action label={busyAction === 'Sine-save ang manuscript' ? 'Saving manuscript…' : 'Save Manuscript'} disabled={workspaceBusy} onPress={save} />
          {editorialRevisionId ? (
            <View style={{ gap: 10, padding: 12, backgroundColor: '#243849', borderRadius: 8 }}>
              <Text style={{ color: '#ffe0a8', fontWeight: '700' }}>Saved editorial revision — dating released chapter pa rin ang public.</Text>
              <Action label="Review Editorial Revision" disabled={workspaceBusy || !saved} onPress={reviewEditorial} />
              {editorialReviewOpen && saved ? (
                <>
                  <KlAdminPreview key={editorialRevisionId} episodeId={id} season={Number(season)} chapter={Number(chapter)}
                    onEditorialLoaded={setReviewedEditorialId} />
                  <Action label="Publish Reviewed Revision" disabled={workspaceBusy || reviewedEditorialId !== editorialRevisionId} onPress={publishEditorial} />
                  <Text style={{color:'#b7c8cd'}}>Publication is allowed only when existing verified quiz evidence and illustration placements remain compatible.</Text>
                </>
              ) : null}
            </View>
          ) : null}
          {feedback ? (
            <Text accessibilityRole="alert" style={{ color: feedback.tone === 'error' ? '#ffb8b8' : '#c7f4d8' }}>
              {feedback.text}
            </Text>
          ) : null}
          </>
          ) : (
          <>
          <KlAdminMediaUpload key={id} episodeId={id} episodeNumber={Number(chapter)}
            manuscript={manuscript} manuscriptSaved={saved} initialKind={mediaKind}
            onBusyChange={setMediaBusy} onUploaded={invalidatePreparedPreview}
            onPreviewInvalidated={invalidatePreparedPreview}
            approvalRefreshToken={approvalRefreshToken} />
          <Text style={{ color: '#b7c8cd' }}>Scene photos are optional. Save the manuscript and prepare its private preview without uploading artwork. If you add illustrations (up to 12), save each exact paragraph placement and approve each uploaded media file before chapter approval.</Text>
          <Action label={busyAction === 'Inihahanda ang private preview' ? 'Preparing…' : 'Prepare Private Preview'}
            disabled={workspaceBusy} onPress={prepare} />
          {previewReady ? (
            <>
              <Text style={{ color: '#c7f4d8' }}>Private preview prepared on server. You can inspect and approve each media file here; the chapter stays private.</Text>
              <Action label={previewOpen ? 'Hide Private Preview & Media Approvals' : 'Open Private Preview & Media Approvals'}
                disabled={workspaceBusy || !saved} onPress={() => setPreviewOpen((current) => !current)} />
              {previewOpen && saved ? (
                <KlAdminPreview episodeId={id} season={Number(season)} chapter={Number(chapter)} onApproved={() => setApprovalRefreshToken((value) => value + 1)} />
              ) : null}
            </>
          ) : (
            <Text style={{ color: '#ffe0a8' }}>No prepared preview yet. Prepare it first, then review and approve individual media.</Text>
          )}
          {feedback ? (
            <Text accessibilityRole="alert" style={{ color: feedback.tone === 'error' ? '#ffb8b8' : '#c7f4d8' }}>
              {feedback.text}
            </Text>
          ) : null}
          </>
          )}
        </>
      ) : null}
    </View>
  );
}
