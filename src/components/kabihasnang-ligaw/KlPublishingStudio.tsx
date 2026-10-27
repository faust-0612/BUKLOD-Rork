import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import KlAdminMediaUpload from './KlAdminMediaUpload';
import KlAdminPreview from './KlAdminPreview';

type Episode = {
  id: string;
  title: string;
  season_number: number;
  episode_number: number;
  status: string;
};
type Feedback = { tone: 'success' | 'error' | 'info'; text: string };
type Preview = { manuscript?: string | null; title?: string | null };

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
  const [season, setSeason] = useState('1');
  const [chapter, setChapter] = useState('2');
  const [busyAction, setBusyAction] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [lastSaved, setLastSaved] = useState<{ id: string; title: string; manuscript: string } | null>(null);
  const [panel, setPanel] = useState<'manuscript' | 'media'>('manuscript');
  const [mediaKind, setMediaKind] = useState<'illustration' | 'cover' | 'music' | 'ambient'>('illustration');
  const [inlinePreview, setInlinePreview] = useState(false);
  const lock = useRef(false);

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
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : 'Hindi natuloy ang request. Subukan muli.' });
    } finally {
      lock.current = false;
      setBusyAction('');
    }
  };

  const dirty = !!id && !!lastSaved && lastSaved.id === id
    && (lastSaved.title !== title || lastSaved.manuscript !== manuscript);
  const saved = !!id && !!lastSaved && lastSaved.id === id && !dirty;

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
      const nextTitle = preview.title ?? episode.title;
      const nextText = preview.manuscript ?? '';
      setId(episode.id);
      setTitle(nextTitle);
      setManuscript(nextText);
      setSeason(String(episode.season_number));
      setChapter(String(episode.episode_number));
      setLastSaved({ id: episode.id, title: nextTitle, manuscript: nextText });
      setPanel('manuscript');
      setInlinePreview(false);
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
      const nextTitle = preview?.title ?? title.trim();
      const nextText = preview?.manuscript ?? '';
      setId(newId);
      setTitle(nextTitle);
      setManuscript(nextText);
      setLastSaved({ id: newId, title: nextTitle, manuscript: nextText });
      setPanel('manuscript');
      setInlinePreview(false);
      await refresh();
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
      const result = data as { ok?: boolean; changed?: boolean } | null;
      if (!result?.ok) throw new Error('Hindi nakumpirma ng server ang save.');
      setLastSaved(snapshot);
      setFeedback({ tone: 'success', text: result.changed === false
        ? 'Manuscript unchanged; already saved on server. Existing scene approvals and preview preserved.'
        : 'Manuscript saved on server. Draft pa ito; hindi pa public. Scene anchors are preserved if still valid.' });
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
      const result = data as { ready?: boolean; changed?: boolean } | null;
      if (!result?.ready) throw new Error('Hindi nakumpirma ng server ang preview.');
      setFeedback({ tone: 'success', text: result.changed === false
        ? 'Private preview already prepared. Same version preserved; walang nabago sa server.'
        : 'Private preview ready sa Community Wall → KL → Admin. Hindi pa published.' });
      await refresh().catch(() => undefined);
    });
  };

  return (
    <View style={{ gap: 12, padding: 16, backgroundColor: '#182537', borderRadius: 12 }}>
      <Text style={{ color: '#f1d39b', fontWeight: 'bold', fontSize: 18 }}>KL · Content Creation Studio</Text>
      <Text style={{ color: '#e3e8ef' }}>Create, edit at private preview dito. Ang approval at release ay nasa Community Wall KL Admin.</Text>
      {feedback ? (
        <Text accessibilityRole="alert" style={{
          padding: 10, borderRadius: 8,
          backgroundColor: feedback.tone === 'error' ? '#543037' : feedback.tone === 'success' ? '#284d43' : '#293e57',
          color: '#fff',
        }}>{feedback.text}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {episodes.map((episode) => (
          <Pressable key={episode.id} accessibilityRole="button" disabled={!!busyAction}
            onPress={() => void open(episode)}
            style={{ padding: 10, minHeight: 44, borderRadius: 8, backgroundColor: episode.id === id ? '#426b5c' : '#344a55' }}>
            <Text style={{ color: '#fff' }}>S{episode.season_number} Ch{episode.episode_number} · {episode.title}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: '#fff', fontWeight: '700' }}>Create / Open Chapter</Text>
      <TextInput style={field} keyboardType="numeric" value={season} onChangeText={setSeason} placeholder="Series 1–12" placeholderTextColor="#aeb4bb" />
      <TextInput style={field} keyboardType="numeric" value={chapter} onChangeText={setChapter} placeholder="Chapter 1–30" placeholderTextColor="#aeb4bb" />
      <TextInput style={field} value={title} onChangeText={setTitle} placeholder="Chapter title" placeholderTextColor="#aeb4bb" />
      <Action label={busyAction === 'Ginagawa ang chapter' ? 'Opening…' : 'Create / Open Chapter'} disabled={!!busyAction} onPress={create} />
      {id ? (
        <>
          <Text style={{ color: '#f1d39b', fontWeight: '700' }}>Chapter workspace · S{season} Ch{chapter}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Action label="Manuscript" disabled={!!busyAction}
              onPress={() => setPanel('manuscript')} />
            <Action label="Illustrations & Animation" disabled={!!busyAction}
              onPress={() => { setMediaKind('illustration'); setPanel('media'); }} />
            <Action label="Music ♫" disabled={!!busyAction}
              onPress={() => { setMediaKind('music'); setPanel('media'); }} />
            <Action label="Ambience" disabled={!!busyAction}
              onPress={() => { setMediaKind('ambient'); setPanel('media'); }} />
          </View>
          <Text style={{ color: '#b7c8cd' }}>
            {panel === 'media' ? 'Audio, illustrations and animated effects are private until separately approved and released.' :
              'I-save muna ang manuscript bago magtakda ng eksaktong illustration placement.'}
          </Text>
          {panel === 'manuscript' ? (
          <>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Full manuscript · S{season} Ch{chapter}</Text>
          <TextInput
            style={[field, { minHeight: 240, textAlignVertical: 'top' }]}
            multiline
            value={manuscript}
            onChangeText={setManuscript}
            placeholder="Paste complete manuscript here"
            placeholderTextColor="#aeb4bb"
          />
          <Text style={{ color: dirty ? '#ffe0a8' : '#b7c8cd' }}>
            {dirty ? 'Unsaved changes' : saved ? 'Loaded/saved on server' : 'New draft'}
            {' · '}{manuscript.trim().length} characters (minimum 30 to save)
          </Text>
          <Action label={busyAction === 'Sine-save ang manuscript' ? 'Saving manuscript…' : 'Save Manuscript'} disabled={!!busyAction} onPress={save} />
          {feedback ? (
            <Text accessibilityRole="alert" style={{ color: feedback.tone === 'error' ? '#ffb8b8' : '#c7f4d8' }}>
              {feedback.text}
            </Text>
          ) : null}
          </>
          ) : (
          <>
          <Action label={inlinePreview ? 'Hide story draft & inline approvals' : 'View story draft & approve scenes inline'}
            disabled={!!busyAction} onPress={() => {
              if (!saved) { setFeedback({ tone: 'error', text: 'I-save muna ang manuscript bago buksan ang server draft preview.' }); return; }
              setInlinePreview((value) => !value);
              setFeedback({ tone: 'info', text: inlinePreview ? 'Private story preview closed.' : 'Private draft opened below. Approve each artwork beside its scene; hindi pa public.' });
            }} />
          {inlinePreview && saved ? <KlAdminPreview episodeId={id} /> : null}
          <KlAdminMediaUpload key={id} episodeId={id} episodeNumber={Number(chapter)}
            manuscript={manuscript} manuscriptSaved={saved} initialKind={mediaKind} />
          <Text style={{ color: '#b7c8cd' }}>Preview requires 2–3 illustrations with exact saved paragraph placements.</Text>
          <Action label={busyAction === 'Inihahanda ang private preview' ? 'Preparing…' : 'Prepare Preview for Community Wall KL Admin'}
            disabled={!!busyAction} onPress={prepare} />
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
