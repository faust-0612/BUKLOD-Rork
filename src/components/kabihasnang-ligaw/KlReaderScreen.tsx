import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBuklodReduceMotion } from '@/components/HomeMotion';
import KlAudioControls from '@/components/kabihasnang-ligaw/KlAudioControls';
import KlCoverImage from '@/components/kabihasnang-ligaw/KlCoverImage';
import { klDatabaseId } from '@/components/kabihasnang-ligaw/KlAdminMediaUpload';
import KlAdminPreview from '@/components/kabihasnang-ligaw/KlAdminPreview';
import KlChapterAudio from '@/components/kabihasnang-ligaw/KlChapterAudio';
import { KlSceneEffect, type SceneEffect } from '@/components/kabihasnang-ligaw/KlSceneEffect';
import KlLiveDiscussion from '@/components/kabihasnang-ligaw/KlLiveDiscussion';
import KlSceneMotion from '@/components/kabihasnang-ligaw/KlSceneMotion';
import {
  buildAssetGate,
  buildCatalogEpisodes,
  buildStoryboard,
  KL_AUTHOR,
  KL_CHAPTER_ONE_LIVING_SCOPE,
  KL_SEASON_ONE_TITLE,
} from '@/lib/kabihasnang-ligaw/catalog';
import { klCopy } from '@/lib/kabihasnang-ligaw/copy';
import { memberReadable } from '@/lib/kabihasnang-ligaw/gates';
import { isLowBandwidth, resolveLivingMotion, visibleLivingLayers } from '@/lib/kabihasnang-ligaw/livingMotion';
import { dictionaryByName, KL_DICTIONARY, splitDictionaryTerms } from '@/lib/kabihasnang-ligaw/dictionary';
import { KL_SCENE_STILLS } from '@/lib/kabihasnang-ligaw/sceneStills';
import { paragraphDisplayText, splitCanonicalParagraphs } from '@/lib/kabihasnang-ligaw/manuscript';
import { illustrationsAtParagraph } from '@/lib/kabihasnang-ligaw/mediaPlacement';
import { journeySummary } from '@/lib/kabihasnang-ligaw/journey';
import {
  DEFAULT_READER_CACHE,
  queueReaderIssue,
  rememberReleasedReading,
  rememberScroll,
  sanitizeReaderCache,
  selectMemberReading,
  type ReaderCache,
} from '@/lib/kabihasnang-ligaw/readerSession';
import { KL_RPC, adminActionArgs } from '@/lib/kabihasnang-ligaw/rpc';
import { otherAudioPlaying } from '@/lib/kabihasnang-ligaw/externalAudioState';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';

const EPISODES = buildCatalogEpisodes();
type ReleasedChapter = { id: string; season_number: number; episode_number: number; title: string };

function displayChapterTitle(episode: (typeof EPISODES)[number], released?: ReleasedChapter): string {
  const source = (released?.title ?? episode.title).trim();
  if (episode.kind === 'panimula') return `Panimula: ${source}`;
  const name = source.replace(/^Kabanata\s+\d+\s*:\s*/i, '').trim();
  if (/^Kabanata\s+\d+$/i.test(name)) return `Kabanata ${episode.episodeNumber}`;
  return `Kabanata ${episode.episodeNumber}: ${name}`;
}

const ASSETS = buildAssetGate();
const STORYBOARD = buildStoryboard();
type DynamicMedia = {
  kind: string; placement: number; path: string;
  anchor?: string | null; side?: string | null;
  effect?: SceneEffect | null; intensity?: number | null;
};

function cacheKey(userId: string | null): string {
  return `kl.reader.v1.${userId ?? 'device'}`;
}

