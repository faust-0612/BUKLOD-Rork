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

import { useBuklodReduceMotion } from '@/components/HomeMotion';
import KlAudioControls from '@/components/kabihasnang-ligaw/KlAudioControls';
import KlCoverImage from '@/components/kabihasnang-ligaw/KlCoverImage';
import { klDatabaseId } from '@/components/kabihasnang-ligaw/KlAdminMediaUpload';
import KlAdminPreview from '@/components/kabihasnang-ligaw/KlAdminPreview';
import KlChapterAudio from '@/components/kabihasnang-ligaw/KlChapterAudio';
import KlDynamicLibrary from '@/components/kabihasnang-ligaw/KlDynamicLibrary';
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
const ASSETS = buildAssetGate();
const STORYBOARD = buildStoryboard();
type DynamicMedia = {
  kind: string; placement: number; path: string;
  anchor?: string | null; side?: string | null;
  effect?: SceneEffect | null; intensity?: number | null;
};
type AdminChapterState = {
  id: string;
  status: string;
  approved_at?: string | null;
  release_at?: string | null;
  preview_ready?: boolean;
};
function chapterStatusText(row?: AdminChapterState): string {
  if (!row) return 'Hindi pa nakumpirma ang estado ng kabanata. Refresh status.';
  if (row.status === 'approved' && row.approved_at) {
    if (row.release_at && new Date(row.release_at).getTime() <= Date.now()) return 'RELEASED — mababasa na';
    if (row.release_at) return 'APPROVED — naka-schedule pa ang release';
    return 'APPROVED — hindi pa released';
  }
  return row.preview_ready
    ? 'DRAFT — prepared na ang preview; hindi pa approved ang kabanata'
    : 'DRAFT — kailangan ang prepared preview at chapter approval';
}

function cacheKey(userId: string | null): string {
  return `kl.reader.v1.${userId ?? 'device'}`;
}

export default function KlReaderScreen() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useBuklodReduceMotion();
  const { online } = useNetwork();
  const { user, hasRole } = useAuth();
  const isSystemAdmin = hasRole('system_admin');
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null);
  const [adminChapterStates, setAdminChapterStates] = useState<Record<string, AdminChapterState>>({});
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
  const [releasedIds, setReleasedIds] = useState<string[]>([]);
  const [releasedTitles, setReleasedTitles] = useState<Record<number, string>>({});
  const [completedChapters, setCompletedChapters] = useState(0);
  const [earnedKlPoints, setEarnedKlPoints] = useState<number | null>(null);
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
  const selected = EPISODES.find((episode) => episode.id === selectedId) ?? null;
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
  const journey = journeySummary(completedChapters, 30);
  const chapterTitle = (episode: (typeof EPISODES)[number]) =>
    episode.kind === 'panimula' ? episode.title
      : releasedTitles[episode.episodeNumber]
        ? 'Kabanata ' + episode.episodeNumber + ': ' + releasedTitles[episode.episodeNumber]
        : episode.episodeNumber === 1 ? 'Kabanata 1: ' + episode.title : episode.title;
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

  const loadChapterApprovalStatus = async (): Promise<AdminChapterState[]> => {
    const { data, error } = await supabase.rpc(KL_RPC.adminList);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Hindi ma-load ang tunay na estado ng chapter mula sa server.');
    const rows = data as AdminChapterState[];
    setAdminChapterStates(Object.fromEntries(rows.map((entry) => [entry.id, entry])));
    return rows;
  };

  useEffect(() => {
    if (!isSystemAdmin) {
      setAdminChapterStates({});
      return;
    }
    let active = true;
    void supabase.rpc(KL_RPC.adminList).then(({ data }) => {
      if (active && Array.isArray(data)) {
        const rows = data as AdminChapterState[];
        setAdminChapterStates(Object.fromEntries(rows.map((entry) => [entry.id, entry])));
      }
    });
    return () => { active = false; };
  }, [isSystemAdmin]);

  const decideEpisode = async (episodeId: string, action: 'approve' | 'reject' | 'release', notes = '') => {
    if (!isSystemAdmin || adminBusyId) return;
    if (action === 'reject' && !notes.trim()) { setAdminFeedback('Maglagay ng dahilan ng rejection.'); return; }
    setAdminBusyId(episodeId);
    setAdminFeedbackEpisodeId(episodeId);
    setAdminFeedback('Pinoproseso ang desisyon…');
    let actionAccepted = false;
    try {
      const targetEpisode = EPISODES.find((item) => item.id === episodeId);
      if (!targetEpisode) throw new Error('Chapter not found');
      const dbId = klDatabaseId(targetEpisode.episodeNumber);
      const { data, error } = await supabase.rpc(KL_RPC.adminAction, adminActionArgs({ action, episodeId: dbId, notes }));
      if (error) throw error;
      if ((data as { ok?: boolean } | null)?.ok !== true) throw new Error('Hindi kinumpirma ng server ang action.');
      actionAccepted = true;
      const rows = await loadChapterApprovalStatus();
      const chapter = rows.find((row) => row.id === dbId);
      if (!chapter) throw new Error('Wala sa server chapter list ang napiling kabanata.');
      const approved = chapter.status === 'approved' && Boolean(chapter.approved_at);
      const released = approved && Boolean(chapter.release_at)
        && new Date(chapter.release_at as string).getTime() <= Date.now();
      if (action === 'approve' && !approved) throw new Error('Hindi pa approved sa server ang kabanata.');
      if (action === 'release' && !released) throw new Error('Hindi pa public sa server ang kabanata.');
      if (action === 'reject' && chapter.status !== 'draft') throw new Error('Hindi pa naibalik sa draft ang kabanata.');
      if (action === 'release') {
        await refresh();
      }
      setAdminFeedback(action === 'approve'
        ? '✓ APPROVED ang kabanata sa server. Hindi pa public; pindutin ang Release Now kung handa nang ilabas.'
        : action === 'release' ? '✓ RELEASED at server-verified na ang kabanata.'
          : '✓ Ibinalik sa draft at kinumpirma ng server.');
      setRejectTarget(null);
      setReleaseTarget(null);
      setRejectNotes('');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Subukan muli.';
      setAdminFeedback(actionAccepted
        ? 'Naipadala ang action pero hindi ma-verify ang final status: ' + detail + ' Gamitin ang Refresh chapter status bago muling pindutin.'
        : 'Hindi na-save ang desisyon: ' + detail);
    } finally { setAdminBusyId(null); }
  };

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const { data: libraryData, error } = await supabase.rpc(KL_RPC.listLibrary);
      if (!error && Array.isArray(libraryData)) {
        const rows = libraryData as { episode_number: number; title: string }[];
        setReleasedIds(rows.map((entry) => klDatabaseId(entry.episode_number)));
        setReleasedTitles(Object.fromEntries(rows.filter((entry) => typeof entry.title === 'string' && entry.title.trim())
          .map((entry) => [entry.episode_number, entry.title.trim()])));
      }
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
        const rows = data as { episode_number: number; title: string }[];
        setReleasedIds(rows.map((entry) => klDatabaseId(entry.episode_number)));
        setReleasedTitles(Object.fromEntries(rows.filter((entry) => typeof entry.title === 'string' && entry.title.trim())
          .map((entry) => [entry.episode_number, entry.title.trim()])));
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected || serverState !== 'readable' || !appActive || !online) return;
    const episodeId = klDatabaseId(selected.episodeNumber);
    const timer = setInterval(() => {
      void supabase.rpc('kl_reading_progress_v1', { p_episode_id: episodeId, p_action: 'ping' });
    }, 30000);
    return () => clearInterval(timer);
  }, [selected?.episodeNumber, serverState, appActive, online]);

  const refreshJourney = useCallback(async () => {
    if (!user?.id) { setCompletedChapters(0); setEarnedKlPoints(null); return; }
    // This figure is an actual ledger credit total for KL, not a guessed
    // balance and not the cosmetic story journey counter.
    const [journeyResult, ledgerResult] = await Promise.all([
      supabase.rpc('kl_my_story_journey_v1'),
      supabase.from('buklod_points_ledger').select('points,direction')
        .eq('user_id', user.id)
        .in('activity_type', ['kl_episode_completion', 'kl_season_completion'])
        .limit(500),
    ]);
    if (!journeyResult.error && journeyResult.data && typeof journeyResult.data === 'object') {
      const count = (journeyResult.data as { completed_chapters?: unknown }).completed_chapters;
      if (typeof count === 'number' && Number.isFinite(count)) setCompletedChapters(Math.max(0, count));
    }
    if (ledgerResult.error || !Array.isArray(ledgerResult.data)) {
      setEarnedKlPoints(null);
    } else {
      const credited = ledgerResult.data.reduce((sum, row) =>
        sum + (row.direction === 'credit' && typeof row.points === 'number' ? row.points : 0), 0);
      setEarnedKlPoints(credited);
    }
  }, [user?.id]);

  useEffect(() => { void refreshJourney().catch(() => undefined); }, [refreshJourney]);

  const finishChapter = async () => {
    if (!selected) return;
    const { data, error } = await supabase.rpc('kl_reading_progress_v1', {
      p_episode_id: klDatabaseId(selected.episodeNumber), p_action: 'complete',
    });
    if (error) { setRewardFeedback(error.message); return; }
    const result = data as { new_completion?: boolean; points_awarded?: number; completed?: boolean };
    setRewardFeedback(result?.completed === false ? 'Kailangan muna ng sapat na oras ng pagbabasa.' :
      result?.new_completion ? 'Kabanata completed · +' + (result.points_awarded ?? 0) + ' BUKLOD Points' : 'Naitala na ang completion ng kabanatang ito.');
    if (result?.new_completion) void refreshJourney().catch(() => undefined);
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
        const payload = data as { readable?: boolean; title?: string; content?: { text?: string }[] };
        if (payload.readable === true && Array.isArray(payload.content)) {
          if (typeof payload.title === 'string' && payload.title.trim()) {
            setReleasedTitles((previous) => ({ ...previous, [episode.episodeNumber]: payload.title!.trim() }));
          }
          setReleasedIds((previous) => previous.includes(dbId) ? previous : [...previous, dbId]);
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
  // Discussion is server-authoritative. Bundled/provisional chapters are not a release.
  const liveReleased = Boolean(selected && serverState === 'readable');
  // kl_read_episode_v1 has already verified approval AND release on the server;
  // do not hide discussion if the separate list-library refresh is delayed.

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
        contentContainerStyle={[styles.content, { paddingHorizontal: compact ? 16 : 24 }]}
        scrollEventThrottle={32}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => syncViewport(event.nativeEvent.contentOffset.y)}
      >
        <Stack.Screen options={{ title: selected ? chapterTitle(selected) : 'Kabihasnang Ligaw' }} />
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
              <Text style={styles.navTitle} numberOfLines={1}>{chapterTitle(selected)}</Text>
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
            <Text style={[styles.chapter, compact && styles.titleCompact]}>{chapterTitle(selected)}</Text>
            {mediaUrls['music:0'] || mediaUrls['ambient:0'] ? (
              <KlChapterAudio music={mediaUrls['music:0']} ambient={mediaUrls['ambient:0']} />
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
                  const label = selected.episodeNumber === 1 ? 'Kabanata 01' : selected.title;
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

            {liveReleased ? (
              <Text style={styles.meta}>Puntos: +7 sa unang verified completion ng kabanata · +10 kapag natapos ang buong serye.</Text>
            ) : null}
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
            <KlDynamicLibrary additionalSeasonsOnly />
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{klCopy.journey}</Text>
              <Text style={styles.body}>{journey.completed > 0
                ? 'May ' + journey.completed + ' natapos na kabanata.' : klCopy.journeyEmpty}</Text>
              <Text style={styles.meta}>Kabanata: +7 points sa unang verified completion · Buong serye: +10 points.</Text>
              <Text style={styles.meta}>{journey.completed} / {journey.total}</Text>
              <Text style={styles.meta}>{klCopy.journeyNote}</Text>
              {earnedKlPoints != null ? <Text style={styles.meta}>KL points earned (ledger): {earnedKlPoints}</Text>
                : <Text style={styles.meta}>KL points: hindi pa ma-verify sa ledger. Subukang mag-refresh.</Text>}
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
            {isSystemAdmin ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.meta}>System Admin · Magkaiba ang media approval, chapter approval at public release.</Text>
                <Pressable accessibilityRole="button" disabled={Boolean(adminBusyId)}
                  onPress={() => void loadChapterApprovalStatus().then(() => setAdminFeedback('Na-refresh ang chapter status mula sa server.'))
                    .catch((error) => setAdminFeedback('Hindi ma-refresh ang status: ' + (error instanceof Error ? error.message : 'Retry.')))}>
                  <Text style={{ color: '#f1d39b', paddingVertical: 8 }}>Refresh chapter approval status</Text>
                </Pressable>
              </View>
            ) : null}
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
                  <Text style={styles.episodeTitle}>{chapterTitle(episode)}</Text>
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
                      <Text style={{ color: '#f1d39b', fontWeight: '700' }}>
                        {chapterStatusText(adminChapterStates[klDatabaseId(episode.episodeNumber)])}
                      </Text>
                      <Text style={styles.meta}>Media approval ≠ Chapter approval ≠ Release. Approve each illustration/audio first, then Approve chapter, then Release Now (or schedule).</Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Pressable accessibilityRole="button" disabled={Boolean(adminBusyId) || adminChapterStates[klDatabaseId(episode.episodeNumber)]?.status === 'approved'} onPress={(event) => { event.stopPropagation(); void decideEpisode(episode.id, 'approve'); }} style={{ padding: 12, backgroundColor: '#28583f', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Approve</Text></Pressable>
                        <Pressable accessibilityRole="button" disabled={Boolean(adminBusyId)} onPress={(event) => { event.stopPropagation(); setRejectTarget(episode.id); setAdminFeedback(''); }} style={{ padding: 12, backgroundColor: '#783b3b', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Reject</Text></Pressable>
                        <Pressable accessibilityRole="button" disabled={Boolean(adminBusyId) || !adminChapterStates[klDatabaseId(episode.episodeNumber)]?.approved_at || adminChapterStates[klDatabaseId(episode.episodeNumber)]?.status !== 'approved'} onPress={(event) => { event.stopPropagation(); setReleaseTarget(episode.id); setAdminFeedback(''); }} style={{ padding: 12, backgroundColor: '#36547b', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Release Now</Text></Pressable>
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