export default function KlReaderScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useBuklodReduceMotion();
  const { online } = useNetwork();
  const { user, hasRole } = useAuth();
  const isSystemAdmin = hasRole('system_admin');
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null);
  const [adminFeedback, setAdminFeedback] = useState('');
  const [adminFeedbackEpisodeId, setAdminFeedbackEpisodeId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [releaseTarget, setReleaseTarget] = useState<string | null>(null);
  const [previewTarget,setPreviewTarget]=useState<string|null>(null);
  const [cache, setCache] = useState<ReaderCache>(DEFAULT_READER_CACHE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string | null>(null);
  const [musicIntent, setMusicIntent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [busy, setBusy] = useState(false);
  const [appActive, setAppActive] = useState(true);
  const [externalAudio, setExternalAudio] = useState(false);
  const [cellGeneration, setCellGeneration] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState('unknown');
  const [serverState, setServerState] = useState<'unread' | 'readable' | 'hidden' | 'unknown'>('unread');
  const [serverText, setServerText] = useState<string | null>(null);
  const [releasedChapters, setReleasedChapters] = useState<ReleasedChapter[]>([]);
  const [journeyResult, setJourneyResult] = useState<{ userId: string; completed: number } | null>(null);
  const [journeyRefreshToken, setJourneyRefreshToken] = useState(0);
  const [dynamicMedia, setDynamicMedia] = useState<DynamicMedia[]>([]);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [mediaErrors, setMediaErrors] = useState<Record<string, string>>({});
  const [rewardFeedback, setRewardFeedback] = useState('');
  const [viewStart, setViewStart] = useState<number | null>(null);
  const [viewEnd, setViewEnd] = useState<number | null>(null);
  const paragraphY = useRef<Record<number, number>>({});
  const readerTop = useRef(0);
  const openSequence = useRef(0);

  const compact = width < 420;
  const bodySize = Math.round(19 * cache.textScale);
  const releasedIds = releasedChapters.map((chapter) => chapter.id);
  const selected = EPISODES.find((episode) => episode.id === selectedId) ?? null;
  const selectedTitle = selected ? displayChapterTitle(selected, releasedChapters.find((chapter) => chapter.season_number === 1 && chapter.episode_number === selected.episodeNumber)) : '';
  const completedChapters = journeyResult && journeyResult.userId === user?.id ? journeyResult.completed : null;
  const selectedAssets = ASSETS.filter((asset) => asset.episodeId === selected?.id);
  const decision = selected ? memberReadable(selected, selectedAssets, new Date(), STORYBOARD) : null;
  const lowBandwidth = isLowBandwidth({
    online,
    connectionType,
    cellularGeneration: cellGeneration,
    userDataSaver: cache.dataSaver,
  });
  const reading = selectMemberReading({
    locallyReadable: decision?.readable === true || Boolean(selected && releasedIds.includes(klDatabaseId(selected.episodeNumber))),
    serverState,
    serverText,
    bundledText: selected?.prose ?? null,
    cachedText: selected ? cache.releasedProse[selected.id] ?? null : null,
  });
  const paragraphs = reading.text ? splitCanonicalParagraphs(reading.text, selected?.episodeNumber ?? 0) : [];
  const sceneRows = STORYBOARD.filter((row) => row.episodeId === selected?.id);
  const revealStart = sceneRows.find((row) => row.spoiler)?.paragraphRange?.start ?? null;
  const living = visibleLivingLayers({
    layers: KL_CHAPTER_ONE_LIVING_SCOPE.filter((layer) => layer.episodeId === selected?.id),
    viewStart,
    viewEnd,
    revealParagraph: revealStart,
  });
  const motion = resolveLivingMotion({
    boundToManuscriptParagraph: living.length > 0,
    manuscriptApprovedComplete: Boolean(
      selected && selected.manuscriptStatus === 'approved_complete' && selected.proseComplete,
    ),
    ownerApproved: selectedAssets.some((asset) => asset.kind === 'illustration' && asset.approved),
    depictsStory: true,
    technicalFixture: false,
    allowUnapprovedPreview: false,
    visible: viewStart != null && appActive,
    appActive,
    reduceMotion,
    userMotionEnabled: cache.motionEnabled,
    batterySaver: cache.batterySaver,
    lowBandwidth,
    layers: living,
  });
  const journey = journeySummary(completedChapters ?? 0, 30);
  const music = ASSETS.find((asset) => asset.id === 'asset-music');
  const ambient = ASSETS.find((asset) => asset.id === 'asset-ambient');

  const persist = useCallback(async (next: ReaderCache) => {
    setCache(next);
    try {
      await AsyncStorage.setItem(cacheKey(user?.id ?? null), JSON.stringify(next));
    } catch {
      setNotice(klCopy.couldNotOpen);
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(cacheKey(user?.id ?? null)).then((raw) => {
      if (!active || !raw) return;
      try {
        const parsed = sanitizeReaderCache(JSON.parse(raw) as ReaderCache);
        setCache(parsed);
        const restored = EPISODES.find((episode) => episode.id === parsed.lastEpisodeId);
        const restoredAssets = ASSETS.filter((asset) => asset.episodeId === restored?.id);
        const restoredReadable = restored
          ? memberReadable(restored, restoredAssets, new Date(), STORYBOARD).readable
          : false;
        setSelectedId(restoredReadable ? parsed.lastEpisodeId : null);
      } catch {
        setNotice(klCopy.couldNotOpen);
      }
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const appSub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    const timer = setInterval(() => setExternalAudio(otherAudioPlaying()), 1000);
    const netSub = NetInfo.addEventListener((state) => {
      setConnectionType(String(state.type ?? 'unknown'));
      const details = state.details as { cellularGeneration?: string } | null;
      setCellGeneration(details?.cellularGeneration ?? null);
    });
    return () => {
      appSub.remove();
      clearInterval(timer);
      netSub();
    };
  }, []);

  const decideEpisode = async (episodeId: string, action: 'approve' | 'reject' | 'release', notes = '') => {
    if (!isSystemAdmin || adminBusyId) return;
    if (action === 'reject' && !notes.trim()) { setAdminFeedback('Maglagay ng dahilan ng rejection.'); return; }
    setAdminBusyId(episodeId);
    setAdminFeedbackEpisodeId(episodeId);
    setAdminFeedback('Pinoproseso ang desisyon…');
    try {
      const targetEpisode = EPISODES.find((item) => item.id === episodeId);
      if (!targetEpisode) throw new Error('Chapter not found');
      const { error } = await supabase.rpc(KL_RPC.adminAction, adminActionArgs({ action, episodeId: klDatabaseId(targetEpisode.episodeNumber), notes }));
      if (error) throw error;
      if (action === 'release') {
        const { data: libraryData, error: libraryError } = await supabase.rpc(KL_RPC.listLibrary);
        if (!libraryError && Array.isArray(libraryData)) setReleasedChapters(libraryData as ReleasedChapter[]);
      }
      setAdminFeedback(action === 'approve' ? 'Naaprubahan sa server. Hindi pa inilalabas ang kabanata.' : action === 'release' ? 'Na-release na ang kabanata sa server.' : 'Ibinalik sa draft sa server.');
      setRejectTarget(null);
      setReleaseTarget(null);
      setRejectNotes('');
    } catch (error) {
      setAdminFeedback(error instanceof Error ? `Hindi na-save: ${error.message}` : 'Hindi na-save ang desisyon. Subukan muli.');
    } finally { setAdminBusyId(null); }
  };

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const { data: libraryData, error } = await supabase.rpc(KL_RPC.listLibrary);
      setJourneyRefreshToken((token) => token + 1);
      if (!error && Array.isArray(libraryData)) setReleasedChapters(libraryData as ReleasedChapter[]);
      if (error) {
        await persist(queueReaderIssue(cache, {
          kind: 'library',
          detail: 'library_refresh_failed',
          at: new Date().toISOString(),
        }));
        setNotice(online ? klCopy.couldNotOpen : klCopy.weakNetwork);
      } else {
        setNotice(online ? null : klCopy.weakNetwork);
      }
    } catch {
      setNotice(klCopy.couldNotOpen);
    } finally {
      setBusy(false);
    }
  }, [cache, online, persist]);

  useEffect(() => {
    let active = true;
    void supabase.rpc(KL_RPC.listLibrary).then(({ data, error }) => {
      if (active && !error && Array.isArray(data)) {
        setReleasedChapters(data as ReleasedChapter[]);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const userId = user?.id;
    if (!userId) return () => { active = false; };
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('kl_my_story_journey_v1');
        if (!active || error || !data || typeof data !== 'object') return;
        const count = Number((data as { completed_chapters?: unknown }).completed_chapters);
        if (Number.isFinite(count)) setJourneyResult({ userId, completed: Math.max(0, count) });
      } catch { /* Offline and network failures must not block reading. */ }
    })();
    return () => { active = false; };
  }, [user?.id, journeyRefreshToken]);

  useEffect(() => {
    if (!selected || serverState !== 'readable' || !appActive || !online) return;
    const episodeId = klDatabaseId(selected.episodeNumber);
    const timer = setInterval(() => {
      void supabase.rpc('kl_reading_progress_v1', { p_episode_id: episodeId, p_action: 'ping' });
    }, 30000);
    return () => clearInterval(timer);
  }, [selected?.episodeNumber, serverState, appActive, online]);

  const finishChapter = async () => {
    if (!selected) return;
    const { data, error } = await supabase.rpc('kl_reading_progress_v1', {
      p_episode_id: klDatabaseId(selected.episodeNumber), p_action: 'complete',
    });
    if (error) { setRewardFeedback(error.message); return; }
    const result = data as { new_completion?: boolean; points_awarded?: number; completed?: boolean };
    setRewardFeedback(result?.completed === false ? 'Kailangan muna ng sapat na oras ng pagbabasa.' :
      result?.new_completion ? 'Natapos ang kabanata · +7 BUKLOD Points' : 'Naitala na ang pagkumpleto sa kabanatang ito.');
    if (result?.completed !== false) setJourneyRefreshToken((token) => token + 1);
  };

  const syncViewport = (scrollY: number) => {
    const entries = Object.entries(paragraphY.current)
      .map(([index, y]) => ({ index: Number(index), y: y + readerTop.current }))
      .sort((left, right) => left.y - right.y);
    const top = scrollY + 24;
    const bottom = scrollY + Math.max(320, height);
    let start: number | null = null;
    let end: number | null = null;
    for (let index = 0; index < entries.length; index += 1) {
      const current = entries[index];
      const nextY = entries[index + 1]?.y ?? current.y + 240;
      if (nextY > top && current.y < bottom) {
        if (start == null) start = current.index;
        end = current.index;
      }
    }
    setViewStart(start);
    setViewEnd(end);
  };

  const openEpisode = async (episodeId: string) => {
    const sequence = ++openSequence.current;
    const episode = EPISODES.find((item) => item.id === episodeId);
    if (!episode) return;
    const episodeAssets = ASSETS.filter((asset) => asset.episodeId === episodeId);
    const readable = memberReadable(episode, episodeAssets, new Date(), STORYBOARD).readable;
    paragraphY.current = {};
    setViewStart(null);
    setViewEnd(null);
    setServerState('unread');
    setServerText(null);
    setDynamicMedia([]);
    setMediaUrls({});
    setMediaErrors({});
    setRewardFeedback('');
    setSelectedId(episodeId);
    setGlossaryOpen(false);
    let nextCache = rememberScroll(cache, episodeId, 0, readable);
    try {
      const dbId = klDatabaseId(episode.episodeNumber);
      const { data, error } = await supabase.rpc(KL_RPC.readEpisode, { p_episode_id: dbId });
      if (sequence !== openSequence.current) return;
      if (error || !data || typeof data !== 'object') {
        setServerState('unknown');
      } else {
        const payload = data as { readable?: boolean; content?: { text?: string }[] };
        if (payload.readable === true && Array.isArray(payload.content)) {
          const text = payload.content.map((paragraph) => paragraph.text ?? '').filter(Boolean).join('\n\n');
          setServerText(text);
          setServerState('readable');
          void supabase.rpc('kl_reading_progress_v1', { p_episode_id: dbId, p_action: 'start' });
          const { data: media } = await supabase.rpc('kl_episode_media_v1', { p_episode_id: dbId });
          if (sequence !== openSequence.current) return;
          if (Array.isArray(media)) {
            const items = media as DynamicMedia[];
            const signed = await Promise.all(items.map(async (item) => {
              const key = item.kind + ':' + item.placement;
              try {
                const result = await supabase.storage.from('kl-publishing').createSignedUrl(item.path, 3600);
                return { key, url: result.data?.signedUrl, error: result.error?.message };
              } catch (cause) {
                return { key, error: cause instanceof Error ? cause.message : 'Media URL unavailable' };
              }
            }));
            if (sequence !== openSequence.current) return;
            const urls: Record<string, string> = {};
            const failures: Record<string, string> = {};
            signed.forEach((item) => {
              if (item.url) urls[item.key] = item.url;
              else failures[item.key] = item.error ?? 'Media signing failed';
            });
            setDynamicMedia(items);
            setMediaUrls(urls);
            setMediaErrors(failures);
          }
          nextCache = rememberReleasedReading(nextCache, episodeId, text, true);
        } else {
          setServerState('hidden');
          setServerText(null);
          nextCache = rememberReleasedReading(nextCache, episodeId, null, false);
        }
      }
    } catch {
      setServerState('unknown');
      setNotice(online ? klCopy.couldNotOpen : klCopy.weakNetwork);
    }
    if (sequence === openSequence.current) await persist(nextCache);
  };
  const episodeReadable = (episodeId: string) => {
    const fromCatalog = EPISODES.find((item) => item.id === episodeId);
    if (fromCatalog && releasedIds.includes(klDatabaseId(fromCatalog.episodeNumber))) return true;
    const episode = EPISODES.find((item) => item.id === episodeId);
    if (!episode) return false;
    const episodeAssets = ASSETS.filter((asset) => asset.episodeId === episodeId);
    return memberReadable(episode, episodeAssets, new Date(), STORYBOARD).readable;
  };

  const scrollTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const closeReader = () => {
    openSequence.current += 1;
    setSelectedId(null);
    setOpenTerm(null);
    setGlossaryOpen(false);
    setLockedId(null);
    scrollTop();
  };

  const openReadable = (episodeId: string) => {
    if (!episodeReadable(episodeId)) {
      setLockedId(episodeId);
      setSelectedId(null);
      return;
    }
    setLockedId(null);
    scrollTop();
    void openEpisode(episodeId);
  };

  const selectedIndex = EPISODES.findIndex((episode) => episode.id === selected?.id);
  const previousEpisode = selectedIndex > 0 ? EPISODES[selectedIndex - 1] : null;
  const nextEpisode = selectedIndex >= 0 && selectedIndex < EPISODES.length - 1
    ? EPISODES[selectedIndex + 1]
    : null;
  const openTermEntry = openTerm ? dictionaryByName(openTerm) : null;
  const readingOpen = Boolean(selected && paragraphs.length > 0);
  const liveReleased = Boolean(selected && (decision?.readable || releasedIds.includes(klDatabaseId(selected.episodeNumber))));

  const cycleVolume = (channel: 'music' | 'ambient') => {
    const steps = [0.3, 0.6, 1];
    if (channel === 'music') {
      const next = steps.find((step) => step > cache.musicVolume) ?? steps[0];
      void persist({ ...cache, musicVolume: next });
      return;
    }
    const next = steps.find((step) => step > cache.ambientVolume) ?? steps[0];
    void persist({ ...cache, ambientVolume: next });
  };

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingHorizontal: compact ? 16 : 24, paddingTop: 18 + insets.top }]}
        scrollEventThrottle={32}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => syncViewport(event.nativeEvent.contentOffset.y)}
      >
        <Stack.Screen options={{ title: selected ? selectedTitle : 'Kabihasnang Ligaw' }} />
        {readingOpen && selected ? (
          <View
            style={styles.reader}
            onLayout={(event) => {
              readerTop.current = event.nativeEvent.layout.y;
            }}
          >
            <View style={styles.nav}>
              <IconButton icon="arrow-left" label={klCopy.back} onPress={closeReader} />
              <IconButton
                icon="chevron-left"
                label="Nakaraang kabanata"
                disabled={!previousEpisode || !episodeReadable(previousEpisode.id)}
                onPress={() => previousEpisode && openReadable(previousEpisode.id)}
              />
              <Text style={styles.navTitle} numberOfLines={1}>{selectedTitle}</Text>
              <IconButton
                icon="chevron-right"
                label="Susunod na kabanata"
                disabled={!nextEpisode}
                onPress={() => {
                  if (!nextEpisode) return;
                  if (episodeReadable(nextEpisode.id)) {
                    openReadable(nextEpisode.id);
                    return;
                  }
                  setLockedId(nextEpisode.id);
                }}
              />
            </View>
            {lockedId && nextEpisode && lockedId === nextEpisode.id ? (
              <Text style={styles.meta}>{klCopy.nextLocked} {klCopy.lockedDetail}</Text>
            ) : null}
            <KlCoverImage variant="card" lowBandwidth={false} />
            <Text style={styles.kicker}>
              {selected.kind === 'panimula' ? 'PANIMULA' : `KABANATA ${String(selected.episodeNumber).padStart(2, '0')}`}
            </Text>
            <Text style={[styles.chapter, compact && styles.titleCompact]}>{selectedTitle}</Text>
            {mediaUrls['music:0'] || mediaUrls['ambient:0'] ? (
              <KlChapterAudio key={selected.id} music={mediaUrls['music:0']} ambient={mediaUrls['ambient:0']} autoPlay />
            ) : <KlAudioControls
              musicStatus={music?.classification ?? 'MISSING'}
              ambientStatus={ambient?.classification ?? 'MISSING'}
              otherAudioPlaying={externalAudio}
              musicMuted={cache.musicMuted}
              ambientMuted={cache.ambientMuted}
              musicVolume={cache.musicVolume}
              ambientVolume={cache.ambientVolume}
              musicIntent={musicIntent}
              onTogglePlay={() => setMusicIntent((intent) => !intent)}
              onToggleMute={(channel) => void persist(channel === 'music'
                ? { ...cache, musicMuted: !cache.musicMuted }
                : { ...cache, ambientMuted: !cache.ambientMuted })}
              onCycleVolume={cycleVolume}
            />}
            {paragraphs.map((paragraph) => {
              const scene = sceneRows.find((row) => row.paragraphRange?.start === paragraph.index);
              const still = scene?.sceneId ? KL_SCENE_STILLS[scene.sceneId] : undefined;
              // The server records the exact manuscript sentence, not a fractional chapter position.
              const beforeImages = illustrationsAtParagraph(dynamicMedia, paragraph.text, 'before');
              const afterImages = illustrationsAtParagraph(dynamicMedia, paragraph.text, 'after');
              const hasAnchoredImage = beforeImages.length + afterImages.length > 0;
              const renderIllustration = (item: DynamicMedia) => {
                const key = item.kind + ':' + item.placement;
                const uri = mediaUrls[key];
                return !uri || mediaErrors[key] ? (
                  <View key={key} style={{ padding: 12, backgroundColor: '#463139', borderRadius: 9 }}>
                    <Text style={{ color: '#fff' }}>Scene {item.placement}: hindi ma-load ang illustration. Subukang buksan muli ang chapter.</Text>
                  </View>
                ) : (
                  <View key={key} style={styles.scene}>
                    <Image source={{ uri }} contentFit="contain" cachePolicy="memory-disk"
                      accessibilityLabel={'Larawan ng eksena ' + item.placement}
                      onError={() => setMediaErrors((previous) => ({ ...previous, [key]: 'Image decode failed' }))}
                      style={{ width: '100%', height: '100%' }} />
                    <KlSceneEffect effect={item.effect ?? 'none'} intensity={item.intensity ?? 30}
                      active={cache.motionEnabled && appActive && !reduceMotion && viewEnd != null
                        && paragraph.index <= viewEnd && (viewStart == null || paragraph.index >= viewStart)} />
                  </View>
                );
              };
              const holdSpoiler = Boolean(
                scene?.spoiler
                && (scene.paragraphRange == null || viewEnd == null || viewEnd < scene.paragraphRange.start),
              );
              return (
                <View
                  key={paragraph.id}
                  testID={paragraph.id}
                  onLayout={(event) => {
                    paragraphY.current[paragraph.index] = event.nativeEvent.layout.y;
                  }}
                  style={styles.paragraph}
                >
                  {!holdSpoiler ? beforeImages.map(renderIllustration) : null}
                  {!hasAnchoredImage && still && !holdSpoiler ? (
                    <View style={styles.scene}>
                      <Image source={still}
                        contentFit="cover" cachePolicy="memory-disk" accessibilityLabel="Larawan ng eksena"
                        style={{ width: '100%', height: '100%' }} />
                    </View>
                  ) : null}
                  <Text
                    style={[
                      paragraph.kind === 'heading' ? styles.kicker : styles.body,
                      paragraph.kind === 'body' && { fontSize: bodySize, lineHeight: Math.round(bodySize * 1.65) },
                    ]}
                  >
                    {splitDictionaryTerms(paragraphDisplayText(paragraph)).map((part, index) => (
                      part.term ? (
                        <Text
                          key={`${paragraph.id}-${index}`}
                          style={styles.term}
                          accessibilityRole="link"
                          accessibilityLabel={part.term}
                          onPress={() => setOpenTerm(part.term)}
                        >
                          {part.text}
                        </Text>
                      ) : (
                        <Text key={`${paragraph.id}-${index}`}>{part.text}</Text>
                      )
                    ))}
                  </Text>
                  {!holdSpoiler ? afterImages.map(renderIllustration) : null}
                </View>
              );
            })}
            <KlSceneMotion animate={motion.animate} layers={motion.layers} />
            <View style={styles.row}>
              <IconButton
                icon="minus"
                label={klCopy.textSmaller}
                onPress={() => void persist({ ...cache, textScale: Math.max(0.85, cache.textScale - 0.1) })}
              />
              <IconButton
                icon="plus"
                label={klCopy.textLarger}
                onPress={() => void persist({ ...cache, textScale: Math.min(1.35, cache.textScale + 0.1) })}
              />
              <IconButton
                icon={cache.motionEnabled ? 'animation-play' : 'animation-outline'}
                label={klCopy.motion}
                active={cache.motionEnabled}
                onPress={() => void persist({ ...cache, motionEnabled: !cache.motionEnabled })}
              />
              <IconButton
                icon="battery"
                label={klCopy.battery}
                active={cache.batterySaver}
                onPress={() => void persist({ ...cache, batterySaver: !cache.batterySaver })}
              />
              <IconButton
                icon="signal-cellular-1"
                label={klCopy.dataSaver}
                active={cache.dataSaver}
                onPress={() => void persist({ ...cache, dataSaver: !cache.dataSaver })}
              />
              <IconButton
                icon={cache.bookmarkLabel ? 'bookmark' : 'bookmark-outline'}
                label={klCopy.bookmark}
                active={Boolean(cache.bookmarkLabel)}
                onPress={() => {
                  const label = selectedTitle;
                  void persist({ ...cache, bookmarkLabel: label, lastEpisodeId: selected.id });
                  setNotice(klCopy.bookmarkSaved);
                }}
              />
              <IconButton
                icon="book-open-variant"
                label={klCopy.glossary}
                active={glossaryOpen}
                onPress={() => setGlossaryOpen((open) => !open)}
              />
            </View>
            {glossaryOpen ? (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>{klCopy.glossary}</Text>
                <Text style={styles.meta}>{klCopy.glossaryNote}</Text>
                {KL_DICTIONARY.map((entry) => (
                  <Pressable key={entry.name} accessibilityRole="button" onPress={() => setOpenTerm(entry.name)}>
                    <Text style={styles.term}>{entry.name}</Text>
                    <Text style={styles.meta}>{entry.kind}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {notice ? <Text style={styles.meta}>{notice}</Text> : null}
            {!online ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{klCopy.weakNetwork}</Text>
                <IconButton icon="refresh" label={klCopy.tryAgain} disabled={busy} onPress={() => void refresh()} />
              </View>
            ) : null}
            <Pressable accessibilityRole="button" onPress={() => void finishChapter()} style={{ padding: 12, borderRadius: 8, backgroundColor: '#28583f' }}>
              <Text style={{ color: '#fff' }}>Mark Chapter Complete</Text>
            </Pressable>
            {rewardFeedback ? <Text accessibilityRole="alert" style={styles.meta}>{rewardFeedback}</Text> : null}

            <KlLiveDiscussion episodeId={klDatabaseId(selected.episodeNumber)} live={liveReleased} />
          </View>
        ) : (
          <View style={styles.list}>
            <View style={{ marginHorizontal: compact ? -16 : -24 }}>
              <KlCoverImage variant="hero" lowBandwidth={false} />
            </View>
            <Text style={styles.kicker}>{klCopy.libraryKicker}</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>{KL_SEASON_ONE_TITLE}</Text>
            <Text style={styles.by}>{KL_AUTHOR}</Text>
            <Text style={styles.lede}>{klCopy.librarySubtitle}</Text>
            <Text style={styles.meta}>{klCopy.libraryHint}</Text>
            <Pressable accessibilityRole="button" onPress={() => void refresh()} disabled={busy}>
              <Text style={styles.meta}>{busy ? 'Ina-update ang mga kabanata…' : 'I-refresh ang mga inilabas na kabanata'}</Text>
            </Pressable>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{klCopy.journey}</Text>
              <Text style={styles.body}>{completedChapters === null ? 'Kinukuha ang iyong progreso…' : journey.completed === 0 ? klCopy.journeyEmpty : `${journey.completed} kabanata ang natapos mo.`}</Text>
              <Text style={styles.meta}>{completedChapters === null ? '—' : journey.completed} / {journey.total}</Text>
              <Text style={styles.meta}>{klCopy.journeyNote}</Text>
            </View>
            {cache.lastEpisodeId && episodeReadable(cache.lastEpisodeId) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ipagpatuloy"
                onPress={() => openReadable(cache.lastEpisodeId as string)}
                style={styles.episode}
              >
                <View style={styles.statusRow}>
                  <MaterialCommunityIcons name="play" size={18} color="#f1d39b" />
                  <Text style={styles.episodeTitle}>Ipagpatuloy</Text>
                </View>
              </Pressable>
            ) : null}
            {isSystemAdmin ? <Text style={styles.meta}>System Admin · Manuscript approval (hindi awtomatikong release)</Text> : null}
            {isSystemAdmin && adminFeedback ? <Text accessibilityRole="alert" style={styles.meta}>{adminFeedback}</Text> : null}
            {EPISODES.map((episode) => {
              const readable = episodeReadable(episode.id);
              const showLock = lockedId === episode.id && !readable;
              return (
                <Pressable
                  key={episode.id}
                  accessibilityRole="button"
                  onPress={() => openReadable(episode.id)}
                  style={styles.episode}
                >
                  <Text style={styles.episodeTitle}>{displayChapterTitle(episode, releasedChapters.find((chapter) => chapter.season_number === 1 && chapter.episode_number === episode.episodeNumber))}</Text>
                  <View style={styles.statusRow}>
                    <MaterialCommunityIcons
                      name={readable ? 'book-open-variant' : 'lock'}
                      size={16}
                      color={readable ? '#b7e0c2' : '#e5c891'}
                    />
                    <Text style={styles.meta}>{readable ? klCopy.readable : klCopy.locked}</Text>
                  </View>
                  {showLock ? <Text style={styles.body}>{klCopy.lockedDetail}</Text> : null}
                  {isSystemAdmin ? (
                    <View style={{ marginTop: 10, gap: 8 }}>
                      <Pressable accessibilityRole="button" onPress={(event)=>{event.stopPropagation();setPreviewTarget(previewTarget===episode.id?null:episode.id);}}>
                        <Text style={{color:'#f1d39b'}}>Open prepared Admin Preview</Text>
                      </Pressable>
                      {previewTarget===episode.id?<KlAdminPreview episodeId={klDatabaseId(episode.episodeNumber)}/>:null}
                      {adminFeedbackEpisodeId === episode.id && adminFeedback ? (
                        <Text accessibilityRole="alert" style={styles.meta}>{adminFeedback}</Text>
                      ) : null}
                      <Text style={styles.meta}>Approve each illustration/audio in the private preview before approving the chapter. Chapter approval does not publish it.</Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Pressable accessibilityRole="button" disabled={Boolean(adminBusyId)} onPress={(event) => { event.stopPropagation(); void decideEpisode(episode.id, 'approve'); }} style={{ padding: 12, backgroundColor: '#28583f', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Approve</Text></Pressable>
                        <Pressable accessibilityRole="button" disabled={Boolean(adminBusyId)} onPress={(event) => { event.stopPropagation(); setRejectTarget(episode.id); setAdminFeedback(''); }} style={{ padding: 12, backgroundColor: '#783b3b', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Reject</Text></Pressable>
                        <Pressable accessibilityRole="button" disabled={Boolean(adminBusyId)} onPress={(event) => { event.stopPropagation(); setReleaseTarget(episode.id); setAdminFeedback(''); }} style={{ padding: 12, backgroundColor: '#36547b', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Release Now</Text></Pressable>
                      </View>
                      {releaseTarget === episode.id ? (
                        <View style={{ gap: 8 }}>
                          <Text style={styles.meta}>Ilalabas agad ang kabanatang ito sa lahat ng mambabasa. Kailangan approved na ito.</Text>
                          <Pressable accessibilityRole="button" disabled={Boolean(adminBusyId)} onPress={(event) => { event.stopPropagation(); void decideEpisode(episode.id, 'release'); }}><Text style={{ color: '#f1d39b' }}>Confirm Release Now</Text></Pressable>
                          <Pressable accessibilityRole="button" onPress={(event) => { event.stopPropagation(); setReleaseTarget(null); }}><Text style={{ color: '#fff' }}>Cancel</Text></Pressable>
                        </View>
                      ) : null}
                      {rejectTarget === episode.id ? (
                        <View style={{ gap: 8 }}>
                          <TextInput accessibilityLabel="Dahilan ng rejection" placeholder="Dahilan ng rejection (required)" placeholderTextColor="#999" value={rejectNotes} onChangeText={setRejectNotes} multiline style={{ color: '#fff', borderColor: '#aaa', borderWidth: 1, padding: 10, borderRadius: 8 }} />
                          <Pressable accessibilityRole="button" disabled={Boolean(adminBusyId) || !rejectNotes.trim()} onPress={(event) => { event.stopPropagation(); void decideEpisode(episode.id, 'reject', rejectNotes); }}><Text style={{ color: '#f1d39b' }}>Confirm Reject</Text></Pressable>
                          <Pressable accessibilityRole="button" onPress={(event) => { event.stopPropagation(); setRejectTarget(null); }}><Text style={{ color: '#fff' }}>Cancel</Text></Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <Modal
        visible={Boolean(openTermEntry)}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenTerm(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpenTerm(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.panelTitle}>{openTermEntry?.name}</Text>
            <Text style={styles.meta}>{openTermEntry?.kind}</Text>
            <Text style={styles.body}>{openTermEntry?.meaning}</Text>
            <IconButton icon="close" label="Isara" onPress={() => setOpenTerm(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
  active,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, active && styles.iconButtonOn, disabled && styles.iconButtonOff]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={disabled ? '#8d8374' : '#f1d39b'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#101a20' },
  content: { paddingTop: 18, paddingBottom: 72, maxWidth: 760, width: '100%', alignSelf: 'center', gap: 14 },
  kicker: { color: '#e5c891', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#f6dfb0', fontSize: 34, fontWeight: '800', lineHeight: 40 },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  chapter: { color: '#f6dfb0', fontSize: 30, fontWeight: '800', lineHeight: 36, marginTop: 8 },
  by: { color: '#c5c9c6', fontSize: 14 },
  lede: { color: '#e2e9df', fontSize: 16, lineHeight: 24 },
  body: { color: '#f1ece3', fontSize: 18, lineHeight: 30 },
  meta: { color: '#d6c8ad', fontSize: 13, lineHeight: 20 },
  term: { color: '#e5c891', fontWeight: '700', textDecorationLine: 'underline' },
  banner: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#78613c', gap: 8 },
  bannerText: { color: '#f1ece3', fontSize: 15, lineHeight: 22 },
  panel: { padding: 14, borderRadius: 16, backgroundColor: '#16262a', gap: 6 },
  panelTitle: { color: '#f6dfb0', fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 8 },
  episode: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#31443d',
    backgroundColor: '#142226',
    gap: 4,
  },
  episodeTitle: { color: '#fff4df', fontSize: 16, fontWeight: '700' },
  reader: { gap: 10, paddingTop: 4 },
  paragraph: { marginBottom: 14, gap: 10 },
  scene: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: '#101a20' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navTitle: { flex: 1, color: '#f6dfb0', fontSize: 16, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#78613c',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a2c2a',
  },
  iconButtonOn: { backgroundColor: '#3d3422', borderColor: '#e5c891' },
  iconButtonOff: { opacity: 0.4 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 12, 14, 0.72)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  sheet: {
    borderRadius: 18,
    backgroundColor: '#16262a',
    padding: 18,
    gap: 8,
  },
});
